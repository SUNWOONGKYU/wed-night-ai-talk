# Claude Code 설치 마법사 지시문 — One MACS · 원맥스 (배포판 v3.1 · 문답으로 내 시스템 만들기)

> **사용자는 이것만 하면 된다**: PC에 `C:\원맥스` 폴더를 만들고 그 폴더에서 Claude Code를 켜고(`claude`), 아래 한 줄을 붙여넣는다.
>
> ```
> https://www.waat.community/market/onemacs/install.md 를 읽고, 그 안의 지시를 순서대로 전부 수행해서 원맥스를 설치·실행해줘.
> ```
> (zip을 이미 받아 풀었다면: `<푼 폴더>\CLAUDE_CODE_설치지시문.md 파일을 읽고 그대로 수행해줘`)
>
> 이 파일의 나머지는 Claude Code가 읽고 실행하는 절차다.

---

## Claude Code에게 (실행 절차)

너는 사용자가 만든 원맥스 폴더(현재 작업 디렉토리 = `ROOT`, 보통 `C:\원맥스`)에서 실행 중이다. 설치가 끝나면 이 폴더는 아래 모양이 된다:
```
ROOT\
  _mobile_remote\        ← 콘솔 본체(폰과 연결)
  트레이딩 시그널\         ← 기본 프로젝트(자동 생성: 주식 스캐너·샘플 전략·전략 빌더)
  (이후 추가되는 프로젝트 폴더들 — 폰의 [프로젝트 ▾] → 프로젝트 추가, 또는 무료 에이전트 zip을 여기에 풀면 됨)
```
폰의 프로젝트 선택기에는 처음에 **'트레이딩 시그널' 하나**가 보인다. 아래에서 `PROJECT` 라고 쓰면 `ROOT\트레이딩 시그널` 을 뜻한다. 아래 단계를 **순서대로** 수행하고, 각 단계 결과를 한 줄씩 보고하라. 실패한 단계는 원인과 사용자가 직접 할 일을 정확히 알려주고 멈춰라. 추측으로 넘어가지 마라.

