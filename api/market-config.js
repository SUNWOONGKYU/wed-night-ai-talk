/**
 * GET /api/market-config
 * 결제 화면이 쓰는 공개 설정 (가격 · 카카오페이 링크 · 계좌 · 카드결제 가능 여부). 비밀값 없음.
 * 값은 전부 Vercel 환경변수에서 온다 — 계좌번호를 저장소(공개 GitHub)에 넣지 않기 위해서다.
 */

const { publicConfig } = require('./lib/market.js');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '허용되지 않은 메서드입니다.' });
    }
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json(publicConfig());
};
