"""Gmail SMTP 이메일 알림."""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate


SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
GMAIL_USER = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PW = os.environ.get("GMAIL_APP_PASSWORD", "")
NOTIFY_TO = os.environ.get("NOTIFY_TO_EMAIL", GMAIL_USER)


def send(subject: str, body: str, html: bool = False) -> bool:
    """이메일 발송. GMAIL_APP_PASSWORD 없으면 stderr에만 출력하고 False."""
    if not (GMAIL_USER and GMAIL_APP_PW and NOTIFY_TO):
        # 환경변수 미설정 — 콘솔에만 출력
        import sys
        print(f"[notifier] (이메일 미설정) {subject}\n{body[:500]}", file=sys.stderr)
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = f"claude-news-agent <{GMAIL_USER}>"
    msg["To"] = NOTIFY_TO
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    mime = MIMEText(body, "html" if html else "plain", "utf-8")
    msg.attach(mime)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
            s.ehlo()
            s.starttls()
            s.login(GMAIL_USER, GMAIL_APP_PW)
            s.sendmail(GMAIL_USER, [NOTIFY_TO], msg.as_string())
        return True
    except Exception as e:
        import sys
        print(f"[notifier] 발송 실패: {e}", file=sys.stderr)
        return False


def notify_posted(title: str, waat_post_id: int, source_url: str, score: int):
    body = (
        f"WAAT에 글이 자동 게시되었습니다.\n\n"
        f"제목: {title}\n"
        f"WAAT 글 ID: {waat_post_id}\n"
        f"원문: {source_url}\n"
        f"자가평가 점수: {score}/5\n\n"
        f"확인: https://waat.community/speakup\n"
    )
    return send(f"[claude-news] 게시 완료: {title[:60]}", body)


def notify_hold(title: str, source_url: str, score: int, draft: str):
    body = (
        f"자가평가 점수 {score}/5 — 임계값(2) 이하로 자동 게시 보류했습니다.\n"
        f"원문: {source_url}\n\n"
        f"--- 초안 ---\n{draft[:3000]}\n"
    )
    return send(f"[claude-news] 게시 보류 (자가평가 {score}/5): {title[:50]}", body)


def notify_error(title: str, error_msg: str, source_url: str = ""):
    body = (
        f"오류 발생.\n\n"
        f"대상: {title}\n"
        f"{('원문: ' + source_url) if source_url else ''}\n"
        f"오류: {error_msg}\n"
    )
    return send(f"[claude-news] 오류: {title[:60]}", body)


def notify_parse_failure(detail: str):
    body = (
        f"Anthropic 사이트 파싱 실패 — 사이트 구조 변경 가능성.\n\n"
        f"세부: {detail}\n\n"
        f"anthropic_source.py의 CSS 셀렉터를 점검하세요.\n"
    )
    return send("[claude-news] ⚠️ 파싱 실패 — 사이트 구조 변경 의심", body)
