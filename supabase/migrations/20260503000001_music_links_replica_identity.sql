-- music_links テーブルの REPLICA IDENTITY を FULL に変更
-- Realtime の DELETE イベントで session_id フィルターが評価できるようにする
alter table public.music_links replica identity full;
