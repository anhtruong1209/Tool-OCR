
import React, { useState, useCallback, useRef } from 'react';
import { convertPdfToImage } from './services/pdfUtils';
import { analyzeDocument } from './services/geminiService';
import { splitPdfByKeywords } from './services/pdfSplitter';
import { UploadArea } from './components/UploadArea';
import { InvoiceViewer } from './components/InvoiceViewer';
import { IncidentViewer } from './components/IncidentViewer';
import { SplitterViewer } from './components/SplitterViewer';
import { JobQueueViewer } from './components/JobQueueViewer';
import { DocumentationViewer } from './components/DocumentationViewer';
import { DocumentData, ProcessingStatus, DocumentType } from './types';
import { jobQueue } from './services/jobQueue';
import { requestDirectoryPicker } from './services/fileSaver';
import { AlertCircle, BrainCircuit, Eye, FileText, Anchor, Layers, Scissors, FolderOpen, ShieldCheck, BookOpen } from 'lucide-react';

type HandlePermissionState = 'prompt' | 'granted' | 'denied';

const permissionMeta: Record<HandlePermissionState, { label: string; className: string; helper: string }> = {
  granted: {
    label: 'Đã cấp toàn quyền',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    helper: 'Ứng dụng có thể ghi file trực tiếp vào thư mục này.',
  },
  prompt: {
    label: 'Chờ cấp quyền',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
    helper: 'Nhấn nút bên dưới để cho phép chỉnh sửa thư mục.',
  },
  denied: {
    label: 'Đã từ chối',
    className: 'bg-rose-50 text-rose-600 border border-rose-200',
    helper: 'Bạn cần cấp lại quyền để hệ thống có thể lưu file.',
  },
};

const queryDirPermission = async (handle: FileSystemDirectoryHandle): Promise<HandlePermissionState> => {
  if ('queryPermission' in handle) {
    const permission = await (handle as any).queryPermission({ mode: 'readwrite' });
    return permission as HandlePermissionState;
  }
  return 'prompt';
};

const requestDirPermission = async (handle: FileSystemDirectoryHandle): Promise<HandlePermissionState> => {
  if ('requestPermission' in handle) {
    const permission = await (handle as any).requestPermission({ mode: 'readwrite' });
    return permission as HandlePermissionState;
  }
  return 'prompt';
};