### 0. 원칙
- 로그인(claude / codex / agy / grok)은 **절대 대신 하지 않는다**. 명령만 알려주고 사용자가 끝냈다고 하면 이어간다.
- `ROOT` 밖은 건드리지 않는다. 예외 두 곳뿐: `%USERPROFILE%\.claude\skills\전략만들기\`(복사) 와, **사용자가 Q2에서 Antigravity를 켠 경우에만** `%USERPROFILE%\.gemini\antigravity-cli\settings.json` 의 model 값. 토큰·비밀번호·페어링 코드 외 비밀값은 출력하지 않는다.
- 고객이 보는 화면이다. **기다림은 `sleep` 이 아니라 폴링**(아래 6단계)으로, 실패한 명령은 조용히 다른 방법으로 다시 하고 최종 결과만 말한다. 기술 용어(JSON·프로세스·포트 등)는 꼭 필요할 때만.
- Windows 전용. PowerShell 명령을 쓴다. `NoDefaultCurrentDirectoryInExePath` 환경변수가 있으면 배치 실행 시 `.\` 접두를 쓴다.

### 1. 환경 점검 → 사용자에게 보고
`node -v`, `claude --version`, `codex --version`, `agy --version`, `grok --version`, `python --version` 각각 실행(없으면 오류가 정상). 결과를 **반드시 아래 모양의 일반 텍스트(코드블록)로 화면에 출력**한다 — 생각 속에만 적고 넘어가면 고객은 아무것도 못 본다. 예:
```
점검 결과
- Node.js: 있음 (v22)
- Claude Code: 설치되어 있군요 (v2.x) — 메인 AI로 씁니다
- Codex(ChatGPT): 없음 — 쓰시려면 설치가 필요합니다
- Antigravity(Google): 없음
- Grok(xAI): 없음
- Python: 있음/없음 (주식 스캐너 실행에 필요, 나중에 해도 됨)
```
- Node 없음 → https://nodejs.org LTS 설치 요청 후 중단.
- 컴퓨터 이름은 `hostname` 으로 읽어 둔다(`HOST`).

### 1-1. 설치 마법사 — 문답으로 이 사람의 시스템을 정한다 (AskUserQuestion 사용, 한 번에 하나씩)
샘플을 깔아 놓고 고치라고 하지 않는다. **처음부터 사용자가 정한 대로** 만든다. 답은 아래 `WIZ` 에 모아 4단계 설정에 쓴다.

**Q1. 이 PC 이름표** — "폰 앱에 이 PC를 어떤 이름으로 표시할까요?" 선택지는 **반드시 2개 이상**: ① `PC <HOST>` (기본, 컴퓨터 이름 그대로) ② `다른 이름으로` (고르면 이어서 이름을 물어봄). → `WIZ.pc_label` (기본이면 `"PC " + HOST`).
   (AskUserQuestion 은 선택지가 1개면 거부된다. 모든 질문에 선택지 2개 이상.)

**Q2. 함께 쓸 AI** — "Claude Code 외에 어떤 AI를 같이 쓰시겠어요? 각각 본인 구독이 필요합니다." 복수 선택: `Codex (ChatGPT 구독)` / `Antigravity (Google)` / `Grok (xAI)` / `Claude Code만 쓰겠다`. 고르지 않은 AI는 **탭 자체가 안 보이게** 끈다 → `WIZ.workers.<codex|agy|grok>.enabled`.

**Q3. 고른 AI 중 미설치인 것** — 하나씩: "Codex가 아직 없습니다. 지금 설치할까요?" 선택지: `설치 명령 알려주세요` / `나중에(탭 끔)`.
- 설치는 사용자가 한다. 명령만 보여준다:
  - Codex: `npm install -g @openai/codex` → 새 터미널에서 `codex` 실행해 ChatGPT 로그인
  - Antigravity: https://antigravity.google 에서 Antigravity 설치(agy CLI 포함) → 터미널에서 `agy` 실행해 Google 로그인
  - Grok: `npm install -g @xai-official/grok` → 터미널에서 `grok` 실행해 xAI 로그인
- "끝났다"는 답을 받으면 `--version` 으로 다시 확인. 실패하면 이유를 말하고 `나중에(탭 끔)` 로 처리.

**Q4. 모델** — 켜진 AI의 모델을 묻는다(기본값을 첫 선택지로, 한 위젯에 여러 문항을 묶어도 됨):
- Claude Code: "Claude Code 탭 아래에 적을 모델 이름을 고르세요" `Opus 5` / `Sonnet 5` / 직접 입력 (설명은 이 한 줄만: "이름표입니다. 실제 모델은 Claude Code 에서 쓰시는 그대로입니다.") → `WIZ.workers.claude.model`
- Codex: `gpt-5.6-terra` / `gpt-5.6-astra` / 직접 입력 → `WIZ.workers.codex.model`
- Antigravity: `gemini-3.8-flash-high` / `gemini-3.8-pro-high` / 직접 입력 → `WIZ.workers.agy.model`
- Grok: `grok-4.6` / 직접 입력 → `WIZ.workers.grok.model`

**Q5. 프로젝트** — "기본 프로젝트 '트레이딩 시그널' 폴더를 만들어 드리겠습니다(주식 262종목 스캐너 + 샘플 전략 + 말로 전략 만들기). 다른 프로젝트도 지금 추가할까요?" 선택지: `트레이딩 시그널만` / `추가 (이름 입력, 쉼표로 여러 개)`. 추가 이름은 `ROOT\<이름>\` 빈 폴더로 만든다 → `WIZ.projects`.

**Q5-1. 자동 실행** — "PC를 켤 때 원맥스가 자동으로 시작되게 할까요? (안 하면 매번 검은 창을 직접 켜야 합니다)" 선택지: `네, 자동 시작` (기본) / `아니오`. → `WIZ.autostart`

**Q5-2. 동봉 프로그램 설정** — "원맥스에는 트레이딩 시그널(262종목 스캐너 + 말로 전략 만들기)과 매매 자동화 봇(신호가 나면 텔레그램으로 승인을 받아 주문·청산을 대신 실행해 주는 프로그램)이 무료로 들어 있습니다. 지금 설정할까요?" 선택지: `스캐너만 지금 (Python 필요)` / `스캐너 + 매매 자동화 봇 지금 (Python·증권사 키·텔레그램 봇 필요)` / `나중에` (기본). → `WIZ.bundle`
   - 파일은 어느 쪽이든 항상 설치된다(3B). 이 질문은 "실행 준비까지 지금 할지"만 정한다.
   - `스캐너만`: 8단계 완료 보고 뒤에 `ROOT\트레이딩 시그널\CLAUDE_CODE_봇설치지시문.md` 의 1~3단계(Python·라이브러리) + 스캐너 시험 기동만 이어서 수행한다.
   - `스캐너 + 매매 자동화 봇`: 같은 지시문을 끝까지(증권사 키·텔레그램은 사용자가 값을 줄 때만, 모의투자 모드 기본) 이어서 수행한다.
   - `나중에`: 완료 보고에 "나중에 '매매 자동화 봇 설정해줘' 라고 하면 이어서 합니다" 한 줄.

**Q6. 확인** — 먼저 정한 내용을 **일반 텍스트 표로 화면에 출력**(PC 이름표 / 함께 쓰는 AI / 모델 / 프로젝트 / 폴더 위치), 그 다음에 AskUserQuestion 으로 "이대로 만들까요?" `네` / `다시 고를게요`(해당 질문으로 돌아감). 표 없이 묻지 않는다.

### 2. 배포판 확보
이미 `DIST`(이 지시문이 들어 있는 폴더, `server.js`·`cloudflared.exe` 존재)가 있으면 그것을 쓴다. 없으면 내려받는다:
```powershell
$zip = "$env:TEMP\consolesystem_v2.zip"
Invoke-WebRequest -Uri "https://www.waat.community/market/onemacs/consolesystem_v2.zip" -OutFile $zip
Expand-Archive -Path $zip -DestinationPath "$env:TEMP\consolesystem_v2" -Force
```
`DIST` = 풀린 폴더 안에서 `server.js` 가 있는 폴더. 없거나 다운로드가 실패하면 그 URL과 오류를 사용자에게 보여주고 중단.

### 3. 파일 설치
**3A. 콘솔**
1. `ROOT\_mobile_remote\` 가 없으면 만든다.
2. `DIST` 의 모든 파일(`cloudflared.exe` 포함)을 `ROOT\_mobile_remote\` 로 복사. 이미 있는 `console_config.json` 은 덮어쓰지 않는다.
3. `server.js`, `start_all.js`, `project_router.js`, `quota.js`, `cloudflared.exe` 존재 확인.

**3B. 기본 프로젝트 '트레이딩 시그널' 폴더 자동 생성** (`ROOT\트레이딩 시그널\scanner_web.py` 가 이미 있으면 건너뜀)
1. `ROOT\트레이딩 시그널\` 폴더를 만들고, 내려받아 그 안에 푼다(기존 파일은 덮어쓰지 않는다):
```powershell
$bz = "$env:TEMP\trading-bot_v1.zip"
Invoke-WebRequest -Uri "https://www.waat.community/market/onemacs/trading-bot_v1.zip" -OutFile $bz
Expand-Archive -Path $bz -DestinationPath "$env:TEMP\trading-bot_v1" -Force
```
   풀린 폴더 안에서 `scanner_web.py` 가 있는 폴더의 내용을 `PROJECT\`(= `ROOT\트레이딩 시그널\`) 로 복사.
2. `PROJECT\scanner_web.py`, `PROJECT\strategies\5대장2쫄병.json`, `PROJECT\strategy_engine.py` 존재 확인. 이것이 폰의 **스캐너 버튼 · 전략 카드**의 재료다.
3. 전략 빌더 스킬 설치: `PROJECT\skills\전략만들기\` 가 있으면 `%USERPROFILE%\.claude\skills\전략만들기\` 로 복사(없으면 건너뜀). 이후 사용자는 폰에서 "RSI 35 이하 + 거래량 1.5배 전략 만들어줘" 처럼 말로 전략을 만든다.
4. 스캐너·봇의 **실행 준비**(Python 3.11+ · 라이브러리 · 증권사 키 · 텔레그램)는 Q5-2 답에 따라 8단계 뒤에 `PROJECT\CLAUDE_CODE_봇설치지시문.md`(= https://www.waat.community/market/onemacs/trading-bot.md) 로 이어서 한다. 키 없이도 콘솔·전략 카드·전략 만들기는 동작한다.

### 4. 설정 (console_config.json, UTF-8·BOM 없이) — 마법사 답(`WIZ`)을 그대로 적는다
0. `pc_label`: `WIZ.pc_label` (예: `"PC DESKTOP-ABC"`)
0-1. `workers`:
```json
"workers": {
  "claude": { "model": "Opus 5" },
  "codex":  { "enabled": true,  "model": "gpt-5.6-terra" },
  "agy":    { "enabled": false, "model": "gemini-3.8-flash-high" },
  "grok":   { "enabled": false, "model": "grok-4.6" }
}
```
   (`enabled: false` 인 AI는 폰에 탭이 안 보인다. `agy_model` 도 `workers.agy.model` 과 같게 맞춘다.)
1. `pin`: 6자리 숫자를 **새로 생성**(1234 금지). 사용자에게 한 번 알려준다.
2. `port`: 7890 부터 시작해 **비어 있는 포트**를 쓴다(`netstat -ano | findstr :7890` 이 비면 7890, 아니면 7900, 7910 … 순서로 10씩 올려 확인). 콘솔은 그 포트 다음 번호들(+1, +2 …)을 프로젝트마다 쓰므로 10 단위로 띄운다.
3. `agy_model`: `gemini-3.8-flash-high`.
4. `projects`: `[ { "name": "트레이딩 시그널", "dir": "<ROOT>\\트레이딩 시그널" }, ...WIZ.projects ]` — 경로의 `\` 는 JSON 에서 `\\`.
4-0. `projects_root`: `"<ROOT>"` — 폰에서 '프로젝트 추가' 를 누르면 이 폴더 아래에 새 프로젝트 폴더가 생긴다.
5. `pair_hub_url`·`pair_code` 는 비워 둔다(실행 시 자동 생성).
6. 텔레그램·고정 주소 항목은 비워 둔다(선택 기능, 가이드 참조).

### 5. Antigravity 모델 고정 (**Q2 에서 Antigravity 를 켠 경우에만**, 아니면 이 단계 전체 건너뜀)
`%USERPROFILE%\.gemini\antigravity-cli\settings.json` 이 있고 `model` 값이 이미 원하는 값(`gemini-3.8-flash-high` → `"Gemini 3.8 Flash (High)"`, pro → `"Gemini 3.8 Pro (High)"`)이면 **손대지 않는다**. 다를 때만 node 로 바꾼다(PowerShell ConvertTo-Json 은 따옴표를 \u0027 로 깨뜨리므로 금지):
```powershell
node -e "const fs=require('fs');const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,'utf8'));j.model=process.argv[2];fs.writeFileSync(p,JSON.stringify(j,null,2))" "$env:USERPROFILE\.gemini\antigravity-cli\settings.json" "Gemini 3.8 Flash (High)"
```

### 6. 점검 → 기동
1. `PROJECT\_mobile_remote` 에서 `node check_setup.js` 결과를 그대로 보여준다. Node·Claude Code·cloudflared 가 OK 가 아니면 중단.
2. 새 창으로 기동: `Start-Process -FilePath cmd -ArgumentList "/k",".\1클릭_실행.bat" -WorkingDirectory "<PROJECT>\_mobile_remote"` (검은 창은 최소화만, 닫으면 폰 연결 끊김).
3. `http://127.0.0.1:<port>/api/login` 에 `{"pin":"<pin>"}` POST 를 **2초 간격으로 최대 45회 폴링**(`sleep 45` 같은 긴 대기 명령은 쓰지 않는다 — 차단된다) → `success:true` 면 서버 정상. 45회 안에 안 되면 검은 창(1클릭_실행.bat)에 찍힌 첫 오류 줄을 읽어 고객에게 그대로 보여주고, `ROOT\_mobile_remote\start_all.log` 마지막 10줄도 확인한다.
4. `ROOT\_mobile_remote\페어링코드.txt` 는 인터넷 터널이 연결된 뒤(보통 서버 기동 후 5~30초) 생긴다 → **3초 간격으로 최대 40회 폴링**해 파일이 생기면 읽는다. 첫 줄 = **페어링 코드 8자리**, 둘째 줄 = 브라우저용 허브 주소. 2분이 지나도 없으면 `start_all.log` 마지막 10줄을 보고 원인(인터넷·cloudflared)을 사용자에게 알린다.

