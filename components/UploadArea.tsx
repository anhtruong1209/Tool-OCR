import React, { useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';

interface UploadAreaProps {
  onFileSelect: (file: File) => void;
  onMultipleFilesSelect?: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({
  onFileSelect,
  onMultipleFilesSelect,
  disabled,
  multiple = false
}) => {
  const validateFile = (file: File): boolean => {
    if (file.type !== 'application/pdf') {
      alert(`File "${file.name}" không phải PDF. Vui lòng chỉ tải lên file PDF.`);
      return false;
    }
    // Check size limit: 10MB = 10 * 1024 * 1024
    if (file.size > 10 * 1024 * 1024) {
      alert(`File "${file.name}" quá lớn. Vui lòng chọn file nhỏ hơn 10MB.`);
      return false;
    }
    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');

    if (files.length === 0) {
      alert('Vui lòng chỉ tải lên file PDF.');
      return;
    }

    // Validate all files
    const validFiles = files.filter(validateFile);

    if (validFiles.length === 0) return;

    if (multiple && onMultipleFilesSelect) {
      onMultipleFilesSelect(validFiles);
    } else {
      onFileSelect(validFiles[0]);
    }
  }, [onFileSelect, onMultipleFilesSelect, disabled, multiple]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const files = Array.from(e.target.files || []).filter(f => f.type === 'application/pdf');

    if (files.length === 0) return;

    // Validate all files
    const validFiles = files.filter(validateFile);

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    if (multiple && onMultipleFilesSelect) {
      onMultipleFilesSelect(validFiles);
    } else {
      onFileSelect(validFiles[0]);
    }

    e.target.value = ''; // Reset input value
  }, [onFileSelect, onMultipleFilesSelect, disabled, multiple]);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200
        ${disabled
          ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
          : 'border-blue-300 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400 cursor-pointer'
        }
      `}
    >
      <input
        type="file"
        accept="application/pdf"
        multiple={multiple}
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
        disabled={disabled}
      />

      <div className="flex flex-col items-center justify-center gap-4 pointer-events-none relative z-0">
        <div className={`p-4 rounded-full ${disabled ? 'bg-slate-100' : 'bg-blue-100 text-blue-600'}`}>
          {disabled ? <FileText className="w-8 h-8 text-slate-400" /> : <Upload className="w-8 h-8" />}
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-700">
            {multiple ? 'Tải lên nhiều file PDF' : 'Tải lên hóa đơn PDF'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {multiple
              ? 'Kéo thả hoặc click để chọn nhiều file (Max 10MB/file)'
              : 'Kéo thả hoặc click để chọn file (Max 10MB)'}
          </p>
        </div>
      </div>
    </div>
  );
};