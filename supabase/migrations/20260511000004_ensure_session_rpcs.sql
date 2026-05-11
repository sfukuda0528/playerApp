-- Ensure the RPCs used by the current frontend exist in production.
-- This is intentionally additive/repeatable via CREATE OR REPLACE so a
-- partially migrated production database can be repaired by db push.

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

  SELECT COUNT(*) INTO v_count
    FROM public.participants
    WHERE session_id = v_session.id;

  IF v_count >= 4 THEN
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

GRANT EXECUTE ON FUNCTION public.join_session(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_session(text) TO anon, authenticated;
