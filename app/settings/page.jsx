'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LayoutWithNav from '../layout-with-nav';
import { SubredditManager } from '@/components/SubredditManager';

function SettingsContent() {
  const searchParams = useSearchParams();
  const showId = searchParams.get('showId') || '59dd9aef-bc59-4f79-b944-b8a345cf71c3';
  
  const [activeTab, setActiveTab] = useState('sources');
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(null);
  const [sources, setSources] = useState([]);
  const [events, setEvents] = useState([]);
  const [resetting, setResetting] = useState(false);
  const [redetecting, setRedetecting] = useState(false);
  const [redetectResult, setRedetectResult] = useState(null);
  const [skipPatterns, setSkipPatterns] = useState([]);
  const [newPattern, setNewPattern] = useState({ type: 'title_contains', value: '', reason: '' });
  
  // Modals
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  
  // Forms
  const [sourceForm, setSourceForm] = useState({ name: '', url: '', enabled: true });
  const [eventForm, setEventForm] = useState({
    event_date: '',
    event_year: '',
    title_ar: '',
    title_en: '',
    category: 'political',
    event_type: 'fixed',
    importance: 5,
    gulf_relevance: 5,
    story_angles: ''
  });

  useEffect(() => {
    fetchData();
  }, [showId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch show info
      const showRes = await fetch(`/api/shows/${showId}`);
      const showData = await showRes.json();
      if (showData.success) setShow(showData.show);

      // Fetch sources
      const sourcesRes = await fetch(`/api/signal-sources?showId=${showId}`);
      const sourcesData = await sourcesRes.json();
      if (sourcesData.success) setSources(sourcesData.sources || []);

      // Fetch calendar events
      const eventsRes = await fetch(`/api/calendar-events?showId=${showId}`);
      const eventsData = await eventsRes.json();
      if (eventsData.success) setEvents(eventsData.events || []);

      // Fetch skip patterns
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const patternsRes = await fetch(`/api/skip-patterns?showId=${showId}`, { headers });
      const patternsData = await patternsRes.json();
      if (patternsData.success) setSkipPatterns(patternsData.patterns || []);

    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Source functions
  const openAddSource = () => {
    setEditingSource(null);
    setSourceForm({ name: '', url: '', enabled: true });
    setShowSourceModal(true);
  };

  const openEditSource = (source) => {
    setEditingSource(source);
    setSourceForm({
      name: source.name,
      url: source.url,
      enabled: source.enabled
    });
    setShowSourceModal(true);
  };

  const saveSource = async () => {
    try {
      const method = editingSource ? 'PUT' : 'POST';
      const body = editingSource 
        ? { sourceId: editingSource.id, ...sourceForm }
        : { showId, ...sourceForm };

      const res = await fetch('/api/signal-sources', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success) {
        setShowSourceModal(false);
        fetchData();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error saving source: ' + error.message);
    }
  };

  const deleteSource = async (sourceId) => {
    if (!confirm('Delete this source?')) return;
    
    try {
      const res = await fetch(`/api/signal-sources?sourceId=${sourceId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) fetchData();
    } catch (error) {
      alert('Error deleting source: ' + error.message);
    }
  };

  const toggleSource = async (source) => {
    try {
      await fetch('/api/signal-sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sourceId: source.id, 
          enabled: !source.enabled 
        })
      });
      fetchData();
    } catch (error) {
      console.error('Error toggling source:', error);
    }
  };

  // Event functions
  const openAddEvent = () => {
    setEditingEvent(null);
    setEventForm({
      event_date: '',
      event_year: '',
      title_ar: '',
      title_en: '',
      category: 'political',
      event_type: 'fixed',
      importance: 5,
      gulf_relevance: 5,
      story_angles: ''
    });
    setShowEventModal(true);
  };

  const openEditEvent = (event) => {
    setEditingEvent(event);
    setEventForm({
      event_date: event.event_date || '',
      event_year: event.event_year || '',
      title_ar: event.title_ar || '',
      title_en: event.title_en || '',
      category: event.category || 'political',
      event_type: event.event_type || 'fixed',
      importance: event.importance || 5,
      gulf_relevance: event.gulf_relevance || 5,
      story_angles: Array.isArray(event.story_angles) ? event.story_angles.join('\n') : ''
    });
    setShowEventModal(true);
  };

  const saveEvent = async () => {
    try {
      const method = editingEvent ? 'PUT' : 'POST';
      
      // Parse story angles from text
      const storyAnglesArray = eventForm.story_angles
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const body = {
        ...(editingEvent ? { eventId: editingEvent.id } : { showId }),
        event_date: eventForm.event_date || null,
        event_year: eventForm.event_year ? parseInt(eventForm.event_year) : null,
        title_ar: eventForm.title_ar,
        title_en: eventForm.title_en,
        category: eventForm.category,
        event_type: eventForm.event_type,
        importance: parseInt(eventForm.importance),
        gulf_relevance: parseInt(eventForm.gulf_relevance),
        story_angles: storyAnglesArray
      };

      const res = await fetch('/api/calendar-events', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success) {
        setShowEventModal(false);
        fetchData();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error saving event: ' + error.message);
    }
  };

  const deleteEvent = async (eventId) => {
    if (!confirm('Delete this event?')) return;
    
    try {
      const res = await fetch(`/api/calendar-events?eventId=${eventId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) fetchData();
    } catch (error) {
      alert('Error deleting event: ' + error.message);
    }
  };

  // Reset Learning function
  const resetLearning = async () => {
    if (!confirm('Are you sure? This will reset all learned preferences for this show. The system will start fresh and learn from your new feedback.')) {
      return;
    }
    
    setResetting(true);
    try {
      // Get auth headers
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/learning/reset', {
        method: 'POST',
        headers,
        body: JSON.stringify({ showId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('✅ Learning data has been reset. The system will start learning from your new feedback.');
        // Refresh the page to update LearningStats immediately
        window.location.reload();
      } else {
        alert('Error: ' + (data.error || 'Failed to reset learning'));
      }
    } catch (error) {
      console.error('Reset learning error:', error);
      alert('Failed to reset learning: ' + error.message);
    } finally {
      setResetting(false);
    }
  };

  // Skip Patterns functions
  const addSkipPattern = async () => {
    if (!newPattern.value.trim()) {
      alert('Please enter a pattern value');
      return;
    }
    
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/skip-patterns', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          showId,
          patternType: newPattern.type,
          patternValue: newPattern.value,
          reason: newPattern.reason || null,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSkipPatterns([data.pattern, ...skipPatterns]);
        setNewPattern({ type: 'title_contains', value: '', reason: '' });
      } else {
        alert('Error: ' + (data.error || 'Failed to add pattern'));
      }
    } catch (error) {
      console.error('Add skip pattern error:', error);
      alert('Failed to add pattern: ' + error.message);
    }
  };

  const deleteSkipPattern = async (id) => {
    if (!confirm('Remove this skip pattern?')) return;
    
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/skip-patterns?id=${id}`, {
        method: 'DELETE',
        headers,
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSkipPatterns(skipPatterns.filter(p => p.id !== id));
      } else {
        alert('Error: ' + (data.error || 'Failed to delete pattern'));
      }
    } catch (error) {
      console.error('Delete skip pattern error:', error);
      alert('Failed to delete pattern: ' + error.message);
    }
  };

  // Re-detect Topics function
  const redetectTopics = async () => {
    if (!showId) {
      alert('No show selected');
      return;
    }
    
    setRedetecting(true);
    setRedetectResult(null);
    
    try {
      // Get auth headers
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/competitors/redetect-topics', {
        method: 'POST',
        headers,
        body: JSON.stringify({ showId, forceAll: false }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRedetectResult({
          success: true,
          message: `✅ Processed ${data.processed} videos: ${data.updated} updated, ${data.noMatch || 0} had no topic match`
        });
      } else {
        setRedetectResult({
          success: false,
          message: `Error: ${data.error}`
        });
      }
    } catch (error) {
      console.error('Re-detect topics error:', error);
      setRedetectResult({
        success: false,
        message: 'Failed to re-detect topics: ' + error.message
      });
    } finally {
      setRedetecting(false);
    }
  };

  if (loading) {
    return (
      <LayoutWithNav>
        <div className="min-h-screen flex items-center justify-center">
          <span className="animate-spin text-4xl">⏳</span>
        </div>
      </LayoutWithNav>
    );
  }

  return (
    <LayoutWithNav>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">⚙️ Settings</h1>
          <p className="text-gray-600 mt-1">Manage {show?.name || 'Show'} settings</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          {[
            { id: 'sources', label: '📡 RSS Sources', count: sources.length },
            { id: 'events', label: '📅 Calendar Events', count: events.length },
            { id: 'reddit', label: '🔴 Reddit Sources' },
            { id: 'show', label: '🎬 Show Settings' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* RSS Sources Tab */}
        {activeTab === 'sources' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">RSS Sources</h2>
              <button
                onClick={openAddSource}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                ➕ Add Source
              </button>
            </div>

            <div className="bg-white rounded-xl border divide-y">
              {sources.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No RSS sources configured
                </div>
              ) : (
                sources.map(source => (
                  <div key={source.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleSource(source)}
                        className={`w-12 h-6 rounded-full transition-all ${
                          source.enabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${
                          source.enabled ? 'ml-6' : 'ml-0.5'
                        }`} />
                      </button>
                      <div>
                        <p className="font-medium text-gray-900">{source.name}</p>
                        <p className="text-sm text-gray-500 truncate max-w-md">{source.url}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditSource(source)}
                        className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteSource(source.id)}
                        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Calendar Events Tab */}
        {activeTab === 'events' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Calendar Events</h2>
              <button
                onClick={openAddEvent}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                ➕ Add Event
              </button>
            </div>

            <div className="bg-white rounded-xl border divide-y max-h-[600px] overflow-y-auto">
              {events.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No calendar events
                </div>
              ) : (
                events.map(event => (
                  <div key={event.id} className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {event.event_date && (
                          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                            📅 {event.event_date}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          event.event_type === 'fixed' ? 'bg-blue-100 text-blue-700' :
                          event.event_type === 'islamic' ? 'bg-green-100 text-green-700' :
                          event.event_type === 'sports' ? 'bg-purple-100 text-purple-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {event.event_type}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                          ⭐ {event.importance}/10
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">{event.title_ar}</p>
                      {event.title_en && (
                        <p className="text-sm text-gray-500">{event.title_en}</p>
                      )}
                      {event.story_angles && event.story_angles.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          💡 {Array.isArray(event.story_angles) ? event.story_angles.length : 0} story angles
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditEvent(event)}
                        className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteEvent(event.id)}
                        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Reddit Sources Tab */}
        {activeTab === 'reddit' && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <SubredditManager showId={showId} />
          </div>
        )}

        {/* Show Settings Tab */}
        {activeTab === 'show' && (
          <div className="space-y-6">
            {/* Show Information Card */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🎬</span>
                <h2 className="text-lg font-semibold">Show Information</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Show Name</label>
                  <input
                    type="text"
                    value={show?.name || ''}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Videos Imported</label>
                    <input
                      type="text"
                      value={show?.total_videos_imported || 0}
                      disabled
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <input
                      type="text"
                      value={show?.onboarding_status || ''}
                      disabled
                      className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* YouTube Connection Status */}
            <YouTubeConnectionCard showId={showId} />

            {/* Sync Analytics Card */}
            <SyncAnalyticsCard showId={showId} />

            {/* Sync New Videos Card */}
            <SyncNewVideosCard showId={showId} />

            {/* Skip Patterns Card */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🚫</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Skip Patterns</h3>
                  <p className="text-sm text-gray-500">
                    Content matching these patterns will be excluded from competitor analysis. Videos with NULL or "other" topics are automatically excluded.
                  </p>
                </div>
              </div>
              
              {/* Add new pattern */}
              <div className="mb-4 space-y-2">
                <div className="flex gap-2">
                  <select
                    value={newPattern.type}
                    onChange={(e) => setNewPattern({...newPattern, type: e.target.value})}
                    className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="title_contains">Title Contains</option>
                    <option value="competitor">Competitor ID</option>
                  </select>
                  <input
                    type="text"
                    value={newPattern.value}
                    onChange={(e) => setNewPattern({...newPattern, value: e.target.value})}
                    placeholder="Pattern to skip (e.g., الدحيح)"
                    className="flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={addSkipPattern}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                  >
                    Add Skip
                  </button>
                </div>
                <input
                  type="text"
                  value={newPattern.reason}
                  onChange={(e) => setNewPattern({...newPattern, reason: e.target.value})}
                  placeholder="Reason (optional)"
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              
              {/* List patterns */}
              <div className="space-y-2">
                {skipPatterns.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No skip patterns configured
                  </div>
                ) : (
                  skipPatterns.map(pattern => (
                    <div key={pattern.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {pattern.pattern_type === 'title_contains' ? 'Title Contains' : 'Competitor'}:
                        </span>
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          {pattern.pattern_value}
                        </span>
                        {pattern.reason && (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            ({pattern.reason})
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteSkipPattern(pattern.id)}
                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Topic Gap Analysis Card */}
            <TopicGapAnalysis showId={showId} />

            {/* Competitor Video Topics Card */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🔍</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Competitor Video Topics</h3>
                  <p className="text-sm text-gray-500">
                    Re-analyze competitor videos and assign topics based on your channel DNA keywords. This helps improve competitor breakout matching.
                  </p>
                </div>
              </div>
              
              {redetectResult && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${
                  redetectResult.success 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {redetectResult.message}
                </div>
              )}

              <button
                onClick={redetectTopics}
                disabled={redetecting}
                className={`
                  w-full px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2
                  ${redetecting 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                  }
                `}
              >
                {redetecting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    Re-detect Video Topics
                  </>
                )}
              </button>
            </div>

            {/* Learning System Card */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🧠</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Learning System</h3>
                  <p className="text-sm text-gray-500">
                    Reset all learned preferences. The system will start fresh and learn from your new feedback.
                  </p>
                </div>
              </div>
              
              <div className="mb-4 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-700 border border-yellow-200">
                <p className="font-medium mb-1">⚠️ Warning:</p>
                <p>This will delete all learned topic preferences and weights. The system will need to learn again from your feedback.</p>
              </div>

              <button
                onClick={resetLearning}
                disabled={resetting}
                className={`
                  w-full px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2
                  ${resetting 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'bg-red-600 text-white hover:bg-red-700'
                  }
                `}
              >
                {resetting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Resetting...
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    Reset Learning
                  </>
                )}
              </button>
            </div>

            {/* Danger Zone Card */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">⚠️</span>
                <h2 className="text-lg font-semibold">Danger Zone</h2>
              </div>
              
              <div className="pt-4 border-t">
                <button
                  onClick={() => alert('Not implemented yet')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  🗑️ Delete Show
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Source Modal */}
        {showSourceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
              <h3 className="text-lg font-semibold mb-4">
                {editingSource ? '✏️ Edit Source' : '➕ Add Source'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={sourceForm.name}
                    onChange={(e) => setSourceForm({...sourceForm, name: e.target.value})}
                    placeholder="e.g., BBC Arabic"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RSS URL</label>
                  <input
                    type="text"
                    value={sourceForm.url}
                    onChange={(e) => setSourceForm({...sourceForm, url: e.target.value})}
                    placeholder="https://example.com/rss"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={sourceForm.enabled}
                    onChange={(e) => setSourceForm({...sourceForm, enabled: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label className="text-sm text-gray-700">Enabled</label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSourceModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSource}
                  disabled={!sourceForm.name || !sourceForm.url}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Event Modal */}
        {showEventModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">
                {editingEvent ? '✏️ Edit Event' : '➕ Add Event'}
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date (MM-DD)</label>
                    <input
                      type="text"
                      value={eventForm.event_date}
                      onChange={(e) => setEventForm({...eventForm, event_date: e.target.value})}
                      placeholder="01-15"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                    <input
                      type="number"
                      value={eventForm.event_year}
                      onChange={(e) => setEventForm({...eventForm, event_year: e.target.value})}
                      placeholder="1990"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arabic Title</label>
                  <input
                    type="text"
                    value={eventForm.title_ar}
                    onChange={(e) => setEventForm({...eventForm, title_ar: e.target.value})}
                    placeholder="العنوان بالعربي"
                    className="w-full px-3 py-2 border rounded-lg"
                    dir="rtl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">English Title</label>
                  <input
                    type="text"
                    value={eventForm.title_en}
                    onChange={(e) => setEventForm({...eventForm, title_en: e.target.value})}
                    placeholder="English title"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={eventForm.event_type}
                      onChange={(e) => setEventForm({...eventForm, event_type: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="fixed">Fixed Date</option>
                      <option value="islamic">Islamic</option>
                      <option value="sports">Sports</option>
                      <option value="seasonal">Seasonal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={eventForm.category}
                      onChange={(e) => setEventForm({...eventForm, category: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="political">Political</option>
                      <option value="war">War</option>
                      <option value="assassination">Assassination</option>
                      <option value="disaster">Disaster</option>
                      <option value="religious">Religious</option>
                      <option value="sports">Sports</option>
                      <option value="cultural">Cultural</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Importance (1-10)</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={eventForm.importance}
                      onChange={(e) => setEventForm({...eventForm, importance: e.target.value})}
                      className="w-full"
                    />
                    <div className="text-center text-sm font-medium">{eventForm.importance}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gulf Relevance (1-10)</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={eventForm.gulf_relevance}
                      onChange={(e) => setEventForm({...eventForm, gulf_relevance: e.target.value})}
                      className="w-full"
                    />
                    <div className="text-center text-sm font-medium">{eventForm.gulf_relevance}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Story Angles (one per line)
                  </label>
                  <textarea
                    value={eventForm.story_angles}
                    onChange={(e) => setEventForm({...eventForm, story_angles: e.target.value})}
                    placeholder="كيف أثر هذا الحدث على الخليج؟&#10;قصص مجهولة عن الحدث&#10;دروس مستفادة"
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEventModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEvent}
                  disabled={!eventForm.title_ar}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutWithNav>
  );
}

// Sync New Videos Card Component
function SyncNewVideosCard({ showId }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);

    try {
      const res = await fetch('/api/sync-new-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setResult({ 
          type: 'success', 
          message: data.message,
          videos: data.videos 
        });
      } else {
        setResult({ 
          type: 'error', 
          message: data.error,
          reconnectUrl: data.reconnectUrl 
        });
      }
    } catch (error) {
      setResult({ type: 'error', message: error.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">📥</span>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Sync New Videos</h3>
          <p className="text-sm text-gray-500">
            Import new videos added to your playlist
          </p>
        </div>
      </div>

      {/* Result Message */}
      {result && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          result.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <p>{result.type === 'success' ? '✅' : '❌'} {result.message}</p>
          
          {result.videos?.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="font-medium">New videos:</p>
              {result.videos.slice(0, 5).map(v => (
                <p key={v.id} className="text-xs truncate">• {v.title}</p>
              ))}
              {result.videos.length > 5 && (
                <p className="text-xs">...and {result.videos.length - 5} more</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
        <p>ℹ️ This will check your playlist for any new videos and import them.</p>
      </div>

      {/* Sync Button */}
      <button
        onClick={handleSync}
        disabled={syncing}
        className={`
          w-full px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2
          ${syncing 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-green-600 text-white hover:bg-green-700'
          }
        `}
      >
        {syncing ? (
          <>
            <span className="animate-spin">⏳</span>
            Checking for new videos...
          </>
        ) : (
          <>
            <span>📥</span>
            Sync New Videos
          </>
        )}
      </button>
    </div>
  );
}

// Topic Gap Analysis Component
function TopicGapAnalysis({ showId }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [gapAnalysis, setGapAnalysis] = useState(null);

  const analyzeTopicGaps = async () => {
    if (!showId) return;
    
    setAnalyzing(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/topics/analyze-gaps', {
        method: 'POST',
        headers,
        body: JSON.stringify({ showId }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        alert('Error: ' + data.error);
      } else {
        setGapAnalysis(data);
      }
    } catch (error) {
      alert('Analysis failed: ' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const formatViews = (views) => {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(0) + 'K';
    return views?.toLocaleString() || '0';
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2 text-lg">
            <span className="text-2xl">🔍</span>
            Topic Gap Analysis
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Find videos that aren't categorized and discover missing keywords to add to your DNA.
          </p>
        </div>
      </div>
      
      <button
        onClick={analyzeTopicGaps}
        disabled={analyzing}
        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
      >
        {analyzing ? (
          <>
            <span className="animate-spin">⏳</span>
            Analyzing...
          </>
        ) : (
          <>
            <span>🔍</span>
            Analyze Topic Gaps
          </>
        )}
      </button>

      {gapAnalysis && (
        <div className="mt-6 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <span className="text-2xl">⚠️</span>
                <span className="font-semibold text-2xl">{gapAnalysis.uncategorizedCount}</span>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Uncategorized Videos
              </p>
            </div>
            
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                <span className="text-2xl">📊</span>
                <span className="font-semibold text-2xl">{formatViews(gapAnalysis.totalViews)}</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Views Without Topic Data
              </p>
            </div>
          </div>

          {/* Suggested Keywords */}
          {gapAnalysis.suggestedKeywords?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span>➕</span>
                Suggested Keywords to Add to DNA
              </h4>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {gapAnalysis.suggestedKeywords.map((kw, i) => (
                  <div 
                    key={i} 
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-white text-lg">
                        {kw.keyword}
                      </span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500">
                          {kw.videoCount} videos
                        </span>
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {formatViews(kw.totalViews)} views
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      Example: {kw.examples[0]?.substring(0, 70)}...
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Uncategorized Videos */}
          {gapAnalysis.sampleVideos?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                Top Uncategorized Videos
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {gapAnalysis.sampleVideos.map((video, i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm"
                  >
                    <span className="truncate flex-1 text-gray-700 dark:text-gray-300">
                      {video.title}
                    </span>
                    <span className="text-gray-500 ml-2 whitespace-nowrap">
                      {formatViews(video.views)} views
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              How to Fix:
            </h4>
            <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
              <li>Look at the suggested keywords above</li>
              <li>Go to your DNA Topics settings</li>
              <li>Add missing keywords to relevant topics</li>
              <li>Click "Re-detect Video Topics" to update categorization</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// YouTube Connection Card Component
function YouTubeConnectionCard({ showId }) {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnection();
  }, [showId]);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shows/${showId}`);
      const data = await res.json();
      
      if (data.success && data.show) {
        const youtubeAccountId = data.show.youtube_account_id;
        
        if (youtubeAccountId) {
          // Check if account exists and has valid tokens
          const { supabase } = await import('@/lib/supabase');
          const { data: account, error } = await supabase
            .from('youtube_accounts')
            .select('channel_title, channel_id, refresh_token, connected_at')
            .eq('id', youtubeAccountId)
            .single();
          
          if (account && account.refresh_token) {
            setConnectionStatus({
              connected: true,
              channelTitle: account.channel_title,
              channelId: account.channel_id,
              connectedAt: account.connected_at
            });
          } else {
            setConnectionStatus({ connected: false, reason: 'No refresh token' });
          }
        } else {
          setConnectionStatus({ connected: false, reason: 'No YouTube account linked' });
        }
      } else {
        setConnectionStatus({ connected: false, reason: 'Show not found' });
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setConnectionStatus({ connected: false, reason: 'Error checking status' });
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = async () => {
    try {
      const res = await fetch(`/api/youtube/auth?showId=${showId}`);
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error getting auth URL:', error);
      alert('Failed to get YouTube auth URL. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📺</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">YouTube Connection</h3>
            <p className="text-sm text-gray-500">Checking connection status...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">📺</span>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">YouTube Connection</h3>
          <p className="text-sm text-gray-500">
            {connectionStatus?.connected 
              ? 'Connected to your YouTube channel' 
              : 'Not connected to YouTube'}
          </p>
        </div>
      </div>

      {connectionStatus?.connected ? (
        <div className="space-y-3">
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600">✅</span>
              <span className="font-medium text-green-800">Connected</span>
            </div>
            <p className="text-sm text-green-700">
              Channel: <span className="font-medium">{connectionStatus.channelTitle}</span>
            </p>
            {connectionStatus.connectedAt && (
              <p className="text-xs text-green-600 mt-1">
                Connected: {new Date(connectionStatus.connectedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={handleReconnect}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
          >
            🔄 Reconnect YouTube
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-600">❌</span>
              <span className="font-medium text-red-800">Not Connected</span>
            </div>
            <p className="text-sm text-red-700">
              {connectionStatus?.reason === 'No YouTube account linked' 
                ? 'No YouTube account is linked to this show. Connect your YouTube channel to sync videos and analytics.'
                : 'YouTube connection is missing or expired. Reconnect to enable video syncing.'}
            </p>
          </div>
          <button
            onClick={handleReconnect}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center justify-center gap-2"
          >
            <span>🔗</span>
            Connect YouTube
          </button>
        </div>
      )}
    </div>
  );
}

// Sync Analytics Card Component
function SyncAnalyticsCard({ showId }) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchSyncStatus();
  }, [showId]);

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch(`/api/sync-analytics?showId=${showId}`);
      const data = await res.json();
      if (data.success) {
        setSyncStatus(data);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);

    try {
      const res = await fetch('/api/sync-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setResult({ type: 'success', message: data.message });
        fetchSyncStatus();
      } else {
        setResult({ 
          type: 'error', 
          message: data.error,
          reconnectUrl: data.reconnectUrl 
        });
      }
    } catch (error) {
      setResult({ type: 'error', message: error.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">📊</span>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Sync Video Analytics</h3>
          <p className="text-sm text-gray-500">
            Fetch fresh "last 7 days" data for evergreen analysis
          </p>
        </div>
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Videos with fresh data:</span>
            <span className="font-medium">{syncStatus.syncedVideos}</span>
          </div>
          {syncStatus.lastSyncAt && (
            <div className="flex justify-between mt-1">
              <span className="text-gray-600">Last synced:</span>
              <span className="font-medium">
                {new Date(syncStatus.lastSyncAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Result Message */}
      {result && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          result.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <p>{result.type === 'success' ? '✅' : '❌'} {result.message}</p>
          {result.type === 'error' && result.reconnectUrl && (
            <button
              onClick={() => {
                // Get auth URL and redirect
                fetch(`/api/youtube/auth?showId=${showId}`)
                  .then(res => res.json())
                  .then(data => {
                    if (data.authUrl) {
                      window.location.href = data.authUrl;
                    }
                  })
                  .catch(err => console.error('Error getting auth URL:', err));
              }}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              🔗 Reconnect YouTube
            </button>
          )}
        </div>
      )}

      {/* Info */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
        <p className="font-medium mb-1">ℹ️ What this does:</p>
        <ul className="list-disc list-inside space-y-1 text-blue-600">
          <li>Fetches current "last 7 days" views from YouTube</li>
          <li>Updates top 50 videos older than 90 days</li>
          <li>Enables accurate Evergreen analysis</li>
          <li>Uses YouTube API quota (run once daily max)</li>
        </ul>
      </div>

      {/* Sync Button */}
      <button
        onClick={handleSync}
        disabled={syncing}
        className={`
          w-full px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2
          ${syncing 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 text-white hover:bg-blue-700'
          }
        `}
      >
        {syncing ? (
          <>
            <span className="animate-spin">⏳</span>
            Syncing... (this may take a minute)
          </>
        ) : (
          <>
            <span>🔄</span>
            Sync Analytics Now
          </>
        )}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

