# LyricSync AI

AIを活用した歌詞同期・動画編集ツールです。
音源分離、Whisperによる自動文字起こし、そして字幕付き動画の書き出し機能を備えています。

## クイックスタート

詳細なセットアップ手順は [OPERATION_GUIDE.md](./OPERATION_GUIDE.md) を参照してください。

### 一括起動（推奨）

セットアップ完了後は `start.bat` をダブルクリックするだけでバックエンドとフロントエンドを同時に起動できます。

```
start.bat
```

- バックエンド: `http://localhost:8001`
- フロントエンド: `http://localhost:5150`
- 終了するには `Ctrl+C` を押してください。

### 手動起動

### 1. バックエンドの起動
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
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
- **歌詞エディタ:** 抽出された歌詞のタイミングや内容を自由に編集。プレビュー動画と連動してスクロール。
- **字幕動画の書き出し:** 元の音声＋字幕を焼き付けた動画を生成。字幕がない場合でも音声置換のみで書き出し可能。
- **AI動画の書き出し:** RVC（AI歌声変換）で生成したカバー音声＋字幕を焼き付けた動画を生成。字幕なし・カバーアート埋め込み動画でも正常に書き出し可能。
- **LAN対応:** 同一ネットワーク内の他PC・スマートフォンからもアクセス可能。

## 技術スタック
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Framer Motion
- **Backend:** FastAPI, Faster-Whisper, Demucs, RVC (rvc-python), FFmpeg
