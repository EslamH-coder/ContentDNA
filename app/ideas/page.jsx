'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { userHasAccessToShow, getUserShows } from '@/lib/userShows';
import { supabase } from '@/lib/supabase';
import LayoutWithNav from '../layout-with-nav';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import StoryModal from '@/components/StoryModal';

function IdeasContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const showId = searchParams.get('showId');
  const initialTab = searchParams.get('tab') || 'signals';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [redditLoading, setRedditLoading] = useState(false);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [signalFilter, setSignalFilter] = useState('all'); // 'all', 'new', 'liked', 'saved', 'evergreen'
  const [signalSort, setSignalSort] = useState('date');
  const [timeFilter, setTimeFilter] = useState('today'); // 'today', 'yesterday', 'week', 'all' - Default to 'today' for RSS, 'week' for evergreen
  
  // Auto-set time filter default: 'week' when switching to evergreen tab
  useEffect(() => {
    if (signalFilter === 'evergreen' && timeFilter === 'today') {
      // When switching to evergreen tab, default to 'week' if currently on 'today'
      setTimeFilter('week');
    }
  }, [signalFilter]); // Only run when signalFilter changes
  
  const [data, setData] = useState({
    anniversaries: [],
    islamicEvents: [],
    sportsEvents: [],
    seasonalEvents: [],
    newsSignals: [],
    signals: [],
    clusters: [],
    unclassifiedSignals: [],
    ideaBank: [],
    savedIdeas: [],
    savedPitches: []
  });

  // Modals
  const [showAddIdea, setShowAddIdea] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [generatedPitch, setGeneratedPitch] = useState('');
  const [generatingPitch, setGeneratingPitch] = useState(false);
  const [generatedPitchId, setGeneratedPitchId] = useState(null);
  const [pitchCopied, setPitchCopied] = useState(false);
  const [savingPitch, setSavingPitch] = useState(false);
  const [pitchType, setPitchType] = useState('auto'); // 'auto', 'news', 'analysis'
  const [generatedPitchType, setGeneratedPitchType] = useState(null);
  const [showCreateClusterModal, setShowCreateClusterModal] = useState(false);
  const [newClusterName, setNewClusterName] = useState('');
  const [selectedUnclassifiedSignals, setSelectedUnclassifiedSignals] = useState([]);
  const [creatingCluster, setCreatingCluster] = useState(false);
  const [newSignalsCount, setNewSignalsCount] = useState(null);
  const [storyModal, setStoryModal] = useState({ isOpen: false, story: null });
  const [refreshLearningStats, setRefreshLearningStats] = useState(null);

  // New idea form
  const [newIdea, setNewIdea] = useState({
    title: '',
    description: '',
    priority: 5,
    source: 'team'
  });

  // Verify show access and fetch data when showId changes
  useEffect(() => {
    let mounted = true;
    
    async function verifyAccessAndFetch() {
      console.log('📡 useEffect triggered, showId:', showId);
      
      // Since server already verified auth (via middleware/layout), just proceed
      // API calls will authenticate via cookies
      if (showId) {
        console.log('📡 showId available, verifying access...');
        const hasAccess = await userHasAccessToShow(showId);
        
        if (!hasAccess) {
          console.log('⚠️ No access to show, redirecting...');
          // Redirect to first available show or show error
          const { shows } = await getUserShows();
          if (shows.length > 0) {
            router.push(`/ideas?showId=${shows[0].id}`);
          } else {
            // No shows - show message
            if (mounted) setLoading(false);
            return;
          }
        } else {
          // Access verified, fetch data
          console.log('✅ Access verified, fetching data for showId:', showId);
          if (mounted) await fetchData();
        }
      } else {
        console.log('⚠️ No showId, trying to get first available show...');
        // No showId, try to get first available show
        const { shows } = await getUserShows();
        if (shows.length > 0) {
          const firstShowId = shows[0].id;
          console.log('📡 Setting showId to first available:', firstShowId);
          router.push(`/ideas?showId=${firstShowId}`);
        } else {
          console.log('⚠️ No shows available');
          if (mounted) setLoading(false);
        }
      }
    }
    
    verifyAccessAndFetch();
    
    return () => {
      mounted = false;
    };
  }, [showId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep old useEffect for backward compatibility
  // useEffect(() => {
  //   if (showId) fetchData();
  // }, [showId]);

  // Open story modal with all angles
  const openStoryModal = (storyId) => {
    const storySignals = (data.signals || []).filter(s => s.story_id === storyId);
    storySignals.sort((a, b) => (a.story_rank || 99) - (b.story_rank || 99));
    
    if (storySignals.length === 0) return;
    
    setStoryModal({
      isOpen: true,
      story: {
        id: storyId,
        signals: storySignals,
        mainSignal: storySignals[0]
      }
    });
  };

  // Close story modal
  const closeStoryModal = () => {
    setStoryModal({ isOpen: false, story: null });
  };

  // Handle like from modal - uses same logic as SignalCard handleFeedback
  const handleLikeFromModal = async (signalId) => {
    const signal = (data.signals || []).find(s => s.id === signalId);
    if (!signal) return;
    
    // Check if this is an undo action (clicking like again when already liked)
    const currentStatus = (signal.status || 'new').trim().toLowerCase();
    const action = 'liked';
    const isUndo = currentStatus === action;
    const finalAction = isUndo ? 'undo' : action;
    const finalStatus = isUndo ? 'new' : action;
    
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          show_id: showId,
          recommendation_id: signalId,
          topic: signal.title,
          action: finalAction, // 'liked' or 'undo'
          original_action: isUndo ? action : null,
          original_score: signal.relevance_score || signal.score || 0,
          evidence_summary: {
            score: signal.relevance_score || signal.score || 0,
            hook_potential: signal.hook_potential || 0,
            matched_topic: signal.matched_topic,
            url: signal.url,
            source: signal.source || 'signal'
          }
        })
      });
      
      const result = await res.json();
      if (result.success) {
        // Update local state immediately
        setData(prev => ({
          ...prev,
          signals: prev.signals.map(s => 
            s.id === signalId ? { ...s, status: finalStatus } : s
          )
        }));
        
        // Refresh data to get updated learning weights
        await fetchData();
      } else {
        console.error('❌ Feedback error:', result.error);
        alert('Failed to update: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error liking signal:', error);
      alert('Error: ' + error.message);
    }
  };

  // Handle reject from modal - uses same logic as SignalCard handleFeedback
  const handleRejectFromModal = async (signalId, reason = 'already_covered') => {
    const signal = (data.signals || []).find(s => s.id === signalId);
    if (!signal) return;
    
    // Check if this is an undo action (clicking reject again when already rejected)
    const currentStatus = (signal.status || 'new').trim().toLowerCase();
    const action = 'rejected';
    const isUndo = currentStatus === action;
    const finalAction = isUndo ? 'undo' : action;
    const finalStatus = isUndo ? 'new' : action;
    
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          show_id: showId,
          recommendation_id: signalId,
          topic: signal.title,
          action: finalAction, // 'rejected' or 'undo'
          original_action: isUndo ? action : null,
          rejection_reason: reason,
          original_score: signal.relevance_score || signal.score || 0,
          evidence_summary: {
            score: signal.relevance_score || signal.score || 0,
            hook_potential: signal.hook_potential || 0,
            matched_topic: signal.matched_topic,
            url: signal.url,
            source: signal.source || 'signal'
          }
        })
      });
      
      const result = await res.json();
      if (result.success) {
        // Update local state immediately
        setData(prev => ({
          ...prev,
          signals: prev.signals.map(s => 
            s.id === signalId ? { ...s, status: finalStatus } : s
          )
        }));
        
        // Refresh data to get updated learning weights
        await fetchData();
      } else {
        console.error('❌ Feedback error:', result.error);
        alert('Failed to update: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error rejecting signal:', error);
      alert('Error: ' + error.message);
    }
  };

  // Calculate story stats
  const storyStats = useMemo(() => {
    const stories = new Set((data.signals || []).filter(s => s.story_id).map(s => s.story_id));
    const bigStories = (data.signals || []).filter(s => s.story_rank === 1 && s.story_size > 3);
    
    return {
      totalSignals: (data.signals || []).length,
      uniqueStories: stories.size,
      bigStories: bigStories.length,
    };
  }, [data.signals]);

  // Helper function to filter signals by time
  const filterByTime = (signals, hours) => {
    if (!hours) return signals; // 'all' - no time filter
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return signals.filter(s => {
      const signalDate = new Date(s.created_at || s.detected_at || s.updated_at || 0);
      return signalDate.getTime() > cutoff;
    });
  };

  // TEMPORARILY DISABLED: Show ALL signals individually (no grouping)
  // Previously: Only showed story_rank === 1 for stories, hiding other angles
  // Now: Show all signals so user can see all 145 today's signals
  const visibleSignals = useMemo(() => {
    // Show ALL signals - no filtering by story_rank
    let base = (data.signals || []);

    // Apply time filter
    switch (timeFilter) {
      case 'today':
        base = filterByTime(base, 24);
        break;
      case 'yesterday':
        base = filterByTime(base, 48);
        break;
      case 'week':
        base = filterByTime(base, 168);
        break;
      case 'all':
      default:
        // No time filter
        break;
    }

    // Apply sort mode
    return base.sort((a, b) => {
      if (signalSort === 'score') {
        const scoreA = a.relevance_score || a.score || 0;
        const scoreB = b.relevance_score || b.score || 0;
        return scoreB - scoreA;
      }
      if (signalSort === 'hook') {
        const hookA = typeof a.hook_potential === 'string' 
          ? parseFloat(a.hook_potential) || 0 
          : a.hook_potential || 0;
        const hookB = typeof b.hook_potential === 'string' 
          ? parseFloat(b.hook_potential) || 0 
          : b.hook_potential || 0;
        return hookB - hookA;
      }
      // Default: sort by date (most recent first)
      const dateA = new Date(a.created_at || a.detected_at || a.updated_at || 0);
      const dateB = new Date(b.created_at || b.detected_at || b.updated_at || 0);
      return dateB - dateA;
    });
  }, [data.signals, signalSort, timeFilter]);

  // TEMPORARILY DISABLED: Signal grouping - show all signals individually
  // Previously: Grouped signals by story_id, hiding individual signals under anchors
  // Now: Return all signals as individual items (no grouping)
  const groupedSignals = useMemo(() => {
    // Return all signals as individual items (no grouping)
    return visibleSignals.map(signal => ({
      type: 'single',
      signals: [signal]
    }));
  }, [visibleSignals]);

  // Helper to get auth headers for API requests
  const getAuthHeaders = async (additionalHeaders = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const fetchData = async () => {
    if (!showId) {
      console.log('⚠️ fetchData called but no showId, skipping');
      return;
    }
    
    console.log('📡 fetchData called for showId:', showId);
    setLoading(true);
    setRefreshing(false);
    
    try {
      // Get auth headers once for all requests
      const headers = await getAuthHeaders();
      
      // Fetch signals - request all quality signals (no limit)
      console.log('📡 Fetching signals...');
      const signalsRes = await fetch(`/api/signals?show_id=${showId}&limit=500`, { headers });
      const signalsData = await signalsRes.json();
      
      if (signalsData.error) {
        console.error('❌ Signals API error:', signalsData.error);
      } else {
        const receivedCount = signalsData.signals?.length || 0;
        const rssCount = (signalsData.signals || []).filter(s => !s.is_evergreen).length;
        const evergreenCount = (signalsData.signals || []).filter(s => s.is_evergreen).length;
        console.log(`✅ Signals received: ${receivedCount} total (${rssCount} RSS, ${evergreenCount} evergreen)`);
        console.log(`📊 API stats:`, signalsData.stats || 'No stats');
      }
      
      // Fetch clusters
      const clustersRes = await fetch(`/api/clusters?showId=${showId}`, { headers });
      const clustersData = await clustersRes.json();
      console.log('Clusters response:', clustersData); // Debug log
      
      // Find uncategorized cluster to get unclassified signals
      const uncategorizedCluster = clustersData.clusters?.find(c => c.cluster_key === 'uncategorized');
      const unclassifiedSignals = uncategorizedCluster?.items?.map(item => ({
        id: item.signal_id,
        title: item.title,
        description: '',
        url: item.url,
        source: 'signal',
        relevance_score: item.relevance_score,
        score: item.relevance_score
      })) || [];
      
      // Fetch saved ideas (from recommendation_feedback)
      const savedRes = await fetch(`/api/saved-ideas?showId=${showId}`, { headers });
      const savedData = await savedRes.json();
      console.log('Saved ideas:', savedData); // Debug log
      
      // Fetch saved pitches from pitches table
      const savedPitchesRes = await fetch(`/api/pitches?showId=${showId}`, { headers });
      const savedPitchesData = await savedPitchesRes.json();
      console.log('Saved pitches:', savedPitchesData); // Debug log
      
      // Fetch calendar events
      const calendarRes = await fetch(`/api/story-ideas?showId=${showId}`, { headers });
      const calendarData = await calendarRes.json();

      setData({
        signals: signalsData.signals || [],
        clusters: clustersData.clusters || [],
        unclassifiedSignals: unclassifiedSignals,
        savedIdeas: savedData.ideas || [],
        savedPitches: savedPitchesData.success ? savedPitchesData.pitches || [] : [],
        anniversaries: calendarData.data?.anniversaries || [],
        islamicEvents: calendarData.data?.islamicEvents || [],
        sportsEvents: calendarData.data?.sportsEvents || [],
        seasonalEvents: calendarData.data?.seasonalEvents || [],
        newsSignals: calendarData.data?.newsSignals || [],
        ideaBank: calendarData.data?.ideaBank || []
      });
      
      console.log('✅ Data fetch complete:', {
        signals: signalsData.signals?.length || 0,
        clusters: clustersData.clusters?.length || 0,
        savedIdeas: savedData.ideas?.length || 0
      });
    } catch (error) {
      console.error('❌ Error fetching ideas:', error);
    } finally {
      setLoading(false);
      console.log('📡 fetchData finished, loading set to false');
    }
  };

  const refreshNews = async (e) => {
    // Prevent any default behavior that might cause page refresh
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('🔄 refreshNews called');
    setRefreshing(true);
    setNewSignalsCount(null);
    console.log('🔄 refreshing state set to true');
    
    try {
      // Step 1: Refresh RSS signals
      console.log('🔄 Starting refresh for showId:', showId);
      const refreshHeaders = await getAuthHeaders();
      console.log('🔐 Auth headers obtained');
      
      // Validate showId before making request
      if (!showId) {
        console.error('No showId provided for refresh');
        alert('Error: No show ID selected. Please select a show first.');
        setRefreshing(false);
        return;
      }
      
      console.log('📡 Making fetch request to /api/signals/refresh...');
      let refreshRes;
      try {
        refreshRes = await fetch('/api/signals/refresh', {
          method: 'POST',
          headers: refreshHeaders,
          body: JSON.stringify({ showId })
        });
        console.log('📡 Fetch response received:', refreshRes.status, refreshRes.statusText);
      } catch (fetchError) {
        // Network error (Failed to fetch)
        console.error('Network error refreshing signals:', fetchError);
        console.error('Fetch error details:', {
          name: fetchError.name,
          message: fetchError.message,
          stack: fetchError.stack
        });
        
        if (fetchError.name === 'AbortError') {
          alert('Request timed out after 60 seconds. The server may be slow or unresponsive. Please try again.');
        } else {
          alert(`Network error: ${fetchError.message || 'Failed to connect to server'}. Please check your connection and try again.`);
        }
        setRefreshing(false);
        return;
      }
      
      // Check if response is OK and has content
      if (!refreshRes.ok) {
        const errorText = await refreshRes.text();
        console.error('Refresh API error:', refreshRes.status, errorText);
        alert(`Error refreshing signals: ${refreshRes.status} ${errorText || 'Unknown error'}`);
        setRefreshing(false);
        return;
      }
      
      // Check if response has content before parsing JSON
      const responseText = await refreshRes.text();
      if (!responseText || responseText.trim() === '') {
        console.error('Empty response from refresh API');
        alert('Error refreshing signals: Empty response from server');
        setRefreshing(false);
        return;
      }
      
      let refreshData;
      try {
        refreshData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse refresh response:', parseError, 'Response:', responseText);
        alert('Error refreshing signals: Invalid response from server');
        setRefreshing(false);
        return;
      }
      
      if (!refreshData.success) {
        alert(`Error refreshing signals: ${refreshData.error || 'Refresh failed'}`);
        setRefreshing(false);
        return;
      }

      const importedCount = refreshData.imported || 0;
      setNewSignalsCount(importedCount);
      console.log('RSS refresh:', refreshData);

      // Step 2: Auto-enrich top 10 signals with DNA context
      let enrichedCount = 0;
      if (refreshData.success && importedCount > 0) {
        try {
          console.log('🧠 Auto-enriching top 10 signals...');
          const enrichHeaders = await getAuthHeaders();
          const enrichRes = await fetch('/api/smart-enrich', {
            method: 'POST',
            headers: enrichHeaders,
            body: JSON.stringify({ showId, limit: 10 })
          });
          const enrichData = await enrichRes.json();
          enrichedCount = enrichData.enriched || 0;
          console.log('Smart enrich result:', enrichData);
        } catch (enrichError) {
          console.error('Auto-enrichment error:', enrichError);
          // Continue even if enrichment fails
        }
      }

      // Step 3: Regenerate clusters with new signals
      try {
        const clusterHeaders = await getAuthHeaders();
        await fetch('/api/clusters', {
          method: 'POST',
          headers: clusterHeaders,
          body: JSON.stringify({ showId, force: true })
        });
        console.log('Clusters regenerated');
      } catch (clusterError) {
        console.error('Cluster regeneration error:', clusterError);
      }

      // Step 4: Refresh the signals list
      await fetchData();

      // Show result
      if (enrichedCount > 0) {
        alert(`✅ Refreshed! ${importedCount} new signals added, ${enrichedCount} enriched with AI.`);
      } else {
        alert(`✅ Refreshed! ${importedCount} new signals added.`);
      }
    } catch (error) {
      // Catch any unhandled errors
      console.error('Refresh error:', error);
      alert(`Error refreshing signals: ${error.message || 'Unknown error'}. Please try again.`);
    } finally {
      // Always reset refreshing state
      setRefreshing(false);
    }
  };

  const fetchReddit = async () => {
    if (!showId) return;
    
    setRedditLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/reddit/fetch', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ showId }),
      });
      
      const data = await response.json();
      
      if (response.status === 429) {
        // Rate limit reached
        alert(data.message || 'Daily Reddit limit reached. You can fetch Reddit ideas once per day. Try again tomorrow!');
      } else if (data.error) {
        alert(`Reddit error: ${data.error}`);
      } else {
        alert(`✅ Imported ${data.imported} evergreen ideas from ${data.sources?.length || 0} subreddits!`);
        fetchData(); // Refresh the signals list
      }
    } catch (error) {
      console.error('Reddit fetch error:', error);
      alert('Failed to fetch Reddit content');
    } finally {
      setRedditLoading(false);
    }
  };

  const fetchWikipedia = async () => {
    if (!showId) return;
    
    setWikiLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/wikipedia/fetch', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ showId, language: 'en' }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        alert(`Wikipedia error: ${data.error}`);
      } else {
        alert(`✅ Imported ${data.imported} trending topics from Wikipedia!`);
        fetchData(); // Refresh the signals list
      }
    } catch (error) {
      console.error('Wikipedia fetch error:', error);
      alert('Failed to fetch Wikipedia trends');
    } finally {
      setWikiLoading(false);
    }
  };

  const enrichSignals = async () => {
    setEnriching(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/enrich-signals', {
        method: 'POST',
        headers,
        body: JSON.stringify({ showId, limit: 20 })
      });
      const data = await res.json();
      
      if (data.success) {
        alert(`✅ ${data.message}`);
        fetchData(); // Refresh the signals list
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setEnriching(false);
    }
  };

  const addIdea = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/idea-bank', {
        method: 'POST',
        headers,
        body: JSON.stringify({ showId, ...newIdea })
      });
      const result = await res.json();
      if (result.success) {
        setShowAddIdea(false);
        setNewIdea({ title: '', description: '', priority: 5, source: 'team' });
        fetchData();
      }
    } catch (error) {
      console.error('Error adding idea:', error);
    }
  };

  const updateIdeaStatus = async (ideaId, status) => {
    try {
      const headers = await getAuthHeaders();
      await fetch('/api/idea-bank', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ ideaId, status })
      });
      fetchData();
    } catch (error) {
      console.error('Error updating idea:', error);
    }
  };

  const deleteIdea = async (ideaId) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/saved-ideas?ideaId=${ideaId}`, { 
        method: 'DELETE',
        headers 
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting idea:', error);
    }
  };

  const updateSavedIdeaStatus = async (ideaId, status) => {
    try {
      const headers = await getAuthHeaders();
      await fetch('/api/saved-ideas', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ ideaId, status })
      });
      fetchData();
    } catch (error) {
      console.error('Error updating saved idea:', error);
    }
  };

  const updateSignalStatus = async (signalId, newStatus) => {
    if (!signalId) {
      console.error('No signalId provided to updateSignalStatus');
      alert('Error: Signal ID is missing');
      return;
    }

    try {
      console.log('Updating signal status:', { signalId, newStatus, signalIdType: typeof signalId });
      
      const headers = await getAuthHeaders();
      const res = await fetch('/api/signals/status', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ signalId: String(signalId), status: newStatus })
      });
      
      const data = await res.json();
      console.log('API response:', { status: res.status, ok: res.ok, data });
      
      if (res.ok && data.success) {
        console.log('Signal status updated successfully:', data);
        // Update local state - handle both string and number IDs
        setData(prev => ({
          ...prev,
          newsSignals: prev.newsSignals?.map(s => {
            const sId = String(s.id || s.signal_id || '');
            const targetId = String(signalId);
            return sId === targetId ? { ...s, status: newStatus } : s;
          }) || []
        }));
      } else {
        console.error('Failed to update signal status:', data);
        alert(`Error: ${data.error || 'Failed to update status'}`);
      }
    } catch (error) {
      console.error('Error updating signal status:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const generatePitch = async (item, type, selectedPitchType = null, forceRegenerate = false) => {
    // Skip cluster pitches for MVP
    if (type === 'cluster') {
      alert('Cluster pitch generation is coming soon!');
      return;
    }

    setSelectedItem({ ...item, type });
    setShowPitchModal(true);
    setGeneratingPitch(true);
    setGeneratedPitch('');
    setGeneratedPitchId(null);
    setPitchCopied(false);
    setGeneratedPitchType(null);

    // Determine pitch type if not provided
    const finalPitchType = selectedPitchType || pitchType;
    
    // Auto-detect if 'auto' is selected
    let actualPitchType = finalPitchType;
    if (finalPitchType === 'auto') {
      actualPitchType = item.is_evergreen ? 'analysis' : 'news';
    }

    try {
      // Use signalId for API call
      const signalId = item.id;
      if (!signalId) {
        throw new Error('Signal ID is required');
      }

      const headers = await getAuthHeaders();
      const res = await fetch('/api/generate-pitch', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          signalId,
          showId,
          pitchType: actualPitchType,
          forceRegenerate,
        })
      });

      const data = await res.json();

      if (res.status === 429) {
        alert(data.message || 'Daily limit reached');
        return;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedPitch(data.pitch || 'Failed to generate pitch');
      setGeneratedPitchId(data.pitch_id || null);
      setGeneratedPitchType(data.pitchType || actualPitchType);
      
      // Show message if cached
      if (data.cached) {
        console.log('📄 Using cached pitch');
      }
    } catch (error) {
      console.error('Error generating pitch:', error);
      setGeneratedPitch('Error generating pitch: ' + error.message);
    } finally {
      setGeneratingPitch(false);
    }
  };

  const copyPitch = async () => {
    if (generatedPitch) {
      await navigator.clipboard.writeText(generatedPitch);
      setPitchCopied(true);
      setTimeout(() => setPitchCopied(false), 2000);
    }
  };

  const savePitch = async () => {
    if (!selectedItem || !generatedPitch) {
      alert('No pitch to save');
      return;
    }
    
    setSavingPitch(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/pitches/save', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          signalId: selectedItem.id,
          showId,
          content: generatedPitch,
          pitchType: generatedPitchType || pitchType || 'news',
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Update the pitch ID for future reference
        if (data.pitch?.id) {
          setGeneratedPitchId(data.pitch.id);
        }
        // Close modal and navigate to saved pitches tab
        setShowPitchModal(false);
        setActiveTab('saved-pitches');
        // Refresh data to show the new saved pitch
        fetchData();
      } else {
        alert('Error: ' + (data.error || 'Failed to save pitch'));
      }
    } catch (error) {
      console.error('Error saving pitch:', error);
      alert('Failed to save pitch: ' + error.message);
    } finally {
      setSavingPitch(false);
    }
  };


  const handleCreateCluster = async () => {
    if (!newClusterName) return;
    
    // Use selected signals, or if none selected, create empty cluster
    const signalIds = selectedUnclassifiedSignals.length > 0 
      ? selectedUnclassifiedSignals 
      : [];
    
    setCreatingCluster(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/clusters/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          showId,
          clusterName: newClusterName,
          signalIds: signalIds
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setShowCreateClusterModal(false);
        setNewClusterName('');
        setSelectedUnclassifiedSignals([]);
        fetchData(); // Refresh to show new cluster
      } else {
        alert('Error creating cluster: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating cluster:', error);
      alert('Error creating cluster: ' + error.message);
    } finally {
      setCreatingCluster(false);
    }
  };

  // Calculate all calendar events
  const allCalendarEvents = [
    ...data.anniversaries.map(e => ({ ...e, eventType: 'anniversary' })),
    ...data.islamicEvents.map(e => ({ ...e, eventType: 'islamic' })),
    ...data.sportsEvents.map(e => ({ ...e, eventType: 'sports' })),
    ...data.seasonalEvents.map(e => ({ ...e, eventType: 'seasonal' }))
  ];

  // Separate RSS and Evergreen signals for counts
  const rssSignals = (data.signals || []).filter(s => !s.is_evergreen);
  const evergreenSignals = (data.signals || []).filter(s => s.is_evergreen === true);

  // Count signals for each filter tab
  const filterCounts = {
    all: rssSignals.length,
    new: rssSignals.filter(s => (s.status || 'new') === 'new').length,
    liked: rssSignals.filter(s => s.status === 'liked').length,
    saved: rssSignals.filter(s => s.status === 'saved').length,
    evergreen: evergreenSignals.length,
  };

  const tabs = [
    { id: 'signals', label: 'Signals', icon: '📡', count: data.signals?.length || 0 },
    { id: 'clusters', label: 'Clusters', icon: '🎯', count: data.clusters?.length || 0 },
    { id: 'calendar', label: 'Calendar', icon: '📅', count: allCalendarEvents.length },
    { id: 'saved-pitches', label: 'Saved Pitches', icon: '📝', count: data.savedPitches?.length || 0 },
    { id: 'backlog', label: 'Backlog', icon: '💡', count: data.ideaBank?.length || 0 },
  ];

  if (!showId) {
    return (
      <LayoutWithNav>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <EmptyState
            icon="💡"
            title="No Show Selected"
            description="Select a show from the dropdown above to view ideas."
          />
        </div>
      </LayoutWithNav>
    );
  }

  if (loading) {
    return (
      <LayoutWithNav>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <span className="animate-spin text-4xl">⏳</span>
          <p className="text-gray-500 mt-4">Loading ideas...</p>
        </div>
      </LayoutWithNav>
    );
  }

  return (
    <LayoutWithNav>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ideas</h1>
            <p className="text-gray-500 mt-1">Find inspiration and manage your content ideas</p>
          </div>
          <div className="flex gap-3">
            {activeTab === 'signals' && (
              <>
                <Button 
                  variant="secondary" 
                  icon="🔄" 
                  onClick={refreshNews}
                  loading={refreshing}
                >
                  Refresh News
                </Button>
                <Button 
                  variant="secondary" 
                  icon="🔴" 
                  onClick={fetchReddit}
                  loading={redditLoading}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Reddit Ideas
                </Button>
              </>
            )}
            <Button icon="➕" onClick={() => setShowAddIdea(true)}>
              Add Idea
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            {/* Upcoming Anniversaries */}
            {data.anniversaries?.length > 0 && (
              <Card>
                <CardHeader 
                  icon="🎯" 
                  title="Upcoming Anniversaries" 
                  subtitle="Events in the next 14 days"
                />
                <div className="space-y-3">
                  {data.anniversaries.map((event, idx) => (
                    <EventCard 
                      key={idx} 
                      event={event} 
                      onGeneratePitch={() => generatePitch(event, 'event')}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* Islamic Events */}
            {data.islamicEvents?.length > 0 && (
              <Card>
                <CardHeader 
                  icon="🕌" 
                  title="Islamic Events" 
                  subtitle="Recurring religious occasions"
                />
                <div className="space-y-3">
                  {data.islamicEvents.map((event, idx) => (
                    <EventCard 
                      key={idx} 
                      event={event} 
                      variant="islamic"
                      onGeneratePitch={() => generatePitch(event, 'event')}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* Sports Events */}
            {data.sportsEvents?.length > 0 && (
              <Card>
                <CardHeader 
                  icon="⚽" 
                  title="Sports Events" 
                  subtitle="Major sporting occasions"
                />
                <div className="space-y-3">
                  {data.sportsEvents.map((event, idx) => (
                    <EventCard 
                      key={idx} 
                      event={event} 
                      variant="sports"
                      onGeneratePitch={() => generatePitch(event, 'event')}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* Seasonal Events */}
            {data.seasonalEvents?.length > 0 && (
              <Card>
                <CardHeader 
                  icon="🌤️" 
                  title="Seasonal Events" 
                  subtitle="Season-based opportunities"
                />
                <div className="space-y-3">
                  {data.seasonalEvents.map((event, idx) => (
                    <EventCard 
                      key={idx} 
                      event={event} 
                      variant="seasonal"
                      onGeneratePitch={() => generatePitch(event, 'event')}
                    />
                  ))}
                </div>
              </Card>
            )}

            {allCalendarEvents.length === 0 && (
              <EmptyState
                icon="📅"
                title="No Calendar Events"
                description="Add calendar events in Settings to see story opportunities."
              />
            )}
          </div>
        )}

        {/* Signals Tab */}
        {activeTab === 'signals' && (
          <div className="space-y-6">
            {/* Learning Stats at top */}
            <LearningStats showId={showId} onStatsUpdate={setRefreshLearningStats} />
            
              <Card>
                <CardHeader 
                  icon={signalFilter === 'evergreen' ? '🌲' : '📰'} 
                  title={signalFilter === 'evergreen' ? 'Evergreen Ideas' : 'News Signals'} 
                  subtitle={
                    signalFilter === 'evergreen' ? (
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{filterCounts.evergreen} evergreen ideas</span>
                        <span>•</span>
                        <span>From Reddit discussions</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{filterCounts.all} RSS signals</span>
                        {storyStats.uniqueStories > 0 && (
                          <>
                            <span>•</span>
                            <span>{storyStats.uniqueStories} unique stories</span>
                          </>
                        )}
                        {storyStats.bigStories > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                              </svg>
                              {storyStats.bigStories} trending
                            </span>
                          </>
                        )}
                      </div>
                    )
                  }
                  action={
                  <div className="flex items-center gap-3">
                    {newSignalsCount !== null && newSignalsCount > 0 && signalFilter !== 'evergreen' && (
                      <span className="text-sm text-green-600 font-medium">
                        ✨ {newSignalsCount} new signal{newSignalsCount !== 1 ? 's' : ''} added
                      </span>
                    )}
                  </div>
                }
              />
              
              {data.signals?.length === 0 ? (
              <EmptyState
                icon="📰"
                title="No Signals Yet"
                description="Click 'Refresh News' to fetch latest articles from your RSS sources."
                action={
                  <Button onClick={refreshNews} loading={refreshing}>
                    Refresh News
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                {/* Filter Tabs & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSignalFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        signalFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      All {filterCounts.all > 0 && `(${filterCounts.all})`}
                    </button>
                    <button
                      onClick={() => setSignalFilter('new')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        signalFilter === 'new'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      New {filterCounts.new > 0 && `(${filterCounts.new})`}
                    </button>
                    <button
                      onClick={() => setSignalFilter('liked')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        signalFilter === 'liked'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      Liked {filterCounts.liked > 0 && `(${filterCounts.liked})`}
                    </button>
                    <button
                      onClick={() => setSignalFilter('saved')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        signalFilter === 'saved'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      Saved {filterCounts.saved > 0 && `(${filterCounts.saved})`}
                    </button>
                    <button
                      onClick={() => setSignalFilter('evergreen')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        signalFilter === 'evergreen'
                          ? 'bg-green-600 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      🌲 Evergreen {filterCounts.evergreen > 0 && `(${filterCounts.evergreen})`}
                    </button>
                  </div>
                  
                  {/* Time Filter - Dropdown Menu */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Time:</span>
                    <select
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value)}
                      className="text-sm border rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-white dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="today">
                        Today ({(() => {
                          const todaySignals = filterByTime(data.signals || [], 24);
                          if (signalFilter === 'evergreen') {
                            return todaySignals.filter(s => s.is_evergreen).length;
                          }
                          return todaySignals.filter(s => !s.is_evergreen).length;
                        })()})
                      </option>
                      <option value="yesterday">
                        Yesterday ({(() => {
                          const yesterdaySignals = filterByTime(data.signals || [], 48);
                          if (signalFilter === 'evergreen') {
                            return yesterdaySignals.filter(s => s.is_evergreen).length;
                          }
                          return yesterdaySignals.filter(s => !s.is_evergreen).length;
                        })()})
                      </option>
                      <option value="week">
                        This Week ({(() => {
                          const weekSignals = filterByTime(data.signals || [], 168);
                          if (signalFilter === 'evergreen') {
                            return weekSignals.filter(s => s.is_evergreen).length;
                          }
                          return weekSignals.filter(s => !s.is_evergreen).length;
                        })()})
                      </option>
                      <option value="all">
                        All ({(() => {
                          if (signalFilter === 'evergreen') {
                            return (data.signals || []).filter(s => s.is_evergreen).length;
                          }
                          return (data.signals || []).filter(s => !s.is_evergreen).length;
                        })()})
                      </option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Sort:</span>
                    <select
                      value={signalSort}
                      onChange={(e) => setSignalSort(e.target.value)}
                      className="text-sm border rounded-lg px-2 py-1 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="date">Recent</option>
                      <option value="score">Score</option>
                      <option value="hook">Hook Potential</option>
                    </select>
                    
                    {signalFilter !== 'evergreen' ? (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        icon="🔄" 
                        onClick={refreshNews} 
                        loading={refreshing}
                      >
                        Refresh
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          icon="🔴" 
                          onClick={fetchReddit} 
                          loading={redditLoading}
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          Fetch Reddit
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          icon="📚" 
                          onClick={fetchWikipedia} 
                          loading={wikiLoading}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          Wikipedia Trends
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section Title */}
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {signalFilter === 'evergreen' ? '🌲 Evergreen Ideas' : '📰 News Signals'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {signalFilter === 'evergreen' 
                      ? 'Timeless content ideas from Reddit discussions'
                      : `${filterCounts.all} RSS signals • Showing all individually (no grouping)`
                    }
                  </p>
                </div>

                {/* Signals List - Show ALL signals (no limits) */}
                <div className="space-y-3">
                  {(() => {
                    // DEBUG: Log signal counts
                    const filteredSignalsDebug = visibleSignals.filter(s => {
                      if (s.is_evergreen) return false;
                      if (signalFilter === 'all') return true;
                      const signalStatus = (s.status || 'new').toLowerCase().trim();
                      const filterStatus = signalFilter.toLowerCase().trim();
                      return signalStatus === filterStatus;
                    });
                    
                    console.log(`📊 Signal display debug:`, {
                      totalSignals: data.signals?.length || 0,
                      visibleSignalsCount: visibleSignals.length,
                      filteredSignalsCount: filteredSignalsDebug.length,
                      timeFilter,
                      signalFilter,
                      todayCount: filterByTime(data.signals || [], 24).length,
                      visibleSignalsSample: visibleSignals.slice(0, 3).map(s => ({ id: s.id, title: s.title?.substring(0, 30) })),
                      filteredSignalsSample: filteredSignalsDebug.slice(0, 3).map(s => ({ id: s.id, title: s.title?.substring(0, 30) }))
                    });
                    // For "saved" filter, use the same mechanism as Saved Signals tab
                    if (signalFilter === 'saved') {
                      // Convert savedIdeas to signal-like objects and find matching signals
                      const savedSignalIds = new Set(
                        (data.savedIdeas || []).map(idea => {
                          // Try to parse source_id (could be number or UUID)
                          const id = idea.source_id;
                          if (typeof id === 'string' && /^\d+$/.test(id)) {
                            return parseInt(id, 10);
                          }
                          return id;
                        }).filter(Boolean)
                      );
                      
                      // Find signals that match saved ideas (RSS only, exclude evergreen)
                      const savedSignals = rssSignals.filter(signal => {
                        // Check if signal ID matches any saved idea source_id
                        return savedSignalIds.has(signal.id) || 
                               savedSignalIds.has(String(signal.id)) ||
                               (signal.status || '').toLowerCase() === 'saved';
                      });
                      
                      // If we found signals, use them; otherwise create from savedIdeas
                      const signalsToShow = savedSignals.length > 0 
                        ? savedSignals
                        : (data.savedIdeas || []).map(idea => ({
                            id: idea.source_id,
                            title: idea.title,
                            description: '',
                            url: idea.url,
                            source: idea.source_type || 'signal',
                            relevance_score: idea.score || 0,
                            score: idea.score || 0,
                            status: 'saved',
                            created_at: idea.created_at,
                            detected_at: idea.created_at
                          }));
                      
                      return signalsToShow
                        .sort((a, b) => {
                          if (signalSort === 'score') {
                            const scoreA = a.relevance_score || a.score || 0;
                            const scoreB = b.relevance_score || b.score || 0;
                            return scoreB - scoreA;
                          }
                          if (signalSort === 'hook') {
                            const hookA = typeof a.hook_potential === 'string' 
                              ? parseFloat(a.hook_potential) || 0 
                              : a.hook_potential || 0;
                            const hookB = typeof b.hook_potential === 'string' 
                              ? parseFloat(b.hook_potential) || 0 
                              : b.hook_potential || 0;
                            return hookB - hookA;
                          }
                          // Default: sort by date (most recent first)
                          const dateA = new Date(a.created_at || a.detected_at || a.updated_at || 0);
                          const dateB = new Date(b.created_at || b.detected_at || b.updated_at || 0);
                          return dateB - dateA; // Most recent first
                        })
                        .map((signal, idx) => (
                          <SignalCard 
                            key={signal.id || idx} 
                            signal={signal}
                            showId={showId}
                            onGeneratePitch={(format) => {
                              if (format === 'both') {
                                generatePitch(signal, 'news');
                              } else {
                                generatePitch({ ...signal, format }, 'news');
                              }
                            }}
                            onStatusUpdate={(signalId, newStatus) => {
                              setData(prev => ({
                                ...prev,
                                signals: prev.signals.map(s => 
                                  s.id === signalId ? { ...s, status: newStatus } : s
                                )
                              }));
                            }}
                            onRefresh={fetchData}
                            onLearningStatsUpdate={refreshLearningStats}
                          />
                        ));
                    }
                    
                    // Separate by content type first
                    if (signalFilter === 'evergreen') {
                      // Evergreen tab: Apply time filter first, then sorting
                      let filteredEvergreen = [...evergreenSignals];
                      
                      // Apply time filter to evergreen signals
                      switch (timeFilter) {
                        case 'today':
                          filteredEvergreen = filterByTime(filteredEvergreen, 24);
                          break;
                        case 'yesterday':
                          filteredEvergreen = filterByTime(filteredEvergreen, 48);
                          break;
                        case 'week':
                          filteredEvergreen = filterByTime(filteredEvergreen, 168);
                          break;
                        case 'all':
                        default:
                          // No time filter - show all
                          break;
                      }
                      
                      // Apply sorting based on signalSort state
                      filteredEvergreen = filteredEvergreen.sort((a, b) => {
                        if (signalSort === 'score') {
                          const scoreA = a.relevance_score || a.score || 0;
                          const scoreB = b.relevance_score || b.score || 0;
                          return scoreB - scoreA;
                        }
                        if (signalSort === 'hook') {
                          const hookA = typeof a.hook_potential === 'string' 
                            ? parseFloat(a.hook_potential) || 0 
                            : a.hook_potential || 0;
                          const hookB = typeof b.hook_potential === 'string' 
                            ? parseFloat(b.hook_potential) || 0 
                            : b.hook_potential || 0;
                          return hookB - hookA;
                        }
                        // Default: sort by date (most recent first)
                        const dateA = new Date(a.created_at || a.detected_at || a.updated_at || 0);
                        const dateB = new Date(b.created_at || b.detected_at || b.updated_at || 0);
                        return dateB - dateA;
                      });

                      if (filteredEvergreen.length === 0) {
                        return (
                          <EmptyState
                            icon="🌲"
                            title="No Evergreen Ideas Yet"
                            description="Discover timeless content ideas from Reddit and Wikipedia"
                            action={
                              <div className="flex gap-2">
                                <Button onClick={fetchReddit} loading={redditLoading} className="bg-orange-500 hover:bg-orange-600 text-white">
                                  🔴 Reddit Ideas
                                </Button>
                                <Button onClick={fetchWikipedia} loading={wikiLoading} className="bg-blue-500 hover:bg-blue-600 text-white">
                                  📚 Wikipedia Trends
                                </Button>
                              </div>
                            }
                          />
                        );
                      }

                      return (
                        <div className="space-y-3">
                          {filteredEvergreen.map((signal, idx) => (
                            <SignalCard 
                              key={signal.id || idx} 
                              signal={signal}
                              showId={showId}
                              onGeneratePitch={(format) => {
                                if (format === 'both') {
                                  generatePitch(signal, 'news');
                                } else {
                                  generatePitch({ ...signal, format }, 'news');
                                }
                              }}
                              onStatusUpdate={(signalId, newStatus) => {
                                setData(prev => ({
                                  ...prev,
                                  signals: prev.signals.map(s => 
                                    s.id === signalId ? { ...s, status: newStatus } : s
                                  )
                                }));
                              }}
                              onRefresh={fetchData}
                              onLearningStatsUpdate={refreshLearningStats}
                            />
                          ))}
                        </div>
                      );
                    }

                    // TEMPORARILY DISABLED: Show all signals individually (no grouping)
                    // Filter and render all signals as individual cards
                    const filteredSignals = visibleSignals.filter(s => {
                      // Exclude evergreen signals from RSS tabs
                      if (s.is_evergreen) return false;
                      
                      if (signalFilter === 'all') return true;
                      const signalStatus = (s.status || 'new').toLowerCase().trim();
                      const filterStatus = signalFilter.toLowerCase().trim();
                      return signalStatus === filterStatus;
                    });

                    console.log(`🎯 Rendering ${filteredSignals.length} signals (visibleSignals: ${visibleSignals.length}, total: ${data.signals?.length || 0})`);

                    return filteredSignals.map((signal, idx) => (
                      <SignalCard 
                        key={signal.id || idx} 
                        signal={signal}
                        showId={showId}
                        onOpenStoryModal={openStoryModal}
                        onGeneratePitch={(format) => {
                          if (format === 'both') {
                            generatePitch(signal, 'news');
                          } else {
                            generatePitch({ ...signal, format }, 'news');
                          }
                        }}
                        onStatusUpdate={(signalId, newStatus) => {
                          setData(prev => ({
                            ...prev,
                            signals: prev.signals.map(s => 
                              s.id === signalId ? { ...s, status: newStatus } : s
                            )
                          }));
                        }}
                        onRefresh={fetchData}
                        onLearningStatsUpdate={refreshLearningStats}
                      />
                    ));
                  })()}
                </div>
              </div>
            )}
          </Card>
          </div>
        )}

        {/* Clusters Tab */}
        {activeTab === 'clusters' && (
          <div className="space-y-6">
            {/* Classified Clusters Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Classified Clusters</h3>
                  <p className="text-sm text-gray-500">Signals grouped by topic</p>
                </div>
                <span className="text-sm text-gray-500">
                  {data.clusters?.filter(c => c.cluster_key !== 'uncategorized').length || 0} clusters
                </span>
              </div>
              
              {(!data.clusters || data.clusters.filter(c => c.cluster_key !== 'uncategorized').length === 0) ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl mb-2 block">🎯</span>
                  <p>No classified clusters yet</p>
                  <p className="text-sm">Review unclassified signals below to create clusters</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.clusters
                    .filter(cluster => cluster.cluster_key !== 'uncategorized')
                    .map(cluster => (
                      <ClusterCard
                        key={cluster.id}
                        cluster={cluster}
                        showId={showId}
                        onGeneratePitch={() => {
                          alert('Cluster pitch generation is coming soon!');
                        }}
                        onRefresh={fetchData}
                        unclassifiedSignals={data.unclassifiedSignals || []}
                      />
                    ))}
                </div>
              )}
            </div>

            {/* Unclassified Signals Section - Moved to bottom */}
            {data.unclassifiedSignals && data.unclassifiedSignals.length > 0 && (
              <Card>
                <CardHeader 
                  icon="📋" 
                  title="Review Unclassified Signals" 
                  subtitle={`${data.unclassifiedSignals.length} signals need classification`}
                  action={
                    <Button 
                      size="sm" 
                      icon="➕" 
                      onClick={() => setShowCreateClusterModal(true)}
                    >
                      Create New Cluster
                    </Button>
                  }
                />
                <div className="p-4">
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {data.unclassifiedSignals.map((signal, idx) => (
                      <div 
                        key={signal.id || idx}
                        className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUnclassifiedSignals.includes(signal.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUnclassifiedSignals(prev => [...prev, signal.id]);
                            } else {
                              setSelectedUnclassifiedSignals(prev => prev.filter(id => id !== signal.id));
                            }
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <a 
                            href={signal.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
                            dir="auto"
                          >
                            {signal.title}
                          </a>
                          {signal.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1" dir="auto">
                              {signal.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                            <span>{signal.source || 'News'}</span>
                            <span>•</span>
                            <span>Score: {(signal.relevance_score || signal.score || 0).toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedUnclassifiedSignals.length > 0 && (
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {selectedUnclassifiedSignals.length} signal{selectedUnclassifiedSignals.length !== 1 ? 's' : ''} selected
                      </span>
                      <Button 
                        size="sm" 
                        icon="➕" 
                        onClick={() => setShowCreateClusterModal(true)}
                        disabled={selectedUnclassifiedSignals.length === 0}
                      >
                        Create Cluster from Selected
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Saved Pitches Tab */}
        {activeTab === 'saved-pitches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Saved Pitches</h3>
                <p className="text-sm text-gray-500">AI-generated pitches you've saved</p>
              </div>
              <span className="text-sm text-gray-500">{data.savedPitches?.length || 0} saved</span>
            </div>
            
            {(!data.savedPitches || data.savedPitches.length === 0) ? (
              <div className="text-center py-12 text-gray-500">
                <span className="text-4xl mb-2 block">📝</span>
                <p>No saved pitches yet</p>
                <p className="text-sm">Generate and save pitches from signals or clusters</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.savedPitches.map(pitch => (
                  <SavedPitchCard
                    key={pitch.id}
                    pitch={pitch}
                    showId={showId}
                    onProduced={async (pitchId, signalId) => {
                      // Mark pitch as produced and update signal status
                      if (signalId) {
                        try {
                          const headers = await getAuthHeaders();
                          const res = await fetch('/api/feedback', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                              show_id: showId,
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
                            // Refresh data to show updated status
                            fetchData();
                            // Refresh learning stats
                            if (refreshLearningStats) {
                              refreshLearningStats();
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

        {/* Backlog Tab */}
        {activeTab === 'backlog' && (
          <Card>
            <CardHeader 
              icon="💡" 
              title="Idea Backlog" 
              subtitle="Your saved content ideas"
              action={
                <Button size="sm" icon="➕" onClick={() => setShowAddIdea(true)}>
                  Add Idea
                </Button>
              }
            />
            
            {data.ideaBank?.length === 0 ? (
              <EmptyState
                icon="💡"
                title="No Ideas Yet"
                description="Add ideas manually or generate them from calendar events and news."
                action={
                  <Button onClick={() => setShowAddIdea(true)} icon="➕">
                    Add First Idea
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {data.ideaBank.map((idea, idx) => (
                  <IdeaCard 
                    key={idx} 
                    idea={idea}
                    onStatusChange={(status) => updateIdeaStatus(idea.id, status)}
                  />
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Add Idea Modal */}
        <Modal 
          isOpen={showAddIdea} 
          onClose={() => setShowAddIdea(false)}
          title="Add New Idea"
        >
          <div className="space-y-4">
            <Input
              label="Title"
              value={newIdea.title}
              onChange={(e) => setNewIdea({...newIdea, title: e.target.value})}
              placeholder="Enter idea title..."
              dir="auto"
            />
            
            <Textarea
              label="Description"
              value={newIdea.description}
              onChange={(e) => setNewIdea({...newIdea, description: e.target.value})}
              placeholder="Describe the idea..."
              rows={4}
              dir="auto"
            />
            
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Source"
                value={newIdea.source}
                onChange={(e) => setNewIdea({...newIdea, source: e.target.value})}
                options={[
                  { value: 'team', label: 'Team' },
                  { value: 'audience', label: 'Audience' },
                  { value: 'research', label: 'Research' },
                  { value: 'competitor', label: 'Competitor' },
                ]}
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority: {newIdea.priority}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={newIdea.priority}
                  onChange={(e) => setNewIdea({...newIdea, priority: parseInt(e.target.value)})}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => setShowAddIdea(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={addIdea} disabled={!newIdea.title} className="flex-1">
              Add Idea
            </Button>
          </div>
        </Modal>

        {/* Create Cluster Modal */}
        <Modal 
          isOpen={showCreateClusterModal} 
          onClose={() => {
            setShowCreateClusterModal(false);
            setNewClusterName('');
            setSelectedUnclassifiedSignals([]);
          }}
          title="Create New Cluster"
        >
          <div className="space-y-4">
            <Input
              label="Cluster Name"
              value={newClusterName}
              onChange={(e) => setNewClusterName(e.target.value)}
              placeholder="Enter cluster name (e.g., 'AI Developments', 'Middle East News')"
              dir="auto"
            />
            
            {selectedUnclassifiedSignals.length > 0 && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  {selectedUnclassifiedSignals.length} signal{selectedUnclassifiedSignals.length !== 1 ? 's' : ''} will be added to this cluster
                </p>
              </div>
            )}
            
            {selectedUnclassifiedSignals.length === 0 && (
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Select signals from the unclassified list above, or create an empty cluster
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <Button 
              variant="secondary" 
              onClick={() => {
                setShowCreateClusterModal(false);
                setNewClusterName('');
                setSelectedUnclassifiedSignals([]);
              }} 
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCluster} 
              disabled={!newClusterName || creatingCluster} 
              className="flex-1"
              loading={creatingCluster}
            >
              Create Cluster
            </Button>
          </div>
        </Modal>

        {/* Pitch Modal */}
        <Modal 
          isOpen={showPitchModal} 
          onClose={() => setShowPitchModal(false)}
          title={`Generate Pitch - ${selectedItem?.title || selectedItem?.title_ar || selectedItem?.cluster_name_ar || selectedItem?.cluster_name || 'Unknown'}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Based on:</p>
              <p className="font-medium" dir="auto">
                {selectedItem?.title || selectedItem?.title_ar || selectedItem?.cluster_name_ar || selectedItem?.cluster_name || 'Unknown'}
              </p>
            </div>

            {/* Pitch Type Selector - Show before generating */}
            {!generatedPitch && !generatingPitch && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pitch Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPitchType('auto')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                      pitchType === 'auto'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🤖 Auto
                    <span className="block text-xs opacity-75 mt-1">
                      {selectedItem?.is_evergreen ? 'Analysis' : 'News'}
                    </span>
                  </button>
                  <button
                    onClick={() => setPitchType('news')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                      pitchType === 'news'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🚨 News
                    <span className="block text-xs opacity-75 mt-1">5-8 min</span>
                  </button>
                  <button
                    onClick={() => setPitchType('analysis')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                      pitchType === 'analysis'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    📊 Analysis
                    <span className="block text-xs opacity-75 mt-1">10-15 min</span>
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => generatePitch(selectedItem, selectedItem?.type || 'signal', pitchType, false)}
                    disabled={generatingPitch}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {generatingPitch ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Generating...
                      </>
                    ) : (
                      <>
                        ✨ {generatedPitch ? 'View Pitch' : 'Generate Pitch'}
                      </>
                    )}
                  </button>
                  {generatedPitch && (
                    <button
                      onClick={() => generatePitch(selectedItem, selectedItem?.type || 'signal', pitchType, true)}
                      disabled={generatingPitch}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg disabled:opacity-50"
                      title="Regenerate pitch"
                    >
                      🔄
                    </button>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Generated Pitch
                {generatedPitchType && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({generatedPitchType === 'news' ? '🚨 News' : '📊 Analysis'})
                  </span>
                )}
              </label>
              {generatingPitch ? (
                <div className="p-8 text-center bg-gray-50 rounded-lg">
                  <span className="animate-spin text-2xl">⏳</span>
                  <p className="text-gray-500 mt-2">Generating pitch...</p>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap max-h-96 overflow-y-auto" dir="auto">
                  {generatedPitch || 'No pitch generated. Select a pitch type and click "Generate Pitch" above.'}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={() => setShowPitchModal(false)} className="flex-1">
              Close
            </Button>
            <Button 
              onClick={copyPitch} 
              disabled={generatingPitch || !generatedPitch}
              className="flex-1"
              variant="outline"
            >
              {pitchCopied ? '✓ Copied!' : '📋 Copy'}
            </Button>
            <Button 
              onClick={savePitch} 
              disabled={generatingPitch || !generatedPitch || !selectedItem || savingPitch}
              className="flex-1"
              icon="💾"
            >
              {savingPitch ? 'Saving...' : '💾 Save Pitch'}
            </Button>
          </div>
        </Modal>

        {/* Story Modal */}
        <StoryModal
          isOpen={storyModal.isOpen}
          onClose={closeStoryModal}
          story={storyModal.story}
          showId={showId}
          onLike={handleLikeFromModal}
          onReject={handleRejectFromModal}
        />
      </div>
    </LayoutWithNav>
  );
}

// Event Card Component
function EventCard({ event, variant = 'anniversary', onGeneratePitch }) {
  const [expanded, setExpanded] = useState(false);
  
  const variantStyles = {
    anniversary: 'bg-yellow-50 border-yellow-200',
    islamic: 'bg-green-50 border-green-200',
    sports: 'bg-purple-50 border-purple-200',
    seasonal: 'bg-orange-50 border-orange-200'
  };

  const storyAngles = Array.isArray(event.story_angles) ? event.story_angles : [];

  return (
    <div className={`p-4 rounded-lg border ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {event.event_date && (
              <Badge variant="warning">{event.event_date}</Badge>
            )}
            {event.event_year && (
              <Badge variant="default">
                {new Date().getFullYear() - event.event_year} years ago
              </Badge>
            )}
            <Badge variant={event.importance >= 8 ? 'danger' : 'default'}>
              Importance: {event.importance}/10
            </Badge>
          </div>
          
          <h4 className="font-semibold text-gray-900" dir="auto">{event.title_ar}</h4>
          {event.title_en && (
            <p className="text-sm text-gray-500">{event.title_en}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onGeneratePitch}>
            ✨ Pitch
          </Button>
          {storyAngles.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
              {expanded ? '▲' : '▼'}
            </Button>
          )}
        </div>
      </div>

      {expanded && storyAngles.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Story Angles:</p>
          <div className="space-y-2">
            {storyAngles.map((angle, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white rounded p-2">
                <span className="text-sm" dir="auto">{angle}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Learning Stats Component
function LearningStats({ showId, onStatsUpdate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (showId) {
      fetchStats();
    }
  }, [showId]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/learning-stats?showId=${showId}`);
      const data = await res.json();
      console.log('Learning stats response:', data); // Debug log
      
      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching learning stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Expose fetchStats to parent component for real-time updates
  useEffect(() => {
    if (onStatsUpdate && typeof onStatsUpdate === 'function') {
      // Wrap in a function to ensure it's always callable
      onStatsUpdate(() => {
        fetchStats();
      });
    }
  }, [onStatsUpdate]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const acceptanceRate = stats.total > 0 
    ? (((stats.liked + stats.saved + stats.produced) / stats.total) * 100).toFixed(1) 
    : 0;
  const productionRate = stats.total > 0 
    ? ((stats.produced / stats.total) * 100).toFixed(1) 
    : 0;

  return (
    <div className="bg-white rounded-xl border p-6 mb-6">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <span>📊</span> Learning Stats
        <span className="text-sm font-normal text-gray-500">(Last 30 Days)</span>
      </h3>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-2xl font-bold text-blue-600">{stats.liked || 0}</p>
          <p className="text-sm text-blue-600">Liked</p>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <p className="text-2xl font-bold text-red-600">{stats.rejected || 0}</p>
          <p className="text-sm text-red-600">Rejected</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-600">{stats.saved || 0}</p>
          <p className="text-sm text-gray-600">Saved</p>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <p className="text-2xl font-bold text-purple-600">{stats.produced || 0}</p>
          <p className="text-sm text-purple-600">Produced</p>
        </div>
        <div className="text-center p-3 bg-gray-100 rounded-lg">
          <p className="text-2xl font-bold text-gray-700">{stats.total || 0}</p>
          <p className="text-sm text-gray-600">Total</p>
        </div>
      </div>

      {/* Rates */}
      <div className="flex gap-6 mb-4">
        <div>
          <span className="text-2xl font-bold text-green-600">{acceptanceRate}%</span>
          <span className="text-sm text-gray-500 ml-1">Acceptance Rate</span>
        </div>
        <div>
          <span className="text-2xl font-bold text-purple-600">{productionRate}%</span>
          <span className="text-sm text-gray-500 ml-1">Production Rate</span>
        </div>
      </div>

      {/* Learned Topic Preferences */}
      {stats.topicPreferences?.length > 0 && (
        <div>
          <p className="text-sm text-gray-600 mb-2">Learned Topic Preferences</p>
          <div className="flex flex-wrap gap-2">
            {stats.topicPreferences.map((topic, idx) => (
              <span
                key={idx}
                className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${
                  topic.weight > 1.2 
                    ? 'bg-green-100 text-green-700' 
                    : topic.weight < 0.8 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}
                dir="auto"
              >
                {topic.name}
                <span className="text-xs opacity-70">
                  {topic.weight > 1 ? '↑' : topic.weight < 1 ? '↓' : '→'} {topic.weight.toFixed(2)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Rejection reasons
const REJECTION_REASONS = [
  { id: 'not_relevant', label: 'Not relevant to channel', icon: '❌' },
  { id: 'bad_source', label: 'Bad source quality', icon: '📰' },
  { id: 'bad_timing', label: 'Bad timing', icon: '⏰' },
  { id: 'low_interest', label: 'Low expected audience interest', icon: '📉' }
];

// Signal Card Component - Clean version with per-card enrichment
function SignalCard({ signal, onStatusChange, onGeneratePitch, showId, onStatusUpdate, onOpenStoryModal, onRefresh, onLearningStatsUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [localSignal, setLocalSignal] = useState(signal);
  const [actionLoading, setActionLoading] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Sync localSignal when signal prop changes
  useEffect(() => {
    setLocalSignal(signal);
  }, [signal]);

  // Helper to get auth headers for API requests
  const getAuthHeaders = async (additionalHeaders = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-500';
    return 'text-gray-500';
  };

  // Parse values
  const scoreNum = localSignal.relevance_score || localSignal.score || 0;
  const hookNum = typeof localSignal.hook_potential === 'string' 
    ? parseFloat(localSignal.hook_potential) || 0 
    : localSignal.hook_potential || 0;

  // Rich data removed - will be re-added when connected to real data sources

  // Use the OLD feedback API with toggle functionality
  const handleFeedback = async (action, rejectionReason = null) => {
    // Check if this is an undo action (clicking the same action again)
    // Normalize status values for comparison - handle null/undefined
    const currentStatus = (localSignal.status || 'new').trim().toLowerCase();
    const actionLower = action.trim().toLowerCase();
    const isUndo = currentStatus === actionLower;
    
    const finalAction = isUndo ? 'undo' : action;
    const finalStatus = isUndo ? 'new' : action;
    
    console.log('🔄 Feedback action:', {
      action,
      currentStatus: localSignal.status,
      normalizedCurrent: currentStatus,
      normalizedAction: actionLower,
      isUndo,
      finalAction,
      finalStatus,
      signalId: localSignal.id
    });
    
    setActionLoading(action);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          show_id: showId,
          recommendation_id: localSignal.id,
          topic: localSignal.title,
          action: finalAction, // 'liked', 'rejected', 'saved', 'produced', or 'undo'
          original_action: isUndo ? action : null, // Original action being undone
          original_score: scoreNum,
          rejection_reason: rejectionReason,
          evidence_summary: {
            score: scoreNum,
            hook_potential: hookNum,
            matched_topic: localSignal.matched_topic,
            url: localSignal.url,
            source: localSignal.source || 'signal'
          }
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Use verified status from response if available (for undo actions)
        const verifiedStatus = data.newStatus || finalStatus;
        console.log('✅ Feedback success, updating status to:', verifiedStatus);
        if (data.verified === false && isUndo) {
          console.warn('⚠️ Warning: Undo may not have updated status correctly. Response status:', data.newStatus);
        }
        
        // Update local state IMMEDIATELY to show feedback was recorded
        setLocalSignal(prev => {
          const updated = { ...prev, status: verifiedStatus };
          console.log('📝 Local signal updated:', { old: prev.status, new: verifiedStatus });
          return updated;
        });
        
        // Update parent signals array immediately so filter works
        if (onStatusUpdate) {
          console.log('📤 Calling onStatusUpdate with:', { signalId: localSignal.id, status: verifiedStatus });
          onStatusUpdate(localSignal.id, verifiedStatus);
        }
        
        // Update learning stats in real-time (no page refresh needed)
        if (onLearningStatsUpdate && typeof onLearningStatsUpdate === 'function') {
          console.log('📊 Refreshing learning stats in real-time...');
          setTimeout(() => {
            try {
              onLearningStatsUpdate();
            } catch (statsError) {
              console.error('⚠️ Error updating learning stats:', statsError);
            }
          }, 300); // Small delay to ensure backend update completes
        } else if (onLearningStatsUpdate === null || onLearningStatsUpdate === undefined) {
          // LearningStats component hasn't mounted yet - that's okay, just skip
          console.log('ℹ️ Learning stats refresh not available yet (component not mounted)');
        } else {
          console.warn('⚠️ onLearningStatsUpdate is not a function:', typeof onLearningStatsUpdate);
        }
        
        // Only refresh full page if there's a state mismatch that needs to be resolved
        if (isUndo && data.verified === false && onRefresh) {
          console.log('🔄 Undo verification failed - refreshing to sync state');
          setTimeout(() => {
            onRefresh();
          }, 1000);
        }
        
        // Close reject modal if open
        if (action === 'rejected') {
          setShowRejectModal(false);
        }
      } else {
        console.error('❌ Feedback error:', data);
        console.error('❌ Full error details:', {
          error: data.error,
          details: data.details,
          errorCode: data.errorCode,
          errorDetails: data.errorDetails,
          hint: data.hint,
          signalId: data.signalId,
          currentStatus: data.currentStatus,
          expectedStatus: data.expectedStatus
        });
        
        // Show detailed error message
        const errorMsg = data.details || data.error || 'Unknown error';
        alert(`Failed to update: ${errorMsg}${data.hint ? `\n\nHint: ${data.hint}` : ''}`);
      }
    } catch (error) {
      console.error('❌ Feedback error:', error);
      alert('Error: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/enrich-signal', {
        method: 'POST',
        headers,
        body: JSON.stringify({ signalId: signal.id, showId })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Enrichment failed: ${res.statusText}`);
      }
      
      const data = await res.json();
      
      if (data.success && data.signal) {
        // Preserve competitors and other fields that aren't in the database signal
        setLocalSignal(prev => ({
          ...prev,
          ...data.signal,
          // Preserve fields that come from /api/signals but not from enrich-signal
          competitors: prev.competitors || data.signal.competitors,
          competitor_evidence: prev.competitor_evidence || data.signal.competitor_evidence,
          competitor_count: prev.competitor_count || data.signal.competitor_count,
          competitor_boost: prev.competitor_boost || data.signal.competitor_boost,
          multi_signal_scoring: prev.multi_signal_scoring || data.signal.multi_signal_scoring,
          urgency_tier: prev.urgency_tier || data.signal.urgency_tier,
        }));
        setExpanded(true); // Auto-expand to show new data
        console.log('✅ Signal enriched successfully');
      } else {
        throw new Error(data.error || 'Enrichment failed');
      }
    } catch (error) {
      console.error('Enrich error:', error);
      alert(`Failed to enrich signal: ${error.message}`);
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className={`bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all ${
      localSignal.status === 'rejected' ? 'opacity-50' : ''
    }`}>
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
                <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-full flex items-center gap-1 flex-shrink-0">
                  🔥 Trending
                </span>
              )}
            </div>

            {/* Reddit Metadata */}
            {localSignal.is_evergreen && localSignal.source?.startsWith('r/') && (
              <div className="flex items-center gap-2 mt-2 mb-2 text-xs text-orange-600">
                <span>🔴 {localSignal.source}</span>
                {localSignal.reddit_score && (
                  <span>⬆️ {localSignal.reddit_score.toLocaleString()}</span>
                )}
                {localSignal.reddit_comments && (
                  <span>💬 {localSignal.reddit_comments.toLocaleString()}</span>
                )}
                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                  Evergreen
                </span>
              </div>
            )}

            {/* Wikipedia Metadata */}
            {localSignal.source_type === 'wikipedia' && (
              <div className="flex items-center gap-2 mt-2 mb-2 text-xs text-blue-600">
                <span>📚 Wikipedia</span>
                {localSignal.wikipedia_views && (
                  <span>👁️ {localSignal.wikipedia_views.toLocaleString()} views</span>
                )}
                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                  Trending
                </span>
              </div>
            )}

            {/* TEMPORARILY DISABLED: Story Badge - No grouping, show all signals individually */}
            {/* Story grouping is disabled - all signals are shown individually */}

            {/* Description */}
            {localSignal.description && (
              <p className="text-sm text-gray-500 line-clamp-1 mb-2" dir="auto">
                {localSignal.description}
              </p>
            )}

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
              
              {/* Format suggestion badge */}
              {localSignal.suggested_format && (
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  localSignal.suggested_format === 'long' 
                    ? 'bg-purple-100 text-purple-700' 
                    : localSignal.suggested_format === 'short'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {localSignal.suggested_format === 'long' ? '🎬 Long' : 
                   localSignal.suggested_format === 'short' ? '📱 Short' : '🔄 Both'}
                </span>
              )}
            </div>

            {/* Score Row */}
            <div className="flex items-center gap-6 mt-3">
              <div>
                <span className="text-sm text-gray-500">Score: </span>
                <span className={`text-xl font-bold ${getScoreColor(scoreNum)}`}>
                  {typeof scoreNum === 'number' ? scoreNum.toFixed(1) : scoreNum}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Hook Potential: </span>
                <span className={`text-xl font-bold ${getScoreColor(hookNum * 10)}`}>
                  {typeof hookNum === 'number' ? hookNum.toFixed(1) : hookNum}
                </span>
              </div>
              
              {/* Audience Demand Score */}
              {localSignal.audience_demand_score > 0 && (
                <div>
                  <span className="text-sm text-gray-500">Demand: </span>
                  <span className="text-xl font-bold text-blue-600">
                    +{localSignal.audience_demand_score}
                  </span>
                </div>
              )}
              
              {/* Competitor Boost Score */}
              {localSignal.competitor_boost > 0 && (
                <div>
                  <span className="text-sm text-gray-500">Competitor: </span>
                  <span className="text-xl font-bold text-orange-600">
                    +{localSignal.competitor_boost}
                  </span>
                </div>
              )}
              
              {/* Status Badge */}
              {localSignal.status && localSignal.status !== 'new' && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  localSignal.status === 'liked' ? 'bg-blue-100 text-blue-700' :
                  localSignal.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  localSignal.status === 'saved' ? 'bg-gray-200 text-gray-700' :
                  localSignal.status === 'produced' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {localSignal.status}
                </span>
              )}
            </div>

            {/* Competitor Breakouts Section - Show first, separate from audience demand */}
            {localSignal.competitor_evidence && Array.isArray(localSignal.competitor_evidence) && localSignal.competitor_evidence.length > 0 && (
              <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                    Competitor Breakouts
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-800 text-orange-600 dark:text-orange-300 rounded-full">
                    +{localSignal.competitor_boost || 0} boost
                  </span>
                </div>
                
                <div className="space-y-2">
                  {localSignal.competitor_evidence.map((ev, idx) => (
                    <div key={idx} className="text-sm">
                      {/* Main evidence line */}
                      <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                        <span>{ev.icon}</span>
                        <span className="flex-1">{ev.text}</span>
                        {ev.competitorType === 'direct' && (
                          <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                            Direct
                          </span>
                        )}
                      </div>
                      
                      {/* Verification details */}
                      <div className="mt-1 pl-6 text-xs text-gray-500 dark:text-gray-400 space-y-1">
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

            {/* Audience Demand Section - Only show non-competitor evidence */}
            {localSignal.audience_evidence && Array.isArray(localSignal.audience_evidence) && 
             localSignal.audience_evidence.filter(e => e.type !== 'competitor_breakout').length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Audience Demand: {localSignal.demand_summary || 'High Demand'}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-full">
                    +{localSignal.audience_demand_score || 0} boost
                  </span>
                </div>
                
                <div className="space-y-1.5">
                  {localSignal.audience_evidence
                    .filter(ev => ev.type !== 'competitor_breakout')
                    .map((ev, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300"
                      >
                        <span className="flex-shrink-0">{ev.icon}</span>
                        <span className="flex-1" dir="auto">{ev.text}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Action Button */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => onGeneratePitch('long')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
            >
              ✨ Generate Pitch
            </button>
            
            {/* Enrich Button - Calculate score and hook potential */}
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="px-4 py-2 border border-purple-300 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-50 flex items-center gap-1 disabled:opacity-50"
            >
              {enriching ? (
                <>
                  <span className="animate-spin">⏳</span> Enriching...
                </>
              ) : (
                <>
                  🧠 Enrich with AI
                </>
              )}
            </button>
            
            {/* External Link */}
            <a
              href={localSignal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1"
            >
              🔗 Source
            </a>
          </div>
        </div>
      </div>


      {/* Action Footer - Using OLD feedback API */}
      <div className="px-4 py-3 bg-gray-50 border-t flex items-center gap-3">
        <button
          onClick={() => handleFeedback('liked')}
          disabled={actionLoading === 'liked'}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            localSignal.status === 'liked' 
              ? 'bg-blue-100 text-blue-700' 
              : 'text-blue-600 hover:bg-blue-50'
          } ${actionLoading === 'liked' ? 'opacity-50' : ''}`}
        >
          {actionLoading === 'liked' ? '⏳' : '👍'} {localSignal.status === 'liked' ? 'Liked ✓' : 'Like'}
        </button>
        <button
          onClick={() => {
            // If already rejected, undo it directly without opening modal
            if (localSignal.status === 'rejected') {
              handleFeedback('rejected');
            } else {
              // Only open modal for new rejections
              setShowRejectModal(true);
            }
          }}
          disabled={actionLoading === 'rejected'}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            localSignal.status === 'rejected' 
              ? 'bg-red-100 text-red-700' 
              : 'text-red-600 hover:bg-red-50'
          } ${actionLoading === 'rejected' ? 'opacity-50' : ''}`}
        >
          {actionLoading === 'rejected' ? '⏳' : '👎'} {localSignal.status === 'rejected' ? 'Rejected ✓' : 'Reject'}
        </button>
        <button
          onClick={() => handleFeedback('saved')}
          disabled={actionLoading === 'saved'}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            localSignal.status === 'saved' 
              ? 'bg-gray-200 text-gray-700' 
              : 'text-gray-600 hover:bg-gray-100'
          } ${actionLoading === 'saved' ? 'opacity-50' : ''}`}
        >
          {actionLoading === 'saved' ? '⏳' : '🔖'} {localSignal.status === 'saved' ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">
              Why is this not relevant?
            </h3>
            
            <div className="space-y-2">
              {REJECTION_REASONS.map(reason => (
                <button
                  key={reason.id}
                  onClick={() => handleFeedback('rejected', reason.id)}
                  disabled={actionLoading === 'rejected'}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <span>{reason.icon}</span>
                  <span>{reason.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowRejectModal(false)}
              className="mt-4 w-full py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Idea Card Component
function IdeaCard({ idea, onStatusChange }) {
  const statusOptions = [
    { value: 'new', label: 'New', variant: 'default' },
    { value: 'researching', label: 'Researching', variant: 'warning' },
    { value: 'approved', label: 'Approved', variant: 'success' },
    { value: 'rejected', label: 'Rejected', variant: 'danger' },
    { value: 'produced', label: 'Produced', variant: 'purple' },
  ];

  const currentStatus = statusOptions.find(s => s.value === idea.status) || statusOptions[0];

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
            <Badge variant="purple">Priority: {idea.priority}/10</Badge>
            {idea.source && (
              <Badge variant="default">{idea.source}</Badge>
            )}
          </div>
          
          <h4 className="font-medium text-gray-900" dir="auto">{idea.title}</h4>
          
          {idea.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2" dir="auto">
              {idea.description}
            </p>
          )}
        </div>
        
        <select
          value={idea.status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="text-sm border rounded-lg px-2 py-1"
        >
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Enhanced Cluster Card Component
function ClusterCard({ cluster, showId, onGeneratePitch, onRefresh, unclassifiedSignals = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedIdea, setGeneratedIdea] = useState(null);
  const [showDNA, setShowDNA] = useState(false);
  const [showManageSignals, setShowManageSignals] = useState(false);
  const [selectedSignalsToAdd, setSelectedSignalsToAdd] = useState([]);

  // Helper to get auth headers for API requests
  const getAuthHeaders = async (additionalHeaders = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };

  // Get cluster name (handle both English and Arabic)
  const clusterName = cluster.cluster_name_ar || cluster.cluster_name || cluster.name || cluster.cluster_key;
  const itemCount = cluster.items?.length || cluster.signal_count || 0;
  
  // DNA data from cluster
  const dnaData = cluster.dna || {};
  const hasDNA = dnaData.status || dnaData.success_rate !== undefined || dnaData.avg_views !== undefined;

  const handleGenerateIdea = async () => {
    setGenerating(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/generate-video-idea', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          showId,
          cluster: {
            name: clusterName,
            items: cluster.items?.slice(0, 5).map(i => i.title) || [],
            signalCount: cluster.signal_count,
            intelCount: cluster.intel_count
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedIdea(data.idea);
      }
    } catch (error) {
      console.error('Error generating idea:', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      {/* Cluster Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔥</span>
            <div>
              <h3 className="font-bold text-lg text-gray-900" dir="auto">
                {clusterName}
              </h3>
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                <span>📰 {cluster.signal_count || 0} signals</span>
                {cluster.intel_count > 0 && (
                  <span>🧠 {cluster.intel_count} intel</span>
                )}
                <span>📊 Score: {cluster.trend_score || 0}</span>
              </div>
            </div>
          </div>

          {/* Format Badge */}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            cluster.suggested_format === 'short' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-purple-100 text-purple-700'
          }`}>
            {cluster.suggested_format === 'short' ? '📱 Short' : '🎬 Long (10+ min)'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {expanded ? '▲ Hide items' : `▼ Show ${itemCount} items`}
          </button>
          
          <button
            onClick={() => setShowManageSignals(!showManageSignals)}
            className="text-sm text-green-600 hover:text-green-800 flex items-center gap-1"
          >
            {showManageSignals ? '▲ Hide' : '➕'} Manage Signals
          </button>
          
          <button
            onClick={() => setShowDNA(!showDNA)}
            className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
          >
            {showDNA ? '▲ Hide DNA' : '▼ Show DNA Insights'}
          </button>
        </div>
      </div>

      {/* Manage Signals Panel */}
      {showManageSignals && (
        <div className="border-t bg-green-50 p-4">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>➕</span>
            Add Signals to Cluster
          </h4>
          
          {unclassifiedSignals && unclassifiedSignals.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
              {unclassifiedSignals.map((signal) => (
                <div key={signal.id} className="flex items-center gap-2 p-2 bg-white rounded border">
                  <input
                    type="checkbox"
                    checked={selectedSignalsToAdd.includes(signal.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSignalsToAdd(prev => [...prev, signal.id]);
                      } else {
                        setSelectedSignalsToAdd(prev => prev.filter(id => id !== signal.id));
                      }
                    }}
                  />
                  <span className="text-sm flex-1 truncate" dir="auto">{signal.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-3">No unclassified signals available</p>
          )}
          
          {selectedSignalsToAdd.length > 0 && (
            <button
              onClick={async () => {
                try {
                  const headers = await getAuthHeaders();
                  const res = await fetch('/api/clusters/update-items', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      clusterId: cluster.id,
                      signalIds: selectedSignalsToAdd,
                      action: 'add'
                    })
                  });
                  const data = await res.json();
                  if (data.success && onRefresh) {
                    setSelectedSignalsToAdd([]);
                    setShowManageSignals(false);
                    onRefresh();
                  } else {
                    alert('Failed to add signals: ' + (data.error || 'Unknown error'));
                  }
                } catch (error) {
                  console.error('Error adding signals:', error);
                  alert('Failed to add signals');
                }
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              Add {selectedSignalsToAdd.length} Signal{selectedSignalsToAdd.length !== 1 ? 's' : ''} to Cluster
            </button>
          )}
        </div>
      )}

      {/* DNA Insights Panel */}
      {showDNA && (
        <div className="border-t bg-gradient-to-r from-purple-50 to-blue-50 p-4">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>🧬</span>
            DNA Insights
          </h4>
          
          {hasDNA ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* DNA Status */}
                {dnaData.status && (
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-xs text-gray-500 mb-1">DNA Status</p>
                    <p className={`font-semibold ${
                      dnaData.status === 'strong' ? 'text-green-600' :
                      dnaData.status === 'moderate' ? 'text-yellow-600' :
                      dnaData.status === 'weak' ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                      {dnaData.status === 'strong' ? '✅ Strong Match' :
                       dnaData.status === 'moderate' ? '⚠️ Moderate Match' :
                       dnaData.status === 'weak' ? '❌ Weak Match' :
                       dnaData.status}
                    </p>
                  </div>
                )}
                
                {/* Success Rate */}
                {dnaData.success_rate !== undefined && (
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-xs text-gray-500 mb-1">Success Rate</p>
                    <p className={`text-2xl font-bold ${
                      dnaData.success_rate >= 70 ? 'text-green-600' :
                      dnaData.success_rate >= 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {dnaData.success_rate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {dnaData.success_rate >= 70 ? 'High success' :
                       dnaData.success_rate >= 50 ? 'Moderate success' :
                       'Low success'}
                    </p>
                  </div>
                )}
                
                {/* Average Views */}
                {dnaData.avg_views !== undefined && (
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-xs text-gray-500 mb-1">Avg Views</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {typeof dnaData.avg_views === 'number' 
                        ? dnaData.avg_views.toLocaleString() 
                        : dnaData.avg_views}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Historical average
                    </p>
                  </div>
                )}
              </div>
              
              {/* DNA Summary */}
              <div className="mt-4 bg-white rounded-lg p-3 border">
                <p className="text-sm text-gray-700">
                  {dnaData.status === 'strong' && dnaData.success_rate >= 70 ? (
                    <span className="text-green-700">
                      ✅ This cluster aligns well with your channel DNA. High success rate suggests this topic resonates with your audience.
                    </span>
                  ) : dnaData.status === 'moderate' || (dnaData.success_rate >= 50 && dnaData.success_rate < 70) ? (
                    <span className="text-yellow-700">
                      ⚠️ Moderate DNA match. Consider refining the angle or format to better align with your channel's strengths.
                    </span>
                  ) : dnaData.status === 'weak' || dnaData.success_rate < 50 ? (
                    <span className="text-red-700">
                      ❌ Weak DNA match. This topic may not align well with your channel's proven success patterns. Consider a different angle or skip.
                    </span>
                  ) : (
                    <span className="text-gray-600">
                      📊 DNA analysis available. Review the metrics above to assess alignment with your channel.
                    </span>
                  )}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">No DNA data available for this cluster yet.</p>
          )}
        </div>
      )}

      {/* Expanded Items List */}
      {expanded && cluster.items && cluster.items.length > 0 && (
        <div className="border-t bg-gray-50 max-h-80 overflow-y-auto">
          {cluster.items.map((item, idx) => (
            <div 
              key={item.id || idx} 
              className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-gray-100"
            >
              <span className="text-gray-400 font-mono text-sm w-6">{idx + 1}</span>
              
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                item.source_type === 'intel' 
                  ? 'bg-purple-100' 
                  : 'bg-blue-100'
              }`}>
                {item.source_type === 'intel' ? '🧠' : '📰'}
              </span>
              
              <div className="flex-1 min-w-0">
                <a 
                  href={item.url || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-800 hover:text-blue-600 block truncate font-medium"
                  dir="auto"
                >
                  {item.title}
                </a>
                <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                  <span>Relevance: {(item.relevance_score || 0).toFixed(1)}</span>
                  <span>•</span>
                  <span className="capitalize">{item.source_type || 'signal'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (confirm('Remove this signal from the cluster?')) {
                      try {
                        // Get signal ID - could be signal_id or recommendation_id
                        const signalId = item.signal_id || item.recommendation_id;
                        if (!signalId) {
                          alert('Cannot remove: Signal ID not found');
                          return;
                        }
                        
                        const headers = await getAuthHeaders();
                        const res = await fetch('/api/clusters/update-items', {
                          method: 'POST',
                          headers,
                          body: JSON.stringify({
                            clusterId: cluster.id,
                            signalIds: [signalId],
                            action: 'remove'
                          })
                        });
                        const data = await res.json();
                        if (data.success && onRefresh) {
                          onRefresh();
                        } else {
                          alert('Failed to remove signal: ' + (data.error || 'Unknown error'));
                        }
                      } catch (error) {
                        console.error('Error removing signal:', error);
                        alert('Failed to remove signal: ' + error.message);
                      }
                    }
                  }}
                  className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded hover:bg-red-50"
                  title="Remove from cluster"
                >
                  ✕
                </button>
                <a 
                  href={item.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                >
                  ↗️
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generated Idea Display */}
      {generatedIdea && (
        <div className="border-t p-4 bg-gradient-to-r from-blue-50 to-purple-50">
          {/* Suggested Title */}
          <div className="bg-blue-100 rounded-lg p-3 mb-3">
            <p className="text-sm text-blue-600 font-medium mb-1">🎬 Suggested Title:</p>
            <p className="text-blue-800 font-semibold" dir="auto">
              {generatedIdea.title}
            </p>
          </div>

          {/* Hook */}
          {generatedIdea.hook && (
            <div className="bg-orange-50 rounded-lg p-3 mb-3">
              <p className="text-sm text-orange-600 font-medium mb-1">🎣 Hook:</p>
              <p className="text-orange-800" dir="auto">
                {generatedIdea.hook}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigator.clipboard.writeText(generatedIdea.title + '\n\n' + (generatedIdea.hook || ''))}
              className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              📋 Copy
            </button>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
              📝 Save Idea
            </button>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="border-t p-4 bg-gray-50 flex items-center gap-3">
        <button
          onClick={handleGenerateIdea}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-2"
        >
          {generating ? (
            <>
              <span className="animate-spin">⏳</span>
              Generating...
            </>
          ) : (
            <>
              ✨ Generate Video Idea
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Saved Idea Card Component
function SavedIdeaCard({ idea, onDelete, onStatusChange }) {
  return (
    <div className="bg-white border rounded-xl p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <a 
            href={idea.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 hover:text-blue-600 hover:underline block"
            dir="auto"
          >
            {idea.title}
          </a>
          
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
            <span>Score: {idea.score || 0}</span>
            <span>•</span>
            <span>{idea.source_type}</span>
            <span>•</span>
            <span>{new Date(idea.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStatusChange('produced')}
            className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200"
          >
            🎬 Mark Produced
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm"
          >
            🗑️
          </button>
        </div>
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

export default function IdeasPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <span className="animate-spin text-4xl">⏳</span>
      </div>
    }>
      <IdeasContent />
    </Suspense>
  );
}

