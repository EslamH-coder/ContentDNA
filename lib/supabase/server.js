import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Create a Supabase client for server components
 * This properly handles cookies for authentication
 */
export function createClient(cookieStore) {
  const cookieStoreInstance = cookieStore || cookies();
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name) {
          return cookieStoreInstance.get(name)?.value;
        },
        set(name, value, options) {
          try {
            cookieStoreInstance.set({ name, value, ...options });
          } catch (error) {
            // Ignore - can't set cookies in some contexts
          }
        },
        remove(name, options) {
          try {
            cookieStoreInstance.set({ name, value: '', ...options });
          } catch (error) {
            // Ignore
          }
        },
      },
    }
  );
}
