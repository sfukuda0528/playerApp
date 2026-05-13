-- photos Storage バケットのアップロード上限を 20 MB に引き上げ
UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'photos';
