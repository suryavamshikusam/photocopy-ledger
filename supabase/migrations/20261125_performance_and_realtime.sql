-- Performance & Realtime upgrade for existing live Supabase databases.
-- Safe and idempotent: run in Supabase SQL Editor.

-- 1. Composite B-tree index for instant per-student sorted history lookups
CREATE INDEX IF NOT EXISTS idx_transactions_user_created
  ON public.transactions (user_id, created_at DESC);

-- 2. Enable Supabase Realtime live updates for transactions and profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
