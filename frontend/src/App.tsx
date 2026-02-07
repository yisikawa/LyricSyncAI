import { useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileUpload } from './components/FileUpload';
import { LyricEditor } from './components/LyricEditor';
import { VideoPlayer } from './components/VideoPlayer';
import { StepNavigation } from './components/StepNavigation';
import { useLyricsProcessor } from './hooks/useLyricsProcessor';
import { api } from './services/api';
import { toast } from 'sonner';
import type { UploadResult, Step } from './types';

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

function App() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeStep, setActiveStep] = useState<Step>('upload');
  const [unlockedSteps, setUnlockedSteps] = useState<Step[]>(['upload']);
  const [vocalPath, setVocalPath] = useState<string | null>(null);
  const [isSeparating, setIsSeparating] = useState(false);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    segments,
    setSegments,
    isTranscribing,
    isExporting,
    handleTranscribe,
    handleExport,
    resetSegments
  } = useLyricsProcessor(uploadResult);

  const unlockStep = (step: Step) => {
    setUnlockedSteps(prev => prev.includes(step) ? prev : [...prev, step]);
  };

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  };

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      unlockStep('vocal');
    }
  };

  const handleStartVocalSeparationInternal = async (result: UploadResult) => {
    setIsSeparating(true);
    try {
      const data = await api.separateAudio(result.filename);
      if (data.vocals_url) {
        setVocalPath(data.vocals_url);
        unlockStep('transcribe');
      } else {
        toast.error('分離に失敗しました');
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'サーバーエラーが発生しました');
    } finally {
      setIsSeparating(false);
    }
  };

  const ensureUploadAndSeparate = async () => {
    if (isUploading || isSeparating) return;

    let currentUploadResult = uploadResult;

    if (!currentUploadResult && selectedFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      try {
        currentUploadResult = await api.uploadVideo(selectedFile);
        setUploadResult(currentUploadResult);
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || 'アップロードに失敗しました');
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    if (currentUploadResult) {
      await handleStartVocalSeparationInternal(currentUploadResult);
    }
  };

  const performExport = async () => {
    const result = await handleExport();
    if (result && result.url) {
      setExportedVideoUrl(result.url);
    }
  };

  const handleStepNavigation = async (step: Step) => {
    if (isUploading || isSeparating || isTranscribing || isExporting) return;

    setActiveStep(step);

    if (step === 'vocal') {
      if (!vocalPath) {
        await ensureUploadAndSeparate();
      }
    } else if (step === 'transcribe') {
      if (segments.length === 0) {
        // segments.length check prevents re-transcription if we already have segments
        // But what if user wants to re-transcribe?
        // Current logic assumes they don't.
        await handleTranscribe(vocalPath || uploadResult?.filename);
        unlockStep('edit');
        unlockStep('export');
      }
    } else if (step === 'export') {
      await performExport();
    }
  };

  const handleReset = () => {
    setUploadResult(null);
    setSelectedFile(null);
    setUnlockedSteps(['upload']);
    setActiveStep('upload');
    setVocalPath(null);
    setExportedVideoUrl(null);
    resetSegments();
  };

  return (
    <div className="min-h-screen w-full bg-gray-950 text-white flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="shrink-0 py-4 text-center bg-gray-950/50 backdrop-blur z-20 border-b border-gray-800/50 sticky top-0 px-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            LyricSync AI
          </h1>
          <button
            onClick={handleReset}
            className="text-[10px] text-gray-500 hover:text-red-400 transition-colors uppercase tracking-widest"
          >
            Reset Project
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 flex flex-col relative">

        {/* Step Navigation */}
        <StepNavigation
          currentStep={activeStep}
          onStepChange={handleStepNavigation}
          unlockedSteps={unlockedSteps}
        />

        <div className="flex-1 relative mt-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Upload */}
            {activeStep === 'upload' && (
              <motion.div
                key="upload"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.4 }}
                className="w-full space-y-8 py-4"
              >
                <div className="w-full">
                  {!selectedFile ? (
                    <FileUpload
                      selectedFile={selectedFile}
                      onFileSelect={handleFileSelect}
                    />
                  ) : (
                    <div className="space-y-4">
                      <VideoPlayer
                        uploadResult={uploadResult}
                        localFile={selectedFile}
                        segments={[]}
                        currentTime={currentTime}
                        videoRef={videoRef}
                        onTimeUpdate={handleTimeUpdate}
                      />
                      <div className="text-center text-gray-400 text-sm animate-pulse">
                        上部の「音声分離」ボタンを押して次へ進んでください 🎙️
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 2: Vocal Separation */}
            {activeStep === 'vocal' && (
              <motion.div
                key="vocal"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.4 }}
                className="w-full space-y-8"
              >
                {(isUploading || isSeparating) ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-6">
                    <div className="w-20 h-20 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                      {isUploading ? '動画をアップロード中...' : 'ボーカルを分離中...'}
                    </div>
                    <p className="text-gray-400">しばらくお待ちください</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="w-full">
                      {vocalPath ? (
                        <div className="w-full p-6 bg-gray-900 rounded-2xl border border-gray-800 flex flex-col items-center justify-center gap-4 shadow-xl">
                          <div className="p-4 bg-purple-500/20 rounded-full animate-pulse">
                            <span className="text-4xl">🎤</span>
                          </div>
                          <h3 className="text-white font-bold text-lg">抽出されたボーカル音声</h3>
                          <audio controls src={vocalPath} className="w-full mt-2" />
                        </div>
                      ) : (
                        <div className="text-center text-red-400">音声が見つかりません</div>
                      )}
                    </div>

                    <div className="flex flex-col gap-6 h-full justify-center">
                      <div className="w-full p-8 bg-gray-900/40 border border-gray-800/60 rounded-3xl backdrop-blur-md shadow-2xl">
                        <div className="text-4xl mb-6">{vocalPath ? '✅' : '🎙️'}</div>
                        <h3 className="text-xl font-bold mb-2">音声成分の抽出</h3>
                        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                          AIを使用して、BGMとボーカルを分離します。<br />
                          これにより、文字起こしの精度が劇的に向上します。
                        </p>

                        {vocalPath && (
                          <div className="space-y-4">
                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm font-bold flex items-center gap-2">
                              <span>✨ 音声分離が完了しました</span>
                            </div>
                            <div className="text-center text-gray-400 text-sm animate-pulse">
                              上部の「文字おこし」ボタンを押して次へ進んでください ✍️
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Transcription */}
            {activeStep === 'transcribe' && (
              <motion.div
                key="transcribe"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                <div className="w-full p-6 bg-gray-900/50 border border-gray-800 rounded-3xl">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="text-blue-400">✍️</span> AI文字おこし
                  </h3>
                  <div className="space-y-4">
                    {isTranscribing && (
                      <div className="p-8 flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                        <span className="text-purple-300 animate-pulse">AIが歌詞を解析中...</span>
                      </div>
                    )}

                    {(segments.length > 0) && (
                      <div className="space-y-4">
                        <div className="max-h-[400px] overflow-y-auto p-4 bg-black/40 rounded-xl border border-gray-800 space-y-2 custom-scrollbar">
                          {segments.map((seg) => (
                            <div key={seg.id} className="text-sm text-gray-300 py-1 border-b border-gray-800/50">
                              <span className="text-[10px] text-gray-500 mr-2 font-mono">[{seg.start.toFixed(1)}s]</span>
                              {seg.text}
                            </div>
                          ))}
                        </div>

                        {!isTranscribing && (
                          <div className="text-center text-gray-400 text-sm animate-pulse pt-4">
                            解析完了！上部の「字幕編集」ボタンを押して次へ進んでください ✏️
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Edit */}
            {activeStep === 'edit' && uploadResult && (
              <motion.div
                key="edit"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full items-start">
                  <div className="sticky top-24 space-y-4">
                    <VideoPlayer
                      uploadResult={uploadResult}
                      segments={segments}
                      currentTime={currentTime}
                      videoRef={videoRef}
                      onTimeUpdate={handleTimeUpdate}
                      compact={true}
                    />
                    <div className="text-center text-gray-400 text-sm animate-pulse">
                      編集が終わったら上部の「書き出し」ボタンを押してください 🎬
                    </div>
                  </div>
                  <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden flex flex-col h-[70vh]">
                    <div className="p-4 border-b border-gray-800 bg-gray-800/50 flex justify-between items-center">
                      <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400">Subtitle Editor</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      <LyricEditor
                        segments={segments}
                        onSegmentsChange={setSegments}
                        currentTime={currentTime}
                        onSeek={handleSeek}
                        isProcessing={false}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 5: Export */}
            {activeStep === 'export' && (
              <motion.div
                key="export"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                <div className="max-w-3xl mx-auto w-full p-8 bg-gray-900/50 border border-gray-800 rounded-3xl text-center">

                  {isExporting ? (
                    <div className="py-20 flex flex-col items-center">
                      <div className="w-16 h-16 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin mb-6" />
                      <h3 className="text-2xl font-bold text-white mb-2">動画を書き出し中...</h3>
                      <p className="text-green-400 font-medium">字幕を焼き付けています。しばらくお待ちください。</p>
                    </div>
                  ) : exportedVideoUrl ? (
                    <>
                      <div className="text-5xl mb-6">🎉</div>
                      <h3 className="text-2xl font-bold mb-2">動画の書き出しが完了しました！</h3>
                      <div className="space-y-6 mt-8">
                        <div className="rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
                          <video src={exportedVideoUrl} controls className="w-full" autoPlay />
                        </div>
                        <div className="flex gap-4">
                          <button
                            onClick={async () => {
                              if (!exportedVideoUrl || !uploadResult) return;

                              const filename = `exported_${uploadResult.filename}`;

                              try {
                                toast.info('ダウンロード準備中...');
                                // 1. 動画データをBlobとして取得
                                const response = await fetch(exportedVideoUrl);
                                const blob = await response.blob();

                                // 2. File System Access API を試行 (Chrome/Edgeなど)
                                if ('showSaveFilePicker' in window) {
                                  try {
                                    const handle = await (window as any).showSaveFilePicker({
                                      suggestedName: filename,
                                      types: [{
                                        description: 'Video File',
                                        accept: { 'video/mp4': ['.mp4'] },
                                      }],
                                    });

                                    const writable = await handle.createWritable();
                                    await writable.write(blob);
                                    await writable.close();
                                    toast.success('保存しました');
                                    return;
                                  } catch (err: any) {
                                    // キャンセルされた場合は何もしない
                                    if (err.name === 'AbortError') return;
                                    console.warn('File Picker failed, falling back...', err);
                                  }
                                }

                                // 3. フォールバック: 従来のダウンロードリンク方式
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.style.display = 'none';
                                a.href = url;
                                a.download = filename;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                                toast.success('ダウンロードを開始しました'); // フォールバック時のメッセージ

                              } catch (error) {
                                console.error('Save error:', error);
                                toast.error('保存中にエラーが発生しました');
                              }
                            }}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold text-center cursor-pointer text-white"
                          >
                            動画を保存する 💾
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-20 flex flex-col items-center text-red-400">
                      書き出しに失敗したか、まだ開始されていません。
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;
