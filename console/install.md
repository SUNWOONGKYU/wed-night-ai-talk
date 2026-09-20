# Claude Code 자동 설치 지시문 — 콘솔 시스템 (배포판 v2.1 · 페어링 · 기본 프로젝트 '트레이딩 시그널')

> **사용자는 이것만 하면 된다**: PC에 콘솔 폴더를 하나 만들고(예: `C:\콘솔`) 그 폴더에서 Claude Code를 켜고(`claude`), 아래 한 줄을 붙여넣는다.
>
> ```
> https://www.waat.community/console/install.md 를 읽고, 그 안의 지시를 순서대로 전부 수행해서 콘솔 시스템을 설치·실행해줘.
> ```
> (zip을 이미 받아 풀었다면: `<푼 폴더>\CLAUDE_CODE_설치지시문.md 파일을 읽고 그대로 수행해줘`)
>
> 이 파일의 나머지는 Claude Code가 읽고 실행하는 절차다.

---

## Claude Code에게 (실행 절차)

너는 사용자가 만든 콘솔 폴더(현재 작업 디렉토리 = `ROOT`, 예: `C:\콘솔`)에서 실행 중이다. 설치가 끝나면 이 폴더는 아래 모양이 된다:
```
ROOT\
  _mobile_remote\        ← 콘솔 본체(폰과 연결)
  트레이딩 시그널\         ← 기본 프로젝트(자동 생성: 주식 스캐너·샘플 전략·전략 빌더)
  (이후 추가되는 프로젝트 폴더들 — 폰의 [프로젝트 ▾] → 프로젝트 추가, 또는 무료 에이전트 zip을 여기에 풀면 됨)
```
폰의 프로젝트 선택기에는 처음에 **'트레이딩 시그널' 하나**가 보인다. 아래에서 `PROJECT` 라고 쓰면 `ROOT\트레이딩 시그널` 을 뜻한다. 아래 단계를 **순서대로** 수행하고, 각 단계 결과를 한 줄씩 보고하라. 실패한 단계는 원인과 사용자가 직접 할 일을 정확히 알려주고 멈춰라. 추측으로 넘어가지 마라.

### 0. 원칙
- 로그인(claude / codex / agy / grok)은 **절대 대신 하지 않는다**. 명령만 알려주고 사용자가 끝냈다고 하면 이어간다.
- `PROJECT` 밖은 건드리지 않는다. 토큰·비밀번호·페어링 코드 외 비밀값은 출력하지 않는다.
- Windows 전용. PowerShell 명령을 쓴다. `NoDefaultCurrentDirectoryInExePath` 환경변수가 있으면 배치 실행 시 `.\` 접두를 쓴다.

### 1. 환경 점검
`node -v`, `claude --version`, `codex --version`, `agy --version`, `grok --version` 각각 실행(없으면 오류가 정상).
- Node 없음 → https://nodejs.org LTS 설치 요청 후 중단.
- codex/agy/grok 은 선택. 없으면 "해당 탭은 비활성"이라고만 알리고 계속.

### 2. 배포판 확보
이미 `DIST`(이 지시문이 들어 있는 폴더, `server.js`·`cloudflared.exe` 존재)가 있으면 그것을 쓴다. 없으면 내려받는다:
```powershell
$zip = "$env:TEMP\consolesystem_v2.zip"
Invoke-WebRequest -Uri "https://www.waat.community/console/consolesystem_v2.zip" -OutFile $zip
Expand-Archive -Path $zip -DestinationPath "$env:TEMP\consolesystem_v2" -Force
```
`DIST` = 풀린 폴더 안에서 `server.js` 가 있는 폴더. 없거나 다운로드가 실패하면 그 URL과 오류를 사용자에게 보여주고 중단.

### 3. 파일 설치
**3A. 콘솔**
1. `ROOT\_mobile_remote\` 가 없으면 만든다.
2. `DIST` 의 모든 파일(`hub` 하위 폴더, `cloudflared.exe` 포함)을 `ROOT\_mobile_remote\` 로 복사. 이미 있는 `console_config.json` 은 덮어쓰지 않는다.
3. `server.js`, `start_all.js`, `project_router.js`, `quota.js`, `cloudflared.exe` 존재 확인.

**3B. 기본 프로젝트 '트레이딩 시그널' 폴더 자동 생성** (`ROOT\트레이딩 시그널\scanner_web.py` 가 이미 있으면 건너뜀)
1. `ROOT\트레이딩 시그널\` 폴더를 만들고, 내려받아 그 안에 푼다(기존 파일은 덮어쓰지 않는다):
```powershell
$bz = "$env:TEMP\trading-bot_v1.zip"
Invoke-WebRequest -Uri "https://www.waat.community/console/trading-bot_v1.zip" -OutFile $bz
Expand-Archive -Path $bz -DestinationPath "$env:TEMP\trading-bot_v1" -Force
```
   풀린 폴더 안에서 `scanner_web.py` 가 있는 폴더의 내용을 `PROJECT\`(= `ROOT\트레이딩 시그널\`) 로 복사.
2. `PROJECT\scanner_web.py`, `PROJECT\strategies\5대장2쫄병.json`, `PROJECT\strategy_engine.py` 존재 확인. 이것이 폰의 **스캐너 버튼 · 전략 카드**의 재료다.
3. 전략 빌더 스킬 설치: `PROJECT\skills\전략만들기\` 가 있으면 `%USERPROFILE%\.claude\skills\전략만들기\` 로 복사(없으면 건너뜀). 이후 사용자는 폰에서 "RSI 35 이하 + 거래량 1.5배 전략 만들어줘" 처럼 말로 전략을 만든다.
4. 스캐너 **실행**(Python 3.11+ · 라이브러리 · 증권사 키)은 이 지시문에서 하지 않는다. 사용자가 원하면 `PROJECT\CLAUDE_CODE_봇설치지시문.md`(= https://www.waat.community/console/trading-bot.md) 를 이어서 수행한다고만 알린다. 키 없이도 콘솔·전략 카드·전략 만들기는 동작한다.

### 4. 설정 (console_config.json, UTF-8·BOM 없이)
1. `pin`: 6자리 숫자를 **새로 생성**(1234 금지). 사용자에게 한 번 알려준다.
2. `port`: 7890 (사용 중이면 7891).
3. `agy_model`: `gemini-3.8-flash-high`.
4. `projects`: `[ { "name": "트레이딩 시그널", "dir": "<ROOT>\\트레이딩 시그널" } ]` — 경로의 `\` 는 JSON 에서 `\\`.
4-0. `projects_root`: `"<ROOT>"` — 폰에서 '프로젝트 추가' 를 누르면 이 폴더 아래에 새 프로젝트 폴더가 생긴다.
4-1. `pc_label`: 사용자가 PC 를 여러 대 쓸 계획이면 "PC 1번" 처럼 정해 넣는다(폰 탭에 이 이름으로 표시). 한 대면 생략.
5. `pair_hub_url`·`pair_code` 는 비워 둔다(실행 시 자동 생성).
6. 텔레그램·고정 주소 항목은 비워 둔다(선택 기능, 가이드 참조).

### 5. Antigravity 모델 고정 (agy 가 있을 때만)
`%USERPROFILE%\.gemini\antigravity-cli\settings.json` 이 있으면 `"model"` 을 `"Gemini 3.8 Flash (High)"` 로(JSON 유지). 없으면 건너뜀.

### 6. 점검 → 기동
1. `PROJECT\_mobile_remote` 에서 `node check_setup.js` 결과를 그대로 보여준다. Node·Claude Code·cloudflared 가 OK 가 아니면 중단.
2. 새 창으로 기동: `Start-Process -FilePath cmd -ArgumentList "/k",".\1클릭_실행.bat" -WorkingDirectory "<PROJECT>\_mobile_remote"` (검은 창은 최소화만, 닫으면 폰 연결 끊김).
3. 45초 기다린 뒤 `http://127.0.0.1:<port>/api/login` 에 `{"pin":"<pin>"}` POST → `success:true` 면 서버 정상.
4. `PROJECT\_mobile_remote\페어링코드.txt` 를 읽는다 → 첫 줄 = **페어링 코드 8자리**, 둘째 줄 = 브라우저용 허브 주소.

