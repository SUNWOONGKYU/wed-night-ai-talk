# claude-news-agent

Anthropic Claude 새 소식 → 한글 자동 번역 → WAAT 커뮤니티(`AI 새 소식` 카테고리) 자동 게시 에이전트.

- **모드**: 단일 / 인프라 B (DB 없음 · .py + API 키 + JSON 파일)
- **구동**: PC 상시 켜둠 + Windows 작업 스케줄러 15분 폴링 (자동) + 바탕화면 바로가기 (수동 즉시 실행)
- **대상 사용자**: PO 본인 (선웅규 / WAAT 운영자)

---

## LLM 폴백 체인 (2026-06-10 개선)

`anthropic → claude_cli → gemini → openai → grok` 순서로 시도 (`.env`의 `LLM_FALLBACK_ORDER`).

- **claude_cli**: 이 PC의 Claude Code CLI(`claude -p`)를 호출 — Claude 구독(Pro/Max)을 사용하므로 **API 크레딧이 없어도 동작**. `--tools none`으로 도구 사용을 차단해 순수 텍스트 생성만 수행.
- Anthropic API 크레딧이 소진돼도 claude_cli가 받아주므로 에이전트는 계속 구동된다.

## 설치 (1회)

```powershell
cd "G:\내 드라이브\WAAT\claude-news-agent"
pip install -r requirements.txt
copy .env.example .env
# .env 파일을 메모장 등으로 열어 실제 키 5개 입력
```

필요한 키:
1. `ANTHROPIC_API_KEY` — https://console.anthropic.com/settings/keys
2. `WAAT_SUPABASE_SERVICE_ROLE_KEY` — Supabase Studio > Settings > API > service_role
3. `WAAT_BOT_USER_ID` — Supabase Studio SQL Editor: `SELECT id FROM auth.users WHERE email='wksun999@gmail.com';`
4. `GMAIL_APP_PASSWORD` — https://myaccount.google.com/apppasswords ("메일" 앱용)
5. 나머지 항목 — `.env.example` 기본값 그대로

---

## 사용법

### 방법 1 — 바탕화면 바로가기 (수동 즉시 실행)

`run-once.bat` 파일을 바탕화면에 복사하거나 우클릭 → 바로가기 만들기.
더블클릭 시 1회 실행 — 새 글 있으면 처리·없으면 조용히 종료.

### 방법 2 — Windows 작업 스케줄러 (자동 폴링)

```powershell
# PowerShell 관리자 권한
$action = New-ScheduledTaskAction -Execute "pythonw.exe" -Argument "`"G:\내 드라이브\WAAT\claude-news-agent\run.py`"" -WorkingDirectory "G:\내 드라이브\WAAT\claude-news-agent"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName "claude-news-agent" -Action $action -Trigger $trigger -RunLevel Limited
```

또는 GUI:
1. `taskschd.msc` 실행 → "작업 만들기"
2. 트리거: "한 번"(시작 시각) · 반복 15분 · 무기한
3. 동작: `pythonw.exe` + 인수 `"G:\내 드라이브\WAAT\claude-news-agent\run.py"`
4. 조건: "PC가 AC 전원에 연결된 경우에만" 등 환경 조정

### 방법 3 — 일회성 명령

```powershell
cd "G:\내 드라이브\WAAT\claude-news-agent"
python run.py            # 1회 실행
python run.py --once     # 명시적 1회
python run.py --dry-run  # 게시 없이 흐름만 출력
```

---

## 파일 구조

```
claude-news-agent/
├── README.md                    (이 파일)
├── .env.example                 (환경변수 양식)
├── .env                         (PO가 채움, git 미포함)
├── requirements.txt
├── run.py                       ← 진입점 (cron + 수동)
├── run-once.bat                 ← 바탕화면 바로가기용
├── engine.py                    (LLM 호출·self_critique·tool round-trip)
├── llm_providers.py             (폴백 체인: Claude API → Claude CLI → Gemini → GPT → Grok)
├── anthropic_source.py          (sitemap·HTML 파싱)
├── waat_client.py               (Supabase posts INSERT + Storage 업로드)
├── marketing_filter.py          (금지 단어 정규식 검사)
├── memory.py                    (history.json + portalocker 잠금)
├── notifier.py                  (Gmail SMTP 이메일 알림)
├── history.json                 (자동 생성 — 처리한 글 URL·시각)
├── error.log                    (자동 생성 — 오류 누적)
└── skills/Claude새소식/
    └── SKILL.md                 (한글 번역 INSTRUCTION + 1~5 채점 루브릭)
```

---

## 운영 시 PO가 확인할 곳

| 위치 | 내용 |
|---|---|
| `history.json` | 처리한 글 목록 (URL + 게시 시각 + 자가평가 점수) |
| `error.log` | 오류 누적 (마지막 100건) |
| Gmail 받은편지함 | 게시 완료 알림 · 자가평가 보류 초안 · 폴링 실패 알림 |
| WAAT /speakup | 자동 게시된 글 (사후 검토 후 필요 시 수정·삭제) |

---

## 중단·재개

- 일시 중단: 작업 스케줄러 → "사용 안 함"
- 키 변경: `.env` 수정 → 다음 폴링 주기에 자동 반영
- 완전 제거: 폴더 삭제 + 스케줄 삭제 + Supabase의 service_role 키 회수 권장

---

## 인프라 B 명시

이 에이전트는 자체 DB를 두지 않음. WAAT 사이트의 Supabase는 **게시 대상 API**로만 호출 (인프라 B 유지). `history.json`이 유일한 영구 메모리.

생성: `/llm-dependent-agent-create` V3.4 (2026-05-28).
