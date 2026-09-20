-- ===========================================================================
-- 앱 마켓 (콘솔 시스템 판매) — 주문·설정 테이블 + RPC + 다운로드 버킷
-- 2026-09-20
--
-- 구조
--   app_settings : 계좌·카카오페이 링크·다운로드 주소 등 (관리자만 읽고 쓴다)
--   app_orders   : 주문 (관리자만 목록·상태 변경, 구매자는 RPC 로 자기 주문만 조회)
--
-- 접근 원칙 (2026-09-02 하드닝과 같은 방식)
--   · anon 은 테이블을 직접 만지지 못한다. 주문 생성/조회는 SECURITY DEFINER RPC 로만.
--     - create_app_order(name, contact, method) → 주문번호 발급 (금액·상태는 서버가 정한다)
--     - get_app_order(order_no, contact)       → 주문번호 + 연락처가 모두 맞아야 상태를 준다.
--                                                 paid 일 때만 라이선스 키·다운로드 주소 포함.
--     - get_market_settings()                  → 입금 계좌·카카오페이 링크 등 '공개해도 되는 키'만.
--                                                 (download_url 은 절대 여기 안 나간다)
--   · 관리자는 RLS(is_admin()) 로 테이블 직접 접근.
--   · 라이선스 키는 상태가 paid 로 바뀌는 순간 트리거가 서버에서 만든다.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) app_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
    key        text PRIMARY KEY,
    value      text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_admin_all ON public.app_settings;
CREATE POLICY app_settings_admin_all ON public.app_settings
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

REVOKE ALL ON public.app_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;

-- PO 가 관리자 화면에서 채울 자리. 빈 값으로 시드.
INSERT INTO public.app_settings (key, value) VALUES
    ('bank_name',       ''),      -- 은행명
    ('bank_account',    ''),      -- 계좌번호
    ('bank_holder',     ''),      -- 예금주
    ('kakaopay_link',   ''),      -- https://qr.kakaopay.com/...
    ('download_url',    ''),      -- 결제 확인 후에만 내려주는 APK 주소 (공개 RPC 에 절대 안 나감)
    ('product_price',   '9900'),  -- 원, VAT 포함
    ('product_version', 'v1.0'),
    ('seller_info',     '')       -- 판매자 표기 (상호·대표·사업자번호·통신판매업신고·연락처) — 비우면 화면에 '입력 예정' 표시
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) app_orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_orders (
    id           bigserial PRIMARY KEY,
    order_no     text NOT NULL UNIQUE,                       -- CS-20260920-AB12
    product_code text NOT NULL DEFAULT 'console_system',
    product_name text NOT NULL DEFAULT '콘솔 시스템',
    amount       integer NOT NULL DEFAULT 9900,
    buyer_name   text NOT NULL,
    contact      text NOT NULL,                              -- 이메일 또는 휴대폰 (입력 그대로, trim 만)
    pay_method   text NOT NULL CHECK (pay_method IN ('bank', 'kakaopay')),
    status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    license_key  text UNIQUE,
    paid_at      timestamptz,
    admin_note   text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_orders_created_at_idx ON public.app_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS app_orders_status_idx     ON public.app_orders (status);

ALTER TABLE public.app_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_orders_admin_select ON public.app_orders;
CREATE POLICY app_orders_admin_select ON public.app_orders
    FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS app_orders_admin_update ON public.app_orders;
CREATE POLICY app_orders_admin_update ON public.app_orders
    FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS app_orders_admin_delete ON public.app_orders;
CREATE POLICY app_orders_admin_delete ON public.app_orders
    FOR DELETE TO authenticated USING (is_admin());

-- INSERT 는 아무에게도 직접 열지 않는다 — create_app_order() 만 쓴다.
REVOKE ALL ON public.app_orders FROM anon;
GRANT SELECT, UPDATE, DELETE ON public.app_orders TO authenticated;
GRANT USAGE ON SEQUENCE public.app_orders_id_seq TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) 보조 함수
-- ---------------------------------------------------------------------------

