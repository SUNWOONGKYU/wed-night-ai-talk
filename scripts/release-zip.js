#!/usr/bin/env node
/**
 * release-zip.js — 배포판 zip 한 판을 사이트에 올리는 전 과정을 한 번에 한다.
 *
 *   node scripts/release-zip.js onemacs_v3.3.5.zip 7a3c990d2da74fd3 --prev onemacs_v3.3.4.zip
 *   node scripts/release-zip.js onemacs_v3.3.5.zip 7a3c990d2da74fd3 --check   (확인만, 바꾸지 않음)
 *   node scripts/release-zip.js StockTradeAutoSystem_v1.3.zip 89e484e322bb95b9 --product StockTradeAutoSystem
 *
 * --product 는 onemacs(기본) · StockTradeAutoSystem · ReportWritingAgent. 상품마다 바꿀 환경변수가 다르다.
 *
 * 왜 만들었나 (PO 2026-09-24 「수정 사항 배포본에도 빨리빨리 반영해, 시스템화해」)
 *   2026-09-24 새벽에만 판이 여섯 번 바뀌었고(3.3.0~3.3.5) 그때마다 사람이 같은 일곱 단계를
 *   손으로 했다. 손으로 하다가 실제로 두 번 사고가 날 뻔했다 —
 *     ① 환경변수만 바꾸고 배포를 안 해 옛 버전이 그대로 내려갔다
 *     ② 옛 zip 을 먼저 지워 받기 링크가 끊길 뻔했다(git 에서 되살려 막음)
 *   그래서 순서를 코드에 박는다. 순서가 틀리면 멈춘다.
 *
 * 하는 일 (하나라도 실패하면 그 자리에서 멈춘다)
 *   1. 폴더의 zip 을 sha256 으로 대조     — 다르면 즉시 중단
 *   2. vercel.json 에 내려받기 헤더 추가   — 이미 있으면 건너뜀
 *   3. 그 상품의 내려받기 주소·버전 환경변수를 새 판으로 교체
 *   4. 커밋 · push (배포가 돈다)
 *   5. 사이트에서 다시 받아 sha256 대조   — 최대 5분 기다린다
 *   6. --prev 를 주면, 5 가 끝난 뒤에만 옛 판을 내린다(커밋·push)
 *
 * ⚠️ 옛 판은 새 판이 사이트에서 확인된 뒤에만 지운다. 먼저 지우면 그 사이에 받기 링크가 빈다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.waat.community';
const SCOPE = 'finder-world';

const argv = process.argv.slice(2);
const CHECK_ONLY = argv.includes('--check');
const prevIdx = argv.indexOf('--prev');
const PREV = prevIdx >= 0 ? argv[prevIdx + 1] : null;
const prodIdx = argv.indexOf('--product');
const PRODUCT = prodIdx >= 0 ? argv[prodIdx + 1] : 'onemacs';
const [NAME, WANT] = argv.filter(a => !a.startsWith('--') && a !== PREV && a !== PRODUCT);

/** 상품별로 갈아 끼울 환경변수 — api/lib/market.js 의 이름과 같아야 한다 */
const ENV_KEYS = {
    'onemacs':      ['APK_DOWNLOAD_URL', 'PRODUCT_VERSION'],
    'StockTradeAutoSystem':    ['STOCK_TRADE_AUTO_SYSTEM_DOWNLOAD_URL', 'STOCK_TRADE_AUTO_SYSTEM_VERSION'],
    'ReportWritingAgent': ['REPORT_WRITING_AGENT_DOWNLOAD_URL', 'REPORT_WRITING_AGENT_VERSION']
};
if (!ENV_KEYS[PRODUCT]) {
  console.error('모르는 상품입니다: ' + PRODUCT + ' (onemacs · StockTradeAutoSystem · ReportWritingAgent 중 하나)');
  process.exit(2);
}

if (!NAME || !WANT) {
  console.error('사용법: node scripts/release-zip.js <파일이름.zip> <sha256 앞자리> [--product <상품>] [--prev <옛파일.zip>] [--check]');
  process.exit(2);
}

