import { useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileUpload } from './components/FileUpload';
import { LyricEditor } from './components/LyricEditor';
import { VideoPlayer } from './components/VideoPlayer';
import { StepNavigation } from './components/StepNavigation';
import { useLyricsProcessor } from './hooks/useLyricsProcessor';
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
      // DO NOT automatically move - let the user stay in Step 1 to confirm selection
    }
  };

  const handleUploadAndStart = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('http://localhost:8001/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();

      setUploadResult(data);
      // After upload, trigger separation automatically as part of "Start"
      await handleStartVocalSeparationInternal(data);
    } catch (e) {
      console.error(e);
      alert('アップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartVocalSeparationInternal = async (result: UploadResult) => {
    setIsSeparating(true);
    try {
      const response = await fetch('http://localhost:8001/separate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: result.filename }),
      });
      const data = await response.json();
      if (data.vocals_url) {
        setVocalPath(data.vocals_url);
        unlockStep('transcribe');
      } else {
        alert('分離に失敗しました');
      }
    } catch (e) {
      console.error(e);
      alert('サーバーエラーが発生しました');
    } finally {
      setIsSeparating(false);
    }
  };

  const onTranscribeClick = async () => {
    await handleTranscribe(vocalPath || uploadResult?.filename);
    unlockStep('edit');
  };

  const onExportClick = async () => {
    const result = await handleExport();
    if (result && result.url) {
      setExportedVideoUrl(result.url);
      unlockStep('export');
      setActiveStep('export');
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
          onStepChange={setActiveStep}
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
                    <VideoPlayer
                      uploadResult={uploadResult}
                      localFile={selectedFile}
                      segments={[]}
                      currentTime={currentTime}
                      videoRef={videoRef}
                      onTimeUpdate={handleTimeUpdate}
                    />
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
                {/* Unified Start Button at the TOP of Step 2 */}
                {!vocalPath && (
                  <div className="flex justify-center max-w-xl mx-auto">
                    <button
                      onClick={uploadResult ? () => handleStartVocalSeparationInternal(uploadResult) : handleUploadAndStart}
                      disabled={(!selectedFile && !uploadResult) || isUploading || isSeparating}
                      className={`
                        w-full py-5 rounded-2xl font-bold transition-all shadow-2xl flex items-center justify-center gap-4 text-lg
                        ${isUploading || isSeparating
                          ? 'bg-blue-900/40 text-blue-300 cursor-wait border border-blue-500/30'
                          : 'bg-gradient-to-br from-blue-600 to-indigo-700 hover:scale-[1.02] active:scale-[0.98] text-white shadow-blue-500/20'
                        }
                      `}
                    >
                      {isUploading || isSeparating ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <div>{isUploading ? 'アップロード中...' : '音声分離中...'}</div>
                        </>
                      ) : (
                        <>
                          <div className="bg-white/20 p-2 rounded-lg">🎙️</div>
                          <div>音声分離を開始する</div>
                        </>
                      )}
                    </button>
                  </div>
                )}

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
                      <VideoPlayer
                        uploadResult={uploadResult}
                        localFile={selectedFile}
                        segments={[]}
                        currentTime={currentTime}
                        videoRef={videoRef}
                        onTimeUpdate={handleTimeUpdate}
                      />
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
                          <button
                            onClick={() => {
                              unlockStep('transcribe');
                              setActiveStep('transcribe');
                            }}
                            className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors"
                          >
                            次のステップ（文字おこし）へ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Transcription */}
            {activeStep === 'transcribe' && uploadResult && (
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
                    {!isTranscribing && (
                      <button
                        onClick={onTranscribeClick}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 py-4 rounded-xl font-bold shadow-xl hover:scale-[1.01] transition-all"
                      >
                        {segments.length > 0 ? "文字おこしをやり直す 🔄" : "文字おこしを開始する ✨"}
                      </button>
                    )}

                    {isTranscribing && (
                      <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl flex items-center gap-4 animate-pulse">
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-blue-300 text-sm">AIが音声を解析しています...</span>
                      </div>
                    )}

                    {segments.length > 0 && (
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
                          <button
                            onClick={() => setActiveStep('edit')}
                            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold"
                          >
                            Step 4: 字幕編集へ進む ✏️
                          </button>
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
                    <button
                      onClick={onExportClick}
                      disabled={isExporting}
                      className="w-full bg-gradient-to-r from-green-600 to-blue-600 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
                    >
                      {isExporting ? '書き出し中...' : 'Step 5: 動画を書き出す 🚀'}
                    </button>
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
                  <div className="text-5xl mb-6">🎉</div>
                  <h3 className="text-2xl font-bold mb-2">動画の書き出しが完了しました！</h3>
                  {exportedVideoUrl ? (
                    <div className="space-y-6">
                      <div className="rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
                        <video src={exportedVideoUrl} controls className="w-full" />
                      </div>
                      <div className="flex gap-4">
                        <a
                          href={exportedVideoUrl}
                          download={`exported_${uploadResult?.filename}`}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold text-center"
                        >
                          動画を保存する 💾
                        </a>
                        <button
                          onClick={() => setActiveStep('edit')}
                          className="flex-1 bg-gray-800 hover:bg-gray-700 py-4 rounded-xl font-bold"
                        >
                          再編集する ✏️
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 flex flex-col items-center">
                      <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
                      <p className="text-blue-400 font-medium">生成ファイルを準備中...</p>
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
