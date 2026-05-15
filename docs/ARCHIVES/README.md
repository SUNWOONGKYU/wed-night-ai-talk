# docs/ARCHIVES/

루트에 산재된 작업 메모 / 조사 노트를 한곳에 모으는 폴더.

## 이동 후보 (사용자 확인 필요)

다음 파일들은 운영에 직접 필요하지 않은 작업 메모로 보입니다. 확인 후 이동해주세요:

| 파일 | 용도 추정 | 권장 조치 |
|------|----------|----------|
| `AI 관련된 스터디를 하는 모임을 이름을 정하려고 하는데 AI.txt` | 모임명 작명 검토 | 이동 |
| `BRAND_ASSETS_활용방안_2026_05_10.md` | 브랜드 자산 활용 메모 | 이동 |
| `SMS_솔루션_조사_2026_05_10.txt` | SMS 솔루션 조사 노트 | 이동 |
| `SMS_운영방안_2026_05_10.md` | SMS 운영 방안 | 이동 (운영 시작 시 다시 가져오기) |
| `WAAT — 수요일 오후 AI 수다.txt` | 모임 소개 초안 | 이동 |
| `배포_URL_2026_05_09.txt` | 초기 배포 URL 메모 | 이동 (현재 사용 URL은 `WAAT_사이트_URL.txt`에 있음) |
| `배포_명령어_이메일시스템_2026_05_14.txt` | 이메일 시스템 배포 명령어 | 보관 (or docs/로 이동) |
| `알리고_셋업_체크리스트_2026_05_14.txt` | 알리고 SMS 셋업 체크리스트 | 보관 (or docs/로 이동) |

## 유지 (루트에 둠)
- `README.md` — 프로젝트 진입점
- `WAAT_사이트_URL.txt` — 모바일에서 자주 참조
- `GUIDE_FOR_ADMIN.md` — 관리자 가이드
- `robots.txt`, `sitemap.xml` — 웹 표준 위치
- `vercel.json` — 배포 설정
- `.gitignore`, `.env` — 표준 위치

## 이동 명령 (Windows PowerShell)
```powershell
$root = "G:\내 드라이브\WAAT"
$archive = "$root\docs\ARCHIVES"
Move-Item "$root\AI 관련된 스터디를 하는 모임을 이름을 정하려고 하는데 AI.txt" $archive
Move-Item "$root\BRAND_ASSETS_활용방안_2026_05_10.md" $archive
Move-Item "$root\SMS_솔루션_조사_2026_05_10.txt" $archive
Move-Item "$root\SMS_운영방안_2026_05_10.md" $archive
Move-Item "$root\WAAT — 수요일 오후 AI 수다.txt" $archive
Move-Item "$root\배포_URL_2026_05_09.txt" $archive
```
