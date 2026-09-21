# Claude Code 자동 설치 지시문 — 매매 자동화 봇 (무료 배포판 v1.1)

> **사용자는 이것만 하면 된다**: 봇을 둘 프로젝트 폴더에서 Claude Code 를 켜고(`claude`), 아래 한 줄을 붙여넣는다.
>
> ```
> https://www.waat.community/market/onemacs/trading-bot.md 를 읽고, 그 안의 지시를 순서대로 전부 수행해서 매매 자동화 봇을 설치·시험 기동해줘.
> ```
> (zip 을 이미 받아 풀었다면: `<푼 폴더>\CLAUDE_CODE_봇설치지시문.md 파일을 읽고 그대로 수행해줘`)
>
> 이 파일의 나머지는 Claude Code 가 읽고 실행하는 절차다.

---

## Claude Code 에게 (실행 절차)

너는 사용자의 프로젝트 폴더(현재 작업 디렉토리 = `PROJECT`)에서 실행 중이다. 아래 단계를 **순서대로** 수행하고, 각 단계 결과를 한 줄씩 보고하라. 실패한 단계는 원인과 사용자가 직접 할 일을 정확히 알려주고 멈춰라. 추측으로 넘어가지 마라.

### 0. 원칙 (어기지 말 것)
- 증권사 로그인, API 키 발급, 텔레그램 봇 생성은 **절대 대신 하지 않는다**. 방법만 알려주고 사용자가 값을 주면 이어간다.
- 사용자가 준 앱키·시크릿·계좌번호·토큰은 `.env` 에만 쓰고 **화면에 다시 출력하지 않는다**. 어디에도 전송하지 않는다.
- `KIS_PAPER_MODE` 는 **`true`(모의투자)로 쓴다.** 사용자가 "실계좌로" 라고 해도 이 절차에서는 바꾸지 않는다 — `README_트레이딩봇.md` 7절(실계좌 전환 절차)을 읽어 보라고 안내만 한다.
- `config.py` 의 `APPROVAL_REQUIRED` · `EXIT_APPROVAL_REQUIRED` · `DAY_START_APPROVAL_REQUIRED` · `PUT_ENABLED` · `STRATEGY_LIVE_ENABLED` · `AUTO_BUY_VETTED` 는 건드리지 않는다.
- `PROJECT` 밖은 건드리지 않는다. Windows 전용, PowerShell 명령을 쓴다.

### 1. 환경 점검
`python --version` 실행.
- 없거나 3.11 미만 → https://www.python.org/downloads/ 에서 3.11 이상 설치("Add python.exe to PATH" 체크) 요청 후 중단.
- `pip --version` 도 확인.

### 2. 배포판 확보
이미 `PROJECT` 에 `trader.py` 와 `scanner_web.py` 가 있으면 그것을 쓴다. 없으면 내려받아 푼다:
```powershell
$zip = "$env:TEMP\trading-bot_v1.zip"
Invoke-WebRequest -Uri "https://www.waat.community/market/onemacs/trading-bot_v1.zip" -OutFile $zip
Expand-Archive -Path $zip -DestinationPath "$env:TEMP\trading-bot_v1" -Force
```
풀린 폴더 안에서 `trader.py` 가 있는 폴더의 **모든 파일·하위 폴더**(`.claude`, `.env.example`, `.gitignore` 같은 점 파일 포함)를 `PROJECT` 로 복사한다. 이미 있는 `.env` 와 `strategies\*.json` 은 덮어쓰지 않는다. 다운로드가 실패하면 URL 과 오류를 보여주고 중단.

### 3. 라이브러리 설치
```powershell
pip install -r requirements.txt
```
실패한 패키지가 있으면 이름과 오류를 보여준다. `matplotlib` · `yfinance` · `anthropic` · `pytz` 는 선택이라 실패해도 계속 진행하되 "해당 기능 비활성"이라고 알린다. `requests` `pandas` `numpy` `python-dotenv` `flask` `PyYAML` `psutil` `pykrx` 가 안 깔리면 중단.

### 4. `.env` 작성 (사용자와 함께)
1. `.env` 가 없으면 `.env.example` 을 `.env` 로 복사한다.
2. 사용자에게 아래를 **하나씩** 묻고, 받은 값을 `.env` 의 해당 줄에 쓴다 (값은 다시 출력하지 않는다):
   - `KIS_APP_KEY`, `KIS_APP_SECRET` — 없다고 하면: "https://apiportal.koreainvestment.com 에 로그인 → API 신청 → 모의투자용 앱을 만들어 앱키/앱시크릿을 복사하세요" 안내 후 대기.
   - `KIS_ACCOUNT` — 계좌번호 앞 8자리 (모의투자 계좌).
   - `TELEGRAM_BOT_TOKEN` — 없다고 하면: "텔레그램에서 @BotFather 를 열고 /newbot → 이름·아이디 입력 → 나오는 토큰을 복사하세요".
   - `TELEGRAM_CHAT_ID` — 없다고 하면: "방금 만든 봇을 열어 아무 메시지나 보낸 뒤, 브라우저에서 https://api.telegram.org/bot<토큰>/getUpdates 를 열면 \"chat\":{\"id\":숫자} 가 있습니다. 그 숫자입니다". 사용자가 원하면 그 URL 을 PowerShell `Invoke-RestMethod` 로 대신 열어 `id` 만 읽어 줘도 된다 (토큰은 출력하지 않는다).
