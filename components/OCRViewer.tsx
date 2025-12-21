import React, { useState, useRef, useEffect } from 'react';
import { OCRData, TextBlock } from '../types';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Download } from 'lucide-react';

interface OCRViewerProps {
  data: OCRData;
  previewUrls: string[];
}

export const OCRViewer: React.FC<OCRViewerProps> = ({ data, previewUrls }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selectedBlock, setSelectedBlock] = useState<TextBlock | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentPageData = data.pages[currentPage];
  const currentImageUrl = previewUrls[currentPage];

  useEffect(() => {
    if (!canvasRef.current || !imageRef.current || !currentPageData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    if (!ctx || !img) return;

    // Set canvas size to match image
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Draw bounding boxes
    if (showBoundingBoxes) {
      currentPageData.textBlocks.forEach((block, index) => {
        const x = block.x * canvas.width;
        const y = block.y * canvas.height;
        const width = block.width * canvas.width;
        const height = block.height * canvas.height;

        // Draw bounding box
        ctx.strokeStyle = selectedBlock === block ? '#ef4444' : '#3b82f6';
        ctx.lineWidth = selectedBlock === block ? 3 : 2;
        ctx.setLineDash([]);
        ctx.strokeRect(x, y, width, height);

        // Draw semi-transparent fill
        ctx.fillStyle = selectedBlock === block 
          ? 'rgba(239, 68, 68, 0.1)' 
          : 'rgba(59, 130, 246, 0.05)';
        ctx.fillRect(x, y, width, height);

        // Draw text label (if block is large enough)
        if (width > 50 && height > 15) {
          ctx.fillStyle = selectedBlock === block ? '#ef4444' : '#3b82f6';
          ctx.font = '12px Arial';
          ctx.fillText(
            block.text.substring(0, 30) + (block.text.length > 30 ? '...' : ''),
            x + 2,
            y + 15
          );
        }
      });
    }
  }, [currentPageData, showBoundingBoxes, selectedBlock, currentImageUrl]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setSelectedBlock(null);
      setZoom(1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < data.pages.length - 1) {
      setCurrentPage(currentPage + 1);
      setSelectedBlock(null);
      setZoom(1);
    }
  };

  const handleBlockClick = (block: TextBlock) => {
    setSelectedBlock(selectedBlock === block ? null : block);
  };

  const handleExportText = () => {
    const fullText = data.pages.map((page, idx) => 
      `=== TRANG ${page.page} ===\n${page.fullText}\n\n`
    ).join('');

    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-result-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Toolbar */}
      <div className="glass border-b border-slate-200 p-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 0}
              className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center">
              Trang {currentPage + 1} / {data.pages.length}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === data.pages.length - 1}
              className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="h-6 w-px bg-slate-300" />

          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <ZoomOut size={18} />
            </button>
            <span className="text-sm font-semibold text-slate-700 min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-3 py-2 text-xs rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showBoundingBoxes}
              onChange={(e) => setShowBoundingBoxes(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-slate-700">Hiển thị bounding boxes</span>
          </label>

          <button
            onClick={handleExportText}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 text-sm"
          >
            <Download size={16} />
            Xuất Text
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Image Viewer */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto bg-slate-100 p-6 flex items-center justify-center"
          style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
        >
          <div className="relative" style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
            <div className="relative inline-block">
              <img
                ref={imageRef}
                src={currentImageUrl}
                alt={`Page ${currentPage + 1}`}
                className="max-w-full h-auto shadow-2xl"
                style={{ display: 'block' }}
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 pointer-events-none"
                style={{ width: '100%', height: '100%' }}
              />
              {/* Clickable overlay for selecting blocks */}
              {showBoundingBoxes && currentPageData && (
                <div className="absolute top-0 left-0 w-full h-full">
                  {currentPageData.textBlocks.map((block, index) => {
                    const img = imageRef.current;
                    if (!img) return null;
                    
                    const x = block.x * img.naturalWidth;
                    const y = block.y * img.naturalHeight;
                    const width = block.width * img.naturalWidth;
                    const height = block.height * img.naturalHeight;
                    
                    const scaleX = img.clientWidth / img.naturalWidth;
                    const scaleY = img.clientHeight / img.naturalHeight;

                    return (
                      <div
                        key={index}
                        onClick={() => handleBlockClick(block)}
                        className="absolute cursor-pointer hover:bg-blue-200/20 transition-colors"
                        style={{
                          left: `${x * scaleX}px`,
                          top: `${y * scaleY}px`,
                          width: `${width * scaleX}px`,
                          height: `${height * scaleY}px`,
                          border: selectedBlock === block ? '2px solid #ef4444' : 'none',
                        }}
                        title={block.text}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar: Text Blocks & Full Text */}
        <div className="w-96 glass border-l border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Kết quả OCR - Trang {currentPage + 1}
            </h3>
            <div className="text-sm text-slate-600">
              {currentPageData.textBlocks.length} khối text được phát hiện
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Selected Block Details */}
            {selectedBlock && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-blue-900 mb-2">Khối text được chọn:</h4>
                <div className="space-y-1 text-sm">
                  <div><strong>Text:</strong> {selectedBlock.text}</div>
                  <div><strong>Vị trí:</strong> ({Math.round(selectedBlock.x * 100)}%, {Math.round(selectedBlock.y * 100)}%)</div>
                  <div><strong>Kích thước:</strong> {Math.round(selectedBlock.width * 100)}% × {Math.round(selectedBlock.height * 100)}%</div>
                  {selectedBlock.confidence && (
                    <div><strong>Độ tin cậy:</strong> {Math.round(selectedBlock.confidence * 100)}%</div>
                  )}
                </div>
              </div>
            )}

            {/* Text Blocks List */}
            <div>
              <h4 className="font-semibold text-slate-800 mb-3">Danh sách khối text:</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {currentPageData.textBlocks.map((block, index) => (
                  <div
                    key={index}
                    onClick={() => handleBlockClick(block)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedBlock === block
                        ? 'bg-blue-100 border-blue-400'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-800 mb-1">
                      Khối {index + 1}
                    </div>
                    <div className="text-xs text-slate-600 line-clamp-2">
                      {block.text || '(Trống)'}
                    </div>
                    {block.confidence && (
                      <div className="text-xs text-slate-500 mt-1">
                        Độ tin cậy: {Math.round(block.confidence * 100)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Full Text */}
            <div className="mt-6">
              <h4 className="font-semibold text-slate-800 mb-3">Toàn bộ text:</h4>
              <div className="bg-white border border-slate-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">
                  {currentPageData.fullText || '(Không có text được phát hiện)'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

