-- Start a room through a host-only RPC so started_at is persisted consistently
-- and the frontend receives the canonical updated session row.

CREATE OR REPLACE FUNCTION public.start_session(p_session_id uuid)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_session public.sessions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT * INTO v_session
    FROM public.sessions
    WHERE id = p_session_id AND status = 'active'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  IF v_session.host_auth_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_session_host';
  END IF;

  UPDATE public.sessions
    SET started_at = COALESCE(started_at, now()),
        last_active_at = now()
    WHERE id = p_session_id
    RETURNING * INTO v_session;

  RETURN row_to_json(v_session);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_session(uuid) TO anon, authenticated;
