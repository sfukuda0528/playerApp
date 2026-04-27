-- supabase/migrations/20260426000002_media_sharing.sql

-- sessions に host_auth_id 追加
ALTER TABLE public.sessions ADD COLUMN host_auth_id uuid;

-- photos テーブル
CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  uploader_auth_id uuid NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos: read own session"
  ON public.photos FOR SELECT
  USING (
    session_id IN (
      SELECT session_id FROM public.participants WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "photos: insert own"
  ON public.photos FOR INSERT
  WITH CHECK (
    uploader_auth_id = auth.uid() AND
    session_id IN (
      SELECT session_id FROM public.participants WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "photos: delete own"
  ON public.photos FOR DELETE
  USING (
    uploader_auth_id = auth.uid() AND
    session_id IN (
      SELECT session_id FROM public.participants WHERE auth_id = auth.uid()
    )
  );

CREATE INDEX ON public.photos(session_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;

-- music_links テーブル
CREATE TABLE public.music_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  added_by_auth_id uuid NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.music_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "music_links: read own session"
  ON public.music_links FOR SELECT
  USING (
    session_id IN (
      SELECT session_id FROM public.participants WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "music_links: insert own"
  ON public.music_links FOR INSERT
  WITH CHECK (
    added_by_auth_id = auth.uid() AND
    session_id IN (
      SELECT session_id FROM public.participants WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "music_links: delete own"
  ON public.music_links FOR DELETE
  USING (
    added_by_auth_id = auth.uid() AND
    session_id IN (
      SELECT session_id FROM public.participants WHERE auth_id = auth.uid()
    )
  );

CREATE INDEX ON public.music_links(session_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.music_links;
