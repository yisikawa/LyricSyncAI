import React, { useState, useCallback } from 'react';
import { Upload, FileVideo, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileUploadProps {
    onFileSelect: (file: File | null) => void;
    selectedFile: File | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, selectedFile }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const processFile = (selectedFile: File) => {
        if (selectedFile.type.startsWith('video/')) {
            onFileSelect(selectedFile);
            setError(null);
        } else {
            setError('動画ファイル(MP4等)のみアップロード可能です');
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    }, [onFileSelect]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    }, [onFileSelect]);

    const clearFile = () => {
        onFileSelect(null);
        setError(null);
    };

    return (
        <div className="w-full max-w-xl mx-auto p-4">
            <div
                className={cn(
                    "relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 flex flex-col items-center justify-center min-h-[240px]",
                    isDragging ? "border-blue-500 bg-blue-50/10" : "border-gray-600 hover:border-gray-500",
                    selectedFile ? "bg-gray-800/50 border-blue-500/50" : "bg-transparent"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {selectedFile ? (
                    <div className="w-full flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                        <button
                            onClick={clearFile}
                            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="p-4 bg-blue-500/10 rounded-full">
                            <FileVideo className="w-12 h-12 text-blue-400" />
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-lg text-gray-100">{selectedFile.name}</p>
                            <p className="text-xs text-blue-400 mt-1">Video Ready for Processing</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="p-4 bg-gray-800/50 rounded-full mb-4 group-hover:bg-gray-700/50 transition-colors">
                            <Upload className="w-10 h-10 text-gray-400 group-hover:text-gray-300" />
                        </div>
                        <p className="text-xl font-medium text-gray-200 mb-2">動画ファイルをドロップ</p>
                        <label className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 cursor-pointer transition-colors shadow-sm mt-4">
                            ファイルを選択
                            <input
                                type="file"
                                className="hidden"
                                accept="video/*"
                                onChange={handleFileSelect}
                            />
                        </label>
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
