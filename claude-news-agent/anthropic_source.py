"""Anthropic 사이트 파싱 어댑터 — sitemap·/news·/research HTML 파싱.

사이트 구조 변경 시 이 파일만 수정.
파싱 실패와 '새 글 없음'을 엄격히 구분 — 셀렉터 못 찾으면 ParseError raise.
"""
import os
import re
import urllib.parse
from datetime import datetime, timezone
from typing import List, Dict

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}
TIMEOUT = 20


class ParseError(Exception):
    """Anthropic 사이트 구조 변경 가능성 — 운영자에게 알려야 함"""


def fetch(url: str) -> str:
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    return r.text


def list_news(news_url: str, research_url: str) -> List[Dict]:
    """뉴스룸 + 리서치 페이지에서 글 목록 추출.
    반환: [{url, title, published_at?}]  (최신순 추정)
    """
    items = []
    for url, source in [(news_url, "news"), (research_url, "research")]:
        try:
            html = fetch(url)
            soup = BeautifulSoup(html, "lxml")
            # /news/ 또는 /research/ 로 시작하는 a 링크 추출
            prefix = "/news/" if source == "news" else "/research/"
            anchors = soup.find_all("a", href=re.compile(rf"^{prefix}[^/]+$"))
            if not anchors:
                raise ParseError(f"{source} 페이지에서 글 링크 0건 — CSS 선택자 또는 사이트 구조 변경 의심: {url}")
            seen = set()
            for a in anchors:
                href = a.get("href", "")
                if href in seen:
                    continue
                seen.add(href)
                full_url = urllib.parse.urljoin(url, href)
                title = a.get_text(strip=True) or href.rsplit("/", 1)[-1].replace("-", " ").title()
                items.append({"url": full_url, "title": title, "source": source})
        except requests.HTTPError as e:
            raise ParseError(f"{source} 페이지 HTTP {e.response.status_code}: {url}") from e
    return items


def fetch_article(url: str) -> Dict:
    """단일 글의 본문·이미지 추출.
    반환: {url, title, body_html, body_text, images:[{src, alt}], published_at?}
    """
    html = fetch(url)
    soup = BeautifulSoup(html, "lxml")

    # 제목 — h1 우선, 없으면 og:title
    title = None
    h1 = soup.find("h1")
    if h1:
        title = h1.get_text(strip=True)
    if not title:
        og = soup.find("meta", property="og:title")
        if og:
            title = og.get("content", "").strip()
    if not title:
        raise ParseError(f"제목 추출 실패 — 사이트 구조 변경 의심: {url}")

    # 본문 — main 또는 article 태그
    body_node = soup.find("article") or soup.find("main") or soup.find("body")
    if not body_node:
        raise ParseError(f"본문 영역 추출 실패: {url}")

    # 네비·푸터 제거
    for tag in body_node.find_all(["nav", "footer", "header", "script", "style"]):
        tag.decompose()

    body_text = body_node.get_text("\n", strip=True)
    if len(body_text) < 200:
        raise ParseError(f"본문 길이 비정상 ({len(body_text)}자) — 파싱 실패 의심: {url}")

    # 이미지 추출
    images = []
    for img in body_node.find_all("img"):
        src = img.get("src") or ""
        if not src:
            continue
        if src.startswith("data:"):
            continue
        full_src = urllib.parse.urljoin(url, src)
        alt = img.get("alt", "").strip()
        images.append({"src": full_src, "alt": alt})

    # 발행일 추정 (meta·time 태그)
    published_at = None
    for sel in [("meta", {"property": "article:published_time"}),
                ("meta", {"name": "publish_date"}),
                ("time", {})]:
        node = soup.find(*sel)
        if node:
            published_at = node.get("content") or node.get("datetime") or node.get_text(strip=True)
            if published_at:
                break

    return {
        "url": url,
        "title": title,
        "body_text": body_text,
        "images": images[:10],
        "published_at": published_at,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
