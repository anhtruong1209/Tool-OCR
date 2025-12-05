import { requestDirectoryPicker, getOrCreateDirectory } from './fileSaver';

export interface ExtractionSummary {
  originalFileName: string;
  broadcastCode: string | null;
  serviceCode: string | null;
  generatedAt: string;
  documents: Array<{
    id: string;
    filename: string;
    code?: string;
    startPage: number;
    endPage: number;
    pageCount: number;
    recommendedPath: string;
  }>;
  logs?: Array<{
    filename: string;
    page: number;
    sourceDocumentId: string;
    recommendedPath: string;
  }>;
}

/**
 * Đọc extraction-summary.json từ TEMP_EXTRACT folder
 */
export const readExtractionSummary = async (
  rootDirHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<ExtractionSummary | null> => {
  try {
    // Tạo path: TEMP_EXTRACT/{fileName}/extraction-summary.json
    const fileNameWithoutExt = fileName.replace(/\.pdf$/i, '');
    const pathParts = ['TEMP_EXTRACT', fileNameWithoutExt];
    const targetDir = await getOrCreateDirectory(rootDirHandle, pathParts);
    
    const fileHandle = await targetDir.getFileHandle('extraction-summary.json', { create: false });
    const file = await fileHandle.getFile();
    const text = await file.text();
    const summary: ExtractionSummary = JSON.parse(text);
    
    return summary;
  } catch (error: any) {
    console.error('[FileSync] Error reading extraction-summary.json:', error);
    if (error.name === 'NotFoundError') {
      throw new Error(`Không tìm thấy file extraction-summary.json cho "${fileName}". Vui lòng đảm bảo file đã được xử lý xong.`);
    }
    throw new Error(`Lỗi khi đọc extraction-summary.json: ${error.message}`);
  }
};

/**
 * Đọc file PDF từ TEMP_EXTRACT và trả về dưới dạng Uint8Array
 */
const readPdfFile = async (
  rootDirHandle: FileSystemDirectoryHandle,
  fileName: string,
  pdfFileName: string
): Promise<Uint8Array> => {
  try {
    const fileNameWithoutExt = fileName.replace(/\.pdf$/i, '');
    const pathParts = ['TEMP_EXTRACT', fileNameWithoutExt, 'PDFS'];
    const targetDir = await getOrCreateDirectory(rootDirHandle, pathParts);
    
    const fileHandle = await targetDir.getFileHandle(pdfFileName, { create: false });
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error: any) {
    console.error(`[FileSync] Error reading PDF file ${pdfFileName}:`, error);
    throw new Error(`Lỗi khi đọc file ${pdfFileName}: ${error.message}`);
  }
};

/**
 * Đồng bộ file từ TEMP_EXTRACT vào folder đích
 */
export const syncFilesToDestination = async (
  rootDirHandle: FileSystemDirectoryHandle,
  fileName: string,
  destinationRootHandle: FileSystemDirectoryHandle
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  try {
    // Đọc extraction-summary.json
    const summary = await readExtractionSummary(rootDirHandle, fileName);
    if (!summary) {
      throw new Error('Không thể đọc extraction-summary.json');
    }

    // Đồng bộ documents
    for (const doc of summary.documents) {
      try {
        // Đọc file PDF từ TEMP_EXTRACT
        const pdfBytes = await readPdfFile(rootDirHandle, fileName, doc.filename);
        
        // Tạo path đích: {recommendedPath} (đã bao gồm DNR/PHAT MSI & SAR THANG 11-2025/...)
        const pathParts = doc.recommendedPath.split('/').filter(p => p);
        const targetDir = await getOrCreateDirectory(destinationRootHandle, pathParts);
        
        // Lưu file vào folder đích
        const fileHandle = await targetDir.getFileHandle(doc.filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(pdfBytes);
        await writable.close();
        
        console.log(`[FileSync] Synced ${doc.filename} to ${pathParts.join('/')}`);
        success++;
      } catch (error: any) {
        console.error(`[FileSync] Error syncing ${doc.filename}:`, error);
        errors.push(`${doc.filename}: ${error.message}`);
        failed++;
      }
    }

    // Đồng bộ logs (nếu có)
    if (summary.logs && summary.logs.length > 0) {
      for (const log of summary.logs) {
        try {
          // Đọc file LOG từ TEMP_EXTRACT
          const pdfBytes = await readPdfFile(rootDirHandle, fileName, log.filename);
          
          // Tạo path đích cho LOG: LOG FTP/{broadcastCode}/{filename}
          const broadcastCode = summary.broadcastCode || 'MET';
          const pathParts = ['LOG FTP', broadcastCode].filter(p => p);
          const targetDir = await getOrCreateDirectory(destinationRootHandle, pathParts);
          
          // Lưu file LOG vào folder đích
          const fileHandle = await targetDir.getFileHandle(log.filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(pdfBytes);
          await writable.close();
          
          console.log(`[FileSync] Synced LOG ${log.filename} to ${pathParts.join('/')}`);
          success++;
        } catch (error: any) {
          console.error(`[FileSync] Error syncing LOG ${log.filename}:`, error);
          errors.push(`LOG ${log.filename}: ${error.message}`);
          failed++;
        }
      }
    }

    return { success, failed, errors };
  } catch (error: any) {
    console.error('[FileSync] Error in syncFilesToDestination:', error);
    throw new Error(`Lỗi khi đồng bộ file: ${error.message}`);
  }
};

