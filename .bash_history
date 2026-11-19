ll
yum install git 
git status
git --version
git status
git init
git remote add origin https://github.com/Ashok-6889/milk-shop.git
git branch -M main
git push -u origin main
git remote add origin https://github.com/Ashok-6889/milk-shop.git
https://github.com/Ashok-6889/milk-shop.git
git clone https://github.com/Ashok-6889/milk-shop.git
ll
git branch -M main
git push -u origin main
git pull origin main --allow-unrelated-histories
git push -u origin main
git credential reject <<EOF
protocol=https
host=github.com
username=Ashok-6889
EOF

git remote -v
git push -u origin main
git credential reject <<EOF
protocol=https
host=github.com
username=Ashok-6889
EOF

git push -u origin main
cd /root/milk-shop/frontend
nano src/app/page.tsx
vi  src/app/page.tsx
cd /root/milk-shop/frontend
npm run dev -- --hostname 0.0.0.0
kill 40993kill 40993
kill 40993
cd /root/milk-shop/frontend
cat next.config.ts
cd /root/milk-shop/frontend
cat > next.config.ts <<'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["54.224.165.98"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
EOF

npm run dev -- --hostname 0.0.0.0
cd /root/milk-shop/frontend
npm install @supabase/supabase-js
cd /root/milk-shop/frontend
mkdir -p scripts
cat > scripts/reset-admin-password.mjs <<'EOF'
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
EOF

node scripts/reset-admin-password.mjs
cd /root/milk-shop/frontend
nano src/app/page.tsx
vi src/app/page.tsx
cd /root/milk-shop/frontend
grep -n -A18 -B5 "Admin access only\|Profile error\|Role mismatch" src/app/page.tsx
cd /root/milk-shop/frontend
sed -n '1,190p' src/app/page.tsx
cd /root/milk-shop/frontend
vi src/app/page.tsx
cd src/app/
ll
rm -rf page.tsx 
ll
vim page.tsx
npm run build
ll
rm -rf page.tsx 
vim page.tsx
cd /root/milk-shop/frontend
npm run build
cd /root/milk-shop/frontend
vi src/app/page.tsx
grep -n "localDate" src/app/page.tsx
grep -n -B 5 -A 8 "localDate" src/app/page.tsx
cat src/app/page.tsx
cat src/app/dashboard/page.tsx
cd /root/milk-shop/frontend
cp src/app/page.tsx /tmp/milk-dashboard-backup.tsx
cp src/app/page.tsx src/app/dashboard/page.tsx
cd /root/milk-shop/frontend
cp src/app/page.tsx /tmp/milk-dashboard-backup.tsx
cp src/app/page.tsx src/app/dashboard/page.tsx
p = Path("src/app/dashboard/page.tsx")
s = p.read_text()
s = s.replace(
    "const [date, setDate] = useState(localDate())",
    "const [date, setDate] = useState('')"
)
s = s.replace(
    "  const loadDashboard = useCallback(async () => {\n    setLoading(true)",
)
s = s.replace(
    "  useEffect(() => {\n    loadDashboard()\n  }, [loadDashboard])",
    """  useEffect(() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setDate(`${year}-${month}-${day}`)
  }, [])

  useEffect(() => {
    if (date) loadDashboard()
  }, [date, loadDashboard])"""
)
p.write_text(s)
print("Dashboard date fix applied.")
cd /root/milk-shop/frontend
cp -f src/app/page.tsx /tmp/milk-dashboard-backup.tsx
cp -f src/app/page.tsx src/app/dashboard/page.tsx
python3 - <<'PY'
from pathlib import Path

p = Path("src/app/dashboard/page.tsx")
s = p.read_text()

s = s.replace(
    "const [date, setDate] = useState(localDate())",
    "const [date, setDate] = useState('')"
)

s = s.replace(
    "  const loadDashboard = useCallback(async () => {\n    setLoading(true)",
    "  const loadDashboard = useCallback(async () => {\n    if (!date) return\n    setLoading(true)"
)

s = s.replace(
    "  useEffect(() => {\n    loadDashboard()\n  }, [loadDashboard])",
    """  useEffect(() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setDate(`${year}-${month}-${day}`)
  }, [])

  useEffect(() => {
    if (date) loadDashboard()
  }, [date, loadDashboard])"""
)

p.write_text(s)
print("Dashboard date fix applied successfully.")
PY

vi src/app/page.tsx
cat  src/app/page.tsx
cd /root/milk-shop/frontend
cat > src/app/page.tsx <<'EOF'
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        })

      if (loginError) throw loginError
      if (!data.user) throw new Error('Login failed')

      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

      if (profileError) throw profileError

      if (profile?.role !== 'admin') {
        await supabase.auth.signOut()
        throw new Error('Admin access only')
      }

      router.push('/dashboard')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to login'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-7 text-center">
          <h1 className="text-3xl font-bold text-green-800">
            Smart Milk Shop
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Admin Login
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter admin email"
              className="w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-800 py-3 font-semibold text-white hover:bg-green-900 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </main>
  )
}
EOF

head -10 src/app/page.tsx
cd /root/milk-shop/frontend
tail -15 src/app/page.tsx
grep -nE "useState|date.*return|setDate|new Date" src/app/dashboard/page.tsx
npm run build
cd /root/milk-shop/frontend
npm run start -- --hostname 0.0.0.0
