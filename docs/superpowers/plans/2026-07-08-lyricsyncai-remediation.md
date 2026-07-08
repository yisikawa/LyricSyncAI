# LyricSyncAI 修正計画書（Remediation Plan）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** コードレビューで検出したバグ・脆弱性・性能問題（書き出しファイルの上書き競合、パストラバーサル、イベントループブロッキング等）を修正する。

**Architecture:** バックエンドは FastAPI（`backend/main.py` がエンドポイント、`services.py` がオーケストレーション、`audio_processor.py` が ffmpeg/Demucs/Whisper 処理、`rvc_inference.py` が RVC 音声変換）。フロントエンドは React 19 + Vite + Tailwind（`App.tsx` が画面、`hooks/useLyricSync.ts` が状態管理、`services/api.ts` が API クライアント）。機能追加はせず、既存挙動を保ったまま欠陥のみ直す。

**Tech Stack:** Python / FastAPI / pydantic-settings / pytest（新規導入）、TypeScript / React 19 / Vite 7

## Global Constraints

- 実行環境は Windows 11。バックエンドは `backend\venv` の Python を使う（`backend\venv\Scripts\python`）。
- バックエンドのテスト・importチェックは必ず `backend` ディレクトリをカレントにして実行する（相対パス設定があるため）。
- フロントの検証は `frontend` で `npm run build`（`tsc -b` が型チェックを兼ねる）。テストランナーは導入しない。
- UI文言・APIのエラーメッセージは既存にあわせて日本語。
- コミットは1タスク1コミット。コミットメッセージは既存履歴にあわせて日本語サマリで書く（例: `音声分離後の直接書き出し対応とVoice設定の永続化`）。
- 機能仕様は変えない（自動遷移の無効化などユーザー要望による既存挙動を維持する）。
- torch / demucs / faster-whisper 等の重量級ライブラリは `backend/audio_processor.py` の import 時にロードされる。テストが遅くならないよう、**新規モジュール `path_utils.py` はこれらを一切 import しない**こと。

---

### Task 1: パストラバーサル対策とアップロード検証の強化

クライアント送信のファイル名（`file.filename`, `request.filename`, `request.video_filename`, `request.rvc_model`, `request.index_file`）が未検証のままパス結合されており、`..\..\evil.bat` のような名前で uploads 外の読み書きが可能。また `file.content_type` が `None` のとき `AttributeError` で 500 になる。サイズ上限もない。

**Files:**
- Create: `backend/path_utils.py`
- Create: `backend/tests/__init__.py`（空ファイル）
- Create: `backend/tests/test_path_utils.py`
- Modify: `backend/main.py`（`/upload`, `/separate`, `/export` 各エンドポイント）
- Modify: `backend/services.py`（`perform_transcription_generator` 冒頭）
- Modify: `backend/requirements.txt`（pytest 追加）

**Interfaces:**
- Produces: `path_utils.sanitize_filename(filename: str) -> str`（ディレクトリ成分を除去した安全なファイル名を返す。不正なら `HTTPException(400)` を送出）
- Produces: `path_utils.is_within(base_dir: Path, target: Path) -> bool`（`target` の解決結果が `base_dir` 配下なら True）
- 後続タスク（Task 2, 3）は本タスク適用後の `main.py` を前提とする。

- [ ] **Step 1: pytest をインストールし requirements に追記**

`backend/requirements.txt` の末尾に追記:

```
pytest
```

実行:

```powershell
cd d:\LLMprojects\LyricSyncAI\backend
.\venv\Scripts\pip install pytest
```

- [ ] **Step 2: 失敗するテストを書く**

`backend/tests/__init__.py` を空で作成。`backend/tests/test_path_utils.py`:

```python
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from path_utils import sanitize_filename, is_within


def test_sanitize_normal():
    assert sanitize_filename("demo.mp4") == "demo.mp4"


def test_sanitize_strips_backslash_traversal():
    assert sanitize_filename("..\\..\\evil.mp4") == "evil.mp4"


def test_sanitize_strips_slash_traversal():
    assert sanitize_filename("../../evil.mp4") == "evil.mp4"


def test_sanitize_rejects_empty():
    with pytest.raises(HTTPException):
        sanitize_filename("")


def test_sanitize_rejects_dot_only():
    with pytest.raises(HTTPException):
        sanitize_filename("..")


def test_is_within_accepts_child(tmp_path):
    assert is_within(tmp_path, tmp_path / "separated" / "a_vocals.wav")


def test_is_within_accepts_base_itself(tmp_path):
    assert is_within(tmp_path, tmp_path)


def test_is_within_rejects_escape(tmp_path):
    assert not is_within(tmp_path, tmp_path / ".." / "evil.wav")
```

