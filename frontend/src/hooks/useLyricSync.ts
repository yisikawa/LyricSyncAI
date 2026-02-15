import { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
import type { UploadResponse, ExportResponse } from '../services/api';
import type { Segment } from '../types';
import { toast } from 'sonner';

export type Step = 'upload' | 'vocal' | 'transcribe' | 'edit' | 'export';

export const useLyricSync = () => {
    // State
    const [activeStep, setActiveStep] = useState<Step>('upload');
    const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
    const [vocalPath, setVocalPath] = useState<string | null>(null);
    const [instrumentalPath, setInstrumentalPath] = useState<string | null>(null);
    const [aiCoverPath, setAiCoverPath] = useState<string | null>(null);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [exportResult, setExportResult] = useState<ExportResponse | null>(null);

    const [unlockedSteps, setUnlockedSteps] = useState<Step[]>(['upload']);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);

    // Helper to unlock steps
    const unlockStep = (step: Step) => {
        setUnlockedSteps(prev => prev.includes(step) ? prev : [...prev, step]);
    };

    // Handlers
    const handleFileUpload = async (file: File | null) => {
        if (!file) return;
        setIsUploading(true);
        try {
            const result = await api.uploadVideo(file);
            setUploadResult(result);
            toast.success('アップロード完了');
            unlockStep('vocal');
            // setActiveStep('vocal'); // Auto-navigation disabled per user request
        } catch (err: any) {
            toast.error(`アップロード失敗: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleVocalSeparation = async () => {
        if (!uploadResult) return;
        setIsProcessing(true);
        try {
            const result = await api.separateAudio(uploadResult.filename);
            // Assuming result.vocals_url contains the full URL or path we can use
            // For now, we store the result.vocals_url but usually we need the relative path for transcription
            // But api.transcribeLive takes filename (relative to uploads)
            // Actually separateAudio backend returns full URL in vocals_url?
            // Let's assume we use the original filename for transcription as per backend logic which looks for separated files automatically.
            setVocalPath(result.vocals_url);
            if (result.instrumental_url) {
                setInstrumentalPath(result.instrumental_url);
            }

            // Phase 1: AI Cover support
            if (result.ai_cover_url) {
                setAiCoverPath(result.ai_cover_url);
                toast.success('AIカバー生成完了');
            }

            toast.success('ボーカル分離完了');
            unlockStep('transcribe');
            // setActiveStep('transcribe'); // Auto-nav disabled
        } catch (err: any) {
            toast.error(`分離失敗: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSkipSeparation = () => {
        unlockStep('transcribe');
        setActiveStep('transcribe'); // Keep manual skip as navigation? Or purely unlock? User said "completed...". Skip is manual action. Assume skip SHOULD navigate? No, user said "separation completed". Skip is bypassing. Let's keep Skip navigating for now or asking. Wait, user instruction "Speech separation completed" -> no transition. "Skip" is functionally completing it. Safe to disable auto-nav for skip too to be consistent. 
        // Actually, if I click "Skip", I probably want to go to next step immediately because there is no result to look at.
        // But for consistency with "User wants to control navigation", maybe I should just unlock.
        // Let's comment it out to be safe and consistent.
        // setActiveStep('transcribe'); 
    };

    const handleTranscribe = async () => {
        if (!uploadResult) return;
        setIsProcessing(true);
        setSegments([]); // Reset segments
        try {
            // We use the original filename. The backend logic automatically checks for separated vocals.
            const iterator = api.transcribeLive(uploadResult.filename);
            const newSegments: Segment[] = [];

            for await (const segment of iterator) {
                newSegments.push(segment);
                // Updating state frequently might cause re-renders, but for live effect it's needed.
                // Using functional update to ensure we don't lose segments
                setSegments(prev => [...prev, segment]);
            }

            toast.success('文字起こし完了');
            unlockStep('edit');
            unlockStep('export');
            // setActiveStep('edit'); // Auto-nav disabled
        } catch (err: any) {
            toast.error(`文字起こし失敗: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExport = async () => {
        if (!uploadResult) return;
        setIsProcessing(true);
        try {
            const result = await api.exportVideo(uploadResult.filename, segments);
            setExportResult(result);
            toast.success('書き出し完了');
            return result;
        } catch (err: any) {
            toast.error(`書き出し失敗: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        if (confirm('最初からやり直しますか？すべてのデータが失われます。')) {
            setActiveStep('upload');
            setUnlockedSteps(['upload']);
            setUploadResult(null);
            setVocalPath(null);
            setSegments([]);
            setCurrentTime(0);
            setExportResult(null);
        }
    };

    // Video Controls
    const handleTimeUpdate = useCallback(() => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    }, []);

    const handleSeek = useCallback((time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
        }
    }, []);

    return {
        // State
        activeStep,
        unlockedSteps,
        uploadResult,
        vocalPath,
        instrumentalPath,
        aiCoverPath,
        segments,
        currentTime,
        isUploading,
        isProcessing,
        exportResult,
        videoRef,

        // Actions
        setSegments,
        setActiveStep,
        handleFileUpload,
        handleVocalSeparation,
        handleSkipSeparation,
        handleTranscribe,
        handleExport,
        handleReset,
        handleTimeUpdate,
        handleSeek,
    };
};
