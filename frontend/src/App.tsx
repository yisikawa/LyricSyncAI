import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileUpload } from './components/FileUpload';
import { LyricEditor } from './components/LyricEditor';
import { VideoPlayer } from './components/VideoPlayer';
import { StepNavigation } from './components/StepNavigation';
import { useLyricSync } from './hooks/useLyricSync';
import { toast } from 'sonner';

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

function App() {
  const {
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
    setSegments,
    setActiveStep,
    handleFileUpload,
    handleVocalSeparation,
    handleTranscribe,
    handleExport,
    handleTimeUpdate,
    handleSeek,
  } = useLyricSync();

  // レスポンシブ対応: 画面幅が768px以上なら横並び(horizontal)、それ以外は縦並び(vertical)
  const [layoutDirection, setLayoutDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [isPlaying, setIsPlaying] = useState(false);
  const [originalExport, setOriginalExport] = useState<{ url: string; filename: string } | null>(null);
  const [aiExport, setAiExport] = useState<{ url: string; filename: string } | null>(null);
  const [exportingVoice, setExportingVoice] = useState<'original' | 'ai' | null>(null);

  // 書き出し完了時に種別ごとに保存
  useEffect(() => {
    if (!exportResult) return;
    if (exportingVoice === 'original') setOriginalExport({ url: exportResult.url, filename: exportResult.filename });
    else if (exportingVoice === 'ai') setAiExport({ url: exportResult.url, filename: exportResult.filename });
  }, [exportResult]);

  // activeStepがexport以外になったらリセット不要（結果は保持）

  const handleDownload = async (url: string, filename: string) => {
    try {
      toast.info('ダウンロード準備中...');
      const response = await fetch(url);
      const blob = await response.blob();
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'Video File', accept: { 'video/mp4': ['.mp4'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success('保存しました');
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
        }
      }
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objUrl);
      document.body.removeChild(a);
      toast.success('ダウンロードを開始しました');
    } catch {
      toast.error('保存中にエラーが発生しました');
    }
  };

  useEffect(() => {
    const v = videoRef.current as HTMLVideoElement | null;
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => { v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause); };
  }, [videoRef.current]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setLayoutDirection('horizontal');
      } else {
        setLayoutDirection('vertical');
      }
    };

    // 初期実行
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // APIを直接叩くのではなく、UI上でのタブ切り替えを検知して自動実行
  useEffect(() => {
    // アクティブステップがvocalで、まだパスがなく、処理中でなければ自動実行
    if (activeStep === 'vocal' && !vocalPath && !isProcessing) {
      handleVocalSeparation();
    }
    // アクティブステップがtranscribeで、まだセグメントがなく、処理中でなければ自動実行
    if (activeStep === 'transcribe' && segments.length === 0 && !isProcessing) {
      handleTranscribe();
    }
  }, [activeStep, vocalPath, isProcessing, segments.length]);

  return (
    <div className="min-h-screen w-full bg-gray-950 text-white flex flex-col overflow-x-hidden">
      {/* Header */}


      <main className="flex-1 w-full max-w-7xl mx-auto p-4 flex flex-col relative h-screen">

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
                  {!uploadResult ? (
                    isUploading ? (
                      <div className="flex flex-col items-center justify-center py-20 space-y-6">
                        <div className="w-20 h-20 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        <div className="text-xl font-bold text-blue-400">Uploading...</div>
                      </div>
                    ) : (
                      <FileUpload
                        selectedFile={null}
                        onFileSelect={handleFileUpload}
                      />
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-full max-w-3xl bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800">
                        <VideoPlayer
                          uploadResult={uploadResult}
                          segments={segments}
                          currentTime={currentTime}
                          videoRef={videoRef}
                          onTimeUpdate={handleTimeUpdate}
                        />
                      </div>
                      <div className="text-center space-y-4">
                        <p className="text-green-400 font-medium flex items-center justify-center gap-2">
                          <span>✅</span> File Uploaded: {uploadResult.filename}
                        </p>
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
                {(isProcessing) ? ( // isProcessing here covers separation
                  <div className="flex flex-col items-center justify-center py-20 space-y-6">
                    <div className="w-20 h-20 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                      ボーカルを分離中...
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
                        // If no vocal path yet, show option to start
                        <div className="w-full p-6 bg-gray-900 rounded-2xl border border-gray-800 flex flex-col items-center justify-center gap-4 shadow-xl">
                          <div className="text-center text-gray-400">ボーカル抽出を待機中</div>
                        </div>
                      )}

                      {/* Instrumental Track */}
                      {instrumentalPath && (
                        <div className="w-full mt-6 p-6 bg-gray-900 rounded-2xl border border-gray-800 flex flex-col items-center justify-center gap-4 shadow-xl">
                          <div className="p-4 bg-yellow-500/20 rounded-full animate-pulse">
                            <span className="text-4xl">🎸</span>
                          </div>
                          <h3 className="text-white font-bold text-lg">抽出された伴奏 (Instrumental)</h3>
                          <audio controls src={instrumentalPath} className="w-full mt-2" />
                        </div>
                      )}

                      {/* AI Cover Integration */}
                      {aiCoverPath && (
                        <div className="w-full mt-6 p-6 bg-indigo-900/30 rounded-2xl border border-indigo-500/30 flex flex-col items-center justify-center gap-4 shadow-xl">
                          <div className="p-4 bg-indigo-500/20 rounded-full animate-pulse">
                            <span className="text-4xl">🤖</span>
                          </div>
                          <h3 className="text-white font-bold text-lg">AIカバー (RVC)</h3>
                          <audio controls src={aiCoverPath} className="w-full mt-2" />
                        </div>
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

                        {!vocalPath ? (
                          <div className="flex flex-col items-center justify-center p-6 bg-blue-500/10 rounded-xl border border-blue-500/20">
                            <div className="text-blue-400 font-bold mb-2 animate-pulse">
                              音声分離を開始しています...
                            </div>
                            <p className="text-sm text-gray-400 text-center">
                              自動的に処理が開始されます。
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm font-bold flex items-center gap-2">
                              <span>✨ 音声分離が完了しました</span>
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
                    {/* Controls */}
                    {!isProcessing && segments.length === 0 && (
                      <div className="flex flex-col items-center justify-center p-6 bg-purple-500/10 rounded-xl border border-purple-500/20">
                        <div className="text-purple-400 font-bold mb-2 animate-pulse">
                          文字起こしを開始しています...
                        </div>
                        <p className="text-sm text-gray-400 text-center">
                          自動的に処理が開始されます。
                        </p>
                      </div>
                    )}

                    {isProcessing && (
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

                        {!isProcessing && (
                          <div className="text-center pt-4">
                            <p className="text-green-400 font-bold mb-2">✨ 文字起こし完了</p>
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
                className={`w-full flex gap-4 ${layoutDirection === 'horizontal' ? 'flex-row items-start' : 'flex-col'}`}
              >
                {/* Video Player */}
                <div className={layoutDirection === 'horizontal' ? 'flex-[3] min-w-0' : 'w-full'}>
                  <VideoPlayer
                    uploadResult={uploadResult}
                    segments={segments}
                    currentTime={currentTime}
                    videoRef={videoRef}
                    onTimeUpdate={handleTimeUpdate}
                    compact={true}
                  />
                  <div className="text-center text-gray-400 text-sm animate-pulse mt-4">
                    編集が終わったら上部の「書き出し」ボタンを押してください 🎬
                  </div>
                </div>

                {/* Subtitle Editor */}
                <div className={layoutDirection === 'horizontal' ? 'flex-[1] min-w-0' : 'w-full'}>
                  <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
                    {/* Header + モバイル用スティッキーコントロール */}
                    <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-800/95 backdrop-blur-sm shrink-0">
                      <div className="p-3 flex items-center justify-between gap-3">
                        <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400 whitespace-nowrap">Subtitle Editor</h3>
                        {/* 再生コントロール（モバイルで常時表示） */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400">
                            {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                          </span>
                          <button
                            onClick={() => {
                              const v = videoRef.current as HTMLVideoElement | null;
                              if (!v) return;
                              v.paused ? v.play() : v.pause();
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg transition-colors"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              {isPlaying
                                ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                                : <path d="M8 5v14l11-7z" />}
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    <LyricEditor
                      segments={segments}
                      onSegmentsChange={setSegments}
                      currentTime={currentTime}
                      onSeek={handleSeek}
                      isProcessing={false}
                    />
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
                <div className="max-w-3xl mx-auto w-full space-y-6">

                  {/* 2-column export options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Column 1: 字幕動画（元の音声） */}
                    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col gap-3">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-3xl">🎬</span>
                        <div>
                          <h3 className="font-bold text-white text-base">字幕動画</h3>
                          <p className="text-xs text-gray-400">元の音声を使用</p>
                        </div>
                        {originalExport && (
                          <span className="ml-auto text-xs text-green-400 font-bold">✅ 完了</span>
                        )}
                      </div>

                      <button
                        onClick={() => { setExportingVoice('original'); handleExport(true); }}
                        disabled={isProcessing}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-colors"
                      >
                        {isProcessing && exportingVoice === 'original'
                          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />書き出し中...</>
                          : '🎬 書き出す'}
                      </button>

                      <button
                        onClick={() => originalExport && handleDownload(originalExport.url, originalExport.filename)}
                        disabled={!originalExport || isProcessing}
                        className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-colors"
                      >
                        💾 保存する
                      </button>

                      <button
                        onClick={() => {
                          if (!originalExport) return;
                          const a = document.createElement('a');
                          a.href = originalExport.url;
                          a.download = originalExport.filename;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        disabled={!originalExport || isProcessing}
                        className="w-full py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-colors"
                      >
                        ⬇️ ダウンロード
                      </button>
                    </div>

                    {/* Column 2: AI動画（AIカバー音声） */}
                    <div className={`bg-gray-900/50 border rounded-2xl p-6 flex flex-col gap-3 ${aiCoverPath ? 'border-indigo-800/60' : 'border-gray-800'}`}>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-3xl">🤖</span>
                        <div>
                          <h3 className="font-bold text-white text-base">AI動画</h3>
                          <p className="text-xs text-gray-400">AIカバー音声を使用</p>
                        </div>
                        {aiExport && (
                          <span className="ml-auto text-xs text-green-400 font-bold">✅ 完了</span>
                        )}
                      </div>

                      <button
                        onClick={() => { setExportingVoice('ai'); handleExport(false); }}
                        disabled={isProcessing || !aiCoverPath}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-colors"
                      >
                        {isProcessing && exportingVoice === 'ai'
                          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />書き出し中...</>
                          : '🤖 書き出す'}
                      </button>

                      <button
                        onClick={() => aiExport && handleDownload(aiExport.url, aiExport.filename)}
                        disabled={!aiExport || isProcessing}
                        className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-colors"
                      >
                        💾 保存する
                      </button>

                      <button
                        onClick={() => {
                          if (!aiExport) return;
                          const a = document.createElement('a');
                          a.href = aiExport.url;
                          a.download = aiExport.filename;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        disabled={!aiExport || isProcessing}
                        className="w-full py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-colors"
                      >
                        ⬇️ ダウンロード
                      </button>

                      {!aiCoverPath && (
                        <p className="text-xs text-gray-500 text-center pt-1">AIカバーが未生成です</p>
                      )}
                    </div>
                  </div>

                  {/* Video Preview */}
                  {exportResult && (
                    <div className="rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
                      <video
                        src={exportResult.url}
                        controls
                        className="w-full h-auto object-contain max-h-[60vh] bg-black"
                        autoPlay
                      />
                    </div>
                  )}

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main >
    </div >
  );
}

export default App;
