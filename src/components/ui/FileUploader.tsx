'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, File, Image, X, CheckCircle, AlertCircle, FileText, Music } from 'lucide-react';

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface FileUploaderProps {
  onFileUpload: (files: File[]) => Promise<void>;
  onFileRemove?: (fileId: string) => void;
  acceptedTypes?: string[];
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
}

const DEFAULT_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

export function FileUploader({
  onFileUpload,
  onFileRemove,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxFileSize = MAX_FILE_SIZE,
  maxFiles = MAX_FILES,
  className = '',
  disabled = false
}: FileUploaderProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || disabled) return;

    const newFiles = Array.from(files).slice(0, maxFiles - uploadedFiles.length);
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    // Validate files
    newFiles.forEach(file => {
      if (!acceptedTypes.includes(file.type)) {
        invalidFiles.push(`${file.name}: サポートされていないファイル形式`);
        return;
      }
      
      if (file.size > maxFileSize) {
        invalidFiles.push(`${file.name}: ファイルサイズが大きすぎます (最大 ${formatFileSize(maxFileSize)})`);
        return;
      }

      validFiles.push(file);
    });

    // Show validation errors
    if (invalidFiles.length > 0) {
      alert(`アップロードできないファイル:\n${invalidFiles.join('\n')}`);
    }

    if (validFiles.length === 0) return;

    // Create uploaded file objects
    const newUploadedFiles: UploadedFile[] = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'uploading' as const,
      progress: 0
    }));

    // Add preview for images
    for (const uploadedFile of newUploadedFiles) {
      if (uploadedFile.file.type.startsWith('image/')) {
        uploadedFile.preview = URL.createObjectURL(uploadedFile.file);
      }
    }

    setUploadedFiles(prev => [...prev, ...newUploadedFiles]);

    // Simulate upload progress and call onFileUpload
    try {
      // Simulate progress
      for (const uploadedFile of newUploadedFiles) {
        simulateUploadProgress(uploadedFile.id);
      }

      await onFileUpload(validFiles);

      // Mark as success
      setUploadedFiles(prev => 
        prev.map(f => 
          newUploadedFiles.find(nf => nf.id === f.id) 
            ? { ...f, status: 'success' as const, progress: 100 }
            : f
        )
      );
    } catch (error) {
      // Mark as error
      setUploadedFiles(prev => 
        prev.map(f => 
          newUploadedFiles.find(nf => nf.id === f.id) 
            ? { ...f, status: 'error' as const, error: (error as Error).message }
            : f
        )
      );
    }
  }, [acceptedTypes, maxFileSize, maxFiles, uploadedFiles.length, onFileUpload, disabled]);

  // Simulate upload progress
  const simulateUploadProgress = (fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === fileId ? { ...f, progress } : f
        )
      );
    }, 200);
  };

  // Handle drag and drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragging(false);
      }
      return newCounter;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  }, [handleFileSelect]);

  // Handle file removal
  const handleFileRemove = (fileId: string) => {
    const fileToRemove = uploadedFiles.find(f => f.id === fileId);
    if (fileToRemove?.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
    
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    onFileRemove?.(fileId);
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      uploadedFiles.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, []);

  // Get file icon
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="w-5 h-5" />;
    if (fileType.startsWith('audio/')) return <Music className="w-5 h-5" />;
    if (fileType === 'application/pdf') return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6
          transition-all duration-200 cursor-pointer
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={disabled}
        />

        <div className="text-center">
          <Upload className={`
            w-8 h-8 mx-auto mb-4 
            ${isDragging ? 'text-blue-500' : 'text-gray-400'}
          `} />
          
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {isDragging ? 'ファイルをドロップしてください' : 'ファイルをアップロード'}
          </p>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            ドラッグ&ドロップまたはクリックしてファイルを選択
          </p>

          <div className="text-xs text-gray-400 space-y-1">
            <p>対応形式: 画像, PDF, テキスト, CSV, JSON, 音声</p>
            <p>最大ファイルサイズ: {formatFileSize(maxFileSize)}</p>
            <p>最大ファイル数: {maxFiles}個</p>
          </div>
        </div>

        {uploadedFiles.length >= maxFiles && (
          <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 bg-opacity-90 flex items-center justify-center rounded-xl">
            <p className="text-gray-600 dark:text-gray-300 font-medium">
              最大ファイル数に達しました
            </p>
          </div>
        )}
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">
            アップロードファイル ({uploadedFiles.length}/{maxFiles})
          </h4>
          
          <div className="space-y-2">
            {uploadedFiles.map(uploadedFile => (
              <div
                key={uploadedFile.id}
                className="
                  flex items-center space-x-3 p-3 
                  bg-gray-50 dark:bg-gray-800 
                  rounded-lg border border-gray-200 dark:border-gray-700
                "
              >
                {/* File Preview/Icon */}
                <div className="flex-shrink-0">
                  {uploadedFile.preview ? (
                    <img
                      src={uploadedFile.preview}
                      alt={uploadedFile.file.name}
                      className="w-10 h-10 object-cover rounded"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                      {getFileIcon(uploadedFile.file.type)}
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {uploadedFile.file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(uploadedFile.file.size)} • {uploadedFile.file.type}
                  </p>
                  
                  {/* Progress Bar */}
                  {uploadedFile.status === 'uploading' && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>アップロード中...</span>
                        <span>{Math.round(uploadedFile.progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                        <div
                          className="bg-blue-500 h-1 rounded-full transition-all duration-200"
                          style={{ width: `${uploadedFile.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {uploadedFile.status === 'error' && uploadedFile.error && (
                    <p className="text-xs text-red-500 mt-1">
                      エラー: {uploadedFile.error}
                    </p>
                  )}
                </div>

                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {uploadedFile.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {uploadedFile.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  {uploadedFile.status === 'uploading' && (
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {/* Remove Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileRemove(uploadedFile.id);
                  }}
                  className="
                    p-1 text-gray-400 hover:text-red-500 
                    transition-colors duration-200
                  "
                  title="ファイルを削除"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FileUploader;