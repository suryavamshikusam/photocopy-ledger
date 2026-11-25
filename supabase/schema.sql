-- 0. Clean up existing tables (if any)
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 1. Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'student')) DEFAULT 'student',
  current_balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL CHECK (type IN ('deposit', 'deduction')),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(10, 2) NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Database Trigger: process_xerox_transaction
CREATE OR REPLACE FUNCTION public.process_xerox_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_role TEXT;
  v_current_balance NUMERIC(10, 2);
  v_new_balance NUMERIC(10, 2);
BEGIN
  -- 1. Validate caller has role = 'admin' (NULL-safe comparison)
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = auth.uid();

  IF v_admin_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can process transactions';
  END IF;

  -- 2. Get current balance of the target user WITH lock to prevent race conditions
  SELECT current_balance INTO v_current_balance
  FROM public.profiles
  WHERE id = NEW.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 3. Calculate new balance
  IF NEW.type = 'deposit' THEN
    v_new_balance := v_current_balance + NEW.amount;
  ELSIF NEW.type = 'deduction' THEN
    v_new_balance := v_current_balance - NEW.amount;
  ELSE
    RAISE EXCEPTION 'Invalid transaction type';
  END IF;

  -- 4. Update the NEW record's balance_after before insertion
  NEW.balance_after := v_new_balance;
  -- Ensure admin_id is forced to the current auth user
  NEW.admin_id := auth.uid();

  -- 5. Update the user's profile balance
  UPDATE public.profiles
  SET current_balance = v_new_balance
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the transaction trigger
CREATE TRIGGER before_insert_transaction
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.process_xerox_transaction();

-- Create a secure function to check admin status without causing recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Prevent students from modifying protected profile columns (role, current_balance, etc.)
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service role / postgres migrations (where auth.uid() is NULL) and admins
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

CREATE TRIGGER before_update_profile
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_update();

-- Server-side aggregation RPC for Admin metrics (avoids PostgREST 1,000-row cap)
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

-- 4. Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
-- Admins can view all profiles. Students can view only their own.
CREATE POLICY "Profiles are viewable by owner or admin" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR public.is_admin()
  );

-- Admins can update all profiles. Students can only update their own must_change_password flag (enforced by trigger).
CREATE POLICY "Users can update their own password flag, Admins can update all" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Transactions Policies
-- Admins can view all transactions. Students can view only their own.
CREATE POLICY "Transactions viewable by owner or admin" ON public.transactions
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_admin()
  );

-- Only Admins can insert transactions
CREATE POLICY "Only admins can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (
    public.is_admin()
  );

-- Transactions are IMMUTABLE. NO UPDATE or DELETE allowed for ANYONE.
-- (By not creating UPDATE or DELETE policies, they are denied by default under RLS)

-- Create index for faster querying
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);