- [ ] **Step 3: テストが失敗することを確認**

実行: `cd d:\LLMprojects\LyricSyncAI\backend; .\venv\Scripts\python -m pytest tests -v`
期待: 全テストが `ModuleNotFoundError: No module named 'path_utils'` で ERROR/FAIL。

- [ ] **Step 4: `backend/path_utils.py` を実装**

```python
from pathlib import Path

from fastapi import HTTPException


def sanitize_filename(filename: str) -> str:
    """クライアント指定のファイル名からディレクトリ成分を除去して返す。

    パス区切り（/ と \\）を正規化してファイル名部分のみ取り出す。
    空・ドットのみ等の不正な名前は 400 を送出する。
    """
    name = Path(filename.replace("\\", "/")).name
    if not name or name in (".", ".."):
        raise HTTPException(status_code=400, detail="無効なファイル名です")
    return name


def is_within(base_dir: Path, target: Path) -> bool:
    """target の解決結果が base_dir 配下（base_dir 自身を含む）なら True。"""
    base = base_dir.resolve()
    resolved = target.resolve()
    return resolved == base or base in resolved.parents
```

- [ ] **Step 5: テストが通ることを確認**

実行: `cd d:\LLMprojects\LyricSyncAI\backend; .\venv\Scripts\python -m pytest tests -v`
期待: 8件すべて PASS。

- [ ] **Step 6: `main.py` の各エンドポイントに適用**

`backend/main.py` の import に追加（12行目 `from config import settings` の下）:

```python
from path_utils import sanitize_filename
```

`/upload` エンドポイント（現行 47〜59行目）を以下に**置き換え**る（`content_type` の None ガード、ファイル名サニタイズ、2GBサイズ上限、失敗時の部分ファイル削除。`async def` → `def` にして同期コピーがイベントループを塞がないようにする）:

```python
MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024  # 2GB

@app.post("/upload")
def upload_video(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="無効なファイル形式です。動画ファイルをアップロードしてください。")

    safe_name = sanitize_filename(file.filename or "")
    file_path = UPLOAD_DIR / safe_name
    try:
        total = 0
        with file_path.open("wb") as buffer:
            while chunk := file.file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="ファイルサイズが上限（2GB）を超えています")
                buffer.write(chunk)
    except HTTPException:
        file_path.unlink(missing_ok=True)
        raise
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"ファイルの保存に失敗しました: {str(e)}")

    return {"filename": safe_name, "filepath": str(file_path), "message": "アップロードが完了しました。音声分離ステップで処理を開始します。"}
```

※ `shutil` import（5行目）はこの置き換えで未使用になるので削除する。

`/separate` エンドポイントの冒頭（現行 96〜99行目）を変更。`request.filename` に加え、RVCモデル名・インデックス名もサニタイズして後段に渡す:

```python
@app.post("/separate")
async def separate_endpoint(request: SeparateRequest, req: Request):
    safe_name = sanitize_filename(request.filename)
    video_path = UPLOAD_DIR / safe_name
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="動画ファイルが見つかりません")

    rvc_model = sanitize_filename(request.rvc_model) if request.rvc_model else None
    index_file = sanitize_filename(request.index_file) if request.index_file else None
```

そして同エンドポイント内の `generate_ai_cover(...)` 呼び出しの引数を `model_filename=rvc_model, index_filename=index_file` に変更する（`async def` → `def` の変更は Task 2 で行う）。

`/export` エンドポイント（現行 137〜139行目）:

```python
@app.post("/export")
async def export_endpoint(request: ExportRequest, req: Request):
    safe_name = sanitize_filename(request.video_filename)
    output_filename = export_video_with_subtitles(safe_name, request.segments, request.use_original_voice)
```

- [ ] **Step 7: `services.py` の transcribe 経路にガードを追加**

