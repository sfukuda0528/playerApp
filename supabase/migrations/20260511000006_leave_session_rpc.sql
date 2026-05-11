-- Allow participants to leave a session themselves. Hosts must end the session instead.

CREATE OR REPLACE FUNCTION public.leave_session(p_session_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_session public.sessions;
  v_participant public.participants;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT * INTO v_session
    FROM public.sessions
    WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  IF v_session.host_auth_id IS NOT DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'host_must_end_session';
  END IF;

  SELECT * INTO v_participant
    FROM public.participants
    WHERE session_id = p_session_id
      AND auth_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_not_found';
  END IF;

  DELETE FROM public.participants
    WHERE id = v_participant.id;

  UPDATE public.sessions
    SET last_active_at = now()
    WHERE id = p_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_session(uuid) TO anon, authenticated;
