import { useState, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { LyricEditor } from './components/LyricEditor';
import { VideoPlayer } from './components/VideoPlayer';
import type { UploadResult, Segment } from './types';

function App() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLVideoElement>(null);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      audioRef.current.play();
    }
  };

  const handleTranscribe = async () => {
    setIsTranscribing(true);
    try {
      const response = await fetch('http://localhost:8000/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: 'vocals.wav' }),
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      // Add IDs to segments if not present
      const processedSegments = data.segments.map((seg: any, index: number) => ({
        id: seg.id ?? index, // Use index if id is missing
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

  const handleUploadComplete = (data: UploadResult) => {
    console.log('Upload complete:', data);
    setUploadResult(data);
  };

  const handleReset = () => {
    setUploadResult(null);
    setSegments([]);
  };

  return (
    <div className="min-h-screen w-full bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="shrink-0 py-4 text-center bg-gray-950/50 backdrop-blur z-10 border-b border-gray-800/50 sticky top-0">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
          LyricSync AI
        </h1>
        <p className="text-gray-400 text-xs mt-1">動画をアップロードして、AIで自動字幕生成</p>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 flex flex-col gap-6">
        {!uploadResult ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <div className="w-full max-w-2xl">
              <FileUpload onUploadComplete={handleUploadComplete} />
            </div>
          </div>
        ) : (
          <>
            {/* Video Area (Top) */}
            <VideoPlayer
              uploadResult={uploadResult}
              segments={segments}
              currentTime={currentTime}
              videoRef={audioRef}
              isTranscribing={isTranscribing}
              onTimeUpdate={handleTimeUpdate}
              onTranscribe={handleTranscribe}
              onReset={handleReset}
            />

            {/* Editor Area (Bottom) */}
            <div className="w-full flex flex-col bg-gray-900/30 border border-gray-700 rounded-xl overflow-hidden shadow-2xl min-h-[500px]">
              <div className="p-3 border-b border-gray-700 bg-gray-800/80 backdrop-blur flex justify-between items-center shrink-0">
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2 text-white">
                    <span className="text-blue-400">✏️</span> 字幕エディタ
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    編集内容はリアルタイムでプレビューに反映されます
                  </p>
                </div>
                <div className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                  {segments.length} 行
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative h-[500px]">
                {segments.length > 0 ? (
                  <div className="absolute inset-0 p-2">
                    <LyricEditor
                      segments={segments}
                      onSegmentsChange={setSegments}
                      currentTime={currentTime}
                      onSeek={handleSeek}
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 p-8 text-center bg-gray-900/50">
                    <div className="text-5xl mb-6 opacity-30">📝</div>
                    <p className="text-xl font-medium mb-3 text-gray-300">字幕データがありません</p>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
                      上のパネルから<br />
                      <span className="text-blue-400 font-bold">✨ 文字起こしを開始</span><br />
                      ボタンを押して字幕を生成してください
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
