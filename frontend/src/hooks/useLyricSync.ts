import { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
import type { UploadResponse, ExportResponse } from '../services/api';
import type { Segment } from '../types';
import { toast } from 'sonner';

export type Step = 'upload' | 'vocal' | 'transcribe' | 'edit' | 'export-original' | 'export-ai';

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
    const [separationFailed, setSeparationFailed] = useState(false);
    const [separationError, setSeparationError] = useState<string>('');

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
        setSeparationFailed(false);
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

    const handleVocalSeparation = async (rvcModel?: string, indexFile?: string) => {
        if (!uploadResult) return;
        setSeparationFailed(false);
        setSeparationError('');
        setVocalPath(null);
        setInstrumentalPath(null);
        setAiCoverPath(null);
        setIsProcessing(true);
        try {
            const result = await api.separateAudio(uploadResult.filename, rvcModel, indexFile);
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
        } catch (err: any) {
            setSeparationFailed(true);
            setSeparationError(err.message ?? String(err));
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
            unlockStep('export-original');
            unlockStep('export-ai');
            // setActiveStep('edit'); // Auto-nav disabled
        } catch (err: any) {
            toast.error(`文字起こし失敗: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExport = async (originalVoiceFlag: boolean = false) => {
        if (!uploadResult) return;
        setIsProcessing(true);
        try {
            const result = await api.exportVideo(uploadResult.filename, segments, originalVoiceFlag);
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

    const clearSeparationResults = () => {
        setVocalPath(null);
        setInstrumentalPath(null);
        setAiCoverPath(null);
        setSeparationFailed(false);
        setSeparationError('');
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
        separationFailed,
        separationError,
        exportResult,
        videoRef,

        // Actions
        setSegments,
        setActiveStep: (step: Step) => {
            setActiveStep(step);
        },
        handleFileUpload,
        handleVocalSeparation: (rvcModel?: string, indexFile?: string) => handleVocalSeparation(rvcModel, indexFile),
        clearSeparationResults,
        handleSkipSeparation,
        handleTranscribe,
        handleExport,
        handleReset,
        handleTimeUpdate,
        handleSeek,
    };
};
