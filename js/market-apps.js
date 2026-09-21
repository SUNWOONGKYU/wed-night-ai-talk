// ========== WAAT 앱마켓 — 상품 목록 ==========
// 여기에 한 줄(객체 하나) 추가하면 /market 홈에 카드가 생긴다. 렌더는 js/market-home.js.
//   id       : 고유 키 (URL 슬러그와 맞춘다)
//   name     : 이름(브랜드 표기 규칙: 'One MACS · 원맥스' 슬래시)
//   fullname : 풀네임 2행째(제목 영역 고정 표기: 이름 아래 작게. 카드·추천 배너 모두)
//   desc     : 주제 문장(카드에서 이름 다음 굵은 첫 줄)
//   sub      : 부제(주제 아래 작은 글씨)
//   cat      : 카테고리 (MARKET_CATS 에 있는 값)
//   price    : 원. 0 = 무료, null = 미정
//   tags     : 카드 아래 작은 배지
//   bundle   : 포함 구성(배열). 렌더에서 '포함 구성: A · B' 한 줄
//   icon/color : 아이콘 글자 / 배경
//   maker    : 만든 곳(카드에 '만든 곳: …' 로 표시). 다른 제작자의 앱도 올라오므로 앱마다 적는다
//   url      : 카드 링크. null 이면 링크 없음(출시 예정 등)
//   featured : (미사용 — 목록은 하나이고 모든 앱이 배너형으로 나열됨)
//   soon     : true 면 "출시 예정" 표시 (soonText 로 문구 지정)
//   launch   : 'config' 면 출시 모드를 GET /api/market-config 의 mode 로 따른다 (reserve = 출시 알림 예약 카드 / sale = 결제 카드).
//              데이터는 모드와 무관하게 두고, 렌더(market-home.js)가 mode 에 따라 배지·버튼만 바꾼다
window.MARKET_APPS = [
  { id: 'onemacs', name: 'One MACS · 원맥스', fullname: 'One-stop Multi AI Console System · 원스톱 멀티 AI 콘솔 시스템',
    desc: '여러 PC에서 진행 중인 프로젝트를 한곳에 모아 놓고, 핸드폰에서 AI 4대장 CLI에게 작업을 시킵니다.',
    sub: 'Claude Code를 중심으로 Codex·Antigravity·Grok CLI가 한 팀으로 구성되어 협업합니다.',
    cat: 'AI 협업 시스템', featured: true, maker: '파인더월드', launch: 'config',
    price: 9900, tags: ['Android', 'Claude Code 필요'],
    bundle: ['트레이딩 시그널(국내 주식 262종목 스캐너 + 말로 전략 만들기)', '보고서 작성 AI 에이전트(곧 추가)'],
    icon: '', img: '/market/img/onemacs_icon.png',
    color: 'linear-gradient(135deg,#d97757,#1fb98a,#5b8cff)', url: '/market/onemacs' }
];

// 카테고리 칩 순서. '전체' 는 필터 전용(상품 cat 값이 아님).
window.MARKET_CATS = ['전체', 'AI 협업 시스템', 'AI 에이전트', '트레이딩'];  // PO 확정 카테고리 3개(2026-09-21): AI 관련만 — 원맥스는 'AI 협업 시스템'
