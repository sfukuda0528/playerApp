-- Ensure Realtime DELETE payloads include filter columns such as session_id.
alter table public.participants replica identity full;
alter table public.photos replica identity full;
