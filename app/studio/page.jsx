'use client';

import { useState, useEffect } from 'react';
import StudioCard from '@/components/studio/StudioCard';
import TierSection from '@/components/studio/TierSection';

export default function StudioPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedShow, setSelectedShow] = useState(null);
  const [shows, setShows] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh counter

  // Fetch user's shows
  useEffect(() => {
    async function fetchShows() {
      try {
        const res = await fetch('/api/shows');
        const result = await res.json();
        if (result.shows && result.shows.length > 0) {
          setShows(result.shows);
          setSelectedShow(result.shows[0].id);
        } else if (result.show) {
          // Single show returned
          setShows([result.show]);
          setSelectedShow(result.show.id);
        }
      } catch (err) {
        console.error('Error fetching shows:', err);
      }
    }
    fetchShows();
  }, []);

  // Fetch signals when show changes or refresh is triggered
  useEffect(() => {
    if (!selectedShow) return;

    async function fetchSignals() {
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔄 Fetching signals for show:', selectedShow);
        const res = await fetch(`/api/studio/signals?showId=${selectedShow}&_t=${Date.now()}`); // Add timestamp to prevent caching
        
        // Check if response is ok before parsing JSON
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
        }
        
        // Check if response has content
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Expected JSON but got: ${contentType}. Response: ${text.substring(0, 200)}`);
        }
        
        const result = await res.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch signals');
        }
        
        // Handle both camelCase and snake_case tier names for compatibility
        const data = result.data || {};
        const normalizedData = {
          postToday: data.postToday || data.post_today || [],
          thisWeek: data.thisWeek || data.this_week || [],
          evergreen: data.evergreen || []
        };
        
        setData(normalizedData);
        console.log('📊 Studio data loaded:', {
          postToday: normalizedData.postToday.length,
          thisWeek: normalizedData.thisWeek.length,
          evergreen: normalizedData.evergreen.length,
          meta: result.meta
        });
      } catch (err) {
        console.error('❌ Error:', err);
        setError(err.message || 'Failed to load signals');
      } finally {
        setLoading(false);
      }
    }
    
    fetchSignals();
  }, [selectedShow, refreshKey]); // Add refreshKey to dependencies

  const handleRefresh = () => {
    if (selectedShow) {
      console.log('🔄 Refresh button clicked');
      setRefreshKey(prev => prev + 1); // Increment refresh counter to trigger re-fetch
    }
  };

  const handleAction = async (signalId, action) => {
    console.log(`Action: ${action} on signal ${signalId}`);
    // TODO: Implement actions (like, reject, save, script)
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">🎬 Studio</h1>
            
            {/* Show Selector */}
            {shows.length > 0 && (
              <select
                value={selectedShow || ''}
                onChange={(e) => setSelectedShow(e.target.value)}
                className="border rounded-lg px-3 py-2 bg-white"
              >
                {shows.map(show => (
                  <option key={show.id} value={show.id}>
                    {show.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto">
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin text-4xl">⏳</div>
            <p className="mt-4 text-gray-500">Loading signals...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            ❌ Error: {error}
          </div>
        )}

        {data && !loading && (
          <div className="space-y-8">
            {/* Post Today */}
            <TierSection
              title="🔥 Post Today"
              subtitle="High momentum - act now!"
              signals={data.postToday || data.post_today || []}
              tierColor="red"
              onAction={handleAction}
            />

            {/* This Week */}
            <TierSection
              title="📅 This Week"
              subtitle="Good opportunities to plan"
              signals={data.thisWeek || data.this_week || []}
              tierColor="yellow"
              onAction={handleAction}
            />

            {/* Evergreen */}
            <TierSection
              title="🌲 Evergreen"
              subtitle="Timeless content ideas"
              signals={data.evergreen || []}
              tierColor="green"
              onAction={handleAction}
            />
          </div>
        )}
      </div>
    </div>
  );
}
