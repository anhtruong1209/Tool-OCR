import * as pdfjsLib from 'pdfjs-dist';
// Import worker file as bundled asset (offline-safe, không phụ thuộc CDN)
// Vite sẽ trả về URL tĩnh tới worker và pdf.js sẽ tự tạo Web Worker từ URL này.
// Tham khảo: https://github.com/mozilla/pdf.js/tree/master/examples/webpack
// và cách import với Vite: ?url
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - kiểu import asset
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { SplitDocument, SplitResultData } from '../types';
import { convertPdfToImage } from './pdfUtils';
import { saveFilesToDirectory } from './fileSaver';
import {
  analyzePDFComplete
} from './geminiService';

// Sử dụng worker được bundle cùng ứng dụng thay vì tải từ CDN.
// Điều này giúp tool hoạt động khi không có internet.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc as string;

const sanitizeFilePart = (value: string, maxLength: number = 80): string => {
  if (!value) return '';
  let sanitized = value.replace(/[\\/:*?"<>|]/g, '_').replace(/[\s]+/g, ' ');
  sanitized = sanitized.replace(/^[\.\-_ ]+|[\.\-_ ]+$/g, '');
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
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

const textToUint8Array = (text: string): Uint8Array => {
  return new TextEncoder().encode(text);
};

export const splitPdfByKeywords = async (
  file: File,
  rootDirHandle: FileSystemDirectoryHandle,
  keyword: string = "Mã số"
): Promise<SplitResultData> => {
  try {
    interface FileToSave {
      path: string;
      filename: string;
      bytes: Uint8Array;
    }
    const filesToSave: FileToSave[] = [];

    const arrayBuffer = await file.arrayBuffer();
    const inputFileBaseName = sanitizeFilePart(file.name.replace(/\.[^/.]+$/, '')) || 'Document';

    const pdfJsBuffer = arrayBuffer.slice(0);
    const loadingTask = pdfjsLib.getDocument({ data: pdfJsBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const defaultKeywords = ["Mã số", "Số", "Mã bản tin nguồn"];
    const keywords = Array.from(new Set([keyword, ...defaultKeywords].map(k => k?.trim()).filter(Boolean)));

    const base64Images = await convertPdfToImage(file, -1);

    const tempFolderBase = `TEMP_EXTRACT/${inputFileBaseName}`;
    const tempDocsPath = `${tempFolderBase}/PDFS`;
    const tempLogsPath = `${tempFolderBase}/LOGS`;

    // OPTIMIZED: Single API call for all detection
    console.log(`[PDF Splitter] Analyzing ${base64Images.length} pages with single API call...`);
    const analysis = await analyzePDFComplete(base64Images);

    const detectedBroadcastCode = analysis.broadcastCode;
    let detectedServiceCode = analysis.serviceCode;

    // Extract data from analysis
    // Ưu tiên formCode (từ khung Mã số) nếu có, fallback về code cũ
    const pageCodes = analysis.pages.map(p => ({ 
      page: p.page, 
      code: p.formCode || p.code || null 
    }));
    
    // Các trang có tên người (chữ ký, soát tin...) là điểm cắt tài liệu
    const signaturePages = analysis.pages
      .filter(p => p.hasPersonName)
      .map(p => p.page)
      .sort((a, b) => a - b);
    
    // Các trang bắt đầu biểu mẫu mới (QUAN TRỌNG: cắt ngay khi thấy)
    const newFormStartPages = analysis.pages
      .filter(p => p.isNewFormStart === true)
      .map(p => p.page)
      .sort((a, b) => a - b);
    const logPages = analysis.pages
      .filter(p => p.isLogPage)
      .map(p => p.page);
    const banTinNguonHeaderPages = new Set(
      analysis.pages
        .filter(p => p.isBanTinNguonHeader)
        .map(p => p.page)
    );
    const emailLogPages = new Set(
      analysis.pages
        .filter(p => p.isLogPage && p.hasEmail)
        .map(p => p.page)
    );
    const pageServiceHints = analysis.pages
      .map(p => p.serviceHint)
      .filter((hint): hint is 'NTX' | 'RTP' | 'EGC' => !!hint);
    if (pageServiceHints.length > 0) {
      const counts = pageServiceHints.reduce<Record<string, number>>((acc, hint) => {
        acc[hint] = (acc[hint] || 0) + 1;
        return acc;
      }, {});
      const sortedHints = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (sortedHints.length > 0) {
        const majorityHint = sortedHints[0][0] as 'NTX' | 'RTP' | 'EGC';
        if (detectedServiceCode !== majorityHint) {
          console.log(`[PDF Splitter] Service code set to ${majorityHint} (was ${detectedServiceCode || 'null'}) using page hints`);
        }
        detectedServiceCode = majorityHint;
      }
    }

    if (!detectedServiceCode) {
      throw new Error('Không xác định được Mã dịch vụ (NTX/RTP/EGC) từ tài liệu. Vui lòng kiểm tra lại.');
    }

    console.log(`[PDF Splitter] Analysis complete:`);
    console.log(`  - Broadcast: ${detectedBroadcastCode}, Service: ${detectedServiceCode}`);
    console.log(`  - LOG pages: ${logPages.join(', ') || 'NONE'}`);

    // LOGIC CẮT ĐƠN GIẢN: Chỉ cắt khi có MÃ SỐ (formCode) + CHỮ KÝ (hasPersonName) ở cùng trang
    const documents: SplitDocument[] = [];
    const documentMetadata: Array<{
      id: string;
      filename: string;
      code: string | null;
      startPage: number;
      endPage: number;
      pageCount: number;
      recommendedPath: string | null;
    }> = [];
    const logMetadata: Array<{
      filename: string;
      page: number;
      sourceDocumentId: string;
      recommendedPath: string | null;
    }> = [];

    // Helper: Find first code in page range
    const findCodeInRange = (startPage: number, endPage: number): string | null => {
      const codesInRange = pageCodes.filter(
        pc => pc.page >= startPage && pc.page <= endPage && pc.code
      );
      return codesInRange.length > 0 ? codesInRange[0].code : null;
    };

    // LOGIC CẮT MỚI:
    // 1. BAN TIN NGUON: Bắt đầu = isBanTinNguonHeader, Kết thúc = hasPersonName (có thể nhiều trang)
    // 2. Biểu mẫu QT/KTKS: Bắt đầu = formCode ở trang đầu, Kết thúc = hasPersonName ở trang cuối (có thể nhiều trang)
    // 3. LOG: Tách riêng vào PDFS
    
    let currentDocStartPage: number | null = null;
    let currentDocType: 'BAN_TIN_NGUON' | 'BIEU_MAU' | null = null;
    let currentDocFormCode: string | null = null;
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageInfo = analysis.pages.find(p => p.page === pageNum);
      if (!pageInfo) continue;
      
      // Bỏ qua trang LOG - sẽ xử lý riêng sau
      if (pageInfo.isLogPage) {
        // Nếu đang có document đang xây dựng → lưu document đó trước
        if (currentDocStartPage !== null && currentDocType !== null) {
          // Tìm chữ ký ở trang trước đó
          let lastSignaturePage = pageNum - 1;
          while (lastSignaturePage >= currentDocStartPage) {
            const prevPageInfo = analysis.pages.find(p => p.page === lastSignaturePage);
            if (prevPageInfo && prevPageInfo.hasPersonName) {
              // Lưu document
              // QUAN TRỌNG: BAN TIN NGUON không bao giờ có code, chỉ dùng tên file gốc
              const docCode = currentDocType === 'BAN_TIN_NGUON' 
                ? 'BAN_TIN_NGUON' // Không tìm code trong range cho BAN TIN NGUON
                : currentDocFormCode || findCodeInRange(currentDocStartPage, lastSignaturePage);
              
              if (docCode) {
                let sanitizedCode = docCode.trim();
                if (sanitizedCode.length > 80) sanitizedCode = sanitizedCode.substring(0, 80);
                sanitizedCode = sanitizeFilePart(sanitizedCode);
                const docName = currentDocType === 'BAN_TIN_NGUON'
                  ? inputFileBaseName
                  : `${inputFileBaseName} - ${sanitizedCode}`;

                documents.push({
                  id: Math.random().toString(36).substr(2, 9),
                  filename: `${docName}.pdf`,
                  code: currentDocType === 'BAN_TIN_NGUON' ? undefined : docCode,
                  startPage: currentDocStartPage,
                  endPage: lastSignaturePage,
                  pageCount: lastSignaturePage - currentDocStartPage + 1
                });
              }
              break;
            }
            lastSignaturePage--;
          }
        }
        currentDocStartPage = null;
        currentDocType = null;
        currentDocFormCode = null;
        continue; // Bỏ qua trang LOG
      }
      
      // QUAN TRỌNG: BAN TIN NGUON không bao giờ có formCode
      // Bắt đầu BAN TIN NGUON: có header "CỘNG HÒA..." VÀ không có formCode VÀ chưa có document nào đang xây dựng
      // VÀ trang trước đó không có formCode (để tránh nhầm với biểu mẫu)
      if (pageInfo.isBanTinNguonHeader && !pageInfo.formCode && currentDocStartPage === null) {
        // Kiểm tra trang trước đó: nếu có formCode thì không phải BAN TIN NGUON
        const prevPageInfo = analysis.pages.find(p => p.page === pageNum - 1);
        if (!prevPageInfo || !prevPageInfo.formCode) {
          // Bắt đầu BAN TIN NGUON mới
          currentDocStartPage = pageNum;
          currentDocType = 'BAN_TIN_NGUON';
          currentDocFormCode = null;
        }
      }
      // Bắt đầu Biểu mẫu: có formCode (mã số ở khung góc)
      // QUAN TRỌNG: Nếu có formCode thì KHÔNG PHẢI là BAN TIN NGUON
      else if (pageInfo.formCode) {
        // Nếu đang có document đang xây dựng → lưu document đó trước
        if (currentDocStartPage !== null && currentDocType !== null) {
          // Tìm chữ ký ở trang trước đó
          let lastSignaturePage = pageNum - 1;
          while (lastSignaturePage >= currentDocStartPage) {
            const prevPageInfo = analysis.pages.find(p => p.page === lastSignaturePage);
            if (prevPageInfo && !prevPageInfo.isLogPage && prevPageInfo.hasPersonName) {
              // Lưu document
              // QUAN TRỌNG: BAN TIN NGUON không bao giờ có code, chỉ dùng tên file gốc
              const docCode = currentDocType === 'BAN_TIN_NGUON' 
                ? 'BAN_TIN_NGUON' // Không tìm code trong range cho BAN TIN NGUON
                : currentDocFormCode || findCodeInRange(currentDocStartPage, lastSignaturePage);
              
              if (docCode) {
                let sanitizedCode = docCode.trim();
                if (sanitizedCode.length > 80) sanitizedCode = sanitizedCode.substring(0, 80);
                sanitizedCode = sanitizeFilePart(sanitizedCode);
                const docName = currentDocType === 'BAN_TIN_NGUON'
                  ? inputFileBaseName
                  : `${inputFileBaseName} - ${sanitizedCode}`;

                documents.push({
                  id: Math.random().toString(36).substr(2, 9),
                  filename: `${docName}.pdf`,
                  code: currentDocType === 'BAN_TIN_NGUON' ? undefined : docCode,
                  startPage: currentDocStartPage,
                  endPage: lastSignaturePage,
                  pageCount: lastSignaturePage - currentDocStartPage + 1
                });
              }
              break;
            }
            lastSignaturePage--;
          }
        }
        // Bắt đầu biểu mẫu mới
        currentDocStartPage = pageNum;
        currentDocType = 'BIEU_MAU';
        currentDocFormCode = pageInfo.formCode;
      }
      // Kết thúc document: có tên người ở cuối trang VÀ trang tiếp theo có formCode mới
      // QUAN TRỌNG: Chỉ kết thúc khi tên người ở cuối trang (hasPersonName = true) VÀ trang tiếp theo có formCode mới
      // Nếu trang tiếp theo không có formCode mới → tiếp tục document (có thể có nhiều trang)
      else if (pageInfo.hasPersonName && currentDocStartPage !== null && currentDocType !== null) {
        // Kiểm tra trang tiếp theo: CHỈ kết thúc nếu có formCode mới (khác với formCode hiện tại)
        const nextPageNum = pageNum + 1;
        const nextPageInfo = analysis.pages.find(p => p.page === nextPageNum);
        
        // QUAN TRỌNG: Chỉ kết thúc document nếu:
        // 1. Trang tiếp theo có formCode mới (khác với formCode hiện tại) VÀ không phải LOG
        //    VÀ trang tiếp theo có isNewFormStart = true (đảm bảo đây là biểu mẫu mới, không phải trang tiếp theo)
        // 2. Hoặc đây là trang cuối cùng
        // 3. Hoặc trang tiếp theo có isBanTinNguonHeader (bắt đầu BAN TIN NGUON mới) VÀ document hiện tại không phải BAN TIN NGUON
        // KHÔNG kết thúc nếu trang tiếp theo không có formCode (có thể là trang tiếp theo của document hiện tại)
        const shouldEndDocument = 
          (nextPageInfo && nextPageInfo.formCode && nextPageInfo.formCode !== currentDocFormCode && !nextPageInfo.isLogPage && nextPageInfo.isNewFormStart) ||
          (pageNum === numPages) ||
          (nextPageInfo && nextPageInfo.isBanTinNguonHeader && !nextPageInfo.formCode && currentDocType !== 'BAN_TIN_NGUON');
        
        if (shouldEndDocument) {
          // Lưu document hiện tại
          const docCode = currentDocType === 'BAN_TIN_NGUON'
            ? 'BAN_TIN_NGUON' // BAN TIN NGUON không có code, chỉ dùng tên file gốc
            : currentDocFormCode || findCodeInRange(currentDocStartPage, pageNum);
          
          if (docCode) {
            let sanitizedCode = docCode.trim();
            if (sanitizedCode.length > 80) sanitizedCode = sanitizedCode.substring(0, 80);
            sanitizedCode = sanitizeFilePart(sanitizedCode);
            const docName = currentDocType === 'BAN_TIN_NGUON'
              ? inputFileBaseName
              : `${inputFileBaseName} - ${sanitizedCode}`;

            documents.push({
              id: Math.random().toString(36).substr(2, 9),
              filename: `${docName}.pdf`,
              code: currentDocType === 'BAN_TIN_NGUON' ? undefined : docCode,
              startPage: currentDocStartPage,
              endPage: pageNum,
              pageCount: pageNum - currentDocStartPage + 1
            });
          }
          
          // Reset để bắt đầu document mới
          currentDocStartPage = null;
          currentDocType = null;
          currentDocFormCode = null;
        }
        // Nếu không, tiếp tục document hiện tại (không làm gì, chỉ tiếp tục vòng lặp)
        // Điều này cho phép document có nhiều trang
      }
      // Nếu trang không có hasPersonName và không có formCode, nhưng đang trong document → tiếp tục document
      else if (!pageInfo.formCode && !pageInfo.isBanTinNguonHeader && currentDocStartPage !== null && currentDocType !== null) {
        // Tiếp tục document hiện tại (không làm gì, chỉ tiếp tục vòng lặp)
        // Điều này cho phép document có nhiều trang
      }
    }

    // Handle remaining pages (nếu còn document chưa kết thúc)
    if (currentDocStartPage !== null && currentDocType !== null) {
      // Tìm chữ ký ở trang cuối
      let lastSignaturePage = numPages;
      while (lastSignaturePage >= currentDocStartPage) {
        const pageInfo = analysis.pages.find(p => p.page === lastSignaturePage);
        if (pageInfo && !pageInfo.isLogPage && pageInfo.hasPersonName) {
          // QUAN TRỌNG: BAN TIN NGUON không bao giờ có code, chỉ dùng tên file gốc
          const docCode = currentDocType === 'BAN_TIN_NGUON'
            ? 'BAN_TIN_NGUON' // Không tìm code trong range cho BAN TIN NGUON
            : currentDocFormCode || findCodeInRange(currentDocStartPage, lastSignaturePage);
          
          if (docCode) {
            let sanitizedCode = docCode.trim();
            if (sanitizedCode.length > 80) sanitizedCode = sanitizedCode.substring(0, 80);
            sanitizedCode = sanitizeFilePart(sanitizedCode);
            const docName = currentDocType === 'BAN_TIN_NGUON'
              ? inputFileBaseName
              : `${inputFileBaseName} - ${sanitizedCode}`;

            documents.push({
              id: Math.random().toString(36).substr(2, 9),
              filename: `${docName}.pdf`,
              code: currentDocType === 'BAN_TIN_NGUON' ? undefined : docCode,
              startPage: currentDocStartPage,
              endPage: lastSignaturePage,
              pageCount: lastSignaturePage - currentDocStartPage + 1
            });
          }
          break;
        }
        lastSignaturePage--;
      }
    }

    // If no documents created (no codes found), try to create at least one if there's any code
    if (documents.length === 0) {
      const docCode = pageCodes.find(pc => pc.code)?.code || null;
      if (docCode) {
        let sanitizedCode = docCode.trim();
        if (sanitizedCode.length > 80) sanitizedCode = sanitizedCode.substring(0, 80);
        sanitizedCode = sanitizeFilePart(sanitizedCode);
        const docName = `${inputFileBaseName} - ${sanitizedCode}`;

        documents.push({
          id: Math.random().toString(36).substr(2, 9),
          filename: `${docName}.pdf`,
          code: docCode,
          startPage: 1,
          endPage: numPages,
          pageCount: numPages
        });
      }
    }

    console.log(`[PDF Splitter] Created ${documents.length} documents (initial ranges before log trimming):`);
    documents.forEach((doc, idx) => {
      console.log(`  Doc ${idx + 1}: pages ${doc.startPage}-${doc.endPage}, code: "${doc.code || 'NONE'}", filename: "${doc.filename}"`);
    });

    const sourcePdfDoc = await PDFDocument.load(arrayBuffer);

    const getFolderPath = (code: string | undefined): string | null => {
      if (!code) return null;

      const codeUpper = code.toUpperCase();
      const broadcastCode = detectedBroadcastCode || 'MET';

      // Check if this is QT or KTKS document
      const hasQT = codeUpper.includes('QT');
      const hasKTKS = codeUpper.includes('KTKS');

      // QT.01 → COVER
      if (hasQT && (codeUpper.includes('.01') || codeUpper.includes('01'))) {
        return `COVER/COVER/${broadcastCode}`;
      }

      // KTKS.01 → COVER/KTKSTC BM 01
      if (hasKTKS && (codeUpper.includes('.01') || codeUpper.includes('01'))) {
        const validCodes = ['MET', 'NAV', 'SAR', 'WX'];
        const bc = (detectedBroadcastCode && validCodes.includes(detectedBroadcastCode)) ? detectedBroadcastCode : 'MET';
        return `COVER/KTKSTC BM 01/${bc}`;
      }

      // If NOT QT and NOT KTKS → BAN TIN NGUON (simplified rule)
      if (!hasQT && !hasKTKS) {
        return `BAN TIN NGUON/${broadcastCode}`;
      }

      // QT/KTKS with service code routing
      let basePath = '';
      let serviceFolder = '';

      if (detectedServiceCode === 'EGC') {
        serviceFolder = 'DICH VU EGC';
        if (hasQT && (codeUpper.includes('.02') || codeUpper.includes('02'))) {
          basePath = 'BAN TIN NGUON DA DUOC XU LY EGC';
        } else if (hasKTKS && (codeUpper.includes('.02') || codeUpper.includes('02'))) {
          basePath = 'KTKS TAI CHO BAN TIN NGUON XU LY EGC';
        } else {
          // Unknown EGC type → fallback to BAN TIN NGUON
          return `BAN TIN NGUON/${broadcastCode}`;
        }
      } else if (detectedServiceCode === 'NTX' || detectedServiceCode === 'RTP') {
        serviceFolder = detectedServiceCode === 'NTX' ? 'DICH VU NTX' : 'DICH VU RTP';

        if (codeUpper.includes('.02') || codeUpper.includes('02')) {
          if (hasQT) {
            basePath = 'BAN TIN NGUON DA DUOC XU LY/BAN TIN NGUON DA DUOC XU LY';
          } else if (hasKTKS) {
            basePath = 'BAN TIN NGUON DA DUOC XU LY/KTKSTC BAN TIN NGUON DA DUOC XU LY';
          } else {
            return `BAN TIN NGUON/${broadcastCode}`;
          }
        } else if (codeUpper.includes('.03') || codeUpper.includes('03')) {
          if (hasQT) {
            basePath = 'BAN TIN XU LY PHAT/BAN TIN XU LY TRUOC KHI PHAT';
          } else if (hasKTKS) {
            basePath = 'BAN TIN XU LY PHAT/KTKSTC BAN TIN XU LY TRUOC KHI PHAT';
          } else {
            basePath = 'BAN TIN XU LY PHAT/BAN TIN XU LY TRUOC KHI PHAT';
          }
        } else if (codeUpper.includes('.04') || codeUpper.includes('04')) {
          basePath = 'KIEM TRA KIEM SOAT SAU PHAT';
        } else {
          // Unknown type → fallback to BAN TIN NGUON
          return `BAN TIN NGUON/${broadcastCode}`;
        }
      } else {
        // No service code → fallback to BAN TIN NGUON
        return `BAN TIN NGUON/${broadcastCode}`;
      }

      basePath = `${basePath}/${broadcastCode}`;
      return `${serviceFolder}/${basePath}`;
    };

    const getLogFolderPath = (): string | null => {
      // LOG luôn cần nơi lưu; mặc định MET nếu không xác định được broadcastCode.
      const validLogCodes = ['MET', 'NAV', 'SAR', 'WX'];
      const subFolderCode =
        detectedBroadcastCode && validLogCodes.includes(detectedBroadcastCode)
          ? detectedBroadcastCode
          : 'MET';

      return `LOG FTP/${subFolderCode}`;
    };

    // Xác định BẢN TIN NGUỒN theo nội dung thực tế:
    // - Ưu tiên text header "Cộng hòa xã hội chủ nghĩa Việt Nam" (isBanTinNguonHeader từ AI)
    // - Không khoá cứng theo mã TTNH/ĐBQG vì có thể có nhiều ký hiệu khác
    const documentIsBanTinNguon = new Map<string, boolean>();

    for (const doc of documents) {
      const folderPath = getFolderPath(doc.code);
      console.log(`[PDF Splitter] Doc "${doc.filename}" → Folder (by code): "${folderPath || 'NULL'}"`);

      let isBanTinNguon = false;

      // 1) Nếu bất kỳ trang nào trong document được AI đánh dấu isBanTinNguonHeader → coi là BẢN TIN NGUỒN
      for (let p = doc.startPage; p <= doc.endPage; p++) {
        if (banTinNguonHeaderPages.has(p)) {
          isBanTinNguon = true;
          break;
        }
      }

      // 2) Bổ sung nhẹ: nếu không có header nhưng code là TTNH/ĐBQG/04H00 và không chứa QT/KTKS
      //    thì vẫn coi là BẢN TIN NGUỒN (trường hợp form bị scan thiếu phần header)
      if (!isBanTinNguon && doc.code) {
        const codeUpper = doc.code.toUpperCase();
        const hasQTorKTKS = codeUpper.includes('QT') || codeUpper.includes('KTKS');
        if (!hasQTorKTKS && (codeUpper.includes('TTNH') || codeUpper.includes('ĐBQG') || codeUpper.includes('DBQG') || codeUpper.includes('04H00'))) {
          isBanTinNguon = true;
        }
      }

      documentIsBanTinNguon.set(doc.id, isBanTinNguon);
      console.log(`[PDF Splitter] Doc "${doc.filename}" → Is BAN TIN NGUON (by content): ${isBanTinNguon}`);
    }

    // Gán trang LOG cho từng BẢN TIN NGUỒN dựa trên vị trí:
    // - LOG = các trang ngay sau BẢN TIN NGUỒN, trước (và bao gồm) trang mở đầu của tài liệu kế tiếp.
    // - Ví dụ: BTN ở trang 3, tài liệu tiếp theo bắt đầu trang 4, nếu trang 4 là LOG → log của BTN.
    const logPagesByDocId = new Map<string, number[]>();
    const assignedLogPages = new Set<number>();

    for (let docIndex = 0; docIndex < documents.length; docIndex++) {
      const doc = documents[docIndex];
      const isBanTinNguon = documentIsBanTinNguon.get(doc.id) || false;
      if (!isBanTinNguon) continue;

      const nextDocStart =
        docIndex < documents.length - 1 ? documents[docIndex + 1].startPage : numPages + 1;

      for (let p = doc.endPage + 1; p < nextDocStart && p <= numPages; p++) {
        if (logPages.includes(p) || emailLogPages.has(p)) {
          assignedLogPages.add(p);
          const arr = logPagesByDocId.get(doc.id) || [];
          arr.push(p);
          logPagesByDocId.set(doc.id, arr);
        }
      }
    }

    for (let docIndex = 0; docIndex < documents.length; docIndex++) {
      const doc = documents[docIndex];
      if (doc.startPage > doc.endPage || doc.startPage < 1 || doc.endPage > numPages) {
        continue;
      }

      const pagesToInclude: number[] = [];
      const logPagesInDoc: number[] = logPagesByDocId.get(doc.id) || [];

      // Trang nội dung chính của tài liệu (bỏ qua những trang đã gán là LOG cho BẢN TIN NGUỒN)
      for (let j = doc.startPage; j <= doc.endPage; j++) {
        if (assignedLogPages.has(j)) continue;
        pagesToInclude.push(j);
      }

      if (pagesToInclude.length > 0) {
        const subDoc = await PDFDocument.create();
        const pageIndices = pagesToInclude.map(p => p - 1);

        const copiedPages = await subDoc.copyPages(sourcePdfDoc, pageIndices);
        copiedPages.forEach((page) => subDoc.addPage(page));

        const pdfBytes = await subDoc.save();

        const isBanTinNguon = documentIsBanTinNguon.get(doc.id) || false;
        let folderPath: string | null = null;
        let outputFileName = doc.filename;

        if (isBanTinNguon) {
          const broadcastCode = detectedBroadcastCode || 'MET';
          folderPath = `BAN TIN NGUON/${broadcastCode}`;
          // Riêng BẢN TIN NGUỒN: đặt tên file theo tên file gốc, không thêm mã code phía sau
          outputFileName = `${inputFileBaseName}.pdf`;
        } else {
          folderPath = doc.code ? getFolderPath(doc.code) : null;
        }

        documentMetadata.push({
          id: doc.id,
          filename: outputFileName,
          code: doc.code || null,
          startPage: doc.startPage,
          endPage: doc.endPage,
          pageCount: doc.pageCount,
          recommendedPath: folderPath
        });

        filesToSave.push({
          path: tempDocsPath,
          filename: outputFileName,
          bytes: pdfBytes
        });
      }

      // LOG: Tách riêng vào PDFS (không gắn với document)
      // Xử lý sau khi đã tạo tất cả documents
    }

    // Xử lý LOG riêng: Tách tất cả trang LOG vào PDFS
    const allLogPages = analysis.pages
      .filter(p => p.isLogPage)
      .map(p => p.page)
      .sort((a, b) => a - b);
    
    for (const pageNum of allLogPages) {
      try {
        const logDoc = await PDFDocument.create();
        const pageIndex = pageNum - 1;
        const [copiedPage] = await logDoc.copyPages(sourcePdfDoc, [pageIndex]);
        logDoc.addPage(copiedPage);
        const logPdfBytes = await logDoc.save();

        const logBaseName = sanitizeFilePart(`${inputFileBaseName}`);
        const isEmailLog = emailLogPages.has(pageNum);
        const suffix = isEmailLog ? '_LOGMAIL' : '_LOG';
        const filename = `${logBaseName}${suffix}.pdf`;

        logMetadata.push({
          filename: filename,
          page: pageNum,
          sourceDocumentId: '',
          recommendedPath: tempDocsPath // Lưu vào PDFS
        });

        filesToSave.push({
          path: tempDocsPath, // Lưu vào PDFS
          filename: filename,
          bytes: logPdfBytes
        });
      } catch (error) {
        console.error(`[PDF Splitter] Error creating LOG PDF for page ${pageNum}:`, error);
      }
    }

    const extractionSummary = {
      originalFileName: file.name,
      broadcastCode: detectedBroadcastCode,
      serviceCode: detectedServiceCode,
      generatedAt: new Date().toISOString(),
      documents: documentMetadata,
      logs: logMetadata,
      analysis: analysis
    };

    // In JSON để debug
    console.log('[PDF Splitter] Extraction Summary JSON:');
    console.log(JSON.stringify(extractionSummary, null, 2));

    filesToSave.push({
      path: tempFolderBase,
      filename: 'extraction-summary.json',
      bytes: textToUint8Array(JSON.stringify(extractionSummary, null, 2))
    });

    const folderStructure = null;
    const structureJson = null;

    if (filesToSave.length > 0) {
      if (!rootDirHandle) {
        throw new Error('Chưa có quyền truy cập thư mục đích. Vui lòng chọn thư mục lưu trữ trước khi tách file.');
      }
      await saveFilesToDirectory(rootDirHandle, filesToSave, structureJson);
    }

    return {
      type: 'SPLIT',
      originalFileName: file.name,
      documents: documents,
      zipBlob: null,
      folderStructure: folderStructure,
      filesToSave: filesToSave,
      folderStructureJson: structureJson,
      extractionFolderPath: tempFolderBase,
      extractionSummary
    };

  } catch (error) {
    console.error("Split Error:", error);
    throw new Error("Lỗi khi tách file PDF: " + (error as Error).message);
  }
};