3. `KIS_PAPER_MODE=true` 인지 확인한다. 나머지(선택 항목)는 비워 둔다.
4. `.env` 가 UTF-8 이고 각 줄이 `KEY=값` 형식인지 확인한다 (값 앞뒤 따옴표·공백 없이).

### 5. 데이터 파일 확인
`futures_code_map.json` · `data\stock_names.json` · `config_data\holidays.json` · `strategies\5대장2쫄병.json` 이 있는지 확인. `python strategy_engine.py` 를 실행해 전략 목록에 `OK` 가 나오는지 본다. `holidays.json` 에 올해 항목이 없으면 "KRX 휴장일 갱신 필요"라고 알린다(중단 아님).

### 6. 시험 기동
1. 스캐너를 새 창으로 띄운다:
   `Start-Process -FilePath python -ArgumentList "scanner_web.py" -WorkingDirectory "<PROJECT>"`
   20초 뒤 `Invoke-WebRequest http://127.0.0.1:5050/api/status` 가 200 이면 정상 (브라우저가 자동으로 열린다).
2. 트레이더를 **60초 제한**으로 시험 실행하고 출력을 본다:
   `python trader.py` 를 실행해 다음 줄이 나오면 정상이다 — `Trader 자동매매 트레이더 시작 (모의투자)` · `[KIS] Token acquired` · `[FuturesMap] 매핑 로드: N개 (MM월물)`. 월물(MM)이 이번 달보다 이전이면 `python build_futures_map.py` 를 한 번 실행해 갱신한다(네트워크 필요). 장 외 시간이면 `장 외 — N분 후 개장 대기` 가 나오는 것이 정상이다. 확인했으면 프로세스를 종료한다(Ctrl+C 또는 그 실행 창 닫기). `data\.trader.lock` 이 남아 있으면 지운다.
   - `.env 에 KIS_APP_KEY ... 없습니다` → 4단계로 돌아간다.
   - `KIS 토큰 발급 실패` → 앱키/시크릿 오타, 또는 실전 키를 모의 모드에 넣은 것. 사용자에게 확인 요청.
   - `TELEGRAM_BOT_TOKEN ... 없습니다` → 4단계로.
3. 텔레그램 봇에게 `상태` 라고 보내 보라고 하고, 봇이 답하면 연결 OK 로 기록한다 (트레이더가 켜져 있을 때만 답한다).

### 7. 매일 08:45 자동 기동 등록 (사용자가 원할 때만 — 물어본다)
관리자 권한 PowerShell 이 필요하다. 사용자가 "등록해 달라"고 하면:
```powershell
$proj = "<PROJECT>"
$act = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$proj\restart_trader.ps1`"" -WorkingDirectory $proj
$trg = New-ScheduledTaskTrigger -Daily -At 08:45
Register-ScheduledTask -TaskName "TradingBot-Trader" -Action $act -Trigger $trg -Description "매매 자동화 봇 매일 08:45 재시작"
$act2 = New-ScheduledTaskAction -Execute "python" -Argument "scanner_web.py" -WorkingDirectory $proj
$trg2 = New-ScheduledTaskTrigger -Daily -At 08:40
Register-ScheduledTask -TaskName "TradingBot-Scanner" -Action $act2 -Trigger $trg2 -Description "매매 자동화 봇 스캐너 08:40 기동"
```
권한 오류면 "관리자 PowerShell 에서 위 명령을 직접 실행하세요"라고 명령을 보여주고 넘어간다. `Get-ScheduledTask -TaskName "TradingBot-*"` 로 등록 확인.

### 8. 완료 보고 (이 형식 그대로)
```
설치 완료 — 매매 자동화 봇 (모의투자 모드)
- 봇 폴더: <PROJECT>
- Python: <버전> · 라이브러리: OK (선택 미설치: <목록 또는 없음>)
- .env: KIS 키 OK · 텔레그램 OK · KIS_PAPER_MODE=true
- 시험 기동: 스캐너 OK(5050) · 트레이더 토큰 OK · 선물맵 <N>개 · 텔레그램 응답 OK/미확인
- 자동 기동: 등록됨(08:40 스캐너 / 08:45 트레이더) / 미등록
- 다음 할 일:
  1) 장 시작 전 "오늘 매매 시작" 승인 → 장중(09:00~15:30) 매수 요청은 "승인/거절"(180초 안에), 청산 요청은 "청산 승인/보류"(120초 안에, 손절은 무응답 시 자동 청산).
  2) 전략을 만들려면 이 폴더에서 claude 를 켜고 "/전략만들기 <조건 설명>".
  3) 실계좌 전환은 README_트레이딩봇.md 7절을 먼저 읽는다. 모의투자로 최소 2~4주 먼저.
- 고지: 투자자문·일임 아님. 모든 매매 판단·결과는 사용자 책임. 샘플 전략은 교육용, 수익 보장 없음.
```

### 9. 이후 사용법 (한 번 알려줄 것)
- 매일: 08:45 자동 기동(등록했다면). 아니면 창 두 개 — `python scanner_web.py` → `python trader.py`.
- 텔레그램 명령: `정지` `재개` `상태` `잔고` `포지션` `스캔` `min_score 70` `초기화`.
- 멈추기: 텔레그램 `정지` 또는 trader.py 실행 창 닫기. 보유 포지션은 자동으로 정리되지 않으니 HTS/MTS 에서 직접 확인.
- 전략 파일: `strategies\*.json` (규격은 `strategies\README.md`). 실매매에 쓰려면 파일의 `live:true` + `config.py` `STRATEGY_LIVE_ENABLED=True` 를 사용자가 직접 켠다.
