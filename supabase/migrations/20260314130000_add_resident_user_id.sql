-- Add resident_user_id to complaints if missing (no data changes).
-- Safe for existing databases.

alter table if exists public.complaints
  add column if not exists resident_user_id uuid;

-- Optional FK (not valid to avoid failing on existing rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'complaints_resident_user_id_fkey'
      AND conrelid = 'public.complaints'::regclass
  ) THEN
    ALTER TABLE public.complaints
      ADD CONSTRAINT complaints_resident_user_id_fkey
      FOREIGN KEY (resident_user_id) REFERENCES public.users (id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

create index if not exists complaints_resident_idx
  on public.complaints (resident_user_id, created_at desc);