### 7. 미러링 확인
콘솔은 프로젝트 폴더(`ROOT\트레이딩 시그널`)에서 켜진 Claude Code 창을 폰에 비춘다. 기동 후 콘솔이 그 폴더에 Claude Code 창을 **자동으로 하나 연다**(창이 뜨는 데 10~20초). 규칙: **프로젝트 폴더당 Claude Code 창은 하나만** — 이 설치용 창(`ROOT`)은 프로젝트 창이 아니므로 그대로 둬도 된다.
확인: `http://127.0.0.1:<port>/api/live-transcript?limit=1&pin=<pin>&project=트레이딩 시그널` 의 `windowPid` 가 숫자면 연결 OK, 30초 지나도 `null` 이면 "탐색기에서 `ROOT\트레이딩 시그널` 폴더를 열고 주소창에 `claude` 를 쳐서 창을 하나 켜 두세요".

### 8. 완료 보고 (이 형식 그대로)
```
설치 완료 — 콘솔 시스템
- 콘솔 폴더: <ROOT>\_mobile_remote
- 기본 프로젝트: <ROOT>\트레이딩 시그널  (자동 생성됨 — 폰 프로젝트 선택기에 이 이름으로 표시)
- 페어링 코드: <8자리>        ← 폰의 콘솔 시스템 앱에 입력 (앱: https://www.waat.community/market)
- 브라우저로도 가능: https://console-hub.consolesystem.workers.dev/?code=<8자리>
- PIN: <pin>  (앱/브라우저에서 PC 처음 열 때 한 번)
- 메인 워커: Claude Code (이 창) · 미러링: OK/미연결
- 서브 워커: Codex OK/없음 · Antigravity OK/없음 · Grok OK/없음
- 주의: 검은 창을 닫으면 폰 연결이 끊김. 다음에 켤 때는 <ROOT>\_mobile_remote\1클릭_실행.bat 하나면 된다(프로젝트 창은 자동으로 뜸).
```

### 9. 이후 사용법 (한 번 알려줄 것)
- 앱: 페어링 코드 입력 → PC 탭 → PIN 한 번 → 4개 AI 탭. Claude Code 탭 입력은 이 창에 그대로 타이핑된다. 📎 = 사진·파일, 🛑 = 긴급 정지, 헤더 `[프로젝트 ▾]` 로 폴더 전환·추가.
- 기본 프로젝트 '트레이딩 시그널': 헤더 오른쪽 **스캐너** 버튼 → 전략 카드(5대장2쫄병 샘플 · 내가 만든 전략 A/B/C 켜기·끄기). 스캐너를 실제로 돌리려면(Python·증권사 키) `https://www.waat.community/console/trading-bot.md` 지시문을 이어서 수행.
- 무료 에이전트(보고서 작성 등)는 zip 을 `<ROOT>` 아래 폴더로 풀고 폰의 `[프로젝트 ▾] → 프로젝트 추가` 에서 그 폴더 이름을 넣으면 프로젝트로 붙는다.
