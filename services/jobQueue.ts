import { splitPdfByKeywords } from './pdfSplitter';
import { FileToSave } from '../types';
import { SplitResultData } from '../types';

export interface Job {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  result?: SplitResultData;
  error?: string;
  startTime?: number;
  endTime?: number;
  rootDirHandle: FileSystemDirectoryHandle; // Root directory handle for saving files
}

export interface JobQueueConfig {
  maxConcurrent: number; // Số job xử lý đồng thời
  rateLimitDelay: number; // Delay giữa các request (ms)
  retryAttempts: number; // Số lần retry khi lỗi
  retryDelay: number; // Delay trước khi retry (ms)
}

const DEFAULT_CONFIG: JobQueueConfig = {
  maxConcurrent: 1, // Xử lý tuần tự (1 file tại một thời điểm)
  // Gemini 2.5 Flash Free Tier: 10 RPM = 1 request per 6 seconds minimum
  // Set to 7000ms (7 seconds) to be safe and account for processing time
  rateLimitDelay: 7000, // 7 giây delay giữa các request (để không vượt 10 RPM)
  retryAttempts: 3,
  retryDelay: 2000, // 2 giây delay trước khi retry
};

class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private processing: Set<string> = new Set();
  private config: JobQueueConfig;
  private lastRequestTime: number = 0;
  private listeners: Set<(jobs: Job[]) => void> = new Set();

  constructor(config: Partial<JobQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Subscribe to job updates
  subscribe(listener: (jobs: Job[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const jobsArray = Array.from(this.jobs.values());
    this.listeners.forEach(listener => listener(jobsArray));
  }

  // Add job to queue
  addJob(file: File, rootDirHandle: FileSystemDirectoryHandle): string {
    if (!rootDirHandle) {
      throw new Error('JobQueue requires a valid rootDirHandle to save files.');
    }
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job: Job = {
      id,
      file,
      status: 'pending',
      progress: 0,
      rootDirHandle,
    };
    this.jobs.set(id, job);
    this.notify();
    this.processNext();
    return id;
  }

  // Set root directory handle for all pending jobs
  setRootDirectory(rootDirHandle: FileSystemDirectoryHandle): void {
    Array.from(this.jobs.values())
      .filter(job => job.status === 'pending')
      .forEach(job => {
        job.rootDirHandle = rootDirHandle;
      });
    this.notify();
  }

  // Remove job
  removeJob(id: string): void {
    this.jobs.delete(id);
    this.processing.delete(id);
    this.notify();
  }

  // Get all jobs
  getJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  // Get job by ID
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  // Rate limiting helper
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.rateLimitDelay) {
      await new Promise(resolve => 
        setTimeout(resolve, this.config.rateLimitDelay - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  // Process next job in queue
  private async processNext(): Promise<void> {
    // Check if we can process more jobs
    if (this.processing.size >= this.config.maxConcurrent) {
      return;
    }

    // Find next pending job
    const pendingJob = Array.from(this.jobs.values())
      .find(job => job.status === 'pending' && !this.processing.has(job.id));

    if (!pendingJob) {
      return; // No pending jobs
    }

    // Mark as processing
    this.processing.add(pendingJob.id);
    pendingJob.status = 'processing';
    pendingJob.startTime = Date.now();
    pendingJob.progress = 10;
    this.notify();

    // Process job with retry logic
    this.processJobWithRetry(pendingJob);
  }

  // Process job with retry logic
  private async processJobWithRetry(job: Job, attempt: number = 1): Promise<void> {
    try {
      // Wait for rate limit
      await this.waitForRateLimit();

      // Update progress - Starting
      job.progress = 10;
      this.notify();

      // Simulate progress updates during processing
      const progressInterval = setInterval(() => {
        if (job.progress < 90) {
          job.progress = Math.min(job.progress + 2, 90);
          this.notify();
        }
      }, 1000);

      try {
        // Process the file with root directory handle
        const result = await splitPdfByKeywords(job.file, job.rootDirHandle, "Mã số");
        
        clearInterval(progressInterval);

        // Success
        job.status = 'completed';
        job.progress = 100;
        job.result = result;
        job.endTime = Date.now();
        this.processing.delete(job.id);
        this.notify();

        // Process next job
        this.processNext();
      } catch (processError) {
        clearInterval(progressInterval);
        throw processError;
      }

    } catch (error: any) {
      console.error(`[JobQueue] Error processing job ${job.id} (attempt ${attempt}):`, error);

      // Check if we should retry
      if (attempt < this.config.retryAttempts) {
        // Retry after delay
        job.progress = 50;
        job.error = `Đang thử lại... (${attempt}/${this.config.retryAttempts})`;
        this.notify();

        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return this.processJobWithRetry(job, attempt + 1);
      }

      // Max retries reached
      job.status = 'error';
      job.progress = 0;
      job.error = error.message || 'Lỗi khi xử lý file';
      job.endTime = Date.now();
      this.processing.delete(job.id);
      this.notify();

      // Process next job
      this.processNext();
    }
  }

  // Clear all jobs
  clear(): void {
    this.jobs.clear();
    this.processing.clear();
    this.notify();
  }

  // Clear completed jobs
  clearCompleted(): void {
    Array.from(this.jobs.values())
      .filter(job => job.status === 'completed' || job.status === 'error')
      .forEach(job => this.removeJob(job.id));
  }

  private async saveFilesToDirectory(filesToSave: FileToSave[], folderStructureJson?: string): Promise<void> {
    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API không được hỗ trợ trong trình duyệt này. Vui lòng sử dụng Chrome/Edge phiên bản mới nhất.');
    }

    // Request directory access (this must be called in a user gesture, but we'll try)
    // Note: This might fail if not in user gesture context
    let rootDirHandle: FileSystemDirectoryHandle;
    try {
      rootDirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });
    } catch (error: any) {
      if (error.name === 'SecurityError' || error.message?.includes('user gesture')) {
        // Fallback: show message to user
        console.warn('[JobQueue] Cannot show directory picker without user gesture. Files will need to be saved manually.');
        throw new Error('Vui lòng chọn thư mục để lưu file. Thao tác này cần được thực hiện bởi người dùng.');
      }
      throw error;
    }

    // Helper function to get or create directory
    const getOrCreateDirectory = async (dirHandle: FileSystemDirectoryHandle, pathParts: string[]): Promise<FileSystemDirectoryHandle> => {
      if (pathParts.length === 0) return dirHandle;
      
      const [first, ...rest] = pathParts;
      let subDirHandle: FileSystemDirectoryHandle;
      
      try {
        subDirHandle = await dirHandle.getDirectoryHandle(first, { create: true });
      } catch (error) {
        throw new Error(`Không thể tạo folder: ${first}`);
      }
      
      return getOrCreateDirectory(subDirHandle, rest);
    };

    // Save all files
    for (const fileInfo of filesToSave) {
      const pathParts = fileInfo.path.split('/').filter(p => p);
      const filename = fileInfo.filename;
      
      try {
        const targetDir = await getOrCreateDirectory(rootDirHandle, pathParts);
        const fileHandle = await targetDir.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        // Convert to proper Uint8Array for File System Access API
        const bytes = new Uint8Array(fileInfo.bytes);
        await writable.write(bytes);
        await writable.close();
        console.log(`[JobQueue] Saved ${fileInfo.path}/${filename} (${fileInfo.bytes.length} bytes)`);
      } catch (error) {
        console.error(`[JobQueue] Error saving ${fileInfo.path}/${filename}:`, error);
        throw new Error(`Lỗi khi lưu file ${fileInfo.path}/${filename}: ${(error as Error).message}`);
      }
    }

    // Save folder structure JSON
    if (folderStructureJson) {
      try {
        const pathParts = ['DNR', 'PHAT MSI & SAR THANG 11-2025'].filter(p => p);
        const targetDir = await getOrCreateDirectory(rootDirHandle, pathParts);
        const fileHandle = await targetDir.getFileHandle('folder-structure.json', { create: true });
        const writable = await fileHandle.createWritable();
        const jsonBytes = new TextEncoder().encode(folderStructureJson);
        await writable.write(jsonBytes);
        await writable.close();
        console.log(`[JobQueue] Saved folder-structure.json`);
      } catch (error) {
        console.warn(`[JobQueue] Error saving folder-structure.json:`, error);
      }
    }

    console.log(`[JobQueue] All files saved successfully!`);
  }
}

// Export singleton instance
export const jobQueue = new JobQueue();

