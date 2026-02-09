# LyricSync AI

AIを活用した歌詞同期・動画編集ツールです。
音源分離、Whisperによる自動文字起こし、そして字幕付き動画の書き出し機能を備えています。

## クイックスタート

詳細なセットアップ手順は [OPERATION_GUIDE.md](./OPERATION_GUIDE.md) を参照してください。

### 1. バックエンドの起動
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### 2. フロントエンドの起動
```powershell
cd frontend
npm install
npm run dev
```

## 主な機能
- **音源分離:** Demucsを使用してボーカルとBGMを分離。
- **自動文字起こし:** Faster-Whisperを使用して動画から歌詞を抽出。
- **歌詞エディタ:** 抽出された歌詞のタイミングや内容を自由に編集。
- **動画書き出し:** 編集した歌詞を字幕として動画に焼き付け。

## 技術スタック
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Framer Motion
- **Backend:** FastAPI, OpenAI Whisper, Demucs, FFmpeg
