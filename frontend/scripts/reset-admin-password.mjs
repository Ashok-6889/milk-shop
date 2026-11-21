import { createClient } from '@supabase/supabase-js';
import readline from 'node:readline/promises';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const secretKey = await rl.question('Enter Supabase Secret key: ');
const email = await rl.question('Enter admin email: ');
const password = await rl.question('Enter new password: ');

const supabase = createClient(
  'https://ezhgvmrxrcefkcgzrsep.supabase.co',
  secretKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

try {
  const { data: users, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) throw listError;

  const user = users.users.find(
    u => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!user) throw new Error('Admin user not found');

  const { error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password }
  );

  if (error) throw error;

  console.log('Password updated successfully.');
} catch (error) {
  console.error('Reset failed:', error.message);
} finally {
  rl.close();
}