const App: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [docType, setDocType] = useState<DocumentType>('SPLIT');
  const [showDocs, setShowDocs] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reportData, setReportData] = useState<DocumentData | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [directoryInfo, setDirectoryInfo] = useState<{ name: string; permission: HandlePermissionState } | null>(null);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const currentPermission = directoryInfo?.permission ?? 'prompt';
  const permissionBadgeLabel = directoryInfo ? permissionMeta[currentPermission].label : 'Chưa chọn thư mục';
  const permissionBadgeClass = directoryInfo ? permissionMeta[currentPermission].className : 'bg-slate-100 text-slate-500 border border-slate-200';
  const permissionHelperText = directoryInfo ? permissionMeta[currentPermission].helper : 'Chọn thư mục đích để kích hoạt nút yêu cầu quyền ghi.';

  const syncDirectoryHandle = useCallback(async (handle: FileSystemDirectoryHandle) => {
    dirHandleRef.current = handle;
    const permission = await queryDirPermission(handle);
    setDirectoryInfo({ name: handle.name, permission });
  }, []);

  const handleRequestEditPermission = useCallback(async () => {
    if (!dirHandleRef.current) {
      setErrorMsg('Vui lòng chọn thư mục lưu kết quả trước khi cấp quyền.');
      return;
    }
    try {
      const permission = await requestDirPermission(dirHandleRef.current);
      setDirectoryInfo({ name: dirHandleRef.current.name, permission });
      setErrorMsg(null);
    } catch (err: any) {
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg(err.message || 'Không thể yêu cầu quyền chỉnh sửa thư mục.');
    }
  }, []);

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
          await syncDirectoryHandle(rootDirHandle);
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
  }, [docType, syncDirectoryHandle]);

  const handleMultipleFilesSelect = useCallback(async (files: File[]) => {
    if (docType !== 'SPLIT') {
      // For non-SPLIT mode, just process first file
      handleFileSelect(files[0]);
      return;
    }

    // For SPLIT mode, check if we already have a directory handle
    if (!dirHandleRef.current) {
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg('Vui lòng chọn thư mục lưu kết quả trước khi upload file PDF.');
      return;
    }

    // Add all files to job queue with existing root directory handle
    files.forEach(file => {
      jobQueue.addJob(file, dirHandleRef.current!);
    });

    // Show job queue viewer
    setStatus(ProcessingStatus.ANALYZING);
  }, [docType, handleFileSelect]);

  const handleSelectDestinationFolder = useCallback(async () => {
    try {
      const handle = await requestDirectoryPicker();
      if (!handle) {
        throw new Error('Trình duyệt không hỗ trợ quyền truy cập thư mục. Vui lòng mở ứng dụng trong tab chính (không iframe) bằng Chrome/Edge mới nhất.');
      }
      await syncDirectoryHandle(handle);
      setErrorMsg(null);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // User cancelled
        return;
      }
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg(error.message || 'Không thể truy cập thư mục đích.');
    }
  }, [syncDirectoryHandle]);

  const handleReset = () => {
    setStatus(ProcessingStatus.IDLE);
    setFileName('');
    setReportData(null);
    setPreviewUrls([]);
    setErrorMsg(null);
    setDirectoryInfo(null);
    dirHandleRef.current = null;
  };

  return (
    <div className="min-h-screen flex overflow-hidden relative">
      {/* Sidebar Menu - Left */}
      <aside className="w-64 shrink-0 glass-strong border-r border-white/20 flex flex-col z-20">
        {/* Logo & Brand */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-4">
            {/* Logo */}
            <div className="logo-placeholder">
              <img id="app-logo" src="public/LOGO.png" alt="Logo" className="w-full h-full object-contain rounded-lg" onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const placeholderText = document.getElementById('logo-placeholder-text');
                if (placeholderText) placeholderText.style.display = 'block';
              }} />
              <span className="text-white/60 text-xs text-center px-2 hidden" id="logo-placeholder-text">Paste Logo</span>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-black text-white tracking-tight">
                <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-orange-500 bg-clip-text text-transparent">
                  VISHIPEL
                </span>
              </h1>
              <p className="text-xs font-bold text-orange-400 uppercase tracking-wider">TOOL</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => {
              setDocType('SPLIT');
              setShowDocs(false);
              if (status === ProcessingStatus.SUCCESS) handleReset();
            }}
            className={`w-full px-4 py-3 rounded-xl text-left transition-all flex items-center gap-3 ${
              !showDocs && docType === 'SPLIT'
                ? 'glass bg-white/20 text-dark font-semibold border border-orange-400/30'
                : 'glass-light text-dark/70 hover:text-dark hover:bg-dark/10'
            }`}
          >
            <Scissors size={20} />
            <span>Tách PDF</span>
          </button>
          <button
            onClick={() => {
              setShowDocs(true);
              handleReset();
            }}
            className={`w-full px-4 py-3 rounded-xl text-left transition-all flex items-center gap-3 ${
              showDocs
                ? 'glass bg-white/20 text-dark font-semibold border border-orange-400/30'
                : 'glass-light text-dark/70 hover:text-dark hover:bg-dark/10'
            }`}
          >
            <BookOpen size={20} />
            <span>Hướng Dẫn</span>
          </button>
        </nav>

        {/* Footer Info */}
        <div className="p-4 border-t border-white/10">
          <div className="glass-light rounded-lg p-3 text-white/60 text-xs">
            <p className="font-semibold text-white/80 mb-1">Vishipel TOOL</p>
            <p>Xử lý PDF thông minh</p>
          </div>
        </div>
      </aside>

      {/* Main Content - Right */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {showDocs ? (
          <DocumentationViewer />
        ) : (
          <>
        {/* Top Bar */}
        <header className="glass border-b border-slate-200 h-16 shrink-0 z-30 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800">
              {docType === 'SPLIT' && 'Bộ Tách PDF Tự Động'}
              {docType === 'INVOICE' && 'Xử lý Hóa đơn GTGT'}
              {docType === 'INCIDENT' && 'Xử lý Báo cáo Sự cố'}
            </h2>
          </div>

          {status === ProcessingStatus.SUCCESS && (
            <button
              onClick={handleReset}
              className="glass-light hover:bg-blue-50 text-blue-700 px-4 py-2 rounded-lg transition-all text-sm font-semibold border border-blue-200"
            >
              Upload file mới
            </button>
          )}
        </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative z-10 p-6">

          {/* IDLE & PROCESSING STATES */}
          {status !== ProcessingStatus.SUCCESS && (
            <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto">

              {status === ProcessingStatus.IDLE && (
                <div className="w-full max-w-5xl mx-auto space-y-6">
                  <section className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700 glass-strong p-8 md:p-10 rounded-3xl">
                    <div className="mx-auto max-w-2xl">
                      <p className="text-xs uppercase tracking-[0.5em] text-slate-500 mb-3 font-semibold">Vishipel TOOL</p>
                      <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 tracking-tight">
                        Bộ Tách PDF Tự Động <br></br>(Đài TTDH Đà Nẵng)
                      </h2>
                      <p className="text-slate-700 mb-6 text-base">
                        Kéo thả các file PDF nguồn, chọn thư mục lưu và để hệ thống tự động cắt nhỏ theo cấu trúc nghiệp vụ.
                      </p>
                    </div>
                  </section>

                  <section className="grid gap-6 lg:grid-cols-2 items-start">
                    <div className="glass-strong rounded-2xl p-6 flex flex-col gap-4 transition-all hover:shadow-lg border border-slate-200">
                      <div className="flex flex-col gap-2 text-left">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-semibold">Bước 1</p>
                        <h3 className="text-xl font-bold text-slate-900">Chọn thư mục lưu kết quả</h3>
                        <p className="text-sm text-slate-600">Chọn thư mục đích trước khi tải file PDF lên.</p>
                      </div>
                      <button
                        onClick={handleSelectDestinationFolder}
                        className="w-full px-5 py-3 bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:scale-105 flex items-center justify-center gap-3 text-sm"
                      >
                        <FolderOpen size={20} />
                        {directoryInfo ? `Đã chọn: ${directoryInfo.name}` : 'Chọn thư mục lưu file'}
                      </button>
                      {directoryInfo && (
                        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                          ✓ Thư mục "{directoryInfo.name}" đã được chọn. Bạn có thể upload file PDF bên dưới.
                        </div>
                      )}
                    </div>

                    <div className="glass-strong rounded-2xl p-6 flex flex-col gap-4 transition-all hover:shadow-lg border border-slate-200">
                      <div className="flex flex-col gap-2 text-left">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-semibold">Bước 2</p>
                        <h3 className="text-xl font-bold text-slate-900">Tải lên file PDF</h3>
                        <p className="text-sm text-slate-600">Hỗ trợ kéo thả hoặc chọn từ máy tính (tối đa 10MB cho mỗi file).</p>
                      </div>
                      <div className="glass-light rounded-2xl p-4 border border-slate-200">
                        <UploadArea
                          onFileSelect={handleFileSelect}
                          onMultipleFilesSelect={handleMultipleFilesSelect}
                          multiple={docType === 'SPLIT'}
                          disabled={docType === 'SPLIT' && !directoryInfo}
                        />
                      </div>
                      <div className="text-xs text-slate-600 flex items-center gap-2">
                        <span className="inline-flex w-2 h-2 rounded-full bg-blue-500"></span>
                        {directoryInfo
                          ? 'Sẵn sàng nhận file PDF – chọn file để bắt đầu tách.'
                          : 'Vui lòng chọn thư mục lưu kết quả trước khi upload file.'}
                      </div>
                    </div>
                    
                    {docType === 'SPLIT' && (
                      <div className="lg:col-span-2 glass-strong rounded-2xl p-4 md:p-6">
                        <JobQueueViewer onReset={handleReset} />
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* Show JobQueueViewer when processing in SPLIT mode */}
              {status === ProcessingStatus.ANALYZING && docType === 'SPLIT' && (
                <div className="w-full max-w-4xl">
                  <JobQueueViewer onReset={handleReset} />
                </div>
              )}

              {(status === ProcessingStatus.CONVERTING || status === ProcessingStatus.ANALYZING) && docType !== 'SPLIT' && (
                <div className="text-center animate-in fade-in zoom-in duration-300 glass-strong p-8 rounded-2xl">
                  <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-6 border-white/30 border-t-white"></div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {status === ProcessingStatus.CONVERTING ? 'Đang đọc tài liệu...' : 'Đang xử lý dữ liệu...'}
                  </h3>
                  <p className="text-white/70">
                    Vishipel TOOL đang phân tích văn bản...
                  </p>
                </div>
              )}

              {status === ProcessingStatus.ERROR && (
                <div className="max-w-md w-full mt-6 p-6 glass-strong border border-red-400/30 rounded-xl text-center animate-in shake">
                  <div className="w-12 h-12 bg-red-500/20 text-red-300 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Xử lý thất bại</h3>
                  <p className="text-white/70 mb-6">{errorMsg}</p>
                  <button onClick={handleReset} className="px-6 py-2 glass-light hover:bg-white/20 text-white rounded-lg transition-colors font-semibold">
                    Thử lại
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SUCCESS STATE */}
          {status === ProcessingStatus.SUCCESS && reportData && (
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-6">

              {/* Left Pane: PDF Preview (Simplified for Splitter, Full for others) */}
              <div className="lg:w-1/2 h-[40vh] lg:h-full glass-strong overflow-auto p-4 md:p-8 rounded-2xl relative scrollbar-thin">
                {previewUrls.length > 0 ? (
                  <div className="flex flex-col gap-4 items-center">
                    {previewUrls.map((url, idx) => (
                      <div key={idx} className="relative shadow-xl ring-1 ring-white/20 group w-full max-w-[520px] glass rounded-lg overflow-hidden">
                        <img src={url} alt={`Page ${idx + 1}`} className="w-full h-auto" />
                        <div className="absolute top-4 left-4 glass-strong text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-white/30 flex items-center gap-1">
                          <Layers size={12} />
                          TRANG {idx + 1} {docType === 'SPLIT' && idx === 0 ? '(Trang đầu)' : ''}
                        </div>
                      </div>
                    ))}
                    {docType === 'SPLIT' && (
                      <div className="text-white/60 text-sm italic">
                        (Chỉ hiển thị trang đầu để tối ưu hiệu năng)
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-white/60 flex flex-col items-center mt-20">
                    <Eye size={48} className="mb-4 opacity-50" />
                    <p>Không có bản xem trước</p>
                  </div>
                )}
              </div>

              {/* Right Pane: Document Viewer */}
              <div className="lg:w-1/2 h-[60vh] lg:h-full overflow-hidden relative glass-strong rounded-2xl">
                {docType === 'INVOICE' && <InvoiceViewer data={reportData as any} />}
                {docType === 'INCIDENT' && <IncidentViewer data={reportData as any} />}
                {docType === 'SPLIT' && <SplitterViewer data={reportData as any} />}
              </div>
            </div>
          )}
        </main>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
