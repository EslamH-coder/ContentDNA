import { supabase } from './supabase';

/**
 * Make an authenticated API request
 * Automatically includes the session token in the request
 */
export async function authenticatedFetch(url, options = {}) {
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession();
  
  // Add Authorization header if we have a session
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  };
  
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}


