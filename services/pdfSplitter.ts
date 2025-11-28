
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { SplitDocument, SplitResultData } from '../types';
import { convertPdfToImage } from './pdfUtils';
import { GoogleGenAI } from "@google/genai";
import { saveFilesToDirectory, downloadFilesAsZip } from './fileSaver';

// Ensure worker is set
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractCodeFromText = (text: string, keywords: string[]): string | null => {
  if (!text) return null;
  for (const kw of keywords) {
    if (!kw) continue;
    const trimmedKw = kw.trim();
    if (!trimmedKw) continue;
    const regex = new RegExp(`${escapeRegex(trimmedKw)}\\s*[:.]?\\s*([a-zA-Z0-9_\\-\\./]+)`, 'i');
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
};

const base64ToUint8Array = (value: string): Uint8Array => {
  const normalized = value.replace(/[\r\n]/g, '');
  if (typeof atob === 'function') {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const bufferCtor = (typeof globalThis !== 'undefined' ? (globalThis as any).Buffer : undefined);
  if (bufferCtor) {
    return Uint8Array.from(bufferCtor.from(normalized, 'base64'));
  }

  throw new Error('Base64 decoding is not supported in this environment.');
};

const loadImageFromBase64 = (base64: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = `data:image/jpeg;base64,${base64}`;
  });
};


