import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import Link from 'next/link';

export default async function StudioLayout({ children }) {
  // Must call cookies() first and pass to createClient
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  
  // Use getSession instead of getUser for server components
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  // Debug log
  console.log('🔐 Studio auth check:', user?.email || 'NO USER');

  // If not authenticated, show sign-in page
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <span className="text-6xl mb-6 block">🎬</span>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            ContentRadar Studio
          </h1>
          <p className="text-gray-500 mb-8">
            Never run out of video ideas.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
          >
            Sign In to Continue
          </Link>
        </div>
      </div>
    );
  }

  // Get user's show name
  let showName = 'Your Channel';
  try {
    const { data: userShow } = await supabase
      .from('user_shows')
      .select('shows(name)')
      .eq('user_id', user.id)
      .single();
    
    showName = userShow?.shows?.name || 'Your Channel';
  } catch (e) {
    console.log('Could not fetch show name');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/studio" className="flex items-center gap-2">
              <span className="text-2xl">🎬</span>
              <span className="font-bold text-lg text-gray-900 dark:text-white">ContentRadar</span>
            </Link>
            <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
              Beta
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1">
              <NavLink href="/studio" label="💡 Ideas" />
              <NavLink href="/studio/competitors" label="📊 Competitors" />
              <NavLink href="/studio/settings" label="⚙️ Settings" />
            </nav>
            
            {/* User avatar */}
            <div className="flex items-center gap-2 pl-4 border-l border-gray-200 dark:border-gray-700">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-300 font-medium text-sm">
                {user.email?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block max-w-[150px] truncate">
                {showName}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, label }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
    >
      {label}
    </Link>
  );
}
