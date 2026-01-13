'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { UserMenu } from './UserMenu';

export default function Navigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentShowId = searchParams.get('showId');
  
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchShows();
  }, []);

  useEffect(() => {
    if (currentShowId && shows.length > 0) {
      const show = shows.find(s => s.id === currentShowId);
      setSelectedShow(show);
    } else if (shows.length > 0 && !selectedShow) {
      const readyShow = shows.find(s => s.onboarding_status === 'ready');
      if (readyShow) setSelectedShow(readyShow);
    }
  }, [currentShowId, shows]);

  const fetchShows = async () => {
    try {
      // Get session token to include in request
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // Include session token if available
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const res = await fetch('/api/shows', {
        headers,
      });
      
      const data = await res.json();
      if (data.shows) {
        setShows(data.shows);
      } else if (data.error) {
        console.error('Error fetching shows:', data.error);
      }
    } catch (error) {
      console.error('Error fetching shows:', error);
    }
  };

  const navItems = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/ideas', label: 'Ideas', icon: '💡' },
    { href: '/dna', label: 'DNA', icon: '🧬' },
    { href: '/intelligence', label: 'Intelligence', icon: '📊' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  const buildUrl = (href) => {
    const showId = selectedShow?.id || currentShowId;
    if (href === '/') return showId ? `/?showId=${showId}` : '/';
    return showId ? `${href}?showId=${showId}` : href;
  };

  const handleShowChange = (show) => {
    setSelectedShow(show);
    setShowDropdown(false);
    const newUrl = `${pathname}?showId=${show.id}`;
    window.location.href = newUrl;
  };

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href={buildUrl('/')} className="flex items-center gap-2">
            <span className="text-2xl">🎬</span>
            <span className="font-bold text-xl text-gray-900">ContentDNA</span>
          </Link>

          {/* Center Nav */}
          <div className="flex items-center gap-1">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={buildUrl(item.href)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                  ${isActive(item.href)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Right side: Show Selector and User Menu */}
          <div className="flex items-center gap-4">
            {/* Show Selector */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all max-w-[200px]"
              >
                <span className="truncate font-medium text-gray-700">
                  {selectedShow?.name || 'Select Show'}
                </span>
                <span className="text-gray-400 flex-shrink-0">▼</span>
              </button>

            {showDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowDropdown(false)} 
                />
                <div className="absolute top-full mt-2 right-0 w-72 bg-white rounded-xl shadow-lg border py-2 z-50">
                  <div className="px-4 py-2 border-b">
                    <p className="text-xs font-medium text-gray-500 uppercase">Your Shows</p>
                  </div>
                  
                  {shows.filter(s => s.onboarding_status === 'ready').length === 0 ? (
                    <div className="px-4 py-6 text-center text-gray-500">
                      <p className="text-sm">No shows ready</p>
                    </div>
                  ) : (
                    shows
                      .filter(s => s.onboarding_status === 'ready')
                      .map(show => (
                        <button
                          key={show.id}
                          onClick={() => handleShowChange(show)}
                          className={`
                            w-full text-left px-4 py-3 hover:bg-gray-50 
                            flex items-center justify-between
                            ${selectedShow?.id === show.id ? 'bg-blue-50' : ''}
                          `}
                        >
                          <div>
                            <p className="font-medium text-gray-900">{show.name}</p>
                            <p className="text-xs text-gray-500">
                              {show.total_videos_imported || 0} videos
                            </p>
                          </div>
                          {selectedShow?.id === show.id && (
                            <span className="text-blue-600">✓</span>
                          )}
                        </button>
                      ))
                  )}
                  
                  <div className="border-t mt-2 pt-2 px-2">
                    <Link
                      href="/onboarding"
                      onClick={() => setShowDropdown(false)}
                      className="block px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium"
                    >
                      + Add New Show
                    </Link>
                  </div>
                </div>
              </>
            )}
            </div>
            
            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}
