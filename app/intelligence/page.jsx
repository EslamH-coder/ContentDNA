'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import LayoutWithNav from '../layout-with-nav';
import { supabase } from '@/lib/supabase';
import { 
  Users, MessageSquare, TrendingUp, Target, Plus, 
  ExternalLink, Trash2, Edit2, Eye, EyeOff, RefreshCw,
  ChevronDown, ChevronUp, Search, Filter, BarChart3,
  Lightbulb, AlertCircle, CheckCircle, Youtube,
  Radio, AlertTriangle, Zap, MapPin, Shield, Film
} from 'lucide-react';

function IntelligenceContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const showId = searchParams.get('showId');
  
  // Data states
  const [competitors, setCompetitors] = useState([]);
  const [competitorVideos, setCompetitorVideos] = useState([]);
  const [audienceQuestions, setAudienceQuestions] = useState([]);
  const [channelVideos, setChannelVideos] = useState([]);
  const [topicPerformance, setTopicPerformance] = useState([]);
  
  // UI states
  const [showAddCompetitor, setShowAddCompetitor] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState(null);
  const [questionFilter, setQuestionFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Radar alerts state
  const [radarAlerts, setRadarAlerts] = useState({
    direct: {
      longForm: [],
      shorts: []
    },
    indirect: {
      longForm: [],
      shorts: []
    },
    breakouts: [],
    openFields: [],
    competitionStats: [],
    zones: {
      attack: [],
      defend: [],
      open: []
    },
    formatInsights: []
  });

  // Radar sub-tabs (for organizing radar content)
  const [radarTab, setRadarTab] = useState('direct'); // 'direct' | 'indirect' | 'strategy'

  // Debug authentication and wait for session
  useEffect(() => {
    async function checkAuth() {
      // First check session (this is what actually has the auth token)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔐 Session check - Session exists:', !!session, 'Error:', sessionError);
      console.log('🔐 Session check - User ID:', session?.user?.id);
      console.log('🔐 Session check - Email:', session?.user?.email);
      
      // Then check user (this might fail if session isn't ready)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('🔐 User check - User:', user?.id, 'Error:', userError);
      console.log('🔐 User check - Email:', user?.email);
      
      // Check if we need to wait for auth state
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('🔐 Auth state changed:', event, 'Session:', !!session);
        if (session) {
          console.log('🔐 Auth ready - User ID:', session.user.id);
        }
      });
      
      return () => {
        subscription?.unsubscribe();
      };
    }
    checkAuth();
  }, []);

  // Debug: Log state changes
  useEffect(() => {
    console.log('=== Intelligence Page Debug ===');
    console.log('showId:', showId);
    console.log('competitors:', competitors.length);
    console.log('competitorVideos:', competitorVideos.length);
    console.log('competitorVideos array:', competitorVideos);
    if (competitorVideos.length > 0) {
      console.log('First video:', competitorVideos[0]);
      console.log('Video competitor_ids:', competitorVideos.map(v => v.competitor_id));
    }
    if (competitors.length > 0) {
      console.log('Competitor IDs:', competitors.map(c => c.id));
      console.log('Competitor names:', competitors.map(c => `${c.name} (${c.id})`));
    }
  }, [showId, competitors, competitorVideos]);

  // Fetch all data when showId is available
  useEffect(() => {
    if (showId) {
      console.log('✅ showId is set:', showId, '- fetching all data');
      fetchAllData();
    } else {
      console.log('⏳ showId not yet available, waiting...');
    }
  }, [showId]);

  // Fetch competitor videos AFTER competitors are loaded
  useEffect(() => {
    if (competitors.length > 0 && showId) {
      console.log('📺 Competitors loaded, now fetching their videos...', competitors.length, 'competitors');
      fetchCompetitorVideos();
    }
  }, [competitors, showId]);

  // Fetch radar alerts when competitors and competitorVideos are available
  useEffect(() => {
    if (competitors.length > 0 && competitorVideos.length > 0 && showId) {
      fetchRadarAlerts();
    }
  }, [competitors, competitorVideos, showId]);

  // Debug: Log competitor videos state changes
  useEffect(() => {
    if (competitorVideos.length > 0) {
      console.log('📊 Competitor videos state updated:', competitorVideos.length);
      console.log('📊 Sample video from state:', competitorVideos[0]);
      
      // Group by competitor_id
      const grouped = {};
      competitorVideos.forEach(v => {
        if (!grouped[v.competitor_id]) {
          grouped[v.competitor_id] = [];
        }
        grouped[v.competitor_id].push(v);
      });
      console.log('📊 Videos grouped by competitor:', Object.keys(grouped).map(id => ({
        competitor_id: id,
        count: grouped[id].length
      })));
    } else {
      console.log('📊 Competitor videos state: empty');
    }
  }, [competitorVideos]);

  async function fetchAllData() {
    console.log('🔄 fetchAllData called, showId:', showId);
    
    if (!showId) {
      console.error('❌ fetchAllData called without showId! This should not happen.');
      return;
    }
    
    setLoading(true);
    
    try {
      await Promise.all([
        fetchCompetitors(),
        // fetchCompetitorVideos(),  // REMOVED - it runs via useEffect after competitors load
        fetchAudienceQuestions(),
        fetchChannelPerformance(),
      ]);
      console.log('✅ fetchAllData complete');
    } catch (error) {
      console.error('❌ Error in fetchAllData:', error);
    } finally {
      setLoading(false);
    }
  }

  // ===== RADAR: ALERTS & HELPERS =====

  async function fetchRadarAlerts() {
    if (!showId || competitors.length === 0) {
      console.log('🔔 Radar: Missing showId or competitors, skipping');
      return;
    }

    console.log('🔔 Fetching smart radar alerts...');

    const competitorIds = competitors.map(c => c.id);
    const directCompetitors = competitors.filter(c => c.type === 'direct');
    const indirectCompetitors = competitors.filter(c => c.type === 'indirect');

    const directIds = directCompetitors.map(c => c.id);
    const indirectIds = indirectCompetitors.map(c => c.id);

    // Time windows
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get YOUR channel's medians for comparison
    let yourLongMedian = 0;
    let yourShortMedian = 0;
    try {
      const { data: yourVideos, error: yourError } = await supabase
        .from('channel_videos')
        .select('views, format, duration_seconds')
        .eq('show_id', showId)
        .gt('views', 0);

      if (yourError) {
        console.error('🔔 Error fetching your videos for radar medians:', yourError);
      } else {
        const yourLongVideos = (yourVideos || []).filter(v => {
          // Prefer duration_seconds when present
          if (v.duration_seconds && v.duration_seconds > 90) return true;
          if (v.format === 'Long') return true;
          return false;
        });

        const yourShortVideos = (yourVideos || []).filter(v => {
          if (v.duration_seconds && v.duration_seconds <= 90) return true;
          if (v.format === 'Short') return true;
          return false;
        });

        yourLongMedian = calculateMedian(yourLongVideos.map(v => v.views));
        yourShortMedian = calculateMedian(yourShortVideos.map(v => v.views));

        console.log(
          `📊 Your videos - Long: ${yourLongVideos.length}, Shorts: ${yourShortVideos.length}`
        );
      }
    } catch (e) {
      console.error('🔔 Exception calculating your medians for radar:', e);
    }

    console.log(
      `📊 Your medians - Long: ${formatNumber(yourLongMedian)}, Shorts: ${formatNumber(yourShortMedian)}`
    );

    const yourLongMedianFinal = yourLongMedian || 100000;
    const yourShortMedianFinal = yourShortMedian || 50000;

    // ===== DIRECT COMPETITORS: ALL recent uploads (7 days) =====
    let directLongForm = [];
    let directShorts = [];

    if (directIds.length > 0) {
      try {
        const { data, error } = await supabase
          .from('competitor_videos')
          .select('*')
          .in('competitor_id', directIds)
          .gte('published_at', sevenDaysAgo.toISOString())
          .order('published_at', { ascending: false });

        if (error) {
          console.error('🔔 Error fetching direct uploads:', error);
        } else {
          const competitorMap = {};
          directCompetitors.forEach(c => {
            competitorMap[c.id] = { name: c.name, type: c.type };
          });

          const uploads = (data || []).map(v => ({
            ...v,
            competitors: competitorMap[v.competitor_id] || { name: 'Unknown', type: 'direct' }
          }));

          directLongForm = uploads
            .filter(v => (v.duration_seconds || 0) > 90)
            .map(v => {
              const vsYourMedian =
                yourLongMedianFinal > 0 ? (v.views / yourLongMedianFinal).toFixed(1) : 'N/A';
              let potentialForYou = 'Low';
              if (yourLongMedianFinal > 0) {
                if (v.views >= yourLongMedianFinal) {
                  potentialForYou = 'High';
                } else if (v.views >= yourLongMedianFinal * 0.5) {
                  potentialForYou = 'Medium';
                }
              }
              return {
                ...v,
                vsYourMedian,
                potentialForYou
              };
            });

          directShorts = uploads
            .filter(v => (v.duration_seconds || 0) <= 90)
            .map(v => {
              const vsYourMedian =
                yourShortMedianFinal > 0 ? (v.views / yourShortMedianFinal).toFixed(1) : 'N/A';
              let potentialForYou = 'Low';
              if (yourShortMedianFinal > 0) {
                if (v.views >= yourShortMedianFinal) {
                  potentialForYou = 'High';
                } else if (v.views >= yourShortMedianFinal * 0.5) {
                  potentialForYou = 'Medium';
                }
              }
              return {
                ...v,
                vsYourMedian,
                potentialForYou
              };
            });
        }
      } catch (e) {
        console.error('🔔 Exception in direct uploads fetch:', e);
      }
    }

    console.log(`📍 Direct uploads: ${directLongForm.length} long-form, ${directShorts.length} shorts`);

    // ===== INDIRECT COMPETITORS: BREAKOUTS matching DNA =====
    const indirectBreakouts = { longForm: [], shorts: [] };

    if (indirectIds.length > 0) {
      try {
        // DNA topics
        const { data: dnaTopics, error: dnaError } = await supabase
          .from('topic_definitions')
          .select('topic_id, keywords')
          .eq('show_id', showId);

        if (dnaError) {
          console.error('🔔 Error fetching DNA topics for radar:', dnaError);
        } else {
          const dnaKeywords = [];
          (dnaTopics || []).forEach(topic => {
            if (topic.keywords && Array.isArray(topic.keywords)) {
              dnaKeywords.push(...topic.keywords);
            }
          });
          const dnaTopicIds = (dnaTopics || []).map(t => t.topic_id);

          // Indirect videos (last 7 days)
          const { data: indirectVideos, error: indirectError } = await supabase
            .from('competitor_videos')
            .select('*')
            .in('competitor_id', indirectIds)
            .gte('published_at', sevenDaysAgo.toISOString())
            .order('views', { ascending: false });

          if (indirectError) {
            console.error('🔔 Error fetching indirect videos for radar:', indirectError);
          } else {
            // All indirect for medians
            const { data: allIndirectVideos, error: allIndirectError } = await supabase
              .from('competitor_videos')
              .select('competitor_id, views, duration_seconds')
              .in('competitor_id', indirectIds)
              .limit(500);

            if (allIndirectError) {
              console.error('🔔 Error fetching all indirect videos for medians:', allIndirectError);
            } else {
              const indirectMedians = {};
              (allIndirectVideos || []).forEach(v => {
                const key = `${v.competitor_id}_${(v.duration_seconds || 0) > 90 ? 'long' : 'short'}`;
                if (!indirectMedians[key]) indirectMedians[key] = [];
                indirectMedians[key].push(v.views || 0);
              });

              Object.keys(indirectMedians).forEach(key => {
                indirectMedians[key] = calculateMedian(indirectMedians[key]);
              });

              // Map indirect competitor info
              const competitorMap = {};
              indirectCompetitors.forEach(c => {
                competitorMap[c.id] = { name: c.name, type: c.type };
              });

              (indirectVideos || []).forEach(video => {
                const isLong = (video.duration_seconds || 0) > 90;
                const medianKey = `${video.competitor_id}_${isLong ? 'long' : 'short'}`;
                const theirMedian = indirectMedians[medianKey] || 0;

                // Check 1: breakout for them (1.5x+ their median)
                if (!theirMedian || !video.views || video.views < theirMedian * 1.5) return;

                // Check 2: would perform for us (>= 50% of our median)
                const yourMedianForFormat = isLong ? yourLongMedian : yourShortMedian;
                if (yourMedianForFormat > 0 && video.views < yourMedianForFormat * 0.5) {
                  console.log(
                    `⏭️ Skipping "${(video.title || '').substring(0, 40)}..." - ` +
                    `${formatNumber(video.views)} views < ${formatNumber(yourMedianForFormat * 0.5)} (50% of your median)`
                  );
                  return;
                }

                // Check 3: matches DNA
                const dnaMatch = checkDNAMatch(video, dnaTopicIds, dnaKeywords);
                if (!dnaMatch) return;

                const ratio = video.views / theirMedian;
                const ageDays = Math.floor(
                  (Date.now() - new Date(video.published_at).getTime()) / (1000 * 60 * 60 * 24)
                );
                const velocityPerDay = ageDays > 0 ? Math.round(video.views / ageDays) : video.views;

                const vsYourMedian =
                  yourMedianForFormat > 0 ? (video.views / yourMedianForFormat).toFixed(1) : 'N/A';

                const severity =
                  yourMedianForFormat > 0 && video.views >= yourMedianForFormat * 1.5
                    ? 'high'
                    : yourMedianForFormat > 0 && video.views >= yourMedianForFormat
                    ? 'medium'
                    : 'low';

                const potentialForYou =
                  yourMedianForFormat > 0 && video.views >= yourMedianForFormat ? 'High' : 'Medium';

                const breakoutData = {
                  ...video,
                  competitors: competitorMap[video.competitor_id] || { name: 'Unknown', type: 'indirect' },
                  median: theirMedian,
                  ratio: Math.round(ratio * 100) / 100,
                  yourMedian: yourMedianForFormat,
                  vsYourMedian,
                  ageDays,
                  velocityPerDay,
                  severity,
                  dnaMatch,
                  potentialForYou
                };

                if (isLong) {
                  indirectBreakouts.longForm.push(breakoutData);
                } else {
                  indirectBreakouts.shorts.push(breakoutData);
                }
              });

              // Sort by views (highest potential first) and limit
              indirectBreakouts.longForm = indirectBreakouts.longForm
                .sort((a, b) => (b.views || 0) - (a.views || 0))
                .slice(0, 10);
              indirectBreakouts.shorts = indirectBreakouts.shorts
                .sort((a, b) => (b.views || 0) - (a.views || 0))
                .slice(0, 10);
            }
          }
        }
      } catch (e) {
        console.error('🔔 Exception in indirect breakouts calculation:', e);
      }
    }

    console.log(`🔥 Indirect breakouts: ${indirectBreakouts.longForm.length} long-form, ${indirectBreakouts.shorts.length} shorts`);

    // ===== OTHER RADAR DATA (existing logic) =====
    let allCompetitorVideos = [];
    try {
      const { data: videosData, error: videosError } = await supabase
        .from('competitor_videos')
        .select('competitor_id, views, published_at, title, youtube_video_id, duration_seconds')
        .in('competitor_id', competitorIds)
        .order('published_at', { ascending: false })
        .limit(500);

      if (videosError) {
        console.error('🔔 Error fetching videos for breakouts:', videosError);
      } else {
        allCompetitorVideos = videosData || [];
      }
    } catch (e) {
      console.error('🔔 Exception in breakout fetch:', e);
    }

    const breakouts = calculateBreakouts(allCompetitorVideos, competitors);

    let openFields = [];
    try {
      openFields = await calculateOpenFields(showId, competitorIds);
    } catch (e) {
      console.error('🔔 Exception in open fields calculation:', e);
    }

    let competitionStats = [];
    try {
      competitionStats = await calculateCompetitionStats(showId, competitorIds, competitors);
    } catch (e) {
      console.error('🔔 Exception in competition stats calculation:', e);
    }

    const zones = calculateZones(competitionStats);
    const formatInsights = calculateFormatInsights(competitionStats);

    setRadarAlerts({
      direct: {
        longForm: directLongForm,
        shorts: directShorts
      },
      indirect: {
        longForm: indirectBreakouts.longForm,
        shorts: indirectBreakouts.shorts
      },
      breakouts,
      openFields,
      competitionStats,
      zones,
      formatInsights
    });

    console.log(
      `🔔 Radar smart: direct ${directLongForm.length} long / ${directShorts.length} shorts, ` +
      `indirect ${indirectBreakouts.longForm.length} long / ${indirectBreakouts.shorts.length} shorts, ` +
      `${breakouts.length} breakouts, ${zones.attack.length} attack zones, ${zones.defend.length} defend zones, ${openFields.length} open fields`
    );
  }

  /**
   * Check if video matches show's DNA (topics or keywords)
   */
  function checkDNAMatch(video, dnaTopicIds, dnaKeywords) {
    if (video.detected_topic && dnaTopicIds.includes(video.detected_topic)) {
      return { type: 'topic', match: video.detected_topic };
    }

    const titleLower = (video.title || '').toLowerCase();
    for (const keyword of dnaKeywords || []) {
      if (!keyword || keyword.length < 3) continue;
      if (titleLower.includes(String(keyword).toLowerCase())) {
        return { type: 'keyword', match: keyword };
      }
    }

    return null;
  }

  function calculateBreakouts(videos, competitorsList) {
    const breakouts = [];
    if (!videos || videos.length === 0) return breakouts;

    // Use last 7 days for breakout detection
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Group videos by competitor
    const videosByCompetitor = {};
    videos.forEach(v => {
      if (!v.competitor_id) return;
      if (!videosByCompetitor[v.competitor_id]) {
        videosByCompetitor[v.competitor_id] = [];
      }
      videosByCompetitor[v.competitor_id].push(v);
    });

    // For each competitor, calculate median and find breakouts
    for (const [competitorId, compVideos] of Object.entries(videosByCompetitor)) {
      if (compVideos.length < 5) continue; // Need enough videos for median

      // Separate by format
      const longVideos = compVideos.filter(v => (v.duration_seconds || 0) > 90 && (v.views || 0) > 0);
      const shortVideos = compVideos.filter(v => (v.duration_seconds || 0) <= 90 && (v.views || 0) > 0);

      const longMedian = calculateMedian(longVideos.map(v => v.views));
      const shortMedian = calculateMedian(shortVideos.map(v => v.views));

      const competitor = competitorsList.find(c => c.id === competitorId);

      for (const video of compVideos) {
        if (!video.views || !video.published_at) continue;

        const isRecent = new Date(video.published_at) > sevenDaysAgo;
        if (!isRecent) continue;

        const isLong = (video.duration_seconds || 0) > 90;
        const median = isLong ? longMedian : shortMedian;
        if (!median || median <= 0) continue;

        if (video.views >= median * 1.5) {
          const ratio = video.views / median;
          const ageDays = Math.floor((Date.now() - new Date(video.published_at).getTime()) / (1000 * 60 * 60 * 24));
          const velocityPerDay = ageDays > 0 ? Math.round(video.views / ageDays) : video.views;

          breakouts.push({
            ...video,
            competitorName: competitor?.name || 'Unknown',
            competitorType: competitor?.type || 'direct',
            format: isLong ? 'Long' : 'Short',
            median,
            ratio: Math.round(ratio * 100) / 100,
            ageDays,
            velocityPerDay,
            severity: ratio >= 3 ? 'high' : ratio >= 2 ? 'medium' : 'low'
          });
        }
      }
    }

    // Sort by ratio (highest first)
    return breakouts.sort((a, b) => (b.ratio || 0) - (a.ratio || 0));
  }

  function calculateMedian(numbers) {
    if (!numbers || numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  async function calculateOpenFields(showIdForCalc, competitorIdsForCalc) {
    if (!showIdForCalc || !competitorIdsForCalc || competitorIdsForCalc.length === 0) return [];

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Your recent topics
    const { data: yourVideos, error: yourError } = await supabase
      .from('channel_videos')
      .select('topic_id')
      .eq('show_id', showIdForCalc)
      .gte('publish_date', ninetyDaysAgo.toISOString());

    if (yourError) {
      console.error('🔔 Error fetching your videos for open fields:', yourError);
    }

    const yourTopics = new Set((yourVideos || []).map(v => v.topic_id).filter(Boolean));

    // Competitor topics
    const { data: compVideos, error: compError } = await supabase
      .from('competitor_videos')
      .select('detected_topic, title, views, competitor_id, published_at')
      .in('competitor_id', competitorIdsForCalc)
      .gte('published_at', ninetyDaysAgo.toISOString());

    if (compError) {
      console.error('🔔 Error fetching competitor videos for open fields:', compError);
      return [];
    }

    const competitorTopics = {};
    (compVideos || []).forEach(v => {
      const topic = v.detected_topic;
      if (topic && !yourTopics.has(topic)) {
        if (!competitorTopics[topic]) {
          competitorTopics[topic] = {
            topic,
            videos: [],
            totalViews: 0,
            competitorCount: new Set()
          };
        }
        competitorTopics[topic].videos.push(v);
        competitorTopics[topic].totalViews += v.views || 0;
        competitorTopics[topic].competitorCount.add(v.competitor_id);
      }
    });

    return Object.values(competitorTopics)
      .map(t => ({
        ...t,
        competitorCount: t.competitorCount.size,
        avgViews: t.videos.length > 0 ? Math.round(t.totalViews / t.videos.length) : 0,
        videoCount: t.videos.length,
        topVideos: t.videos.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 3)
      }))
      .filter(t => t.videoCount >= 2)
      .sort((a, b) => (b.totalViews * b.competitorCount) - (a.totalViews * a.competitorCount))
      .slice(0, 10);
  }

  // ===== COMPETITION STATS & STRATEGY HELPERS =====

  /**
   * Calculate competition stats: You vs Competitors per topic
   */
  async function calculateCompetitionStats(showIdForCalc, competitorIdsForCalc, competitorsList) {
    if (!showIdForCalc || !competitorsList || competitorsList.length === 0) return [];

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Your videos
    const { data: yourVideos, error: yourError } = await supabase
      .from('channel_videos')
      .select('topic_id, views, title, format, duration_seconds, publish_date')
      .eq('show_id', showIdForCalc)
      .gte('publish_date', ninetyDaysAgo.toISOString())
      .gt('views', 0);

    if (yourError) {
      console.error('🔔 Error fetching your videos for competition stats:', yourError);
    }

    // Competitor videos
    const { data: compVideos, error: compError } = await supabase
      .from('competitor_videos')
      .select('competitor_id, detected_topic, views, title, duration_seconds, published_at')
      .in('competitor_id', competitorIdsForCalc)
      .gte('published_at', ninetyDaysAgo.toISOString());

    if (compError) {
      console.error('🔔 Error fetching competitor videos for competition stats:', compError);
    }

    const yourTopicStats = {};
    (yourVideos || []).forEach(v => {
      const topic = v.topic_id;
      if (!topic || topic === 'other_stories') return;

      if (!yourTopicStats[topic]) {
        yourTopicStats[topic] = { 
          views: [], 
          longViews: [], 
          shortViews: [],
          videos: [] 
        };
      }
      yourTopicStats[topic].views.push(v.views || 0);
      yourTopicStats[topic].videos.push(v);

      const isLong = v.format === 'Long' || (v.duration_seconds && v.duration_seconds > 90);
      if (isLong) {
        yourTopicStats[topic].longViews.push(v.views || 0);
      } else {
        yourTopicStats[topic].shortViews.push(v.views || 0);
      }
    });

    const compTopicStats = {};
    (compVideos || []).forEach(v => {
      const topic = v.detected_topic;
      if (!topic) return;

      if (!compTopicStats[topic]) {
        compTopicStats[topic] = {};
      }
      if (!compTopicStats[topic][v.competitor_id]) {
        compTopicStats[topic][v.competitor_id] = {
          views: [],
          longViews: [],
          shortViews: [],
          videos: []
        };
      }

      compTopicStats[topic][v.competitor_id].views.push(v.views || 0);
      compTopicStats[topic][v.competitor_id].videos.push(v);

      const isLong = (v.duration_seconds || 0) > 90;
      if (isLong) {
        compTopicStats[topic][v.competitor_id].longViews.push(v.views || 0);
      } else {
        compTopicStats[topic][v.competitor_id].shortViews.push(v.views || 0);
      }
    });

    const stats = [];
    const allTopics = new Set([
      ...Object.keys(yourTopicStats),
      ...Object.keys(compTopicStats)
    ]);

    for (const topic of allTopics) {
      const yourStats = yourTopicStats[topic];
      const yourMedian = yourStats ? calculateMedian(yourStats.views) : 0;
      const yourLongMedian = yourStats ? calculateMedian(yourStats.longViews) : 0;
      const yourShortMedian = yourStats ? calculateMedian(yourStats.shortViews) : 0;
      const yourCount = yourStats?.videos.length || 0;

      const competitorBreakdown = [];
      let bestCompetitor = null;
      let bestCompetitorMedian = 0;

      if (compTopicStats[topic]) {
        for (const [compId, compStats] of Object.entries(compTopicStats[topic])) {
          const competitor = competitorsList.find(c => c.id === compId);
          const compMedian = calculateMedian(compStats.views);
          const compLongMedian = calculateMedian(compStats.longViews);
          const compShortMedian = calculateMedian(compStats.shortViews);

          competitorBreakdown.push({
            id: compId,
            name: competitor?.name || 'Unknown',
            type: competitor?.type || 'direct',
            median: compMedian,
            longMedian: compLongMedian,
            shortMedian: compShortMedian,
            count: compStats.videos.length
          });

          if (competitor?.type === 'direct' && compMedian > bestCompetitorMedian) {
            bestCompetitor = competitor;
            bestCompetitorMedian = compMedian;
          }
        }
      }

      let status = 'open';
      let statusLabel = 'Open Field';
      let ratio = 0;

      if (yourMedian > 0 && bestCompetitorMedian > 0) {
        ratio = yourMedian / bestCompetitorMedian;
        if (ratio >= 1.05) {
          status = 'defend';
          statusLabel = `You Lead (${ratio.toFixed(1)}x)`;
        } else if (ratio <= 0.8) {
          status = 'attack';
          statusLabel = `${bestCompetitor?.name || 'Competitor'} Leads (${(1/Math.max(ratio, 0.01)).toFixed(1)}x)`;
        } else {
          status = 'competitive';
          statusLabel = 'Competitive';
        }
      } else if (yourMedian > 0 && bestCompetitorMedian === 0) {
        status = 'defend';
        statusLabel = 'You Lead (Exclusive)';
      } else if (yourMedian === 0 && bestCompetitorMedian > 0) {
        status = 'attack';
        statusLabel = 'Competitor Territory';
      }

      stats.push({
        topic,
        yourMedian,
        yourLongMedian,
        yourShortMedian,
        yourCount,
        bestCompetitor: bestCompetitor?.name || null,
        bestCompetitorMedian,
        competitorBreakdown: competitorBreakdown.sort((a, b) => b.median - a.median),
        status,
        statusLabel,
        ratio
      });
    }

    return stats.sort((a, b) => {
      const aTotal = a.yourCount + a.competitorBreakdown.reduce((sum, c) => sum + c.count, 0);
      const bTotal = b.yourCount + b.competitorBreakdown.reduce((sum, c) => sum + c.count, 0);
      return bTotal - aTotal;
    });
  }

  /**
   * Calculate Attack/Defend/Open zones from competition stats
   */
  function calculateZones(competitionStats) {
    const zones = {
      attack: [],
      defend: [],
      open: []
    };

    for (const stat of competitionStats || []) {
      const totalVideos = stat.yourCount + stat.competitorBreakdown.reduce((sum, c) => sum + c.count, 0);
      if (totalVideos < 2) continue;

      if (stat.status === 'attack') {
        zones.attack.push({
          ...stat,
          priority: stat.bestCompetitorMedian || 0,
          recommendation: `Competitor "${stat.bestCompetitor || 'Unknown'}" is outperforming you${stat.ratio ? ` ${(1/Math.max(stat.ratio, 0.01)).toFixed(1)}x` : ''}. Consider attacking with a better angle.`
        });
      } else if (stat.status === 'defend') {
        zones.defend.push({
          ...stat,
          priority: stat.yourMedian || 0,
          recommendation: `You lead${stat.ratio ? ` by ${stat.ratio.toFixed(1)}x` : ''}. Reinforce with follow-up content or a series.`
        });
      } else if (stat.status === 'open') {
        zones.open.push({
          ...stat,
          priority: stat.bestCompetitorMedian || 1000,
          recommendation: `Low coverage by all. Test with a short-form video first.`
        });
      }
    }

    zones.attack.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    zones.defend.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    zones.open.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return zones;
  }

  /**
   * Calculate format insights: Long vs Short recommendations per topic
   */
  function calculateFormatInsights(competitionStats) {
    const insights = [];

    for (const stat of competitionStats || []) {
      if (stat.yourCount === 0 && stat.competitorBreakdown.length === 0) continue;

      const bestCompStats = stat.competitorBreakdown[0];

      const yourLongScore = stat.yourLongMedian || 0;
      const yourShortScore = stat.yourShortMedian || 0;
      const compLongScore = bestCompStats?.longMedian || 0;
      const compShortScore = bestCompStats?.shortMedian || 0;

      let longStatus = 'neutral';
      let shortStatus = 'neutral';
      let recommendation = '';

      if (yourLongScore > 0 && compLongScore > 0) {
        longStatus = yourLongScore >= compLongScore ? 'winning' : 'losing';
      }
      if (yourShortScore > 0 && compShortScore > 0) {
        shortStatus = yourShortScore >= compShortScore ? 'winning' : 'losing';
      }

      if (longStatus === 'winning' && shortStatus === 'losing') {
        recommendation = 'Attack with Shorts - competitors are stronger there.';
      } else if (longStatus === 'losing' && shortStatus === 'winning') {
        recommendation = 'Attack with Long-form - competitors are stronger there.';
      } else if (longStatus === 'losing' && shortStatus === 'losing') {
        recommendation = 'Competitors lead both formats - consider a new angle before investing heavily.';
      } else if (longStatus === 'winning' && shortStatus === 'winning') {
        recommendation = 'You lead in both formats - defend with follow-ups and series.';
      } else if (compLongScore === 0 && compShortScore === 0) {
        recommendation = 'Open field - test with Shorts first, then expand to Long-form if it works.';
      } else if (yourLongScore === 0 && yourShortScore === 0) {
        recommendation = 'New territory for you - study competitor successes before choosing format.';
      } else {
        recommendation = 'Mixed signals - need more data to recommend a clear format strategy.';
      }

      if (recommendation.includes('Mixed signals')) {
        continue;
      }

      insights.push({
        topic: stat.topic,
        yourLong: { median: yourLongScore, status: longStatus },
        yourShort: { median: yourShortScore, status: shortStatus },
        compLong: { median: compLongScore, name: bestCompStats?.name },
        compShort: { median: compShortScore, name: bestCompStats?.name },
        recommendation,
        formatFocus: longStatus === 'losing' ? 'long' : shortStatus === 'losing' ? 'short' : 'both'
      });
    }

    return insights;
  }

  async function fetchCompetitors() {
    try {
      // Get auth headers
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const res = await fetch(`/api/competitors?showId=${showId}`, { headers });
      const data = await res.json();
      if (data.success) {
        setCompetitors(data.competitors || []);
      } else {
        console.error('Error fetching competitors:', data.error);
      }
    } catch (error) {
      console.error('Error fetching competitors:', error);
    }
  }

  async function fetchCompetitorVideos() {
    // Check auth before query - use getSession which is more reliable
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('🔐 fetchCompetitorVideos - Session exists:', !!session, 'Error:', sessionError);
    console.log('🔐 fetchCompetitorVideos - User ID:', session?.user?.id);
    
    // Also check getUser for comparison
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('🔐 fetchCompetitorVideos - User authenticated:', !!user, user?.id, 'Error:', userError);
    
    // Use competitors from state, not a new query
    if (!competitors || competitors.length === 0) {
      console.log('⚠️ No competitors in state yet, waiting...');
      return;
    }

    if (!showId) {
      console.log('⚠️ No showId, skipping');
      return;
    }

    console.log('🎬 fetchCompetitorVideos starting');
    console.log('🎬 Using competitors from state:', competitors.length);
    console.log('🎬 Competitor names:', competitors.map(c => `${c.name} (${c.id})`));

    const competitorIds = competitors.map(c => c.id);
    console.log('🎬 Fetching videos for competitor IDs:', competitorIds);
    console.log('🎬 Competitor IDs (as strings):', competitorIds.map(id => `"${id}" (${typeof id})`));

    // Query videos for these competitors
    console.log('🎬 Querying competitor_videos table...');
    const { data: videos, error: videoError } = await supabase
      .from('competitor_videos')
      .select('*')
      .in('competitor_id', competitorIds)
      .order('published_at', { ascending: false })
      .limit(200);

    console.log('🎬 Videos query result:');
    console.log('  - Count:', videos?.length || 0);
    console.log('  - Error:', videoError);
    if (videoError) {
      console.error('  - Error details:', JSON.stringify(videoError, null, 2));
    }
    if (videos && videos.length > 0) {
      console.log('  - First video:', {
        id: videos[0].id,
        title: videos[0].title?.substring(0, 50),
        competitor_id: videos[0].competitor_id,
        competitor_id_type: typeof videos[0].competitor_id
      });
      console.log('  - Sample competitor_ids from videos:', videos.slice(0, 5).map(v => `"${v.competitor_id}" (${typeof v.competitor_id})`));
    }

    if (videoError) {
      console.error('❌ Error fetching videos:', videoError);
      setCompetitorVideos([]);
      return;
    }

    if (!videos || videos.length === 0) {
      console.log('⚠️ No videos found for these competitors');
      
      // Debug: Check if videos exist at all
      console.log('🔍 Debug - Checking if ANY videos exist in table...');
      const { data: allVideos, error: allError } = await supabase
        .from('competitor_videos')
        .select('id, competitor_id, title')
        .limit(5);
      
      console.log('🔍 Debug - Any videos in table?', allVideos?.length || 0, 'Error:', allError);
      if (allVideos && allVideos.length > 0) {
        console.log('🔍 Debug - Sample videos from table:');
        allVideos.forEach((v, idx) => {
          console.log(`  ${idx + 1}. competitor_id: "${v.competitor_id}" (${typeof v.competitor_id}), title: ${v.title?.substring(0, 40)}`);
        });
        console.log('🔍 Debug - competitor_ids in table:', allVideos.map(v => v.competitor_id));
        console.log('🔍 Debug - Looking for:', competitorIds);
        console.log('🔍 Debug - Match check:', competitorIds.map(id => ({
          id,
          idType: typeof id,
          found: allVideos.some(v => {
            const match = String(v.competitor_id) === String(id);
            if (!match) {
              console.log(`    No match: "${v.competitor_id}" (${typeof v.competitor_id}) !== "${id}" (${typeof id})`);
            }
            return match;
          })
        })));
      }
      
      setCompetitorVideos([]);
      return;
    }

    // Add competitor info to each video
    const competitorMap = {};
    competitors.forEach(c => {
      competitorMap[c.id] = { name: c.name, type: c.type };
    });

    const videosWithInfo = videos.map(v => ({
      ...v,
      competitors: competitorMap[v.competitor_id] || { name: 'Unknown', type: 'direct' }
    }));

    console.log('✅ Setting competitor videos:', videosWithInfo.length);
    if (videosWithInfo.length > 0) {
      console.log('✅ Videos with competitor info - sample:', videosWithInfo[0]);
      
      // Log video distribution by competitor
      const videoCounts = {};
      videosWithInfo.forEach(v => {
        videoCounts[v.competitor_id] = (videoCounts[v.competitor_id] || 0) + 1;
      });
      console.log('📊 Videos per competitor:', videoCounts);
    }
    
    setCompetitorVideos(videosWithInfo);
  }

  async function fetchAudienceQuestions() {
    const { data } = await supabase
      .from('audience_comments')
      .select('*')
      .eq('show_id', showId)
      .order('likes', { ascending: false })
      .limit(500);
    setAudienceQuestions(data || []);
  }

  async function fetchChannelPerformance() {
    const { data } = await supabase
      .from('channel_videos')
      .select('topic_id, views, title, format, publish_date')
      .eq('show_id', showId)
      .eq('format', 'Long')
      .gt('views', 0)
      .order('views', { ascending: false });
    
    setChannelVideos(data || []);
    
    // Calculate topic performance
    const topicStats = {};
    let totalViews = 0;
    
    (data || []).forEach(video => {
      if (video.topic_id) {
        if (!topicStats[video.topic_id]) {
          topicStats[video.topic_id] = { views: 0, count: 0, videos: [] };
        }
        topicStats[video.topic_id].views += video.views;
        topicStats[video.topic_id].count += 1;
        topicStats[video.topic_id].videos.push(video);
      }
      totalViews += video.views;
    });
    
    const avgViews = data?.length ? totalViews / data.length : 0;
    
    const performance = Object.entries(topicStats).map(([topic, stats]) => ({
      topic,
      avgViews: stats.count > 0 ? Math.round(stats.views / stats.count) : 0,
      videoCount: stats.count,
      totalViews: stats.views,
      multiplier: avgViews > 0 ? (stats.views / stats.count) / avgViews : 1,
      topVideo: stats.videos[0]
    })).sort((a, b) => b.avgViews - a.avgViews);
    
    setTopicPerformance(performance);
  }

  // Calculate content gaps
  const contentGaps = useMemo(() => {
    const gaps = [];
    
    // Topics competitors covered but you didn't (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const yourRecentTopics = new Set(
      channelVideos
        .filter(v => new Date(v.publish_date) > thirtyDaysAgo)
        .map(v => v.topic_id)
        .filter(Boolean)
    );
    
    const competitorTopics = {};
    competitorVideos
      .filter(v => new Date(v.published_at) > thirtyDaysAgo)
      .forEach(v => {
        const topic = v.detected_topic || v.topics?.[0];
        if (topic && !yourRecentTopics.has(topic)) {
          if (!competitorTopics[topic]) {
            competitorTopics[topic] = { count: 0, videos: [], totalViews: 0 };
          }
          competitorTopics[topic].count += 1;
          competitorTopics[topic].videos.push(v);
          competitorTopics[topic].totalViews += v.views || 0;
        }
      });
    
    Object.entries(competitorTopics).forEach(([topic, data]) => {
      if (data.count >= 2) { // At least 2 competitors covered it
        gaps.push({
          type: 'competitor_covered',
          topic,
          competitorCount: data.count,
          totalViews: data.totalViews,
          videos: data.videos.slice(0, 3)
        });
      }
    });
    
    // Topics audience asks about but not covered
    const questionTopics = {};
    audienceQuestions
      .filter(q => q.is_actionable || q.question)
      .forEach(q => {
        if (q.topic && q.topic !== 'general' && !yourRecentTopics.has(q.topic)) {
          if (!questionTopics[q.topic]) {
            questionTopics[q.topic] = { count: 0, questions: [] };
          }
          questionTopics[q.topic].count += 1;
          questionTopics[q.topic].questions.push(q.text || q.question);
        }
      });
    
    Object.entries(questionTopics).forEach(([topic, data]) => {
      if (data.count >= 3) { // At least 3 questions
        gaps.push({
          type: 'audience_demand',
          topic,
          questionCount: data.count,
          questions: data.questions.slice(0, 3)
        });
      }
    });
    
    return gaps.sort((a, b) => {
      const scoreA = (a.competitorCount || 0) * 10 + (a.questionCount || 0) * 5;
      const scoreB = (b.competitorCount || 0) * 10 + (b.questionCount || 0) * 5;
      return scoreB - scoreA;
    });
  }, [competitorVideos, audienceQuestions, channelVideos]);

  // Question stats
  const questionStats = useMemo(() => {
    const actionable = audienceQuestions.filter(q => q.is_actionable).length;
    const questions = audienceQuestions.filter(q => q.type === 'question' || q.question).length;
    const byTopic = {};
    
    audienceQuestions.forEach(q => {
      const topic = q.topic || 'general';
      byTopic[topic] = (byTopic[topic] || 0) + 1;
    });
    
    return {
      total: audienceQuestions.length,
      actionable,
      questions,
      byTopic: Object.entries(byTopic)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    };
  }, [audienceQuestions]);

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    let filtered = audienceQuestions;
    
    if (questionFilter === 'actionable') {
      filtered = filtered.filter(q => q.is_actionable);
    } else if (questionFilter === 'questions') {
      filtered = filtered.filter(q => q.type === 'question' || q.question);
    } else if (questionFilter !== 'all') {
      filtered = filtered.filter(q => q.topic === questionFilter);
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(q => 
        (q.text || '').toLowerCase().includes(search) ||
        (q.question || '').toLowerCase().includes(search)
      );
    }
    
    return filtered.slice(0, 100);
  }, [audienceQuestions, questionFilter, searchTerm]);

  async function handleDeleteCompetitor(id) {
    if (!confirm('Delete this competitor?')) return;
    
    try {
      const res = await fetch(`/api/competitors?competitorId=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchCompetitors();
      } else {
        console.error('Error deleting competitor:', data.error);
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting competitor:', error);
      alert('Error: ' + error.message);
    }
  }

  async function handleToggleTracking(competitor) {
    try {
      // Get auth headers
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const res = await fetch('/api/competitors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitorId: competitor.id,
          tracking_enabled: !competitor.tracking_enabled
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchCompetitors();
      } else {
        console.error('Error updating competitor:', data.error);
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating competitor:', error);
      alert('Error: ' + error.message);
    }
  }

  async function handleSyncCompetitor(competitor) {
    if (!competitor.youtube_channel_id) {
      alert('Please add a YouTube Channel ID first (click Edit)');
      return;
    }

    if (!confirm(`Sync videos from ${competitor.name}? This may take a few moments.`)) {
      return;
    }

    try {
      // Get auth headers
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const res = await fetch('/api/competitors/sync', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ competitorId: competitor.id })
      });

      const data = await res.json();
      if (data.success) {
        alert('Sync initiated! Videos will be fetched and saved.');
        // Refresh competitor videos after a short delay
        setTimeout(() => {
          fetchCompetitorVideos();
          fetchCompetitors();
        }, 2000);
      } else {
        console.error('Error syncing competitor:', data.error);
        alert('Error: ' + (data.error || 'Failed to sync competitor'));
      }
    } catch (error) {
      console.error('Error syncing competitor:', error);
      alert('Error: ' + error.message);
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'competitors', label: 'Competitors', icon: Users },
    { id: 'audience', label: 'Audience', icon: MessageSquare },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'gaps', label: 'Content Gaps', icon: Target },
    { id: 'radar', label: 'Radar', icon: Radio },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Content Intelligence
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Competitors, audience insights, and content opportunities
              </p>
            </div>
            <button
              onClick={fetchAllData}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-6 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{competitors.length}</p>
                    <p className="text-sm text-gray-500">Competitors</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{questionStats.actionable}</p>
                    <p className="text-sm text-gray-500">Actionable Questions</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                    <Target className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{contentGaps.length}</p>
                    <p className="text-sm text-gray-500">Content Gaps</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{topicPerformance[0]?.topic || '-'}</p>
                    <p className="text-sm text-gray-500">Top Topic</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Content Gaps */}
            {contentGaps.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    Top Opportunities
                  </h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {contentGaps.slice(0, 5).map((gap, idx) => (
                    <div key={idx} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {gap.topic}
                          </span>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            {gap.type === 'competitor_covered' && (
                              <>
                                <span className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5" />
                                  {gap.competitorCount} competitors
                                </span>
                                <span>{formatNumber(gap.totalViews)} views</span>
                              </>
                            )}
                            {gap.type === 'audience_demand' && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5" />
                                {gap.questionCount} questions
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`
                          px-2 py-1 text-xs rounded-full
                          ${gap.type === 'competitor_covered' 
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}
                        `}>
                          {gap.type === 'competitor_covered' ? 'Competitor Gap' : 'Audience Demand'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Competitor Videos */}
            {competitorVideos.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Youtube className="w-5 h-5 text-red-500" />
                    Recent Competitor Videos
                  </h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {competitorVideos.slice(0, 5).map((video, idx) => (
                    <div key={idx} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {video.title}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            <span>{video.competitors?.name}</span>
                            <span>{formatNumber(video.views)} views</span>
                            <span>{new Date(video.published_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <a
                          href={`https://youtube.com/watch?v=${video.youtube_video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* RADAR TAB */}
        {activeTab === 'radar' && (
          <div className="space-y-6">
            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Film className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {radarAlerts.direct.longForm.length}
                    </p>
                    <p className="text-sm text-gray-500">Direct Long-form</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Zap className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {radarAlerts.direct.shorts.length}
                    </p>
                    <p className="text-sm text-gray-500">Direct Shorts</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {radarAlerts.indirect.longForm.length + radarAlerts.indirect.shorts.length}
                    </p>
                    <p className="text-sm text-gray-500">Indirect Breakouts</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {radarAlerts.zones.attack.length}
                    </p>
                    <p className="text-sm text-gray-500">Attack Zones</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Radar sub-tabs */}
            <div className="flex gap-2 mt-2 border-b border-gray-200 dark:border-gray-800 pb-2">
              {[
                { id: 'direct', label: 'Direct Competitors' },
                { id: 'indirect', label: 'Indirect Breakouts' },
                { id: 'strategy', label: 'Strategy & Gaps' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRadarTab(tab.id)}
                  className={`
                    px-3 py-1.5 text-xs md:text-sm rounded-full border transition-colors
                    ${radarTab === tab.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'}
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* LONG-FORM SECTION */}
            {(radarTab === 'direct' || radarTab === 'indirect') && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-blue-50 dark:bg-blue-900/10 rounded-t-xl">
                <h2 className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <Film className="w-5 h-5" />
                  Long-form Radar
                </h2>
                <p className="text-sm text-blue-600 dark:text-blue-400/70">Videos longer than 90 seconds (last 7 days)</p>
              </div>
              
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {/* Direct Competitors - Long-form */}
                {radarTab === 'direct' && (
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Direct Competitors ({radarAlerts.direct.longForm.length} videos)
                  </h3>
                  
                  {radarAlerts.direct.longForm.length === 0 ? (
                    <p className="text-sm text-gray-500 pl-4">No new long-form videos in last 48 hours</p>
                  ) : (
                    <div className="space-y-3 pl-4">
                      {radarAlerts.direct.longForm.map((video, idx) => (
                        <div key={idx} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                                {video.competitors?.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {video.published_at ? new Date(video.published_at).toLocaleDateString() : 'Unknown date'}
                              </span>
                              <span
                                className={`
                                  px-1.5 py-0.5 text-xs rounded
                                  ${video.potentialForYou === 'High' 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : video.potentialForYou === 'Medium'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}
                                `}
                              >
                                {video.potentialForYou}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {video.title}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                              <span>{formatNumber(video.views)} views</span>
                              <span>{video.duration_seconds ? Math.round(video.duration_seconds / 60) : '?'} min</span>
                              <span
                                className={`
                                  px-1.5 py-0.5 rounded
                                  ${parseFloat(video.vsYourMedian) >= 1 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : parseFloat(video.vsYourMedian) >= 0.5
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}
                                `}
                              >
                                {video.vsYourMedian}x your median
                              </span>
                            </div>
                          </div>
                          <a
                            href={video.youtube_video_id ? `https://youtube.com/watch?v=${video.youtube_video_id}` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* Indirect Breakouts - Long-form */}
                {radarTab === 'indirect' && (
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Indirect Breakouts - DNA Match ({radarAlerts.indirect.longForm.length} videos)
                  </h3>
                  
                  {radarAlerts.indirect.longForm.length === 0 ? (
                    <p className="text-sm text-gray-500 pl-4">No breakouts matching your DNA topics</p>
                  ) : (
                    <div className="space-y-3 pl-4">
                      {radarAlerts.indirect.longForm.map((video, idx) => (
                        <div key={idx} className="flex items-start justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                                {video.competitors?.name}
                              </span>
                              <span className={`
                                px-2 py-0.5 text-xs rounded font-medium
                                ${video.severity === 'high' 
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : video.severity === 'medium'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}
                              `}>
                                {video.ratio}x breakout
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {video.title}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                              <span>{formatNumber(video.views)} views</span>
                              <span>{video.ratio}x their median</span>
                              <span
                                className={`
                                  px-1.5 py-0.5 rounded
                                  ${video.potentialForYou === 'High' 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}
                                `}
                              >
                                {video.vsYourMedian}x your median
                              </span>
                            </div>
                            {video.dnaMatch && (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                🎯 Matches: {video.dnaMatch.match}
                              </p>
                            )}
                          </div>
                          <a
                            href={video.youtube_video_id ? `https://youtube.com/watch?v=${video.youtube_video_id}` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>
            )}

            {/* SHORTS SECTION */}
            {(radarTab === 'direct' || radarTab === 'indirect') && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-purple-50 dark:bg-purple-900/10 rounded-t-xl">
                <h2 className="font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Shorts Radar
                </h2>
                <p className="text-sm text-purple-600 dark:text-purple-400/70">Videos 90 seconds or less (last 7 days)</p>
              </div>
              
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {/* Direct Competitors - Shorts */}
                {radarTab === 'direct' && (
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    Direct Competitors ({radarAlerts.direct.shorts.length} shorts)
                  </h3>
                  
                  {radarAlerts.direct.shorts.length === 0 ? (
                    <p className="text-sm text-gray-500 pl-4">No new shorts in last 48 hours</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4">
                      {radarAlerts.direct.shorts.map((video, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-gray-500 truncate">{video.competitors?.name}</span>
                              <span
                                className={`
                                  px-1.5 py-0.5 text-xs rounded
                                  ${video.potentialForYou === 'High' 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : video.potentialForYou === 'Medium'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}
                                `}
                              >
                                {video.potentialForYou}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 dark:text-white truncate">
                              {video.title}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                              <span>{formatNumber(video.views)} views</span>
                              <span
                                className={`
                                  px-1.5 py-0.5 rounded
                                  ${parseFloat(video.vsYourMedian) >= 1 
                                    ? 'bg-green-100 text-green-700'
                                    : parseFloat(video.vsYourMedian) >= 0.5
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-600'}
                                `}
                              >
                                {video.vsYourMedian}x yours
                              </span>
                            </div>
                          </div>
                          <a
                            href={video.youtube_video_id ? `https://youtube.com/watch?v=${video.youtube_video_id}` : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                          >
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {/* Indirect Breakouts - Shorts */}
                {radarTab === 'indirect' && (
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Indirect Breakouts - DNA Match ({radarAlerts.indirect.shorts.length} shorts)
                  </h3>
                  
                  {radarAlerts.indirect.shorts.length === 0 ? (
                    <p className="text-sm text-gray-500 pl-4">No shorts breakouts matching your DNA</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4">
                      {radarAlerts.indirect.shorts.map((video, idx) => (
                        <div key={idx} className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-purple-600 truncate">{video.competitors?.name}</span>
                            <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                              {video.ratio}x
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 dark:text-white truncate mb-1">
                            {video.title}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{formatNumber(video.views)} views</span>
                            <span
                              className={`
                                px-1.5 py-0.5 rounded
                                ${video.potentialForYou === 'High' 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}
                              `}
                            >
                              {video.vsYourMedian}x your median
                            </span>
                          </div>
                          {video.dnaMatch && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                              🎯 {video.dnaMatch.match}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>
            )}

            {/* STRATEGY & GAPS (Attack/Defend, Format, Competition, Open Fields) */}
            {radarTab === 'strategy' && (
            <>
            {/* ATTACK / DEFEND ZONES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Attack Zones */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-red-50 dark:bg-red-900/10 rounded-t-xl">
                  <h2 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Attack Zones
                  </h2>
                  <p className="text-sm text-red-600 dark:text-red-400/70">Competitors are beating you here</p>
                </div>
                {(!radarAlerts.zones.attack || radarAlerts.zones.attack.length === 0) ? (
                  <div className="p-6 text-center text-gray-500">
                    No attack opportunities detected
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    {radarAlerts.zones.attack.slice(0, 5).map((zone, idx) => (
                      <div key={idx} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900 dark:text-white">{zone.topic}</span>
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                            {zone.statusLabel}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mb-2">
                          <span>Your median: {formatNumber(zone.yourMedian)}</span>
                          {zone.bestCompetitor && (
                            <>
                              <span className="mx-2">vs</span>
                              <span>{zone.bestCompetitor}: {formatNumber(zone.bestCompetitorMedian)}</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                          💡 {zone.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Defend Zones */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-green-50 dark:bg-green-900/10 rounded-t-xl">
                  <h2 className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Defend Zones
                  </h2>
                  <p className="text-sm text-green-600 dark:text-green-400/70">You're leading here - protect it</p>
                </div>
                {(!radarAlerts.zones.defend || radarAlerts.zones.defend.length === 0) ? (
                  <div className="p-6 text-center text-gray-500">
                    No defend zones detected
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    {radarAlerts.zones.defend.slice(0, 5).map((zone, idx) => (
                      <div key={idx} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900 dark:text-white">{zone.topic}</span>
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                            {zone.statusLabel}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mb-2">
                          <span>Your median: {formatNumber(zone.yourMedian)}</span>
                          {zone.bestCompetitor && zone.bestCompetitorMedian > 0 && (
                            <>
                              <span className="mx-2">vs</span>
                              <span>{zone.bestCompetitor}: {formatNumber(zone.bestCompetitorMedian)}</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                          💡 {zone.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* FORMAT INSIGHTS */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Film className="w-5 h-5 text-purple-500" />
                  Format Insights
                </h2>
                <p className="text-sm text-gray-500">Long vs Short recommendations by topic</p>
              </div>
              
              {(!radarAlerts.formatInsights || radarAlerts.formatInsights.length === 0) ? (
                <div className="p-6 text-center text-gray-500">
                  No format insights available
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topic</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Your Long</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Your Short</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Comp Long</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Comp Short</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {radarAlerts.formatInsights.slice(0, 10).map((insight, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {insight.topic}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`
                              px-2 py-1 text-xs rounded
                              ${insight.yourLong.status === 'winning' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : insight.yourLong.status === 'losing'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}
                            `}>
                              {formatNumber(insight.yourLong.median)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`
                              px-2 py-1 text-xs rounded
                              ${insight.yourShort.status === 'winning' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : insight.yourShort.status === 'losing'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}
                            `}>
                              {formatNumber(insight.yourShort.median)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-500">
                            {formatNumber(insight.compLong.median)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-500">
                            {formatNumber(insight.compShort.median)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {insight.recommendation}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* COMPETITION STATS */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  Competition Stats by Topic
                </h2>
                <p className="text-sm text-gray-500">Detailed view of you vs competitors</p>
              </div>
              
              {(!radarAlerts.competitionStats || radarAlerts.competitionStats.length === 0) ? (
                <div className="p-6 text-center text-gray-500">
                  No competition stats available yet
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {radarAlerts.competitionStats.slice(0, 10).map((stat, idx) => (
                    <div key={idx} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-gray-900 dark:text-white">{stat.topic}</span>
                        <span className={`
                          px-2 py-1 text-xs rounded-full
                          ${stat.status === 'defend' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : stat.status === 'attack'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}
                        `}>
                          {stat.statusLabel}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {/* You */}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-24">You</span>
                          <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 rounded-full"
                              style={{ 
                                width: `${Math.min((stat.yourMedian / Math.max(stat.yourMedian, stat.bestCompetitorMedian || 1, 1)) * 100, 100)}%` 
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-400 w-28 text-right">
                            {formatNumber(stat.yourMedian)} ({stat.yourCount} videos)
                          </span>
                        </div>

                        {/* Top 2 competitors */}
                        {stat.competitorBreakdown.slice(0, 2).map((comp, cidx) => (
                          <div key={cidx} className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-24 truncate" title={comp.name}>
                              {comp.name}
                            </span>
                            <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${comp.type === 'direct' ? 'bg-red-400' : 'bg-purple-400'}`}
                                style={{ 
                                  width: `${Math.min((comp.median / Math.max(stat.yourMedian, stat.bestCompetitorMedian || 1, 1)) * 100, 100)}%` 
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-28 text-right">
                              {formatNumber(comp.median)} ({comp.count} videos)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>
            )}
          </div>
        )}

        {/* COMPETITORS TAB */}
        {activeTab === 'competitors' && (
          <div className="space-y-6">
            {/* Add Competitor Button */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Manage Competitors
                </h2>
                <p className="text-sm text-gray-500">
                  Track direct and indirect competitors
                </p>
              </div>
              <button
                onClick={() => setShowAddCompetitor(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Competitor
              </button>
            </div>

            {/* Competitor Types Explanation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <h3 className="font-medium text-blue-900 dark:text-blue-300 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Direct Competitors
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  Same niche, same language, fighting for the same audience
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                <h3 className="font-medium text-purple-900 dark:text-purple-300 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Indirect Competitors
                </h3>
                <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
                  Different language or adjacent niche - for inspiration and trend spotting
                </p>
              </div>
            </div>

            {/* Competitors List */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              {competitors.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500">No competitors added yet</p>
                  <button
                    onClick={() => setShowAddCompetitor(true)}
                    className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Add your first competitor
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {competitors.map(competitor => {
                    const competitorVideosList = competitorVideos.filter(v => v.competitor_id === competitor.id);
                    console.log(`📊 Competitor "${competitor.name}" (${competitor.id}): ${competitorVideosList.length} videos`);
                    return (
                      <CompetitorRow
                        key={competitor.id}
                        competitor={competitor}
                        videos={competitorVideosList}
                        onEdit={() => setEditingCompetitor(competitor)}
                        onDelete={() => handleDeleteCompetitor(competitor.id)}
                        onToggleTracking={() => handleToggleTracking(competitor)}
                        onSync={() => handleSyncCompetitor(competitor)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AUDIENCE TAB */}
        {activeTab === 'audience' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{questionStats.total}</p>
                <p className="text-sm text-gray-500">Total Comments</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <p className="text-3xl font-bold text-green-600">{questionStats.actionable}</p>
                <p className="text-sm text-gray-500">Actionable</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                <p className="text-3xl font-bold text-blue-600">{questionStats.questions}</p>
                <p className="text-sm text-gray-500">Questions</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
                />
              </div>
              <select
                value={questionFilter}
                onChange={(e) => setQuestionFilter(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <option value="all">All Comments</option>
                <option value="actionable">Actionable Only</option>
                <option value="questions">Questions Only</option>
                {questionStats.byTopic.map(([topic]) => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </select>
            </div>

            {/* Topic Breakdown */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Topics Breakdown</h3>
              <div className="flex flex-wrap gap-2">
                {questionStats.byTopic.map(([topic, count]) => (
                  <button
                    key={topic}
                    onClick={() => setQuestionFilter(topic)}
                    className={`
                      px-3 py-1.5 rounded-full text-sm transition-colors
                      ${questionFilter === topic
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}
                    `}
                  >
                    {topic} ({count})
                  </button>
                ))}
              </div>
            </div>

            {/* Questions List */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredQuestions.map((question, idx) => (
                  <div key={idx} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`
                        p-1.5 rounded-full mt-0.5
                        ${question.is_actionable 
                          ? 'bg-green-100 dark:bg-green-900/30' 
                          : 'bg-gray-100 dark:bg-gray-800'}
                      `}>
                        {question.type === 'question' || question.question ? (
                          <MessageSquare className={`w-3.5 h-3.5 ${question.is_actionable ? 'text-green-600' : 'text-gray-400'}`} />
                        ) : (
                          <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 dark:text-white text-sm">
                          {question.text || question.question}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          {question.topic && question.topic !== 'general' && (
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                              {question.topic}
                            </span>
                          )}
                          {question.likes > 0 && (
                            <span>👍 {question.likes}</span>
                          )}
                          {question.video_title && (
                            <span className="truncate max-w-[200px]">
                              from: {question.video_title}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PERFORMANCE TAB */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Topic Performance
                </h2>
                <p className="text-sm text-gray-500">
                  Which topics perform best for your channel
                </p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {topicPerformance.map((topic, idx) => (
                  <div key={idx} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {topic.topic}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span>{topic.videoCount} videos</span>
                          <span>{formatNumber(topic.avgViews)} avg views</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`
                          inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium
                          ${topic.multiplier >= 1.5 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : topic.multiplier >= 1
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}
                        `}>
                          {topic.multiplier.toFixed(1)}x average
                        </span>
                      </div>
                    </div>
                    {/* Performance bar */}
                    <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          topic.multiplier >= 1.5 ? 'bg-green-500' :
                          topic.multiplier >= 1 ? 'bg-blue-500' : 'bg-gray-400'
                        }`}
                        style={{ width: `${Math.min(topic.multiplier * 50, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GAPS TAB */}
        {activeTab === 'gaps' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-500" />
                  Content Gaps & Opportunities
                </h2>
                <p className="text-sm text-gray-500">
                  Topics your audience wants or competitors are covering
                </p>
              </div>
              
              {contentGaps.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
                  <p className="text-gray-500">No content gaps detected</p>
                  <p className="text-sm text-gray-400 mt-1">You're covering what matters!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {contentGaps.map((gap, idx) => (
                    <div key={idx} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {gap.topic}
                            </span>
                            <span className={`
                              px-2 py-0.5 text-xs rounded-full
                              ${gap.type === 'competitor_covered'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}
                            `}>
                              {gap.type === 'competitor_covered' ? 'Competitor Gap' : 'Audience Demand'}
                            </span>
                          </div>
                          
                          {gap.type === 'competitor_covered' && (
                            <div className="mt-2">
                              <p className="text-sm text-gray-500 mb-2">
                                {gap.competitorCount} competitors covered this • {formatNumber(gap.totalViews)} total views
                              </p>
                              <div className="space-y-1">
                                {gap.videos?.map((v, vidx) => (
                                  <p key={vidx} className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                    • {v.title}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {gap.type === 'audience_demand' && (
                            <div className="mt-2">
                              <p className="text-sm text-gray-500 mb-2">
                                {gap.questionCount} audience questions about this
                              </p>
                              <div className="space-y-1">
                                {gap.questions?.map((q, qidx) => (
                                  <p key={qidx} className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                    "{q}"
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Competitor Modal */}
      {(showAddCompetitor || editingCompetitor) && (
        <CompetitorModal
          competitor={editingCompetitor}
          showId={showId}
          onClose={() => {
            setShowAddCompetitor(false);
            setEditingCompetitor(null);
          }}
          onSave={() => {
            setShowAddCompetitor(false);
            setEditingCompetitor(null);
            fetchCompetitors();
          }}
        />
      )}
    </div>
  );
}

// Competitor Row Component
function CompetitorRow({ competitor, videos, onEdit, onDelete, onToggleTracking, onSync }) {
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const recentVideos = videos.slice(0, 5);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`
              p-2 rounded-lg
              ${competitor.type === 'direct' 
                ? 'bg-blue-100 dark:bg-blue-900/30' 
                : 'bg-purple-100 dark:bg-purple-900/30'}
            `}>
              <Youtube className={`w-5 h-5 ${
                competitor.type === 'direct' 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-purple-600 dark:text-purple-400'
              }`} />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {competitor.name}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className={`
                  px-2 py-0.5 rounded text-xs
                  ${competitor.type === 'direct' 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}
                `}>
                  {competitor.type}
                </span>
                <span>{videos.length} video{videos.length !== 1 ? 's' : ''} tracked</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {competitor.youtube_channel_id && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className={`p-2 rounded-lg transition-colors ${
                  syncing
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
                title="Sync videos from YouTube"
              >
                {syncing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              onClick={onToggleTracking}
              className={`p-2 rounded-lg transition-colors ${
                competitor.tracking_enabled
                  ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={competitor.tracking_enabled ? 'Tracking enabled' : 'Tracking disabled'}
            >
              {competitor.tracking_enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={onEdit}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              title="Edit competitor"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
              title="Delete competitor"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {recentVideos.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                title={expanded ? 'Collapse videos' : 'Expand videos'}
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {expanded && recentVideos.length > 0 && (
        <div className="px-4 pb-4 pl-14">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-2">
            {recentVideos.map((video, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
                  {video.title}
                </span>
                <span className="text-gray-500 ml-2">
                  {formatNumber(video.views)} views
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Competitor Modal Component
function CompetitorModal({ competitor, showId, onClose, onSave }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: competitor?.name || '',
    youtube_channel_id: competitor?.youtube_channel_id || '',
    type: competitor?.type || 'direct',
    notes: competitor?.notes || '',
    tracking_enabled: competitor?.tracking_enabled ?? true,
  });

  async function handleSubmit(e) {
    e.preventDefault();
    console.log('Form submitted:', form);
    setLoading(true);

    const data = {
      showId,
      name: form.name,
      youtube_channel_id: form.youtube_channel_id || null,
      type: form.type,
      notes: form.notes || null,
      tracking_enabled: form.tracking_enabled,
    };
    
    console.log('Saving to database:', data);

    try {
      const method = competitor ? 'PUT' : 'POST';
      const url = '/api/competitors';
      const body = competitor 
        ? { competitorId: competitor.id, ...data }
        : data;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await res.json();
      console.log('API result:', result);
      
      if (!result.success) {
        console.error('Error saving competitor:', result.error);
        alert('Error: ' + result.error);
        setLoading(false);
        return;
      }

      console.log('✅ Competitor saved successfully');
      setLoading(false);
      onSave();
    } catch (error) {
      console.error('Error saving competitor:', error);
      alert('Error: ' + error.message);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md m-4">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {competitor ? 'Edit Competitor' : 'Add Competitor'}
            </h2>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Channel Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., TechArabic"
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                YouTube Channel URL or ID
              </label>
              <input
                type="text"
                value={form.youtube_channel_id}
                onChange={(e) => setForm({ ...form, youtube_channel_id: e.target.value })}
                placeholder="e.g., https://www.youtube.com/@ChannelName or UC..."
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              />
              <p className="text-xs text-gray-500 mt-1">
                Paste the channel URL, @handle, or channel ID (UC...). The system will automatically convert URLs to channel IDs.
              </p>
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-300 mb-1">
                  Supported formats:
                </p>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
                  <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">https://www.youtube.com/@ChannelName</code></li>
                  <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">https://www.youtube.com/channel/UC...</code></li>
                  <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">@ChannelName</code></li>
                  <li><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">UCjMdgUQQM68S7tdXspE45Ag</code></li>
                </ul>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Competitor Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              >
                <option value="direct">Direct - Same audience</option>
                <option value="indirect">Indirect - Related niche</option>
                <option value="trendsetter">Trendsetter - News/media signals</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Why are you tracking this channel?"
                rows={2}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="tracking"
                checked={form.tracking_enabled}
                onChange={(e) => setForm({ ...form, tracking_enabled: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="tracking" className="text-sm text-gray-700 dark:text-gray-300">
                Enable video tracking
              </label>
            </div>
          </div>
          
          <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Saving...' : competitor ? 'Update' : 'Add Competitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper function
function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
  return num.toString();
}

export default function IntelligencePage() {
  return (
    <LayoutWithNav>
      <IntelligenceContent />
    </LayoutWithNav>
  );
}

