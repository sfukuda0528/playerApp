-- music_links の UPDATE ポリシー追加
-- sort_order の更新（並び替え）を同セッションの参加者全員に許可

CREATE POLICY "music_links: update sort_order for session participants"
  ON public.music_links FOR UPDATE
  USING (
    session_id IN (SELECT session_id FROM public.get_my_session_ids())
  )
  WITH CHECK (
    session_id IN (SELECT session_id FROM public.get_my_session_ids())
  );
