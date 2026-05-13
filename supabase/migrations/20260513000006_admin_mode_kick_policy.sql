-- Persist local admin mode on the participant row and allow admins to kick
-- non-host participants. Authentication for entering admin mode is intentionally
-- left to the frontend flow for now.

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.set_admin_mode(
  p_session_id uuid,
  p_is_admin boolean
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  UPDATE public.participants
    SET is_admin = p_is_admin
    WHERE session_id = p_session_id
      AND auth_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_not_found';
  END IF;

  UPDATE public.sessions
    SET last_active_at = now()
    WHERE id = p_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_admin_mode(uuid, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.kick_participant(p_participant_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_target public.participants;
  v_session public.sessions;
  v_actor_is_admin boolean;
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

  SELECT EXISTS (
    SELECT 1
      FROM public.participants
      WHERE session_id = v_session.id
        AND auth_id = auth.uid()
        AND is_admin = true
  ) INTO v_actor_is_admin;

  IF v_session.host_auth_id IS DISTINCT FROM auth.uid() AND NOT v_actor_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_target.auth_id IS NOT DISTINCT FROM v_session.host_auth_id THEN
    RAISE EXCEPTION 'cannot_kick_host';
  END IF;

  IF v_target.auth_id IS NOT DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'cannot_kick_self';
  END IF;

  DELETE FROM public.participants
    WHERE id = p_participant_id;

  UPDATE public.sessions
    SET last_active_at = now()
    WHERE id = v_session.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kick_participant(uuid) TO anon, authenticated;
