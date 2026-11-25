import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const targetEmail = 'sohailgulbargaa@gmail.com';
  const newName = 'sohailgulbargaa';

  let matchedUserId: string | undefined;
  let page = 1;
  const perPage = 1000;

  while (!matchedUserId) {
    const { data, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
    if (listError) throw listError;
    if (!data?.users?.length) break;

    matchedUserId = data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase())?.id;
    if (data.users.length < perPage) break;
    page++;
  }

  if (!matchedUserId) {
    console.error(`User with email ${targetEmail} not found!`);
    return;
  }

  console.log(`Found user ${matchedUserId}, updating full_name to ${newName}...`);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: newName })
    .eq('id', matchedUserId);

  if (profileError) {
    console.error('Error updating public.profiles', profileError);
    return;
  }

  console.log('Successfully updated full_name in public.profiles.');
}

main().catch(console.error);