// Detect if page has signature using AI
const detectSignatureOnPage = async (base64: string): Promise<boolean> => {
  if (!process.env.API_KEY) {
    return false;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-2.5-flash';

    const prompt = `Bạn là trợ lý AI chuyên phân tích hình ảnh PDF.

Nhiệm vụ: Xác định xem trang này có chữ ký (signature) hay không.

Chữ ký thường có:
- Tên người ký (ví dụ: "Vũ Anh Tuấn", "Phạm Phương Chi")
- Chức danh (ví dụ: "P. TRƯỞNG PHÒNG", "TRƯỞNG PHÒNG DỰ BÁO")
- Có thể có chữ ký viết tay hoặc chữ ký điện tử
- Thường ở phần dưới của trang

Nếu trang có chữ ký, trả về:
{
  "hasSignature": true
}

Nếu KHÔNG có chữ ký, trả về:
{
  "hasSignature": false
}

CHỈ trả về JSON, không có text giải thích nào khác.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64,
            },
          },
          { text: prompt } as any,
        ],
      },
      config: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    const jsonText = response.text?.trim();
    if (!jsonText) return false;

    const result = JSON.parse(jsonText);
    return result.hasSignature === true;
  } catch (error) {
    console.warn('[PDF Splitter] AI signature detection failed:', error);
    return false;
  }
};

// Check if page is a log-only page (has log image but no signature)
const isLogOnlyPage = async (base64: string): Promise<boolean> => {
  // Check if page has signature
  const hasSignature = await detectSignatureOnPage(base64);
  
  // If has signature, it's not a log-only page (keep it in main document)
  if (hasSignature) {
    return false;
  }

  // Check if page has log image (entire page or bottom part)
  const image = await loadImageFromBase64(base64);
  const originalCanvas = document.createElement('canvas');
  const originalCtx = originalCanvas.getContext('2d');
  if (!originalCtx) {
    return false;
  }

  originalCanvas.width = image.width;
  originalCanvas.height = image.height;
  originalCtx.drawImage(image, 0, 0);

  // Check if entire page is mostly image (log page)
  const imageData = originalCtx.getImageData(0, 0, image.width, image.height);
  const { data } = imageData;
  let nonWhitePixels = 0;
  const totalPixels = image.width * image.height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luminance < 240) { // Not white
      nonWhitePixels++;
    }
  }

  const contentRatio = nonWhitePixels / totalPixels;
  // If page has significant content (likely an image/log), it's a log-only page
  return contentRatio > 0.1; // At least 10% of page has content
};

// Create PDF from entire page image (for log-only pages)
const createPdfFromPageImage = async (base64: string): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  const imageBytes = base64ToUint8Array(base64);
  const embeddedImage = await pdfDoc.embedJpg(imageBytes);
  const { width, height } = embeddedImage;
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width,
    height
  });
  return pdfDoc.save();
};

// Helper function to OCR ALL pages in one batch call
const ocrAllPagesForCodes = async (base64Images: string[], keywords: string[]): Promise<Array<{ page: number; code: string | null }>> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key chưa được cấu hình.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-2.5-flash';

  // Gemini 2.5 Flash supports up to ~20 images per request, so we'll batch them
  const BATCH_SIZE = 15; // Conservative batch size
  const results: Array<{ page: number; code: string | null }> = [];

  // Process in batches
  for (let batchStart = 0; batchStart < base64Images.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, base64Images.length);
    const batchImages = base64Images.slice(batchStart, batchEnd);
    const batchPageNumbers = Array.from({ length: batchEnd - batchStart }, (_, i) => batchStart + i + 1);

    console.log(`[PDF Splitter] OCRing batch: pages ${batchPageNumbers[0]}-${batchPageNumbers[batchPageNumbers.length - 1]} (${batchImages.length} pages)`);

    const prompt = `Bạn là trợ lý AI chuyên đọc và trích xuất thông tin từ tài liệu PDF.

Nhiệm vụ: Tìm và trích xuất giá trị của các nhãn sau trong TẤT CẢ các trang được cung cấp: ${keywords.map(k => `"${k}"`).join(', ')}.

Ví dụ: Nếu bạn thấy "Mã số: QT.MSI-BM.01" hoặc "Số: TTNH-04h00/ĐBQG" ở trang 1, hãy trả về phần mã ở sau nhãn đó cho trang tương ứng.

Quy tắc:
1. Duyệt qua TẤT CẢ các hình ảnh (mỗi hình là 1 trang PDF)
2. Tìm các nhãn: ${keywords.map(k => `"${k}"`).join(', ')} trong mỗi trang (không phân biệt hoa/thường)
3. Trích xuất giá trị ngay sau nhãn (có thể có dấu hai chấm, khoảng trắng, hoặc không)
4. Giá trị thường là mã code như: QT.MSI-BM.01, KTKS.MSI-XX.02, TTNH-04H00/DBQG, v.v.
5. Chỉ trả về MÃ CODE, không trả về nhãn
6. Nếu không tìm thấy ở trang nào, trả về "null" cho trang đó

Trả về dưới dạng JSON array, mỗi phần tử là một object:
[
  { "page": 1, "code": "QT.MSI-BM.01" },
  { "page": 2, "code": "null" },
  { "page": 3, "code": "QT.MSI-BM.02" },
  ...
]

CHỈ trả về JSON array, không có text giải thích nào khác.`;

    try {
      // Prepare content parts: all images + prompt
      const contentParts = batchImages.map(img => ({
        inlineData: {
          mimeType: 'image/jpeg',
          data: img,
        },
      }));
      contentParts.push({ text: prompt } as any);

      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: contentParts,
        },
        config: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      });

      const jsonText = response.text?.trim();
      if (!jsonText) {
        console.warn(`[PDF Splitter] No response from OCR batch ${batchStart + 1}-${batchEnd}`);
        // Fill with nulls for this batch
        batchPageNumbers.forEach(pageNum => {
          results.push({ page: pageNum, code: null });
        });
        continue;
      }

      // Parse JSON response
      let batchResults: Array<{ page: number; code: string | null }>;
      try {
        // Try to extract JSON from response (in case there's extra text)
        let jsonStr = jsonText;
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
        batchResults = JSON.parse(jsonStr);
        
        // Ensure it's an array
        if (!Array.isArray(batchResults)) {
          throw new Error('Response is not an array');
        }
      } catch (parseError) {
        console.error(`[PDF Splitter] Failed to parse OCR response:`, jsonText);
        console.error(`[PDF Splitter] Parse error:`, parseError);
        // Fill with nulls for this batch
        batchPageNumbers.forEach(pageNum => {
          results.push({ page: pageNum, code: null });
        });
        continue;
      }

      // Process results - map to actual page numbers in batch
      // Assume results are in the same order as images (if page numbers are missing or wrong)
      batchPageNumbers.forEach((actualPageNum, idx) => {
        const item = batchResults[idx] || batchResults.find(r => r.page === actualPageNum) || batchResults.find(r => r.page === idx + 1);
        let code = item?.code;
        
        if (!code || typeof code !== 'string' || code.toLowerCase() === 'null' || code.toLowerCase() === 'không tìm thấy') {
          results.push({ page: actualPageNum, code: null });
          return;
        }
        
        code = code.replace(/^["']|["']$/g, '').trim();
        const extracted = extractCodeFromText(code, keywords);
        results.push({ page: actualPageNum, code: extracted || code || null });
      });

    } catch (error) {
      console.error(`[PDF Splitter] OCR error on batch ${batchStart + 1}-${batchEnd}:`, error);
      // Fill with nulls for this batch on error
      batchPageNumbers.forEach(pageNum => {
        results.push({ page: pageNum, code: null });
      });
    }
  }

  // Sort by page number
  results.sort((a, b) => a.page - b.page);
  
  return results;
};

export const splitPdfByKeywords = async (
  file: File, 
  keyword: string = "Mã số",
  rootDirHandle?: FileSystemDirectoryHandle
): Promise<SplitResultData> => {
  try {
    // Initialize file storage for File System Access API
    interface FileToSave {
      path: string;
      filename: string;
      bytes: Uint8Array;
    }
    const filesToSave: FileToSave[] = [];

    const arrayBuffer = await file.arrayBuffer();
    
    // 1. Load PDF to get page count
    const pdfJsBuffer = arrayBuffer.slice(0);
    const loadingTask = pdfjsLib.getDocument({ data: pdfJsBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const defaultKeywords = ["Mã số", "Số"];
    const keywords = Array.from(new Set([keyword, ...defaultKeywords].map(k => k?.trim()).filter(Boolean)));

    console.log(`[PDF Splitter] Processing ${numPages} pages with keywords: ${keywords.join(', ')}`);

    // 2. Convert ALL pages to images for OCR
    console.log(`[PDF Splitter] Converting PDF to images for OCR...`);
    const base64Images = await convertPdfToImage(file, -1); // -1 means convert all pages
    console.log(`[PDF Splitter] Converted ${base64Images.length} pages to images`);

    // 3. STEP 1: Detect broadcast code (MET, NAV, SAR, WX) from "Mã bản tin đài xử lý"
    // Keep checking pages until we find both broadcast code and service code, or run out of pages
    console.log(`[PDF Splitter] Step 1: Detecting broadcast code from "Mã bản tin đài xử lý"...`);
    
    let detectedBroadcastCode: string | null = null;
    let detectedServiceCode: string | null = null; // NTX, RTP, EGC
    
    if (process.env.API_KEY) {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const model = 'gemini-2.5-flash';
      
      // Check pages in batches of 3 until we find both broadcast code and service code, or run out of pages
      // Both are needed: broadcast code (MET, NAV, SAR, WX, TUYEN) and service code (NTX, RTP, EGC)
      const batchSize = 3;
      let startPage = 1;
      
      while (startPage <= numPages && (!detectedBroadcastCode || !detectedServiceCode)) {
        const endPage = Math.min(startPage + batchSize - 1, numPages);
        const pagesToCheck = [];
        for (let p = startPage; p <= endPage; p++) {
          pagesToCheck.push(p);
        }
        
        console.log(`[PDF Splitter] Checking pages ${startPage}-${endPage} for broadcast code...`);
        
        const imagesToCheck = pagesToCheck.map(pageNum => base64Images[pageNum - 1]).filter(Boolean);
        
        if (imagesToCheck.length > 0) {
          const prompt = `Bạn là trợ lý AI chuyên đọc tài liệu PDF.

Nhiệm vụ: Tìm "Mã bản tin đài xử lý" trong các trang được cung cấp.

Tìm "Mã bản tin đài xử lý" và trích xuất:
- Broadcast code: MET, NAV, SAR, WX, TUYEN (chỉ một trong các mã này)
- Service code: NTX, RTP, EGC (nếu có)

Ví dụ:
- "4710/2025/DNR-MET-RTP" → broadcastCode: "MET", serviceCode: "RTP"
- "DNR-NAV-NTX" → broadcastCode: "NAV", serviceCode: "NTX"
- "SAR" → broadcastCode: "SAR", serviceCode: null

Trả về JSON:
{
  "broadcastCode": "MET" hoặc "NAV" hoặc "SAR" hoặc "WX" hoặc "TUYEN" hoặc null,
  "serviceCode": "NTX" hoặc "RTP" hoặc "EGC" hoặc null
}

CHỈ trả về JSON, không có text giải thích nào khác.`;

          try {
            const contentParts = imagesToCheck.map(img => ({
              inlineData: {
                mimeType: 'image/jpeg',
                data: img,
              },
            }));
            contentParts.push({ text: prompt } as any);

            const response = await ai.models.generateContent({
              model: model,
              contents: {
                parts: contentParts,
              },
              config: {
                temperature: 0,
                responseMimeType: "application/json",
              },
            });

            const jsonText = response.text?.trim();
            if (jsonText) {
              try {
                let jsonStr = jsonText;
                const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  jsonStr = jsonMatch[0];
                }
                const result = JSON.parse(jsonStr);
                
                // Only update if we haven't found it yet
                if (!detectedBroadcastCode && result.broadcastCode) {
                  const broadcastCode = result.broadcastCode?.toUpperCase();
                  if (broadcastCode && ['MET', 'NAV', 'SAR', 'WX', 'TUYEN'].includes(broadcastCode)) {
                    detectedBroadcastCode = broadcastCode;
                  }
                }
                
                if (!detectedServiceCode && result.serviceCode) {
                  const serviceCode = result.serviceCode?.toUpperCase();
                  if (serviceCode && ['NTX', 'RTP', 'EGC'].includes(serviceCode)) {
                    detectedServiceCode = serviceCode;
                  }
                }
                
                // If we found both codes, we can stop
                if (detectedBroadcastCode && detectedServiceCode) {
                  console.log(`[PDF Splitter] Found both codes on pages ${startPage}-${endPage}`);
                  break;
                }
                
                // Log progress
                if (detectedBroadcastCode && !detectedServiceCode) {
                  console.log(`[PDF Splitter] Found broadcast code (${detectedBroadcastCode}) but still looking for service code...`);
                } else if (!detectedBroadcastCode && detectedServiceCode) {
                  console.log(`[PDF Splitter] Found service code (${detectedServiceCode}) but still looking for broadcast code...`);
                }
              } catch (e) {
                console.warn(`[PDF Splitter] Failed to parse broadcast code detection:`, jsonText);
              }
            }
          } catch (error) {
            console.warn(`[PDF Splitter] Error detecting broadcast code on pages ${startPage}-${endPage}:`, error);
          }
        }
        
        // Move to next batch
        startPage = endPage + 1;
      }
      
      console.log(`[PDF Splitter] Detected broadcast code: ${detectedBroadcastCode}, service code: ${detectedServiceCode}`);
    }

    // 4. STEP 2: OCR ALL pages to find "Mã số/Số" for splitting (old logic)
    console.log(`[PDF Splitter] Step 2: OCR all pages to find "Mã số/Số" for splitting...`);
    
    // Use the old ocrAllPagesForCodes function - only extract "Mã số/Số"
    const pageCodes = await ocrAllPagesForCodes(base64Images, keywords);
    
    // Log results
    const foundCodes = pageCodes.filter(pc => pc.code);
    console.log(`[PDF Splitter] OCR completed. Found codes on ${foundCodes.length} pages:`);
    foundCodes.forEach(pc => {
      console.log(`[PDF Splitter] Page ${pc.page}: "${pc.code}"`);
    });

    // 5. Process OCR results to determine split points (old logic - only based on "Mã số/Số")
    const documents: SplitDocument[] = [];
    let currentDocStartPage = 1;
    let currentDocCode = ""; 
    let currentDocName = "Document_1";
    let foundAnyKeyword = false;

    for (const { page, code } of pageCodes) {
      if (code && code.trim().length > 0) {
        foundAnyKeyword = true;
        let detectedCode = code.trim();
        
        // Safety: Limit length and replace illegal filename chars
        if (detectedCode.length > 50) detectedCode = detectedCode.substring(0, 50);
        detectedCode = detectedCode.replace(/[\\/:*?"<>|]/g, '_').replace(/^[\.\-_]+|[\.\-_]+$/g, '');
        
        if (!detectedCode || detectedCode.length === 0) {
          detectedCode = `Document_${documents.length + 1}`;
        }
        
        const safeName = detectedCode;

        // Logic: Grouping - Only split if the code CHANGES
        if (currentDocCode === "") {
          // First code found - start tracking from page 1
          currentDocCode = detectedCode;
          currentDocName = safeName;
          currentDocStartPage = 1;
          console.log(`[PDF Splitter] First document starts at page 1 with code: "${detectedCode}"`);
        } else if (detectedCode !== currentDocCode) {
          // Code changed! This marks the start of a NEW document
          // 1. Push the PREVIOUS document (from startPage to page-1)
          const prevDoc = {
            id: Math.random().toString(36).substr(2, 9),
            filename: `${currentDocName}.pdf`,
            code: currentDocCode,
            startPage: currentDocStartPage,
            endPage: page - 1,
            pageCount: (page - 1) - currentDocStartPage + 1
          };
          documents.push(prevDoc);
          console.log(`[PDF Splitter] Document created: ${prevDoc.filename} (pages ${prevDoc.startPage}-${prevDoc.endPage})`);
          
          // 2. Start tracking the NEW document
          currentDocStartPage = page;
          currentDocCode = detectedCode;
          currentDocName = safeName;
          console.log(`[PDF Splitter] New document starts at page ${page} with code: "${detectedCode}"`);
        }
        // If detectedCode === currentDocCode, do nothing. Keep accumulating pages.
      }
    }

    // 3. Push the FINAL document (from currentDocStartPage to end)
    // Only push if we found at least one keyword, otherwise the file doesn't need splitting
    if (foundAnyKeyword) {
      const finalDoc = {
          id: Math.random().toString(36).substr(2, 9),
          filename: currentDocCode ? `${currentDocName}.pdf` : `Document_${documents.length + 1}.pdf`,
          code: currentDocCode || undefined,
          startPage: currentDocStartPage,
          endPage: numPages,
          pageCount: numPages - currentDocStartPage + 1
      };
      documents.push(finalDoc);
      console.log(`[PDF Splitter] Final document created: ${finalDoc.filename} (pages ${finalDoc.startPage}-${finalDoc.endPage})`);
    } else {
      // No keyword found - create a single document with all pages
      console.log(`[PDF Splitter] No keyword found, creating single document with all pages`);
      documents.push({
          id: Math.random().toString(36).substr(2, 9),
          filename: `Document_1.pdf`,
          code: undefined,
          startPage: 1,
          endPage: numPages,
          pageCount: numPages
      });
    }

    console.log(`[PDF Splitter] Total documents to create: ${documents.length}`);

    // 4. Create Split PDFs (pdf-lib)
    const sourcePdfDoc = await PDFDocument.load(arrayBuffer);

    // Get folder path based on document code, detected broadcast code, and detected service code
    // Files must be in subfolders (MET, NAV, SAR, WX, TUYEN), not at root level
    // Structure: {DICH VU {NTX|RTP|EGC}|BAN TIN NGUON|COVER}/.../{MET|NAV|SAR|WX|TUYEN}/
    const getFolderPath = (code: string | undefined): string | null => {
      if (!code) return null; // Skip files without code

      const codeUpper = code.toUpperCase();
      
      // QT 01 always goes to COVER/COVER (regardless of broadcast code)
      if (codeUpper.includes('QT') && (codeUpper.includes('.01') || codeUpper.includes('01'))) {
        // Use detected broadcast code, default to MET if not found
        const broadcastCode = detectedBroadcastCode || 'MET';
        return `COVER/COVER/${broadcastCode}`;
      }
      
      // KTKS 01 -> COVER/KTKSTC BM 01/{MET|NAV|SAR|WX} (no TUYEN)
      if (codeUpper.includes('KTKS') && (codeUpper.includes('.01') || codeUpper.includes('01'))) {
        const validCodes = ['MET', 'NAV', 'SAR', 'WX'];
        const broadcastCode = (detectedBroadcastCode && validCodes.includes(detectedBroadcastCode)) ? detectedBroadcastCode : 'MET';
        return `COVER/KTKSTC BM 01/${broadcastCode}`;
      }
      
      // Check if this is TTNH document (by code pattern)
      const isTTNH = codeUpper.includes('TTNH') || codeUpper.includes('DBQG') || codeUpper.includes('04H00');
      if (isTTNH) {
        // TTNH goes to BAN TIN NGUON with detected broadcast code
        const broadcastCode = detectedBroadcastCode || 'MET';
        return `BAN TIN NGUON/${broadcastCode}`;
      }

      let basePath = '';
      let serviceFolder = '';

      // Determine service folder and base folder based on document code and detected service code
      // Use detected service code from Step 1
      if (detectedServiceCode === 'EGC') {
        serviceFolder = 'DICH VU EGC';
        // Determine base folder for EGC
        if (codeUpper.includes('QT') && (codeUpper.includes('.02') || codeUpper.includes('02'))) {
          basePath = 'BAN TIN NGUON DA DUOC XU LY EGC';
        } else if (codeUpper.includes('KTKS') && (codeUpper.includes('.02') || codeUpper.includes('02'))) {
          basePath = 'KTKS TAI CHO BAN TIN NGUON XU LY EGC';
        } else {
          // Skip unknown EGC document types
          return null;
        }
      } else if (detectedServiceCode === 'NTX' || detectedServiceCode === 'RTP') {
        // NTX and RTP use the same folder structure
        serviceFolder = detectedServiceCode === 'NTX' ? 'DICH VU NTX' : 'DICH VU RTP';
        
        // Biểu mẫu 02: BAN TIN NGUON DA DUOC XU LY
        if (codeUpper.includes('.02') || codeUpper.includes('02')) {
          if (codeUpper.includes('QT') && (codeUpper.includes('.02') || codeUpper.includes('02'))) {
            // QT 02 → BAN TIN NGUON DA DUOC XU LY/BAN TIN NGUON DA DUOC XU LY (có 2 cấp)
            basePath = 'BAN TIN NGUON DA DUOC XU LY/BAN TIN NGUON DA DUOC XU LY';
          } else if (codeUpper.includes('KTKS') && (codeUpper.includes('.02') || codeUpper.includes('02'))) {
            // KTKS 02 → KTKSTC BAN TIN NGUON DA DUOC XU LY
            basePath = 'BAN TIN NGUON DA DUOC XU LY/KTKSTC BAN TIN NGUON DA DUOC XU LY';
          } else {
            // Unknown biểu mẫu 02 type (không match QT hoặc KTKS) - skip
            return null;
          }
        }
        // Biểu mẫu 03: BAN TIN XU LY PHAT/BAN TIN XU LY TRUOC KHI PHAT
        else if (codeUpper.includes('.03') || codeUpper.includes('03')) {
          if (codeUpper.includes('QT') && (codeUpper.includes('.03') || codeUpper.includes('03'))) {
            // QT 03 → BAN TIN XU LY PHAT/BAN TIN XU LY TRUOC KHI PHAT
            basePath = 'BAN TIN XU LY PHAT/BAN TIN XU LY TRUOC KHI PHAT';
          } else if (codeUpper.includes('KTKS') && (codeUpper.includes('.03') || codeUpper.includes('03'))) {
            // KTKS 03 → BAN TIN XU LY PHAT/KTKSTC BAN TIN XU LY TRUOC KHI PHAT
            basePath = 'BAN TIN XU LY PHAT/KTKSTC BAN TIN XU LY TRUOC KHI PHAT';
          } else {
            // Default for biểu mẫu 03
            basePath = 'BAN TIN XU LY PHAT/BAN TIN XU LY TRUOC KHI PHAT';
          }
        }
        // Biểu mẫu 04: KIEM TRA KIEM SOAT SAU PHAT (mặc định)
        else if (codeUpper.includes('.04') || codeUpper.includes('04')) {
          // Mặc định vào KIEM TRA KIEM SOAT SAU PHAT (không cần check QT BM)
          basePath = 'KIEM TRA KIEM SOAT SAU PHAT';
        } else {
          // Unknown document type
          return null;
        }
      } else {
        // No service folder determined, skip
        return null;
      }

      // Use detected broadcast code from Step 1, default to MET if not found
      const broadcastCode = detectedBroadcastCode || 'MET';

      // Add broadcast code as subfolder (MET, NAV, SAR, WX, TUYEN)
      basePath = `${basePath}/${broadcastCode}`;

      // Return path without root prefix (will be added when saving)
      return `${serviceFolder}/${basePath}`;
    };

    // Get LOG folder path - LOG FTP is at same level as BAN TIN NGUON
    // Structure: LOG FTP/{MET|NAV|SAR|WX}
    // Note: LOG only has MET, NAV, SAR, WX (no TUYEN)
    const getLogFolderPath = (): string | null => {
      if (!detectedBroadcastCode) {
        return null; // Skip if no broadcast code
      }

      // Find subfolder code (MET, NAV, SAR, WX - no TUYEN for LOG)
      const validLogCodes = ['MET', 'NAV', 'SAR', 'WX'];
      const subFolderCode = validLogCodes.includes(detectedBroadcastCode) ? detectedBroadcastCode : 'MET';
      
      return `LOG FTP/${subFolderCode}`;
    };

    // Helper: Check if document code suggests it might have log pages
    // Documents like QT.MSI-BM typically don't have log pages
    const mightHaveLog = (code: string | undefined): boolean => {
        if (!code) return true; // Unknown documents, check to be safe
        const codeUpper = code.toUpperCase();
        // Skip check for known document types that don't have logs
        if (codeUpper.includes('QT.MSI-BM') || codeUpper.includes('QTMSI-BM')) {
            return false;
      }
        // Check others by default
        return true;
    };

    // Check TTNH status from document code
    const documentIsTTNH = new Map<string, boolean>();
    
    for (const doc of documents) {
      // Check if document code indicates TTNH
      let hasTTNH = false;
      if (doc.code) {
        const codeUpper = doc.code.toUpperCase();
        if (codeUpper.includes('TTNH') || codeUpper.includes('DBQG') || codeUpper.includes('04H00')) {
          hasTTNH = true;
        }
      }
      documentIsTTNH.set(doc.id, hasTTNH);
      
      if (hasTTNH) {
        console.log(`[PDF Splitter] Document ${doc.filename} is TTNH/BAN TIN NGUON`);
      }
    }
    
    console.log(`[PDF Splitter] Using detected broadcast code: ${detectedBroadcastCode || 'none'}, service code: ${detectedServiceCode || 'none'}`);

    // Create PDFs and organize into folders
    // For each document, check pages and extract log-only pages (only if might have log)
    for (const doc of documents) {
        // Skip invalid ranges (safety check)
        if (doc.startPage > doc.endPage || doc.startPage < 1 || doc.endPage > numPages) {
            console.warn(`[PDF Splitter] Skipping invalid document: pages ${doc.startPage}-${doc.endPage}`);
            continue;
        }

        // Skip log check for documents that typically don't have logs (optimization)
        const shouldCheckLog = mightHaveLog(doc.code);
        const pagesToInclude: number[] = [];
        const logPagesInDoc: number[] = [];

        if (shouldCheckLog && doc.pageCount > 1) {
            // Only check log for documents with multiple pages (log is usually a separate page)
            // Quick check: only check last page(s) for log (log usually at the end)
            const pagesToCheck = doc.pageCount <= 3 ? [doc.endPage] : [doc.endPage - 1, doc.endPage];
            
            for (let j = doc.startPage; j <= doc.endPage; j++) {
                const pageIndex = j - 1;
                const imageBase64 = base64Images[pageIndex];
                
                if (!imageBase64) {
                    pagesToInclude.push(j);
                    continue;
                }

                // Only check pages that might be log (usually last pages)
                if (pagesToCheck.includes(j)) {
                    try {
                        // Quick heuristic check first (faster than AI)
                        const image = await loadImageFromBase64(imageBase64);
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            pagesToInclude.push(j);
                            continue;
                        }

                        canvas.width = image.width;
                        canvas.height = image.height;
                        ctx.drawImage(image, 0, 0);

                        // Quick check: if page has significant content, might be log
                        const imageData = ctx.getImageData(0, 0, image.width, image.height);
                        const { data } = imageData;
                        let nonWhitePixels = 0;
                        const totalPixels = image.width * image.height;

                        for (let i = 0; i < data.length; i += 4) {
                            const r = data[i];
                            const g = data[i + 1];
                            const b = data[i + 2];
                            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                            if (luminance < 240) {
                                nonWhitePixels++;
                            }
                        }

                        const contentRatio = nonWhitePixels / totalPixels;
                        // If page has significant content, do full AI check
                        if (contentRatio > 0.1) {
                            const isLogPage = await isLogOnlyPage(imageBase64);
                            if (isLogPage) {
                                logPagesInDoc.push(j);
                                console.log(`[PDF Splitter] Page ${j} in document ${doc.filename} is log-only, will extract separately`);
                                continue;
                            }
                        }
                        pagesToInclude.push(j);
                    } catch (error) {
                        console.warn(`[PDF Splitter] Error checking page ${j} in document ${doc.filename}:`, error);
                        pagesToInclude.push(j);
                    }
                } else {
                    // Not a potential log page, include it
                    pagesToInclude.push(j);
                }
            }
        } else {
            // Skip log check, include all pages
        for (let j = doc.startPage; j <= doc.endPage; j++) {
                pagesToInclude.push(j);
            }
        }

        // Create main document PDF (excluding log-only pages)
        if (pagesToInclude.length > 0) {
            console.log(`[PDF Splitter] Creating PDF for ${doc.filename} (pages ${doc.startPage}-${doc.endPage}, excluding ${logPagesInDoc.length} log-only pages)`);

            const subDoc = await PDFDocument.create();
            const pageIndices = pagesToInclude.map(p => p - 1); // pdf-lib uses 0-based indices

        const copiedPages = await subDoc.copyPages(sourcePdfDoc, pageIndices);
        copiedPages.forEach((page) => subDoc.addPage(page));

            const pdfBytes = await subDoc.save();
            
            // Determine folder path based on code (broadcast code and service code already detected in Step 1)
            const isTTNH = documentIsTTNH.get(doc.id) || false;
            // If TTNH, override folder path
            let folderPath: string | null = null;
            if (isTTNH) {
              const broadcastCode = detectedBroadcastCode || 'MET';
              folderPath = `BAN TIN NGUON/${broadcastCode}`;
            } else {
              folderPath = doc.code ? getFolderPath(doc.code) : null;
            }

            // Store file for saving to local filesystem
            if (folderPath) {
              filesToSave.push({
                path: folderPath,
                filename: doc.filename,
                bytes: pdfBytes
              });
              console.log(`[PDF Splitter] Prepared ${folderPath}/${doc.filename} for saving (${pdfBytes.length} bytes)`);
            } else {
              console.warn(`[PDF Splitter] Skipping ${doc.filename} - no valid folder path determined`);
            }
        }

        // Create LOG PDFs from log-only pages in this document (use direct PDF copy, faster)
        if (logPagesInDoc.length > 0) {
            let logCounter = 1;
            // Use detected broadcast code for LOG folder
            const logFolderPath = getLogFolderPath();
            
            if (!logFolderPath) {
              console.warn(`[PDF Splitter] No valid log folder path for document ${doc.filename}, skipping LOG files`);
              continue;
            }
            
            for (const pageNum of logPagesInDoc) {
                try {
                    // Create PDF directly from source PDF page (much faster than image conversion)
                    const logDoc = await PDFDocument.create();
                    const pageIndex = pageNum - 1;
                    const [copiedPage] = await logDoc.copyPages(sourcePdfDoc, [pageIndex]);
                    logDoc.addPage(copiedPage);
                    const logPdfBytes = await logDoc.save();
                    
                    // Remove .pdf extension from doc.filename if it exists, then add LOG prefix
                    const docNameWithoutExt = doc.filename.replace(/\.pdf$/i, '');
                    const filename = logCounter === 1 ? `LOG${docNameWithoutExt}.pdf` : `LOG_${logCounter}${docNameWithoutExt}.pdf`;
                    
                    // Store file info for File System Access API
                    filesToSave.push({
                      path: logFolderPath,
                      filename: filename,
                      bytes: logPdfBytes
                    });
                    console.log(`[PDF Splitter] Prepared ${logFolderPath}/${filename} (from page ${pageNum} of ${doc.filename}) for saving (${logPdfBytes.length} bytes)`);
                    logCounter++;
                } catch (error) {
                    console.warn(`[PDF Splitter] Error creating LOG PDF from page ${pageNum}:`, error);
                }
            }
        }
    }

    // Helper to track folder structure (for JSON generation)
    const folderStructureSet = new Set<string>();
    const ensureSubfolders = (parentPath: string, subfolders: string[]) => {
      subfolders.forEach(subfolder => {
        const fullPath = parentPath ? `${parentPath}/${subfolder}` : subfolder;
        folderStructureSet.add(fullPath);
      });
    };

    // Helper to add folder to structure
    const addFolderToStructure = (structure: any, path: string, rootFolder: any) => {
      const parts = path.split('/');
      let current = rootFolder;
      
      parts.forEach((part) => {
        let child = current.children?.find((c: any) => c.name === part);
        if (!child) {
          child = {
            name: part,
            type: "folder",
            children: []
          };
          if (!current.children) {
            current.children = [];
          }
          current.children.push(child);
        }
        current = child;
      });
      
      return current;
    };

    // 5. Generate folder structure JSON and create all required folders
    const generateFolderStructure = (): any => {
      const structure: any = {
        name: "DNR",
        type: "folder",
        children: [
          {
            name: "PHAT MSI & SAR THANG 11-2025",
            type: "folder",
            children: []
          }
        ]
      };

      const rootFolder = structure.children[0];
      
      // Collect all unique parent folder paths (without subfolders)
      const parentFolderPaths = new Set<string>();
      
      // Collect from documents
      for (const doc of documents) {
        const isTTNH = documentIsTTNH.get(doc.id) || false;
        let folderPath: string | null = null;
        if (isTTNH) {
          const broadcastCode = detectedBroadcastCode || 'MET';
          folderPath = `BAN TIN NGUON/${broadcastCode}`;
        } else {
          folderPath = doc.code ? getFolderPath(doc.code) : null;
        }
        if (folderPath) {
          // Remove the last part (subfolder) to get parent path
          const parts = folderPath.split('/');
          if (parts.length > 0) {
            parts.pop(); // Remove subfolder (MET, NAV, etc.)
            parentFolderPaths.add(parts.join('/'));
          }
        }
      }

      // Collect from LOG files
      const logPath = getLogFolderPath();
      if (logPath) {
        // Remove the last part (subfolder) to get parent path
        const parts = logPath.split('/');
        if (parts.length > 0) {
          parts.pop(); // Remove subfolder (MET, NAV, etc.)
          parentFolderPaths.add(parts.join('/'));
        }
      }

      // Build folder structure with all subfolders
      parentFolderPaths.forEach(parentPath => {
        const current = addFolderToStructure(structure, parentPath, rootFolder);

        // Determine which subfolders to add based on parent path
        const isLogFTP = parentPath.includes('LOG FTP');
        const subfolders = isLogFTP 
          ? ['MET', 'NAV', 'SAR', 'WX'] // LOG only has MET, NAV, SAR, WX
          : ['MET', 'NAV', 'SAR', 'WX', 'TUYEN']; // Others have all 5

        // Add subfolders to structure
        subfolders.forEach(subfolder => {
          const existing = current.children?.find((c: any) => c.name === subfolder);
          if (!existing) {
            if (!current.children) {
              current.children = [];
            }
            current.children.push({
              name: subfolder,
              type: "folder",
              children: []
            });
          }
        });

        // Track subfolders
        ensureSubfolders(parentPath, subfolders);
      });

      // Also create EGC folders even if no files (as requested)
      const egcFolders = [
        'DICH VU EGC/BAN TIN NGUON DA DUOC XU LY EGC',
        'DICH VU EGC/KTKS TAI CHO BAN TIN NGUON XU LY EGC'
      ];

      egcFolders.forEach(egcPath => {
        const current = addFolderToStructure(structure, egcPath, rootFolder);
        
        // Add all subfolders (MET, NAV, SAR, WX, TUYEN) for EGC
        ['MET', 'NAV', 'SAR', 'WX', 'TUYEN'].forEach(subfolder => {
          const existing = current.children?.find((c: any) => c.name === subfolder);
          if (!existing) {
            if (!current.children) {
              current.children = [];
            }
            current.children.push({
              name: subfolder,
              type: "folder",
              children: []
            });
          }
        });
        
        // Track subfolders
        ensureSubfolders(egcPath, ['MET', 'NAV', 'SAR', 'WX', 'TUYEN']);
      });

      // Create COVER folders even if no files (as requested)
      const coverFolders = [
        {
          path: 'COVER/COVER',
          subfolders: ['MET', 'NAV', 'SAR', 'TUYEN', 'WX'] // QT 01
        },
        {
          path: 'COVER/KTKSTC BM 01',
          subfolders: ['MET', 'NAV', 'SAR', 'WX'] // KTKS 01 (no TUYEN)
        }
      ];

      coverFolders.forEach(coverFolder => {
        const current = addFolderToStructure(structure, coverFolder.path, rootFolder);
        
        // Add subfolders
        coverFolder.subfolders.forEach(subfolder => {
          const existing = current.children?.find((c: any) => c.name === subfolder);
          if (!existing) {
            if (!current.children) {
              current.children = [];
            }
            current.children.push({
              name: subfolder,
              type: "folder",
              children: []
            });
          }
        });
        
        // Track subfolders
        ensureSubfolders(coverFolder.path, coverFolder.subfolders);
      });

      // Create BAN TIN NGUON (one of 6 main folders)
      const banTinNguonPath = 'BAN TIN NGUON';
      const banTinNguonCurrent = addFolderToStructure(structure, banTinNguonPath, rootFolder);
      
      // Add all subfolders (MET, NAV, SAR, WX, TUYEN) for BAN TIN NGUON
      ['MET', 'NAV', 'SAR', 'WX', 'TUYEN'].forEach(subfolder => {
        const existing = banTinNguonCurrent.children?.find((c: any) => c.name === subfolder);
        if (!existing) {
          if (!banTinNguonCurrent.children) {
            banTinNguonCurrent.children = [];
          }
          banTinNguonCurrent.children.push({
            name: subfolder,
            type: "folder",
            children: []
          });
        }
      });
      
      // Track subfolders
      ensureSubfolders(banTinNguonPath, ['MET', 'NAV', 'SAR', 'WX', 'TUYEN']);

      // Create LOG FTP (one of 6 main folders)
      const logFtpPath = 'LOG FTP';
      const logFtpCurrent = addFolderToStructure(structure, logFtpPath, rootFolder);
      
      // Add subfolders (MET, NAV, SAR, WX - no TUYEN for LOG)
      ['MET', 'NAV', 'SAR', 'WX'].forEach(subfolder => {
        const existing = logFtpCurrent.children?.find((c: any) => c.name === subfolder);
        if (!existing) {
          if (!logFtpCurrent.children) {
            logFtpCurrent.children = [];
          }
          logFtpCurrent.children.push({
            name: subfolder,
            type: "folder",
            children: []
          });
        }
      });
      
      // Track subfolders
      ensureSubfolders(logFtpPath, ['MET', 'NAV', 'SAR', 'WX']);

      return structure;
    };

    const folderStructure = generateFolderStructure();
    const structureJson = JSON.stringify(folderStructure, null, 2);
    console.log(`[PDF Splitter] Generated folder structure JSON`);

    // 6. Save files - use File System Access API if available, otherwise download as ZIP
    if (filesToSave.length > 0) {
      if (rootDirHandle) {
        // Use File System Access API to save directly to folder
        console.log(`[PDF Splitter] Saving ${filesToSave.length} files to local filesystem...`);
        await saveFilesToDirectory(rootDirHandle, filesToSave, structureJson);
      } else {
        // Fallback: Download as ZIP file
        console.log(`[PDF Splitter] Directory picker not available, downloading ${filesToSave.length} files as ZIP...`);
        const zipName = `split-pdf-${Date.now()}.zip`;
        await downloadFilesAsZip(filesToSave, structureJson, zipName);
        console.log(`[PDF Splitter] ZIP file downloaded: ${zipName}`);
      }
    } else {
      console.log(`[PDF Splitter] No files to save`);
    }

    return {
        type: 'SPLIT',
        originalFileName: file.name,
        documents: documents,
        zipBlob: null, // No longer using ZIP
        folderStructure: folderStructure,
        filesToSave: filesToSave, // Return files to save
        folderStructureJson: structureJson // Return JSON structure
    };

  } catch (error) {
    console.error("Split Error:", error);
    throw new Error("Lỗi khi tách file PDF: " + (error as Error).message);
  }
};
