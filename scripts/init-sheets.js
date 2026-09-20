/**
 * Google Sheets 초기화 (최초 1회) — Orders / DownloadLogs / EmailLogs 시트와 헤더 생성
 *
 * 사용법 (저장소 루트에서, .env 에 GOOGLE_SERVICE_ACCOUNT·SPREADSHEET_ID 를 넣은 뒤):
 *   node scripts/init-sheets.js
 *
 * 기존 판매 시스템의 스프레드시트를 그대로 쓰는 경우에도 실행해도 된다 —
 * 있는 시트는 건드리지 않고 헤더만 다시 쓰며(Orders 는 N·O·P 열 헤더 paymentMethod·licenseKey·product 가 추가됨), 없는 시트만 만든다.
 */

const fs = require('fs');
const path = require('path');

// .env 간단 로더 (dotenv 의존성 없이)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(function (line) {
        const mm = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (mm && !process.env[mm[1]]) process.env[mm[1]] = mm[2].replace(/^["']|["']$/g, '');
    });
}

const { initializeSpreadsheet } = require('../api/lib/sheets.js');

(async function main() {
    try {
        if (!process.env.GOOGLE_SERVICE_ACCOUNT) throw new Error('GOOGLE_SERVICE_ACCOUNT 환경변수가 없습니다.');
        if (!process.env.SPREADSHEET_ID) throw new Error('SPREADSHEET_ID 환경변수가 없습니다.');
        console.log('스프레드시트 초기화 시작: ' + process.env.SPREADSHEET_ID);
        const r = await initializeSpreadsheet();
        console.log('완료. 새로 만든 시트: ' + (r.created.length ? r.created.join(', ') : '없음(기존 시트 유지)'));
    } catch (e) {
        console.error('초기화 실패: ' + e.message);
        console.error('확인: Google Sheets API 활성화, 서비스 계정 이메일을 스프레드시트에 편집자로 공유했는지');
        process.exit(1);
    }
})();
