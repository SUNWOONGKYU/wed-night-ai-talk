// ========== WAAT 앱마켓 — 상품 목록 ==========
// 여기에 한 줄(객체 하나) 추가하면 /market 홈에 카드가 생긴다. 렌더는 js/market-home.js.
//   id       : 고유 키 (URL 슬러그와 맞춘다)
//   name/sub : 이름 / 한 줄 부제
//   cat      : 카테고리 (MARKET_CATS 에 있는 값)
//   desc     : 카드 설명 (사람 말로, 규제선 준수)
//   price    : 원. 0 = 무료, null = 미정
//   tags     : 카드 아래 작은 배지
//   icon/color : 아이콘 글자 / 배경
//   url      : 카드 링크. null 이면 링크 없음(출시 예정 등)
//   featured : true 인 상품 1개가 추천 배너
//   soon     : true 면 "출시 예정" 표시 (soonText 로 문구 지정)
window.MARKET_APPS = [
  { id: 'onemacs', name: '원맥스 One MACS', sub: 'One-stop Multi AI Console System', cat: 'AI 도구', featured: true,
    desc: '당신의 Claude Code에 AI 3개(Codex·Antigravity·Grok)를 더 붙이고, 여러 PC의 프로젝트를 폰 한 화면에서 부립니다.',
    price: 9900, tags: ['Android', 'Claude Code 필요', 'API 요금 0원'], icon: '', img: '/market/img/onemacs_icon.png',
    color: 'linear-gradient(135deg,#d97757,#1fb98a,#5b8cff)', url: '/market/onemacs' },

  { id: 'trading-signal', name: '트레이딩 시그널', sub: '262종목 스캐너 + 실행기', cat: '트레이딩',
    desc: '국내 주식 262종목을 훑어 신호를 띄우고, 말로 만든 전략을 같은 스캐너에서 돌립니다. 실행기는 본인 증권사 키로, 주문 전 승인 필수.',
    price: 0, tags: ['무료', '원맥스 One MACS 동봉', '한국투자증권 키 선택'], icon: '262',
    color: 'linear-gradient(135deg,#1fb98a,#0f766e)', url: '/console#bot' },

  { id: 'report-agent', name: '보고서 작성 AI 에이전트', sub: '7대 요소', cat: '문서·보고서',
    desc: '페르소나·목표·지식베이스·도구·안전장치·자율루프까지 7대 요소를 갖춘 보고서 에이전트. 자료 폴더를 주면 초안부터 최종본까지.',
    price: 0, tags: ['무료', '원맥스 One MACS 동봉', 'Claude Code 필요'], icon: '報',
    color: 'linear-gradient(135deg,#5b8cff,#312e81)', url: null, soon: true, soonText: '출시 예정' },

  { id: 'next-1', name: '다음 앱', sub: '준비 중', cat: 'AI 도구',
    desc: '파인더월드가 매일 쓰는 도구를 순서대로 올립니다.',
    price: null, tags: ['출시 예정'], icon: '…', color: 'var(--bg2)', url: null, soon: true, soonText: '준비 중' }
];

// 카테고리 칩 순서. '전체' 는 필터 전용(상품 cat 값이 아님).
window.MARKET_CATS = ['전체', 'AI 도구', '트레이딩', '문서·보고서'];  // '무료' 필터 메뉴는 PO 지시로 제거(2026-09-21)
