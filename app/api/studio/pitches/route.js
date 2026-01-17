import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePitchesForWinners } from '@/lib/smartPitch';
import { selectSignalsWithAI } from '@/lib/aiSignalSelector';
// STEP 2 FIX: Import same tiering functions used by Studio signals route
import {
  calculateIdeaScore,
  getUrgencyTier
} from '@/lib/scoring/multiSignalScoring';
import { generateTopicFingerprint } from '@/lib/topicIntelligence';
import { getShowPatterns, scoreSignalByPatterns } from '@/lib/behaviorPatterns';
import { getLearnedAdjustments } from '@/lib/learning/signalEffectiveness';

// Force dynamic rendering to prevent caching - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Source quality classification
const SOURCE_QUALITY = {
  // Tier 1: Premium financial/news sources (generate pitches from these)
  premium: [
    // Financial
    'bloomberg', 'reuters', 'ft.com', 'financial times', 'wsj', 'wall street journal',
    'economist', 'cnbc', 'forbes', 'fortune', 'business insider', 'marketwatch',
    'yahoo finance', 'investing.com', 'seekingalpha', 'barrons', 'morningstar',
    
    // Major news
    'nytimes', 'new york times', 'washingtonpost', 'washington post', 'guardian',
    'bbc', 'cnn', 'npr', 'ap news', 'associated press', 'afp',
    
    // Business/Tech
    'techcrunch', 'wired', 'arstechnica', 'theverge', 'the verge', 'axios',
    'politico', 'thehill', 'the hill',
    
    // Arabic premium
    'al jazeera', 'aljazeera', 'العربية', 'alarabiya', 'sky news arabia',
    'الشرق', 'asharq', 'الجزيرة', 'bbc arabic', 'france24'
  ],
  
  // Tier 2: Good news sources
  news: [
    // News aggregators
    'news.google', 'google news', 'news.yahoo',
    
    // Regional
    'arab news', 'gulf news', 'middle east eye', 'al-monitor', 'the national',
    'khaleej times', 'emirates247', 'zawya',
    
    // Other news
    'dailymail', 'independent', 'telegraph', 'mirror', 'express',
    'huffpost', 'huffington', 'vice', 'vox', 'slate', 'salon',
    
    // Industry specific
    'oilprice', 'oil price', 'energy', 'mining', 'commodity'
  ],
  
  // Tier 3: Support only (don't generate primary pitches)
  support: [
    'reddit', 'r/', 'wikipedia', 'wiki',
    'twitter', 'x.com', 'facebook', 'instagram', 'tiktok',
    'youtube', 'quora', 'medium.com'
  ]
};

/**
 * Get source quality tier
 */
function getSourceTier(source) {
  if (!source) return { tier: 'unknown', priority: 2 };
  
  const sourceLower = source.toLowerCase().trim();
  
  // Check premium first
  for (const premium of SOURCE_QUALITY.premium) {
    if (sourceLower.includes(premium.toLowerCase())) {
      return { tier: 'premium', priority: 1, matched: premium };
    }
  }
  
  // Check news
  for (const news of SOURCE_QUALITY.news) {
    if (sourceLower.includes(news.toLowerCase())) {
      return { tier: 'news', priority: 2, matched: news };
    }
  }
  
  // Check support
  for (const support of SOURCE_QUALITY.support) {
    if (sourceLower.includes(support.toLowerCase())) {
      return { tier: 'support', priority: 3, matched: support };
    }
  }
  
  // Special case: if source starts with "GN:" it's Google News (premium)
  if (sourceLower.startsWith('gn:')) {
    return { tier: 'premium', priority: 1, matched: 'google news' };
  }
  
  // Special case: if source contains domain patterns
  if (sourceLower.includes('.gov')) {
    return { tier: 'premium', priority: 1, matched: 'government' };
  }
  
  return { tier: 'unknown', priority: 2 };
}

/**
 * Check if source is suitable for pitch generation
 */
function isGeneratePitchSource(source) {
  const { tier } = getSourceTier(source);
  return tier !== 'support'; // Don't generate pitches from Reddit/Wikipedia
}

/**
 * GET /api/studio/pitches?showId=xxx
 * Returns top 13 pitches organized by tier
 */
