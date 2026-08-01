import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load env vars
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase URL or Service Role Key in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createAdmin() {
  const email = 'admin@example.com'; // You can change this
  const password = 'AdminPassword123!';
  const name = 'Admin User';

  console.log(`Creating admin user: ${email}`);

  // 1. Create user in Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError && !authError.message.includes('already registered')) {
    console.error('Error creating admin auth:', authError);
    return;
  }

  let userId = authData?.user?.id;
  if (!userId) {
    const { data: { users } } = await supabase.auth.admin.listUsers();
    userId = users.find(u => u.email === email)?.id;
  }

  if (userId) {
    // 2. Insert into profiles table with 'admin' role
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: name,
      email: email,
      role: 'admin',
      must_change_password: false,
    }, { onConflict: 'id' });

    if (profileError) {
      console.error('Error creating admin profile:', profileError);
    } else {
      console.log('Admin user created successfully!');
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
    }
  }
}

createAdmin();
