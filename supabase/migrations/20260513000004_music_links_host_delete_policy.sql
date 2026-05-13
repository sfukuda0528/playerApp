-- Allow the session host to remove any music link in their session.
-- This is required for host-driven playback cleanup when a member-added song ends.

CREATE POLICY "music_links: host delete session links"
  ON public.music_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions
      WHERE sessions.id = music_links.session_id
        AND sessions.host_auth_id = auth.uid()
    )
  );
