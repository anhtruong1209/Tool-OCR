import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { SplitDocument, SplitResultData } from '../types';
import { convertPdfToImage } from './pdfUtils';
import { saveFilesToDirectory } from './fileSaver';
import {
  detectBroadcastAndServiceCode,
  extractDocumentCodes,
  detectLogPage,
  detectSignatureOnPage
} from './geminiService';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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

    // Detect broadcast/service codes using geminiService
    const { broadcastCode, serviceCode } = await detectBroadcastAndServiceCode(base64Images);
    const detectedBroadcastCode = broadcastCode;
    const detectedServiceCode = serviceCode;

    // Extract document codes using geminiService (for metadata: broadcast code, service code, filename)
    const pageCodes = await extractDocumentCodes(base64Images, keywords);

    // Detect signatures on all pages to determine document boundaries
    const signatureResults = await Promise.all(
      base64Images.map(async (img, idx) => ({
        page: idx + 1,
        hasSignature: await detectSignatureOnPage(img)
      }))
    );

    const signaturePages = signatureResults
      .filter(r => r.hasSignature)
      .map(r => r.page);

    // Split documents based on signature pages
    const documents: SplitDocument[] = [];
    let currentDocStartPage = 1;

    // Helper: Find first code in page range
    const findCodeInRange = (startPage: number, endPage: number): string | null => {
      const codesInRange = pageCodes.filter(
        pc => pc.page >= startPage && pc.page <= endPage && pc.code
      );
      return codesInRange.length > 0 ? codesInRange[0].code : null;
    };

    // Create documents based on signature pages
    for (const signaturePage of signaturePages) {
      // Find code in this document range
      const docCode = findCodeInRange(currentDocStartPage, signaturePage);

      // Generate filename
      let docName: string;
      if (docCode) {
        let sanitizedCode = docCode.trim();
        if (sanitizedCode.length > 80) sanitizedCode = sanitizedCode.substring(0, 80);
        sanitizedCode = sanitizeFilePart(sanitizedCode);
        docName = `${inputFileBaseName} - ${sanitizedCode}`;
      } else {
        docName = `${inputFileBaseName} - Document_${documents.length + 1}`;
      }

      documents.push({
        id: Math.random().toString(36).substr(2, 9),
        filename: `${docName}.pdf`,
        code: docCode || undefined,
        startPage: currentDocStartPage,
        endPage: signaturePage,
        pageCount: signaturePage - currentDocStartPage + 1
      });

      // Next document starts after signature page
      currentDocStartPage = signaturePage + 1;
    }

    // Handle remaining pages after last signature (if any)
    if (currentDocStartPage <= numPages) {
      const docCode = findCodeInRange(currentDocStartPage, numPages);

      let docName: string;
      if (docCode) {
        let sanitizedCode = docCode.trim();
        if (sanitizedCode.length > 80) sanitizedCode = sanitizedCode.substring(0, 80);
        sanitizedCode = sanitizeFilePart(sanitizedCode);
        docName = `${inputFileBaseName} - ${sanitizedCode}`;
      } else {
        docName = `${inputFileBaseName} - Document_${documents.length + 1}`;
      }

      documents.push({
        id: Math.random().toString(36).substr(2, 9),
        filename: `${docName}.pdf`,
        code: docCode || undefined,
        startPage: currentDocStartPage,
        endPage: numPages,
        pageCount: numPages - currentDocStartPage + 1
      });
    }

    // If no signatures found, create single document with all pages
    if (documents.length === 0) {
      const docCode = pageCodes.find(pc => pc.code)?.code || null;

      let docName: string;
      if (docCode) {
        let sanitizedCode = docCode.trim();
        if (sanitizedCode.length > 80) sanitizedCode = sanitizedCode.substring(0, 80);
        sanitizedCode = sanitizeFilePart(sanitizedCode);
        docName = `${inputFileBaseName} - ${sanitizedCode}`;
      } else {
        docName = `${inputFileBaseName} - Document_1`;
      }

      documents.push({
        id: Math.random().toString(36).substr(2, 9),
        filename: `${docName}.pdf`,
        code: docCode || undefined,
        startPage: 1,
        endPage: numPages,
        pageCount: numPages
      });
    }

    const sourcePdfDoc = await PDFDocument.load(arrayBuffer);

    const getFolderPath = (code: string | undefined): string | null => {
      if (!code) return null;

      const codeUpper = code.toUpperCase();

      if (codeUpper.includes('QT') && (codeUpper.includes('.01') || codeUpper.includes('01'))) {
        const broadcastCode = detectedBroadcastCode || 'MET';
        return `COVER/COVER/${broadcastCode}`;
      }

      if (codeUpper.includes('KTKS') && (codeUpper.includes('.01') || codeUpper.includes('01'))) {
        const validCodes = ['MET', 'NAV', 'SAR', 'WX'];
        const broadcastCode = (detectedBroadcastCode && validCodes.includes(detectedBroadcastCode)) ? detectedBroadcastCode : 'MET';
        return `COVER/KTKSTC BM 01/${broadcastCode}`;
      }

      const isTTNH = codeUpper.includes('TTNH') || codeUpper.includes('DBQG') || codeUpper.includes('04H00');
      if (isTTNH) {
        const broadcastCode = detectedBroadcastCode || 'MET';
        return `BAN TIN NGUON/${broadcastCode}`;
      }

      let basePath = '';
      let serviceFolder = '';

      if (detectedServiceCode === 'EGC') {
        serviceFolder = 'DICH VU EGC';
        if (codeUpper.includes('QT') && (codeUpper.includes('.02') || codeUpper.includes('02'))) {
          basePath = 'BAN TIN NGUON DA DUOC XU LY EGC';
        } else if (codeUpper.includes('KTKS') && (codeUpper.includes('.02') || codeUpper.includes('02'))) {
          basePath = 'KTKS TAI CHO BAN TIN NGUON XU LY EGC';
        } else {
          return null;
        }
      } else if (detectedServiceCode === 'NTX' || detectedServiceCode === 'RTP') {
        serviceFolder = detectedServiceCode === 'NTX' ? 'DICH VU NTX' : 'DICH VU RTP';

        if (codeUpper.includes('.02') || codeUpper.includes('02')) {
          if (codeUpper.includes('QT') && (codeUpper.includes('.02') || codeUpper.includes('02'))) {
            basePath = 'BAN TIN NGUON DA DUOC XU LY/BAN TIN NGUON DA DUOC XU LY';
          } else if (codeUpper.includes('KTKS') && (codeUpper.includes('.02') || codeUpper.includes('02'))) {
            basePath = 'BAN TIN NGUON DA DUOC XU LY/KTKSTC BAN TIN NGUON DA DUOC XU LY';
          } else {
            return null;
          }
        } else if (codeUpper.includes('.03') || codeUpper.includes('03')) {
          if (codeUpper.includes('QT') && (codeUpper.includes('.03') || codeUpper.includes('03'))) {
            basePath = 'BAN TIN XU LY PHAT/BAN TIN XU LY TRUOC KHI PHAT';
          } else if (codeUpper.includes('KTKS') && (codeUpper.includes('.03') || codeUpper.includes('03'))) {
            basePath = 'BAN TIN XU LY PHAT/KTKSTC BAN TIN XU LY TRUOC KHI PHAT';
          } else {
            basePath = 'BAN TIN XU LY PHAT/BAN TIN XU LY TRUOC KHI PHAT';
          }
        } else if (codeUpper.includes('.04') || codeUpper.includes('04')) {
          basePath = 'KIEM TRA KIEM SOAT SAU PHAT';
        } else {
          return null;
        }
      } else {
        return null;
      }

      const broadcastCode = detectedBroadcastCode || 'MET';
      basePath = `${basePath}/${broadcastCode}`;

      return `${serviceFolder}/${basePath}`;
    };

    const getLogFolderPath = (): string | null => {
      if (!detectedBroadcastCode) return null;

      const validLogCodes = ['MET', 'NAV', 'SAR', 'WX'];
      const subFolderCode = validLogCodes.includes(detectedBroadcastCode) ? detectedBroadcastCode : 'MET';

      return `LOG FTP/${subFolderCode}`;
    };

    const mightHaveLog = (code: string | undefined): boolean => {
      if (!code) return true;
      const codeUpper = code.toUpperCase();
      if (codeUpper.includes('QT.MSI-BM') || codeUpper.includes('QTMSI-BM')) {
        return false;
      }
      return true;
    };

    const documentIsTTNH = new Map<string, boolean>();

    for (const doc of documents) {
      let hasTTNH = false;
      if (doc.code) {
        const codeUpper = doc.code.toUpperCase();
        if (codeUpper.includes('TTNH') || codeUpper.includes('DBQG') || codeUpper.includes('04H00')) {
          hasTTNH = true;
        }
      }
      documentIsTTNH.set(doc.id, hasTTNH);
    }

    for (const doc of documents) {
      if (doc.startPage > doc.endPage || doc.startPage < 1 || doc.endPage > numPages) {
        continue;
      }

      const shouldCheckLog = mightHaveLog(doc.code);
      const pagesToInclude: number[] = [];
      const logPagesInDoc: number[] = [];

      if (shouldCheckLog && doc.pageCount > 1) {
        const pagesToCheck = doc.pageCount <= 3 ? [doc.endPage] : [doc.endPage - 1, doc.endPage];

        for (let j = doc.startPage; j <= doc.endPage; j++) {
          const pageIndex = j - 1;
          const imageBase64 = base64Images[pageIndex];

          if (!imageBase64) {
            pagesToInclude.push(j);
            continue;
          }

          if (pagesToCheck.includes(j)) {
            try {
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
              if (contentRatio > 0.1) {
                const isLogPage = await detectLogPage(imageBase64);
                if (isLogPage) {
                  logPagesInDoc.push(j);
                  continue;
                }
              }
              pagesToInclude.push(j);
            } catch (error) {
              pagesToInclude.push(j);
            }
          } else {
            pagesToInclude.push(j);
          }
        }
      } else {
        for (let j = doc.startPage; j <= doc.endPage; j++) {
          pagesToInclude.push(j);
        }
      }

      if (pagesToInclude.length > 0) {
        const subDoc = await PDFDocument.create();
        const pageIndices = pagesToInclude.map(p => p - 1);

        const copiedPages = await subDoc.copyPages(sourcePdfDoc, pageIndices);
        copiedPages.forEach((page) => subDoc.addPage(page));

        const pdfBytes = await subDoc.save();

        const isTTNH = documentIsTTNH.get(doc.id) || false;
        let folderPath: string | null = null;
        if (isTTNH) {
          const broadcastCode = detectedBroadcastCode || 'MET';
          folderPath = `BAN TIN NGUON/${broadcastCode}`;
        } else {
          folderPath = doc.code ? getFolderPath(doc.code) : null;
        }

        if (folderPath) {
          filesToSave.push({
            path: folderPath,
            filename: doc.filename,
            bytes: pdfBytes
          });
        }
      }

      if (logPagesInDoc.length > 0) {
        let logCounter = 1;
        const logFolderPath = getLogFolderPath();

        if (!logFolderPath) {
          continue;
        }

        for (const pageNum of logPagesInDoc) {
          try {
            const logDoc = await PDFDocument.create();
            const pageIndex = pageNum - 1;
            const [copiedPage] = await logDoc.copyPages(sourcePdfDoc, [pageIndex]);
            logDoc.addPage(copiedPage);
            const logPdfBytes = await logDoc.save();

            const docCode = doc.code || 'Document';
            const logBaseName = sanitizeFilePart(`${inputFileBaseName}-${docCode}`);
            const filename = logCounter === 1 ? `${logBaseName}_LOG.pdf` : `${logCounter}${logBaseName}_LOG.pdf`;

            filesToSave.push({
              path: logFolderPath,
              filename: filename,
              bytes: logPdfBytes
            });
            logCounter++;
          } catch (error) {
            // Silent fail for log extraction
          }
        }
      }
    }

    const folderStructureSet = new Set<string>();
    const ensureSubfolders = (parentPath: string, subfolders: string[]) => {
      subfolders.forEach(subfolder => {
        const fullPath = parentPath ? `${parentPath}/${subfolder}` : subfolder;
        folderStructureSet.add(fullPath);
      });
    };

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

      const parentFolderPaths = new Set<string>();

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
          const parts = folderPath.split('/');
          if (parts.length > 0) {
            parts.pop();
            parentFolderPaths.add(parts.join('/'));
          }
        }
      }

      const logPath = getLogFolderPath();
      if (logPath) {
        const parts = logPath.split('/');
        if (parts.length > 0) {
          parts.pop();
          parentFolderPaths.add(parts.join('/'));
        }
      }

      parentFolderPaths.forEach(parentPath => {
        const current = addFolderToStructure(structure, parentPath, rootFolder);

        const isLogFTP = parentPath.includes('LOG FTP');
        const subfolders = isLogFTP
          ? ['MET', 'NAV', 'SAR', 'WX']
          : ['MET', 'NAV', 'SAR', 'WX', 'TUYEN'];

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

        ensureSubfolders(parentPath, subfolders);
      });

      const egcFolders = [
        'DICH VU EGC/BAN TIN NGUON DA DUOC XU LY EGC',
        'DICH VU EGC/KTKS TAI CHO BAN TIN NGUON XU LY EGC'
      ];

      egcFolders.forEach(egcPath => {
        const current = addFolderToStructure(structure, egcPath, rootFolder);

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

        ensureSubfolders(egcPath, ['MET', 'NAV', 'SAR', 'WX', 'TUYEN']);
      });

      const coverFolders = [
        {
          path: 'COVER/COVER',
          subfolders: ['MET', 'NAV', 'SAR', 'TUYEN', 'WX']
        },
        {
          path: 'COVER/KTKSTC BM 01',
          subfolders: ['MET', 'NAV', 'SAR', 'WX']
        }
      ];

      coverFolders.forEach(coverFolder => {
        const current = addFolderToStructure(structure, coverFolder.path, rootFolder);

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

        ensureSubfolders(coverFolder.path, coverFolder.subfolders);
      });

      const banTinNguonPath = 'BAN TIN NGUON';
      const banTinNguonCurrent = addFolderToStructure(structure, banTinNguonPath, rootFolder);

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

      ensureSubfolders(banTinNguonPath, ['MET', 'NAV', 'SAR', 'WX', 'TUYEN']);

      const logFtpPath = 'LOG FTP';
      const logFtpCurrent = addFolderToStructure(structure, logFtpPath, rootFolder);

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

      ensureSubfolders(logFtpPath, ['MET', 'NAV', 'SAR', 'WX']);

      return structure;
    };

    const folderStructure = generateFolderStructure();
    const structureJson = JSON.stringify(folderStructure, null, 2);

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
      folderStructureJson: structureJson
    };

  } catch (error) {
    console.error("Split Error:", error);
    throw new Error("Lỗi khi tách file PDF: " + (error as Error).message);
  }
};