### 6-1. 로그온 시 자동 실행 등록 (`WIZ.autostart` 가 예일 때)
PC 를 껐다 켜도 폰이 바로 연결되도록 Windows 작업 스케줄러에 등록한다(관리자 권한 불필요):
```powershell
schtasks /Create /F /SC ONLOGON /TN "OneMACS Console" /TR "cmd /c start \"OneMACS\" /min \"<ROOT>\_mobile_remote\1클릭_실행.bat\""
```
- 등록 확인: `schtasks /Query /TN "OneMACS Console"` 이 항목을 보여주면 OK. 실패하면 대신 `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OneMACS.lnk` 바로가기(대상 = 1클릭_실행.bat)를 만든다.
- 사용자에게: "PC를 다시 켜도 원맥스가 자동으로 뜹니다(검은 창이 최소화된 채로). 끄고 싶으면 '자동 시작 꺼줘'라고 하세요." → 끄기 = `schtasks /Delete /F /TN "OneMACS Console"`.

### 7. 미러링 확인
콘솔은 프로젝트 폴더(`ROOT\트레이딩 시그널`)에서 켜진 Claude Code 창을 폰에 비춘다. 기동 후 콘솔이 그 폴더에 Claude Code 창을 **자동으로 하나 연다**(창이 뜨는 데 10~20초). 규칙: **프로젝트 폴더당 Claude Code 창은 하나만** — 이 설치용 창(`ROOT`)은 프로젝트 창이 아니므로 그대로 둬도 된다.
확인: `http://127.0.0.1:<port>/api/live-transcript?limit=1&pin=<pin>&project=트레이딩 시그널` 의 `windowPid` 가 숫자면 연결 OK, 30초 지나도 `null` 이면 "탐색기에서 `ROOT\트레이딩 시그널` 폴더를 열고 주소창에 `claude` 를 쳐서 창을 하나 켜 두세요".

