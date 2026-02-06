import { useState } from 'react';
import type { UploadResult, Segment } from '../types';
import { api } from '../services/api';

export const useLyricsProcessor = (uploadResult: UploadResult | null) => {
    const [segments, setSegments] = useState<Segment[]>([]);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleTranscribe = async () => {
        if (!uploadResult) return;
        setIsTranscribing(true);
        setSegments([]);

        try {
            const stream = api.transcribeLive(uploadResult.filename);
            for await (const segment of stream) {
                setSegments(prev => [...prev, segment]);
            }
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
            const data = await api.exportVideo(uploadResult.filename, segments);
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
