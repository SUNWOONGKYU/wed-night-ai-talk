-- locations 테이블 현황 디버깅용
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '=== locations 테이블 전체 ===';
    FOR rec IN SELECT id, name, loc_type, sort_order, is_active FROM locations ORDER BY sort_order, id LOOP
        RAISE NOTICE 'id=% name=% type=% sort=% active=%', rec.id, rec.name, rec.loc_type, rec.sort_order, rec.is_active;
    END LOOP;
END $$;
