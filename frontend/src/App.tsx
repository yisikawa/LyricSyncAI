import { useState } from 'react';
import { FileUpload } from './components/FileUpload';

type UploadResult = {
  filename: string;
  filepath: string;
  message: string;
};

function App() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleUploadComplete = (data: UploadResult) => {
    console.log('Upload complete:', data);
    setUploadResult(data);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-4">
            LyricSync AI
          </h1>
          <p className="text-gray-400">動画をアップロードして、AIで自動字幕生成</p>
        </header>

        {!uploadResult ? (
          <FileUpload onUploadComplete={handleUploadComplete} />
        ) : (
          <div className="text-center p-8 border border-gray-700 rounded-xl bg-gray-900/50">
            <h2 className="text-2xl font-semibold text-green-400 mb-2">アップロード完了</h2>
            <p className="text-gray-300">ファイル: {uploadResult.filename}</p>
            <button
              onClick={() => setUploadResult(null)}
              className="mt-6 px-4 py-2 text-sm text-gray-400 hover:text-white underline"
            >
              別のファイルをアップロード
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
