import React, { useState, useEffect } from 'react';
import type { Segment } from '../types';

interface LyricEditorProps {
    segments: Segment[];
    onSegmentsChange: (segments: Segment[]) => void;
    currentTime?: number;
    onSeek?: (time: number) => void;
    isProcessing?: boolean;
}


export const LyricEditor: React.FC<LyricEditorProps> = ({
    segments,
    onSegmentsChange,
    currentTime = 0,
    onSeek,
    isProcessing = false
}) => {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [localSegments, setLocalSegments] = useState<Segment[]>(segments);
    const [userScrolled, setUserScrolled] = useState(false);

    useEffect(() => {
        setLocalSegments(segments);

        // Auto-scroll to bottom as new segments arrive, unless user has scrolled up
        if (isProcessing && !userScrolled) {
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
        }
    }, [segments, isProcessing, userScrolled]);

    // Track page scroll to prevent annoying jumps
    useEffect(() => {
        const handlePageScroll = () => {
            const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100;
            setUserScrolled(!isAtBottom);
        };
        window.addEventListener('scroll', handlePageScroll);
        return () => window.removeEventListener('scroll', handlePageScroll);
    }, []);

    // Auto-scroll to active segment (during playback)
    useEffect(() => {
        if (editingId !== null || isProcessing) return; // Don't auto-scroll playback while editing or processing

        const activeIndex = localSegments.findIndex(
            seg => currentTime >= seg.start && currentTime < seg.end
        );

        if (activeIndex !== -1) {
            const editorDiv = document.getElementById('lyric-editor-container');
            if (editorDiv) {
                // Adjust for the return button being the first child potentially
                const children = Array.from(editorDiv.children).filter(el => !el.classList.contains('fixed'));
                const activeElement = children[activeIndex] as HTMLElement;
                if (activeElement) {
                    activeElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                    });
                }
            }
        }
    }, [currentTime, editingId, localSegments, isProcessing]);

    const handleTextChange = (id: number, newText: string) => {
        const updated = localSegments.map(seg =>
            seg.id === id ? { ...seg, text: newText } : seg
        );
        setLocalSegments(updated);
    };

    const handleBlur = () => {
        setEditingId(null);
        onSegmentsChange(localSegments);
    };

    return (
        <div
            id="lyric-editor-container"
            className="space-y-2 relative"
        >
            {/* Scroll Status Indicator */}
            {isProcessing && userScrolled && (
                <button
                    onClick={() => {
                        setUserScrolled(false);
                        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
                    }}
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-full shadow-2xl border border-blue-400/50 flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300"
                >
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-100 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-200"></span>
                    </span>
                    自動追従に戻る
                </button>
            )}

            {localSegments.map((segment, index) => {
                const isActive = currentTime >= segment.start && currentTime < segment.end;
                const isNewest = isProcessing && index === localSegments.length - 1;

                return (
                    <div
                        key={segment.id}
                        className={`
                            flex items-center gap-4 p-3 rounded-lg transition-all duration-500
                            border animate-in fade-in slide-in-from-left-2
                            ${isActive
                                ? 'bg-blue-900/40 border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.25)]'
                                : isNewest
                                    ? 'bg-blue-900/20 border-blue-500/30 border-dashed animate-pulse'
                                    : 'border-transparent hover:bg-gray-800/50 hover:border-gray-700'
                            }
                        `}
                    >
                        <div className="flex flex-col items-center gap-1 min-w-[100px]">
                            <input
                                type="number"
                                step="0.1"
                                className="text-xs font-mono text-gray-400 bg-gray-950 px-2 py-1 rounded border border-gray-800 text-center w-20 focus:border-blue-500 focus:outline-none focus:text-white transition-colors"
                                value={segment.start}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                        const updated = localSegments.map(s => s.id === segment.id ? { ...s, start: val } : s);
                                        setLocalSegments(updated);
                                        onSegmentsChange(updated);
                                    }
                                }}
                            />
                            <span
                                className="text-xs font-mono text-gray-600 text-center select-none cursor-pointer hover:text-blue-400 transition-colors"
                                onClick={() => onSeek?.(segment.start)}
                                title="この時間にシーク"
                            >
                                ↓
                            </span>
                            <input
                                type="number"
                                step="0.1"
                                className="text-xs font-mono text-gray-400 bg-gray-950 px-2 py-1 rounded border border-gray-800 text-center w-20 focus:border-blue-500 focus:outline-none focus:text-white transition-colors"
                                value={segment.end}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                        const updated = localSegments.map(s => s.id === segment.id ? { ...s, end: val } : s);
                                        setLocalSegments(updated);
                                        onSegmentsChange(updated);
                                    }
                                }}
                            />
                        </div>

                        <div className="flex-1">
                            {editingId === segment.id ? (
                                <textarea
                                    className="w-full bg-gray-950 text-white p-3 rounded-lg border border-blue-500/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                                    value={segment.text}
                                    onChange={(e) => handleTextChange(segment.id, e.target.value)}
                                    onBlur={handleBlur}
                                    autoFocus
                                    rows={2}
                                />
                            ) : (
                                <div
                                    className={`
                                        p-3 rounded-lg cursor-text min-h-[50px] whitespace-pre-wrap transition-colors
                                        ${isActive ? 'text-white font-medium' : 'text-gray-300 hover:text-white hover:bg-gray-800'}
                                    `}
                                    onClick={() => setEditingId(segment.id)}
                                >
                                    {segment.text}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            {isProcessing && (
                <div className="p-5 bg-gradient-to-r from-blue-900/20 via-blue-800/10 to-transparent border border-dashed border-blue-500/30 rounded-xl flex flex-col items-center justify-center gap-3 mt-4 overflow-hidden relative">
                    <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>
                    <div className="flex gap-2 items-end h-4">
                        <span className="w-1 bg-blue-400/60 rounded-full animate-[bounce_1s_infinite_-0.3s]"></span>
                        <span className="w-1 bg-blue-500/80 rounded-full h-3 animate-[bounce_1.2s_infinite]"></span>
                        <span className="w-1 bg-blue-400/60 rounded-full h-2 animate-[bounce_0.8s_infinite_-0.5s]"></span>
                        <span className="w-1 bg-blue-500/80 rounded-full h-4 animate-[bounce_1.1s_infinite_-0.2s]"></span>
                    </div>
                    <span className="text-sm font-bold text-blue-400 tracking-wider flex items-center gap-2">
                        AI 文字起こしエンジン稼働中...
                    </span>
                    <p className="text-[10px] text-blue-300/60 uppercase">Real-time segment analysis in progress</p>
                </div>
            )}
        </div>
    );
};
