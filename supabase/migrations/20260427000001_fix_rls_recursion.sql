-- RLS再帰問題の修正
-- participants の SELECT ポリシーが自テーブルをサブクエリで参照し
-- PostgreSQL 42P17（無限再帰）を引き起こすため、SECURITY DEFINER関数経由に変更

BEGIN;

-- ----------------------------------------------------------------
-- 1. SECURITY DEFINER関数の作成
--    この関数はRLSをバイパスして直接クエリするため再帰が発生しない
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_session_ids()
  RETURNS TABLE(session_id uuid)
  LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT session_id FROM public.participants WHERE auth_id = auth.uid()
$$;

-- ----------------------------------------------------------------
-- 2. participants ポリシーの修正
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "participants: read own session" ON public.participants;

CREATE POLICY "participants: read own session"
  ON public.participants FOR SELECT
  USING (
    session_id IN (SELECT session_id FROM public.get_my_session_ids())
  );

-- ----------------------------------------------------------------
-- 3. sessions UPDATE ポリシーの修正
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "sessions: update for participants" ON public.sessions;

CREATE POLICY "sessions: update for participants"
  ON public.sessions FOR UPDATE
  USING (
    id IN (SELECT session_id FROM public.get_my_session_ids())
  )
  WITH CHECK (
    id IN (SELECT session_id FROM public.get_my_session_ids())
  );

-- ----------------------------------------------------------------
-- 4. photos ポリシーの修正
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "photos: read own session" ON public.photos;
DROP POLICY IF EXISTS "photos: insert own" ON public.photos;
DROP POLICY IF EXISTS "photos: delete own" ON public.photos;

CREATE POLICY "photos: read own session"
  ON public.photos FOR SELECT
  USING (
    session_id IN (SELECT session_id FROM public.get_my_session_ids())
  );

CREATE POLICY "photos: insert own"
  ON public.photos FOR INSERT
  WITH CHECK (
    uploader_auth_id = auth.uid() AND
    session_id IN (SELECT session_id FROM public.get_my_session_ids())
  );

CREATE POLICY "photos: delete own"
  ON public.photos FOR DELETE
  USING (
    uploader_auth_id = auth.uid() AND
    session_id IN (SELECT session_id FROM public.get_my_session_ids())
  );

-- ----------------------------------------------------------------
-- 5. music_links ポリシーの修正
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "music_links: read own session" ON public.music_links;
DROP POLICY IF EXISTS "music_links: insert own" ON public.music_links;
DROP POLICY IF EXISTS "music_links: delete own" ON public.music_links;

CREATE POLICY "music_links: read own session"
  ON public.music_links FOR SELECT
  USING (
    session_id IN (SELECT session_id FROM public.get_my_session_ids())
  );

CREATE POLICY "music_links: insert own"
  ON public.music_links FOR INSERT
  WITH CHECK (
    added_by_auth_id = auth.uid() AND
    session_id IN (SELECT session_id FROM public.get_my_session_ids())
  );

CREATE POLICY "music_links: delete own"
  ON public.music_links FOR DELETE
  USING (
    added_by_auth_id = auth.uid() AND
    session_id IN (SELECT session_id FROM public.get_my_session_ids())
  );

-- ----------------------------------------------------------------
-- 6. storage.objects ポリシーの修正
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "photos storage: select in own session" ON storage.objects;
DROP POLICY IF EXISTS "photos storage: insert in own session" ON storage.objects;

CREATE POLICY "photos storage: select in own session"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos' AND
    (string_to_array(name, '/'))[1]::uuid IN (
      SELECT session_id FROM public.get_my_session_ids()
    )
  );

CREATE POLICY "photos storage: insert in own session"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos' AND
    (string_to_array(name, '/'))[1]::uuid IN (
      SELECT session_id FROM public.get_my_session_ids()
    )
  );

COMMIT;