`backend/services.py` の import（3行目の下）に追加:

```python
from path_utils import is_within
```

`perform_transcription_generator` 内、`input_path = settings.upload_dir / filename`（現行123行目）の直後に挿入:

```python
    if not is_within(settings.upload_dir, input_path):
        yield {"error": "無効なファイルパスです"}
        return
```

※ transcribe は `separated/xxx_vocals.wav` のようなサブパス指定を受けるため、`sanitize_filename` ではなく `is_within` で「uploads 配下か」だけを検証する。

- [ ] **Step 8: 動作確認**

実行:

```powershell
cd d:\LLMprojects\LyricSyncAI\backend
.\venv\Scripts\python -c "from main import app; print('import OK')"
.\venv\Scripts\python -m pytest tests -v
```

期待: `import OK` が出力され、テスト全件 PASS（初回はモデル系ライブラリのimportで数十秒かかることがある）。

- [ ] **Step 9: コミット**

```powershell
cd d:\LLMprojects\LyricSyncAI
git add backend/path_utils.py backend/tests backend/main.py backend/services.py backend/requirements.txt
git commit -m "セキュリティ強化: ファイル名サニタイズとアップロード検証（パストラバーサル対策）"
```

---

### Task 2: 重い同期処理によるイベントループブロッキングの解消

`/separate`（Demucs+RVC で数分）と `/export`（ffmpeg）が `async def` のまま同期処理を実行しており、処理中は API 全体（`/uploads` の静的配信含む）が無応答になる。`def` に変えるだけで FastAPI がスレッドプールで実行する。

**Files:**
- Modify: `backend/main.py`（`/separate`, `/export` の関数定義行のみ）

**Interfaces:**
- Consumes: Task 1 適用後の `main.py`（`/upload` は Task 1 で `def` 化済み）
- Produces: 変更なし（エンドポイントのURL・リクエスト/レスポンス形式は不変）

- [ ] **Step 1: `async def` → `def` に変更**

`backend/main.py` で以下2行を変更する:

```python
# 変更前
async def separate_endpoint(request: SeparateRequest, req: Request):
# 変更後
def separate_endpoint(request: SeparateRequest, req: Request):
```

```python
# 変更前
async def export_endpoint(request: ExportRequest, req: Request):
# 変更後
def export_endpoint(request: ExportRequest, req: Request):
```

※ `/transcribe-live` は `StreamingResponse` + 同期ジェネレータの構成で、Starlette がスレッドプールで反復するため変更不要。`/transcribe` は元から `def` で正しい。

- [ ] **Step 2: サーバー起動と並行応答の確認（手動スモークテスト）**

実行:

```powershell
cd d:\LLMprojects\LyricSyncAI\backend
.\venv\Scripts\python -c "from main import app; print('import OK')"
```

期待: `import OK`。

（フル確認する場合: `uvicorn main:app --port 8001` を起動し、`/separate` 実行中に別ターミナルから `curl http://localhost:8001/` が即応答することを確認。動画ファイルが必要なため、無ければ import チェックのみで可。）

- [ ] **Step 3: コミット**

```powershell
cd d:\LLMprojects\LyricSyncAI
git add backend/main.py
git commit -m "処理中のAPI無応答を解消: 重い同期処理エンドポイントをスレッドプール実行に変更"
```

---

### Task 3: 書き出しファイル名の分離とキャッシュバスター（上書き競合バグの修正）

「オリジナル書き出し」と「AI書き出し」が同じ `exported_{filename}` に書き出すため、後から実行した方がサーバー上のファイルを上書きし、両プレビューが同じ動画を指す。またURLが不変のため再書き出し後もブラウザキャッシュで古い動画が表示される。

**Files:**
- Modify: `backend/services.py`（`export_video_with_subtitles` の出力ファイル名）
- Modify: `backend/main.py`（`/export` レスポンスのURLにタイムスタンプ付与）

**Interfaces:**
- Consumes: Task 1 適用後の `/export` エンドポイント
- Produces: 出力ファイル名 `exported_original_{video_filename}` / `exported_ai_{video_filename}`。レスポンス `url` は `.../uploads/{output_filename}?t={unix秒}` 形式になる（`filename`, `download_url` は従来形式のまま）。フロントは `url` をそのまま使うので変更不要。

