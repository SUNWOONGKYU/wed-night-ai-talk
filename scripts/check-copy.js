#!/usr/bin/env node
// 문안 금지어 검사 (PO 규칙) — 커밋 전 훅과 수동 실행 겸용.
// 사용: node scripts/check-copy.js [파일...]   (인자 없으면 market/·console/·js/market*.js 전체)
// 금지어: 말풍선(→채팅창) · 쫄병(→졸병) · 팀장/팀원/부린다/부하/지휘(AI 4종은 협업) · 폰으로(→핸드폰에서) · PC 준비(→PC에 원맥스 설치하기) · 자동매매(→매매 자동화 봇) · 만든 곳(→판매자) · Automated Trading
const fs = require('fs'); const path = require('path');
const BAD = [/말풍선/, /쫄병/, /팀장/, /팀원/, /부린다/, /부하/, /지휘/, /폰으로/, /PC 준비/, /자동매매/, /자동 매매/, /만든 곳/, /Automated Trading/i, /영업일 \d+일/, /오픈채팅/];
const EXT = new Set(['.html', '.md', '.js', '.json']);
function walk(d, out) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const st = fs.statSync(p); if (st.isDirectory()) { if (!/^(_old|_backup|node_modules|img)/.test(f)) walk(p, out); } else if (EXT.has(path.extname(f))) out.push(p); } return out; }
let files = process.argv.slice(2);
if (!files.length) { files = []; for (const d of ['market', 'console']) if (fs.existsSync(d)) walk(d, files); for (const f of ['market.html', 'js/market-apps.js', 'js/market-home.js', 'js/onemacs.js', 'api/lib/mailer.js']) if (fs.existsSync(f)) files.push(f); }
let bad = 0;
for (const f of files) {
  if (!EXT.has(path.extname(f)) || !fs.existsSync(f) || /README\.md$/.test(f)) continue;  // README 는 규칙 설명이라 제외
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => { if (/copy-ok/.test(l)) return; for (const re of BAD) if (re.test(l)) { bad++; console.log(`${f}:${i + 1}: ${re} — ${l.trim().slice(0, 100)}`); } });
}
if (bad) { console.error(`\n금지어 ${bad}건 — 커밋 전에 고치세요 (market/README.md 7절 문안 규칙).`); process.exit(1); }
console.log('문안 금지어 0건');
