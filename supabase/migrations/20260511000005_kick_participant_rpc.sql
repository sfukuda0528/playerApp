-- Allow only the session host to remove non-host participants.

CREATE OR REPLACE FUNCTION public.kick_participant(p_participant_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_target public.participants;
  v_session public.sessions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT * INTO v_target
    FROM public.participants
    WHERE id = p_participant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_not_found';
  END IF;

  SELECT * INTO v_session
    FROM public.sessions
    WHERE id = v_target.session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  IF v_session.host_auth_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_target.auth_id IS NOT DISTINCT FROM v_session.host_auth_id THEN
    RAISE EXCEPTION 'cannot_kick_host';
  END IF;

  DELETE FROM public.participants
    WHERE id = p_participant_id;

  UPDATE public.sessions
    SET last_active_at = now()
    WHERE id = v_session.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kick_participant(uuid) TO anon, authenticated;