- [ ] **Step 1: 出力ファイル名に音声種別を含める**

`backend/services.py` の `export_video_with_subtitles` 内（現行198行目）:

```python
# 変更前
    output_filename = f"exported_{video_filename}"
# 変更後
    voice_tag = "original" if use_original_voice else "ai"
    output_filename = f"exported_{voice_tag}_{video_filename}"
```

- [ ] **Step 2: `/export` レスポンスにキャッシュバスターを付与**

`backend/main.py` の先頭 import 群に `import time` を追加し、`/export` の return を変更:

```python
    base = str(req.base_url).rstrip("/")
    ts = int(time.time())
    return {
        "filename": output_filename,
        "url": f"{base}/uploads/{output_filename}?t={ts}",
        "download_url": f"{base}/download/{output_filename}"
    }
```

- [ ] **Step 3: 動作確認**

```powershell
cd d:\LLMprojects\LyricSyncAI\backend
.\venv\Scripts\python -c "from main import app; print('import OK')"
.\venv\Scripts\python -m pytest tests -v
```

期待: `import OK`、テスト全件 PASS。

- [ ] **Step 4: コミット**

```powershell
cd d:\LLMprojects\LyricSyncAI
git add backend/services.py backend/main.py
git commit -m "書き出しの上書き競合を修正: オリジナル/AIで出力ファイルを分離しキャッシュバスターを付与"
```

---

### Task 4: フロントの書き出し結果振り分けの修正

`App.tsx` は書き出し完了時の `activeStep` を見て original/ai に結果を振り分けており、書き出し中に別ステップへ移動すると結果が失われるか誤った側に格納される。呼び出し時のフラグで振り分けるように変更し、`exportResult` 状態そのものを廃止する。

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/hooks/useLyricSync.ts`

**Interfaces:**
- Consumes: `api.exportVideo` / `handleExport(originalVoiceFlag: boolean): Promise<ExportResponse | undefined>`（成功時レスポンス、失敗時 undefined。既存実装のまま）
- Produces: `useLyricSync` の戻り値から `exportResult` が消える。App 側は `runExport(isOriginal: boolean)` で書き出しと状態格納を行う。

- [ ] **Step 1: `useLyricSync.ts` から `exportResult` を削除**

`frontend/src/hooks/useLyricSync.ts` で以下を削除:

- 20行目: `const [exportResult, setExportResult] = useState<ExportResponse | null>(null);`
- `handleExport` 内の `setExportResult(result);`（128行目）
- `handleReset` 内の `setExportResult(null);`（146行目）
- 戻り値オブジェクトの `exportResult,`（185行目）
- 3行目の import から `ExportResponse` が未使用になる場合は削除（`handleExport` の戻り値型推論に不要なら消す。`tsc` のエラーに従うこと）

- [ ] **Step 2: `App.tsx` の振り分けロジックを書き換え**

`frontend/src/App.tsx` で以下を行う:

(a) `useLyricSync()` の分割代入から `exportResult,` を削除（現行44行目）。

(b) 現行77〜91行目の `useEffect`（`exportResult` を監視しているもの）を**削除**し、代わりに `prefetchBlob` 定義の直後へ以下を追加:

```tsx
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
```

(c) 自動実行の `useEffect`（現行187〜192行目）の書き出し2行を変更:

```tsx
    if (activeStep === 'export-original' && !originalExport && !isProcessing) runExport(true);
    if (activeStep === 'export-ai' && !aiExport && !isProcessing) runExport(false);
```

- [ ] **Step 3: 型チェック・ビルドで確認**

実行: `cd d:\LLMprojects\LyricSyncAI\frontend; npm run build`
期待: エラーなくビルド完了（未使用import等のTSエラーが出たら該当行を修正）。

- [ ] **Step 4: コミット**

```powershell
cd d:\LLMprojects\LyricSyncAI
git add frontend/src/App.tsx frontend/src/hooks/useLyricSync.ts
git commit -m "書き出し結果の振り分けを実行時フラグ基準に修正（ステップ移動時の取り違えを解消）"
```

---

### Task 5: 再生状態リスナーの修正（videoRef を deps に使う useEffect の除去）

`useEffect(..., [videoRef.current])` は ref の変化で再実行されないため、video 要素が後からマウントされると play/pause リスナーが付かず、編集画面の再生ボタンのアイコン状態がずれる。React 標準の props 経由に変更する。

**Files:**
- Modify: `frontend/src/components/VideoPlayer.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Produces: `VideoPlayerProps` に `onPlay?: () => void; onPause?: () => void;` が追加される。

