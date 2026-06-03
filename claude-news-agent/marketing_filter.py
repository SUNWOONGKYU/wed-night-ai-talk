"""마케팅·과장 표현 정규식 검사. 발견 시 self_critique 점수 강제 감점."""
import re

FORBIDDEN_PATTERNS = [
    r"혁신적",
    r"획기적",
    r"놀라운",
    r"게임\s*체인저",
    r"~?\s*의\s*미래\b",
    r"전례\s*없는",
    r"세계\s*최초",
    r"파격적",
    r"독보적",
    r"압도적",
    r"비약적",
    r"눈에\s*띄게\s*뛰어난",
]
PATTERNS_COMPILED = [re.compile(p) for p in FORBIDDEN_PATTERNS]


def find_violations(text: str) -> list:
    """텍스트에서 금지 표현 발견 위치 반환. [{pattern, match, span}]"""
    hits = []
    for p, src in zip(PATTERNS_COMPILED, FORBIDDEN_PATTERNS):
        for m in p.finditer(text or ""):
            hits.append({"pattern": src, "match": m.group(0), "span": m.span()})
    return hits


def has_violations(text: str) -> bool:
    return bool(find_violations(text))


def report(text: str) -> str:
    """위반 사항 사람이 읽기 좋은 한 줄 요약"""
    hits = find_violations(text)
    if not hits:
        return "마케팅 표현 위반 없음."
    return f"마케팅 표현 {len(hits)}건 발견: " + ", ".join(set(h["match"] for h in hits[:5]))
