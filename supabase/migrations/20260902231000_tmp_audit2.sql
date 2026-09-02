CREATE OR REPLACE FUNCTION _waat_tmp_audit2(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    IF p_token IS DISTINCT FROM 'ba52ec97-6065-4184-bebf-ba92d293ac55' THEN
        RETURN jsonb_build_object('error','denied');
    END IF;
    RETURN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'name', p.proname,
          'args', pg_get_function_identity_arguments(p.oid),
          'returns_trigger', pg_get_function_result(p.oid) = 'trigger',
          'security_definer', p.prosecdef,
          'has_admin_guard', pg_get_functiondef(p.oid) ILIKE '%is_admin%'
                             OR pg_get_functiondef(p.oid) ILIKE '%admin only%',
          'uses_auth_uid', pg_get_functiondef(p.oid) ILIKE '%auth.uid()%'
      ) ORDER BY p.proname), '[]'::jsonb)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f'
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
        AND pg_get_function_result(p.oid) <> 'trigger'
        AND p.proname NOT LIKE '\_waat\_tmp\_%'
    );
END $$;
GRANT EXECUTE ON FUNCTION _waat_tmp_audit2(text) TO anon;