- [ ] **Step 1: `VideoPlayer.tsx` に props を追加**

`VideoPlayerProps` インターフェースに追加:

```tsx
    onPlay?: () => void;
    onPause?: () => void;
```

コンポーネントの分割代入引数に `onPlay, onPause,` を追加し、**compact版・通常版の両方の** `<video>` 要素に以下を追加:

```tsx
                    onPlay={onPlay}
                    onPause={onPause}
```

- [ ] **Step 2: `App.tsx` のリスナー useEffect を削除し props で渡す**

現行167〜178行目の `useEffect`（`v.addEventListener('play', ...)` のもの）を**削除**。

App.tsx 内の `<VideoPlayer ...>` は2箇所（Step 1: Upload 内と Step 4: Edit 内）。**両方**に以下の props を追加:

```tsx
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
```

- [ ] **Step 3: ビルド確認**

実行: `cd d:\LLMprojects\LyricSyncAI\frontend; npm run build`
期待: エラーなし。

- [ ] **Step 4: コミット**

```powershell
cd d:\LLMprojects\LyricSyncAI
git add frontend/src/components/VideoPlayer.tsx frontend/src/App.tsx
git commit -m "再生状態の検知をprops経由に修正（リスナー未登録によるアイコンずれを解消）"
```

---

### Task 6: LAN IP ハードコードの解消

`192.168.111.10` が `main.py`（CORS）、`vite.config.ts`、`start.bat` の3箇所にハードコードされており、DHCP で IP が変わると全箇所の修正が必要。CORS は正規表現化し、フロントは env 変数化、start.bat は先頭の変数1箇所に集約する。

**Files:**
- Modify: `backend/main.py`（CORS設定）
- Modify: `frontend/vite.config.ts`
- Create: `frontend/.env.example`
- Create: `frontend/.env`（gitignore 済みのためコミットされない）
- Modify: `start.bat`

**Interfaces:**
- Produces: 環境変数 `VITE_LAN_HOST`（フロントの証明書ホスト名）。CORS はプライベートIP帯 + localhost をポート5150に限り許可。

- [ ] **Step 1: CORS を正規表現に変更**

`backend/main.py` の現行17〜30行目（`origins = [...]` と `app.add_middleware(...)`）を以下に置き換え:

```python
# CORS: localhost とプライベートIP帯からの :5150 のみ許可
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):5150",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 2: `vite.config.ts` を env 変数対応にする**

`frontend/vite.config.ts` 全体を以下に置き換え:

```ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const lanHost = env.VITE_LAN_HOST || '192.168.111.10'
  return {
    plugins: [
      react(),
      mkcert({
        hosts: ['localhost', lanHost],
      }),
    ],
    server: {
      https: {},
      host: true,
      port: 5150,
    },
  }
})
```

`frontend/.env.example` を作成:

```
# LAN上でHTTPSアクセスするホスト（このマシンのLAN IP）。証明書のSANに使われる。
VITE_LAN_HOST=192.168.111.10
```

`frontend/.env` を同内容で作成（現在の実IPを設定。ルートの .gitignore の `.env` により追跡されないことを `git status` で確認）。

- [ ] **Step 3: `start.bat` の IP を変数に集約**

`start.bat` を以下に置き換え（IPは先頭1箇所、停止方法の案内は Task 7 の stop.bat 前提の文言にする）:

```bat
@echo off
chcp 65001 > nul
setlocal

set LAN_IP=192.168.111.10

echo [LyricSyncAI] Starting...

echo [1/2] Starting backend (port 8001, HTTPS)...
start /b cmd /c "cd /d %~dp0backend && call .\venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8001 --ssl-keyfile %~dp0certs\key.pem --ssl-certfile %~dp0certs\cert.pem"

timeout /t 5 /nobreak > nul

echo.
echo [2/2] Starting frontend (HTTPS)...
echo Ctrl+C stops the frontend only. Run stop.bat to stop all services.
echo.
echo iOS access: https://%LAN_IP%:5150
echo.

