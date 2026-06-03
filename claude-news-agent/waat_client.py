"""WAAT 사이트 게시 클라이언트.

- posts INSERT: Supabase Management API의 database/query (SUPABASE_ACCESS_TOKEN 사용)
  또는 service_role_key 사용 (둘 중 하나 있으면 작동)
- Storage 이미지 업로드: service_role_key 필요. 없으면 본문 마크다운 외부 링크 폴백.
"""
import json
import os
import time
import urllib.parse
import urllib.request
import urllib.error
from typing import List, Dict, Optional

import requests


SUPABASE_URL = os.environ.get("WAAT_SUPABASE_URL", "").rstrip("/")
SUPABASE_REF = os.environ.get("WAAT_SUPABASE_PROJECT_REF") \
    or (SUPABASE_URL.split("//", 1)[-1].split(".", 1)[0] if SUPABASE_URL else "")
SERVICE_ROLE = os.environ.get("WAAT_SUPABASE_SERVICE_ROLE_KEY", "")
ACCESS_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")  # Management API
BOT_USER_ID = os.environ.get("WAAT_BOT_USER_ID", "")
CATEGORY = os.environ.get("WAAT_CATEGORY", "AI 새 소식")
STORAGE_BUCKET = os.environ.get("WAAT_STORAGE_BUCKET", "post-images")
MAX_IMAGES = int(os.environ.get("MAX_IMAGES_PER_POST", "5"))

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def _mgmt_sql(query: str) -> List[Dict]:
    """Management API의 database/query — SUPABASE_ACCESS_TOKEN 필요"""
    if not (ACCESS_TOKEN and SUPABASE_REF):
        raise RuntimeError("SUPABASE_ACCESS_TOKEN 또는 WAAT_SUPABASE_PROJECT_REF 미설정")
    url = f"https://api.supabase.com/v1/projects/{SUPABASE_REF}/database/query"
    data = json.dumps({"query": query}).encode()
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": UA,
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        s = r.read().decode()
        return json.loads(s) if s else []


def _sql_escape(s: str) -> str:
    return s.replace("'", "''")


def _to_sql_array(urls: List[str]) -> str:
    if not urls:
        return "ARRAY[]::text[]"
    esc = ",".join(f"'{_sql_escape(u)}'" for u in urls)
    return f"ARRAY[{esc}]::text[]"


def upload_image_to_storage(image_bytes: bytes, filename: str, content_type: str) -> Optional[str]:
    """Storage에 업로드 → public URL 반환. service_role_key 없으면 None."""
    if not (SERVICE_ROLE and SUPABASE_URL):
        return None
    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in filename)[:80]
    path = f"news/{int(time.time())}_{safe_name}"
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{urllib.parse.quote(path)}"
    headers = {
        "Authorization": f"Bearer {SERVICE_ROLE}",
        "apikey": SERVICE_ROLE,
        "Content-Type": content_type or "application/octet-stream",
        "x-upsert": "true",
    }
    r = requests.post(upload_url, headers=headers, data=image_bytes, timeout=30)
    if r.status_code in (200, 201):
        return f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{urllib.parse.quote(path)}"
    return None


def _guess_mime(url: str, default="image/png") -> str:
    u = url.lower()
    if u.endswith(".jpg") or u.endswith(".jpeg"):
        return "image/jpeg"
    if u.endswith(".webp"):
        return "image/webp"
    if u.endswith(".gif"):
        return "image/gif"
    if u.endswith(".png"):
        return "image/png"
    return default


def upload_images(image_urls: List[str]) -> List[str]:
    """Anthropic 원본 이미지 URL들을 받아 Storage에 업로드 후 public URL 배열 반환.
    service_role_key 없으면 빈 배열 (호출부에서 본문 마크다운 외부 링크로 폴백)."""
    if not SERVICE_ROLE:
        return []
    uploaded = []
    for src in image_urls[:MAX_IMAGES]:
        try:
            r = requests.get(src, headers={"User-Agent": UA}, timeout=20)
            r.raise_for_status()
            if len(r.content) > 5 * 1024 * 1024:
                continue  # 5MB 초과
            mime = _guess_mime(src, r.headers.get("Content-Type", "image/png").split(";")[0].strip())
            filename = src.rsplit("/", 1)[-1].split("?")[0] or f"image_{len(uploaded)}.png"
            url = upload_image_to_storage(r.content, filename, mime)
            if url:
                uploaded.append(url)
        except Exception:
            continue
    return uploaded


def insert_post(title: str, content: str, image_urls: List[str], source_url: str) -> Optional[int]:
    """posts 테이블에 INSERT. 성공 시 post id 반환."""
    if not BOT_USER_ID:
        raise RuntimeError("WAAT_BOT_USER_ID 미설정")
    sql = f"""
INSERT INTO posts (user_id, title, content, category, image_urls, fb_url)
VALUES (
    '{BOT_USER_ID}',
    '{_sql_escape(title)}',
    '{_sql_escape(content)}',
    '{_sql_escape(CATEGORY)}',
    {_to_sql_array(image_urls)},
    '{_sql_escape(source_url)}'
)
RETURNING id;
"""
    result = _mgmt_sql(sql)
    if result and isinstance(result, list) and result:
        return result[0].get("id")
    return None
