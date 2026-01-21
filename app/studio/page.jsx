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
  const [activeTab, setActiveTab] = useState('signals'); // 'signals' or 'pitches'
  const [pitches, setPitches] = useState([]);
  const [loadingPitches, setLoadingPitches] = useState(false);

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

  // Fetch pitches when show changes or when pitches tab is active
  useEffect(() => {
    if (!selectedShow || activeTab !== 'pitches') return;

    async function fetchPitches() {
      setLoadingPitches(true);
      try {
        const res = await fetch(`/api/pitches?showId=${selectedShow}`);
        const result = await res.json();
        
        if (result.success) {
          setPitches(result.pitches || []);
          console.log('📝 Loaded pitches:', result.pitches?.length || 0);
        } else {
          console.error('Failed to fetch pitches:', result.error);
          setPitches([]);
        }
      } catch (err) {
        console.error('❌ Error fetching pitches:', err);
        setPitches([]);
      } finally {
        setLoadingPitches(false);
      }
    }
    
    fetchPitches();
  }, [selectedShow, activeTab]);

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

        {/* Tabs */}
        <div className="flex gap-2 mt-4 border-b">
          <button
            onClick={() => setActiveTab('signals')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'signals'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 Signals
          </button>
          <button
            onClick={() => setActiveTab('pitches')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'pitches'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📝 Pitches ({pitches.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto">
        {/* Signals Tab */}
        {activeTab === 'signals' && (
          <>
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
          </>
        )}

        {/* Pitches Tab */}
        {activeTab === 'pitches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Saved Pitches</h3>
                <p className="text-sm text-gray-500">AI-generated pitches you've saved</p>
              </div>
              <span className="text-sm text-gray-500">{pitches.length} saved</span>
            </div>
            
            {loadingPitches ? (
              <div className="text-center py-12">
                <div className="animate-spin text-4xl">⏳</div>
                <p className="mt-4 text-gray-500">Loading pitches...</p>
              </div>
            ) : pitches.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <span className="text-4xl mb-2 block">📝</span>
                <p>No saved pitches yet</p>
                <p className="text-sm">Generate and save pitches from signals</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pitches.map(pitch => (
                  <SavedPitchCard
                    key={pitch.id}
                    pitch={pitch}
                    showId={selectedShow}
                    onProduced={async (pitchId, signalId) => {
                      // Mark pitch as produced and update signal status
                      if (signalId) {
                        try {
                          const res = await fetch('/api/feedback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              show_id: selectedShow,
                              recommendation_id: signalId,
                              topic: pitch.video_title || pitch.source_title || 'Pitch',
                              action: 'produced',
                              original_score: 0,
                              evidence_summary: {
                                source: 'pitch',
                                pitch_id: pitchId
                              }
                            })
                          });
                          const data = await res.json();
                          if (data.success) {
                            // Refresh pitches
                            const pitchesRes = await fetch(`/api/pitches?showId=${selectedShow}`);
                            const pitchesData = await pitchesRes.json();
                            if (pitchesData.success) {
                              setPitches(pitchesData.pitches || []);
                            }
                          }
                        } catch (error) {
                          console.error('Error marking as produced:', error);
                        }
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Saved Pitch Card Component
function SavedPitchCard({ pitch, showId, onProduced }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [producing, setProducing] = useState(false);

  const copyPitch = async () => {
    const pitchText = pitch.content || pitch.pitch_content;
    if (pitchText) {
      await navigator.clipboard.writeText(pitchText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleProduced = async () => {
    if (!onProduced) return;
    
    setProducing(true);
    try {
      await onProduced(pitch.id, pitch.signal_id);
    } catch (error) {
      console.error('Error marking as produced:', error);
    } finally {
      setProducing(false);
    }
  };

  return (
    <div className="bg-white border rounded-xl p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 mb-2" dir="auto">
            {pitch.video_title || pitch.source_title || 'Untitled Pitch'}
          </h4>
          
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
            <span>Type: {pitch.pitch_type || 'news'}</span>
            <span>•</span>
            <span>{new Date(pitch.created_at || pitch.updated_at).toLocaleDateString()}</span>
          </div>

          {/* Show snippet when collapsed, full content when expanded */}
          {!expanded ? (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3" dir="auto">
                {pitch.content || pitch.pitch_content || 'No content'}
              </p>
            </div>
          ) : (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap" dir="auto">
                {pitch.content || pitch.pitch_content || 'No content'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium"
        >
          {expanded ? '▲ Hide' : '▼ Show Full Pitch'}
        </button>
        <button
          onClick={copyPitch}
          className="px-3 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium"
        >
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
        {pitch.signal_id && onProduced && (
          <button
            onClick={handleProduced}
            disabled={producing}
            className="px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {producing ? '⏳' : '🎬'} {producing ? 'Marking...' : 'Mark as Produced'}
          </button>
        )}
      </div>
    </div>
  );
}