### 8. 완료 보고 (이 형식 그대로)
```
설치 완료 — One MACS · 원맥스
- ★ 검은 창(1클릭_실행.bat)은 최소화만 하세요. 닫으면 폰 연결이 끊깁니다.
- 자동 시작: 켬/끔 (켬이면 "PC를 다시 켜도 원맥스가 자동으로 뜹니다")
- 콘솔 폴더: <ROOT>\_mobile_remote
- 기본 프로젝트: <ROOT>\트레이딩 시그널  (자동 생성됨 — 폰 프로젝트 선택기에 이 이름으로 표시)
- 페어링 코드: <8자리>        ← 폰의 원맥스 앱에 입력 (앱: https://www.waat.community/market)
- 브라우저로도 가능: https://console-hub.consolesystem.workers.dev/?code=<8자리>
- PIN: <pin>  (앱/브라우저에서 PC 처음 열 때 한 번)
- 이 PC 이름표: <pc_label>
- 메인 AI: Claude Code (<model 표시명>) · 프로젝트 창 미러링: OK/미연결
- 함께 쓰는 AI: Codex(<model>) 켬/끔 · Antigravity(<model>) 켬/끔 · Grok(<model>) 켬/끔
- 프로젝트: 트레이딩 시그널 (+ 추가한 것들)
- 바꾸고 싶으면: 이 창에서 "AI 구성 바꿔줘 / 모델 바꿔줘 / 프로젝트 추가해줘" 라고 말하면 console_config.json 을 고치고 콘솔을 재시작한다.
- 주의: 검은 창을 닫으면 폰 연결이 끊김. 다음에 켤 때는 <ROOT>\_mobile_remote\1클릭_실행.bat 하나면 된다(프로젝트 창은 자동으로 뜸).
```

