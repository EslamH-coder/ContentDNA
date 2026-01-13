import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function getAuthUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return { user: null, error: 'Supabase not configured' };
  }
  
  // Get cookies to pass to Supabase client
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  
  // Create a custom storage adapter that reads from Next.js cookies
  const cookieStorage = {
    getItem: (key) => {
      const cookie = allCookies.find(c => c.name === key);
      return cookie?.value || null;
    },
    setItem: () => {
      // Cookies are set by client-side, not here
    },
    removeItem: () => {
      // Cookies are removed by client-side
    },
  };
  
  // Create Supabase client with cookie storage
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: cookieStorage,
      autoRefreshToken: false, // Don't refresh on server
      persistSession: false, // Don't persist on server
    },
  });
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { user: null, error: 'Unauthorized' };
  }
  
  return { user, error: null };
}

export async function requireAuth() {
  const { user, error } = await getAuthUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}

