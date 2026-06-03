"""history.json 관리 — 처리한 글 URL·시각 기록 + portalocker 잠금 (cron 중복 기동 방지)"""
import json
import os
import time
from pathlib import Path

try:
    import portalocker
    HAS_LOCK = True
except ImportError:
    HAS_LOCK = False

HISTORY_FILE = Path(__file__).parent / "history.json"


def _empty():
    return {"version": 1, "processed": {}, "last_poll_ts": None}


def load():
    if not HISTORY_FILE.exists():
        return _empty()
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            if HAS_LOCK:
                portalocker.lock(f, portalocker.LOCK_SH)
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return _empty()


def already_processed(url):
    data = load()
    return url in data.get("processed", {})


def record(url, meta):
    """meta: {title_ko, waat_post_id, critique_score, regenerated, ts_iso}"""
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(HISTORY_FILE, "a+", encoding="utf-8") as f:
        if HAS_LOCK:
            portalocker.lock(f, portalocker.LOCK_EX)
        f.seek(0)
        try:
            data = json.load(f)
        except (json.JSONDecodeError, ValueError):
            data = _empty()
        data["processed"][url] = meta
        data["last_poll_ts"] = time.time()
        f.seek(0)
        f.truncate()
        json.dump(data, f, ensure_ascii=False, indent=2)


def mark_poll_ts():
    """폴링 자체 시각만 기록 (글 없어도 watchdog 용도)"""
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(HISTORY_FILE, "a+", encoding="utf-8") as f:
        if HAS_LOCK:
            portalocker.lock(f, portalocker.LOCK_EX)
        f.seek(0)
        try:
            data = json.load(f)
        except (json.JSONDecodeError, ValueError):
            data = _empty()
        data["last_poll_ts"] = time.time()
        f.seek(0)
        f.truncate()
        json.dump(data, f, ensure_ascii=False, indent=2)


def last_poll_age_seconds():
    data = load()
    ts = data.get("last_poll_ts")
    if not ts:
        return None
    return time.time() - ts
