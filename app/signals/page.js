'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getUserShows } from '@/lib/userShows'
import Navigation from '@/app/components/Navigation'
import BehaviorInsightPanel from '@/app/components/signals/BehaviorInsightPanel'
import { analyzeAudienceBehavior, formatBehaviorForUI } from '@/lib/intelligence/audienceBehavior'
import FeedbackButtons from '@/components/FeedbackButtons'
import LearningStats from '@/components/LearningStats'

export default function SignalsFeed() {
  const [signals, setSignals] = useState([])
  const [filteredSignals, setFilteredSignals] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [generatingBrief, setGeneratingBrief] = useState(null)
  const [shows, setShows] = useState([])
  const [selectedShow, setSelectedShow] = useState(null)
  const [updatingRss, setUpdatingRss] = useState(false)
  const [rssUpdateResult, setRssUpdateResult] = useState(null)
  const [continuousMode, setContinuousMode] = useState(false)
  const [activeTab, setActiveTab] = useState('signals') // 'signals', 'personas', 'clusters', or 'pitches'
  const [savedPitches, setSavedPitches] = useState([])
  const [personas, setPersonas] = useState([])
  const [personaPitches, setPersonaPitches] = useState({})
  const [servingStatus, setServingStatus] = useState(null)
  const [loadingPersonas, setLoadingPersonas] = useState(false)
  const [clusters, setClusters] = useState([])
  const [loadingClusters, setLoadingClusters] = useState(false)
  const [selectedCluster, setSelectedCluster] = useState(null)
  const [showAnglesModal, setShowAnglesModal] = useState(false)
  const [showPitchModal, setShowPitchModal] = useState(false)
  const [generatedPitch, setGeneratedPitch] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [pitchId, setPitchId] = useState(null)
  const [isSaved, setIsSaved] = useState(false)
  const [isCached, setIsCached] = useState(false)
  const [expandedClusters, setExpandedClusters] = useState(new Set())
  const [clusterInsights, setClusterInsights] = useState({})
  const [loadingInsights, setLoadingInsights] = useState({})
  const [selectedSignal, setSelectedSignal] = useState(null)
  const [seenSignals, setSeenSignals] = useState([])

  useEffect(() => {
    fetchShows()
  }, [])

  useEffect(() => {
    if (selectedShow) {
      fetchSignals()
    }
  }, [selectedShow])

  useEffect(() => {
    if (activeTab === 'personas') {
      fetchPersonas()
    } else if (activeTab === 'clusters') {
      fetchClusters()
    } else if (activeTab === 'pitches') {
      fetchSavedPitches()
    }
  }, [activeTab, selectedShow])

  // Load seen signals from localStorage on mount and when showId changes
  useEffect(() => {
    if (selectedShow && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`seenSignals_${selectedShow}`);
      if (saved) {
        try {
          setSeenSignals(JSON.parse(saved));
        } catch (e) {
          console.error('Error loading seen signals:', e);
          setSeenSignals([]);
        }
      } else {
        setSeenSignals([]);
      }
    }
  }, [selectedShow]);

  // Save to localStorage when seenSignals changes
  useEffect(() => {
    if (selectedShow && typeof window !== 'undefined' && seenSignals.length > 0) {
      try {
        localStorage.setItem(`seenSignals_${selectedShow}`, JSON.stringify(seenSignals));
      } catch (e) {
        console.error('Error saving seen signals:', e);
      }
    }
  }, [seenSignals, selectedShow])

  useEffect(() => {
    filterSignals()
  }, [signals, statusFilter])

  async function fetchShows() {
    if (!isSupabaseConfigured) {
      setShows([
        { id: '1', name: 'Show 1', channel_id: 'channel1' },
        { id: '2', name: 'Show 2', channel_id: 'channel2' },
      ])
      if (!selectedShow) setSelectedShow('1')
      setLoading(false)
      return
    }

    try {
      console.log('Fetching user shows...')
      
      // Get only shows that belong to the current user
      const { shows, error } = await getUserShows()

      if (error) {
        console.error('❌ Error fetching user shows:', error)
        setShows([])
        setLoading(false)
        return
      }

      console.log('✅ Fetched shows:', shows?.length || 0, 'shows')
      console.log('Shows data:', shows)
      
      if (!shows || shows.length === 0) {
        console.warn('⚠️  No shows found for this user!')
        console.warn('  1. Check if user_shows table exists')
        console.warn('  2. Link your user to a show: INSERT INTO user_shows (user_id, show_id, role) VALUES (...)')
      }
      
      setShows(shows || [])
      
      // If no show selected but user has shows, select the first one
      if (!selectedShow && shows && shows.length > 0) {
        const firstShowId = shows[0].id
        console.log('Setting selected show to:', firstShowId, '(first show)')
        setSelectedShow(firstShowId)
      }
      
      // If selected show is not in user's shows, select first one
      if (selectedShow && shows && !shows.find(s => s.id === selectedShow)) {
        if (shows.length > 0) {
          console.log('Selected show not accessible, switching to:', shows[0].id)
          setSelectedShow(shows[0].id)
        } else {
          setSelectedShow(null)
        }
      }
    } catch (error) {
      console.error('Error fetching shows:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      setShows([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchSignals() {
    if (!selectedShow) {
      setSignals([])
      setLoading(false)
      return
    }

    if (!isSupabaseConfigured) {
      // Mock data for demo
      const mockSignals = [
        {
          id: 1,
          title: 'Audience asking about inflation impact on salaries',
          score: 8.5,
          hook_potential: '9.0',
          status: 'new',
          type: 'audience',
          show_id: selectedShow,
          raw_data: { sourceName: 'Comments' },
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          title: 'RSS: Fed raises interest rates to 5.5%',
          score: 7.9,
          hook_potential: '8.5',
          status: 'reviewed',
          type: 'news',
          show_id: selectedShow,
          raw_data: { sourceName: 'RSS Feed' },
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ]
      setSignals(mockSignals)
      setLoading(false)
      return
    }

    try {
      console.log('Fetching signals for show_id:', selectedShow, 'type:', typeof selectedShow)
      
      // Use API route that applies learning and filters rejected signals
      let data = []
      try {
        // Get auth headers
        const { data: { session } } = await supabase.auth.getSession();
        const headers = {
          'Content-Type': 'application/json',
        };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        
        const response = await fetch(`/api/signals?show_id=${selectedShow}&limit=50`, { headers })
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`)
        }
        
        const result = await response.json()
        
        if (result.success && Array.isArray(result.signals)) {
          data = result.signals
          console.log('✅ Fetched signals with multi-signal scoring:', data.length, 'signals')
          console.log('📊 Stats:', result.stats)
          console.log(`🔍 Breakdown: ${result.stats?.total || 0} total → ${result.stats?.visible || 0} visible (${result.stats?.by_tier?.today || 0} today, ${result.stats?.by_tier?.week || 0} week, ${result.stats?.by_tier?.backlog || 0} backlog)`)
          
          // Log detailed stats for debugging
          if (result.stats) {
            console.log('📊 Signals Page Stats:', {
              rawRssItems: result.stats.total,
              uniqueStories: result.stats.unique_stories,
              afterStatusProcessing: result.stats.after_status_processing,
              afterRejectionFilter: result.stats.after_rejection_filter,
              afterScoring: result.stats.after_scoring,
              afterValidityFilter: result.stats.after_validity_filter,
              finalDisplayed: result.stats.visible,
              byTier: result.stats.by_tier,
              limitApplied: result.stats.limit_applied,
              perTierLimit: result.stats.per_tier_limit
            });
          }
        } else if (result.error) {
          console.error('❌ API error:', result.error)
          throw new Error(result.error)
        } else {
          console.warn('⚠️ API returned unexpected format:', result)
          throw new Error('API returned unexpected format')
        }
      } catch (apiError) {
        // Fallback: If API fails, show error instead of using direct query
        // The direct query bypasses multi-signal scoring and will show different signals than Studio
        console.error('❌ API route failed:', apiError.message)
        console.error('⚠️ The /signals page requires the API endpoint to match Studio results.')
        console.error('⚠️ Direct Supabase queries bypass multi-signal scoring and tier limits.')
        console.error('⚠️ This usually means an authentication or server error. Check the server logs.')
        
        // Show error to user instead of incorrect data
        setSignals([])
        setLoading(false)
        alert('❌ Failed to load signals. Please check your authentication and try again. The signals page requires the API endpoint to match Studio results.')
        return
      }

      console.log('✅ Fetched signals:', data?.length || 0, 'signals')
      
      // Debug: Check if any signals have behavior data
      if (data && data.length > 0) {
        const signalsWithBehavior = data.filter(s => 
          s.behaviorUI || 
          s.raw_data?.behaviorUI || 
          s.raw_data?.behavior ||
          s.raw_data?.recommendation?.behaviorUI
        );
        console.log(`📊 Signals with behavior data: ${signalsWithBehavior.length}/${data.length}`);
        
        if (signalsWithBehavior.length > 0) {
          console.log('✅ Sample signal WITH behavior:', {
            id: signalsWithBehavior[0].id,
            title: signalsWithBehavior[0].title?.substring(0, 40),
            behaviorPaths: {
              topLevel: !!signalsWithBehavior[0].behaviorUI,
              rawDataBehaviorUI: !!signalsWithBehavior[0].raw_data?.behaviorUI,
              rawDataBehavior: !!signalsWithBehavior[0].raw_data?.behavior,
              recommendationBehaviorUI: !!signalsWithBehavior[0].raw_data?.recommendation?.behaviorUI
            }
          });
        } else {
          console.warn('⚠️ No signals have behavior data! Check if RSS processor is generating it.');
          if (data[0]) {
            console.log('📋 Sample signal structure:', {
              id: data[0].id,
              title: data[0].title?.substring(0, 40),
              hasRawData: !!data[0].raw_data,
              rawDataKeys: data[0].raw_data ? Object.keys(data[0].raw_data) : [],
              hasRecommendation: !!data[0].raw_data?.recommendation,
              recommendationKeys: data[0].raw_data?.recommendation ? Object.keys(data[0].raw_data.recommendation) : []
            });
          }
        }
      }
      
      console.log('Selected show_id:', selectedShow, 'type:', typeof selectedShow)
      
      if (data && data.length > 0) {
        console.log('📊 Signal statuses:', data.map(s => ({ 
          id: s.id?.substring(0, 8), 
          title: s.title?.substring(0, 30), 
          status: s.status,
          show_id: s.show_id
        })))
        
        // Debug: Check if timing_format exists in first signal
        const firstSignal = data[0];
        if (firstSignal.raw_data?.recommendation?.timing_format) {
          console.log('✅ Timing format found in signals:', firstSignal.raw_data.recommendation.timing_format);
        } else {
          console.log('⚠️ No timing_format in signals. Run RSS update to generate decisions.');
          console.log('Sample signal raw_data:', firstSignal.raw_data);
        }
      }
      
      if (data && data.length === 0) {
        console.warn('⚠️  No signals found for show_id:', selectedShow)
        console.warn('Debugging steps:')
        console.warn('  1. Check if signals exist: SELECT COUNT(*) FROM signals')
        console.warn('  2. Check show_id match: SELECT * FROM signals WHERE show_id = \'' + selectedShow + '\'')
        console.warn('  3. Check RLS policies: SELECT * FROM pg_policies WHERE tablename = \'signals\'')
        console.warn('  4. Try fetching all signals (no filter):')
        
        // Try fetching all signals without filter to test RLS
        const { data: allSignals, error: allError } = await supabase
          .from('signals')
          .select('id, show_id, title')
          .limit(5)
        console.warn('   All signals (no filter):', { count: allSignals?.length, error: allError, data: allSignals })
      }
      
      setSignals(data || [])
    } catch (error) {
      console.error('❌ Error fetching signals:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      setSignals([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchPersonas() {
    setLoadingPersonas(true)
    try {
      // Fetch personas list
      const personasRes = await fetch('/api/personas?action=list')
      const personasData = await personasRes.json()
      
      if (personasData.success) {
        setPersonas(Object.values(personasData.personas))
      }
      
      // Fetch serving status
      const statusRes = await fetch('/api/personas?action=serving-status')
      const statusData = await statusRes.json()
      setServingStatus(statusData)
      
      // Fetch pitches for each persona
      const pitchReportRes = await fetch('/api/personas?action=pitch-report')
      const pitchReport = await pitchReportRes.json()
      
      if (pitchReport.byPersona) {
        setPersonaPitches(pitchReport.byPersona)
      }
    } catch (error) {
      console.error('Error fetching personas:', error)
    } finally {
      setLoadingPersonas(false)
    }
  }

  async function fetchClusters() {
    if (!selectedShow) {
      setClusters([])
      return
    }
    
    setLoadingClusters(true)
    try {
      // Get auth headers
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const res = await fetch(`/api/clusters?showId=${selectedShow}`, { headers })
      const data = await res.json()
      if (data.success) {
        setClusters(data.clusters || [])
        console.log('✅ Fetched clusters:', data.clusters?.length || 0)
      } else {
        console.error('❌ Error fetching clusters:', data.error)
        setClusters([])
      }
    } catch (error) {
      console.error('❌ Error fetching clusters:', error)
      setClusters([])
    } finally {
      setLoadingClusters(false)
    }
  }

  // Fetch saved pitches
  async function fetchSavedPitches() {
    if (!selectedShow) return
    try {
      // Get auth headers
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const res = await fetch(`/api/generate-pitch?showId=${selectedShow}&status=saved`, { headers })
      const data = await res.json()
      if (data.success) {
        setSavedPitches(data.pitches || [])
      }
    } catch (error) {
      console.error('Error fetching saved pitches:', error)
    }
  }

  // Fetch DNA insights for a cluster
  const fetchClusterInsights = async (cluster) => {
    const clusterId = cluster.id;
    if (clusterInsights[clusterId]) return; // Already fetched
    
    setLoadingInsights(prev => ({ ...prev, [clusterId]: true }));
    
    try {
      // Get the cluster name/topic for analysis
      const topicText = cluster.cluster_name_ar || cluster.cluster_name;
      
      const [scoreRes, hookRes, thumbRes] = await Promise.all([
        fetch('/api/score-topic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showId: selectedShow, topic: topicText })
        }),
        fetch('/api/smart-hook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showId: selectedShow, topic: topicText })
        }),
        fetch('/api/thumbnail-advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showId: selectedShow, topic: topicText })
        })
      ]);
      
      const [scoreData, hookData, thumbData] = await Promise.all([
        scoreRes.json(),
        hookRes.json(),
        thumbRes.json()
      ]);
      
      setClusterInsights(prev => ({
        ...prev,
        [clusterId]: {
          score: scoreData,
          hook: hookData,
          thumbnail: thumbData
        }
      }));
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoadingInsights(prev => ({ ...prev, [clusterId]: false }));
    }
  };

  // Toggle cluster expansion
  const toggleClusterExpansion = (clusterId) => {
    setExpandedClusters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clusterId)) {
        newSet.delete(clusterId);
      } else {
        newSet.add(clusterId);
        // Fetch insights when expanding
        const cluster = clusters.find(c => c.id === clusterId);
        if (cluster) {
          fetchClusterInsights(cluster);
        }
      }
      return newSet;
    });
  };

  // Mark signal as seen
  const markAsSeen = (signalId) => {
    setSeenSignals(prev => {
      if (prev.includes(signalId)) return prev;
      return [...prev, signalId];
    });
  };

  // Check if signal is new - must be:
  // 1. Created within last 24 hours
  // 2. Not yet seen/interacted with by user
  const isNewSignal = (signal) => {
    // Check if signal was created in last 24 hours
    const createdAt = signal.created_at || signal.detected_at;
    if (!createdAt) return false;
    
    const createdAtDate = new Date(createdAt);
    const now = new Date();
    const hoursSinceCreated = (now - createdAtDate) / (1000 * 60 * 60);
    const isRecent = hoursSinceCreated < 24 && hoursSinceCreated >= 0;
    
    // Check if user has seen this signal
    const notSeen = !seenSignals.includes(signal.id);
    
    // Only show NEW if both conditions are true
    return isRecent && notSeen;
  };

  // Generate pitch for individual signal - uses DNA insights
  const generateSignalPitch = async (signal) => {
    markAsSeen(signal.id);
    setSelectedSignal(signal);
    setSelectedCluster(null);
    setShowPitchModal(true);
    setIsGenerating(true);
    setGeneratedPitch('');
    setIsSaved(false);
    setIsCached(false);
    setPitchId(null);
    
    try {
      // First, get DNA insights for the signal topic
      const [scoreRes, hookRes, thumbRes] = await Promise.all([
        fetch('/api/score-topic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showId: selectedShow, topic: signal.title })
        }),
        fetch('/api/smart-hook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showId: selectedShow, topic: signal.title })
        }),
        fetch('/api/thumbnail-advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showId: selectedShow, topic: signal.title })
        })
      ]);
      
      const [scoreData, hookData, thumbData] = await Promise.all([
        scoreRes.json(),
        hookRes.json(),
        thumbRes.json()
      ]);
      
      const dnaInsights = {
        score: scoreData.score,
        hookExample: hookData.similarSuccessfulHooks?.[0]?.hook,
        hookViews: hookData.similarSuccessfulHooks?.[0]?.views,
        thumbnailElements: thumbData.recommendedElements,
        tips: hookData.tips
      };
      
      // Now generate pitch with DNA insights
      const response = await fetch('/api/generate-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId: selectedShow,
          signal: {
            id: signal.id,
            title: signal.title,
            source: signal.source_name || getSourceFromSignal(signal),
            summary: signal.description || signal.ai_summary
          },
          dnaInsights,
          source_type: 'signal'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setGeneratedPitch(data.pitch || 'Failed to generate pitch');
        setPitchId(data.pitch_id);
        setIsCached(data.cached || false);
        if (data.cached) {
          console.log('♻️ Using cached pitch');
        }
      } else {
        setGeneratedPitch('Error: ' + (data.error || 'Failed to generate pitch'));
      }
    } catch (error) {
      console.error('Error generating signal pitch:', error);
      setGeneratedPitch('Error generating pitch: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate Video Idea function
  async function generateVideoIdea(cluster) {
    const insights = clusterInsights[cluster.id];
    
    setSelectedCluster(cluster)
    setShowPitchModal(true)
    setIsGenerating(true)
    setGeneratedPitch('')
    setIsSaved(false)
    setIsCached(false)
    setPitchId(null)
    
    try {
      const response = await fetch('/api/generate-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId: selectedShow,
          cluster: {
            id: cluster.id,
            name: cluster.cluster_name_ar || cluster.cluster_name,
            signals: cluster.items?.map(i => ({
              title: i.title,
              relevance: i.relevance_score
            })) || []
          },
          // Pass DNA insights to improve pitch generation
          dnaInsights: insights ? {
            score: insights.score?.score,
            hookExample: insights.hook?.similarSuccessfulHooks?.[0]?.hook,
            hookViews: insights.hook?.similarSuccessfulHooks?.[0]?.views,
            thumbnailElements: insights.thumbnail?.recommendedElements,
            tips: insights.hook?.tips
          } : null,
          source_type: 'cluster'
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setGeneratedPitch(data.pitch || 'Failed to generate pitch')
        setPitchId(data.pitch_id)
        setIsCached(data.cached || false)
        if (data.cached) {
          console.log('♻️ Using cached pitch')
        }
      } else {
        setGeneratedPitch('Error: ' + (data.error || 'Failed to generate pitch'))
      }
    } catch (error) {
      console.error('Error generating pitch:', error)
      setGeneratedPitch('Error generating pitch: ' + error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  // Save pitch function
  async function savePitch() {
    if (!pitchId) return;
    
    try {
      const response = await fetch('/api/generate-pitch/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitchId, is_saved: true })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setIsSaved(true)
          fetchSavedPitches() // Refresh the list
        }
      }
    } catch (error) {
      console.error('Error saving pitch:', error)
      alert('Failed to save pitch: ' + error.message)
    }
  }

  // Toggle favorite
  const toggleFavorite = async (pitchId, isFavorite) => {
    try {
      await fetch('/api/generate-pitch/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitchId, is_favorite: isFavorite })
      })
      fetchSavedPitches()
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  // Mark as used
  const markAsUsed = async (pitchId) => {
    try {
      await fetch('/api/generate-pitch/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitchId, status: 'used', used_at: new Date().toISOString() })
      })
      fetchSavedPitches()
    } catch (error) {
      console.error('Error marking as used:', error)
    }
  }

  // Delete pitch
  const deletePitch = async (pitchId) => {
    if (!confirm('Are you sure you want to delete this pitch?')) return
    
    try {
      await fetch('/api/generate-pitch/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitchId, status: 'archived', is_saved: false })
      })
      fetchSavedPitches()
    } catch (error) {
      console.error('Error deleting pitch:', error)
    }
  }

  // View All Angles function
  function viewAllAngles(cluster) {
    setSelectedCluster(cluster)
    setShowAnglesModal(true)
  }

  // Create cluster from pending signals
  async function createClusterFromPending(clusterName, pendingCluster) {
    if (!clusterName || !pendingCluster || !selectedShow) {
      alert('Please provide a cluster name');
      return;
    }

    try {
      const response = await fetch('/api/clusters/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showId: selectedShow,
          clusterName: clusterName,
          signalIds: pendingCluster.items?.map(i => i.signal_id).filter(Boolean) || []
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`✅ Cluster "${clusterName}" created successfully!`);
        await fetchClusters(); // Refresh clusters
      } else {
        alert('Error: ' + (data.error || 'Failed to create cluster'));
      }
    } catch (error) {
      console.error('Error creating cluster:', error);
      alert('Error creating cluster: ' + error.message);
    }
  }

  function filterSignals() {
    console.log('🔍 Filtering signals:', {
      totalSignals: signals.length,
      statusFilter: statusFilter,
      signalStatuses: signals.map(s => s.status)
    })
    
    if (statusFilter === 'all') {
      setFilteredSignals(signals)
      console.log('✅ Showing all signals:', signals.length)
    } else {
      const filtered = signals.filter(s => s.status === statusFilter)
      setFilteredSignals(filtered)
      console.log(`✅ Filtered by status "${statusFilter}":`, filtered.length, 'signals')
      console.log('   Available statuses:', [...new Set(signals.map(s => s.status))])
    }
  }

  async function updateSignalStatus(signalId, newStatus) {
    if (!isSupabaseConfigured) {
      // Update local state for mock data
      setSignals(prev => prev.map(s => 
        s.id === signalId ? { ...s, status: newStatus } : s
      ))
      return
    }

    try {
      // Find the signal to get persona and title
      const signal = signals.find(s => s.id === signalId)
      
      // Try multiple possible persona field names
      const personaId = signal?.primary_persona || 
                       signal?.persona_id || 
                       signal?.approved_persona ||
                       signal?.raw_data?.primaryPersona ||
                       signal?.raw_data?.persona ||
                       null
      
      const topicTitle = signal?.title || signal?.topic || 'Unknown'

      // If approving, call the approve API to track persona
      if (newStatus === 'approved') {
        let finalPersonaId = personaId
        
        // If no persona found, show a prompt to select one
        if (!finalPersonaId) {
          const selectedPersona = prompt(
            'No persona found for this signal. Please enter persona ID:\n\n' +
            'Options: geopolitics, investor, tech_future, egyptian_business, gulf_oil, curious_learner, employee, student_entrepreneur'
          )
          
          if (selectedPersona && selectedPersona.trim()) {
            finalPersonaId = selectedPersona.trim()
          }
        }
        
        // Track persona if we have one
        if (finalPersonaId) {
          try {
            const approveRes = await fetch('/api/signals/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                signalId,
                personaId: finalPersonaId,
                topicTitle
              })
            })

            const approveData = await approveRes.json()
            if (!approveData.success) {
              console.warn('Persona tracking failed:', approveData.error)
              alert('Warning: Persona tracking failed: ' + (approveData.error || 'Unknown error'))
            } else {
              console.log('✅ Persona tracked:', approveData.message)
            }
          } catch (trackError) {
            console.warn('Error tracking persona:', trackError)
            alert('Warning: Persona tracking failed: ' + trackError.message)
          }
        } else {
          console.warn('No persona provided, signal approved but not tracked')
        }
        try {
          const approveRes = await fetch('/api/signals/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              signalId,
              personaId,
              topicTitle
            })
          })

          const approveData = await approveRes.json()
          if (!approveData.success) {
            console.warn('Persona tracking failed:', approveData.error)
            // Continue with status update even if tracking fails
          } else {
            console.log('✅ Persona tracked:', approveData.message)
          }
        } catch (trackError) {
          console.warn('Error tracking persona:', trackError)
          // Continue with status update even if tracking fails
        }
      }

      // Update signal status in database
      const { error } = await supabase
        .from('signals')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', signalId)

      if (error) throw error

      // Refresh signals
      fetchSignals()
      
      // Show success message
      if (newStatus === 'approved') {
        alert(`✅ Signal approved${personaId ? ` for ${personaId}` : ''}`)
      }
    } catch (error) {
      console.error('Error updating signal status:', error)
      alert('Failed to update signal status: ' + error.message)
    }
  }

  async function generateBrief(signalId, format = 'long_form') {
    setGeneratingBrief(signalId)
    
    try {
      // Find the signal data
      const signal = signals.find(s => s.id === signalId)
      if (!signal) {
        alert('Signal not found')
        return
      }

      // Convert format: 'long_form' -> 'long', 'short_form' -> 'short'
      const pitchType = format === 'long_form' ? 'long' : 'short'

      // Call the new on-demand pitch generation API
      const response = await fetch(`/api/signals/${signalId}/generate-pitch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: pitchType
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate pitch')
      }

      const data = await response.json()
      
      if (!data.success || !data.pitch) {
        throw new Error('No pitch generated')
      }

      // Show pitch in a modal/popup
      const pitch = data.pitch
      const pitchText = `
📺 ${pitchType === 'long' ? 'Long-Form' : 'Short'} Pitch Generated

## Title
${pitch.title || 'N/A'}

## Hook
${pitch.hook || 'N/A'}

## Angle
${pitch.angle || 'N/A'}

## Main Points
${pitch.mainPoints?.map((p, i) => `${i + 1}. ${p}`).join('\n') || 'N/A'}

## CTA
${pitch.cta || 'N/A'}
      `.trim()

      // Show in alert for now (can be replaced with a modal later)
      alert(pitchText)
      
      // Optionally refresh signals to show updated pitch data
      fetchSignals()

    } catch (error) {
      console.error('Error generating pitch:', error)
      alert(`Error: ${error.message || 'Failed to generate pitch'}`)
    } finally {
      setGeneratingBrief(null)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'reviewed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSourceFromSignal = (signal) => {
    // Extract source from raw_data.sourceName if available
    if (signal.raw_data?.sourceName) {
      return signal.raw_data.sourceName
    }
    // Fallback to type-based source
    if (signal.type === 'news' || signal.type === 'trend') {
      return 'RSS Feed'
    }
    return 'Unknown'
  }

  const getSourceIcon = (source) => {
    const sourceLower = source?.toLowerCase() || ''
    if (sourceLower.includes('rss') || sourceLower.includes('feed') || sourceLower.includes('bloomberg') || sourceLower.includes('ft') || sourceLower.includes('reuters')) {
      return '📰'
    }
    if (sourceLower.includes('comment')) {
      return '💬'
    }
    if (sourceLower.includes('competitor')) {
      return '⚔️'
    }
    if (sourceLower.includes('performance')) {
      return '📊'
    }
    if (sourceLower.includes('trend')) {
      return '📈'
    }
    return '🔔'
  }

  async function updateRssFeeds() {
    if (!selectedShow) {
      alert('Please select a show first')
      return
    }

    setUpdatingRss(true)
    setRssUpdateResult(null)

    try {
      // Use selective settings for 300+ feeds
      // Only HIGH priority, min score 70, fewer items per feed
      // TESTING: Lower thresholds to allow signals through
      // TESTING: Use very lenient settings to debug
      // priority=LOW (allows all), min_score=10 (allows 1.0+ scores)
      const response = await fetch(`/api/rss-processor?show_id=${selectedShow}&priority=MEDIUM&min_score=30&items_per_feed=5&max_feeds=50`)
      const result = await response.json()

      if (result.error) {
        setRssUpdateResult({
          success: false,
          message: result.error,
          details: result
        })
        alert(`RSS Update Failed: ${result.error}`)
      } else {
        const selectivity = result.selectivity || {}
        setRssUpdateResult({
          success: true,
          message: `Successfully processed ${result.processed || 0} items from ${result.feeds_processed || 0} feeds, saved ${result.saved || 0} signals`,
          details: result
        })
        
        // Show success message with selectivity info
        let message = `✅ RSS Update Complete!\n\n` +
          `📊 Processed: ${result.processed || 0} items from ${result.feeds_processed || 0} feeds\n` +
          `📰 Feeds: ${result.feeds_processed || 0} processed, ${result.feeds_skipped || 0} skipped (of ${result.feeds_total || 0} total)\n` +
          `💾 Saved: ${result.saved || 0} signals\n` +
          `🎯 Selectivity: ${selectivity.priority_filter || 'HIGH'} priority, min score: ${selectivity.min_score || 75}\n` +
          `⚙️  Settings: ${selectivity.items_per_feed || 3} items/feed, ${selectivity.feeds_selected || 30} feeds selected\n` +
          (result.scoreStats ? `📈 Score Range: ${result.scoreStats.min} - ${result.scoreStats.max} (avg: ${result.scoreStats.avg})` : '')
        
        // Add debug info if 0 signals saved
        if (result.saved === 0 && result.debug) {
          message += `\n\n⚠️ DEBUG INFO:\n`
          message += `   Items received: ${result.debug.totalItemsReceived || 0}\n`
          message += `   Feeds processed: ${result.debug.feedsProcessed || 0}\n`
          message += `   Settings: priority=${result.debug.settings?.priorityFilter}, minScore=${result.debug.settings?.minScore}\n`
          if (result.debug.warning) {
            message += `\n   ${result.debug.warning}\n`
            message += `   Check SERVER CONSOLE (terminal) for detailed logs:\n`
            message += `   - Look for: 📥 RSS items received\n`
            message += `   - Look for: 📋 After filters\n`
            message += `   - Look for: 📊 After scoring\n`
            message += `   - Look for: 💾 Attempting to save\n`
            message += `   - Look for: ❌ SAVE ERROR\n`
          }
        }
        
        alert(message)
        
        // Also log to console for debugging
        if (result.debug) {
          console.log('🔍 RSS Update Debug Info:', result.debug)
        }

        // Refresh signals after update
        await fetchSignals()
      }
    } catch (error) {
      console.error('Error updating RSS feeds:', error)
      setRssUpdateResult({
        success: false,
        message: error.message || 'Failed to update RSS feeds',
        details: null
      })
      alert(`RSS Update Failed: ${error.message}`)
    } finally {
      setUpdatingRss(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">RSS Signals</h1>
            <p className="text-gray-600">Latest news and trends from your configured sources</p>
          </div>
          {/* Story Ideas Button */}
          <Link
            href={`/story-ideas?showId=${selectedShow || "00000000-0000-0000-0000-000000000004"}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            📚 Story Ideas
          </Link>
        </div>

        {/* Learning Stats */}
        <div className="mb-6">
          <LearningStats showId={selectedShow || "00000000-0000-0000-0000-000000000004"} />
        </div>

        {/* Show Selector and RSS Update Button */}
        {shows.length > 0 && (
          <div className="mb-6 flex items-end gap-4">
            <div className="flex-1">
              <label htmlFor="show-select" className="block text-sm font-medium text-gray-700 mb-2">
                Select Show
              </label>
              <select
                id="show-select"
                value={selectedShow || ''}
                onChange={(e) => setSelectedShow(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {shows.map((show) => (
                  <option key={show.id} value={show.id}>
                    {show.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={updateRssFeeds}
                disabled={updatingRss || !selectedShow}
                className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  updatingRss || !selectedShow
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {updatingRss ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Update RSS Feeds</span>
                  </>
                )}
              </button>
              <button
                onClick={async () => {
                  if (!selectedShow) {
                    alert('Please select a show first')
                    return
                  }
                  if (continuousMode) {
                    alert('Continuous mode is already running. Check server logs for status.')
                    return
                  }
                  const confirmed = confirm('Start continuous RSS processing?\n\nThis will process feeds every 60 minutes in the background.\n\nCheck server logs for progress.')
                  if (!confirmed) return
                  
                  try {
                    const response = await fetch('/api/rss-processor/continuous', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        show_id: selectedShow,
                        interval_minutes: 60,
                        max_feeds: 50,
                        items_per_feed: 5,
                        priority: 'HIGH',
                        min_score: 70
                      })
                    })
                    const result = await response.json()
                    if (result.success) {
                      setContinuousMode(true)
                      alert(`✅ Continuous processing started!\n\nConfig:\n- Interval: 60 minutes\n- Max feeds: 50\n- Items/feed: 5\n- Priority: HIGH only\n- Min score: 70\n\nCheck server logs for progress.`)
                    } else {
                      alert(`Failed: ${result.error}`)
                    }
                  } catch (error) {
                    alert(`Error: ${error.message}`)
                  }
                }}
                disabled={!selectedShow || continuousMode}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${
                  !selectedShow || continuousMode
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {continuousMode ? (
                  <>
                    <span>⏸️</span>
                    <span>Continuous Running</span>
                  </>
                ) : (
                  <>
                    <span>♾️</span>
                    <span>Start Continuous</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* RSS Update Result */}
        {rssUpdateResult && (
          <div className={`mb-6 p-4 rounded-lg ${
            rssUpdateResult.success 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {rssUpdateResult.success ? '✅ RSS Update Successful' : '❌ RSS Update Failed'}
                </p>
                <p className="text-sm mt-1">{rssUpdateResult.message}</p>
                {rssUpdateResult.details && rssUpdateResult.details.scoreStats && (
                  <p className="text-xs mt-2 opacity-75">
                    Score Range: {rssUpdateResult.details.scoreStats.min} - {rssUpdateResult.details.scoreStats.max} 
                    (avg: {rssUpdateResult.details.scoreStats.avg})
                  </p>
                )}
              </div>
              <button
                onClick={() => setRssUpdateResult(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('signals')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'signals'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              📰 Signals ({signals.length})
            </button>
            <button
              onClick={() => setActiveTab('personas')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'personas'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              👥 Personas ({personas.length})
            </button>
            <button
              onClick={() => setActiveTab('clusters')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'clusters'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              📦 Clusters ({clusters.filter(c => (c.signal_count || 0) > 0 && !c.is_hidden && c.cluster_key !== 'uncategorized').length})
            </button>
            <button
              onClick={() => setActiveTab('pitches')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'pitches'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              💡 Saved Ideas ({savedPitches.length})
            </button>
          </div>
        </div>

        {/* Personas Tab */}
        {activeTab === 'personas' && (
          <div className="space-y-6">
            {loadingPersonas ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading personas...</p>
              </div>
            ) : (
              <>
                {/* Serving Status Summary */}
                {servingStatus && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">📊 Serving Status - This Week</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(servingStatus.personas || {}).map(([id, status]) => (
                        <div key={id} className="border rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{status.icon}</span>
                            <span className="font-medium">{status.name}</span>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">
                              {status.served} / {status.goal}
                            </span>
                            <span className={`text-sm font-medium ${
                              status.status === 'COMPLETE' ? 'text-green-600' :
                              status.status === 'IN_PROGRESS' ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {status.percentage}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                status.status === 'COMPLETE' ? 'bg-green-500' :
                                status.status === 'IN_PROGRESS' ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(100, status.percentage)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Personas with Suggested Topics */}
                <div className="space-y-6">
                  {personas.map((persona) => {
                    const pitches = personaPitches[persona.id] || {}
                    const serving = servingStatus?.personas?.[persona.id]
                    
                    return (
                      <div key={persona.id} className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{persona.icon}</span>
                            <div>
                              <h3 className="text-xl font-semibold">{persona.name}</h3>
                              <p className="text-sm text-gray-600">
                                {persona.demographics?.percentage}% of audience
                              </p>
                            </div>
                          </div>
                          {serving && (
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                              serving.status === 'COMPLETE' ? 'bg-green-100 text-green-800' :
                              serving.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {serving.served}/{serving.goal} this week
                            </div>
                          )}
                        </div>

                        {/* Key Interests */}
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Key Interests:</h4>
                          <div className="flex flex-wrap gap-2">
                            {persona.interests?.primary?.slice(0, 5).map((interest, idx) => (
                              <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                                {interest}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Suggested Topics from Competitors */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">
                            💡 Suggested Topics (from competitors)
                          </h4>
                          {pitches.topPitches && pitches.topPitches.length > 0 ? (
                            <div className="space-y-3">
                              {pitches.topPitches.map((pitch, idx) => (
                                <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded-r">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-900 mb-1">
                                        {pitch.originalTitle}
                                      </p>
                                      <p className="text-xs text-gray-600 mb-2">
                                        Source: {pitch.source} ({pitch.sourceType === 'direct' ? '🎯 Direct Competitor' : '🔗 Adjacent Content'})
                                      </p>
                                      <div className="mt-2">
                                        <p className="text-xs font-medium text-gray-700 mb-1">Our Angle:</p>
                                        <p className="text-sm text-blue-700">
                                          {pitch.pitch?.suggestedAngle || 'No angle suggested'}
                                        </p>
                                      </div>
                                      {pitch.pitch?.differentiator && (
                                        <p className="text-xs text-gray-600 mt-1">
                                          Differentiator: {pitch.pitch.differentiator}
                                        </p>
                                      )}
                                    </div>
                                    {pitch.videoUrl && (
                                      <a
                                        href={pitch.videoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-4 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                      >
                                        Watch
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">
                              No topic suggestions available yet. Check back after competitor analysis.
                            </p>
                          )}
                        </div>

                        {/* Served Topics (placeholder for future) */}
                        <div className="mt-6 pt-6 border-t">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">
                            📺 Topics Served (coming soon)
                          </h4>
                          <p className="text-xs text-gray-500 italic">
                            Track which topics were created for this persona will appear here.
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Clusters Tab */}
        {activeTab === 'clusters' && (
          <div className="space-y-6">
            {loadingClusters ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading clusters...</p>
              </div>
            ) : clusters.filter(c => (c.signal_count || 0) > 0).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-4">No clusters found yet.</p>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/clusters', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ showId: selectedShow })
                      })
                      const data = await res.json()
                      if (data.success) {
                        await fetchClusters()
                        alert(`✅ Clustering complete! ${data.clustered || 0} signals clustered.`)
                      }
                    } catch (error) {
                      console.error('Error triggering clustering:', error)
                      alert('Failed to trigger clustering')
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  🔄 Run Clustering
                </button>
              </div>
            ) : (
              <>
                {/* Main Clusters */}
                {clusters
                  .filter(c => (c.signal_count || 0) > 0 && !c.is_hidden && c.cluster_key !== 'uncategorized')
                  .sort((a, b) => (b.trend_score || 0) - (a.trend_score || 0))
                  .map(cluster => (
                  <div key={cluster.id} className="bg-white rounded-xl shadow-sm border p-6">
                    {/* Cluster Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {cluster.is_trending && '🔥 '}
                          {cluster.cluster_name_ar || cluster.cluster_name}
                        </h3>
                        <div className="flex gap-3 mt-1 text-sm text-gray-500">
                          <span>📰 {cluster.signal_count || 0} signals</span>
                          <span>🧠 {cluster.intel_count || 0} intel</span>
                          <span>📊 Score: {cluster.trend_score || 0}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          cluster.suggested_format === 'long' 
                            ? 'bg-purple-100 text-purple-700' 
                            : cluster.suggested_format === 'medium'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {cluster.suggested_format === 'long' ? '🎬 Long (10+ min)' : 
                           cluster.suggested_format === 'medium' ? '📹 Medium (3-10 min)' : 
                           '📱 Short (< 3 min)'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Cluster Items */}
                    <div className="space-y-2">
                      {cluster.items
                        ?.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
                        .slice(0, 5)
                        .map((item, idx) => (
                          <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <span className="text-gray-400 font-mono text-sm w-6">{idx + 1}</span>
                            
                            {/* Source type badge */}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              item.source_type === 'intel' 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {item.source_type === 'intel' ? '🧠' : '📰'}
                            </span>
                            
                            <div className="flex-1 min-w-0">
                              <a 
                                href={item.url || '#'} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-gray-800 hover:text-blue-600 hover:underline block truncate"
                              >
                                {item.title}
                              </a>
                              <div className="flex gap-2 text-xs text-gray-500 mt-1">
                                <span>Relevance: {(item.relevance_score || 0).toFixed(1)}</span>
                                <span className="capitalize">• {item.source_type}</span>
                                {item.source_name && <span>• {item.source_name}</span>}
                              </div>
                            </div>
                            <a 
                              href={item.url || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-blue-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        ))}
                      {cluster.items?.length > 5 && (
                        <p className="text-sm text-gray-500 text-center">
                          +{cluster.items.length - 5} more {cluster.items.length - 5 === 1 ? 'item' : 'items'}
                        </p>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-4 pt-4 border-t">
                      <button 
                        onClick={() => toggleClusterExpansion(cluster.id)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                          expandedClusters.has(cluster.id)
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {expandedClusters.has(cluster.id) ? '▼' : '▶'} 
                        {expandedClusters.has(cluster.id) ? 'Hide DNA Insights' : 'Show DNA Insights'}
                      </button>
                      <button 
                        onClick={() => generateVideoIdea(cluster)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                      >
                        ✨ Generate Video Idea
                      </button>
                      <button 
                        onClick={() => viewAllAngles(cluster)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                      >
                        📋 View All Angles
                      </button>
                    </div>

                    {/* DNA Insights Section */}
                    {expandedClusters.has(cluster.id) && (
                      <div className="mt-4 pt-4 border-t">
                        {/* DNA Insights Header */}
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-lg">🧬</span>
                          <h4 className="font-semibold text-gray-900">DNA Insights</h4>
                          {loadingInsights[cluster.id] && (
                            <span className="text-sm text-gray-500 animate-pulse">Loading...</span>
                          )}
                        </div>
                        
                        {clusterInsights[cluster.id] && (
                          <>
                            <div className="grid md:grid-cols-3 gap-4 mb-4">
                              {/* Score Card */}
                              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-blue-800">📊 Topic Score</span>
                                  <span className={`text-2xl font-bold ${
                                    clusterInsights[cluster.id].score.score >= 70 ? 'text-green-600' :
                                    clusterInsights[cluster.id].score.score >= 50 ? 'text-blue-600' :
                                    'text-orange-600'
                                  }`}>
                                    {clusterInsights[cluster.id].score.score}
                                  </span>
                                </div>
                                <p className="text-sm text-blue-700">{clusterInsights[cluster.id].score.rating}</p>
                                {clusterInsights[cluster.id].score.reasons?.slice(0, 2).map((reason, idx) => (
                                  <p key={idx} className="text-xs text-blue-600 mt-1 text-right" dir="rtl">{reason}</p>
                                ))}
                              </div>
                              
                              {/* Hook Card */}
                              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-medium text-green-800">🎣 Hook Strategy</span>
                                </div>
                                {clusterInsights[cluster.id].hook.similarSuccessfulHooks?.[0] ? (
                                  <div>
                                    <p className="text-xs text-green-600 mb-1">Similar successful hook:</p>
                                    <p className="text-sm text-green-800 text-right line-clamp-3" dir="rtl">
                                      "{clusterInsights[cluster.id].hook.similarSuccessfulHooks[0].hook?.substring(0, 100)}..."
                                    </p>
                                    <p className="text-xs text-green-600 mt-1">
                                      👁️ {clusterInsights[cluster.id].hook.similarSuccessfulHooks[0].views?.toLocaleString()} views
                                    </p>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-xs text-green-600 mb-1">Recommended pattern:</p>
                                    <p className="text-sm text-green-800">
                                      {clusterInsights[cluster.id].hook.recommendedPatterns?.[0]?.pattern || 'Use numbers + scenario'}
                                    </p>
                                  </div>
                                )}
                              </div>
                              
                              {/* Thumbnail Card */}
                              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-medium text-purple-800">🖼️ Thumbnail</span>
                                </div>
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {clusterInsights[cluster.id].thumbnail.recommendedElements?.slice(0, 4).map((elem, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-purple-200 text-purple-800 rounded text-xs">
                                      {elem}
                                    </span>
                                  ))}
                                </div>
                                <p className="text-xs text-purple-600">
                                  🏆 Best combo: {clusterInsights[cluster.id].thumbnail.topPerformingCombos?.[0]?.elements?.join(' + ')}
                                </p>
                              </div>
                            </div>
                            
                            {/* Quick Tips */}
                            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                              <p className="text-sm font-medium text-yellow-800 mb-2">💡 Quick Tips:</p>
                              <div className="grid md:grid-cols-2 gap-2 text-xs text-yellow-700">
                                <p>• ابدأ برقم كبير يلفت الانتباه</p>
                                <p>• استخدم سيناريو "لو حصل كذا..."</p>
                                <p>• اذكر شخصية معروفة في أول 5 ثواني</p>
                                <p>• الثمبنيل: وجه + خريطة + سهم</p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  ))}

                {/* Emerging Topics Section */}
                {(() => {
                  const pendingCluster = clusters.find(c => c.cluster_key === 'uncategorized');
                  const pendingCount = pendingCluster?.signal_count || 0;
                  
                  if (pendingCount === 0) return null;
                  
                  return (
                    <div className="mt-8 p-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-amber-800 flex items-center gap-2">
                            🌱 Emerging Topics
                          </h3>
                          <p className="text-sm text-amber-600 mt-1">
                            {pendingCluster?.signal_count || 0} signals, {pendingCluster?.intel_count || 0} intel - potential new clusters forming
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              const name = prompt('Enter new cluster name:');
                              if (name) {
                                createClusterFromPending(name, pendingCluster);
                              }
                            }}
                            className="px-3 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
                          >
                            + Create New Cluster
                          </button>
                          <button 
                            onClick={() => viewAllAngles(pendingCluster)}
                            className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm font-medium"
                          >
                            Review Signals →
                          </button>
                        </div>
                      </div>
                      
                      {/* Preview of pending signals */}
                      <div className="space-y-2">
                        {pendingCluster?.items
                          ?.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
                          .slice(0, 3)
                          .map((item, idx) => (
                            <div key={item.id} className="flex items-center gap-2 text-sm text-amber-700">
                              <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-medium">
                                {idx + 1}
                              </span>
                              <span className="truncate">{item.title}</span>
                            </div>
                          ))}
                        {pendingCluster?.items?.length > 3 && (
                          <p className="text-xs text-amber-500 ml-7">
                            +{pendingCluster.items.length - 3} more {pendingCluster.items.length - 3 === 1 ? 'item' : 'items'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* Saved Pitches Tab */}
        {activeTab === 'pitches' && (
          <div className="space-y-4">
            {savedPitches.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <p className="text-gray-500 text-lg">💡 No saved ideas yet</p>
                <p className="text-gray-400 mt-2">Generate pitches from Clusters and save your favorites!</p>
              </div>
            ) : (
              savedPitches.map(pitch => (
                <div key={pitch.id} className="bg-white rounded-xl shadow-sm border p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          pitch.source_type === 'cluster' 
                            ? 'bg-blue-100 text-blue-700' 
                            : pitch.source_type === 'intel'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {pitch.source_type}
                        </span>
                        {pitch.is_favorite && <span>⭐</span>}
                      </div>
                      <h3 className="font-semibold text-gray-900">{pitch.source_title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(pitch.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleFavorite(pitch.id, !pitch.is_favorite)}
                        className={`p-2 rounded-lg ${pitch.is_favorite ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'} hover:bg-yellow-100`}
                        title={pitch.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {pitch.is_favorite ? '⭐' : '☆'}
                      </button>
                      <button
                        onClick={() => deletePitch(pitch.id)}
                        className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600"
                        title="Delete pitch"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  
                  {/* Video Title if extracted */}
                  {pitch.video_title && (
                    <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600 font-medium">🎬 Suggested Title:</p>
                      <p className="text-blue-900">{pitch.video_title}</p>
                    </div>
                  )}
                  
                  {/* Hook if extracted */}
                  {pitch.hook && (
                    <div className="mb-3 p-3 bg-orange-50 rounded-lg">
                      <p className="text-sm text-orange-600 font-medium">🎣 Hook:</p>
                      <p className="text-orange-900">{pitch.hook}</p>
                    </div>
                  )}
                  
                  {/* Full Pitch (collapsible) */}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 font-medium">
                      📝 View Full Pitch
                    </summary>
                    <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                        {pitch.pitch_content}
                      </pre>
                    </div>
                  </details>
                  
                  {/* Actions */}
                  <div className="flex gap-3 mt-4 pt-4 border-t">
                    <button 
                      onClick={() => navigator.clipboard.writeText(pitch.pitch_content)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      📋 Copy
                    </button>
                    <button 
                      onClick={() => markAsUsed(pitch.id)}
                      className={`px-4 py-2 rounded-lg text-sm ${
                        pitch.status === 'used' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {pitch.status === 'used' ? '✓ Used' : '🎬 Mark as Used'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Signals Tab Content */}
        {activeTab === 'signals' && (
          <>
            {/* Status Filter Buttons */}
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                All ({signals.length})
              </button>
          <button
            onClick={() => setStatusFilter('new')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'new'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            New ({signals.filter(s => s.status === 'new').length})
          </button>
          <button
            onClick={() => setStatusFilter('reviewed')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'reviewed'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Reviewed ({signals.filter(s => s.status === 'reviewed').length})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'approved'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
          >
            Approved ({signals.filter(s => s.status === 'approved').length})
          </button>
          {signals.length > 0 && (
            <button
              onClick={() => {
                const allIds = signals.map(s => s.id);
                setSeenSignals(allIds);
              }}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 whitespace-nowrap"
              title="Mark all signals as read (hide NEW badges)"
            >
              ✓ Mark All as Read
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading signals...</p>
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">No signals found with the selected filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSignals.map((signal) => (
              <div
                key={signal.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{getSourceIcon(getSourceFromSignal(signal))}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {signal.url ? (
                              <a
                                href={signal.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 hover:underline"
                                onClick={() => markAsSeen(signal.id)}
                              >
                                {signal.title || signal.name || 'Untitled Signal'}
                              </a>
                            ) : (
                              <span onClick={() => markAsSeen(signal.id)} className="cursor-pointer">
                                {signal.title || signal.name || 'Untitled Signal'}
                              </span>
                            )}
                          </h3>
                          {isNewSignal(signal) && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                              NEW
                            </span>
                          )}
                        </div>
                        {signal.description && (
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                            {signal.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="font-medium">{getSourceFromSignal(signal)}</span>
                          <span>•</span>
                          <span className="capitalize">{signal.type || 'news'}</span>
                          <span>•</span>
                          <span>
                            {signal.detected_at || signal.created_at
                              ? new Date(signal.detected_at || signal.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Unknown date'}
                          </span>
                        </div>
                        
                        {/* Timing & Format Decisions */}
                        {(() => {
                          const timingFormat = signal.raw_data?.recommendation?.timing_format;
                          
                          // Always show format suggestion - extract from multiple possible locations
                          let formatSuggestion = null;
                          let timingSuggestion = null;
                          
                          if (timingFormat) {
                            formatSuggestion = timingFormat.format;
                            timingSuggestion = timingFormat.timing;
                          } else {
                            // Fallback: Try to extract from other locations
                            const recommendation = signal.raw_data?.recommendation;
                            if (recommendation?.format) {
                              formatSuggestion = recommendation.format;
                            }
                            if (recommendation?.timing) {
                              timingSuggestion = recommendation.timing;
                            }
                            // Also check if format is stored directly
                            if (signal.raw_data?.format) {
                              formatSuggestion = signal.raw_data.format;
                            }
                          }
                          
                          // If no format suggestion found, show default based on score/hook_potential
                          if (!formatSuggestion) {
                            const score = Number(signal.score) || 0;
                            const hookPotential = Number(signal.hook_potential) || 0;
                            
                            // High score + high hook potential = likely long-form
                            if (score >= 70 && hookPotential >= 7) {
                              formatSuggestion = {
                                decision: 'LONG',
                                duration: '25-30 min',
                                icon: '📺',
                                reason: 'High score and hook potential suggest long-form'
                              };
                            } else if (score >= 50) {
                              formatSuggestion = {
                                decision: 'BOTH',
                                duration: 'Long + Short',
                                icon: '🔄',
                                reason: 'Good score - consider both formats'
                              };
                            } else {
                              formatSuggestion = {
                                decision: 'SHORT',
                                duration: '30-45 sec',
                                icon: '📱',
                                reason: 'Test with short first'
                              };
                            }
                          }
                          
                          return (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {timingSuggestion && (
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  timingSuggestion.decision === 'URGENT'
                                    ? 'bg-red-100 text-red-800'
                                    : timingSuggestion.decision === 'TIMELY'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {timingSuggestion.icon || ''} {timingSuggestion.deadline || timingSuggestion.decision}
                                </span>
                              )}
                              {formatSuggestion && (
                                <span 
                                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    formatSuggestion.decision === 'LONG' || formatSuggestion.decision === 'LONG_FORM'
                                      ? 'bg-blue-100 text-blue-800'
                                      : formatSuggestion.decision === 'BOTH'
                                      ? 'bg-purple-100 text-purple-800'
                                      : formatSuggestion.decision === 'SHORT' || formatSuggestion.decision === 'SHORT_FORM'
                                      ? 'bg-pink-100 text-pink-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                  title={formatSuggestion.reason || formatSuggestion.recommendation || ''}
                                >
                                  {formatSuggestion.icon || (formatSuggestion.decision === 'LONG' || formatSuggestion.decision === 'LONG_FORM' ? '📺' : formatSuggestion.decision === 'SHORT' || formatSuggestion.decision === 'SHORT_FORM' ? '📱' : '🔄')} {formatSuggestion.duration || formatSuggestion.decision}
                                </span>
                              )}
                              {timingFormat?.action && (
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  timingFormat.action.priority === 'HIGHEST' || timingFormat.action.priority === 'HIGH'
                                    ? 'bg-red-100 text-red-800'
                                    : timingFormat.action.priority === 'MEDIUM'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {timingFormat.action.priority}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 mt-4 flex-wrap">
                      <div>
                        <span className="text-sm text-gray-600">Score:</span>
                        <span className={`ml-2 text-lg font-bold ${getScoreColor(signal.score)}`}>
                          {Number(signal.score).toFixed(1)}
                        </span>
                      </div>
                      {signal.hook_potential && (
                        <div>
                          <span className="text-sm text-gray-600">Hook Potential:</span>
                          <span className={`ml-2 text-lg font-bold ${getScoreColor(signal.hook_potential)}`}>
                            {Number(signal.hook_potential).toFixed(1)}
                          </span>
                        </div>
                      )}
                      {/* Quality Score Badge */}
                      {(() => {
                        const quality = signal.raw_data?.recommendation?.quality || signal.raw_data?.recommendation?.titleQuality;
                        if (quality) {
                          const colorClass = quality.color === 'green' ? 'bg-green-100 text-green-800' :
                                           quality.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                                           'bg-red-100 text-red-800';
                          return (
                            <div>
                              <span className="text-sm text-gray-600">Quality:</span>
                              <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
                                {quality.score || quality.score || 'N/A'} {quality.grade ? `(${quality.grade})` : ''}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(signal.status)}`}
                        >
                          {signal.status.charAt(0).toUpperCase() + signal.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Enhanced Scoring Breakdown */}
                    {(() => {
                      const enhancedScore = signal.raw_data?.enhancedScore || signal.raw_data?.scores;
                      const evidence = signal.raw_data?.evidence;
                      
                      if (enhancedScore || evidence) {
                        return (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="text-xs font-semibold text-gray-500 mb-2">Enhanced Scoring Breakdown</div>
                            
                            {/* Interest Cluster */}
                            {evidence?.interest?.hasMatch && (
                              <div className="mb-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">{evidence.interest.primaryCluster?.icon}</span>
                                  <span className="text-sm font-medium text-gray-700">
                                    {evidence.interest.primaryCluster?.name}
                                  </span>
                                  {evidence.interest.isDiscovery && (
                                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs">
                                      💡 Discovery
                                    </span>
                                  )}
                                </div>
                                
                                {/* Secondary Clusters */}
                                {evidence.interest.secondaryClusters?.length > 0 && (
                                  <div className="flex items-center gap-2 text-xs text-gray-600 ml-7">
                                    <span>+</span>
                                    {evidence.interest.secondaryClusters.map((cluster, i) => (
                                      <span key={i} className="flex items-center gap-1">
                                        <span>{cluster.icon}</span>
                                        <span>{cluster.name}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Score Breakdown */}
                            {enhancedScore && (
                              <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                                <div className="bg-blue-50 px-2 py-1 rounded">
                                  <div className="text-gray-600">Base</div>
                                  <div className="font-bold text-blue-700">{enhancedScore.base || 30}</div>
                                </div>
                                <div className="bg-purple-50 px-2 py-1 rounded">
                                  <div className="text-gray-600">Interest</div>
                                  <div className="font-bold text-purple-700">{enhancedScore.interest || 0}</div>
                                </div>
                                <div className="bg-green-50 px-2 py-1 rounded">
                                  <div className="text-gray-600">Search</div>
                                  <div className="font-bold text-green-700">{enhancedScore.search || 0}</div>
                                </div>
                                <div className="bg-orange-50 px-2 py-1 rounded">
                                  <div className="text-gray-600">Competitor</div>
                                  <div className="font-bold text-orange-700">{enhancedScore.competitor || 0}</div>
                                </div>
                              </div>
                            )}
                            
                            {/* Evidence Details */}
                            <div className="space-y-1 text-xs text-gray-600">
                              {/* Search Evidence */}
                              {evidence?.search?.hasEvidence && (
                                <div className="flex items-center gap-2">
                                  <span>🔍</span>
                                  <span>{evidence.search.totalViews?.toLocaleString() || 0} searches</span>
                                </div>
                              )}
                              
                              {/* Competitor Evidence */}
                              {evidence?.competitor?.hasEvidence && (
                                <div className="flex items-center gap-2">
                                  <span>📺</span>
                                  <span>{evidence.competitor.count || 0} competitors</span>
                                  {evidence.competitor.recent && (
                                    <span className="text-orange-500 text-xs">(recent coverage!)</span>
                                  )}
                                </div>
                              )}
                              
                              {/* Suggested Angles */}
                              {evidence?.interest?.suggestedAngles?.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <span className="text-xs text-gray-400">Suggested Angles:</span>
                                  <ul className="mt-1 space-y-1">
                                    {evidence.interest.suggestedAngles.slice(0, 2).map((angle, i) => (
                                      <li key={i} className="text-xs text-gray-600 flex items-center gap-1">
                                        <span>{angle.icon}</span>
                                        <span>{angle.angle}</span>
                                        {angle.crossover && (
                                          <span className="text-purple-500">(crossover)</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Quality Warnings */}
                    {(() => {
                      const warnings = signal.raw_data?.recommendation?.qualityWarnings || [];
                      if (warnings.length > 0) {
                        return (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {warnings.map((warning, i) => (
                              <span key={i} className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs border border-yellow-200">
                                ⚠️ {warning}
                              </span>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Audience Behavior Insights */}
                    {(() => {
                      // Try multiple paths for behavior data from backend
                      let behaviorData = signal.behaviorUI 
                        || signal.raw_data?.behaviorUI 
                        || signal.raw_data?.behavior
                        || signal.raw_data?.recommendation?.behaviorUI
                        || signal.raw_data?.recommendation?.behavior
                        || (signal.raw_data?.recommendation?.behavior_analysis?.ui);
                      
                      // If backend didn't store behavior, compute it on the fly from title/description
                      if (!behaviorData) {
                        try {
                          const analysis = analyzeAudienceBehavior({
                            title: signal.title || signal.raw_data?.rssItem?.title || '',
                            description: signal.description || signal.raw_data?.rssItem?.description || '',
                            topic: signal.title || ''
                          });
                          const ui = formatBehaviorForUI(analysis);
                          if (ui && ui.primaryInterest) {
                            behaviorData = ui;
                          }
                        } catch (e) {
                          console.warn('⚠️ Inline behavior analysis failed for signal:', signal.id, e.message);
                        }
                      }
                      
                      // Always log for debugging (visible in browser console)
                      console.log('🔍 Signal behavior check:', {
                        signalId: signal.id,
                        title: signal.title?.substring(0, 40),
                        'signal.behaviorUI': !!signal.behaviorUI,
                        'raw_data?.behaviorUI': !!signal.raw_data?.behaviorUI,
                        'raw_data?.behavior': !!signal.raw_data?.behavior,
                        'raw_data?.recommendation?.behaviorUI': !!signal.raw_data?.recommendation?.behaviorUI,
                        'raw_data?.recommendation?.behavior': !!signal.raw_data?.recommendation?.behavior,
                        'raw_data?.recommendation?.behavior_analysis?.ui': !!(signal.raw_data?.recommendation?.behavior_analysis?.ui),
                        'FOUND behaviorData': !!behaviorData,
                        rawDataStructure: signal.raw_data ? {
                          keys: Object.keys(signal.raw_data),
                          hasRecommendation: !!signal.raw_data.recommendation,
                          recommendationKeys: signal.raw_data.recommendation ? Object.keys(signal.raw_data.recommendation) : []
                        } : 'no raw_data'
                      });
                      
                      if (!behaviorData) {
                        console.warn('⚠️ No behavior data found for signal:', signal.id, signal.title?.substring(0, 40));
                      }
                      
                      return behaviorData ? (
                        <BehaviorInsightPanel behavior={behaviorData} />
                      ) : null;
                    })()}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => generateBrief(signal.id, 'long_form')}
                        disabled={generatingBrief === signal.id}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-sm"
                        title="Generate Long-Form Brief (25-30 min)"
                      >
                        {generatingBrief === signal.id ? (
                          <span className="flex items-center gap-2">
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Generating...
                          </span>
                        ) : (
                          '📹 Long-Form'
                        )}
                      </button>
                      <button
                        onClick={() => generateBrief(signal.id, 'short_form')}
                        disabled={generatingBrief === signal.id}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-sm"
                        title="Generate Short-Form Brief (45 sec)"
                      >
                        {generatingBrief === signal.id ? (
                          <span className="flex items-center gap-2">
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Generating...
                          </span>
                        ) : (
                          '🎬 Short'
                        )}
                      </button>
                    </div>
                    
                    <button
                      onClick={() => generateSignalPitch(signal)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors whitespace-nowrap text-sm flex items-center gap-2"
                    >
                      ✨ Generate Pitch
                    </button>
                  </div>
                </div>
                
                {/* Feedback Buttons */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <FeedbackButtons
                    recommendation={{
                      id: signal.id,
                      topic: signal.title || signal.name || 'Untitled Signal',
                      type: 'rss_signal',
                      score: signal.score,
                      evidence: {
                        current_events: [signal],
                        search_terms: [],
                        competitor_videos: [],
                        audience_comments: []
                      }
                    }}
                    showId={selectedShow || "00000000-0000-0000-0000-000000000004"}
                    sessionId={`signal-session-${signal.id}`}
                    onFeedback={(action, sig) => {
                      console.log(`Signal: ${action}`, sig.topic);
                      // Mark as seen when user gives feedback
                      markAsSeen(signal.id);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </div>

      {/* Angles Modal */}
      {showAnglesModal && selectedCluster && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">
                  📋 All Angles: {selectedCluster.cluster_name_ar || selectedCluster.cluster_name}
                </h2>
                <button 
                  onClick={() => setShowAnglesModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-3">
                {selectedCluster.items
                  ?.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
                  .map((item, idx) => (
                    <div key={item.id} className="p-4 border rounded-lg hover:border-blue-300 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm font-medium">
                          {idx + 1}
                        </span>
                        
                        {/* Source type badge */}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          item.source_type === 'intel' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.source_type === 'intel' ? '🧠' : '📰'}
                        </span>
                        
                        <div className="flex-1">
                          <a 
                            href={item.url || '#'} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium text-gray-900 hover:text-blue-600 block"
                          >
                            {item.title}
                          </a>
                          <div className="flex gap-4 mt-2 text-sm text-gray-500">
                            <span>📊 Relevance: {(item.relevance_score || 0).toFixed(1)}</span>
                            <span className="capitalize">• {item.source_type}</span>
                            {item.item_date && (
                              <span>📅 {new Date(item.item_date).toLocaleDateString('ar-EG')}</span>
                            )}
                          </div>
                          {item.detected_angle && (
                            <span className="inline-block mt-2 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                              🎯 {item.detected_angle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Pitch Modal */}
      {showPitchModal && (selectedCluster || selectedSignal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">✨ Generated Video Pitch</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedCluster?.cluster_name_ar || selectedCluster?.cluster_name || selectedSignal?.title}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowPitchModal(false);
                    setSelectedCluster(null);
                    setSelectedSignal(null);
                  }} 
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              {/* Status badges */}
              <div className="flex gap-2 mt-3">
                {isCached && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                    ♻️ From Cache
                  </span>
                )}
                {!isCached && !isGenerating && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                    🧬 DNA-Powered
                  </span>
                )}
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin text-4xl mb-4">⏳</div>
                  <p className="text-gray-500">Generating pitch with DNA insights...</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                    {generatedPitch}
                  </pre>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {pitchId && <span>Pitch ID: {pitchId.substring(0, 8)}...</span>}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigator.clipboard.writeText(generatedPitch)}
                  disabled={isGenerating}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                >
                  📋 Copy
                </button>
                <button
                  onClick={savePitch}
                  disabled={isGenerating || isSaved}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    isSaved
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  {isSaved ? '✓ Saved' : '💾 Save Pitch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

