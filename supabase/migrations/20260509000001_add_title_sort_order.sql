-- music_links に title と sort_order を追加
ALTER TABLE public.music_links
  ADD COLUMN title text NOT NULL DEFAULT '',
  ADD COLUMN sort_order double precision NOT NULL DEFAULT 0;

-- 既存レコードの sort_order を created_at のエポック秒で初期化（挿入順を保持）
UPDATE public.music_links
  SET sort_order = EXTRACT(EPOCH FROM created_at);
