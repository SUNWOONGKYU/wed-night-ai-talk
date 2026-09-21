// ========== WAAT 앱마켓 — 상품 목록 ==========
// 여기에 한 줄(객체 하나) 추가하면 /market 홈에 카드가 생긴다. 렌더는 js/market-home.js.
//   id       : 고유 키 (URL 슬러그와 맞춘다)
//   name/sub : 이름 / 한 줄 부제
//   cat      : 카테고리 (MARKET_CATS 에 있는 값)
//   desc     : 카드 설명 (사람 말로, 규제선 준수)
//   price    : 원. 0 = 무료, null = 미정
//   tags     : 카드 아래 작은 배지
//   icon/color : 아이콘 글자 / 배경
//   maker    : 만든 곳(카드에 '만든 곳: …' 로 표시). 다른 제작자의 앱도 올라오므로 앱마다 적는다
//   url      : 카드 링크. null 이면 링크 없음(출시 예정 등)
//   featured : true 인 상품 1개가 추천 배너
//   soon     : true 면 "출시 예정" 표시 (soonText 로 문구 지정)
window.MARKET_APPS = [
  { id: 'onemacs', name: '원맥스 One MACS', sub: 'Claude Code를 중심으로 Codex·Antigravity·Grok CLI가 한 팀으로 구성되어 협업합니다.', cat: 'AI 도구', featured: true, maker: '파인더월드',
    desc: '여러 PC에서 진행 중인 프로젝트를 한곳에 모아 놓고, 핸드폰에서 AI 4대장 CLI에게 작업을 시킵니다.',
    price: 9900, tags: ['Android', 'Claude Code 필요', '무료 동봉: 트레이딩 시그널 스캐너 · 트레이딩 봇 · 보고서 작성 AI 에이전트(출시 예정)'], icon: '', img: '/market/img/onemacs_icon.png',
    color: 'linear-gradient(135deg,#d97757,#1fb98a,#5b8cff)', url: '/market/onemacs' },

  { id: 'next-1', name: '다음 앱', sub: '준비 중', cat: 'AI 도구',
    desc: '새 앱을 순서대로 올립니다.',
    price: null, tags: ['출시 예정'], icon: '…', color: 'var(--bg2)', url: null, soon: true, soonText: '준비 중' }
];

// 카테고리 칩 순서. '전체' 는 필터 전용(상품 cat 값이 아님).
window.MARKET_CATS = ['전체', 'AI 도구'];  // 트레이딩·문서 카테고리는 해당 앱이 올라올 때 다시 추가  // '무료' 필터 메뉴는 PO 지시로 제거(2026-09-21)