export async function GET(request) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');
    const forceRegenerate = searchParams.get('forceRegenerate') === 'true';
    
    if (!showId) {
      return NextResponse.json(
        { success: false, error: 'showId is required' },
        { status: 400 }
      );
    }
    
    console.log(`📊 Generating smart pitches for show: ${showId}`);
    
    // 1. Fetch DNA Summary (fresh, no cache)
    console.log('🧬 Loading DNA Summary...');
    let dnaSummary = null;
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      // Add cache-busting timestamp to ensure fresh data
      const cacheBuster = `?t=${Date.now()}`;
      const dnaSummaryResponse = await fetch(`${baseUrl}/api/shows/${showId}/dna-summary${cacheBuster}`, {
        method: 'GET',
        headers: { 
          Cookie: request.headers.get('cookie') || '',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store' // Disable Next.js fetch caching
      });
      
      if (dnaSummaryResponse.ok) {
        const dnaData = await dnaSummaryResponse.json();
        
        // Handle both response formats
        // Format 1: { success: true, data: {...} } - DNA summary route returns this
        // Format 2: {...} (direct object) - Some routes return data directly
        if (dnaData && typeof dnaData === 'object') {
          if (dnaData.success === true && dnaData.data) {
            dnaSummary = dnaData.data;
          } else if (dnaData.data) {
            dnaSummary = dnaData.data;
          } else if (!dnaData.success && !dnaData.data) {
            dnaSummary = dnaData;
          } else {
            dnaSummary = dnaData?.data || dnaData || null;
          }
        } else {
          console.error('❌ Error: DNA response is not an object');
          dnaSummary = null;
        }
        
        if (!dnaSummary) {
          console.error('❌ Error: dnaSummary is null/undefined after parsing');
        }
        
        console.log(`✅ DNA loaded: ${dnaSummary?.dnaTopics?.length || 0} topics, ${dnaSummary?.winningPatterns?.length || 0} patterns`);
      } else {
        console.warn('⚠️ Could not load DNA summary, using fallback', {
          status: dnaSummaryResponse.status,
          statusText: dnaSummaryResponse.statusText
        });
      }
    } catch (error) {
      console.error('❌ Error loading DNA summary:', {
        message: error.message,
        stack: error.stack
      });
    }
    
    // CRITICAL FIX: Ensure dnaSummary is at least an empty object, not null
    // This prevents issues with destructuring and optional chaining
    if (!dnaSummary || (typeof dnaSummary === 'object' && Object.keys(dnaSummary).length === 0)) {
      // Create minimal structure if dnaSummary is empty/null
      dnaSummary = {
        dnaTopics: [],
        winningPatterns: [],
        audienceInterests: {
          fromVideos: [],
          fromComments: [],
          totalComments: 0,
          totalVideosAnalyzed: 0
        },
        identity: {},
        hooksThatsWork: [],
        recentlyCovered: [],
        competitorTrends: { trending: [], gaps: [] },
        sourcePreferences: { preferred: [], avoided: [] },
        meta: {}
      };
    }
    
    // STEP 1: Load enabled sources from signal_sources to map source name -> URL
    let sourceUrlMap = {};
    try {
      const { data: signalSources } = await supabase
        .from('signal_sources')
        .select('name, url, enabled')
        .eq('show_id', showId)
        .eq('enabled', true);
      
      if (signalSources && signalSources.length > 0) {
        signalSources.forEach(source => {
          sourceUrlMap[source.name] = source.url;
        });
        console.log(`[Pitches] Loaded ${Object.keys(sourceUrlMap).length} enabled sources from signal_sources`);
      }
    } catch (err) {
      console.warn('[Pitches] Error loading signal_sources (non-fatal):', err.message);
    }
    
    // Universal source quality classifier
    function classifySourceQuality(sourceType, sourceUrl) {
      if (!sourceType || sourceType !== 'rss') {
        return 'community'; // Non-RSS sources (Reddit, etc.)
      }
      
      if (!sourceUrl) {
        return 'supported'; // Unknown if no URL
      }
      
      const urlLower = sourceUrl.toLowerCase();
      
      // Direct feed (NOT Google News) = premium
      if (!urlLower.startsWith('https://news.google.com/')) {
        return 'premium';
      }
      
      // Google News with publisher restriction (site: or site%3A) = premium
      if (urlLower.includes('q=site:') || urlLower.includes('q=site%3a')) {
        return 'premium';
      }
      
      // Google News topical feed = supported
      return 'supported';
    }
    
    // 2. Fetch signals (last 14 days) - include competitor fields
    const { data: signals, error: signalsError } = await supabase
      .from('signals')
      .select('*, competitor_boost, competitor_evidence')
      .eq('show_id', showId)
      .eq('is_visible', true)
      .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('score', { ascending: false })
      .limit(100);
    
    if (signalsError) {
      console.error('❌ Error fetching signals:', signalsError);
      return NextResponse.json(
        { success: false, error: signalsError.message },
        { status: 500 }
      );
    }
    
    if (!signals || signals.length === 0) {
      return NextResponse.json({
        success: true,
        data: { postToday: [], thisWeek: [], evergreen: [] },
        meta: { totalSignals: 0, message: 'No signals found' }
      });
    }
    
    console.log(`📥 Fetched ${signals.length} signals`);
    
    // 3. Enrich signals with ALL available data and classify by source quality
    const enrichedSignals = signals.map(signal => {
      // Calculate hours old using detected_at if available, else created_at
      // NOTE: signals table uses 'detected_at' or 'created_at', NOT 'source_published_at'
      const publishDate = signal.detected_at || signal.created_at;
      const hoursOld = (Date.now() - new Date(publishDate).getTime()) / (1000 * 60 * 60);
      
      // STEP 3: Attach source_quality using universal classifier (not hardcoded list)
      const sourceName = signal.source || signal.source_name || '';
      const sourceUrl = sourceUrlMap[sourceName] || signal.url || signal.source_url || signal.raw_data?.url || '';
      const sourceType = signal.raw_data?.sourceType || signal.source_type || 'rss'; // Default to 'rss' if not specified
      const source_quality = classifySourceQuality(sourceType, sourceUrl);
      
      // Legacy sourceQuality (for backward compatibility with existing code)
      const sourceQuality = getSourceTier(sourceName);
      
      return {
        ...signal,
        hoursOld: hoursOld,
        // Universal source quality (for tiering gate)
        source_quality: source_quality,
        // Legacy source quality (for pitch generation filtering)
        sourceQuality: sourceQuality,
        isPitchSource: isGeneratePitchSource(signal.source || signal.source_name),
        // DNA data
        dnaMatch: signal.matched_topic || signal.dna_match || null,
        dnaMatchId: signal.matched_topic_id || signal.dna_match_id || null,
        matchedKeywords: signal.matched_keywords || [],
        // Competitor data - use as-is from database
        competitor_boost: signal.competitor_boost || 0,
        competitor_evidence: signal.competitor_evidence || [],
        competitorCount: Array.isArray(signal.competitor_evidence) ? signal.competitor_evidence.length : 0,
        // Source info
        actualPublishDate: signal.detected_at || signal.created_at,
        // Reddit score if available
        redditScore: signal.reddit_score || signal.engagement_score || 0
      };
    });
    
    // Classify signals by source quality
    const premiumSignals = enrichedSignals.filter(s => s.sourceQuality.tier === 'premium');
    const newsSignals = enrichedSignals.filter(s => s.sourceQuality.tier === 'news');
    const supportSignals = enrichedSignals.filter(s => s.sourceQuality.tier === 'support');
    const unknownSignals = enrichedSignals.filter(s => s.sourceQuality.tier === 'unknown');
    
    console.log(`📊 Signal Sources: ${premiumSignals.length} premium, ${newsSignals.length} news, ${supportSignals.length} support (Reddit/Wiki), ${unknownSignals.length} unknown`);
    
    // Log unknown sources for classification
    if (unknownSignals.length > 0) {
      const uniqueUnknownSources = [...new Set(
        unknownSignals
          .map(s => s.source || s.source_name || 'Unknown')
          .filter(s => s && s !== 'Unknown')
      )].slice(0, 15);
      
      if (uniqueUnknownSources.length > 0) {
        console.log(`❓ Unknown sources (${uniqueUnknownSources.length} unique):`, uniqueUnknownSources);
      }
    }
    
    // Log competitor data availability
    const withBoost = enrichedSignals.filter(s => s.competitor_boost > 0).length;
    const withEvidence = enrichedSignals.filter(s => Array.isArray(s.competitor_evidence) && s.competitor_evidence.length > 0).length;
    console.log(`🎯 Competitor data: ${withBoost} with boost, ${withEvidence} with evidence`);
    
    
    // Log unknown sources for identification
    if (unknownSignals.length > 0) {
      const uniqueUnknownSources = [...new Set(
        unknownSignals
          .map(s => s.source || s.source_name || 'Unknown')
          .filter(s => s && s !== 'Unknown')
      )].slice(0, 15);
      
      if (uniqueUnknownSources.length > 0) {
        console.log(`❓ Unknown sources (${uniqueUnknownSources.length} unique):`, uniqueUnknownSources);
      }
    }
    
    // 3.5. Separate signals with existing pitches from those needing generation
    const signalsWithExistingPitch = [];
    const signalsNeedingPitch = [];

    // Check for force regenerate flag
    if (forceRegenerate) {
      console.log('🔄 Force regenerate requested - skipping cache, will regenerate all pitches');
    }

    enrichedSignals.forEach(signal => {
      const existingPitch = signal.raw_data?.recommendation?.pitch;
      const pitchGeneratedAt = signal.raw_data?.recommendation?.pitch_generated_at;
      
      // Check if pitch exists and signal is not rejected/produced
      // Skip cache if forceRegenerate is true
      if (existingPitch && !forceRegenerate && signal.status !== 'rejected' && signal.status !== 'produced') {
        signalsWithExistingPitch.push({
          signal,
          pitch: existingPitch,
          pitchGeneratedAt,
          fromCache: true
        });
      } else if (signal.status !== 'rejected' && signal.status !== 'produced') {
        signalsNeedingPitch.push(signal);
      }
    });

    if (forceRegenerate) {
      console.log(`📋 Force regenerate: ${signalsNeedingPitch.length} signals will be regenerated`);
    } else {
      console.log(`📋 Pitches: ${signalsWithExistingPitch.length} cached, ${signalsNeedingPitch.length} need generation`);
    }
    
    // 4. Pre-filter with source quality priority (filter from signalsNeedingPitch)
    const needingPitchPremium = signalsNeedingPitch.filter(s => s.sourceQuality.tier === 'premium');
    const needingPitchNews = signalsNeedingPitch.filter(s => s.sourceQuality.tier === 'news');
    const needingPitchSupport = signalsNeedingPitch.filter(s => s.sourceQuality.tier === 'support');
    const needingPitchUnknown = signalsNeedingPitch.filter(s => s.sourceQuality.tier === 'unknown');
    
    // Sort each tier by score, then combine with priority
    const sortedPremium = needingPitchPremium.sort((a, b) => (b.score || 0) - (a.score || 0));
    const sortedNews = needingPitchNews.sort((a, b) => (b.score || 0) - (a.score || 0));
    const sortedSupport = needingPitchSupport.sort((a, b) => (b.score || 0) - (a.score || 0));
    const sortedUnknown = needingPitchUnknown.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // Prioritize premium and news sources, limit support sources
    const pitchCandidates = [
      ...sortedPremium.slice(0, 20),  // Up to 20 premium
      ...sortedNews.slice(0, 15),     // Up to 15 news
      ...sortedSupport.slice(0, 5),   // Only 5 Reddit/support (for trend context)
      ...sortedUnknown.slice(0, 10)    // Up to 10 unknown
    ].slice(0, 30); // Max 30 candidates
    
    const premiumCount = pitchCandidates.filter(s => s.sourceQuality.tier === 'premium').length;
    const qualityCount = pitchCandidates.filter(s => s.sourceQuality.tier !== 'support').length;
    
    console.log(`📥 Pitch candidates: ${premiumCount} premium, ${qualityCount} total quality (out of ${pitchCandidates.length} total)`);
    
    // Pre-filtered signals (for AI selection) - will be replaced with tiered version
    let preFiltered = pitchCandidates;
    
    console.log(`🔍 Pre-filtered to ${preFiltered.length} candidates (prioritizing premium sources)`);
    
    // STEP 2 FIX: Calculate Studio-tiered tiers for preFiltered signals (align with Studio signals route)
    // This ensures pitch tiers match Studio signal tiers (single source of truth)
    console.log('[Pitches] Calculating Studio-tiered tiers for pitch candidates...');
    
    // Load data needed for tier calculation (same as Studio signals route)
    let dnaTopics = [];
    try {
      const { loadTopics } = await import('@/lib/taxonomy/unifiedTaxonomyService');
      dnaTopics = await loadTopics(showId, supabase);
      console.log(`[Pitches] Loaded ${dnaTopics.length} DNA topics for tier calculation`);
    } catch (err) {
      console.warn('[Pitches] Error loading DNA topics (non-fatal):', err.message);
    }
    
    // Load competitor videos for tier calculation
    let normalizedCompetitorVideos = [];
    try {
      const { data: competitorVideosRaw } = await supabase
        .from('competitor_videos')
        .select(`
          id, title, description, youtube_video_id, views, performance_ratio,
          is_success, published_at, competitor_id,
          competitors!competitor_id (id, name, type, show_id)
        `)
        .gte('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('views', { ascending: false })
        .limit(200);
      
      const competitorVideos = (competitorVideosRaw || []).filter(
        cv => cv.competitors && cv.competitors.show_id === showId
      );
      
      normalizedCompetitorVideos = (competitorVideos || []).map(video => ({
        ...video,
        views: video.views || 0,
        published_at: video.published_at || video.publish_date,
        publish_date: video.publish_date || video.published_at,
        title: video.title || '',
        description: video.description || '',
        competitor_id: video.competitor_id || video.competitors?.id,
        video_id: video.youtube_video_id || video.video_id || video.id,
        youtube_video_id: video.youtube_video_id || video.video_id || video.id,
        competitors: video.competitors || {},
      }));
      
      console.log(`[Pitches] Loaded ${normalizedCompetitorVideos.length} competitor videos for tier calculation`);
    } catch (err) {
      console.warn('[Pitches] Error loading competitor videos (non-fatal):', err.message);
    }
    
    // Load user videos for tier calculation
    let normalizedUserVideos = [];
    try {
      const { data: channelVideos } = await supabase
        .from('channel_videos')
        .select('*')
        .eq('show_id', showId)
        .order('publish_date', { ascending: false })
        .limit(200);
      
      if (channelVideos && channelVideos.length > 0) {
        normalizedUserVideos = channelVideos.map(video => ({
          ...video,
          title: video.title_ar || video.title_en || video.title || '',
          published_at: video.publish_date || video.published_at,
          publish_date: video.publish_date || video.published_at,
          description: video.description || video.desc || '',
          topic_id: video.topic_id || video.topic || null,
          video_id: video.video_id || video.id,
          youtube_url: video.youtube_url || (video.video_id ? `https://www.youtube.com/watch?v=${video.video_id}` : null),
        }));
        console.log(`[Pitches] Loaded ${normalizedUserVideos.length} user videos from channel_videos`);
      }
    } catch (err) {
      console.warn('[Pitches] Error loading user videos (non-fatal):', err.message);
    }
    
    // Get excluded names
    let excludedNames = [];
    try {
      const { getExcludedNames } = await import('@/lib/entities/channelEntities');
      excludedNames = await getExcludedNames(showId);
    } catch (err) {
      console.warn('[Pitches] Error loading excluded names (non-fatal):', err.message);
    }
    
    // Get behavior patterns and learned weights
    let showPatterns = {};
    let learnedWeights = {};
    try {
      [showPatterns, learnedWeights] = await Promise.all([
        getShowPatterns(showId, false),
        getLearnedAdjustments(showId, 90)
      ]);
    } catch (err) {
      console.warn('[Pitches] Error loading patterns/learning (non-fatal):', err.message);
    }
    
    // Extract dnaData for getUrgencyTier (same format as Studio signals route)
    const dnaDataForTier = dnaSummary ? {
      audienceInterests: dnaSummary.audienceInterests || { fromVideos: [], fromComments: [] },
      topicPerformance: dnaSummary.dnaTopics?.reduce((acc, topic) => {
        acc[topic.id] = {
          performanceRatio: topic.performanceRatio || 1.0,
          avgViews: topic.avgViews || 0,
          videoCount: topic.videoCount || 0,
          isCore: topic.isCore || false
        };
        return acc;
      }, {}) || {},
      formatPerformanceByTopic: dnaSummary.formatPerformanceByTopic || {},
      winningPatterns: dnaSummary.winningPatterns || []
    } : null;
    
    // Calculate tiers for preFiltered signals (same logic as Studio signals route)
    const preFilteredWithTiers = await Promise.all(preFiltered.map(async (signal) => {
      try {
        // Calculate real score
        const scoringResult = await calculateIdeaScore(signal, {
          competitorVideos: normalizedCompetitorVideos,
          userVideos: normalizedUserVideos,
          dnaTopics: dnaTopics,
          signalTitle: signal.title || '',
          signalDescription: signal.description || signal.raw_data?.description || '',
          signalPublishedAt: signal.created_at || signal.published_at,
          signalTopicId: signal.topic_id,
          sourceUrl: signal.url || signal.source_url || signal.raw_data?.url || null,
          sourceTitle: signal.source || signal.source_name || signal.raw_data?.sourceName || null,
          sourceCount: 1,
        }, excludedNames);
        
        const realScore = scoringResult?.score ?? 0;
        const scoringSignals = scoringResult?.signals || [];
        const competitorBreakdown = scoringResult?.competitorBreakdown || {};
        
        // STEP 4: Attach source_quality to signal before calling getUrgencyTier
        // (source_quality already attached in enrichedSignals, but ensure it's passed through)
        const signalWithQuality = {
          ...signal,
          source_quality: signal.source_quality || 'supported' // Fallback if missing
        };
        
        // Calculate tier using getUrgencyTier (same as Studio signals route)
        const tierResult = getUrgencyTier(
          {
            score: realScore,
            signals: scoringSignals,
            competitorBreakdown: competitorBreakdown
          },
          signalWithQuality,
          dnaDataForTier
        );
        
        // Store tier from Studio tiering logic (source of truth)
        return {
          ...signal,
          tier: tierResult.tier, // 'post_today', 'this_week', or 'backlog' (from getUrgencyTier)
          tierInfo: tierResult, // Full tier object with priority, triggers, demandType
          urgency_tier: tierResult, // Alias for consistency
          realScore: realScore, // Computed score
          scoringSignals: scoringSignals,
          competitorBreakdown: competitorBreakdown
        };
      } catch (err) {
        console.warn(`[Pitches] Error calculating tier for signal "${signal.title?.substring(0, 40)}...":`, err.message);
        // Fallback: no tier assigned (will use aiTier as fallback)
        return {
          ...signal,
          tier: null,
          tierInfo: null,
          urgency_tier: null
        };
      }
    }));
    
    console.log(`[Pitches] Calculated tiers for ${preFilteredWithTiers.length} signals`);
    const tierCounts = {
      post_today: preFilteredWithTiers.filter(s => s.tier === 'post_today').length,
      this_week: preFilteredWithTiers.filter(s => s.tier === 'this_week').length,
      backlog: preFilteredWithTiers.filter(s => s.tier === 'backlog').length,
      null: preFilteredWithTiers.filter(s => !s.tier).length
    };
    console.log(`[Pitches] Tier distribution: post_today=${tierCounts.post_today}, this_week=${tierCounts.this_week}, backlog=${tierCounts.backlog}, null=${tierCounts.null}`);
    
    // STEP 2 FIX: Replace preFiltered with tiered version (includes Studio-tiered tiers) for AI selection
    preFiltered = preFilteredWithTiers;
    
    // 5. AI Selection based on DNA (AI selection now only for pitch quality, NOT tier assignment)
    console.log('🤖 AI selecting best signals based on DNA...');
    const aiSelection = await selectSignalsWithAI(preFiltered, dnaSummary || {});
    
    if (!aiSelection.selections || aiSelection.selections.length === 0) {
      console.warn('⚠️ AI returned no selections, using fallback');
      // Fallback to score-based selection (2 per tier = 6 total)
      return NextResponse.json({
        success: true,
        data: {
          postToday: preFiltered.slice(0, 2).map(s => ({ signal: s, pitch: null, tier: 'post_today' })),
          thisWeek: preFiltered.slice(2, 4).map(s => ({ signal: s, pitch: null, tier: 'this_week' })),
          evergreen: preFiltered.slice(4, 6).map(s => ({ signal: s, pitch: null, tier: 'evergreen' }))
        },
        meta: { totalSignals: signals.length, aiSelection: false, fallback: true }
      });
    }
    
    // 6. Map AI selections back to signals
    let selectedSignals = aiSelection.selections.map(sel => {
      const signal = preFiltered[sel.signalIndex];
      // Ensure aiReason is meaningful (fallback to topic-based reason if missing)
      let aiReason = sel.fitReason;
      if (!aiReason || aiReason.trim() === '' || aiReason === 'Diversity padding') {
        const topic = signal.matched_topic || signal.dnaMatch || signal.dnaMatchId || 'general topic';
        // Format topic name nicely (handle snake_case, camelCase, etc.)
        const topicName = typeof topic === 'string' 
          ? topic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          : 'this topic';
        aiReason = topic !== 'general topic' && topic !== 'general'
          ? `Selected to cover ${topicName} - a key channel topic.`
          : `Selected for audience interest and content fit.`;
      }
      return {
        ...signal,
        aiTier: sel.tier,
        aiReason: aiReason,
        aiAngle: sel.suggestedAngle,
        aiPattern: sel.patternToUse,
        aiFitScore: sel.fitScore
      };
    });
    
    console.log(`✅ AI selected ${selectedSignals.length} signals`);
    
    // 6.5. Apply topic diversity filter (ensure max 1 per topic per tier)
    function ensureTopicDiversity(signals, maxPerTopicPerTier = 1) {
      const topicCountsByTier = {
        post_today: {},
        this_week: {},
        evergreen: {}
      };
      const diverseSignals = [];
      
      for (const signal of signals) {
        // Get the matched DNA topic
        const topic = signal.matched_topic || 
                     signal.dnaMatch || 
                     signal.dnaMatchId || 
                     'general';
        // STEP 2 FIX: Use Studio tier (signal.tier) instead of aiTier for bucket assignment
        const tier = signal.tier || signal.aiTier || 'backlog'; // Prefer Studio tier, fallback to aiTier, then backlog
        
        // Initialize count for this tier
        if (!topicCountsByTier[tier]) {
          topicCountsByTier[tier] = {};
        }
        if (!topicCountsByTier[tier][topic]) {
          topicCountsByTier[tier][topic] = 0;
        }
        
        // Only include if we haven't exceeded the limit for this topic in this tier
        if (topicCountsByTier[tier][topic] < maxPerTopicPerTier) {
          diverseSignals.push(signal);
          topicCountsByTier[tier][topic]++;
        } else {
          console.log(`⏭️ Skipping "${signal.title?.substring(0, 30)}..." - already have ${maxPerTopicPerTier} for topic "${topic}" in tier "${tier}"`);
        }
      }
      
      // Log topic distribution
      const topicCounts = {};
      Object.keys(topicCountsByTier).forEach(tier => {
        Object.keys(topicCountsByTier[tier]).forEach(topic => {
          if (!topicCounts[topic]) topicCounts[topic] = 0;
          topicCounts[topic] += topicCountsByTier[tier][topic];
        });
      });
      
      console.log(`🎯 Topic diversity: ${Object.keys(topicCounts).length} unique topics from ${signals.length} signals`);
      console.log(`📊 Topic distribution:`, topicCounts);
      console.log(`📊 By tier:`, {
        post_today: Object.keys(topicCountsByTier.post_today || {}).length,
        this_week: Object.keys(topicCountsByTier.this_week || {}).length,
        evergreen: Object.keys(topicCountsByTier.evergreen || {}).length
      });
      
      return diverseSignals;
    }
    
    // Apply diversity filter
    selectedSignals = ensureTopicDiversity(selectedSignals, 1);
    
    // Apply economic filter for Post Today tier (only signals with clear economic angle)
    // Import hasEconomicAngle function
    const { hasEconomicAngle } = await import('@/lib/smartPitch');
    
    // STEP 2 FIX: Economic angle check now uses Studio tier (signal.tier), not aiTier
    selectedSignals = selectedSignals.map(signal => {
      // Only apply economic check if Studio tier is post_today (not if AI suggested it)
      if (signal.tier === 'post_today') {
        const economic = hasEconomicAngle(signal);
        if (!economic.hasEconomicAngle) {
          console.log(`⏬ Downgrading "${signal.title?.substring(0, 30)}..." from Post Today - no clear economic angle (found: ${economic.economicKeywords.join(', ') || 'none'})`);
          signal.tier = 'this_week'; // Downgrade Studio tier (source of truth)
          // Keep aiTier as-is for reference
        }
      }
      return signal;
    });
    
    // STEP 1 FIX: Remove Post Today diversity padding - Post Today must NOT be forced to 2
    // STEP 2 FIX: Use Studio tier (signal.tier) instead of aiTier for bucket assignment
    const postTodaySignals = selectedSignals.filter(s => s.tier === 'post_today' || s.tier === 'today');
    const thisWeekSignals = selectedSignals.filter(s => s.tier === 'this_week' || s.tier === 'week');
    const evergreenSignals = selectedSignals.filter(s => s.tier === 'backlog' || s.tier === 'evergreen');
    
    // Log Post Today count before any padding
    console.log(`[Pitches] Post Today before padding: ${postTodaySignals.length} (max 2, but NOT forced)`);
    
    // ⚠️ REMOVED: Post Today diversity padding (lines 497-521)
    // Post Today can be 0, 1, or 2 depending on what qualifies - DO NOT force fill
    // This prevents weak signals (49, 51) from getting Post Today just for topic diversity
    
    // Keep diversity padding ONLY for This Week and Evergreen (acceptable for planning)
    // STEP 2 FIX: Use Studio tier when padding (ensure padded signals have tier set)
    if (thisWeekSignals.length < 2) {
      const remaining = preFiltered
        .filter(s => !selectedSignals.some(sel => sel.id === s.id))
        .filter(s => {
          const topic = s.matched_topic || s.dnaMatch || 'general';
          return !thisWeekSignals.some(p => (p.matched_topic || p.dnaMatch) === topic);
        })
        .slice(0, 2 - thisWeekSignals.length);
      
      remaining.forEach(s => {
        const topic = s.matched_topic || s.dnaMatch || s.dnaMatchId || 'general topic';
        // Format topic name nicely (handle snake_case, camelCase, etc.)
        const topicName = typeof topic === 'string' 
          ? topic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          : 'this topic';
        const reason = topic !== 'general topic' && topic !== 'general'
          ? `Selected to cover ${topicName} - a key channel topic for topic diversity.`
          : `Selected for topic diversity and audience interest.`;
        selectedSignals.push({
          ...s,
          aiTier: 'this_week',
          aiReason: reason,
          aiFitScore: s.score || 0
        });
      });
    }
    
    if (evergreenSignals.length < 2) {
      const remaining = preFiltered
        .filter(s => !selectedSignals.some(sel => sel.id === s.id))
        .filter(s => {
          const topic = s.matched_topic || s.dnaMatch || 'general';
          return !evergreenSignals.some(p => (p.matched_topic || p.dnaMatch) === topic);
        })
        .slice(0, 2 - evergreenSignals.length);
      
      remaining.forEach(s => {
        const topic = s.matched_topic || s.dnaMatch || s.dnaMatchId || 'general topic';
        // Format topic name nicely (handle snake_case, camelCase, etc.)
        const topicName = typeof topic === 'string' 
          ? topic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          : 'this topic';
        const reason = topic !== 'general topic' && topic !== 'general'
          ? `Selected to cover ${topicName} - a key channel topic for topic diversity.`
          : `Selected for topic diversity and audience interest.`;
        selectedSignals.push({
          ...s,
          tier: 'backlog', // STEP 2 FIX: Set Studio tier for padded signal (backlog = evergreen in Studio)
          aiTier: 'evergreen', // Keep for reference
          aiReason: reason,
          aiFitScore: s.score || 0
        });
      });
    }
    
    // Final filter to ensure max 2 per tier (Post Today NOT forced to 2)
    // STEP 2 FIX: Use Studio tier (signal.tier) instead of aiTier for bucket assignment
    // Sort Post Today by priority (from tierInfo) then by score, same as Studio signals route
    const finalPostToday = selectedSignals
      .filter(s => s.tier === 'post_today' || s.tier === 'today')
      .sort((a, b) => {
        const priorityA = a.tierInfo?.priority || a.urgency_tier?.priority || (a.realScore || a.score || 0);
        const priorityB = b.tierInfo?.priority || b.urgency_tier?.priority || (b.realScore || b.score || 0);
        if (priorityB !== priorityA) return priorityB - priorityA;
        return (b.realScore || b.score || 0) - (a.realScore || a.score || 0);
      })
      .slice(0, 2);
    const finalThisWeek = selectedSignals
      .filter(s => s.tier === 'this_week' || s.tier === 'week')
      .sort((a, b) => (b.realScore || b.score || 0) - (a.realScore || a.score || 0))
      .slice(0, 2);
    const finalEvergreen = selectedSignals
      .filter(s => s.tier === 'backlog' || s.tier === 'evergreen')
      .sort((a, b) => (b.realScore || b.score || 0) - (a.realScore || a.score || 0))
      .slice(0, 2);
    
    selectedSignals = [...finalPostToday, ...finalThisWeek, ...finalEvergreen];
    
    console.log(`✅ After diversity filter: ${selectedSignals.length} signals (${finalPostToday.length} post_today, ${finalThisWeek.length} this_week, ${finalEvergreen.length} evergreen)`);
    console.log(`[Pitches] Final tiers counts: post_today=${finalPostToday.length}, this_week=${finalThisWeek.length}, evergreen=${finalEvergreen.length}`);
    if (finalPostToday.length > 0) {
      console.log(`[Pitches] Post Today titles: ${finalPostToday.slice(0, 5).map(s => `"${s.title?.substring(0, 40)}..."`).join(', ')}`);
    }
    
    // 6.6. Store show DNA at top level for single display (not per pitch)
    const showDNAForDisplay = dnaSummary ? {
      name: dnaSummary.identity?.name,
      channelCovers: dnaSummary.identity?.channelCovers,
      targetAudience: dnaSummary.identity?.targetAudience,
      language: dnaSummary.identity?.primaryLanguage,
      dnaTopics: dnaSummary.dnaTopics?.map(t => t.nameEn || t.nameAr || t.id).slice(0, 10) || [],
      patterns: dnaSummary.winningPatterns?.slice(0, 5).map(p => ({
        name: p.nameAr || p.name,
        multiplier: p.multiplier
      })) || [],
      hookExamples: dnaSummary.hooksThatsWork?.slice(0, 3).map(h => ({
        videoTitle: h.videoTitle,
        views: h.views,
        hook: h.hook?.substring(0, 150)
      })) || []
    } : null;
    
    // 7. Generate pitches with DNA context
    // Pass all enriched signals for Reddit context lookup
    
    // Ensure dnaSummary is valid before passing
    const dnaSummaryToPass = dnaSummary && typeof dnaSummary === 'object' && Object.keys(dnaSummary).length > 0
      ? dnaSummary
      : {
          dnaTopics: [],
          winningPatterns: [],
          audienceInterests: { fromVideos: [], fromComments: [], totalComments: 0, totalVideosAnalyzed: 0 },
          identity: {},
          hooksThatsWork: [],
          recentlyCovered: [],
          competitorTrends: { trending: [], gaps: [] },
          sourcePreferences: { preferred: [], avoided: [] },
          meta: {}
        };
    
    // Generate pitches only for signals that need them (not cached)
    const result = await generatePitchesForWinners(selectedSignals, showId, {
      dnaSummary: dnaSummaryToPass,
      aiSelections: aiSelection.selections,
      allSignals: enrichedSignals // For finding related Reddit context
    });
    
    // 7.5. Save newly generated pitches to database
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    let savedPitchesCount = 0;
    const allPitchesToSave = [
      ...(result.pitches.postToday || []),
      ...(result.pitches.thisWeek || []),
      ...(result.pitches.evergreen || [])
    ].filter(p => p.pitch && p.signal?.id); // Only pitches with signal ID
    
    if (allPitchesToSave.length > 0) {
      console.log(`💾 Saving ${allPitchesToSave.length} new pitches to database...`);
      
      for (const pitchResult of allPitchesToSave) {
        if (!pitchResult.signal?.id || !pitchResult.pitch) continue;
        
        try {
          const existingRawData = pitchResult.signal.raw_data || {};
          const existingRecommendation = existingRawData.recommendation || {};
          
          const updatedRawData = {
            ...existingRawData,
            recommendation: {
              ...existingRecommendation,
              pitch: pitchResult.pitch,
              pitch_generated: true,
              pitch_generated_at: new Date().toISOString(),
              pitch_type: pitchResult.pitch?.recommendedFormat || pitchResult.pitch?.format || 'long_form'
            }
          };
          
          await supabaseAdmin
            .from('signals')
            .update({ raw_data: updatedRawData })
            .eq('id', pitchResult.signal.id);
          
          savedPitchesCount++;
        } catch (saveError) {
          console.error(`❌ Failed to save pitch for signal ${pitchResult.signal.id}:`, saveError);
        }
      }
      
      console.log(`✅ Saved ${savedPitchesCount} pitches to database`);
    }
    
    // 7.6. Combine cached pitches with newly generated ones
    // If forceRegenerate, skip cached pitches and use only newly generated ones
    let mergedPitches;
    
    if (forceRegenerate || signalsWithExistingPitch.length === 0) {
      // No cached pitches or force regenerate - use only newly generated pitches
      console.log(`✅ Using ${result.pitches.postToday.length + result.pitches.thisWeek.length + result.pitches.evergreen.length} newly generated pitches (no cache)`);
      mergedPitches = {
        postToday: result.pitches.postToday.slice(0, 2),
        thisWeek: result.pitches.thisWeek.slice(0, 2),
        evergreen: result.pitches.evergreen.slice(0, 2)
      };
    } else {
      // Map cached pitches to the same structure as generated pitches
      const cachedPitchesByTier = {
        postToday: [],
        thisWeek: [],
        evergreen: []
      };
      
      // Cached pitches don't have tiers assigned, so we need to determine their tier
      // For now, we'll add them to the appropriate tier based on their signal's tier or score
      signalsWithExistingPitch.forEach(cached => {
        const tier = cached.signal.aiTier || 
                     (cached.signal.score >= 80 ? 'post_today' : 
                      cached.signal.score >= 60 ? 'this_week' : 'evergreen');
        
        const tierKey = tier === 'post_today' ? 'postToday' : 
                        tier === 'this_week' ? 'thisWeek' : 'evergreen';
        
        cachedPitchesByTier[tierKey].push({
          signal: cached.signal,
          pitch: cached.pitch,
          tier: tier,
          fromCache: true,
          pitchGeneratedAt: cached.pitchGeneratedAt
        });
      });
      
      // Merge cached pitches with newly generated ones (prioritize NEWLY GENERATED over cached)
      // Put new pitches first, then add cached ones only if we don't have 2 new ones yet
      mergedPitches = {
        postToday: [
          ...result.pitches.postToday.slice(0, 2),
          ...cachedPitchesByTier.postToday.filter(c => !result.pitches.postToday.some(p => p.signal?.id === c.signal.id))
        ].slice(0, 2),
        thisWeek: [
          ...result.pitches.thisWeek.slice(0, 2),
          ...cachedPitchesByTier.thisWeek.filter(c => !result.pitches.thisWeek.some(p => p.signal?.id === c.signal.id))
        ].slice(0, 2),
        evergreen: [
          ...result.pitches.evergreen.slice(0, 2),
          ...cachedPitchesByTier.evergreen.filter(c => !result.pitches.evergreen.some(p => p.signal?.id === c.signal.id))
        ].slice(0, 2)
      };
      
      console.log(`✅ Merged pitches: ${mergedPitches.postToday.length + mergedPitches.thisWeek.length + mergedPitches.evergreen.length} total (prioritizing new over cached)`);
    }
    
    // 8. Include AI reasoning in response (but NOT showContext - moved to top level)
    const enhancedResult = {
      postToday: mergedPitches.postToday.map((p, i) => {
        const signal = selectedSignals.find(s => s.id === p.signal?.id);
        const enhanced = {
          ...p,
          aiReason: signal?.aiReason,
          aiAngle: signal?.aiAngle,
          aiFitScore: signal?.aiFitScore
          // Removed showContext - now shown once at page level
        };
        
        return enhanced;
      }),
      thisWeek: mergedPitches.thisWeek.map((p, i) => {
        const signal = selectedSignals.find(s => s.id === p.signal?.id);
        return {
          ...p,
          aiReason: signal?.aiReason,
          aiAngle: signal?.aiAngle,
          aiFitScore: signal?.aiFitScore
          // Removed showContext - now shown once at page level
        };
      }),
      evergreen: mergedPitches.evergreen.map((p, i) => {
        const signal = selectedSignals.find(s => s.id === p.signal?.id);
        return {
          ...p,
          aiReason: signal?.aiReason,
          aiAngle: signal?.aiAngle,
          aiFitScore: signal?.aiFitScore
          // Removed showContext - now shown once at page level
        };
      }),
      // Add show DNA at top level (once, not per pitch)
      showDNA: showDNAForDisplay
    };
    
    return NextResponse.json({
      success: true,
      data: enhancedResult,
      meta: {
        totalSignals: signals.length,
        preFiltered: preFiltered.length,
        aiSelected: selectedSignals.length,
        pitchesGenerated: result.meta.pitchesGenerated,
        pitchesCached: signalsWithExistingPitch.length,
        pitchesSaved: savedPitchesCount,
        aiSelection: true,
        selectionSummary: aiSelection.summary,
        rejected: aiSelection.rejected?.slice(0, 5),
        totalTimeMs: Date.now() - startTime
      }
    });
    
  } catch (error) {
    console.error('❌ Error generating pitches:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/studio/pitches
 * Generate pitches for specific signals (manual selection)
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { showId, signalIds } = body;
    
    if (!showId) {
      return NextResponse.json(
        { success: false, error: 'showId is required' },
        { status: 400 }
      );
    }
    
    if (!signalIds || !Array.isArray(signalIds) || signalIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'signalIds array is required' },
        { status: 400 }
      );
    }
    
    // Limit to 10 signals max for manual selection
    const limitedSignalIds = signalIds.slice(0, 10);
    
    // Fetch specific signals
    const { data: signals, error } = await supabase
      .from('signals')
      .select('*')
      .eq('show_id', showId)
      .in('id', limitedSignalIds);
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    // Enrich and generate pitches
    const enrichedSignals = signals.map(signal => ({
      ...signal,
      hoursOld: (Date.now() - new Date(signal.created_at).getTime()) / (1000 * 60 * 60),
      competitors: signal.competitor_evidence || [],
      competitorBreakdown: signal.competitor_breakdown || { direct: 0, indirect: 0, trendsetter: 0 },
      matchedKeywords: signal.matched_keywords || [],
      dnaMatch: signal.matched_topic || null,
      dnaMatchId: signal.matched_topic_id || null
    }));
    
    const result = await generatePitchesForWinners(enrichedSignals, showId, {});
    
    return NextResponse.json({
      success: true,
      data: result.pitches,
      meta: result.meta
    });
    
  } catch (error) {
    console.error('❌ Error generating pitches:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
