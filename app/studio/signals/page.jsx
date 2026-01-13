'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Import SignalCard from Ideas page (inline component)
// We'll copy the relevant parts here
function SignalCard({ signal, showId }) {
  const [expanded, setExpanded] = useState(false);
  const [localSignal, setLocalSignal] = useState(signal);

  useEffect(() => {
    setLocalSignal(signal);
  }, [signal]);

  const formatViews = (views) => {
    if (!views) return '0';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${Math.round(views / 1000)}K`;
    return views.toString();
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-500';
    return 'text-gray-500';
  };

  const scoreNum = localSignal.relevance_score || localSignal.score || 0;

  return (
    <div className="bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all">
      {/* Header Row */}
      <div className="p-4">
        <div className="flex gap-4">
          {/* Left: Icon */}
          <div className="flex-shrink-0">
            <span className="text-3xl">🔔</span>
          </div>

          {/* Middle: Content */}
          <div className="flex-1 min-w-0">
            {/* Title - Clickable */}
            <div className="flex items-start gap-2 mb-1">
              <a 
                href={localSignal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-gray-900 hover:text-blue-600 hover:underline line-clamp-2 flex-1"
                dir="auto"
              >
                {localSignal.title}
              </a>
              {localSignal.status === 'new' && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full flex-shrink-0">
                  NEW
                </span>
              )}
              {/* Competitor breakout indicator */}
              {localSignal.competitor_boost >= 10 && (
                <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full flex items-center gap-1 flex-shrink-0">
                  🔥 Trending
                </span>
              )}
            </div>

            {/* Meta Row */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-500">{localSignal.source || 'News'}</span>
              <span className="text-gray-300">•</span>
              <span className="text-gray-400">
                {new Date(localSignal.created_at || localSignal.detected_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </span>
            </div>

            {/* Score Row */}
            <div className="flex items-center gap-6 mt-3">
              <div>
                <span className="text-sm text-gray-500">Score: </span>
                <span className={`text-xl font-bold ${getScoreColor(scoreNum)}`}>
                  {typeof scoreNum === 'number' ? scoreNum.toFixed(1) : scoreNum}
                </span>
              </div>
              
              {/* Competitor Boost Score */}
              {localSignal.competitor_boost > 0 && (
                <div>
                  <span className="text-sm text-gray-500">Competitor: </span>
                  <span className="text-xl font-bold text-orange-600">
                    +{localSignal.competitor_boost}
                  </span>
                </div>
              )}
              
              {/* Audience Demand Score */}
              {localSignal.audience_demand_score > 0 && (
                <div>
                  <span className="text-sm text-gray-500">Demand: </span>
                  <span className="text-xl font-bold text-blue-600">
                    +{localSignal.audience_demand_score}
                  </span>
                </div>
              )}
            </div>

            {/* Competitor Breakouts Section */}
            {localSignal.competitor_evidence && Array.isArray(localSignal.competitor_evidence) && localSignal.competitor_evidence.length > 0 && (
              <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-orange-700">
                    Competitor Breakouts
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full">
                    +{localSignal.competitor_boost || 0} boost
                  </span>
                </div>
                
                <div className="space-y-2">
                  {localSignal.competitor_evidence.map((ev, idx) => (
                    <div key={idx} className="text-sm">
                      {/* Main evidence line */}
                      <div className="flex items-center gap-2 text-orange-600">
                        <span>{ev.icon || '🔥'}</span>
                        <span className="flex-1">{ev.text}</span>
                        {ev.competitorType === 'direct' && (
                          <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                            Direct
                          </span>
                        )}
                      </div>
                      
                      {/* Verification details */}
                      <div className="mt-1 pl-6 text-xs text-gray-500 space-y-1">
                        {/* Video title */}
                        {ev.videoTitle && (
                          <p className="truncate" title={ev.videoTitle}>
                            📺 "{ev.videoTitle.substring(0, 50)}{ev.videoTitle.length > 50 ? '...' : ''}"
                          </p>
                        )}
                        
                        {/* Match reason */}
                        {ev.matchReason && (
                          <p>
                            🎯 Matched: {ev.matchReason}
                          </p>
                        )}
                        
                        {/* Verify link */}
                        {ev.videoUrl && (
                          <a 
                            href={ev.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline inline-flex items-center gap-1"
                          >
                            🔗 Verify on YouTube
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audience Demand Section */}
            {localSignal.audience_evidence && Array.isArray(localSignal.audience_evidence) && 
             localSignal.audience_evidence.filter(e => e.type !== 'competitor_breakout').length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-blue-700">
                    Audience Demand: {localSignal.demand_summary || 'High Demand'}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full">
                    +{localSignal.audience_demand_score || 0} boost
                  </span>
                </div>
                
                <div className="space-y-1.5">
                  {localSignal.audience_evidence
                    .filter(ev => ev.type !== 'competitor_breakout')
                    .map((ev, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-start gap-2 text-xs text-gray-700"
                      >
                        <span className="flex-shrink-0">{ev.icon || '👥'}</span>
                        <span className="flex-1" dir="auto">{ev.text}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* DNA Match */}
            {localSignal.matched_topic && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-600">✅</span>
                  <span>Matches your DNA: <strong className="text-green-800">{localSignal.matched_topic}</strong></span>
                </div>
              </div>
            )}

            {/* Audience Topics */}
            {localSignal.audience_topics && Array.isArray(localSignal.audience_topics) && localSignal.audience_topics.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-gray-700 mb-2">💬 Audience interest:</div>
                <div className="flex flex-wrap gap-1">
                  {localSignal.audience_topics.map((topic, i) => (
                    <span key={i} className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalsContent() {
  const searchParams = useSearchParams();
  const [showId, setShowId] = useState(searchParams.get('showId') || null);
  const [shows, setShows] = useState([]);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Fetch shows on mount
  useEffect(() => {
    async function fetchShows() {
      try {
        const res = await fetch('/api/shows');
        const result = await res.json();
        if (result.shows && result.shows.length > 0) {
          setShows(result.shows);
          if (!showId) {
            setShowId(result.shows[0].id);
          }
        } else if (result.show) {
          setShows([result.show]);
          if (!showId) {
            setShowId(result.show.id);
          }
        }
      } catch (err) {
        console.error('Error fetching shows:', err);
      }
    }
    fetchShows();
  }, []);

  useEffect(() => {
    if (showId) {
      fetchSignals();
    } else {
      setLoading(false);
    }
  }, [showId]);

  const fetchSignals = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use GET with query parameters (signals API uses GET)
      const url = new URL('/api/signals', window.location.origin);
      url.searchParams.set('showId', showId);
      url.searchParams.set('limit', '50');
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      
      // Check if response has content
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got: ${contentType}. Response: ${text.substring(0, 200)}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSignals(data.signals || []);
      } else {
        setError(data.error || 'Failed to load signals');
      }
    } catch (err) {
      console.error('Error fetching signals:', err);
      setError('Failed to load signals: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSignals();
    setRefreshing(false);
  };

  if (!showId || shows.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Select a Show</h1>
          {shows.length > 0 ? (
            <select
              value={showId || ''}
              onChange={(e) => setShowId(e.target.value)}
              className="border rounded-lg px-4 py-2 bg-white"
            >
              {shows.map(show => (
                <option key={show.id} value={show.id}>
                  {show.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-gray-500">Loading shows...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">📊 Signals & Evidence</h1>
            {shows.length > 0 && (
              <select
                value={showId}
                onChange={(e) => setShowId(e.target.value)}
                className="border rounded-lg px-3 py-2 bg-white text-sm"
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
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
            Refresh
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <LoadingSpinner message="Loading signals with evidence..." />
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
            <p className="font-medium">Error loading signals</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={fetchSignals}
              className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 rounded text-sm"
            >
              Try Again
            </button>
          </div>
        ) : signals.length === 0 ? (
          <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-500">
            <p>No signals found. Try refreshing or check if signals are being processed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-500 mb-4">
              Showing {signals.length} signals with evidence
            </div>
            {signals.map(signal => (
              <SignalCard key={signal.id} signal={signal} showId={showId} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function SignalsPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading..." />}>
      <SignalsContent />
    </Suspense>
  );
}
