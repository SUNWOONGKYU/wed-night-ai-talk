-- ===========================================================================
-- 앱 마켓 Supabase 주문 객체 최종 철회 (2026-09-20 15:40)
-- PO 최종 확정: 결제·주문 = 기존 판매 시스템 방식(Vercel 함수 + Google Sheets + JWT + Gmail).
-- 120000(복원) 으로 다시 만들어진 app_orders/app_settings/RPC 를 내린다.
-- 버킷 app-downloads 와 APK 는 유지 (Vercel 환경변수 APK_DOWNLOAD_URL 이 가리키는 파일).
-- ===========================================================================
DROP FUNCTION IF EXISTS public.get_app_order(text, text);
DROP FUNCTION IF EXISTS public.create_app_order(text, text, text);
DROP FUNCTION IF EXISTS public.get_market_settings();

DROP TRIGGER IF EXISTS app_orders_before_update_trg ON public.app_orders;
DROP FUNCTION IF EXISTS public.app_orders_before_update();
DROP FUNCTION IF EXISTS public.gen_license_key();
DROP FUNCTION IF EXISTS public.app_random_code(integer);
DROP FUNCTION IF EXISTS public.app_norm_contact(text);

DROP TRIGGER IF EXISTS app_orders_sheet_sync_trg ON public.app_orders;
DROP TABLE IF EXISTS public.app_orders;
DROP TABLE IF EXISTS public.app_settings;
