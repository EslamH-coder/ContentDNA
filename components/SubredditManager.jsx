'use client';

import { useState, useEffect } from 'react';

export function SubredditManager({ showId }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newSubreddit, setNewSubreddit] = useState('');
  const [newCategory, setNewCategory] = useState('general');

  const categories = [
    'economics', 'finance', 'geopolitics', 'technology', 
    'business', 'news', 'regional', 'general'
  ];

  useEffect(() => {
    if (showId) fetchSources();
  }, [showId]);

  const getAuthHeaders = async () => {
    const { supabase } = await import('@/lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    return headers;
  };

  const fetchSources = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/reddit-sources?showId=${showId}`, {
        headers
      });
      const data = await response.json();
      if (data.success) {
        setSources(data.sources || []);
      } else {
        console.error('Failed to fetch sources:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSubreddit = async () => {
    if (!newSubreddit.trim()) return;
    
    setAdding(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/reddit-sources', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          showId,
          subreddit: newSubreddit,
          category: newCategory,
        }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        alert(data.error);
      } else if (data.success) {
        setSources([data.source, ...sources]);
        setNewSubreddit('');
      }
    } catch (error) {
      alert('Failed to add subreddit: ' + error.message);
    } finally {
      setAdding(false);
    }
  };

  const removeSubreddit = async (id) => {
    if (!confirm('Remove this subreddit?')) return;
    
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/reddit-sources?id=${id}`, { 
        method: 'DELETE',
        headers
      });
      setSources(sources.filter(s => s.id !== id));
    } catch (error) {
      alert('Failed to remove subreddit: ' + error.message);
    }
  };

  const toggleActive = async (source) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/reddit-sources', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: source.id, isActive: !source.is_active }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSources(sources.map(s => 
          s.id === source.id ? { ...s, is_active: !s.is_active } : s
        ));
      } else {
        alert(data.error || 'Failed to update subreddit');
      }
    } catch (error) {
      alert('Failed to update subreddit: ' + error.message);
    }
  };

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading subreddits...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 dark:text-white">
          Reddit Sources
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {sources.filter(s => s.is_active).length} active
        </span>
      </div>

      {/* Add new subreddit */}
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={newSubreddit}
            onChange={(e) => setNewSubreddit(e.target.value)}
            placeholder="Enter subreddit name (e.g., economics)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            onKeyDown={(e) => e.key === 'Enter' && addSubreddit()}
          />
        </div>
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <button
          onClick={addSubreddit}
          disabled={adding || !newSubreddit.trim()}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
        >
          <span>➕</span>
          {adding ? 'Adding...' : 'Add'}
        </button>
      </div>

      {/* List of subreddits */}
      <div className="space-y-2">
        {sources.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">
            No subreddits added yet. Add some to fetch evergreen content ideas.
          </p>
        ) : (
          sources.map(source => (
            <div
              key={source.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                source.is_active 
                  ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' 
                  : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-orange-500">🔴</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    r/{source.subreddit}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {source.category} • min {source.min_score} upvotes • {source.min_comments} comments
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(source)}
                  className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all ${
                    source.is_active ? 'text-green-500' : 'text-gray-400'
                  }`}
                  title={source.is_active ? 'Disable' : 'Enable'}
                >
                  {source.is_active ? (
                    <span className="text-lg">✓</span>
                  ) : (
                    <span className="text-lg">○</span>
                  )}
                </button>
                <button
                  onClick={() => removeSubreddit(source.id)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"
                  title="Remove"
                >
                  <span>🗑️</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Suggestions based on common topics */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          💡 Popular subreddits by category:
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
            Economics: r/economics, r/finance
          </span>
          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
            Geopolitics: r/geopolitics, r/worldnews
          </span>
          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
            Tech: r/technology, r/artificial
          </span>
          <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
            Regional: r/saudiarabia, r/dubai, r/arabs
          </span>
        </div>
      </div>
    </div>
  );
}