-- 연락처 비교용 정규화: 소문자, 공백·하이픈·괄호·점 제거
CREATE OR REPLACE FUNCTION public.app_norm_contact(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT lower(regexp_replace(coalesce(p, ''), '[\s\-\(\)\.]', '', 'g'));
$$;

-- 헷갈리는 글자(0/O, 1/I/L) 뺀 32자 알파벳으로 무작위 문자열.
-- random() 이 아니라 gen_random_uuid() 의 바이트를 쓴다 (예측 어려움).
CREATE OR REPLACE FUNCTION public.app_random_code(p_len integer)
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31자
    hex  text := '';
    out_ text := '';
    i    integer;
BEGIN
    WHILE length(hex) < p_len * 2 LOOP
        hex := hex || replace(gen_random_uuid()::text, '-', '');
    END LOOP;
    FOR i IN 0 .. p_len - 1 LOOP
        out_ := out_ || substr(alphabet,
                               1 + (('x' || substr(hex, i * 2 + 1, 2))::bit(8)::int % length(alphabet)),
                               1);
    END LOOP;
    RETURN out_;
END;
$$;

-- 라이선스 키: XXXX-XXXX-XXXX-XXXX (16자)
CREATE OR REPLACE FUNCTION public.gen_license_key()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
    SELECT substr(c, 1, 4) || '-' || substr(c, 5, 4) || '-' || substr(c, 9, 4) || '-' || substr(c, 13, 4)
      FROM (SELECT public.app_random_code(16) AS c) s;
$$;

-- updated_at 갱신 + paid 전환 시 paid_at·license_key 서버 생성
CREATE OR REPLACE FUNCTION public.app_orders_before_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
        NEW.paid_at := coalesce(NEW.paid_at, now());
        IF NEW.license_key IS NULL THEN
            LOOP
                NEW.license_key := public.gen_license_key();
                EXIT WHEN NOT EXISTS (SELECT 1 FROM public.app_orders WHERE license_key = NEW.license_key);
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_orders_before_update_trg ON public.app_orders;
CREATE TRIGGER app_orders_before_update_trg
    BEFORE UPDATE ON public.app_orders
    FOR EACH ROW EXECUTE FUNCTION public.app_orders_before_update();

-- ---------------------------------------------------------------------------
-- 4) 공개 RPC (anon)
-- ---------------------------------------------------------------------------

-- 결제 안내에 필요한 공개 설정만. download_url 은 제외.
CREATE OR REPLACE FUNCTION public.get_market_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      FROM public.app_settings
     WHERE key IN ('bank_name', 'bank_account', 'bank_holder', 'kakaopay_link',
                   'product_price', 'product_version', 'seller_info');
$$;

REVOKE ALL ON FUNCTION public.get_market_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_market_settings() TO anon, authenticated;

