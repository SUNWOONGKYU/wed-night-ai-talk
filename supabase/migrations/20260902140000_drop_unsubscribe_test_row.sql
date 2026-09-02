-- 수신거부 검증용 임시 프로필 제거 (20260902130000 에서 만든 것)
--
-- 실브라우저 검증 완료 후 삭제한다. 남기면 회원 수가 1명 부풀고,
-- 무엇보다 발송 대상 목록에 가짜 주소가 섞인다.

DO $$
DECLARE
    n integer;
BEGIN
    DELETE FROM public.profiles
     WHERE id = '2e77d56b-12ae-4e0a-9d32-f1eeb58f3215';
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '[ok] 테스트 행 %건 삭제', n;

    IF EXISTS (SELECT 1 FROM public.profiles
                WHERE id = '2e77d56b-12ae-4e0a-9d32-f1eeb58f3215') THEN
        RAISE EXCEPTION '테스트 행이 남아 있습니다';
    END IF;
END
$$;
