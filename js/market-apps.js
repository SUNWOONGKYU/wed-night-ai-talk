// ========== WAAT AI 툴 마켓 — 상품 목록 ==========
// 여기에 한 줄(객체 하나) 추가하면 /market 홈에 카드가 생긴다. 렌더는 js/market-home.js.
//   id       : 고유 키 (URL 슬러그와 맞춘다)
//   name     : 이름(브랜드 표기 규칙: 'One MACS · 원맥스' 슬래시)
//   fullname : 풀네임 2행째(제목 영역 고정 표기: 이름 아래 작게. 카드·추천 배너 모두)
//   desc     : 주제 문장(카드에서 이름 다음 굵은 첫 줄)
//   sub      : 부제(주제 아래 작은 글씨)
//   cat      : 카테고리 (MARKET_CATS 에 있는 값)
//   price    : 원. 0 = 무료, null = 미정
//   tags     : 카드 아래 작은 배지
//   bundle   : 포함 구성(배열). 렌더에서 '포함 구성: A · B' 한 줄 (bundleLabel 이 있으면 머리말을 그것으로)
//   icon/color : 아이콘 글자 / 배경
//   seller   : { name, link } — 카드에 '판매자: name' 로 표시, 상세에서는 link(#seller 법정 표기 블록)로 연결. 열린 장터라 툴마다 적는다
//   url      : 카드 링크. null 이면 링크 없음(출시 예정 등)
//   featured : (미사용 — 목록은 하나이고 모든 툴이 배너형으로 나열됨)
//   soon     : true 면 "출시 예정" 표시 (soonText 로 문구 지정)
//   launch   : 'config' 면 출시 모드를 GET /api/market-config 의 mode 로 따른다 (reserve = 출시 알림 예약 카드 / sale = 결제 카드).
//              데이터는 모드와 무관하게 두고, 렌더(market-home.js)가 mode 에 따라 배지·버튼만 바꾼다
window.MARKET_APPS = [
  { id: 'onemacs', name: 'One MACS · 원맥스', fullname: 'One-stop Multi AI-CLI Console System',
    desc: '여러 PC에서 진행 중인 프로젝트를 한곳에 모아 놓고, 핸드폰에서 AI 4대장 CLI에게 작업을 시킵니다.',
    sub: 'Claude Code를 중심으로 Codex·Antigravity·Grok CLI가 한 팀으로 구성되어 협업합니다.',
    cat: 'AI 협업 시스템', featured: true, launch: 'config',
    price: 9900, tags: ['Android', 'Claude Code 필요'],
    bundle: ['주식 매매 자동화 시스템 패키지', '보고서 작성 에이전트 패키지'], bundleLabel: '2026년 10월 25일까지 무료: ',
    icon: '', img: '/market/img/onemacs_icon.png',
    color: 'linear-gradient(135deg,#d97757,#1fb98a,#5b8cff)', url: '/market/onemacs',
    // ---- 툴 정보 블록 (실제 값만 — 없는 값은 필드를 두지 않는다 → 렌더에서 숨김. 렌더: js/market-appinfo.js) ----
    // 버전·업데이트 날짜·다운로드 크기·다운로드 수·예약 수·평점은 여기 두지 않고 API 에서 온다(단일 소스):
    //   /api/market-config(version·updated·mode) · /api/market-stats(downloads·sizeLabel) · /api/reserve-count · /api/reviews?summary=1
    age: '전체',
    android: '8.0',                                   // → "Android 8.0 이상" (APK 최소 지원, 평가 R5)
    delivery: { type: '패키지(PC 설치본)에 포함', note: 'PC에 설치한 뒤 핸드폰 설정에서 [앱 받기]를 누르면 내 PC가 모바일 앱을 내려 줍니다. 마켓에서 따로 받지 않습니다. 보고서 작성 에이전트 ARWA는 준비되는 대로 이메일로 따로 보내드립니다. 구글 플레이 등록은 준비 중' },
    needs: ['Windows PC에 One MACS를 설치해야 합니다 (Claude Code 가 안내)', 'AI 4종(Claude Code·Codex·Antigravity·Grok) 중 1개 이상 로그인된 계정이 있어야 합니다', 'PC와 같은 인터넷이 아니어도 됩니다'],
    permissions: [
      { name: '인터넷',        why: 'PC 와 연결합니다' },
      { name: '네트워크 상태', why: '인터넷이 다시 연결되면 자동으로 다시 접속합니다' },
      { name: '카메라',        why: 'QR 코드를 읽고, 사진을 찍어 AI 에게 보냅니다' },
      { name: '알림',          why: 'AI 작업이 끝나면 알려 줍니다' } ],
    dataSafety: {
      collect: ['주문 이메일(구매할 때)', '예약 이메일(출시 알림을 신청할 때)', '리뷰 이메일(확인용 — 해시만 보관)'],
      onDevice: ['PIN(암호화)', '오류 기록(핸드폰 안에만 — 문제 신고 때 본인이 보냄)'],
      share: '없음', deleteEmail: 'wksun999@hanmail.net', policy: '/privacy.html' },
    changelog: [   // 사용자 관점 문장 · 버전별 3줄 이내 (근거: 평가_APK완성도_R1~R5.md). 1.4.6 이하는 근거 문서가 없어 비워 둔다(추정 금지)
      { ver: '1.4.9', date: '2026-09-21', notes: ['인터넷이 다시 연결되면 자동으로 다시 접속합니다', '핸드폰의 글꼴 크기 설정을 그대로 따릅니다', '화면 읽기 도구에서 버튼 이름을 읽어 줍니다'] },
      { ver: '1.4.8', date: '2026-09-21', notes: ['설정에 "문제 신고"(오류 기록을 이메일로 보내기)를 넣었습니다', '설치 안내 문장을 더 쉽게 고쳤습니다', '대화창의 긴급 정지 단추를 맨 앞으로, 탭 단추를 더 크게'] },
      { ver: '1.4.7', date: '2026-09-21', notes: ['PIN 이 틀리면 바로 알려 주고 다시 입력할 수 있습니다', 'PC 가 응답하지 않으면 20초 뒤 안내와 [다시 연결] 단추가 나옵니다', 'PIN 을 암호화해 저장하고, 뒤로가기로 이전 단계로 갈 수 있습니다'] } ],
    lang: '한국어', iap: false,
    released: null,                                   // 출시 후 'YYYY-MM-DD'. null + 예약 모드 → "출시 예정"
    seller: { name: '파인더월드', link: '#seller' },   // 전자상거래 표시 항목은 상세 하단 판매자 블록(#seller) 한 곳에만 — 단일 소스
    reportEmail: 'wksun999@hanmail.net' },
  { id: 'ReportWritingAgent', name: '보고서 작성 에이전트 (ARWA)', fullname: 'Automated Report Writing Agent',
    desc: '자료를 주면 근거를 붙여 보고서를 작성합니다. 출처가 확인되지 않은 문장은 내보내지 않습니다.',
    sub: '혼자 사시면 5,500원입니다. One MACS(9,900원)에는 곧 업데이트로 들어갑니다.',
    cat: 'AI 에이전트', launch: 'config',
    price: 5500, tags: ['Windows PC', 'Claude Code 필요'],
    icon: '', img: '/market/img/arwa_icon.png', color: 'linear-gradient(135deg,#2E3A5F,#C9A961)',
    url: '/market/ReportWritingAgent',
    age: '전체',
    delivery: { type: '내려받는 파일(PC 설치본)', note: '받은 파일을 자기 폴더에 풉니다. One MACS 폴더 안이 아닙니다 — 따로 도는 프로그램입니다' },
    needs: ['Windows PC (켜 두어야 합니다)', 'Claude Code 계정 (본인 구독)', '핸드폰에서 열려면 라이선스 키로 주소를 받습니다'],
    dataSafety: {
      collect: ['주문 이메일(구매할 때)', '예약 이메일(출시 알림을 신청할 때)'],
      onDevice: ['작성 중인 보고서와 자료(내 PC 안에만)'],
      share: '없음', deleteEmail: 'wksun999@hanmail.net', policy: '/privacy.html' },
    lang: '한국어', iap: false,
    released: null,
    seller: { name: '파인더월드', link: '#seller' },
    reportEmail: 'wksun999@hanmail.net' },
  { id: 'StockTradeAutoSystem', name: '주식 매매 자동화 시스템 (STAS)', fullname: 'Stock Trading Auto System',
    desc: '국내 주식선물 290종목을 대상으로, 사전에 정해진 신호 규칙과 운영 규칙에 따라 매매를 자동화하는 PC 프로그램입니다.',
    sub: '매일 장 시작 전 오늘의 매매 종목 후보를 선정하고, 장중에 매수·매도 타이밍 신호가 포착되면 텔레그램을 통해 승인을 받아 주문이 이루어집니다. 보유 종목의 손절과 이익 확정은 운영 규칙에 따라 자동으로 처리됩니다. 이 시스템은 모의투자용이며, 이를 참고해 자신만의 신호 규칙과 운영 규칙을 만들어 사용하시기 바랍니다.',
    cat: '트레이딩', launch: 'config',
    price: 5500, tags: ['Windows PC', '증권사 계좌 필요'],
    icon: '선', color: 'linear-gradient(135deg,#1FB98A,#2E3A5F)',
    url: '/market/StockTradeAutoSystem',
    age: '전체',
    delivery: { type: '내려받는 파일(PC 설치본)', note: '구매 확인 이메일의 「패키지 내려받기」 버튼으로 받습니다.' },
    needs: ['Windows PC', 'Python 3.11 이상', 'Claude Code', '텔레그램', '한국투자증권 계좌와 API 키'],
    dataSafety: { summary: '판매자는 이메일 주소만 받으며, 다른 곳에 넘기지 않습니다.', policy: '/privacy.html' },
    lang: '한국어', iap: false,
    released: null,
    seller: { name: '파인더월드', link: '#seller' },
    reportEmail: 'wksun999@hanmail.net' }
];

// 카테고리 칩 순서. '전체' 는 필터 전용(상품 cat 값이 아님).
window.MARKET_CATS = ['전체', 'AI 협업 시스템', 'AI 에이전트', '트레이딩'];  // PO 확정 카테고리 3개(2026-09-21): AI 관련만 — One MACS는 'AI 협업 시스템'
