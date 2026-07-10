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
