-- sessions テーブルの REPLICA IDENTITY を FULL に変更
-- Realtime の UPDATE イベントで全カラムが payload.new に含まれるようにする
alter table public.sessions replica identity full;
