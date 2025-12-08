import React, { useState, useEffect } from 'react';
import { jobQueue, Job } from '../services/jobQueue';
import { syncFilesToDestination } from '../services/fileSync';
import { CheckCircle, XCircle, Loader2, Download, Trash2, FileText, Sparkles, Zap, Clock, RefreshCw, FolderSync, Eye } from 'lucide-react';

const TIPS = [
  "💡 Hệ thống đang quét mã số trên từng trang PDF...",
  "🔍 Đang phân tích và nhận diện chữ ký...",
  "📦 Đang tách file...",
  "⚡ Tối ưu hóa để tránh giới hạn API...",
  "🎯 Phát hiện và tách các trang LOG tự động...",
];

interface JobQueueViewerProps {
  onReset?: () => void;
}

export const JobQueueViewer: React.FC<JobQueueViewerProps> = ({ onReset }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentTip, setCurrentTip] = useState(0);
  const [processingJob, setProcessingJob] = useState<Job | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [syncingJobs, setSyncingJobs] = useState<Set<string>>(new Set());
  const [syncedJobs, setSyncedJobs] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [previewJob, setPreviewJob] = useState<Job | null>(null);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewOriginalUrl, setPreviewOriginalUrl] = useState<string | null>(null);
  const [selectedDocIndex, setSelectedDocIndex] = useState<number>(0);

  useEffect(() => {
    // Subscribe to job updates
    const unsubscribe = jobQueue.subscribe((updatedJobs) => {
      setJobs(updatedJobs);
      // Find currently processing job
      const processing = updatedJobs.find(j => j.status === 'processing');
      setProcessingJob(processing || null);
    });

    // Initial load
    setJobs(jobQueue.getJobs());
    const processing = jobQueue.getJobs().find(j => j.status === 'processing');
    setProcessingJob(processing || null);

    return unsubscribe;
  }, []);

  // Rotate tips every 3 seconds
  useEffect(() => {
    if (!processingJob) return;
    
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % TIPS.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [processingJob]);

  // Timer for processing job
  useEffect(() => {
    if (!processingJob || processingJob.status !== 'processing') {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      if (processingJob.startTime) {
        setElapsedTime(Math.floor((Date.now() - processingJob.startTime) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [processingJob]);

  const handleDownload = (job: Job) => {
    if (!job.result?.zipBlob) return;
    
    const url = URL.createObjectURL(job.result.zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${job.file.name.replace('.pdf', '')}_split.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRemove = (jobId: string) => {
    jobQueue.removeJob(jobId);
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (previewDocUrl) URL.revokeObjectURL(previewDocUrl);
      if (previewOriginalUrl) URL.revokeObjectURL(previewOriginalUrl);
    };
  }, [previewDocUrl, previewOriginalUrl]);

  const openPreview = async (job: Job) => {
    // release old urls
    if (previewDocUrl) URL.revokeObjectURL(previewDocUrl);
    if (previewOriginalUrl) URL.revokeObjectURL(previewOriginalUrl);

    // original PDF url
    const origUrl = URL.createObjectURL(job.file);
    setPreviewOriginalUrl(origUrl);
    setPreviewJob(job);
    setSelectedDocIndex(0);

    // load first doc url
    await loadDocUrl(job, 0);
  };

  const loadDocUrl = async (job: Job, index: number) => {
    if (!job.rootDirHandle || !job.result) return;
    const summary = job.result.extractionSummary;
    const docs = summary?.documents || job.result.documents || [];
    const doc = docs[index];
    if (!doc || !doc.filename) return;

    try {
      const pathParts = (job.result.extractionFolderPath || '').split('/').filter(Boolean);
      pathParts.push('PDFS');
      let current = job.rootDirHandle;
      for (const part of pathParts) {
        current = await current.getDirectoryHandle(part, { create: false });
      }
      const fileHandle = await current.getFileHandle(doc.filename, { create: false });
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);
      if (previewDocUrl) URL.revokeObjectURL(previewDocUrl);
      setPreviewDocUrl(url);
    } catch (e) {
      console.error('Preview load error', e);
      showToast('error', 'Không đọc được file đã cắt (cần mở cùng thư mục gốc đã chọn)');
    }
  };

  const docsOfPreview = previewJob
    ? (previewJob.result?.extractionSummary?.documents || previewJob.result?.documents || [])
    : [];

  const syncJob = async (job: Job, quiet = false): Promise<boolean> => {
    if (syncingJobs.has(job.id)) return false;
    if (!job.rootDirHandle) {
      if (!quiet) showToast('error', 'Không tìm thấy folder đích. Vui lòng thử lại.');
      return false;
    }

    setSyncingJobs(prev => new Set(prev).add(job.id));
    try {
      const result = await syncFilesToDestination(
        job.rootDirHandle,
        job.file.name,
        job.rootDirHandle
      );

      setSyncedJobs(prev => new Set(prev).add(job.id));

      if (!quiet) {
        if (result.failed > 0) {
          showToast(
            'error',
            `Đồng bộ xong nhưng có lỗi: ✅ ${result.success} • ❌ ${result.failed}`
          );
        } else {
          showToast('success', `Đồng bộ thành công ${result.success} file vào "${job.rootDirHandle.name}"`);
        }
      }
      return result.failed === 0;
    } catch (error: any) {
      console.error('[JobQueueViewer] Error syncing files:', error);
      if (!quiet) showToast('error', `Lỗi đồng bộ: ${error.message}`);
      return false;
    } finally {
      setSyncingJobs(prev => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  };

  const handleSyncToFolder = async (job: Job) => {
    await syncJob(job, false);
  };

  const handleSyncAll = async () => {
    const targets = jobs.filter(j => j.status === 'completed' && !syncedJobs.has(j.id));
    if (targets.length === 0) {
      showToast('success', 'Tất cả file đã đồng bộ');
      return;
    }
    let successCount = 0;
    let failCount = 0;
    for (const job of targets) {
      const ok = await syncJob(job, true);
      if (ok) successCount += 1;
      else failCount += 1;
    }
    if (failCount === 0) {
      showToast('success', `Đồng bộ xong ${successCount} file`);
    } else {
      showToast('error', `Đồng bộ xong: ✅ ${successCount} • ❌ ${failCount}`);
    }
  };

  const handleClearCompleted = () => {
    jobQueue.clearCompleted();
  };

  const handleReset = () => {
    jobQueue.clear();
    if (onReset) {
      onReset();
    }
  };

  const formatTime = (ms: number | undefined): string => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const getStatusIcon = (status: Job['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />;
      default:
        return <FileText className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusText = (status: Job['status']): string => {
    switch (status) {
      case 'completed':
        return 'Hoàn thành';
      case 'error':
        return 'Lỗi';
      case 'processing':
        return 'Đang xử lý...';
      default:
        return 'Chờ xử lý';
    }
  };

  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const errorCount = jobs.filter(j => j.status === 'error').length;
  const processingCount = jobs.filter(j => j.status === 'processing').length;
  const pendingCount = jobs.filter(j => j.status === 'pending').length;

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show empty state if no jobs
  if (jobs.length === 0) {
    return (
      <div className="glass-strong rounded-xl p-6 mb-6 border border-white/20">
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-white/40 mx-auto mb-3" />
          <p className="text-slate-900/80 font-medium">Chưa có file nào được thêm vào</p>
          <p className="text-sm text-dark/60 mt-1">Kéo thả hoặc chọn file PDF để bắt đầu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl border ${
          toast.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        </div>
      )}
      {/* File List - Show all files immediately */}
        <div className="glass-strong rounded-xl p-6 border border-white/20">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-bold text-dark">Danh sách file</h3>
            <p className="text-sm text-dark/70">
              Tổng: {jobs.length} file • {completedCount} hoàn thành • {processingCount} đang xử lý • {pendingCount} chờ
            </p>
          </div>
          {processingJob && (
            <div className="flex items-center gap-2 glass bg-dark/20 px-4 py-2 rounded-lg border border-dark/30">
              <Clock className="w-4 h-4 text-dark" />
              <span className="text-sm font-bold text-dark">{formatTimer(elapsedTime)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncAll}
              disabled={syncingJobs.size > 0}
              className={`px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-semibold text-sm border ${
                syncingJobs.size > 0
                  ? 'glass-light bg-dark/10 text-dark/50 cursor-not-allowed border-dark/10'
                  : 'glass bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-transparent'
              }`}
            >
              {syncingJobs.size > 0 ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang đồng bộ...
                </>
              ) : (
                <>
                  <FolderSync className="w-4 h-4" />
                  Đồng bộ tất cả
                </>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
          {jobs.map((job, index) => (
            <div
              key={job.id}
              className={`p-4 rounded-lg border-2 transition-all ${
                job.status === 'completed'
                  ? 'border-green-400/30 bg-green-500/20 glass-light'
                  : job.status === 'error'
                  ? 'border-red-400/30 bg-red-500/20 glass-light'
                  : job.status === 'processing'
                  ? 'border-orange-400/30 bg-orange-500/20 glass-light'
                  : 'border-dark/20 bg-dark/5 glass-light'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold text-dark/60 glass bg-dark/10 px-2 py-1 rounded border border-dark/20">
                      #{index + 1}
                    </span>
                    {getStatusIcon(job.status)}
                    <span className="font-semibold text-dark truncate flex-1">
                      {job.file.name}
                    </span>
                    {job.status === 'processing' && (
                      <span className="text-xs glass bg-dark/20 text-dark px-2 py-1 rounded-full font-semibold shrink-0 border border-dark/30">
                        {job.progress}%
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-dark/70 mb-2">
                    <span className="font-medium">{getStatusText(job.status)}</span>
                    {job.startTime && job.status === 'processing' && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimer(Math.floor((Date.now() - job.startTime) / 1000))}
                      </span>
                    )}
                    {job.endTime && job.startTime && (
                      <span className="text-dark">
                        Hoàn thành sau {formatTimer(Math.floor((job.endTime - job.startTime) / 1000))}
                      </span>
                    )}
                  </div>

                  {job.error && (
                    <p className="text-xs text-dark mt-1">{job.error}</p>
                  )}

                  {job.status === 'processing' && (
                    <div className="mt-2 w-full glass bg-dark/10 rounded-full h-2 overflow-hidden border border-dark/20">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-orange-500 h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}

                  {job.status === 'pending' && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-dark/60">
                      <Clock className="w-3 h-3" />
                      <span>Đang chờ đến lượt...</span>
                    </div>
                  )}

                  {job.status === 'completed' && job.result?.documents && (
                    <div className="mt-2 text-xs text-dark font-medium">
                      ✓ Đã tách thành {job.result.documents.length} file
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {job.status === 'completed' && (
                    <>
                      {job.result?.zipBlob && (
                        <button
                          onClick={() => handleDownload(job)}
                          className="px-4 py-2 glass bg-dark/30 hover:bg-dark/40 text-dark rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-semibold text-sm border border-dark/30"
                          title="Tải xuống"
                        >
                          <Download className="w-4 h-4" />
                          Tải ZIP
                        </button>
                      )}
                      <button
                        onClick={() => handleSyncToFolder(job)}
                        disabled={syncingJobs.has(job.id)}
                        className={`px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-semibold text-sm border ${
                          syncingJobs.has(job.id)
                            ? 'glass-light bg-dark/10 text-dark/50 cursor-not-allowed border-dark/10'
                            : syncedJobs.has(job.id)
                              ? 'glass bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'glass bg-dark/30 hover:bg-dark/40 text-dark border-dark/30'
                        }`}
                        title="Đồng bộ vào folder"
                      >
                        {syncingJobs.has(job.id) ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Đang đồng bộ...
                          </>
                        ) : syncedJobs.has(job.id) ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Đã đồng bộ
                          </>
                        ) : (
                          <>
                            <FolderSync className="w-4 h-4" />
                            Đồng bộ vào folder
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => openPreview(job)}
                        className="px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-semibold text-sm border glass bg-dark/20 hover:bg-dark/30 text-dark border-dark/30"
                        title="Xem so sánh gốc / đã cắt"
                      >
                        <Eye className="w-4 h-4" />
                        So sánh
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleRemove(job.id)}
                    className="p-2 text-dark/50 hover:text-dark hover:bg-dark/20 rounded-lg transition-colors border border-transparent hover:border-dark/30"
                    title="Xóa"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Processing Status with Tips */}
      {processingJob && (
        <div className="glass-strong rounded-xl border-2 border-orange-400/30 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-dark animate-spin" />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-dark">
                <Sparkles className="w-4 h-4 text-orange-300 animate-pulse" />
                <span className="animate-in fade-in duration-500">{TIPS[currentTip]}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        {completedCount + errorCount > 0 && (
          <button
            onClick={handleClearCompleted}
            className="text-sm text-dark/70 hover:text-dark flex items-center gap-2 px-4 py-2 rounded-lg glass-light hover:bg-dark/10 transition-colors border border-dark/20"
          >
            <Trash2 className="w-4 h-4" />
            Xóa đã hoàn thành
          </button>
        )}
        {jobs.length > 0 && (
          <button
            onClick={handleReset}
              className="text-sm text-dark glass bg-dark/30 hover:bg-dark/40 flex items-center gap-2 px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg font-semibold border border-dark/30"
          >
            <RefreshCw className="w-4 h-4" />
            Tải lại / Upload mới
          </button>
        )}
      </div>

      {previewJob && (
        <PreviewModal
          job={previewJob}
          docs={docsOfPreview}
          selectedIndex={selectedDocIndex}
          onSelect={(idx) => {
            setSelectedDocIndex(idx);
            loadDocUrl(previewJob, idx);
          }}
          docUrl={previewDocUrl}
          originalUrl={previewOriginalUrl}
          onClose={() => {
            setPreviewJob(null);
            setPreviewDocUrl(null);
            setPreviewOriginalUrl(null);
          }}
        />
      )}
    </div>
  );
};

// Modal/Panel for preview (simple overlay)
const PreviewModal: React.FC<{
  job: Job;
  docs: any[];
  selectedIndex: number;
  onSelect: (idx: number) => void;
  docUrl: string | null;
  originalUrl: string | null;
  onClose: () => void;
}> = ({ job, docs, selectedIndex, onSelect, docUrl, originalUrl, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="text-lg font-bold text-slate-900">So sánh PDF gốc / đã cắt</h3>
            <p className="text-xs text-slate-500 truncate">
              {job.file.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm"
          >
            Đóng
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: original */}
          <div className="w-1/2 border-r flex flex-col">
            <div className="px-3 py-2 border-b bg-slate-50 text-sm font-semibold text-slate-700">
              PDF gốc
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center">
              {originalUrl ? (
                <iframe src={originalUrl} title="original" className="w-full h-full" />
              ) : (
                <p className="text-sm text-slate-500">Không thể tải PDF gốc</p>
              )}
            </div>
          </div>

          {/* Right: split list + viewer */}
          <div className="w-1/2 flex flex-col">
            <div className="px-3 py-2 border-b bg-slate-50 text-sm font-semibold text-slate-700">
              File đã cắt
            </div>
            <div className="flex-1 grid grid-cols-3 min-h-0">
              <div className="border-r overflow-auto bg-white">
                {docs.map((d, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelect(idx)}
                    className={`w-full text-left px-3 py-2 border-b hover:bg-slate-50 text-sm ${
                      idx === selectedIndex ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="font-semibold text-slate-800 truncate">{d.filename || d.code || `Doc ${idx + 1}`}</div>
                    <div className="text-xs text-slate-500">
                      {d.startPage ? `Trang ${d.startPage}-${d.endPage}` : ''}
                    </div>
                  </button>
                ))}
              </div>
              <div className="col-span-2 bg-slate-100 flex items-center justify-center overflow-auto">
                {docUrl ? (
                  <iframe src={docUrl} title="split" className="w-full h-full" />
                ) : (
                  <p className="text-sm text-slate-500 px-4">Chọn file để xem</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

