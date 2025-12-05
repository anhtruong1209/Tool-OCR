import { FileToSave } from '../types';

/**
 * Detects if we're in an iframe
 */
export const isInIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true; // If we can't access top, assume we're in iframe
  }
};



/**
 * Checks if File System Access API can be used (not in cross-origin iframe)
 */
export const canUseFileSystemAccess = (): boolean => {
  // Check if API exists
  if (!('showDirectoryPicker' in window)) {
    return false;
  }
  
  // Check if we're in cross-origin iframe
  if (isInIframe()) {
    try {
      // Try to access top window - if we can't, it's cross-origin
      const top = window.top;
      if (top === window.self) {
        return true; // Not in iframe
      }
      // In same-origin iframe, we can use top window
      return true;
    } catch (e) {
      // Cross-origin iframe - cannot use File System Access API
      return false;
    }
  }
  
  return true;
};

/**
 * Requests directory picker (only if not in cross-origin iframe)
 */
export const requestDirectoryPicker = async (): Promise<FileSystemDirectoryHandle | null> => {
  // Check if we can use File System Access API
  if (!canUseFileSystemAccess()) {
    console.log('[FileSaver] Cannot use File System Access API in cross-origin iframe. ZIP fallback disabled.');
    return null;
  }

  // Try to open directory picker
  try {
    const rootDirHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });
    return rootDirHandle;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      // User cancelled
      throw error;
    }
    
    // If cross-origin error, return null to use ZIP fallback
    if (error.message?.includes('Cross origin') || error.message?.includes('sub frames')) {
      console.log('[FileSaver] Cross-origin error while opening directory picker. ZIP fallback disabled.');
      return null;
    }
    
    throw error;
  }
};

/**
 * Helper function to get or create directory
 */
const getOrCreateDirectory = async (dirHandle: FileSystemDirectoryHandle, pathParts: string[]): Promise<FileSystemDirectoryHandle> => {
  if (pathParts.length === 0) return dirHandle;
  
  const [first, ...rest] = pathParts;
  let subDirHandle: FileSystemDirectoryHandle;
  
  try {
    subDirHandle = await dirHandle.getDirectoryHandle(first, { create: true });
  } catch (error) {
    throw new Error(`Không thể tạo folder: ${first}`);
  }
  
  return getOrCreateDirectory(subDirHandle, rest);
};

/**
 * Saves files using File System Access API
 */
export const saveFilesToDirectory = async (
  rootDirHandle: FileSystemDirectoryHandle,
  filesToSave: FileToSave[],
  folderStructureJson?: string
): Promise<void> => {
  // Xóa và tạo lại TEMP_EXTRACT nếu có file trong đó
  const tempExtractPaths = new Set<string>();
  for (const fileInfo of filesToSave) {
    if (fileInfo.path.startsWith('TEMP_EXTRACT/')) {
      const pathParts = fileInfo.path.split('/').filter(p => p);
      if (pathParts.length >= 2) {
        // TEMP_EXTRACT/{folderName}/...
        tempExtractPaths.add(pathParts[1]); // folderName
      }
    }
  }
  
  // TEMP_EXTRACT: Không xóa folder, chỉ ghi đè file để kiểm tra
  // File System Access API tự động ghi đè khi dùng { create: true }

  // Save all files
  for (const fileInfo of filesToSave) {
    const pathParts = fileInfo.path.split('/').filter(p => p);
    const filename = fileInfo.filename;
    
    // Xử lý InvalidStateError: retry với fresh directory handle
    let retryCount = 0;
    const maxRetries = 2;
    let saved = false;
    
    while (retryCount <= maxRetries && !saved) {
      try {
        // Lấy directory handle mới mỗi lần retry để tránh InvalidStateError
        const targetDir = await getOrCreateDirectory(rootDirHandle, pathParts);
        const fileHandle = await targetDir.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        const bytes = new Uint8Array(fileInfo.bytes);
        await writable.write(bytes);
        await writable.close();
        console.log(`[FileSaver] Saved ${fileInfo.path}/${filename} (${fileInfo.bytes.length} bytes)`);
        saved = true;
      } catch (error: any) {
        if (error.name === 'InvalidStateError' && retryCount < maxRetries) {
          // InvalidStateError: refresh và retry
          retryCount++;
          console.warn(`[FileSaver] InvalidStateError for ${fileInfo.path}/${filename}, retrying (${retryCount}/${maxRetries})...`);
          // Đợi một chút trước khi retry
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        // Nếu không phải InvalidStateError hoặc đã hết retry, throw error
        console.error(`[FileSaver] Error saving ${fileInfo.path}/${filename}:`, error);
        throw new Error(`Lỗi khi lưu file ${fileInfo.path}/${filename}: ${(error as Error).message}`);
      }
    }
  }

  // Save folder structure JSON
  if (folderStructureJson) {
    try {
      const pathParts = ['DNR', 'PHAT MSI & SAR THANG 11-2025'].filter(p => p);
      const targetDir = await getOrCreateDirectory(rootDirHandle, pathParts);
      const fileHandle = await targetDir.getFileHandle('folder-structure.json', { create: true });
      const writable = await fileHandle.createWritable();
      const jsonBytes = new TextEncoder().encode(folderStructureJson);
      await writable.write(jsonBytes);
      await writable.close();
      console.log(`[FileSaver] Saved folder-structure.json`);
    } catch (error) {
      console.warn(`[FileSaver] Error saving folder-structure.json:`, error);
    }
  }

  console.log(`[FileSaver] All files saved successfully!`);
};

