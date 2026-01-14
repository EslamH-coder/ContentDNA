'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export function UserMenu() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    
    // Use onAuthStateChange as primary method
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 UserMenu auth event:', event, session?.user?.email || 'no user');
      
      if (mounted) {
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
        
        if (event === 'SIGNED_OUT') {
          router.push('/login');
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Force a refresh to update UI
          router.refresh();
        }
      }
    });

    // Try to get initial session (from localStorage if available)
    // If not in localStorage, check server via API (cookies)
    async function getInitialSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.log('getSession failed:', error.message);
      }
      
      // No session in localStorage - check server (cookies)
      if (mounted) {
        try {
          const response = await fetch('/api/auth/me', {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              console.log('✅ User found via server (cookies):', data.user.email);
              if (mounted) {
                setUser(data.user);
                setLoading(false);
                return;
              }
            }
          }
        } catch (e) {
          console.log('API check failed:', e.message);
        }
        
        // No user found, wait for onAuthStateChange
        if (mounted) {
          setLoading(false);
        }
      }
    }
    
    getInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSignOut = async () => {
    try {
      // Step 1: Sign out from Supabase client-side (clears localStorage)
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        console.error('Sign out error:', signOutError);
      }
      
      // Step 2: Call server-side logout API to clear cookies
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include' // Important: include cookies
        });
      } catch (apiError) {
        console.error('Logout API error:', apiError);
        // Continue anyway - cookies might still be cleared by redirect
      }
      
      // Step 3: Clear any remaining client-side session data
      setUser(null);
      setShowDropdown(false);
      
      // Step 4: Force a hard redirect to clear all caches
      // Using window.location.href ensures full page reload and clears cookies
      window.location.href = '/login';
    } catch (error) {
      console.error('Sign out error:', error);
      // Still redirect even if sign out fails
      window.location.href = '/login';
    }
  };

  if (loading) {
    return <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />;
  }

  if (!user) {
    return (
      <a 
        href="/login"
        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Sign In
      </a>
    );
  }

  const userInitial = user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="User menu"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-medium">
            {userInitial}
          </span>
        </div>
        <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:block truncate max-w-[200px]">
          {user.email}
        </span>
        <span className="text-gray-400 text-xs hidden sm:block">▼</span>
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)} 
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-20">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Signed in
              </p>
            </div>
            
            <div className="p-2">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <span>🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


