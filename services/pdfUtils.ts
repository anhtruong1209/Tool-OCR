// Import pdfjs-dist - import trực tiếp các function cần thiết
// @ts-ignore - pdfjs-dist exports có thể không được nhận diện đúng trong build nhưng vẫn hoạt động ở runtime
import * as pdfjsLib from 'pdfjs-dist';

// QUAN TRỌNG: Set worker source ngay sau khi import
// Set the worker source to a CDN that supports the ES module worker required by pdfjs-dist v5+
// We use jsdelivr as it reliably hosts the .mjs build artifacts
// Sử dụng version cố định để tránh lỗi build
const PDFJS_VERSION = '5.4.394';
// @ts-ignore - GlobalWorkerOptions có thể không có trong type definitions nhưng tồn tại ở runtime
if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  // Force set workerSrc từ CDN - không để pdfjs-dist tự resolve từ build output
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
}

// Extract functions để đảm bảo chúng không bị undefined
// Sử dụng cách an toàn để extract function
let getDocument: any;
try {
  getDocument = pdfjsLib.getDocument;
  if (!getDocument) {
    getDocument = (pdfjsLib as any).getDocument;
  }
} catch (e) {
  console.error('Error extracting getDocument from pdfjs-dist:', e);
}

export const convertPdfToImage = async (file: File, maxPages?: number): Promise<string[]> => {
  try {
    // Kiểm tra getDocument có tồn tại không, nếu không thì thử dùng trực tiếp từ pdfjsLib
    const getDoc = getDocument || pdfjsLib.getDocument || (pdfjsLib as any).getDocument;
    if (!getDoc || typeof getDoc !== 'function') {
      throw new Error('pdfjs-dist getDocument không khả dụng. Vui lòng kiểm tra lại cấu hình.');
    }
    const arrayBuffer = await file.arrayBuffer();
    // @ts-ignore - getDocument có thể không được nhận diện đúng trong build nhưng vẫn hoạt động ở runtime
    const loadingTask = getDoc({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const images: string[] = [];
    // If maxPages is not specified, default to 3 for backward compatibility
    // If maxPages is -1 or undefined, convert all pages
    const pageLimit = maxPages === undefined ? 3 : (maxPages === -1 ? pdf.numPages : maxPages);
    const maxPagesToConvert = Math.min(pdf.numPages, pageLimit);

    for (let i = 1; i <= maxPagesToConvert; i++) {
      const page = await pdf.getPage(i);

      // Increased scale to 2.5 to better handle SCANNED documents and small text
      const scale = 2.5; 
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Canvas context not available');
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      // Cast to any to fix type mismatch with RenderParameters in some pdfjs-dist versions
      await page.render(renderContext as any).promise;

      // Convert canvas to base64 string. 
      // Quality 0.9 ensures details in SCANNED files are preserved.
      const base64String = canvas.toDataURL('image/jpeg', 0.9);
      
      // Remove the data URL prefix to get raw base64
      images.push(base64String.split(',')[1]);
    }
    
    return images;
  } catch (error) {
    console.error('Error converting PDF to image:', error);
    throw new Error('Không thể đọc file PDF. Vui lòng kiểm tra lại file.');
  }
};