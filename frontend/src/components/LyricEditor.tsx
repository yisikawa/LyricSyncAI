import React, { useState, useEffect, useRef } from 'react';
import type { Segment } from '../types';

interface LyricEditorProps {
    segments: Segment[];
    onSegmentsChange: (segments: Segment[]) => void;
    currentTime?: number;
    onSeek?: (time: number) => void;
}


export const LyricEditor: React.FC<LyricEditorProps> = ({
    segments,
    onSegmentsChange,
    currentTime = 0,
    onSeek
}) => {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [localSegments, setLocalSegments] = useState<Segment[]>(segments);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setLocalSegments(segments);
    }, [segments]);

    // Auto-scroll to active segment
    useEffect(() => {
        if (editingId !== null) return; // Don't auto-scroll while editing

        const activeIndex = localSegments.findIndex(
            seg => currentTime >= seg.start && currentTime < seg.end
        );

        if (activeIndex !== -1 && scrollRef.current) {
            const activeElement = scrollRef.current.children[activeIndex] as HTMLElement;
            if (activeElement) {
                activeElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }
        }
    }, [currentTime, editingId, localSegments]);

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
        <div ref={scrollRef} className="h-full overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {localSegments.map((segment) => {
                const isActive = currentTime >= segment.start && currentTime < segment.end;

                return (
                    <div
                        key={segment.id}
                        className={`
                            flex items-center gap-4 p-3 rounded-lg transition-all duration-300
                            border
                            ${isActive
                                ? 'bg-blue-900/30 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
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
        </div>
    );
};
