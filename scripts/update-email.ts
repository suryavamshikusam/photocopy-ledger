import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const newEmail = 'sohailgulbargaa@gmail.com';
  const newName = 'sohailgulbargaa'; // Removing the extra 'a' from the name as well

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) throw listError;

  const user = users.find(u => u.email === newEmail);
  
  if (!user) {
    console.error(`User with email ${newEmail} not found!`);
    return;
  }

  console.log(`Found user ${user.id}, updating full_name to ${newName}...`);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: newName })
    .eq('id', user.id);

  if (profileError) {
    console.error('Error updating public.profiles', profileError);
    return;
  }

  console.log('Successfully updated full_name in public.profiles.');
}

main().catch(console.error);
