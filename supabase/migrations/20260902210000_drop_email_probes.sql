-- 진단용 임시 함수 제거 (20260902200000 / 201000 / 202000 에서 만든 것)
--
-- "메일 하단에 수신거부가 안 보인다"(PO)를 원격에서 진단하려고 잠깐 만든 조회 함수들이다.
-- 결론: 푸터는 정상적으로 붙고 있었고, 마지막 테스트가 나간 주소가 회원 명단에 없는
-- 주소여서(비회원) 토큰을 만들 수 없었고 그래서 '링크 없음' 문구가 나갔다.
-- 회원에게는 링크가 붙는다. 비회원에게도 mailto 형태 List-Unsubscribe 를 붙이도록 보완했고,
-- 관리자 화면이 발송 전에 "N명은 회원 명단에 없어 링크가 붙지 않는다"고 경고하도록 했다.
--
-- 진단이 끝났으므로 남기지 않는다.

DROP FUNCTION IF EXISTS _waat_tmp_email_preview(text);
DROP FUNCTION IF EXISTS _waat_tmp_email_match(text, text);
DROP FUNCTION IF EXISTS _waat_tmp_last_recipient(text);

DO $$
DECLARE
    leftover text;
BEGIN
    SELECT string_agg(p.proname, ', ')
      INTO leftover
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname LIKE '\_waat\_tmp\_%';

    IF leftover IS NOT NULL THEN
        RAISE EXCEPTION '[검증실패] 임시 함수가 남아 있다: %', leftover;
    END IF;

    RAISE NOTICE '[ok] 임시 진단 함수 전부 제거됨';
END $$;
