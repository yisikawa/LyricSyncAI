import { useState } from 'react';
import { toast } from 'sonner';
import type { UploadResult, Segment } from '../types';
import { api } from '../services/api';

export const useLyricsProcessor = (uploadResult: UploadResult | null) => {
    const [segments, setSegments] = useState<Segment[]>([]);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const handleTranscribe = async (audioPath?: string) => {
        const targetFile = audioPath || uploadResult?.filename;
        if (!targetFile) return;

        setIsTranscribing(true);
        setSegments([]);

        try {
            const stream = api.transcribeLive(targetFile);
            for await (const segment of stream) {
                setSegments(prev => [...prev, segment]);
            }
        } catch (error) {
            console.error('Transcription error:', error);
            toast.error('文字起こしに失敗しました');
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleExport = async () => {
        if (!uploadResult) return null;
        setIsExporting(true);
        try {
            const data = await api.exportVideo(uploadResult.filename, segments);
            toast.success('動画の書き出しが完了しました。');

            // Automatic download is disabled to prevent navigation. 
            // The URL is returned and displayed in the UI for the user to play or download manually.
            return data;
        } catch (error) {
            console.error('Export error:', error);
            toast.error('動画の書き出しに失敗しました');
            return null;
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
