import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileUpload } from './components/FileUpload';
import { LyricEditor } from './components/LyricEditor';
import { VideoPlayer } from './components/VideoPlayer';
import { StepNavigation } from './components/StepNavigation';
import { SettingsPanel } from './components/SettingsPanel';
import { useLyricSync } from './hooks/useLyricSync';
import { toast } from 'sonner';

type ExportState = { url: string; filename: string; downloadUrl?: string };

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const mimeFromFilename = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  return 'video/mp4';
};

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
    separationFailed,
    separationError,
    videoRef,
    setSegments,
    setActiveStep,
    handleFileUpload,
    handleVocalSeparation,
    clearSeparationResults,
    handleTranscribe,
    handleExport,
    handleTimeUpdate,
    handleSeek,
  } = useLyricSync();

  const [layoutDirection, setLayoutDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [isPlaying, setIsPlaying] = useState(false);
  const [originalExport, setOriginalExport] = useState<ExportState | null>(null);
  const [aiExport, setAiExport] = useState<ExportState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rvcModel, setRvcModel] = useState(() => localStorage.getItem('rvcModel') ?? '');
  const [indexFile, setIndexFile] = useState(() => localStorage.getItem('indexFile') ?? '');

  // iOS向け: 書き出し完了後にblobを事前取得しておく
  // これによりボタンタップ時にfetchなしでnavigator.shareを呼べる（ジェスチャー保持）
  const blobCacheRef = useRef<Map<string, Blob>>(new Map());

  const prefetchBlob = (url: string) => {
    if (blobCacheRef.current.has(url)) return;
    fetch(url)
      .then(r => r.blob())
      .then(blob => blobCacheRef.current.set(url, blob))
      .catch(() => {});
  };

  const runExport = async (isOriginal: boolean) => {
    const result = await handleExport(isOriginal);
    if (!result) return;
    const state: ExportState = {
      url: result.url,
      filename: result.filename,
      downloadUrl: result.download_url,
    };
    if (isOriginal) setOriginalExport(state);
    else setAiExport(state);
    prefetchBlob(state.url);
  };

  const handleSaveVideo = async (url: string, filename: string, downloadUrl?: string) => {
    const mime = mimeFromFilename(filename);

    if (isIOS()) {
      // iOSは navigator.share をユーザージェスチャー直後（await前）に呼ぶ必要がある。
      // 事前取得済みblobを使えばfetch不要なので即座に呼べる。
      const cached = blobCacheRef.current.get(url);
      if (cached && navigator.share) {
        const file = new File([cached], filename, { type: cached.type || mime });
        const canShare = !navigator.canShare || navigator.canShare({ files: [file] });
        if (canShare) {
          try {
            await navigator.share({ files: [file], title: filename });
            return;
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            // share失敗 → downloadUrlへフォールバック
          }
        }
      }
      // blobが未取得 or share非対応 → サーバーdownloadエンドポイントで直接ダウンロード
      if (downloadUrl) {
        window.location.href = downloadUrl;
        return;
      }
      // downloadUrlもなければURLを共有
      if (navigator.share) {
        try {
          await navigator.share({ url, title: filename });
        } catch { /* AbortError等は無視 */ }
      }
      return;
    }

    // --- 非iOS (PC/Android) ---
    toast.info('ダウンロード準備中...');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('fetch failed');
      const blob = await response.blob();

      // Chrome/Edge: File System Access API
      if ('showSaveFilePicker' in window) {
        try {
          const ext = filename.split('.').pop() ?? 'mp4';
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'Video File', accept: { [mime]: [`.${ext}`] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success('保存しました');
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
        }
      }

      // Androidなど: <a download>
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(objUrl);
      document.body.removeChild(a);
      toast.success('ダウンロードを開始しました');
    } catch {
      toast.error('保存中にエラーが発生しました');
    }
  };

  useEffect(() => {
    const onResize = () => setLayoutDirection(window.innerWidth >= 768 ? 'horizontal' : 'vertical');
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (activeStep === 'vocal' && !vocalPath && !isProcessing && !separationFailed) handleVocalSeparation(rvcModel || undefined, indexFile || undefined);
    if (activeStep === 'transcribe' && segments.length === 0 && !isProcessing) handleTranscribe();
    if (activeStep === 'export-original' && !originalExport && !isProcessing) runExport(true);
    if (activeStep === 'export-ai' && !aiExport && !isProcessing) runExport(false);
  }, [activeStep, vocalPath, isProcessing, separationFailed, segments.length, originalExport, aiExport, rvcModel, indexFile]);

  return (
    <div className="min-h-screen w-full bg-gray-950 text-white flex flex-col overflow-x-hidden">
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        rvcModel={rvcModel}
        indexFile={indexFile}
        onChange={(key, value) => {
          if (key === 'rvcModel') {
            setRvcModel(value);
            localStorage.setItem('rvcModel', value);
          } else {
            setIndexFile(value);
            localStorage.setItem('indexFile', value);
          }
          clearSeparationResults();
        }}
      />
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 flex flex-col relative h-screen">
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="text-gray-400 hover:text-gray-200 p-2 rounded-lg hover:bg-gray-800 transition-colors text-xl leading-none"
            aria-label="Voice Settings"
            title="ボイス設定"
          >
            &#9776;
          </button>
          {rvcModel && (
            <span className="text-xs text-gray-500 truncate max-w-[200px]">
              🎤 {rvcModel}
            </span>
          )}
        </div>
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
                      <FileUpload selectedFile={null} onFileSelect={handleFileUpload} />
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
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                        />
                      </div>
                      <p className="text-green-400 font-medium flex items-center justify-center gap-2">
                        <span>✅</span> File Uploaded: {uploadResult.filename}
                      </p>
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
                {isProcessing ? (
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
                        <div className="w-full p-6 bg-gray-900 rounded-2xl border border-gray-800 flex flex-col items-center justify-center gap-4 shadow-xl">
                          <div className="text-center text-gray-400">ボーカル抽出を待機中</div>
                        </div>
                      )}
                      {instrumentalPath && (
                        <div className="w-full mt-6 p-6 bg-gray-900 rounded-2xl border border-gray-800 flex flex-col items-center justify-center gap-4 shadow-xl">
                          <div className="p-4 bg-yellow-500/20 rounded-full animate-pulse">
                            <span className="text-4xl">🎸</span>
                          </div>
                          <h3 className="text-white font-bold text-lg">抽出された伴奏 (Instrumental)</h3>
                          <audio controls src={instrumentalPath} className="w-full mt-2" />
                        </div>
                      )}
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
                          separationFailed ? (
                            <div className="flex flex-col items-center justify-center p-6 bg-red-500/10 rounded-xl border border-red-500/20 gap-3">
                              <div className="text-red-400 font-bold">⚠️ 音声分離に失敗しました</div>
                              {separationError && (
                                <p className="text-xs text-red-300 font-mono bg-red-900/30 rounded p-2 w-full break-all">{separationError}</p>
                              )}
                              <button
                                onClick={() => handleVocalSeparation(rvcModel || undefined, indexFile || undefined)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                🔄 再試行
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-6 bg-blue-500/10 rounded-xl border border-blue-500/20">
                              <div className="text-blue-400 font-bold mb-2 animate-pulse">音声分離を開始しています...</div>
                              <p className="text-sm text-gray-400 text-center">自動的に処理が開始されます。</p>
                            </div>
                          )
                        ) : (
                          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm font-bold flex items-center gap-2">
                            <span>✨ 音声分離が完了しました</span>
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
                    {!isProcessing && segments.length === 0 && (
                      <div className="flex flex-col items-center justify-center p-6 bg-purple-500/10 rounded-xl border border-purple-500/20">
                        <div className="text-purple-400 font-bold mb-2 animate-pulse">文字起こしを開始しています...</div>
                        <p className="text-sm text-gray-400 text-center">自動的に処理が開始されます。</p>
                      </div>
                    )}
                    {isProcessing && (
                      <div className="p-8 flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                        <span className="text-purple-300 animate-pulse">AIが歌詞を解析中...</span>
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
                <div className={layoutDirection === 'horizontal' ? 'flex-[3] min-w-0' : 'w-full'}>
                  <VideoPlayer
                    uploadResult={uploadResult}
                    segments={segments}
                    currentTime={currentTime}
                    videoRef={videoRef}
                    onTimeUpdate={handleTimeUpdate}
                    compact={true}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  <div className="text-center text-gray-400 text-sm animate-pulse mt-4">
                    編集が終わったら上部の「書き出し」ボタンを押してください 🎬
                  </div>
                </div>

                <div className={layoutDirection === 'horizontal' ? 'flex-[1] min-w-0' : 'w-full'}>
                  <div className="bg-gray-900/40 border border-gray-800 rounded-2xl flex flex-col">
                    <div className="border-b border-gray-800 bg-gray-800/95 backdrop-blur-sm shrink-0 rounded-t-2xl">
                      <div className="p-3 flex items-center justify-between gap-3">
                        <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400 whitespace-nowrap">
                          Subtitle Editor
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400">
                            {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                          </span>
                          <button
                            onClick={() => {
                              const v = videoRef.current as HTMLVideoElement | null;
                              if (!v) return;
                              if (v.paused) { v.play().catch(() => {}); } else { v.pause(); }
                            }}
                            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}
                            className="bg-blue-600 active:bg-blue-400 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg transition-colors"
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
                    <div className="overflow-hidden rounded-b-2xl">
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

            {/* Step 5/6: Export */}
            {(activeStep === 'export-original' || activeStep === 'export-ai') && (() => {
              const isOriginal = activeStep === 'export-original';
              const currentExport = isOriginal ? originalExport : aiExport;
              const accentFrom = isOriginal ? 'from-blue-600' : 'from-violet-600';
              const accentTo = isOriginal ? 'to-blue-800' : 'to-purple-800';
              return (
                <motion.div
                  key={activeStep}
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.4 }}
                  className="w-full"
                >
                  <div className="max-w-3xl mx-auto w-full space-y-5">
                    {isProcessing ? (
                      <div className={`flex flex-col items-center justify-center py-24 gap-5 rounded-3xl bg-gradient-to-br ${accentFrom} ${accentTo} bg-opacity-10`}>
                        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                        <p className="font-bold text-lg text-white">
                          {isOriginal ? '字幕動画を書き出し中...' : 'AI動画を書き出し中...'}
                        </p>
                        <p className="text-sm text-white/50">字幕を焼き付けています。しばらくお待ちください</p>
                      </div>
                    ) : currentExport ? (
                      <>
                        <div className="rounded-2xl overflow-hidden border border-gray-700/60 shadow-2xl bg-black">
                          <video
                            src={currentExport.url}
                            controls
                            playsInline
                            className="w-full h-auto object-contain max-h-[55vh]"
                            autoPlay
                          />
                          <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-t border-gray-700/60">
                            <span className="text-xs text-gray-400 font-mono truncate flex-1">
                              {currentExport.filename}
                            </span>
                            <button
                              onClick={() => handleSaveVideo(currentExport.url, currentExport.filename, currentExport.downloadUrl)}
                              style={{ touchAction: 'manipulation' } as React.CSSProperties}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-sm font-medium text-white transition-colors shrink-0"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                                <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                              </svg>
                              保存
                            </button>
                            <button
                              onClick={() => {
                                if (currentExport.downloadUrl) {
                                  window.location.href = currentExport.downloadUrl;
                                } else {
                                  handleSaveVideo(currentExport.url, currentExport.filename, currentExport.downloadUrl);
                                }
                              }}
                              style={{ touchAction: 'manipulation' } as React.CSSProperties}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 active:bg-blue-500 text-sm font-medium text-white transition-colors shrink-0"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v8.19l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0L5.72 10.53a.75.75 0 1 1 1.06-1.06l2.47 2.47V3.75A.75.75 0 0 1 10 3Zm-6.25 13a.75.75 0 0 1 .75-.75h11a.75.75 0 0 1 0 1.5h-11a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
                              </svg>
                              DL
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (isOriginal) setOriginalExport(null);
                            else setAiExport(null);
                          }}
                          className="w-full py-2.5 rounded-xl border border-gray-700 hover:border-gray-500 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                          再書き出し
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-500">
                        <div className="w-8 h-8 border-2 border-gray-700 border-t-gray-500 rounded-full animate-spin" />
                        <p className="text-sm">書き出しを開始しています...</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })()}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;
