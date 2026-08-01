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

// Create a Supabase client with the service role key to bypass RLS and use Admin API
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// The user provided list of 60 users
const rawUsers = [
  "bjayavardhan009@gmail.com",
  "Hari Krishna <hariadithyasai@gmail.com>",
  "ITISH PRASHAR <Itishprashar@gmail.com>",
  "Shreyansh Sharma <shrey.chd191@gmail.com>",
  "ssrthejas@gmail.com",
  "gouthamk12303@gmail.com",
  "sitharamavura1@gmail.com",
  "Malay Chatpalliwar <malaychatpalliwar@gmail.com>",
  "Sai Teja <saitejvelagawada@gmail.com>",
  "iraianbun876@gmail.com",
  "Sai Kanha Sethy <saikanhasethy2@gmail.com>",
  "natraj gudla <natrajgudla637@gmail.com>",
  "bassiaryan65@gmail.com",
  "Dharun Balaji A <dharunbalajia@gmail.com>",
  "kurumalasiddu2002@gmail.com",
  "saijaswanthpalli08@gmail.com",
  "saiswaroop943@gmail.com",
  "upadhyayjeet55@gmail.com",
  "segu Dhanvi <helloguruprema123@gmail.com>",
  "Aditya Thakur <at1999.manu@gmail.com>",
  "devisettyvignesh@gmail.com",
  "Rahul Shah <shahrahul39421@gmail.com>",
  "suraj.soni236456@gmail.com",
  "sohailgulbaragaa@gmail.com",
  "Surya Vamshi Kusam <suryavamshi42323@gmail.com>",
  "Shivam Deshmukh <shivamdeshmukh835@gmail.com>",
  "tharunsmile128@gmail.com",
  "Abhinaya Guragai <abhinayaguragai2005@gmail.com>",
  "prasanthpenumudi@gmail.com",
  "Cherish kv <cherishkatta@gmail.com>",
  "sskireeti9@gmail.com",
  "harshapatnaik789@gmail.com",
  "Jayash Pradhan <jayashpradhan123@gmail.com>",
  "Charan Raju <akkirajucharanraju@gmail.com>",
  "Raj Dwivedi <rajdwivedi646@gmail.com>",
  "manoharansathish2002@gmail.com",
  "gopi.sanagapalli02@gmail.com",
  "blohith8327@gmail.com",
  "Bhavanth M R <bhavanthmr@gmail.com>",
  "hemanthsg379@gmail.com",
  "Nitin Mahtolia <nitinmahtolia950@gmail.com>",
  "Sai Abhishek <saiabhishek90460@gmail.com>",
  "Puneeth Srisailam <puneethsrisailam@gmail.com>",
  "Santhosh Kumar <santhoshnm409@gmail.com>",
  "Siti Kantha Das <sitikanthadas448@gmail.com>",
  "Rajesh Talari <talarirajesh099@gmail.com>",
  "Sai Swaroop <saiswaroop1245@gmail.com>",
  "jogakshyamam@gmail.com",
  "Gullipalli Maheshbabu <gullipallimaheshbabu123@gmail.com>",
  "Mahammad Afrid <afridmohammad786000@gmail.com>",
  "tanaydeshmukh9696@gmail.com",
  "gsaisriram05@gmail.com",
  "Abhijith Manoj <abijitmanoj@gmail.com>",
  "viveknaren22@gmail.com",
  "P.kushuvardhan Yadav <pkushuvardhan16@gmail.com>",
  "sameerverma2003@gmail.com",
  "Pavan B S <bspavan27@gmail.com>",
  "Sai Jaganathanm <saijaganathanm@gmail.com>",
  "ambidisricharan30@gmail.com",
  "PREM SAI MADANI <mpremsai0@gmail.com>"
];

// Helper to parse Name <email@domain.com> format
function parseEmailString(input: string) {
  const emailRegex = /<([^>]+)>/;
  const match = input.match(emailRegex);
  
  if (match) {
    const email = match[1].trim();
    const name = input.replace(emailRegex, '').trim().replace(/^"|"$/g, '').trim();
    return { email, name: name || email.split('@')[0] };
  }
  
  // If no brackets, treat whole string as email
  const cleanEmail = input.trim();
  return { email: cleanEmail, name: cleanEmail.split('@')[0] };
}

async function seedUsers() {
  console.log(`Starting to seed ${rawUsers.length} users...`);
  const DEFAULT_PASSWORD = 'Sairam@123';
  
  for (const rawUser of rawUsers) {
    const { name, email } = parseEmailString(rawUser);
    console.log(`Processing: ${name} (${email})`);

    try {
      // 1. Create user in auth.users
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
           console.log(`  User ${email} already exists in auth. Skipping auth creation.`);
        } else {
           console.error(`  Error creating auth user ${email}:`, authError.message);
           continue;
        }
      }

      // We need the user ID to insert into profiles.
      // If user already existed, let's fetch their ID.
      let userId = authData?.user?.id;
      if (!userId) {
          // Fetch existing user by email via admin API
          // Note: listUsers is paginated, for robust usage in a huge list we'd need to search, 
          // but there's no direct get user by email in standard supabase-js admin. 
          // An alternative is trying to upsert using a DB function, but for this script, 
          // we'll assume a fresh run or we can ignore existing profiles.
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const existingUser = users.find(u => u.email === email);
          if (existingUser) {
              userId = existingUser.id;
          }
      }

      if (userId) {
        // 2. Insert into profiles table
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: userId,
          full_name: name,
          email: email,
          role: 'student',
          must_change_password: true,
        }, { onConflict: 'id' });

        if (profileError) {
          console.error(`  Error creating profile for ${email}:`, profileError.message);
        } else {
          console.log(`  Successfully seeded: ${email}`);
        }
      }

    } catch (err) {
      console.error(`  Unexpected error for ${email}:`, err);
    }
  }
  
  console.log('Seeding complete.');
}

seedUsers();
