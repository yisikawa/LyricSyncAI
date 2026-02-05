import { useState } from 'react';
import type { UploadResult, Segment } from '../types';

export const useLyricsProcessor = (uploadResult: UploadResult | null) => {
    const [segments, setSegments] = useState<Segment[]>([]);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleTranscribe = async () => {
        if (!uploadResult) return;
        setIsTranscribing(true);
        try {
            const response = await fetch('http://localhost:8001/transcribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ filename: uploadResult.filename }),
            });

            if (!response.ok) {
                throw new Error('Transcription failed');
            }

            const data = await response.json();
            const processedSegments = data.segments.map((seg: any, index: number) => ({
                id: seg.id ?? index,
                start: seg.start,
                end: seg.end,
                text: seg.text
            }));
            setSegments(processedSegments);
        } catch (error) {
            console.error('Transcription error:', error);
            alert('文字起こしに失敗しました');
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleExport = async () => {
        if (!uploadResult) return;
        setIsExporting(true);
        try {
            const response = await fetch('http://localhost:8001/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    video_filename: uploadResult.filename,
                    segments: segments,
                }),
            });

            if (!response.ok) {
                throw new Error('Export failed');
            }

            const data = await response.json();
            alert('動画の書き出しが完了しました。');

            const link = document.createElement('a');
            link.href = data.url;
            link.download = data.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Export error:', error);
            alert('動画の書き出しに失敗しました');
        } finally {
            setIsExporting(false);
        }
    };

    const resetSegments = () => setSegments([]);

    return {
        segments,
        setSegments,
        isTranscribing,
        isExporting,
        handleTranscribe,
        handleExport,
        resetSegments
    };
};