cd /d %~dp0frontend
npm run dev
```

- [ ] **Step 4: 動作確認**

```powershell
cd d:\LLMprojects\LyricSyncAI\backend
.\venv\Scripts\python -c "from main import app; print('import OK')"
cd d:\LLMprojects\LyricSyncAI\frontend
npm run build
```

期待: 両方エラーなし。`git status` で `frontend/.env` が untracked に**現れない**こと（gitignore が効いている）。

- [ ] **Step 5: コミット**

```powershell
cd d:\LLMprojects\LyricSyncAI
git add backend/main.py frontend/vite.config.ts frontend/.env.example start.bat
git commit -m "LAN IPハードコードを解消: CORS正規表現化とVITE_LAN_HOST導入"
```

---

### Task 7: stop.bat の追加（バックエンドが停止できない問題）

start.bat はバックエンドを `start /b` で別プロセス起動するため、Ctrl+C ではフロントしか止まらず uvicorn がポート8001を掴んだまま残る（次回起動失敗の原因）。ポート番号からプロセスを特定して停止する stop.bat を追加する。

**Files:**
- Create: `stop.bat`

**Interfaces:**
- Consumes: バックエンド=ポート8001、フロント=ポート5150 という既存の固定ポート。

- [ ] **Step 1: `stop.bat` を作成**

```bat
@echo off
chcp 65001 > nul
echo [LyricSyncAI] Stopping services...

echo Stopping backend (port 8001)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo Stopping frontend (port 5150)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5150 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo Done.
pause
```

- [ ] **Step 2: 動作確認**

サーバーが起動していない状態で `stop.bat` を実行してもエラーにならず `Done.` まで到達することを確認:

```powershell
cd d:\LLMprojects\LyricSyncAI
cmd /c stop.bat < nul
```

期待: エラーなく `Done.` が表示される。

- [ ] **Step 3: コミット**

```powershell
cd d:\LLMprojects\LyricSyncAI
git add stop.bat
git commit -m "stop.bat追加: バックエンド/フロントをポート指定で確実に停止"
```

---

### Task 8: requirements.txt の整理（未使用依存の削除とバージョンピン留め）

`openai-whisper` はコード中で一切 import されておらず（faster-whisper のみ使用）、巨大な依存を無駄に引き込んでいる。また全パッケージが無ピン留めで環境再構築が壊れやすい。

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: 未使用を確認して削除**

確認コマンド（ヒットが無いこと）:

```powershell
cd d:\LLMprojects\LyricSyncAI\backend
findstr /s /i /c:"import whisper" /c:"from whisper" *.py
```

期待: 出力なし（`faster_whisper` のヒットは無関係なので無視。`findstr` は完全一致行検索ではないため、ヒットした行が `faster_whisper` のものだけなら削除してよい）。

`backend/requirements.txt` から `openai-whisper` の行を削除する。

- [ ] **Step 2: インストール済みバージョンでピン留め**

現在の venv のバージョンを確認:

```powershell
cd d:\LLMprojects\LyricSyncAI\backend
.\venv\Scripts\pip freeze | findstr /i "fastapi uvicorn python-multipart faster-whisper demucs moviepy ffmpeg-python soundfile pydantic-settings python-dotenv rvc-python pytest torch"
```

出力された `パッケージ==バージョン` を使い、`requirements.txt` の各行を `fastapi==X.Y.Z` 形式に書き換える（`uvicorn[standard]==X.Y.Z` の extras 表記は維持）。`torch` は requirements に無いが、GPU環境依存のためコメントで実バージョンを記録しておく:

```
# torch はCUDA構成依存のため手動インストール（現環境: torch==<pip freezeの値>）
```

- [ ] **Step 3: 整合性確認**

```powershell
cd d:\LLMprojects\LyricSyncAI\backend
.\venv\Scripts\pip install -r requirements.txt --dry-run
```

期待: エラーなし（既存環境と一致するため実質何もインストールされない）。

- [ ] **Step 4: コミット**

```powershell
cd d:\LLMprojects\LyricSyncAI
git add backend/requirements.txt
git commit -m "requirements整理: 未使用のopenai-whisper削除とバージョンピン留め"
```

---

### Task 9: 個人用デフォルトの削除と 保存/DL ボタンの挙動分離

`App.tsx` に個人環境のモデル名 `n-buna.pth` / `n-buna_v2.index` がデフォルト値としてハードコードされている（モデルが無い環境ではAIカバーが黙ってスキップされる）。また書き出し画面の「保存」と「DL」ボタンが全く同じ処理を呼んでいる。

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: デフォルトモデル名を空にする**

現行62〜63行目:

```tsx
// 変更前
  const [rvcModel, setRvcModel] = useState(() => localStorage.getItem('rvcModel') ?? 'n-buna.pth');
  const [indexFile, setIndexFile] = useState(() => localStorage.getItem('indexFile') ?? 'n-buna_v2.index');
