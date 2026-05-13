-- Raise the session capacity from 4 to 5 participants.
-- Replaces join_session with the same idempotent behavior as the previous
-- migration, changing only the new-participant capacity check.

CREATE OR REPLACE FUNCTION public.join_session(p_code text, p_name text)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_session public.sessions;
  v_participant public.participants;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT * INTO v_session
    FROM public.sessions
    WHERE code = p_code AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  SELECT * INTO v_participant
    FROM public.participants
    WHERE session_id = v_session.id AND auth_id = auth.uid()
    ORDER BY joined_at ASC
    LIMIT 1;

  IF FOUND THEN
    UPDATE public.sessions
      SET last_active_at = now()
      WHERE id = v_session.id
      RETURNING * INTO v_session;

    RETURN json_build_object(
      'session', row_to_json(v_session),
      'participant', row_to_json(v_participant)
    );
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.participants
    WHERE session_id = v_session.id;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'session_full';
  END IF;

  INSERT INTO public.participants (session_id, name, auth_id)
    VALUES (v_session.id, p_name, auth.uid())
    RETURNING * INTO v_participant;

  UPDATE public.sessions
    SET last_active_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;

  RETURN json_build_object(
    'session', row_to_json(v_session),
    'participant', row_to_json(v_participant)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_session(text, text) TO anon, authenticated;