const say = (m) => console.log(m);
const die = (m) => { console.error('\n❌ ' + m); process.exit(1); };

function run(cmd, args, opts) {
  // 윈도우에서 shell:true 면 공백이 든 인자가 쪼개진다(커밋 메시지가 통째로 깨졌다 — 2026-09-24).
  // npx·curl 은 셸이 필요하고 git 은 필요 없으므로 git 만 셸 없이 돌린다.
  const needShell = process.platform === 'win32' && cmd !== 'git';
  const r = spawnSync(cmd, args, Object.assign({ cwd: ROOT, encoding: 'utf8', shell: needShell }, opts || {}));
  if (r.error) die(cmd + ' 실행 실패: ' + r.error.message);
  return r;
}

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// ── 1. 폴더 파일 대조 ─────────────────────────────────────────
const local = path.join(ROOT, 'console', NAME);
if (!fs.existsSync(local)) die('파일이 없습니다: console/' + NAME);
const localSha = sha(local);
const size = fs.statSync(local).size;
if (!localSha.startsWith(WANT)) {
  die('지문이 다릅니다.\n   받은 값 : ' + WANT + '\n   실제    : ' + localSha.slice(0, WANT.length) + '\n   파일을 다시 받으시거나 보내 주신 지문을 확인하십시오.');
}
say('① 폴더 파일 대조 ✔  ' + NAME + ' · ' + size.toLocaleString() + '바이트 · ' + localSha.slice(0, 16));

const url = SITE + '/console/' + NAME;
if (CHECK_ONLY) { say('\n--check 이므로 여기서 멈춥니다. 올릴 주소: ' + url); process.exit(0); }

// ── 2. vercel.json 헤더 ───────────────────────────────────────
// 2026-09-25: 출시 전 받기 차단 규칙(/console/:file → /market)을 넣었다(PO 「출시도 안 했는데 올려놓냐」).
// 새 판을 올린다는 것은 출시한다는 뜻이므로 여기서 그 규칙을 뺀다. 옛 기준줄(consolesystem_v2 헤더)은 그날 지웠다.
const vjPath = path.join(ROOT, 'vercel.json');
const vjObj = JSON.parse(fs.readFileSync(vjPath, 'utf8'));
const BLOCK_SRC = '/console/:file(.*.zip)';
if (vjObj.redirects.some((r) => r.source === BLOCK_SRC)) {
  vjObj.redirects = vjObj.redirects.filter((r) => r.source !== BLOCK_SRC);
  say('② 출시 전 받기 차단 규칙을 뺐습니다');
}
if (vjObj.headers.some((h) => h.source === '/console/' + NAME)) {
  say('② 내려받기 헤더 — 이미 있습니다');
} else {
  vjObj.headers.unshift({ source: '/console/' + NAME, headers: [
    { key: 'Content-Disposition', value: 'attachment; filename="' + NAME + '"' },
    { key: 'Cache-Control', value: 'public, max-age=3600' }
  ] });
  say('② 내려받기 헤더 추가 ✔');
}
fs.writeFileSync(vjPath, JSON.stringify(vjObj, null, 2) + '\n', 'utf8');
let vj = fs.readFileSync(vjPath, 'utf8');

// ── 3. 환경변수 ───────────────────────────────────────────────
const ver = (NAME.match(/_v([\d.]+)\.zip$/) || [])[1];
if (!ver) die('파일 이름에서 버전을 읽지 못했습니다(예: onemacs_v3.3.5.zip).');
const [URL_KEY, VER_KEY] = ENV_KEYS[PRODUCT];
for (const [key, value] of [[URL_KEY, url], [VER_KEY, 'v' + ver]]) {
  run('npx', ['vercel', 'env', 'remove', key, 'production', '--yes', '--scope', SCOPE]);
  const r = run('npx', ['vercel', 'env', 'add', key, 'production', '--scope', SCOPE], { input: value });
  if (!/Added Environment Variable/i.test((r.stdout || '') + (r.stderr || ''))) die(key + ' 설정 실패:\n' + r.stdout + r.stderr);
  say('③ ' + key + ' = ' + value + ' ✔');
}