-- 주문 생성. 금액·상태·주문번호는 서버가 정한다.
-- 같은 연락처로 24시간에 5건 넘으면 거부 (스팸 방어, 정상 사용자는 1~2건).
CREATE OR REPLACE FUNCTION public.create_app_order(
    p_name    text,
    p_contact text,
    p_method  text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name    text := trim(coalesce(p_name, ''));
    v_contact text := trim(coalesce(p_contact, ''));
    v_method  text := lower(trim(coalesce(p_method, '')));
    v_price   integer;
    v_no      text;
    v_row     public.app_orders;
    v_recent  integer;
BEGIN
    IF length(v_name) < 1 OR length(v_name) > 50 THEN
        RAISE EXCEPTION '이름을 입력해 주세요 (50자 이내)' USING ERRCODE = '22023';
    END IF;
    IF length(v_contact) < 5 OR length(v_contact) > 100 THEN
        RAISE EXCEPTION '이메일 또는 휴대폰 번호를 입력해 주세요' USING ERRCODE = '22023';
    END IF;
    IF v_contact !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND public.app_norm_contact(v_contact) !~ '^\+?[0-9]{9,15}$' THEN
        RAISE EXCEPTION '이메일 또는 휴대폰 번호 형식이 올바르지 않습니다' USING ERRCODE = '22023';
    END IF;
    IF v_method NOT IN ('bank', 'kakaopay') THEN
        RAISE EXCEPTION '결제 방법을 선택해 주세요' USING ERRCODE = '22023';
    END IF;

    SELECT count(*) INTO v_recent
      FROM public.app_orders
     WHERE public.app_norm_contact(contact) = public.app_norm_contact(v_contact)
       AND created_at > now() - interval '24 hours';
    IF v_recent >= 5 THEN
        RAISE EXCEPTION '같은 연락처로 주문이 너무 많습니다. 기존 주문번호로 조회해 주세요' USING ERRCODE = '53400';
    END IF;

    SELECT coalesce(nullif(value, '')::integer, 9900) INTO v_price
      FROM public.app_settings WHERE key = 'product_price';
    v_price := coalesce(v_price, 9900);

    LOOP
        v_no := 'CS-' || to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYYMMDD') || '-' || public.app_random_code(4);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.app_orders WHERE order_no = v_no);
    END LOOP;

    INSERT INTO public.app_orders (order_no, amount, buyer_name, contact, pay_method)
    VALUES (v_no, v_price, v_name, v_contact, v_method)
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
        'order_no',   v_row.order_no,
        'amount',     v_row.amount,
        'buyer_name', v_row.buyer_name,
        'contact',    v_row.contact,
        'pay_method', v_row.pay_method,
        'status',     v_row.status,
        'created_at', v_row.created_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_app_order(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_app_order(text, text, text) TO anon, authenticated;

-- 주문 조회. 주문번호 + 연락처가 둘 다 맞아야 한다. 못 찾으면 NULL.
-- paid 일 때만 license_key 와 download_url 을 넣어 준다.
CREATE OR REPLACE FUNCTION public.get_app_order(
    p_order_no text,
    p_contact  text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.app_orders;
    v_dl  text;
    v_out jsonb;
BEGIN
    SELECT * INTO v_row
      FROM public.app_orders
     WHERE order_no = upper(trim(coalesce(p_order_no, '')))
       AND public.app_norm_contact(contact) = public.app_norm_contact(p_contact);
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_out := jsonb_build_object(
        'order_no',   v_row.order_no,
        'amount',     v_row.amount,
        'buyer_name', v_row.buyer_name,
        'contact',    v_row.contact,
        'pay_method', v_row.pay_method,
        'status',     v_row.status,
        'created_at', v_row.created_at,
        'paid_at',    v_row.paid_at
    );

    IF v_row.status = 'paid' THEN
        SELECT value INTO v_dl FROM public.app_settings WHERE key = 'download_url';
        v_out := v_out || jsonb_build_object(
            'license_key',  v_row.license_key,
            'download_url', coalesce(v_dl, '')
        );
    END IF;
    RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.get_app_order(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_app_order(text, text) TO anon, authenticated;

-- 내부 보조 함수는 밖에서 못 부르게
REVOKE ALL ON FUNCTION public.app_random_code(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gen_license_key() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_norm_contact(text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) 다운로드 버킷 (APK 보관)
--    public 버킷이지만 storage.objects 에 anon 정책을 하나도 만들지 않으므로
--    목록 조회·업로드는 불가하고, '정확한 경로를 아는 사람'만 내려받을 수 있다.
--    경로는 무작위 32자 폴더 아래 두고 app_settings.download_url 에만 적는다.
--    (진짜 비공개 + 서명 URL 로 올리려면 Vercel 함수에 service_role 키가 필요 — v2 과제)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('app-downloads', 'app-downloads', true, 20971520,
            ARRAY['application/vnd.android.package-archive', 'application/octet-stream'])
    ON CONFLICT (id) DO NOTHING;
    RAISE NOTICE '[ok] storage bucket app-downloads';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[skip] storage bucket 생성 실패 (대시보드에서 수동 생성): %', SQLERRM;
END $$;
