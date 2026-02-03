
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
  if (!('showDirectoryPicker' in window)) {
    return false;
  }

  if (isInIframe()) {
    try {
      const top = window.top;
      if (top === window.self) {
        return true;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  return true;
};

/**
 * Requests directory picker (only if not in cross-origin iframe)
 */
export const requestDirectoryPicker = async (): Promise<FileSystemDirectoryHandle | null> => {
  if (!canUseFileSystemAccess()) {
    return null;
  }

  try {
    const rootDirHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });
    return rootDirHandle;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    return null;
  }
};
