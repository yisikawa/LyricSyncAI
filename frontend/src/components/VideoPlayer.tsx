import React from 'react';
import type { UploadResult, Segment } from '../types';

interface VideoPlayerProps {
    uploadResult: UploadResult;
    segments: Segment[];
    currentTime: number;
    videoRef: React.Ref<HTMLVideoElement>;
    isTranscribing: boolean;
    isExporting: boolean;
    onTimeUpdate: () => void;
    onTranscribe: () => void;
    onExport: () => void;
    onReset: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
    uploadResult,
    segments,
    currentTime,
    videoRef,
    isTranscribing,
    isExporting,
    onTimeUpdate,
    onTranscribe,
    onExport,
    onReset
}) => {
    return (
        <div className="w-full flex flex-col gap-4">
            <div className="text-center p-4 border border-gray-700 rounded-xl bg-gray-900/50 shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-green-400">
                        アップロード完了
                    </h2>
                    <button
                        onClick={onReset}
                        className="text-xs text-gray-400 hover:text-white underline"
                    >
                        別のファイルをアップロード
                    </button>
                </div>
                <p className="text-gray-300 mb-4 text-left text-xs bg-gray-800/50 p-2 rounded truncate">📄 {uploadResult.filename}</p>

                <div className="relative w-full bg-black rounded-xl overflow-hidden shadow-lg group">
                    <video
                        ref={videoRef}
                        src={`http://localhost:8001/uploads/${encodeURIComponent(uploadResult.filename)}`}
                        className="w-full h-auto object-contain max-h-[50vh] bg-black"
                        controls
                        onTimeUpdate={onTimeUpdate}
                    />


                    {/* Available Subtitle Overlay */}
                    <div className="absolute inset-x-0 bottom-8 flex flex-col items-center justify-end px-4 pointer-events-none z-50 min-h-[4rem]">
                        {segments.map((segment) => {
                            if (currentTime >= segment.start && currentTime < segment.end) {
                                return (
                                    <span
                                        key={segment.id}
                                        className="inline-block bg-black/60 text-white text-lg md:text-xl font-bold px-3 py-1 rounded backdrop-blur-sm shadow-md"
                                        style={{ textShadow: '1px 1px 2px black' }}
                                    >
                                        {segment.text}
                                    </span>
                                );
                            }
                            return null;
                        })}
                    </div>
                </div>

                <>
                    {segments.length > 0 && (
                        <div className="mt-6 text-center py-4 flex flex-col gap-3">
                            <button
                                onClick={onExport}
                                disabled={isExporting}
                                className={`
                                px-6 py-3 rounded-xl font-bold text-base text-white shadow-lg transition-all transform hover:scale-105
                                ${isExporting
                                        ? 'bg-gray-600 cursor-not-allowed opacity-50'
                                        : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:shadow-green-500/50'
                                    }
                                `}
                            >
                                {isExporting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        書き出し中...
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        💾 字幕入り動画を保存
                                    </span>
                                )}
                            </button>
                            <p className="text-[10px] text-gray-500">※ 字幕を焼き付けた新しいMP4ファイルを生成します</p>
                        </div>
                    )}

                    {!segments.length && (
                        <div className="mt-6 text-center py-4">
                            <button
                                onClick={onTranscribe}
                                disabled={isTranscribing}
                                className={`
                                px-6 py-3 rounded-full font-bold text-base text-white shadow-lg transition-all transform hover:scale-105
                                ${isTranscribing
                                        ? 'bg-gray-600 cursor-not-allowed opacity-50'
                                        : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 hover:shadow-blue-500/50'
                                    }
                                `}
                            >
                                {isTranscribing ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        処理中...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        ✨ 文字起こしを開始
                                    </span>
                                )}
                            </button>
                            <p className="mt-2 text-xs text-gray-500">※ 動画の長さによっては数分かかります</p>
                        </div>
                    )}
                </>

            </div>
        </div>
    );
};

