import React, { useState, useCallback } from 'react';
import { Upload, FileVideo, X, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileUploadProps {
    onUploadComplete: (data: any) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const selectedFile = e.dataTransfer.files[0];
            if (selectedFile.type.startsWith('video/')) {
                setFile(selectedFile);
                setError(null);
            } else {
                setError('動画ファイル(MP4等)のみアップロード可能です');
            }
        }
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type.startsWith('video/')) {
                setFile(selectedFile);
                setError(null);
            } else {
                setError('動画ファイル(MP4等)のみアップロード可能です');
            }
        }
    }, []);

    const clearFile = () => {
        setFile(null);
        setError(null);
    };

    const uploadFile = async () => {
        if (!file) return;

        setIsUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://localhost:8000/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            onUploadComplete(data);
        } catch (err) {
            setError('アップロード中にエラーが発生しました');
            console.error(err);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto p-4">
            <div
                className={cn(
                    "relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 flex flex-col items-center justify-center min-h-[300px]",
                    isDragging ? "border-blue-500 bg-blue-50/10" : "border-gray-600 hover:border-gray-500",
                    file ? "bg-gray-800/50" : "bg-transparent"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {file ? (
                    <div className="w-full flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                        <div className="p-4 bg-gray-700/50 rounded-full">
                            <FileVideo className="w-12 h-12 text-blue-400" />
                        </div>
                        <div className="text-center">
                            <p className="font-medium text-lg text-gray-200">{file.name}</p>
                            <p className="text-sm text-gray-400">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                        </div>

                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={clearFile}
                                disabled={isUploading}
                                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-50"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={uploadFile}
                                disabled={isUploading}
                                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all shadow-lg hover:shadow-blue-500/25 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        アップロード中...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        処理を開始する
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="p-4 bg-gray-800/50 rounded-full mb-4 group-hover:bg-gray-700/50 transition-colors">
                            <Upload className="w-10 h-10 text-gray-400 group-hover:text-gray-300" />
                        </div>
                        <p className="text-xl font-medium text-gray-200 mb-2">動画ファイルをドロップ</p>
                        <p className="text-sm text-gray-400 mb-6">または</p>
                        <label className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 cursor-pointer transition-colors shadow-sm">
                            ファイルを選択
                            <input
                                type="file"
                                className="hidden"
                                accept="video/*"
                                onChange={handleFileSelect}
                            />
                        </label>
                        <p className="mt-4 text-xs text-gray-500">MP4, WebM (最大 500MB)</p>
                    </>
                )}
            </div>

            {error && (
                <div className="mt-4 p-4 rounded-lg bg-red-900/20 border border-red-900/50 flex items-center gap-2 text-red-200 animate-in slide-in-from-top-2">
                    <X className="w-4 h-4" />
                    {error}
                </div>
            )}
        </div>
    );
};
