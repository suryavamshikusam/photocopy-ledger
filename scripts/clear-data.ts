import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load the .env.local file
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase environment variables in .env.local");
  process.exit(1);
}

// Use the service role key to bypass RLS policies
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function clearData() {
  console.log("Starting data cleanup...");

  // 1. Delete all transactions
  const { error: txError } = await supabase
    .from('transactions')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to delete all

  if (txError) {
    console.error("Failed to delete transactions:", txError.message);
  } else {
    console.log("✅ All transactions have been deleted.");
  }

  // 2. Reset all user balances to 0
  const { error: profilesError } = await supabase
    .from('profiles')
    .update({ current_balance: 0 })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (profilesError) {
    console.error("Failed to reset balances:", profilesError.message);
  } else {
    console.log("✅ All student balances have been reset to ₹0.");
  }

  console.log("Cleanup complete!");
}

clearData();
