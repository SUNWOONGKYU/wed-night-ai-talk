-- ===========================================================================
-- 앱 마켓 Supabase 주문 저장 방식 철회 (2026-09-20)
--
-- 같은 날 오전에 만든 20260920100000_app_market_orders.sql 을 되돌린다.
-- PO 결정: 결제·주문 저장은 기존 판매 시스템 방식(Vercel 서버리스 + Google Sheets +
-- JWT 다운로드 + Gmail)으로 통일. Supabase 에는 주문 테이블을 두지 않는다.
--
-- 앞 파일을 지우지 않고 이 '되돌림' 파일을 추가하는 이유: 원격에 이미 적용된 버전이라
-- 로컬 파일을 지우면 supabase db push 가 버전 불일치로 멈춘다.
--
-- storage 버킷 app-downloads 와 그 안의 APK 는 남긴다 — Vercel 함수 api/download/[token].js 가
-- APK_DOWNLOAD_URL 환경변수로 가리키는 실제 파일 위치다 (목록 조회 정책 없음, 무작위 경로).
-- ===========================================================================

DROP FUNCTION IF EXISTS public.get_app_order(text, text);
DROP FUNCTION IF EXISTS public.create_app_order(text, text, text);
DROP FUNCTION IF EXISTS public.get_market_settings();

DROP TRIGGER IF EXISTS app_orders_before_update_trg ON public.app_orders;
DROP FUNCTION IF EXISTS public.app_orders_before_update();
DROP FUNCTION IF EXISTS public.gen_license_key();
DROP FUNCTION IF EXISTS public.app_random_code(integer);
DROP FUNCTION IF EXISTS public.app_norm_contact(text);

DROP TABLE IF EXISTS public.app_orders;
DROP TABLE IF EXISTS public.app_settings;
