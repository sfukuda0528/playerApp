-- セッション作成もRPC経由に統一
-- useSessionCreate.ts が participants に直接INSERTしており
-- 20260511000001 の WITH CHECK (false) ポリシーで失敗していた

CREATE OR REPLACE FUNCTION public.create_session(p_host_name text)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_session public.sessions;
  v_code char(6);
  v_attempts int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  LOOP
    v_code := lpad(floor(random() * 900000 + 100000)::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sessions WHERE code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'could not generate unique code';
    END IF;
  END LOOP;

  INSERT INTO public.sessions (code, host_name, host_auth_id, status, last_active_at, inactivity_timeout_min)
    VALUES (v_code, p_host_name, auth.uid(), 'active', now(), 360)
    RETURNING * INTO v_session;

  INSERT INTO public.participants (session_id, name, auth_id)
    VALUES (v_session.id, p_host_name, auth.uid());

  RETURN row_to_json(v_session);
END;
$$;