// 変更後
  const [rvcModel, setRvcModel] = useState(() => localStorage.getItem('rvcModel') ?? '');
  const [indexFile, setIndexFile] = useState(() => localStorage.getItem('indexFile') ?? '');
```

※ 空文字の場合、`handleVocalSeparation(rvcModel || undefined, ...)` により backend 側は `ai_cover_params.json` のデフォルト（`model.pth`）にフォールバックする。既存のフォールバック設計どおりの挙動。

- [ ] **Step 2: 「DL」ボタンをサーバー直接ダウンロードに変更**

書き出し画面の2つ目のボタン（`DL` ラベル、青色 `bg-blue-700` のもの）の `onClick` を変更:

```tsx
// 変更前
                              onClick={() => handleSaveVideo(currentExport.url, currentExport.filename, currentExport.downloadUrl)}
// 変更後
                              onClick={() => {
                                if (currentExport.downloadUrl) {
                                  window.location.href = currentExport.downloadUrl;
                                } else {
                                  handleSaveVideo(currentExport.url, currentExport.filename, currentExport.downloadUrl);
                                }
                              }}
```

※「保存」= 共有シート/保存ダイアログ経由、「DL」= `/download` エンドポイントの Content-Disposition による直接ダウンロード、と役割が分かれる。

- [ ] **Step 3: ビルド確認**

実行: `cd d:\LLMprojects\LyricSyncAI\frontend; npm run build`
期待: エラーなし。

- [ ] **Step 4: コミット**

```powershell
cd d:\LLMprojects\LyricSyncAI
git add frontend/src/App.tsx
git commit -m "個人用モデル名のデフォルトを削除しDLボタンを直接ダウンロードに変更"
```

---

### Task 10: デッドコード削除と設定のCWD非依存化

未使用の関数・重複import・作業メモコメントを削除し、`config.py` の相対パス（`uploads` 等）を `backend` ディレクトリ基準の絶対パスに変える（backend 以外から起動すると別の場所にフォルダが作られる問題の解消）。

**Files:**
- Modify: `backend/config.py`
- Modify: `backend/main.py`
- Modify: `backend/services.py`
- Modify: `backend/audio_processor.py`
- Modify: `frontend/src/hooks/useLyricSync.ts`

- [ ] **Step 1: `config.py` を `__file__` 基準にする**

冒頭（import の直後）に追加し、デフォルトパスを差し替え:

```python
BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    upload_dir: Path = BASE_DIR / "uploads"
    whisper_model: str = "medium"
    demucs_model: str = "htdemucs"
    api_port: int = 8001
    ffmpeg_path: str = "ffmpeg"  # Default to 'ffmpeg' in PATH

    rvc_model_path: Path = BASE_DIR / "models" / "rvc" / "model.pth"
    rvc_index_path: Path = BASE_DIR / "models" / "rvc" / "model.index"
    rvc_f0_method: str = "rmvpe"
```

（クラス内の `@property` 群・`model_config` は現状のまま）

さらに 110行目の `AI_PARAMS_FILE` も変更:

```python
# 変更前
AI_PARAMS_FILE = Path("ai_cover_params.json").absolute()
# 変更後
AI_PARAMS_FILE = BASE_DIR / "ai_cover_params.json"
```

また `model_config` に `"env_file": ".env"` とあるがこれもCWD依存。以下に変更:

```python
    model_config = {
        "env_file": str(Path(__file__).resolve().parent / ".env"),
        "env_file_encoding": "utf-8"
    }
