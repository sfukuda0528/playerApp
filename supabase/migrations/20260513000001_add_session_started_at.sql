-- Persist whether the host has started the room so later joiners can skip
-- the pre-start waiting screen and enter the active session immediately.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS started_at timestamptz;
