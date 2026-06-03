"""claude-news-agent 진입점.

사용:
  python run.py --once          # 폴링 1회만 실행하고 종료 (바탕화면 바로가기·작업 스케줄러용)
  python run.py --loop          # 무한 루프 (POLL_INTERVAL_SEC 간격, 기본 900초=15분)
  python run.py --dry-run       # WAAT 게시 없이 콘솔 출력만
"""
import argparse
import os
import sys
import time
import traceback
from pathlib import Path

# Windows 콘솔 cp949 → UTF-8 강제
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except Exception:
    pass

import anthropic_source
import engine
import memory
import notifier
import waat_client


NEWS_URL = os.environ.get("ANTHROPIC_NEWS_URL", "https://www.anthropic.com/news")
RESEARCH_URL = os.environ.get("ANTHROPIC_RESEARCH_URL", "https://www.anthropic.com/research")
POLL_INTERVAL_SEC = int(os.environ.get("POLL_INTERVAL_SEC", "900"))
MAX_PER_RUN = int(os.environ.get("MAX_POSTS_PER_RUN", "1"))


def _log(msg: str):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def _meta(article: dict, score: int, decision: str, waat_post_id, attempts: int) -> dict:
    return {
        "title": article.get("title", ""),
        "score": score,
        "decision": decision,
        "waat_post_id": waat_post_id,
        "attempts": attempts,
        "ts_iso": time.strftime("%Y-%m-%dT%H:%M:%S%z") or time.strftime("%Y-%m-%dT%H:%M:%S"),
    }


def process_once(dry_run: bool = False) -> dict:
    """폴링 1회 — 새 글 1개까지 처리.
    반환: {'checked':N, 'processed':M, 'posted':K, 'held':H, 'errors':E}
    """
    stat = {"checked": 0, "processed": 0, "posted": 0, "held": 0, "errors": 0}

    try:
        items = anthropic_source.list_news(NEWS_URL, RESEARCH_URL)
    except anthropic_source.ParseError as e:
        _log(f"파싱 실패: {e}")
        notifier.notify_parse_failure(str(e))
        stat["errors"] += 1
        memory.mark_poll_ts()
        return stat
    except Exception as e:
        _log(f"네트워크 오류: {e}")
        stat["errors"] += 1
        memory.mark_poll_ts()
        return stat

    stat["checked"] = len(items)
    _log(f"수집 글 수: {len(items)}")

    # 미처리 후보만 추림
    unseen = [it for it in items if not memory.already_processed(it["url"])]
    if not unseen:
        _log("새 글 없음 — 종료")
        memory.mark_poll_ts()
        return stat

    _log(f"미처리 후보: {len(unseen)}건 → LLM에게 1건 선택 의뢰")

    # 후보 다건 중 한국 독자가 가장 궁금해할 1건 선정
    chosen = engine.select_one(unseen, log=_log)
    if not chosen:
        _log("선정 결과 없음 — 종료")
        memory.mark_poll_ts()
        return stat

    url = chosen["url"]
    try:
        article = anthropic_source.fetch_article(url)
    except anthropic_source.ParseError as e:
        _log(f"기사 파싱 실패 {url}: {e}")
        notifier.notify_parse_failure(f"{url} — {e}")
        stat["errors"] += 1
        memory.mark_poll_ts()
        return stat
    except Exception as e:
        _log(f"기사 fetch 오류 {url}: {e}")
        stat["errors"] += 1
        memory.mark_poll_ts()
        return stat

    # 단일 글 처리 — for 루프 제거, 한 번에 1건만
    for _once in [None]:
        stat["processed"] += 1
        _log(f"번역 시작: {article['title'][:60]}")

        try:
            result = engine.translate_article(article)
        except Exception as e:
            _log(f"engine 오류: {e}\n{traceback.format_exc()}")
            notifier.notify_error(article["title"], str(e), url)
            stat["errors"] += 1
            continue

        critique = result["critique"]
        body = result["body"]
        decision = result["final_decision"]
        score = critique.get("score", 0)
        provider = result.get("provider", "?")
        _log(f"자가평가 점수: {score}/5, 결정: {decision}, attempts: {result['attempts']}, provider: {provider}")

        if dry_run:
            _log("[DRY-RUN] WAAT 게시 생략. 본문 일부:\n" + body[:500])
            memory.record(url, _meta(article, score, "dry-run", None, result["attempts"]))
            continue

        if decision == "hold":
            notifier.notify_hold(article["title"], url, score, body)
            memory.record(url, _meta(article, score, "hold", None, result["attempts"]))
            stat["held"] += 1
            continue

        # 이미지 업로드 시도 (service_role 없으면 빈 배열 → 본문 마크다운 폴백)
        src_img_urls = [im["src"] for im in article.get("images", [])]
        try:
            uploaded = waat_client.upload_images(src_img_urls)
        except Exception as e:
            _log(f"이미지 업로드 실패 (무시): {e}")
            uploaded = []

        # 이미지 업로드 실패 시 본문에 URL만 plain text로 첨부 (마크다운 ![]() 금지)
        if not uploaded and src_img_urls:
            fallback_text = "\n\n원문 이미지\n" + "\n".join(src_img_urls[:5])
            body = body + fallback_text

        # 본문 끝에 자동 게시 안내 (마크다운 금지 — plain text)
        final_body = (
            body
            + "\n\n"
            + f"본 글은 claude-news-agent가 Anthropic 원문을 한국어로 옮긴 자동 게시물입니다."
            + f" (번역 모델: {provider}, 자가평가 {score}/5)"
        )

        try:
            post_id = waat_client.insert_post(
                title=article["title"],
                content=final_body,
                image_urls=uploaded,
                source_url=url,
            )
        except Exception as e:
            _log(f"WAAT 게시 실패: {e}\n{traceback.format_exc()}")
            notifier.notify_error(article["title"], str(e), url)
            stat["errors"] += 1
            continue

        if post_id:
            _log(f"WAAT 게시 성공: post_id={post_id}")
            notifier.notify_posted(article["title"], post_id, url, score)
            memory.record(url, _meta(article, score, "posted", post_id, result["attempts"]))
            stat["posted"] += 1
        else:
            _log("WAAT 게시 — id 반환 안 됨")
            notifier.notify_error(article["title"], "INSERT 결과에 id 없음", url)
            stat["errors"] += 1

    memory.mark_poll_ts()
    return stat


def main():
    parser = argparse.ArgumentParser(description="claude-news-agent")
    parser.add_argument("--once", action="store_true", help="1회 실행 후 종료")
    parser.add_argument("--loop", action="store_true", help="무한 루프 (POLL_INTERVAL_SEC 간격)")
    parser.add_argument("--dry-run", action="store_true", help="WAAT 게시 없이 콘솔 출력")
    args = parser.parse_args()

    if not (args.once or args.loop):
        args.once = True  # 기본은 1회

    _log(f"claude-news-agent 시작 — once={args.once} loop={args.loop} dry-run={args.dry_run}")

    if args.once:
        stat = process_once(dry_run=args.dry_run)
        _log(f"완료: {stat}")
        return 0

    while True:
        try:
            stat = process_once(dry_run=args.dry_run)
            _log(f"폴링 결과: {stat}, 다음 폴링까지 {POLL_INTERVAL_SEC}초 대기")
        except Exception as e:
            _log(f"폴링 예외: {e}\n{traceback.format_exc()}")
        time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    sys.exit(main() or 0)