```

※ クラス定義内では `BASE_DIR` を参照できるので `str(BASE_DIR / ".env")` でも可。

- [ ] **Step 2: `main.py` の掃除**

- 1行目 `# Trigger Reload 2` を削除
- 9行目の import から `get_upload_dir` を削除: `from services import perform_transcription, export_video_with_subtitles`
- 66〜70行目の作業メモコメント5行を削除し、以下の1行に置き換え: `# services層はエラー時Noneを返す（ファイル未検出/処理エラーの区別なし）`
- 80〜83行目（ファイル中腹の `from fastapi.responses import ...`、`import json`、`import mimetypes`、`from services import perform_transcription_generator`）をファイル先頭の import 群へ移動

- [ ] **Step 3: `services.py` の掃除**

- `get_upload_dir` 関数（5〜6行目）を削除
- `process_video_background` 関数（82〜109行目）を削除（どこからも呼ばれていない）
- 2行目の import から `transcribe_audio` を削除: `from audio_processor import extract_audio, separate_vocals, create_srt, burn_subtitles`

- [ ] **Step 4: `audio_processor.py` の掃除**

- 158行目の重複 `from faster_whisper import WhisperModel` を削除（11行目に既にある）
- `transcribe_audio` 関数（221〜237行目）を削除（services からの参照は Step 3 で除去済み。念のため確認: `findstr /s /i "transcribe_audio" backend\*.py` で `transcribe_audio_generator` 以外のヒットが無いこと）

- [ ] **Step 5: `useLyricSync.ts` の掃除**

- `handleSkipSeparation` 関数（86〜93行目、作業メモコメント含む）を削除
- 戻り値オブジェクトから `handleSkipSeparation,` を削除
- 44行目・115行目の `// setActiveStep(...); // Auto-navigation disabled per user request` 系コメントは「自動遷移させない」という仕様の記録なので**残してよい**（1行に簡潔化推奨: `// 自動遷移はユーザー要望により無効化`）

- [ ] **Step 6: 動作確認**

```powershell
cd d:\LLMprojects\LyricSyncAI\backend
.\venv\Scripts\python -c "from main import app; print('import OK')"
.\venv\Scripts\python -m pytest tests -v
cd d:\LLMprojects\LyricSyncAI\frontend
npm run build
```

期待: すべてエラーなし。

- [ ] **Step 7: コミット**

```powershell
cd d:\LLMprojects\LyricSyncAI
git add backend/config.py backend/main.py backend/services.py backend/audio_processor.py frontend/src/hooks/useLyricSync.ts
git commit -m "デッドコード削除と設定パスのCWD非依存化"
```

---

## 最終確認（全タスク完了後）

- [ ] `cd backend; .\venv\Scripts\python -m pytest tests -v` → 全件 PASS
- [ ] `cd backend; .\venv\Scripts\python -c "from main import app; print('OK')"` → OK
- [ ] `cd frontend; npm run build` → エラーなし
- [ ] `start.bat` でアプリを起動し、動画アップロード → 音声分離 → 文字起こし → 編集 → オリジナル書き出し → AI書き出し の一連フローを手動確認。特に以下を確認する:
  - オリジナル書き出しとAI書き出しの動画が**別ファイル**（`exported_original_*` / `exported_ai_*`）として生成され、両プレビューが正しい方を表示する
  - AI書き出し中に別ステップへ移動しても、完了後に export-ai 側へ結果が入っている
  - 編集画面の再生/一時停止ボタンのアイコンが動画の状態と一致する
- [ ] `stop.bat` で uvicorn（ポート8001）と Vite（5150）が両方停止する

## 対応しない項目（今回のスコープ外）

- `print` ベースのログを `logging` へ統一する件（規模の割に実益が小さいため見送り。新規コードでは `logging` を推奨）
- アップロード同名ファイルの上書き挙動（パイプラインがファイル名をキーに動く現設計を維持。上書きは仕様とする）
- `mixed_export_*.mp3` / `ai_cover_*.wav` 等の中間ファイル自動削除（`clear_uploads.bat` での手動運用を継続）
- `manual_process.py` / `check_rvc.py`（開発補助スクリプトのため対象外。Task 10 の config 変更で自動的にCWD非依存の恩恵は受ける）
