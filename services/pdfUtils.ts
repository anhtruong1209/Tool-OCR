import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source to a CDN that supports the ES module worker required by pdfjs-dist v5+
// We use jsdelivr as it reliably hosts the .mjs build artifacts
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const convertPdfToImage = async (file: File, maxPages?: number): Promise<string[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const images: string[] = [];
    // If maxPages is not specified, default to 3 for backward compatibility
    // If maxPages is -1 or undefined, convert all pages
    const pageLimit = maxPages === undefined ? 3 : (maxPages === -1 ? pdf.numPages : maxPages);
    const maxPagesToConvert = Math.min(pdf.numPages, pageLimit);

    for (let i = 1; i <= maxPagesToConvert; i++) {
      const page = await pdf.getPage(i);

      // Tăng resolution lên 3.0 để AI nhận diện biểu mẫu chính xác hơn (User requested 2.5 - 3.0)
      const scale = 3.0;
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