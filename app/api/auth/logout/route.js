import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * POST /api/auth/logout
 * Clears server-side authentication cookies
 */
export async function POST(request) {
  try {
    const cookieStore = cookies();
    
    // Create a Supabase server client to properly sign out
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Supabase not configured');
      return NextResponse.json(
        { success: false, error: 'Server not configured' },
        { status: 500 }
      );
    }
    
    // Create server client to properly clear cookies
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (e) {
              // Ignore errors (e.g., in middleware)
            }
          },
          remove(name, options) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (e) {
              // Ignore errors
            }
          },
        },
      }
    );
    
    // Sign out from Supabase (this clears cookies properly)
    await supabase.auth.signOut();
    
    // Create response
    const response = NextResponse.json({ 
      success: true,
      message: 'Signed out successfully'
    });
    
    // Manually clear all Supabase-related cookies from response
    const allCookies = cookieStore.getAll();
    allCookies.forEach(({ name }) => {
      if (name.includes('sb-') || name.includes('auth') || name.includes('supabase')) {
        // Clear via response headers
        response.cookies.set(name, '', {
          expires: new Date(0),
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production'
        });
      }
    });
    
    console.log('✅ User signed out - cookies cleared');
    
    return response;
  } catch (error) {
    console.error('❌ Logout error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
