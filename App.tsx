
import React, { useState, useCallback, useRef } from 'react';
// Services
import { convertPdfToImage } from './services/pdfUtils';
import { detectFormCodes } from './services/geminiScanner.ts';
import { UploadArea } from './components/UploadArea';
import { SimpleFormViewer } from './components/SimpleFormViewer';
import { DocumentationViewer } from './components/DocumentationViewer';
import { DocumentData, ProcessingStatus } from './types';
import { requestDirectoryPicker } from './services/fileSaver';
import { Eye, Layers, FolderOpen, BookOpen, Scan, Layout, ShieldCheck } from 'lucide-react';
import { DirectoryTree } from './components/DirectoryTree';

type HandlePermissionState = 'prompt' | 'granted' | 'denied';

const permissionMeta: Record<HandlePermissionState, { label: string; className: string; helper: string }> = {
  granted: {
    label: 'Đã cấp quyền',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    helper: 'Ứng dụng có thể ghi file trực tiếp.',
  },
  prompt: {
    label: 'Chờ cấp quyền',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
    helper: 'Nhấn nút để cho phép ghi file.',
  },
  denied: {
    label: 'Đã từ chối',
    className: 'bg-rose-50 text-rose-600 border border-rose-200',
    helper: 'Vui lòng cấp lại quyền ghi file.',
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
  const [showDocs, setShowDocs] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reportData, setReportData] = useState<DocumentData | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [directoryInfo, setDirectoryInfo] = useState<{ name: string; permission: HandlePermissionState } | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  const currentPermission = directoryInfo?.permission ?? 'prompt';
  const permissionBadgeLabel = directoryInfo ? permissionMeta[currentPermission].label : 'Chưa chọn thư mục';
  const permissionBadgeClass = directoryInfo ? permissionMeta[currentPermission].className : 'bg-slate-100 text-slate-500 border border-slate-200';

  const syncDirectoryHandle = useCallback(async (handle: FileSystemDirectoryHandle) => {
    dirHandleRef.current = handle;
    const permission = await queryDirPermission(handle);
    setDirectoryInfo({ name: handle.name, permission });
  }, []);

  const handleRequestEditPermission = useCallback(async () => {
    if (!dirHandleRef.current) return;
    try {
      const permission = await requestDirPermission(dirHandleRef.current);
      setDirectoryInfo({ name: dirHandleRef.current.name, permission });
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi cấp quyền.');
    }
  }, []);

  const handleSelectDestinationFolder = useCallback(async () => {
    try {
      const handle = await requestDirectoryPicker();
      if (handle) {
        await syncDirectoryHandle(handle);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setErrorMsg('Lỗi truy cập thư mục.');
    }
  }, [syncDirectoryHandle]);

  const handleFileSelect = useCallback(async (file: File) => {
    setFileName(file.name);
    setOriginalFile(file);
    setReportData(null);
    setErrorMsg(null);
    setStatus(ProcessingStatus.CONVERTING);

    try {
      const base64Images = await convertPdfToImage(file, -1);
      setPreviewUrls(base64Images.map(img => `data:image/jpeg;base64,${img}`));

      setStatus(ProcessingStatus.ANALYZING);
      const result = await detectFormCodes(base64Images);
      setReportData(result);
      setStatus(ProcessingStatus.SUCCESS);
    } catch (err: any) {
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg(err.message || 'Lỗi xử lý file.');
    }
  }, []);

  const handleReset = () => {
    setReportData(null);
    setStatus(ProcessingStatus.IDLE);
    setPreviewUrls([]);
    setFileName('');
    setErrorMsg(null);
  };

  return (
    <div className="flex bg-[#F8FAFC] min-h-screen text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-950 border-r border-white/5 flex flex-col shrink-0 z-40">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Scan className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Vishipel AI</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">v2.0 Beta</p>
            </div>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => { setShowDocs(false); handleReset(); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${!showDocs ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <Layout size={18} />
              <span className="font-bold text-sm">Phân loại & Tách PDF</span>
            </button>
            <button
              onClick={() => setShowDocs(true)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${showDocs ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <BookOpen size={18} />
              <span className="font-bold text-sm">Hướng dẫn sử dụng</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 shrink-0 z-30 flex items-center justify-between px-10">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
            Hệ thống Phân loại Biểu mẫu Thông minh
          </h2>
          {status === ProcessingStatus.SUCCESS && (
            <button onClick={handleReset} className="text-xs font-black text-blue-600 hover:underline px-4 py-2">
              UPLOAD FILE KHÁC
            </button>
          )}
        </header>

        <main className="flex-1 flex flex-col overflow-hidden p-10">
          {showDocs ? (
            <DocumentationViewer />
          ) : status === ProcessingStatus.IDLE ? (
            <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full space-y-12 animate-in fade-in zoom-in duration-500">
              <div className="text-center space-y-4">
                <h3 className="text-5xl font-black text-slate-900 tracking-tight">Cắt nhỏ PDF tự động</h3>
                <p className="text-lg text-slate-500 max-w-2xl font-medium">Hệ thống AI tự động phân tách tài liệu nghiệp vụ hàng hải vào đúng các thư mục lưu trữ theo quy trình.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8 w-full">
                <div className="bg-white rounded-[2rem] p-10 border border-slate-200 shadow-2xl shadow-slate-200/50 space-y-8">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Thiết lập 01</span>
                    <h4 className="text-2xl font-black text-slate-900 leading-tight">Chọn Thư mục Gốc</h4>
                  </div>
                  <button onClick={handleSelectDestinationFolder} className="w-full py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black transition-all flex items-center justify-center gap-3 text-sm">
                    <FolderOpen size={20} />
                    {directoryInfo ? directoryInfo.name : 'CHỌN THƯ MỤC LƯU FILE'}
                  </button>
                  {directoryInfo && (
                    <div className={`p-5 rounded-2xl space-y-2 ${permissionBadgeClass}`}>
                      <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-wider">
                        <ShieldCheck size={14} /> {permissionBadgeLabel}
                      </div>
                      {directoryInfo.permission !== 'granted' && (
                        <button onClick={handleRequestEditPermission} className="text-[10px] font-black underline uppercase tracking-tighter hover:text-slate-900">NHẤN ĐỂ CẤP QUYỀN GHI FILE</button>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-[2rem] p-10 border border-slate-200 shadow-2xl shadow-slate-200/50 space-y-8">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Thiết lập 02</span>
                    <h4 className="text-2xl font-black text-slate-900 leading-tight">Tải PDF Lên</h4>
                  </div>
                  <div className="flex-1 min-h-[160px] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-4 flex items-center justify-center">
                    <UploadArea onFileSelect={handleFileSelect} multiple={false} disabled={!directoryInfo || directoryInfo.permission !== 'granted'} />
                  </div>
                </div>
              </div>
            </div>
          ) : status === ProcessingStatus.SUCCESS && reportData ? (
            <div className="flex-1 flex gap-6 overflow-hidden">
              {/* Column 1: Review PDF (Scrollable) */}
              <div className="flex-1 shrink-0 bg-slate-100/50 rounded-[2rem] border border-slate-200 shadow-inner overflow-auto p-8 scrollbar-thin">
                <div className="flex items-center gap-2 mb-6 sticky top-0 bg-slate-100/90 backdrop-blur-sm p-4 rounded-xl z-10 border border-slate-200/50">
                  <Layers className="text-blue-600" size={18} />
                  <h3 className="font-bold text-slate-700 text-sm uppercase">Tài liệu gốc</h3>
                </div>
                <div className="flex flex-col gap-6 items-center">
                  {previewUrls.map((url, idx) => (
                    <div key={idx} className="relative group w-full">
                      <img src={url} alt={`Trang ${idx + 1}`} className="w-full rounded-xl shadow-lg ring-1 ring-black/5" />
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur text-slate-900 px-3 py-1.5 rounded-lg text-[10px] font-black border border-slate-200 shadow-sm">
                        TRANG {idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: Classification Result (SimpleFormViewer) */}
              <div className="flex-1 shrink-0 bg-white rounded-[2rem] border border-slate-200 shadow-lg overflow-hidden">
                <SimpleFormViewer
                  data={reportData}
                  originalFile={originalFile}
                  dirHandle={dirHandleRef.current}
                />
              </div>

              {/* Column 3: Directory Tree (DirectoryTree) */}
              <div className="flex-1 shrink-0 bg-white rounded-[2rem] border border-slate-200 shadow-lg overflow-hidden">
                <DirectoryTree
                  data={reportData}
                  originalFileName={fileName}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-6">
              <div className="w-16 h-16 border-[6px] border-blue-600/10 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="text-center">
                <h3 className="text-xl font-black text-slate-900 italic tracking-tighter">VISHIPEL AI TRÍ TUỆ NHÂN TẠO</h3>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1 animate-pulse">Đang giải mã và phân tích tài liệu...</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
