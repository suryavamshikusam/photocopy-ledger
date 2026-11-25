-- Safe, non-destructive migration for existing live Supabase databases.
-- Run this in the Supabase SQL Editor (does NOT drop tables or delete data).

-- 1. Enforce NOT NULL constraints (backfill NULLs first if any exist)
UPDATE public.profiles SET role = 'student' WHERE role IS NULL;
UPDATE public.profiles SET current_balance = 0.00 WHERE current_balance IS NULL;
UPDATE public.profiles SET must_change_password = true WHERE must_change_password IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN current_balance SET NOT NULL,
  ALTER COLUMN must_change_password SET NOT NULL;

ALTER TABLE public.transactions
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN amount SET NOT NULL;

-- 2. Harden is_admin() with fixed search_path
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 3. Harden process_xerox_transaction() with NULL-safe admin check and fixed search_path
CREATE OR REPLACE FUNCTION public.process_xerox_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_role TEXT;
  v_current_balance NUMERIC(10, 2);
  v_new_balance NUMERIC(10, 2);
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();

  IF v_admin_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can process transactions';
  END IF;

  SELECT current_balance INTO v_current_balance
  FROM public.profiles
  WHERE id = NEW.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF NEW.type = 'deposit' THEN
    v_new_balance := v_current_balance + NEW.amount;
  ELSIF NEW.type = 'deduction' THEN
    v_new_balance := v_current_balance - NEW.amount;
  ELSE
    RAISE EXCEPTION 'Invalid transaction type';
  END IF;

  NEW.balance_after := v_new_balance;
  NEW.admin_id := auth.uid();

  UPDATE public.profiles
  SET current_balance = v_new_balance
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Block privilege escalation & balance tampering on public.profiles
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.current_balance IS DISTINCT FROM OLD.current_balance
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.full_name IS DISTINCT FROM OLD.full_name
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Students may only update must_change_password';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS before_update_profile ON public.profiles;
CREATE TRIGGER before_update_profile
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_update();

DROP POLICY IF EXISTS "Users can update their own password flag, Admins can update all" ON public.profiles;
CREATE POLICY "Users can update their own password flag, Admins can update all" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- 5. Add server-side Admin metrics RPC (avoids PostgREST 1,000-row cap)
CREATE OR REPLACE FUNCTION public.get_admin_metrics()
RETURNS TABLE (
  total_deposits NUMERIC(12, 2),
  total_spent NUMERIC(12, 2),
  net_balance NUMERIC(12, 2),
  low_balance_count INTEGER
) AS $$
DECLARE
  v_total_deposits NUMERIC(12, 2) := 0;
  v_total_spent NUMERIC(12, 2) := 0;
  v_net_balance NUMERIC(12, 2) := 0;
  v_low_balance_count INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can access global metrics';
  END IF;

  SELECT
    GREATEST(0, COALESCE(SUM(
      CASE
        WHEN note LIKE 'Correction by Admin:%' AND note LIKE '%entered as a deposit in error%' THEN
          CASE WHEN type = 'deduction' THEN -amount ELSE amount END
        WHEN note LIKE 'Correction by Admin:%' AND note LIKE '%entered as a deduction in error%' THEN
          0
        WHEN type = 'deposit' THEN amount
        ELSE 0
      END
    ), 0)),
    GREATEST(0, COALESCE(SUM(
      CASE
        WHEN note LIKE 'Correction by Admin:%' AND note LIKE '%entered as a deduction in error%' THEN
          CASE WHEN type = 'deposit' THEN -amount ELSE amount END
        WHEN note LIKE 'Correction by Admin:%' AND note LIKE '%entered as a deposit in error%' THEN
          0
        WHEN type = 'deduction' THEN amount
        ELSE 0
      END
    ), 0))
  INTO v_total_deposits, v_total_spent
  FROM public.transactions;

  SELECT
    COALESCE(SUM(current_balance), 0),
    COUNT(*) FILTER (WHERE current_balance < 50)
  INTO v_net_balance, v_low_balance_count
  FROM public.profiles
  WHERE role = 'student';

  RETURN QUERY SELECT v_total_deposits, v_total_spent, v_net_balance, v_low_balance_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

