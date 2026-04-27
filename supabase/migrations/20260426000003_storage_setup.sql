-- photos Storage バケット作成
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- NOTE: 以下のポリシーはparticipantsへのサブクエリを含む
--       20260427000001_fix_rls_recursion.sqlでget_my_session_ids()経由に再定義済み

-- 読み取り: 同一セッション参加者のみ
CREATE POLICY "photos storage: select in own session"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos' AND
    (string_to_array(name, '/'))[1]::uuid IN (
      SELECT session_id FROM public.participants WHERE auth_id = auth.uid()
    )
  );

-- アップロード: 同一セッション参加者のみ
CREATE POLICY "photos storage: insert in own session"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos' AND
    (string_to_array(name, '/'))[1]::uuid IN (
      SELECT session_id FROM public.participants WHERE auth_id = auth.uid()
    )
  );

-- 削除: アップロードした本人のみ（Supabase が自動設定する owner フィールドで制御）
CREATE POLICY "photos storage: delete own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'photos' AND
    owner = auth.uid()
  );