### 9-0. 설치 후 구성 바꾸기 (사용자가 "AI 구성 바꿔줘 / 모델 바꿔줘 / PC 이름표 바꿔줘 / 프로젝트 추가해줘" 라고 하면)
1. 해당 질문(Q1~Q5)만 다시 묻는다(전체 마법사를 처음부터 돌리지 않는다).
2. `ROOT\_mobile_remote\console_config.json` 의 해당 값만 고친다(UTF-8·BOM 없이, 다른 값 유지). 프로젝트 추가는 `ROOT\<이름>\` 폴더 생성 + `projects` 에 항목 추가.
3. 콘솔 재시작: 검은 창(1클릭_실행.bat)을 닫고 다시 실행하라고 안내하거나, 사용자가 원하면 `ROOT\_mobile_remote\1클릭_실행.bat` 을 새 창으로 다시 띄운다. 페어링 코드는 그대로다(PIN 도 그대로).
4. 바뀐 구성표를 텍스트로 보여주고 끝.

### 9. 이후 사용법 (한 번 알려줄 것)
- 앱: 페어링 코드 입력 → PC 탭 → PIN 한 번 → 켜 둔 AI 탭. Claude Code 탭 입력은 이 창에 그대로 타이핑된다. 📎 = 사진·파일, 🛑 = 긴급 정지, 헤더 `[프로젝트 ▾]` 로 폴더 전환·추가.
- 기본 프로젝트 '트레이딩 시그널': 헤더 오른쪽 **스캐너** 버튼 → 전략 카드(5대장2쫄병 샘플 · 내가 만든 전략 A/B/C 켜기·끄기). 동봉된 스캐너·매매 자동화 봇은 원맥스에 자동으로 따라오며, 실행 준비는 Q5-2 에서 정한 대로(나중이면 "매매 자동화 봇 설정해줘").
- 무료 에이전트(보고서 작성 등)는 zip 을 `<ROOT>` 아래 폴더로 풀고 폰의 `[프로젝트 ▾] → 프로젝트 추가` 에서 그 폴더 이름을 넣으면 프로젝트로 붙는다.

---

### 문제가 생기면
사용 중 무엇이든 안 되면 PC의 Claude Code 에 **"원맥스 진단해줘"** 라고 하면 된다 — 배포판에 동봉된 `원맥스_진단.md` 를 읽고 순서대로 수행해 원인을 찾아 알려준다. 자주 막히는 경우는 https://www.waat.community/market/onemacs/faq 에 정리되어 있다.

### 알아 두실 점 (사용자에게 마지막에 한 번 보여줄 것 — https://www.waat.community/market/onemacs/notice)
- 원맥스는 내 PC의 AI 도구를 인터넷 주소로 연결한다. PIN 이 유일한 잠금이니 PIN 과 페어링 코드는 남에게 알려주지 않는다.
- AI 사용료·이용약관·출력물에 대한 책임은 각자의 계정 기준이다(원맥스는 AI 사용을 중개·재판매하지 않는다).
- 전체 권한 모드를 켜면 AI 가 PC 의 파일을 바꿀 수 있다. 기본은 안전 모드(작업 폴더 안에서만).
- 로그인 5회 실패 시 1분, 20회 실패 시 1시간 잠긴다.
