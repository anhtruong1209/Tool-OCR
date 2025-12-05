import React, { useState, useEffect } from 'react';
import { jobQueue, Job } from '../services/jobQueue';
import { syncFilesToDestination } from '../services/fileSync';
import { requestDirectoryPicker } from '../services/fileSaver';
import { CheckCircle, XCircle, Loader2, Download, Trash2, FileText, Sparkles, Zap, Clock, RefreshCw, FolderSync } from 'lucide-react';

const TIPS = [
  "💡 Hệ thống đang quét mã số trên từng trang PDF...",
  "🔍 Đang phân tích và nhận diện chữ ký...",
  "📦 Đang tách file và tạo ZIP...",
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

  const handleSyncToFolder = async (job: Job) => {
    if (syncingJobs.has(job.id)) return; // Đang sync, bỏ qua
    
    try {
      setSyncingJobs(prev => new Set(prev).add(job.id));
      
      // Yêu cầu chọn folder đích
      const destinationHandle = await requestDirectoryPicker();
      if (!destinationHandle) {
        throw new Error('Vui lòng chọn folder đích để đồng bộ file.');
      }

      // Đồng bộ file từ TEMP_EXTRACT vào folder đích
      const result = await syncFilesToDestination(
        job.rootDirHandle,
        job.file.name,
        destinationHandle
      );

      if (result.failed > 0) {
        alert(`Đồng bộ hoàn tất với một số lỗi:\n- Thành công: ${result.success} file\n- Thất bại: ${result.failed} file\n\nLỗi:\n${result.errors.join('\n')}`);
      } else {
        alert(`Đồng bộ thành công ${result.success} file vào folder "${destinationHandle.name}"!`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // User cancelled folder picker
        return;
      }
      console.error('[JobQueueViewer] Error syncing files:', error);
      alert(`Lỗi khi đồng bộ file: ${error.message}`);
    } finally {
      setSyncingJobs(prev => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
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
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
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
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 mb-6">
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Chưa có file nào được thêm vào</p>
          <p className="text-sm text-slate-400 mt-1">Kéo thả hoặc chọn file PDF để bắt đầu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {/* File List - Show all files immediately */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Danh sách file</h3>
            <p className="text-sm text-slate-500">
              Tổng: {jobs.length} file • {completedCount} hoàn thành • {processingCount} đang xử lý • {pendingCount} chờ
            </p>
          </div>
          {processingJob && (
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-bold text-blue-700">{formatTimer(elapsedTime)}</span>
            </div>
          )}
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {jobs.map((job, index) => (
            <div
              key={job.id}
              className={`p-4 rounded-lg border-2 transition-all ${
                job.status === 'completed'
                  ? 'border-green-200 bg-green-50'
                  : job.status === 'error'
                  ? 'border-red-200 bg-red-50'
                  : job.status === 'processing'
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-1 rounded">
                      #{index + 1}
                    </span>
                    {getStatusIcon(job.status)}
                    <span className="font-semibold text-slate-800 truncate flex-1">
                      {job.file.name}
                    </span>
                    {job.status === 'processing' && (
                      <span className="text-xs bg-blue-200 text-blue-700 px-2 py-1 rounded-full font-semibold shrink-0">
                        {job.progress}%
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-slate-600 mb-2">
                    <span className="font-medium">{getStatusText(job.status)}</span>
                    {job.startTime && job.status === 'processing' && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimer(Math.floor((Date.now() - job.startTime) / 1000))}
                      </span>
                    )}
                    {job.endTime && job.startTime && (
                      <span className="text-green-600">
                        Hoàn thành sau {formatTimer(Math.floor((job.endTime - job.startTime) / 1000))}
                      </span>
                    )}
                  </div>

                  {job.error && (
                    <p className="text-xs text-red-600 mt-1">{job.error}</p>
                  )}

                  {job.status === 'processing' && (
                    <div className="mt-2 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}

                  {job.status === 'pending' && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>Đang chờ đến lượt...</span>
                    </div>
                  )}

                  {job.status === 'completed' && job.result?.documents && (
                    <div className="mt-2 text-xs text-green-600 font-medium">
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
                          className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-semibold text-sm"
                          title="Tải xuống"
                        >
                          <Download className="w-4 h-4" />
                          Tải ZIP
                        </button>
                      )}
                      <button
                        onClick={() => handleSyncToFolder(job)}
                        disabled={syncingJobs.has(job.id)}
                        className={`px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-semibold text-sm ${
                          syncingJobs.has(job.id)
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600'
                        }`}
                        title="Đồng bộ vào folder"
                      >
                        {syncingJobs.has(job.id) ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Đang đồng bộ...
                          </>
                        ) : (
                          <>
                            <FolderSync className="w-4 h-4" />
                            Đồng bộ vào folder
                          </>
                        )}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleRemove(job.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg border-2 border-blue-200 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Sparkles className="w-4 h-4 text-yellow-500 animate-pulse" />
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
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors bg-white"
          >
            <Trash2 className="w-4 h-4" />
            Xóa đã hoàn thành
          </button>
        )}
        {jobs.length > 0 && (
          <button
            onClick={handleReset}
            className="text-sm text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 flex items-center gap-2 px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            Tải lại / Upload mới
          </button>
        )}
      </div>
    </div>
  );
};

