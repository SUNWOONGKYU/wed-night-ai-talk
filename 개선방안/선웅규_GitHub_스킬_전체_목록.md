# 선웅규 GitHub 스킬 전체 목록

> 조사 기준일: 2026-07-22
> 범위: `SUNWOONGKYU` 계정의 공개 저장소에서 `SKILL.md`가 확인된 항목
> 정리 기준: 같은 스킬이 여러 프로젝트·템플릿에 복사된 경우는 하나로 합산했다.

## 목록 요약

- 독립 공개 스킬: 12개
- 프로젝트 내부 스킬: 45개
- 중복을 제거한 논리 스킬: **총 57개**
- 보관 저장소와 템플릿에 있는 복제본은 별도 스킬로 세지 않았다.

## 1. 독립 공개 스킬 12개

| 스킬 | 한 줄 설명 | 저장소 |
| --- | --- | --- |
| mbo-천상 | 목표를 정의하고 승인·실행·달성 확인을 관리하는 최상위 메타 스킬 | [mbo-skill](https://github.com/SUNWOONGKYU/mbo-skill) |
| Claude 3계층 작업팀 | 여러 AI의 역할을 나누고 이중 검증까지 거치는 팀 작업 방식 | [claude-3tier-team](https://github.com/SUNWOONGKYU/claude-3tier-team) |
| 에신 | LLM 기반 AI 에이전트를 기획·제조·검증하는 에이전트 제작 공장 | [llm-dependent-agent-create](https://github.com/SUNWOONGKYU/llm-dependent-agent-create) |
| 에신-라이트 | 단순하고 저위험인 로컬 AI 에이전트를 빠르게 만드는 경량판 | [eshin-lite](https://github.com/SUNWOONGKYU/eshin-lite) |
| YouTube Generate | 기획부터 음성·이미지·편집·품질평가까지 영상 제작을 지휘하는 스킬 | [youtube-generate](https://github.com/SUNWOONGKYU/youtube-generate) |
| 웹세션 자동화 | 로그인된 전용 브라우저 세션으로 글쓰기·파일 업로드·다운로드·웹 작업을 자동화하는 스킬 | [web-session-automation](https://github.com/SUNWOONGKYU/web-session-automation) |
| 백호 소대 편성 | 대규모 다중 AI 작업팀을 소대·분대 구조로 조직하는 스킬 | [platoon-formation-claudecode](https://github.com/SUNWOONGKYU/platoon-formation-claudecode) |
| 옵신 | Claude·Wiki·Obsidian Vault를 생성·갱신·흡수하는 지식관리 스킬 | [claude-wiki-obsidian-vault](https://github.com/SUNWOONGKYU/claude-wiki-obsidian-vault) |
| 스킬 제조 공장 | 요구를 분석하고 검증된 부품으로 새 Claude Code 스킬을 만드는 스킬 | [skill-create](https://github.com/SUNWOONGKYU/skill-create) |
| Threads 에이전트 공장 | Threads의 실제 AI 활용 사례에서 새 에이전트 소재를 발굴·검증하는 스킬 | [threads-agent-factory](https://github.com/SUNWOONGKYU/threads-agent-factory) |
| 슬라이드쇼 웹 코어 | PPT형 슬라이드쇼 웹페이지를 만들고 GitHub로 공유하는 스킬 | [slideshow-web-core](https://github.com/SUNWOONGKYU/slideshow-web-core) |
| 검토·평가 코어 | 정해진 기준으로 산출물을 검토하고 품질 점수를 관리하는 스킬 | [review-evaluate-core](https://github.com/SUNWOONGKYU/review-evaluate-core) |

## 2. 프로젝트 내부 스킬 45개

다음 스킬은 일반 프로젝트 내부에 포함되어 있거나 개발 플랫폼·템플릿에 함께 보관된 항목이다. 독립 설치용 저장소가 있는 경우에는 1번의 독립 공개 스킬을 우선 사용한다.

### 2-1. 뉴스·콘텐츠 특화 스킬 3개

| 스킬 | 용도 | 확인된 저장소 |
| --- | --- | --- |
| deal-news | 뉴스·거래 관련 정보를 다루는 내부 스킬 | [ValueLink](https://github.com/SUNWOONGKYU/ValueLink), [SSALWorks](https://github.com/SUNWOONGKYU/SSALWorks) |
| Claude새소식 | Claude 관련 새 소식을 수집·정리하는 내부 스킬 | [wed-night-ai-talk](https://github.com/SUNWOONGKYU/wed-night-ai-talk) |
| ai-tutor-build | AI 튜터 기능을 만드는 내부 스킬 | [SSALWorks](https://github.com/SUNWOONGKYU/SSALWorks) |

### 2-2. 개발·배포·검증 스킬 20개

이 묶음은 [AX-On-Platform](https://github.com/SUNWOONGKYU/AX-On-Platform), [mychatbot-world](https://github.com/SUNWOONGKYU/mychatbot-world), [WebNovel_Studio](https://github.com/SUNWOONGKYU/WebNovel_Studio) 등의 개발 패키지와 템플릿에 반복 포함되어 있다.

| 스킬 | 용도 |
| --- | --- |
| api-builder | API 구축 |
| api-test | API 테스트 |
| cicd-setup | CI/CD 설정 |
| cpc-setup | CPC 환경 설정 |
| cpc-add-project | CPC 프로젝트 추가 |
| cpc-engage | CPC 참여·운영 |
| create-image | 이미지 생성 기능 구축 |
| db-schema | 데이터베이스 스키마 설계 |
| deploy-skill | 스킬 배포 |
| deploy-subagent | 서브에이전트 배포 |
| doc-generator | 문서 생성 |
| e2e-test | 종단간 테스트 |
| find-skills | 외부 스킬 탐색 |
| performance-check | 성능 점검 |
| security-audit | 보안 점검 |
| troubleshoot | 문제 진단·해결 |
| ui-ux-builder | UI/UX 구현 |
| sal-grid-dev | SAL Grid 개발 방식 적용 |
| 5times-debug-loop | 반복 디버깅 절차 |
| n8n-workflow-test | n8n 워크플로 테스트 |

### 2-3. MyChatbot World 기능 스킬 22개

다음은 [mychatbot-world](https://github.com/SUNWOONGKYU/mychatbot-world) 안에 기능 단위로 포함된 스킬이다.

| 스킬 | 기능 |
| --- | --- |
| 3d-avatar | 3D 아바타 |
| backup | 백업 |
| coupon | 쿠폰 |
| custom-theme | 사용자 테마 |
| email-send | 이메일 발송 |
| emoji-react | 이모지 반응 |
| faq-auto | FAQ 자동화 |
| google-cal | Google Calendar 연동 |
| kakao-noti | 카카오 알림 |
| lead-collect | 리드 수집 |
| multilang | 다국어 |
| pdf-upload | PDF 업로드 |
| profanity-filter | 비속어 필터 |
| reservation | 예약 |
| sentiment | 감성 분석 |
| spam-block | 스팸 차단 |
| stats-analysis | 통계 분석 |
| survey | 설문 |
| trader-expert | 트레이딩 전문가 기능 |
| tts-basic | 기본 TTS |
| voice-clone | 음성 복제 |
| web-crawl | 웹 크롤링 |

## 3. 중복·보관 항목

- [claude-skills-pack](https://github.com/SUNWOONGKYU/claude-skills-pack)은 `review-evaluate-core`와 `slideshow-web-core`의 묶음이다. 두 스킬은 1번에 이미 포함했다.
- 보관 상태인 [claude-meta-skills](https://github.com/SUNWOONGKYU/claude-meta-skills)는 `skill-create`와 `llm-dependent-agent-create`로 분리되었다. 새 설치 대상으로 권하지 않는다.
- `YouTube Generate`, `Claude 3계층 작업팀`, `백호 소대 편성`, `검토·평가`, `슬라이드쇼 웹 코어`는 여러 개발 템플릿에도 복사돼 있으나, 이 문서에서는 독립 공개 저장소 기준으로 한 번만 적었다.

## 4. 카카오 공지에 쓰는 방법

카카오 공지에 57개를 모두 넣으면 읽기 어렵다. 공지에는 1번의 독립 공개 스킬 12개만 짧게 소개하고, 이 문서 또는 GitHub 프로필을 전체 목록 링크로 두는 방식이 적합하다.

프로젝트 내부 스킬 45개는 개발 플랫폼·템플릿의 구성요소이므로, 필요한 사람이 해당 저장소에서 개별적으로 확인하도록 안내한다.

## 5. 확인 방법

각 저장소에서 초록색 `Code` 버튼을 눌러 `Download ZIP`으로 받거나 `git clone`으로 내려받을 수 있다. 설치 조건과 사용법은 각 저장소의 `README.md`와 `SKILL.md`를 기준으로 확인한다.
