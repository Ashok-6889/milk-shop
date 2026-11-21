import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const adminSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'milk-shop-admin-auth-token',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const customerSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'milk-shop-customer-auth-token',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Compatibility for old backup files; active pages use separate clients.
export const supabase = customerSupabase
