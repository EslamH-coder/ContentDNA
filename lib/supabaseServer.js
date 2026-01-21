import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Get the authenticated user from cookies
 * Returns { user, error, supabase } where supabase is the client instance
 */
export async function getAuthUser(request = null) {
  try {
    // Method 1: If we have a request, try Authorization header first (most reliable, doesn't need cookies)
    if (request) {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();
        console.log('🔐 getAuthUser - Found Authorization header, token length:', token.length);
        
        if (token && token.length > 10) {
          // Create a simple supabase client for token validation (no cookies needed)
          const supabaseForAuth = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          );
          
          const result = await supabaseForAuth.auth.getUser(token);
          const user = result.data?.user;
          const error = result.error;
          
          if (user) {
            console.log('✅ getAuthUser - User authenticated via Authorization header:', user.email);
            // Return a cookie-based client for the rest of the request
            // Only call cookies() if we successfully authenticated via header
            try {
              const cookieStore = cookies();
            const supabase = createServerClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
              {
                cookies: {
                  get(name) {
                    return cookieStore.get(name)?.value;
                  },
                  set(name, value, options) {
                    try {
                      cookieStore.set({ name, value, ...options });
                    } catch (e) {
                      // Ignore
                    }
                  },
                  remove(name, options) {
                    try {
                      cookieStore.set({ name, value: '', ...options });
                    } catch (e) {
                      // Ignore
                    }
                  },
                },
              }
            );
            return { user, error: null, supabase };
            } catch (cookieError) {
              console.error('🍪 Error getting cookies after auth:', cookieError);
              // If cookies() fails, still return the user with the simple client
              return { user, error: null, supabase: supabaseForAuth };
            }
          } else {
            console.log('❌ getAuthUser - Token validation failed:', error?.message || 'Unknown error');
          }
        }
      }
    }
    
    // Method 2: Fallback to cookies (only if no Authorization header)
    console.log('🍪 getAuthUser - Using cookies fallback...');
    const cookieStore = cookies();
    console.log('🍪 getAuthUser - cookies() completed');
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) {
            const cookie = cookieStore.get(name);
            console.log(`🍪 Getting cookie "${name}":`, cookie?.value ? 'found' : 'not found');
            return cookie?.value;
          },
          set(name, value, options) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (e) {
              // Ignore - can't set cookies in server components
            }
          },
          remove(name, options) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (e) {
              // Ignore
            }
          },
        },
      }
    );

    // Method 2: Use getUser (secure, validates with Supabase Auth server)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (user) {
      console.log('🔐 getAuthUser - User found:', user.email);
      return { user, supabase, error: null };
    }

    // No fallback to getSession() - it's insecure
    // If getUser() fails, return the error
    if (userError) {
      console.log('🔐 getAuthUser - getUser() failed:', userError.message);
    } else {
      console.log('🔐 getAuthUser - No user found');
    }
    
    return { user: null, supabase, error: userError || new Error('No authenticated user') };
    
  } catch (error) {
    console.error('🔐 getAuthUser - Error:', error);
    return { user: null, supabase: null, error };
  }
}

/**
 * Helper to create supabase client without auth check
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (e) {
            // Ignore - can't set cookies in server components
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (e) {
            // Ignore
          }
        },
      },
    }
  );
}

/**
 * Alternative: Get user from Authorization header (for API tokens)
 * This can be used as a fallback if cookie-based auth doesn't work
 */
export async function getAuthUserFromHeader(request) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'No authorization header' };
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createServerSupabaseClient();
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    return { user, error, supabase };
  } catch (error) {
    return { user: null, error: error.message, supabase: null };
  }
}
