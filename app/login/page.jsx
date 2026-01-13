'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get redirect URL from query params, default to /ideas (not /)
  // If redirect is / or root, use /ideas instead to avoid redirect loops
  const redirectParam = searchParams.get('redirect');
  const redirectTo = (redirectParam && redirectParam !== '/' && redirectParam !== '') 
    ? redirectParam 
    : '/ideas';

  // Use createBrowserClient from @supabase/ssr for proper cookie handling
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    console.log('🔐 Login form submitted', { email, mode });

    try {
      if (mode === 'login') {
        console.log('🔐 Attempting to sign in...');
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          console.error('❌ Login error:', error);
          console.error('Error details:', {
            message: error.message,
            status: error.status,
            name: error.name
          });
          throw error;
        }
        
        console.log('✅ Login successful!', { 
          user: data?.user?.email, 
          hasSession: !!data?.session 
        });
        
        if (data?.session) {
          console.log('✅ Session confirmed, redirecting to:', redirectTo);
          
          // Wait a moment for cookies to be set by @supabase/ssr
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Use window.location for full page reload to ensure cookies are sent
          window.location.href = redirectTo;
          return; // Stop execution - we're redirecting
        } else {
          setError('Login succeeded but no session created. Please try again.');
        }
      } else {
        // Signup
        console.log('🔐 Attempting to sign up...');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        
        if (error) {
          console.error('❌ Signup error:', error);
          throw error;
        }
        
        // Check if email confirmation is required
        if (data?.user && !data?.session) {
          console.log('✅ Signup successful, email confirmation required');
          setError('Check your email for the confirmation link!');
        } else if (data?.session) {
          // Auto-confirmed, redirect
          console.log('✅ Signup successful, auto-confirmed, redirecting to:', redirectTo);
          
          // Wait a moment for cookies to be set by @supabase/ssr
          await new Promise(resolve => setTimeout(resolve, 500));
          
          window.location.href = redirectTo;
          return;
        } else {
          setError('Signup succeeded but no user created. Please try again.');
        }
      }
    } catch (err) {
      console.error('❌ Auth error:', err);
      const errorMessage = err.message || err.error_description || err.toString() || 'An error occurred. Please try again.';
      setError(errorMessage);
      setLoading(false);
      // Make sure error is visible
      setTimeout(() => {
        const errorElement = document.querySelector('[class*="bg-red-50"]');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="max-w-md w-full p-8 bg-white dark:bg-gray-900 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className={`p-3 rounded-lg text-sm ${
              error.includes('Check your email') 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center text-sm text-gray-500">
              Processing...
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium transition-colors ${
              loading 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                <span>Processing...</span>
              </span>
            ) : (
              mode === 'login' ? 'Sign In' : 'Sign Up'
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-sm text-blue-600 hover:underline"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}

