
import React, { useState, useCallback } from 'react';
import { convertPdfToImage } from './services/pdfUtils';
import { analyzeDocument } from './services/geminiService';
import { splitPdfByKeywords } from './services/pdfSplitter';
import { UploadArea } from './components/UploadArea';
import { InvoiceViewer } from './components/InvoiceViewer';
import { IncidentViewer } from './components/IncidentViewer';
import { SplitterViewer } from './components/SplitterViewer';
import { JobQueueViewer } from './components/JobQueueViewer';
import { DocumentData, ProcessingStatus, DocumentType } from './types';
import { jobQueue } from './services/jobQueue';
import { requestDirectoryPicker } from './services/fileSaver';
import { AlertCircle, BrainCircuit, Eye, FileText, Anchor, Layers, Scissors } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [docType, setDocType] = useState<DocumentType>('INVOICE');
  const [fileName, setFileName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reportData, setReportData] = useState<DocumentData | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  
  const handleFileSelect = useCallback(async (file: File) => {
    setFileName(file.name);
    setReportData(null);
    setErrorMsg(null);
    setStatus(ProcessingStatus.CONVERTING);

    try {
      if (docType === 'SPLIT') {
          // --- SPLITTER LOGIC ---
          let rootDirHandle: FileSystemDirectoryHandle;
          try {
            const handle = await requestDirectoryPicker();
            if (!handle) {
              throw new Error('Trình duyệt không hỗ trợ quyền truy cập thư mục. Vui lòng mở ứng dụng trong tab chính (không iframe) bằng Chrome/Edge mới nhất.');
            }
            rootDirHandle = handle;
          } catch (pickerError: any) {
            if (pickerError.name === 'AbortError') {
              setStatus(ProcessingStatus.IDLE);
              setErrorMsg(null);
              return;
            }
            throw pickerError;
          }

          const result = await splitPdfByKeywords(file, rootDirHandle);
          setReportData(result);
          setStatus(ProcessingStatus.SUCCESS);
          // Generate a preview of first page just for visual confirmation
          const base64Images = await convertPdfToImage(file);
          // Only show first page preview for splitter to save memory on large files
          setPreviewUrls(base64Images.slice(0, 1).map(img => `data:image/jpeg;base64,${img}`));

      } else {
          // --- OCR / GEMINI LOGIC ---
          // Returns array of base64 strings (multi-page support)
          const base64Images = await convertPdfToImage(file);
          setPreviewUrls(base64Images.map(img => `data:image/jpeg;base64,${img}`));
          
          setStatus(ProcessingStatus.ANALYZING);
          const result = await analyzeDocument(base64Images, docType);
          
          setReportData(result);
          setStatus(ProcessingStatus.SUCCESS);
      }
    } catch (error: any) {
      console.error(error);
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg(error.message || 'Đã có lỗi xảy ra trong quá trình xử lý.');
    }
  }, [docType]);

  const handleMultipleFilesSelect = useCallback(async (files: File[]) => {
    if (docType !== 'SPLIT') {
      // For non-SPLIT mode, just process first file
      handleFileSelect(files[0]);
      return;
    }

    // For SPLIT mode, try to request directory picker (optional)
    // If not available (e.g., in iframe), files will be downloaded as ZIP
    let rootDirHandle: FileSystemDirectoryHandle;
    try {
      const handle = await requestDirectoryPicker();
      if (!handle) {
        throw new Error('Trình duyệt không hỗ trợ quyền truy cập thư mục. Vui lòng mở ứng dụng trong tab chính (không iframe) bằng Chrome/Edge mới nhất.');
      }
      rootDirHandle = handle;
      console.log('[App] Directory selected:', rootDirHandle.name);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // User cancelled directory picker
        console.log('[App] User cancelled directory selection');
        setStatus(ProcessingStatus.IDLE);
        return;
      }
      console.warn('[App] Error selecting directory:', error);
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg(error.message || 'Không thể truy cập thư mục đích.');
      return;
    }

    // Add all files to job queue with root directory handle
    files.forEach(file => {
      jobQueue.addJob(file, rootDirHandle);
    });
    
    // Show job queue viewer
    setStatus(ProcessingStatus.ANALYZING);
  }, [docType, handleFileSelect]);

  const handleReset = () => {
    setStatus(ProcessingStatus.IDLE);
    setFileName('');
    setReportData(null);
    setPreviewUrls([]);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col overflow-hidden relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none" style={{
        backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      }}></div>

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 h-14 shrink-0 z-30 shadow-lg relative">
        <div className="w-full px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-1.5 rounded-lg text-white shadow-inner">
              <BrainCircuit size={18} strokeWidth={2.5} />
            </div>
            <h1 className="font-bold text-lg text-white tracking-tight hidden md:block">
                Kế Toán Vishipel AI <span className="opacity-30 font-light mx-2">|</span> 
                <span className="text-blue-300 font-medium text-sm">
                  {docType === 'INVOICE' && 'Xử lý Hóa đơn GTGT'}
                  {docType === 'INCIDENT' && 'Xử lý Báo cáo Sự cố'}
                  {docType === 'SPLIT' && 'Bộ Tách PDF Tự Động'}
                </span>
            </h1>
            <h1 className="font-bold text-lg text-white md:hidden">Vishipel AI</h1>
          </div>
          
          {status === ProcessingStatus.SUCCESS && (
              <button 
                onClick={handleReset}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded border border-slate-700 transition-colors shadow-sm"
              >
                Upload file mới
              </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col h-[calc(100vh-3.5rem)] relative z-10">
        
        {/* IDLE & PROCESSING STATES */}
        {status !== ProcessingStatus.SUCCESS && (
            <div className="flex-grow flex flex-col items-center justify-center p-6 overflow-y-auto">
                
                {status === ProcessingStatus.IDLE && (
                    <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full max-w-4xl bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl border border-white/50">
                        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">
                            Hệ thống Xử Lý Tài Liệu Hàng Hải
                        </h2>
                        <p className="text-slate-600 max-w-xl mx-auto mb-8 font-medium">
                            Chọn loại hình xử lý bạn muốn thực hiện
                        </p>

                        {/* Document Type Selector */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            <button 
                              onClick={() => setDocType('INVOICE')}
                              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                                docType === 'INVOICE' 
                                  ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-200 scale-105' 
                                  : 'border-slate-200 bg-white hover:border-blue-300 text-slate-600 hover:scale-105'
                              }`}
                            >
                                <div className={`p-2 rounded-full ${docType === 'INVOICE' ? 'bg-blue-200' : 'bg-slate-100'}`}>
                                  <FileText className="w-6 h-6" />
                                </div>
                                <span className="font-bold">Hóa Đơn GTGT</span>
                                <span className="text-xs text-slate-400 font-normal">Trích xuất bảng & Export Excel</span>
                            </button>
                            <button 
                              onClick={() => setDocType('INCIDENT')}
                              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                                docType === 'INCIDENT' 
                                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md ring-2 ring-indigo-200 scale-105' 
                                  : 'border-slate-200 bg-white hover:border-indigo-300 text-slate-600 hover:scale-105'
                              }`}
                            >
                                <div className={`p-2 rounded-full ${docType === 'INCIDENT' ? 'bg-indigo-200' : 'bg-slate-100'}`}>
                                  <Anchor className="w-6 h-6" />
                                </div>
                                <span className="font-bold">Báo Cáo Sự Cố</span>
                                <span className="text-xs text-slate-400 font-normal">Xử lý ma trận bảng & tọa độ</span>
                            </button>
                            
                            <button 
                              onClick={() => setDocType('SPLIT')}
                              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                                docType === 'SPLIT' 
                                  ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-md ring-2 ring-purple-200 scale-105' 
                                  : 'border-slate-200 bg-white hover:border-purple-300 text-slate-600 hover:scale-105'
                              }`}
                            >
                                <div className={`p-2 rounded-full ${docType === 'SPLIT' ? 'bg-purple-200' : 'bg-slate-100'}`}>
                                  <Scissors className="w-6 h-6" />
                                </div>
                                <span className="font-bold">Tách File PDF</span>
                                <span className="text-xs text-slate-400 font-normal">Cắt file tự động</span>
                            </button>
                        </div>
                        
                        <div className="bg-white p-2 rounded-2xl shadow-inner border border-slate-100">
                            <UploadArea 
                              onFileSelect={handleFileSelect}
                              onMultipleFilesSelect={handleMultipleFilesSelect}
                              multiple={docType === 'SPLIT'}
                            />
                        </div>
                        
                        {docType === 'SPLIT' && <JobQueueViewer onReset={handleReset} />}
                    </div>
                )}

                {/* Show JobQueueViewer when processing in SPLIT mode */}
                {status === ProcessingStatus.ANALYZING && docType === 'SPLIT' && (
                    <div className="w-full max-w-4xl">
                        <JobQueueViewer onReset={handleReset} />
                    </div>
                )}

                {(status === ProcessingStatus.CONVERTING || status === ProcessingStatus.ANALYZING) && docType !== 'SPLIT' && (
                    <div className="text-center animate-in fade-in zoom-in duration-300 bg-white/90 p-8 rounded-2xl shadow-2xl border border-white">
                        <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-6 border-blue-200 border-t-blue-600"></div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">
                            {status === ProcessingStatus.CONVERTING ? 'Đang đọc tài liệu...' : 'Đang xử lý dữ liệu...'}
                        </h3>
                        <p className="text-slate-500">
                          Vishipel AI đang phân tích văn bản...
                        </p>
                    </div>
                )}

                {status === ProcessingStatus.ERROR && (
                    <div className="max-w-md w-full mt-6 p-6 bg-white border border-red-200 rounded-xl text-center shadow-lg animate-in shake">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-red-700 mb-2">Xử lý thất bại</h3>
                        <p className="text-slate-600 mb-6">{errorMsg}</p>
                        <button onClick={handleReset} className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
                            Thử lại
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* SUCCESS STATE */}
        {status === ProcessingStatus.SUCCESS && reportData && (
            <div className="flex-grow flex flex-col lg:flex-row overflow-hidden h-full">
                
                {/* Left Pane: PDF Preview (Simplified for Splitter, Full for others) */}
                <div className="lg:w-1/2 h-[40vh] lg:h-full bg-slate-800 overflow-auto p-4 md:p-8 shadow-inner border-r border-slate-700 relative scrollbar-thin">
                   {previewUrls.length > 0 ? (
                       <div className="flex flex-col gap-6 items-center">
                           {previewUrls.map((url, idx) => (
                             <div key={idx} className="relative shadow-2xl ring-1 ring-white/10 group w-full max-w-[600px]">
                                 <img src={url} alt={`Page ${idx + 1}`} className="w-full h-auto" />
                                 <div className="absolute top-4 left-4 bg-black/70 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-white/20 flex items-center gap-1">
                                     <Layers size={12} />
                                     TRANG {idx + 1} {docType === 'SPLIT' && idx === 0 ? '(Trang đầu)' : ''}
                                 </div>
                             </div>
                           ))}
                           {docType === 'SPLIT' && (
                               <div className="text-slate-400 text-sm italic">
                                   (Chỉ hiển thị trang đầu để tối ưu hiệu năng)
                               </div>
                           )}
                       </div>
                   ) : (
                       <div className="text-slate-500 flex flex-col items-center mt-20">
                           <Eye size={48} className="mb-4 opacity-50" />
                           <p>Không có bản xem trước</p>
                       </div>
                   )}
                </div>

                {/* Right Pane: Document Viewer */}
                <div className="lg:w-1/2 h-[60vh] lg:h-full overflow-hidden relative bg-slate-200/50 backdrop-blur-sm">
                    {docType === 'INVOICE' && <InvoiceViewer data={reportData as any} />}
                    {docType === 'INCIDENT' && <IncidentViewer data={reportData as any} />}
                    {docType === 'SPLIT' && <SplitterViewer data={reportData as any} />}
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
