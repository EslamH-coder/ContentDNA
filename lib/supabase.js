import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Check if Supabase is properly configured
export const isSupabaseConfigured = 
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-key'

if (!isSupabaseConfigured) {
  console.warn('Supabase environment variables are not set. Dashboard will use mock data. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
}

// Create client with placeholder values if not configured (will fail gracefully in queries)
// This is the PUBLIC client for browser use (uses anon key, respects RLS)
// Enable auth persistence and auto-refresh for proper session handling
// Use storage: 'localStorage' explicitly to ensure session persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-auth-token'
  }
})

// Server-side client with service_role key (bypasses RLS, for API routes only)
// NEVER use this in browser/client code!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// Only warn about service_role key on server-side (not in browser)
if (typeof window === 'undefined' && !supabaseServiceRoleKey && isSupabaseConfigured) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not set. API routes may fail due to RLS policies.')
}

