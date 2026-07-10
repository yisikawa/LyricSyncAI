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
