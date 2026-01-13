'use client';

import { useState, useEffect } from 'react';
import { Save, User } from 'lucide-react';

export default function StudioSettingsPage() {
  const [profile, setProfile] = useState({
    name: '',
    description: '',
    target_audience: '',
    language: 'ar',
  });
  const [saving, setSaving] = useState(false);
  const [showId, setShowId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      // Get show from API (uses cookies for auth)
      const response = await fetch('/api/shows/current', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        console.error('Failed to get show:', response.status);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      if (data.show) {
        setShowId(data.show.id);
        setProfile({
          name: data.show.name || '',
          description: data.show.description || '',
          target_audience: data.show.target_audience || '',
          language: data.show.language || 'ar',
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!showId) {
      alert('No show ID found. Please refresh the page.');
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch(`/api/shows/${showId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profile),
      });
      
      const data = await response.json();
      if (data.success) {
        alert('✅ Profile saved!');
      } else {
        alert('❌ Failed to save: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('❌ Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-gray-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          ⚙️ Settings
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure your channel profile
        </p>
      </div>

      {/* Channel Profile */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Channel Profile
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          This information helps us generate better content ideas and pitches for your channel.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Channel Name
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Your channel name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              What does your channel cover?
            </label>
            <textarea
              value={profile.description}
              onChange={(e) => setProfile({ ...profile, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              rows={2}
              placeholder="e.g., Economics, geopolitics, and global finance analysis"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Who is your target audience?
            </label>
            <input
              type="text"
              value={profile.target_audience}
              onChange={(e) => setProfile({ ...profile, target_audience: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="e.g., Arabic-speaking viewers interested in global economics"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Primary Language
            </label>
            <select
              value={profile.language}
              onChange={(e) => setProfile({ ...profile, language: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="ar">Arabic (العربية)</option>
              <option value="en">English</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Help */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
        <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
          Need help?
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Contact support at support@contentradar.app or use the feedback button in the header.
        </p>
      </div>
    </div>
  );
}
