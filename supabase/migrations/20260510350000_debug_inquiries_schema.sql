-- inquiries 테이블 컬럼/제약 디버깅
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '=== inquiries 컬럼 ===';
    FOR rec IN
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'inquiries'
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE 'col=% type=% null=% default=%', rec.column_name, rec.data_type, rec.is_nullable, rec.column_default;
    END LOOP;

    RAISE NOTICE '=== inquiries 제약 ===';
    FOR rec IN
        SELECT conname, contype, pg_get_constraintdef(c.oid) AS def
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'inquiries'
    LOOP
        RAISE NOTICE 'con=% type=% def=%', rec.conname, rec.contype, rec.def;
    END LOOP;

    RAISE NOTICE '=== inquiries RLS 정책 ===';
    FOR rec IN
        SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS check_expr
        FROM pg_policy
        WHERE polrelid = 'public.inquiries'::regclass
    LOOP
        RAISE NOTICE 'pol=% cmd=% using=% check=%', rec.polname, rec.polcmd, rec.using_expr, rec.check_expr;
    END LOOP;
END $$;
