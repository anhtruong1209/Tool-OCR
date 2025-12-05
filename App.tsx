
import React, { useState, useCallback, useRef } from 'react';
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
import { AlertCircle, BrainCircuit, Eye, FileText, Anchor, Layers, Scissors, FolderOpen, ShieldCheck } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col overflow-hidden relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none" style={{
        backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
        backgroundSize: '18px 18px'
      }}></div>

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 h-12 shrink-0 z-30 shadow-md relative">
        <div className="w-full px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-1.5 rounded-lg text-white shadow-inner">
              <BrainCircuit size={18} strokeWidth={2.5} />
            </div>
            <h1 className="font-semibold text-base text-white tracking-tight hidden md:block">
              Vishipel AI <span className="opacity-30 font-light mx-2">|</span>
              <span className="text-blue-300 font-medium text-xs">
                {docType === 'INVOICE' && 'Xử lý Hóa đơn GTGT'}
                {docType === 'INCIDENT' && 'Xử lý Báo cáo Sự cố'}
                {docType === 'SPLIT' && 'Bộ Tách PDF Tự Động'}
              </span>
            </h1>
            <h1 className="font-semibold text-base text-white md:hidden">Vishipel AI</h1>
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
      <main className="flex-grow flex flex-col h-[calc(100vh-3rem)] relative z-10">

        {/* IDLE & PROCESSING STATES */}
        {status !== ProcessingStatus.SUCCESS && (
          <div className="flex-grow flex flex-col items-center justify-start p-4 md:p-6 overflow-y-auto">

            {status === ProcessingStatus.IDLE && (
              <div className="w-full max-w-5xl mx-auto space-y-6">
                <section className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700 bg-white/90 backdrop-blur-sm p-5 md:p-6 rounded-2xl shadow-md border border-slate-100">
                  <div className="mx-auto max-w-2xl">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400 mb-2">Vishipel AI</p>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
                      Bộ Tách PDF Tự Động
                    </h2>
                    <p className="text-slate-600 mb-4 text-sm">
                      Kéo thả các file PDF nguồn, chọn thư mục lưu và để hệ thống tự động cắt nhỏ theo cấu trúc nghiệp vụ.
                    </p>
                  </div>

                  {/* Document Type Selector */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    {/*
                            <button ...>...</button>
                            <button ...>...</button>
                            */}
                    <button
                      onClick={() => setDocType('SPLIT')}
                      className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${docType === 'SPLIT'
                        ? 'border-purple-500 bg-gradient-to-br from-purple-50 via-white to-purple-100 text-purple-800 shadow-sm ring-1 ring-purple-200'
                        : 'border-slate-200 bg-white hover:border-purple-300 text-slate-600'
                        }`}
                    >
                      <div className={`p-3 rounded-2xl ${docType === 'SPLIT' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                        <Scissors className="w-7 h-7" />
                      </div>
                      <span className="font-semibold text-base">Tách File PDF</span>
                      <span className="text-xs text-slate-400 font-normal text-center">Cắt file tự động theo nghiệp vụ</span>
                    </button>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] items-start">
                  <div className="rounded-2xl bg-white shadow-md border border-slate-100 p-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-2 text-left">
                      <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Bước 1: Chọn thư mục</p>
                      <h3 className="text-xl font-semibold text-slate-900">Chọn thư mục lưu kết quả</h3>
                      <p className="text-sm text-slate-500">Chọn thư mục đích trước khi tải file PDF lên.</p>
                    </div>
                    <button
                      onClick={handleSelectDestinationFolder}
                      className="w-full px-5 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3 text-sm"
                    >
                      <FolderOpen size={20} />
                      {directoryInfo ? `Đã chọn: ${directoryInfo.name}` : 'Chọn thư mục lưu file'}
                    </button>
                    {directoryInfo && (
                      <div className="text-xs md:text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        ✓ Thư mục "{directoryInfo.name}" đã được chọn. Bạn có thể upload file PDF bên dưới.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl bg-white shadow-md border border-slate-100 p-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-2 text-left">
                      <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Bước 2: Upload</p>
                      <h3 className="text-xl font-semibold text-slate-900">Tải lên file PDF</h3>
                      <p className="text-sm text-slate-500">Hỗ trợ kéo thả hoặc chọn từ máy tính (tối đa 10MB cho mỗi file).</p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-dashed border-slate-200">
                      <UploadArea
                        onFileSelect={handleFileSelect}
                        onMultipleFilesSelect={handleMultipleFilesSelect}
                        multiple={docType === 'SPLIT'}
                        disabled={docType === 'SPLIT' && !directoryInfo}
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span className="inline-flex w-2 h-2 rounded-full bg-slate-300"></span>
                      {directoryInfo
                        ? 'Sẵn sàng nhận file PDF – chọn file để bắt đầu tách.'
                        : 'Vui lòng chọn thư mục lưu kết quả trước khi upload file.'}
                    </div>
                  </div>

                  {docType === 'SPLIT' && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white shadow-md border border-white/10 text-left min-h-[180px] flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="bg-white/15 p-2 rounded-xl">
                            <FolderOpen size={20} />
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Hướng dẫn</p>
                            <h3 className="text-base font-semibold">Thư mục lưu kết quả</h3>
                          </div>
                        </div>
                        <p className="text-sm text-white/80 mb-3 flex-1">
                          {directoryInfo
                            ? `Hệ thống đã ghi nhớ thư mục "${directoryInfo.name}". Mở File Explorer và truy cập thư mục này để theo dõi file vừa tách.`
                            : 'Ngay khi chọn thư mục lưu, ứng dụng sẽ ghi nhớ và hiển thị hướng dẫn cụ thể tại đây.'}
                        </p>
                        <ul className="text-xs md:text-sm text-white/80 space-y-1.5 list-disc pl-5">
                          <li>Tìm thư mục vừa chọn trong phần Quick Access.</li>
                          <li>File được gom vào thư mục con trùng tên từ khóa.</li>
                          <li>Giữ tab mở để hệ thống tiếp tục ghi file.</li>
                        </ul>
                      </div>
                      <div className="p-4 rounded-2xl bg-white shadow-md border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-slate-100 p-2 rounded-xl">
                              <ShieldCheck size={20} className="text-slate-500" />
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Quyền truy cập</p>
                              <h3 className="text-base font-semibold text-slate-900">Chỉnh sửa thư mục</h3>
                            </div>
                          </div>
                          <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${permissionBadgeClass}`}>
                            {permissionBadgeLabel}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-4">
                          {permissionHelperText}
                        </p>
                        <button
                          onClick={handleRequestEditPermission}
                          disabled={!dirHandleRef.current}
                          className={`w-full px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${dirHandleRef.current
                            ? 'bg-slate-900 text-white hover:bg-slate-800'
                            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            }`}
                        >
                          Cấp quyền chỉnh sửa thư mục
                        </button>
                        {directoryInfo?.permission === 'denied' && (
                          <p className="text-xs text-rose-500 mt-3">
                            Trình duyệt đã từ chối quyền. Nhấn lại nút trên và chấp nhận pop-up để tiếp tục lưu file tự động.
                          </p>
                        )}
                        {directoryInfo?.permission === 'granted' && (
                          <p className="text-xs text-emerald-600 mt-3">
                            Bạn có thể truy cập thư mục "{directoryInfo.name}" bất cứ lúc nào để kiểm tra tiến độ tách file.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {docType === 'SPLIT' && (
                    <div className="lg:col-span-2 bg-white/80 border border-slate-100 rounded-2xl shadow-md p-3 md:p-4">
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
                <div className="flex flex-col gap-4 items-center">
                  {previewUrls.map((url, idx) => (
                    <div key={idx} className="relative shadow-xl ring-1 ring-white/10 group w-full max-w-[520px]">
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
