import React from 'react';

interface TranscriptionDisplayProps {
    text: string | null;
    isLoading: boolean;
    onTranscribe: () => void;
}

export const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
    text,
    isLoading,
    onTranscribe
}) => {
    return (
        <div className="mt-8 w-full max-w-2xl mx-auto">
            {!text && (
                <div className="text-center">
                    <button
                        onClick={onTranscribe}
                        disabled={isLoading}
                        className={`
              px-6 py-3 rounded-full font-semibold text-white shadow-lg transition-all
              ${isLoading
                                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                                : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 hover:shadow-blue-500/25'
                            }
            `}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                文字起こし中...
                            </span>
                        ) : (
                            '文字起こしを開始'
                        )}
                    </button>
                </div>
            )}

            {text && (
                <div className="mt-6 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
                    <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        文字起こし結果
                    </h3>
                    <div className="prose prose-invert max-w-none">
                        <p className="whitespace-pre-wrap leading-relaxed text-gray-300">
                            {text}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
