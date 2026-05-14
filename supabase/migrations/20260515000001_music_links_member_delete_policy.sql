-- Allow any current session participant to remove music links in that session.
-- Queue deletion is a shared member action; playback control remains host-only.

CREATE POLICY "music_links: members delete session links"
  ON public.music_links FOR DELETE
  USING (
    session_id IN (SELECT session_id FROM public.get_my_session_ids())
  );