// ── 4. 커밋 · push ────────────────────────────────────────────
run('git', ['add', 'console/' + NAME, 'vercel.json']);
const msg = '배포판 ' + NAME.replace(/\.zip$/, '') + ' 게시\n\n' +
  'sha256 ' + localSha.slice(0, 16) + '… 대조 확인 · ' + size.toLocaleString() + '바이트\n' +
  URL_KEY + ' · ' + VER_KEY + ' 를 v' + ver + ' 로.\n' +
  (PREV ? '옛 판(' + PREV + ')은 새 판이 사이트에서 확인된 뒤에 내린다.\n' : '') +
  '\nscripts/release-zip.js 로 처리.';
const msgFile = path.join(require('os').tmpdir(), 'relmsg_' + Date.now() + '.txt');
fs.writeFileSync(msgFile, msg, 'utf8');
const c = run('git', ['commit', '-q', '-F', msgFile]);
try { fs.unlinkSync(msgFile); } catch (_) {}
if (c.status !== 0 && !/nothing to commit/i.test(c.stdout + c.stderr)) die('커밋 실패:\n' + c.stdout + c.stderr);
run('git', ['pull', '--rebase', '--autostash', 'origin', 'main']);
const p = run('git', ['push', 'origin', 'main']);
if (p.status !== 0) die('push 실패:\n' + p.stdout + p.stderr);
say('④ 커밋 · push ✔  배포가 시작됐습니다');

// ── 5. 사이트에서 다시 받아 대조 ──────────────────────────────
say('⑤ 사이트 반영을 기다립니다 (최대 5분)…');
const tmp = path.join(require('os').tmpdir(), 'relcheck_' + Date.now() + '.zip');
let ok = false;
for (let i = 0; i < 15; i++) {
  const r = run('curl', ['-s', '-f', '-o', tmp, url]);
  if (r.status === 0 && fs.existsSync(tmp) && fs.statSync(tmp).size === size && sha(tmp) === localSha) { ok = true; break; }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20000);   // 20초 대기
}
try { fs.unlinkSync(tmp); } catch (_) {}
if (!ok) die('5분 안에 사이트에 반영되지 않았습니다. 배포 상태를 확인하십시오: npx vercel ls --scope ' + SCOPE + '\n   옛 판은 그대로 두었으니 받기 링크는 끊기지 않았습니다.');
say('⑤ 사이트 대조 ✔  ' + url);

// ── 6. 옛 판 내리기 (여기까지 와야 한다) ──────────────────────
if (PREV) {
  const old = path.join(ROOT, 'console', PREV);
  let vj2 = fs.readFileSync(vjPath, 'utf8');
  const re = new RegExp('    \\{\\n      "source": "/console/' + PREV.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '",\\n      "headers": \\[[\\s\\S]*?\\n      \\]\\n    \\},\\n');
  if (re.test(vj2)) { vj2 = vj2.replace(re, ''); JSON.parse(vj2); fs.writeFileSync(vjPath, vj2, 'utf8'); }
  if (fs.existsSync(old)) fs.unlinkSync(old);
  run('git', ['add', '-A', 'console', 'vercel.json']);
  const msg2 = PREV + ' 내림 — ' + NAME + ' 이 사이트에서 확인됨\n\nscripts/release-zip.js 로 처리.';
    const m2f = path.join(require('os').tmpdir(), 'relmsg2_' + Date.now() + '.txt');
    fs.writeFileSync(m2f, msg2, 'utf8');
    const c2 = run('git', ['commit', '-q', '-F', m2f]);
    try { fs.unlinkSync(m2f); } catch (_) {}
  if (c2.status === 0) {
    run('git', ['pull', '--rebase', '--autostash', 'origin', 'main']);
    run('git', ['push', 'origin', 'main']);
    say('⑥ 옛 판 내림 ✔  ' + PREV);
  } else {
    say('⑥ 옛 판 — 지울 것이 없었습니다');
  }
}

say('\n✅ 끝났습니다. 받는 주소: ' + url);
