import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  extractKeywords,
  expandKeywordsWithTranslations,
  normalizeArabicText,
  KEYWORD_TRANSLATIONS,
  calculateIdeaScore,
  getUrgencyTier
} from '@/lib/scoring/multiSignalScoring';
import {
  calculateMatchScore,
  hasValidKeywordMatch,
  filterValuableKeywords,
  getKeywordWeight
} from '@/lib/scoring/keywordWeights';
import {
  COMPETITOR_SCORE_WEIGHTS,
  BREAKOUT_THRESHOLDS,
  TIME_DECAY_MULTIPLIERS
} from '@/lib/scoring/multiSignalScoring';
import { generateTopicFingerprint } from '@/lib/topicIntelligence';
import { getShowPatterns, scoreSignalByPatterns } from '@/lib/behaviorPatterns';
import { getLearnedAdjustments } from '@/lib/learning/signalEffectiveness';
import { determineContentStrategy } from '@/lib/strategy/formatDecider';
import { calculateDemandScore, shouldPostToday } from '@/lib/scoring/demandScoring';
import { getBestDnaMatch } from '@/lib/scoring/dnaMatching';
import { validateCompetitorMatchWithAI, findValidatedCompetitors } from '@/lib/scoring/competitorMatching';
import { 
    groupSignalsByStoryAndDNA, 
    markSignalsWithClusterInfo 
  } from '@/lib/scoring/signalClustering';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ============================================
// Audience Interest Pattern Matching
// Matches signals to proven audience interest patterns from DNA
// Based on actual video performance - more reliable than keywords
// ============================================
function matchSignalToAudiencePatterns(signal, audienceInterests, aiFingerprint = null) {
  if (!audienceInterests?.fromVideos || audienceInterests.fromVideos.length === 0) return [];
  
  const signalText = `${signal.title || ''} ${signal.description || ''}`.toLowerCase();
  
  // Also include AI-extracted entities for better matching
  const aiEntities = aiFingerprint?.entities || {};
  const aiKeywords = [
    ...(aiEntities.topics || []),
    ...(aiEntities.organizations || []),
    ...(aiEntities.countries || []),
    ...(aiEntities.people || [])
  ].map(k => (k || '').toLowerCase());
  
  const fullText = `${signalText} ${aiKeywords.join(' ')}`;
  
  const matches = [];
  
  // Pattern detection keywords for each audience interest
  const patternKeywords = {
    'personal_impact': {
      keywords: ['affect', 'impact', 'you', 'your', 'personal', 'everyday', 'daily', 'life', 'يؤثر', 'تأثير', 'حياتك', 'يومي', 'شخصي', 'عليك', 'لك'],
      nameEn: 'Personal Economic Impact',
      nameAr: 'التأثير الشخصي'
    },
    'hidden_truth': {
      keywords: ['secret', 'hidden', 'truth', 'reveal', 'actually', 'really', 'unknown', 'why', 'سر', 'حقيقة', 'خفي', 'مخفي', 'كشف', 'الحقيقة', 'لماذا', 'السبب'],
      nameEn: 'Hidden Truth / Secrets',
      nameAr: 'الحقيقة المخفية'
    },
    'money_wealth': {
      keywords: ['money', 'wealth', 'rich', 'billion', 'trillion', 'million', 'dollar', 'invest', 'مال', 'ثروة', 'غني', 'مليار', 'تريليون', 'مليون', 'دولار', 'استثمار', 'أموال'],
      nameEn: 'Money & Wealth Stories',
      nameAr: 'قصص المال والثروة'
    }
  };
  
  audienceInterests.fromVideos.forEach(interest => {
    // Only consider patterns with good performance (multiplier >= 1.0)
    if (!interest.multiplier || interest.multiplier < 1.0) return;
    
    // Get pattern config based on interest ID
    const patternId = interest.id?.toLowerCase() || '';
    const config = patternKeywords[patternId] || null;
    
    if (!config) return;
    
    // Check for keyword matches
    const matchedKeywords = config.keywords.filter(kw => 
      fullText.includes(kw.toLowerCase())
    );
    
    if (matchedKeywords.length >= 1) {
      matches.push({
        patternId: interest.id,
        patternName: config.nameEn || interest.name,
        patternNameAr: config.nameEn || interest.name, // Use English for both
        multiplier: interest.multiplier || 1.0,
        avgViews: interest.avgViews || 0,
        videoCount: interest.videoCount || 0,
        source: 'audience_interest',
        matchedKeywords: matchedKeywords.slice(0, 3),
        confidence: Math.min(1, (interest.videoCount || 1) / 5), // Higher confidence with more videos
        examples: interest.examples?.slice(0, 2) || []
      });
    }
  });
  
  // Sort by multiplier (best performing pattern first)
  return matches.sort((a, b) => (b.multiplier || 1) - (a.multiplier || 1));
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    console.log('📊 Fetching signals for show:', showId);

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
      console.log(`[Studio Signals] Loaded ${Object.keys(sourceUrlMap).length} enabled sources from signal_sources`);
    }
  } catch (err) {
    console.warn('[Studio Signals] Error loading signal_sources (non-fatal):', err.message);
  }
  
  // Universal source quality classifier (same as pitches route)
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

  // 1. Fetch signals (last 14 days)
  // NOTE: We don't filter by DB score here because Reddit signals have fake score=100
  // We'll calculate REAL scores and filter by those instead
  const { data: signals, error: signalsError } = await supabase
    .from('signals')
    .select('*')
    .eq('show_id', showId)
    .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false }) // Order by recency, not fake score
    .limit(100); // Get more signals since we'll filter by real score

  if (signalsError) {
    console.error('❌ Signals error:', signalsError);
    return NextResponse.json({ error: signalsError.message }, { status: 500 });
  }

  console.log(`✅ Found ${signals?.length || 0} signals`);
  
  // Log source breakdown
  const sourceBreakdown = {};
  signals?.forEach(s => {
    const source = s.source || s.source_name || s.raw_data?.sourceName || 'Unknown';
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
  });
  console.log('📰 Sources:', sourceBreakdown);

  // 2. Load DNA topics from unified taxonomy service (single source of truth)
  const { loadTopics } = await import('@/lib/taxonomy/unifiedTaxonomyService');
  let dnaTopics = await loadTopics(showId, supabase);
  
  if (dnaTopics.length === 0) {
    console.warn('⚠️ No topics found in topic_definitions. Run migration to migrate from show_dna.topics if needed.');
  }
  
  console.log(`🧬 DNA Topics: ${dnaTopics.length} topics from topic_definitions`);

  // 2.5. Fetch DNA summary for demand calculation
  let dnaSummaryData = null;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const dnaSummaryResponse = await fetch(
      `${baseUrl}/api/shows/${showId}/dna-summary?t=${Date.now()}`,
      { cache: 'no-store' }
    );
    if (dnaSummaryResponse.ok) {
      const dnaSummaryResult = await dnaSummaryResponse.json();
      if (dnaSummaryResult.success) {
        dnaSummaryData = dnaSummaryResult.data;
        console.log('✅ Loaded DNA summary for demand calculation');
      }
    }
  } catch (dnaSummaryError) {
    console.warn('⚠️ Could not load DNA summary for demand calculation:', dnaSummaryError.message);
  }

  // Extract data needed for demand calculation
  const dnaData = dnaSummaryData ? {
    audienceInterests: dnaSummaryData.audienceInterests || { fromVideos: [], fromComments: [] },
    topicPerformance: dnaSummaryData.dnaTopics?.reduce((acc, topic) => {
      acc[topic.id] = {
        performanceRatio: topic.performanceRatio || 1.0,
        avgViews: topic.avgViews || 0,
        videoCount: topic.videoCount || 0,
        isCore: topic.isCore || false
      };
      return acc;
    }, {}) || {},
    formatPerformanceByTopic: dnaSummaryData.formatPerformanceByTopic || {},
    winningPatterns: dnaSummaryData.winningPatterns || []
  } : null;

  // 3. Fetch recent competitor videos (last 7 days) with type, description, and performance_ratio
  // Join with competitors table to get name, type, and show_id
  const { data: competitorVideosRaw, error: compError } = await supabase
    .from('competitor_videos')
    .select(`
      id,
      title,
      description,
      youtube_video_id,
      views,
      performance_ratio,
      is_success,
      published_at,
      competitor_id,
      competitors!competitor_id (
        id,
        name,
        type,
        show_id
      )
    `)
    .gte('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('views', { ascending: false })
    .limit(200);

  if (compError) {
    console.error('⚠️ Competitor videos error:', compError);
    console.error('   Error details:', JSON.stringify(compError, null, 2));
  }

  // Filter by show_id from the joined competitors table
  const competitorVideos = (competitorVideosRaw || []).filter(
    cv => cv.competitors && cv.competitors.show_id === showId
  );

  console.log(`🎬 Found ${competitorVideos.length} competitor videos for show ${showId} (from ${competitorVideosRaw?.length || 0} total)`);

  // 3.5. Normalize competitor videos (same as /app/api/signals/route.js)
  // IMPORTANT: This must be defined before calculateIdeaScore is called
  const normalizedCompetitorVideos = (competitorVideos || []).map(video => ({
    ...video,
    views: video.views || video.view_count || video.viewCount || 0,
    published_at: video.published_at || video.publish_date || video.publishedAt || video.created_at,
    publish_date: video.publish_date || video.published_at,
    title: video.title || '',
    description: video.description || '',
    competitor_id: video.competitor_id || video.competitors?.id,
    video_id: video.youtube_video_id || video.video_id || video.id,
    youtube_video_id: video.youtube_video_id || video.video_id || video.id,
    competitors: video.competitors || {},
  }));

  // 3.6. Fetch user videos for saturation check (same as /app/api/signals/route.js)
  console.log('📹 Fetching user videos for saturation check...');
  let userVideos = [];
  try {
    // Try channel_videos table first (preferred)
    const { data: channelVideos, error: channelVideosError } = await supabase
      .from('channel_videos')
      .select('*')
      .eq('show_id', showId)
      .order('publish_date', { ascending: false })
      .limit(200);

    if (!channelVideosError && channelVideos && channelVideos.length > 0) {
      userVideos = channelVideos;
      console.log(`✅ Found ${userVideos.length} user videos in channel_videos table`);
    } else {
      // Fallback to videos table
      const { data: videosTable, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('show_id', showId)
        .order('published_at', { ascending: false })
        .limit(200);

      if (!videosError && videosTable && videosTable.length > 0) {
        userVideos = videosTable.map(v => ({
          ...v,
          description: v.description || '',
          publish_date: v.published_at || v.publish_date,
        }));
        console.log(`✅ Found ${userVideos.length} user videos in videos table (fallback)`);
      }
    }
  } catch (err) {
    console.warn('⚠️ Error fetching user videos (non-fatal):', err.message);
  }

  // Normalize user videos (same as /app/api/signals/route.js)
  const normalizedUserVideos = (userVideos || []).map(video => {
    const actualTitle = video.title_ar || video.title_en || video.title || '';
    const normalizedDate = video.publish_date || video.published_at || video.publishedAt || video.created_at || video.upload_date;
    
    return {
      ...video,
      title: actualTitle,
      published_at: normalizedDate,
      publish_date: normalizedDate,
      description: video.description || video.desc || '',
      topic_id: video.topic_id || video.topic || null,
      video_id: video.video_id || video.id,
      youtube_url: video.youtube_url || (video.video_id ? `https://www.youtube.com/watch?v=${video.video_id}` : null),
    };
  });

  console.log(`📹 Normalized user videos: ${normalizedUserVideos.length} videos`);

  // 3.7. Get excluded names (channel/source names to filter out)
  let excludedNames = [];
  try {
    const { getExcludedNames } = await import('@/lib/entities/channelEntities');
    excludedNames = await getExcludedNames(showId);
    console.log(`🚫 Loaded ${excludedNames.length} excluded names (channel/source names)`);
  } catch (err) {
    console.warn('⚠️ Error fetching excluded names (non-fatal):', err.message);
  }

  // 3.8. Get behavior patterns and learned weights
  let showPatterns = {};
  let learnedWeights = {};
  try {
    console.log('🧠 Loading behavior patterns and learned weights...');
    [showPatterns, learnedWeights] = await Promise.all([
      getShowPatterns(showId, false), // Use cache if available
      getLearnedAdjustments(showId, 90) // Last 90 days of feedback
    ]);
    console.log(`✅ Loaded ${Object.keys(showPatterns).length} patterns and ${Object.keys(learnedWeights.patternWeights || {}).length} learned pattern weights`);
  } catch (err) {
    console.warn('⚠️ Error loading patterns/learning (non-fatal):', err.message);
  }

  // 4. ENSURE SOURCE DIVERSITY - Round-robin selection
  // Group by source
  const bySource = {};
  signals.forEach(s => {
    const source = s.source || s.source_name || s.raw_data?.sourceName || 'Unknown';
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push(s);
  });

  console.log('📊 Signals by source:', Object.entries(bySource).map(([src, arr]) => `${src}: ${arr.length}`).join(', '));

  // Take max 2 from each source, round-robin style
  const diverseSignals = [];
  const maxPerSource = 2;
  let added = true;
  let round = 0;

  while (added && diverseSignals.length < 20) {
    added = false;
    for (const source of Object.keys(bySource)) {
      if (bySource[source][round]) {
        diverseSignals.push(bySource[source][round]);
        added = true;
      }
    }
    round++;
    if (round >= maxPerSource) break;
  }

  // If we still need more signals, fill from remaining (sorted by score)
  if (diverseSignals.length < 20) {
    const usedIds = new Set(diverseSignals.map(s => s.id));
    const remaining = signals
      .filter(s => !usedIds.has(s.id))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 20 - diverseSignals.length);
    diverseSignals.push(...remaining);
  }

  console.log('📰 Diverse signals:', diverseSignals.map(s => (s.source || s.source_name || s.raw_data?.sourceName || 'Unknown')).join(', '));
  console.log(`✅ Selected ${diverseSignals.length} diverse signals from ${Object.keys(bySource).length} sources`);

  // 5. Process signals into tiers (using diverseSignals instead of signals)
  // IMPORTANT: Calculate REAL scores using multi-signal scoring instead of fake DB scores
  // Reddit signals have score=100 in DB (fake), but real score should be based on:
  // - Competitor breakout: +30
  // - Multiple competitors: +20
  // - DNA match: +20
  // - Recency: +15
  // - Not covered recently: +15
  const now = Date.now();
  
  // Calculate real scores for all signals (in parallel for performance)
  const processedSignals = await Promise.all(diverseSignals.map(async (signal) => {
    const hoursOld = (now - new Date(signal.created_at).getTime()) / (1000 * 60 * 60);
    
    // ============================================
    // STEP 1: Generate AI Topic Fingerprint (NON-BLOCKING)
    // ============================================
    // This extracts entities (people, countries, organizations, topics) using AI
    // when regex isn't enough. This improves DNA matching and keyword extraction.
    // IMPORTANT: Make this non-blocking with timeout so it doesn't slow down scoring
    let aiFingerprint = null;
    let aiEntities = { people: [], countries: [], organizations: [], topics: [] };
    let aiExtractedKeywords = [];
    
    // Generate AI fingerprint with timeout (don't block scoring if AI is slow)
    const aiFingerprintPromise = generateTopicFingerprint({
      title: signal.title || '',
      description: signal.description || signal.raw_data?.description || '',
      id: signal.id,
      type: 'signal'
    }, {
      skipEmbedding: true, // Skip embedding for performance
      skipCache: false // Use cache to avoid redundant AI calls
    }).then(fp => {
      if (fp && fp.entities) {
        aiEntities = fp.entities;
        // Combine AI-extracted topics, countries, organizations as additional keywords
        aiExtractedKeywords = [
          ...(aiEntities.topics || []),
          ...(aiEntities.countries || []),
          ...(aiEntities.organizations || []).slice(0, 3) // Limit orgs to avoid noise
        ].map(e => e.toLowerCase());
        
        console.log(`   🤖 AI extracted for "${signal.title?.substring(0, 40)}...":`, {
          topics: aiEntities.topics?.slice(0, 3) || [],
          countries: aiEntities.countries?.slice(0, 3) || [],
          organizations: aiEntities.organizations?.slice(0, 2) || [],
          extractionMethod: fp.extractionMethod || 'unknown'
        });
        return fp;
      }
      return null;
    }).catch(err => {
      console.warn(`   ⚠️ AI fingerprint generation failed for "${signal.title?.substring(0, 40)}...":`, err.message);
      return null;
    });
    
    // Add timeout: if AI takes more than 2 seconds, skip it (don't block scoring)
    const aiTimeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 2000));
    aiFingerprint = await Promise.race([aiFingerprintPromise, aiTimeoutPromise]);
    
    // ============================================
    // STEP 1.5: Wikipedia Filtering with Hybrid Matching
    // ============================================
    // Check if this is a Wikipedia trending signal
    const wikiSourceType = signal.raw_data?.sourceType || signal.source_type || 'rss';
    const wikiSourceName = signal.source || signal.source_name || signal.raw_data?.sourceName || 'Unknown';
    const isWikipediaTrending = wikiSourceType === 'wikipedia' || 
      wikiSourceName.toLowerCase().includes('wikipedia') || 
      wikiSourceName.toLowerCase().includes('wiki');

    // FILTER: Wikipedia signals MUST match DNA to be included
    if (isWikipediaTrending) {
      try {
        const { findDnaMatchHybrid } = await import('@/lib/scoring/dnaMatching.js');
        const hybridResult = await findDnaMatchHybrid(
          signal.topic_id,
          signal.title,
          dnaTopics,
          aiFingerprint
        );
        
        if (!hybridResult.matches || hybridResult.matches.length === 0) {
          console.log(`   ⚠️ Wikipedia "${signal.title?.substring(0, 40)}..." - ${hybridResult.reason}, skipping`);
          return null; // Skip this signal entirely
        }
        
        console.log(`   ✅ Wikipedia DNA match (${hybridResult.source}): ${hybridResult.matches.join(', ')}`);
      } catch (wikiErr) {
        console.warn(`   ⚠️ Wikipedia filtering error (non-fatal):`, wikiErr.message);
        // On error, allow the signal through (don't block on filtering errors)
      }
    }
    
    // ============================================
    // STEP 1.6: Match signal to audience interest patterns BEFORE scoring
    // ============================================
    // These are based on actual video performance - more reliable
    const audienceInterestsFromDna = dnaData?.audienceInterests || {};
    const earlyPatternMatches = matchSignalToAudiencePatterns(signal, audienceInterestsFromDna, aiFingerprint);
    
    if (earlyPatternMatches.length > 0) {
      console.log(`   🎯 Audience patterns: ${earlyPatternMatches.map(p => `${p.patternName} (${p.multiplier.toFixed(2)}x, ${p.videoCount} videos)`).join(', ')}`);
    }
    
    // ============================================
    // STEP 2: Calculate REAL score using multi-signal scoring system
    // ============================================
    // This replaces the fake score=100 from Reddit signals
    let realScore = 0;
    let scoringSignals = [];
    let strategicLabel = null;
    let competitorBreakdown = {};
    let competitorBreakout = null;
    let lastCoveredVideo = null;
    let daysSinceLastPost = null;
    let competitorEvidenceFromScoring = []; // Competitor matches from calculateIdeaScore
    let multiSignalScoring = null; // Full scoring result for response (matching Ideas page format)
    let postTodayOverride = null; // Initialize early to avoid reference errors
    
    try {
      // Use same pattern as /app/api/signals/route.js for proper scoring
      // Ensure normalizedCompetitorVideos is defined (should be defined at line 111)
      if (typeof normalizedCompetitorVideos === 'undefined') {
        console.error('❌ CRITICAL: normalizedCompetitorVideos is not defined! Using competitorVideos as fallback.');
      }
      
      // Extract audienceInterests from dnaData for scoring
      const audienceInterests = dnaData?.audienceInterests || { fromVideos: [], fromComments: [] };
      
      const scoringResult = await calculateIdeaScore(signal, {
        competitorVideos: normalizedCompetitorVideos || competitorVideos || [], // Use normalized videos, fallback to raw if needed
        userVideos: normalizedUserVideos, // Include user videos for saturation check
        dnaTopics: dnaTopics,
        signalTitle: signal.title || '',
        signalDescription: signal.description || signal.raw_data?.description || '',
        signalPublishedAt: signal.created_at || signal.published_at,
        signalTopicId: signal.topic_id,
        sourceUrl: signal.url || signal.source_url || signal.raw_data?.url || signal.raw_data?.link || null,
        sourceTitle: signal.source || signal.source_name || signal.raw_data?.sourceName || null,
        sourceCount: 1,
        aiFingerprint: aiFingerprint, // Pass AI fingerprint for smarter DNA matching
        audienceInterests: audienceInterests, // Pass audience interests for demand scoring
        patternMatches: earlyPatternMatches, // Winning patterns from DNA
        isWikipediaTrending: isWikipediaTrending, // Wikipedia trending flag
      }, excludedNames); // Pass excluded names to filter out channel/source names
      
      realScore = scoringResult?.score ?? 0; // Use nullish coalescing to catch 0 scores
      scoringSignals = scoringResult?.signals || [];
      strategicLabel = scoringResult?.strategicLabel || null;
      competitorBreakdown = scoringResult?.competitorBreakdown || {};
      
      // Store full scoring result for response (matching Ideas page format)
      multiSignalScoring = {
        ...scoringResult,
        base_score: scoringResult?.score || 0,
        learned_adjusted_score: realScore,
      };
      
      // ============================================
      // UNIFIED TOPIC MATCHING & RECORDING
      // ============================================
      let matchedTopics = [];
      let primaryTopicId = null;
      if (dnaTopics.length > 0) {
        try {
          const { matchSignalToTopics, recordTopicMatch } = await import('@/lib/taxonomy/unifiedTaxonomyService');
          matchedTopics = await matchSignalToTopics(signal, dnaTopics, aiFingerprint);
          
          if (matchedTopics.length > 0) {
            primaryTopicId = matchedTopics[0].topicId;
            // Record match in database
            await recordTopicMatch(showId, primaryTopicId, supabase);
            
            // Store matched topics in signal
            signal.matchedTopics = matchedTopics;
            signal.primaryTopic = primaryTopicId;
          }
        } catch (matchError) {
          console.warn('⚠️ Error in unified topic matching (non-fatal):', matchError.message);
        }
      }
      
      // DEBUG: Log score details to help diagnose 57/50 issue
      if (realScore === 57 || realScore === 50) {
        console.log(`   🔍 DEBUG Score ${realScore} for "${signal.title?.substring(0, 40)}...":`, {
          score: realScore,
          signalCount: scoringResult?.signalCount || 0,
          signals: scoringSignals.map(s => ({ type: s.type, weight: s.weight })),
          competitorBreakdown: competitorBreakdown,
          hasDnaMatch: scoringSignals.some(s => s.type === 'dna_match'),
          hasCompetitorBreakout: !!competitorBreakout,
          hasCompetitorVolume: scoringSignals.some(s => s.type?.includes('competitor_volume'))
        });
      }
      
      // Extract competitor breakout info from signals
      const breakoutSignal = scoringSignals.find(s => 
        s.type === 'competitor_breakout_trendsetter' || 
        s.type === 'competitor_breakout_direct' || 
        s.type === 'competitor_breakout_indirect'
      );
      competitorBreakout = breakoutSignal?.data || null;
      
      // Extract competitor evidence from signals (better matching from calculateIdeaScore)
      // Look for competitor volume signals which contain evidence.competitors array
      const competitorVolumeSignals = scoringSignals.filter(s => 
        s.type === 'competitor_volume_direct' || 
        s.type === 'competitor_volume_mixed' || 
        s.type === 'competitor_volume_indirect' ||
        s.type === 'trendsetter_volume'
      );
      
      // Also check competitor breakout signals (they have data with video info)
      const competitorBreakoutSignals = scoringSignals.filter(s => 
        s.type === 'competitor_breakout_direct' || 
        s.type === 'competitor_breakout_trendsetter' || 
        s.type === 'competitor_breakout_indirect'
      );
      
      // Combine all competitor evidence from different signals
      competitorEvidenceFromScoring = competitorVolumeSignals
        .flatMap(s => s.evidence?.competitors || [])
        .filter((comp, index, self) => 
          // Deduplicate by videoUrl
          index === self.findIndex(c => c.videoUrl === comp.videoUrl)
        );
      
      // Add breakout competitors if they're not already in the list
      competitorBreakoutSignals.forEach(signal => {
        if (signal.data) {
          const breakoutComp = {
            name: signal.data.channelName,
            type: signal.data.type || (signal.type.includes('direct') ? 'direct' : signal.type.includes('trendsetter') ? 'trendsetter' : 'indirect'),
            videoTitle: signal.data.videoTitle,
            videoUrl: signal.data.videoUrl,
            matchedKeywords: signal.evidence?.matchedKeywords || []
          };
          // Only add if not already present
          if (!competitorEvidenceFromScoring.some(c => c.videoUrl === breakoutComp.videoUrl)) {
            competitorEvidenceFromScoring.push(breakoutComp);
          }
        }
      });
      
      console.log(`   📊 Competitor evidence: ${competitorEvidenceFromScoring.length} from volume signals, ${competitorBreakoutSignals.length} breakout signals`);
      
      // Debug: Log what signals we found
      if (competitorVolumeSignals.length > 0) {
        console.log(`   📊 Volume signals found: ${competitorVolumeSignals.map(s => s.type).join(', ')}`);
        competitorVolumeSignals.forEach(s => {
          const comps = s.evidence?.competitors || [];
          console.log(`      - ${s.type}: ${comps.length} competitors`);
        });
      }
      if (competitorBreakoutSignals.length > 0) {
        console.log(`   📊 Breakout signals found: ${competitorBreakoutSignals.map(s => s.type).join(', ')}`);
      }
      
      // Find last covered video from freshness or saturated signal
      // These signals come from findDaysSinceLastPost() which has better matching
      const lastPostSignal = scoringSignals.find(s => 
        s.type === 'freshness' || 
        s.type === 'fresh_topic' || 
        s.type === 'saturated'
      );
      
      if (lastPostSignal) {
        // Extract days from signal data or text
        if (lastPostSignal.data?.daysSinceLastPost) {
          daysSinceLastPost = lastPostSignal.data.daysSinceLastPost;
        } else {
          const daysMatch = lastPostSignal.text?.match(/(\d+)\s*days?\s*ago/i);
          if (daysMatch) {
            daysSinceLastPost = parseInt(daysMatch[1]);
          } else if (lastPostSignal.text?.includes("haven't covered") || lastPostSignal.text?.includes("haven't covered")) {
            daysSinceLastPost = 999;
          }
        }
        
        // Get the actual video from evidence (this comes from findDaysSinceLastPost)
        // Evidence structure in signal: { matchedVideo (title), videoUrl, matchedKeywords, daysAgo, matchType }
        if (lastPostSignal.evidence) {
          const evidence = lastPostSignal.evidence;
          if (evidence.matchedVideo || evidence.videoUrl) {
            lastCoveredVideo = {
              title: evidence.matchedVideo || '',
              url: evidence.videoUrl || null,
              daysAgo: daysSinceLastPost || evidence.daysAgo || null
            };
          }
        }
      }
      
      // ALWAYS log score calculation for debugging (not just when DB=100)
      const sourceName = signal.source || signal.source_name || signal.raw_data?.sourceName || 'Unknown';
      
      // If DB score is 100 but real score is different, highlight it
      if (signal.score === 100 && realScore !== 100) {
        console.log(`   ✅ FIXED: "${signal.title?.substring(0, 40)}..." [${sourceName}] DB: ${signal.score} → Real: ${realScore} (${scoringSignals.length} signals)`);
        if (realScore < 20) {
          console.log(`      🚫 Will be FILTERED OUT (real score ${realScore} < 20)`);
        }
      } else if (signal.score === 100 && realScore === 100) {
        console.log(`   ⚠️ WARNING: "${signal.title?.substring(0, 40)}..." [${sourceName}] Still 100! Check if calculateIdeaScore is working correctly`);
      } else {
        // Normal logging for non-100 DB scores
        console.log(`   📊 Score: "${signal.title?.substring(0, 40)}..." [${sourceName}] DB: ${signal.score} → Real: ${realScore} (${scoringSignals.length} signals)`);
      }
      
      // DEBUG: Log detailed score breakdown for 57/50 issue
      if (realScore === 57 || realScore === 50) {
        console.log(`   🔍 DEBUG Score ${realScore}:`, {
          scoringResultKeys: Object.keys(scoringResult || {}),
          signalCount: scoringResult?.signalCount,
          isValid: scoringResult?.isValid,
          signalsBreakdown: scoringSignals.map(s => `${s.type}(${s.weight || 'N/A'})`).join(', '),
          competitorBreakdown: competitorBreakdown,
          hasDnaMatch: scoringSignals.some(s => s.type === 'dna_match'),
          hasBreakout: !!competitorBreakout
        });
      }
      
      // If real score is 0 or very low, log why
      if (realScore < 20 && scoringSignals.length === 0) {
        console.log(`      ⚠️ Low score (${realScore}): No signals found (no competitor breakout, DNA match, etc.)`);
      }
    } catch (err) {
      console.error(`   ❌ Error calculating score for "${signal.title?.substring(0, 40)}...":`, err.message);
      console.error(`      Stack:`, err.stack?.substring(0, 200));
      // Fallback to DB score if calculation fails, but log it
      realScore = signal.score || 0;
      console.log(`      ⚠️ Using DB score as fallback: ${realScore}`);
    }
    
    // STEP 4: Attach source_quality to signal (will be used later for tier determination)
    const sourceName = signal.source || signal.source_name || '';
    const sourceUrl = sourceUrlMap[sourceName] || signal.url || signal.source_url || signal.raw_data?.url || '';
    const sourceType = signal.raw_data?.sourceType || signal.source_type || 'rss'; // Default to 'rss' if not specified
    const source_quality = classifySourceQuality(sourceType, sourceUrl);
    
    const signalWithQuality = {
      ...signal,
      source_quality: source_quality
    };

    // Find matching competitor videos using smart bilingual keyword matching
    // ENHANCED: Now uses AI-extracted entities + rule-based keywords
    // Uses the SAME system as findCompetitorBreakout() in multiSignalScoring.js:
    // 1. Extract keywords with translations (extractKeywords)
    // 2. Add AI-extracted entities (topics, countries, organizations) as additional keywords
    // 3. Match keywords between signal and video
    // 4. Validate match using calculateMatchScore (filters out generic words)
    // This ensures only MEANINGFUL matches (not "says", "about", etc.)
    let signalKeywords = [];
    try {
      // Start with rule-based keyword extraction
      signalKeywords = extractKeywords(signal.title || '');
      
      // ENHANCED: Add AI-extracted entities as additional keywords
      // This improves matching, especially for cross-language scenarios
      if (aiExtractedKeywords && aiExtractedKeywords.length > 0) {
        // Merge AI keywords with rule-based keywords (deduplicate)
        const existingKeywords = new Set(signalKeywords.map(k => normalizeArabicText(k).toLowerCase()));
        const newAiKeywords = aiExtractedKeywords.filter(k => {
          const normalized = normalizeArabicText(k).toLowerCase();
          return !existingKeywords.has(normalized) && k.length > 2; // Filter out very short keywords
        });
        signalKeywords = [...signalKeywords, ...newAiKeywords];
        console.log(`   ✅ Enhanced keywords: ${signalKeywords.length} total (${newAiKeywords.length} from AI)`);
      }
    } catch (err) {
      console.error(`   ⚠️ Error extracting keywords for "${signal.title?.substring(0, 40)}...":`, err.message);
      signalKeywords = [];
    }
    
    // ============================================
    // Extract competitor evidence from scoring signals for UI display
    // MATCHES IDEAS PAGE FORMAT EXACTLY
    // ============================================
    const competitors = [];
    
    // Use scoring.signals from multiSignalScoring (same as Ideas page)
    const scoring = multiSignalScoring || { signals: scoringSignals };
    
    // 1. Extract from breakout signals (these have full video details)
    for (const sig of scoring.signals || scoringSignals) {
      if (sig.type?.includes('competitor_breakout')) {
        const data = sig.data || {};
        const evidence = sig.evidence || {};
        
        // Merge data and evidence (data takes priority) - MATCH IDEAS PAGE FORMAT
        const comp = {
            channelName: data.channelName || evidence.channelName || 'Unknown',
            channelId: data.channelId || evidence.channelId,
            videoTitle: data.videoTitle || evidence.videoTitle || '',
            videoId: data.videoId || evidence.videoId || data.youtube_video_id || evidence.youtube_video_id || null,
            videoUrl: data.videoUrl || evidence.videoUrl || null,
            videoDescription: (data.videoDescription || evidence.videoDescription || '').substring(0, 200),
          views: data.views || evidence.views || 0,
          averageViews: data.averageViews || evidence.averageViews || 0,
          multiplier: data.multiplier || evidence.multiplier || 0,
          hoursAgo: data.hoursAgo || evidence.hoursAgo,
          publishedAt: data.publishedAt || evidence.publishedAt,
          matchedKeywords: data.matchedKeywords || evidence.matchedKeywords || evidence.topicKeywordMatches || [],
          type: sig.type?.includes('direct') ? 'direct' : 
                sig.type?.includes('trendsetter') ? 'trendsetter' : 'indirect',
          isBreakout: true,
        };
        
        if (comp.channelName && comp.channelName !== 'Unknown') {
          competitors.push(comp);
        }
      }
    }
    
    // 2. Extract from volume signals (these have competitor lists in evidence)
    for (const sig of scoring.signals || scoringSignals) {
      if (sig.type?.includes('competitor_volume') || sig.type === 'trendsetter_volume') {
        const evidenceCompetitors = sig.evidence?.competitors || [];
        for (const comp of evidenceCompetitors) {
          // Avoid duplicates
          const isDuplicate = competitors.some(c => 
            c.videoUrl === comp.videoUrl || 
            (c.channelName === comp.name && c.videoTitle === comp.videoTitle)
          );
          
          if (!isDuplicate && (comp.name || comp.channelName)) {
            competitors.push({
                channelName: comp.name || comp.channelName || 'Unknown',
                channelId: comp.channelId,
                videoTitle: comp.videoTitle || '',
                videoId: comp.videoId || comp.video_id || null,
                videoUrl: comp.videoUrl || null,
              matchedKeywords: comp.matchedKeywords || [],
              type: comp.type || 'indirect',
              isBreakout: false,
            });
          }
        }
      }
    }
    
    // Use competitors array (for backward compatibility with existing code)
    const matchingCompetitors = competitors;
    // ============================================
    // STEP 2.5: AI-Enhanced Competitor Validation
    // ============================================
    // For signals with competitors, validate top matches with AI
    // This prevents false positives like "Trump" matching "Trump cards"
    if (competitors.length > 0) {
        try {
          const validatedCompetitors = [];
          const competitorsToValidate = competitors.slice(0, 5); // Only validate top 5
          
          for (const comp of competitorsToValidate) {
            // Build video object for validation
            const videoForValidation = {
              id: comp.videoId || comp.video_id,
              youtube_video_id: comp.videoId || comp.video_id,
              title: comp.videoTitle || comp.title || '',
              description: comp.videoDescription || ''
            };
            
            const validation = await validateCompetitorMatchWithAI(
              signal,
              videoForValidation,
              { 
                aiFingerprint, 
                supabase,
                skipCache: false 
              }
            );
            
            if (validation.isMatch) {
              validatedCompetitors.push({
                ...comp,
                matchConfidence: validation.confidence,
                matchSource: validation.source,
                matchReason: validation.reason,
                // Keep original matched keywords if AI didn't find better ones
                matchedKeywords: validation.matchedKeywords.length > 0 
                  ? validation.matchedKeywords 
                  : comp.matchedKeywords
              });
            } else {
              console.log(`   ❌ Competitor rejected: "${comp.videoTitle?.substring(0, 40)}..." - ${validation.reason}`);
            }
          }
          
          // Keep any competitors beyond top 5 that weren't validated
          const unvalidatedCompetitors = competitors.slice(5);
          
          // Replace competitors array with validated ones
          if (validatedCompetitors.length > 0 || unvalidatedCompetitors.length > 0) {
            competitors.length = 0; // Clear array
            competitors.push(...validatedCompetitors, ...unvalidatedCompetitors);
          }
          
          console.log(`   ✅ Competitor validation: ${validatedCompetitors.length}/${competitorsToValidate.length} validated`);
        } catch (compValErr) {
          console.warn(`   ⚠️ Competitor validation failed (non-fatal):`, compValErr.message);
          // Keep original competitors if validation fails
        }
      }

// ============================================
    // STEP 3: Enhanced DNA Matching with AI (UNIFIED)
    // ============================================
    // Check if we already have a cached AI classification
    let dnaMatch = null;
    let usedCachedClassification = false;
    
    // Check for cached AI classification (less than 7 days old)
    const cachedClassification = signal.ai_classification;
    const classifiedAt = signal.ai_classified_at ? new Date(signal.ai_classified_at) : null;
    const cacheValid = classifiedAt && (Date.now() - classifiedAt.getTime()) < 7 * 24 * 60 * 60 * 1000;
    
    if (cachedClassification && cacheValid && cachedClassification.matchedTopicId) {
      // Use cached result
      const matchedTopic = dnaTopics.find(t => t.topic_id === cachedClassification.matchedTopicId);
      dnaMatch = {
        topicId: cachedClassification.matchedTopicId,
        topicName: matchedTopic?.topic_name_en || cachedClassification.matchedTopicId,
        topicNameAr: matchedTopic?.topic_name_ar || null,
        confidence: cachedClassification.confidence || 80,
        source: 'cached',
        reason: cachedClassification.reason || 'Cached AI classification'
      };
      usedCachedClassification = true;
      console.log(`   ✅ DNA match (cached): "${signal.title?.substring(0, 40)}..." → ${dnaMatch.topicName}`);
    } else {
      // Call AI for fresh classification
      try {
        const { findDnaMatchHybrid } = await import('@/lib/scoring/dnaMatching.js');
        const hybridResult = await findDnaMatchHybrid(
          signal.topic_id,
          signal.title,
          dnaTopics,
          aiFingerprint
        );
        
        if (hybridResult.matches && hybridResult.matches.length > 0) {
          const matchedTopicId = hybridResult.matches[0];
          const matchedTopic = dnaTopics.find(t => t.topic_id === matchedTopicId);
          
          dnaMatch = {
            topicId: matchedTopicId,
            topicName: matchedTopic?.topic_name_en || matchedTopicId,
            topicNameAr: matchedTopic?.topic_name_ar || null,
            confidence: hybridResult.confidence || 80,
            source: hybridResult.source || 'ai',
            reason: hybridResult.reason || 'AI matched'
          };
          
          console.log(`   ✅ DNA match (${hybridResult.source}): "${signal.title?.substring(0, 40)}..." → ${dnaMatch.topicName}`);
          
          // Save AI classification to database for future use
          try {
            await supabase
              .from('signals')
              .update({
                ai_classification: {
                  matchedTopicId: matchedTopicId,
                  topicName: dnaMatch.topicName,
                  confidence: hybridResult.confidence || 80,
                  reason: hybridResult.reason,
                  category: hybridResult.aiCategory || null,
                  source: hybridResult.source
                },
                ai_classified_at: new Date().toISOString()
              })
              .eq('id', signal.id);
            console.log(`   💾 Saved AI classification for signal ${signal.id}`);
          } catch (saveErr) {
            console.warn(`   ⚠️ Failed to save AI classification:`, saveErr.message);
          }
        } else {
          console.log(`   ❌ No DNA match: "${signal.title?.substring(0, 40)}..." - ${hybridResult.reason || 'Not relevant'}`);
          
          // Save "no match" result too (to avoid re-calling AI)
          try {
            await supabase
              .from('signals')
              .update({
                ai_classification: {
                  matchedTopicId: null,
                  reason: hybridResult.reason || 'Not relevant to channel DNA',
                  source: hybridResult.source
                },
                ai_classified_at: new Date().toISOString()
              })
              .eq('id', signal.id);
          } catch (saveErr) {
            // Silent fail - not critical
          }
        }
      } catch (hybridErr) {
        console.warn(`   ⚠️ AI matching failed, using fallback:`, hybridErr.message);
        dnaMatch = getBestDnaMatch(signal, dnaTopics, { entities: aiEntities });
        if (dnaMatch) {
          console.log(`   ✅ DNA match (fallback): "${signal.title?.substring(0, 40)}..." → ${dnaMatch.topicName}`);
        }
      }
    }
    
    // ============================================
    // STEP 3.5: Calculate Demand Score
    // ============================================
    // Check if this topic is being discussed on Reddit, trending on Wikipedia,
    // or requested by audience comments
    let demandScore = { score: 0, demandLevel: 'low', signals: [] };
    try {
      // Fetch Reddit signals for demand detection (if not already fetched)
      const { data: redditSignals } = await supabase
        .from('signals')
        .select('id, title, source, published_at, description')
        .eq('show_id', showId)
        .like('source', 'r/%')
        .gte('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('published_at', { ascending: false })
        .limit(200);
      
      // Fetch Wikipedia trending signals
      const { data: wikiSignals } = await supabase
        .from('signals')
        .select('id, title, source, published_at')
        .eq('show_id', showId)
        .eq('source', 'Wikipedia Trends')
        .gte('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('published_at', { ascending: false })
        .limit(100);
      
      // Fetch actionable audience comments
      const { data: audienceComments } = await supabase
        .from('audience_comments')
        .select('id, text, topic, question, request, is_actionable, likes, created_at')
        .eq('show_id', showId)
        .or('is_actionable.eq.true,question.neq.null,request.neq.null')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('likes', { ascending: false })
        .limit(500);
      
      demandScore = await calculateDemandScore(signal, {
        redditSignals: redditSignals || [],
        wikiSignals: wikiSignals || [],
        audienceComments: audienceComments || [],
        competitorBreakdown: competitorBreakdown
      });
      
      if (demandScore.score > 0) {
        console.log(`   📊 Demand score for "${signal.title?.substring(0, 40)}...": ${demandScore.score} (${demandScore.demandLevel})`);
        if (demandScore.hasRedditBuzz) console.log(`      💬 Reddit buzz detected`);
        if (demandScore.hasWikipediaTrend) console.log(`      📚 Wikipedia trending`);
        if (demandScore.hasAudienceDemand) console.log(`      🎯 Audience demand: ${demandScore.audienceQuestions?.length || 0} questions`);
      }
    } catch (demandErr) {
      console.warn(`   ⚠️ Demand score calculation failed (non-fatal):`, demandErr.message);
    }
    
    // ============================================
    // STEP 3.6: Check if should be POST TODAY (using demand)
    // ============================================
    // postTodayOverride is already declared above, just update it here
    try {
      const postTodayResult = shouldPostToday(signal, { score: realScore, signals: scoringSignals }, demandScore, competitorBreakdown);
      if (postTodayResult.qualifies) {
        postTodayOverride = postTodayResult;
        console.log(`   🔥 POST TODAY: ${postTodayResult.reason} - ${postTodayResult.details}`);
      }
    } catch (ptErr) {
      console.warn(`   ⚠️ Post today check failed (non-fatal):`, ptErr.message);
    }

    // ============================================
    // STEP 4.5: Determine tier (post_today, this_week, backlog)
    // ============================================
    // Use demand-based override if available, otherwise use standard tier logic
    // NOTE: This must happen AFTER demand score and postTodayOverride are calculated
    let tierResult;
    if (postTodayOverride) {
      tierResult = {
        tier: 'post_today',
        label: 'Post Today',
        icon: '🔴',
        color: 'red',
        reason: postTodayOverride.reason,
        details: postTodayOverride.details,
        suggestedFormat: postTodayOverride.format,
        audienceQuestions: postTodayOverride.audienceQuestions
      };
    } else {
      tierResult = await getUrgencyTier(
        {
          score: realScore,
          signals: scoringSignals,
          competitorBreakdown: competitorBreakdown
        },
        signalWithQuality,
        dnaData
      );
    }
    const tier = tierResult.tier;

    // ============================================
    // STEP 5: Pattern Matching & Learning
    // ============================================
    // Score signal against learned behavior patterns and audience interests
    let patternMatches = [];
    let patternBoost = 0;
    try {
      const patternResult = await scoreSignalByPatterns(
        signal,
        showPatterns,
        learnedWeights.patternWeights || {}
      );
      
      patternBoost = patternResult.totalBoost || 0;
      patternMatches = (patternResult.matches || []).map(match => ({
        patternId: match.patternId,
        patternName: match.patternName,
        patternNameAr: match.patternNameAr,
        source: match.source,
        boost: match.boost,
        evidence: match.evidence,
        confidence: match.confidence,
        isLearned: match.isLearned, // Whether user liked this pattern before
        likedCount: learnedWeights.patternWeights?.[match.patternId]?.liked || 0, // "you liked this pattern X times"
        avgViews: showPatterns[match.patternId]?.avgViews || null,
        multiplier: showPatterns[match.patternId]?.multiplier || null
      }));
      
      if (patternMatches.length > 0) {
        console.log(`   🎯 Pattern matches: ${patternMatches.length} patterns (${patternBoost} boost)`);
      }
    } catch (err) {
      console.warn(`   ⚠️ Pattern matching failed for "${signal.title?.substring(0, 40)}...":`, err.message);
    }

    return {
      id: signal.id,
      title: signal.title,
      description: signal.description,
      source: signal.source || signal.source_name || signal.raw_data?.sourceName || 'Unknown',
      sourceUrl: signal.url || signal.source_url || signal.raw_data?.url || null,
      score: realScore, // Use REAL score, not fake DB score
      final_score: realScore, // Alias for consistency with Ideas page
      dbScore: signal.score, // Keep DB score for reference/debugging
      createdAt: signal.created_at,
      tier: tierResult.tier, // 'post_today', 'this_week', or 'backlog' (from getUrgencyTier)
      tierInfo: tierResult, // Full tier object with icon, label, color, reason, urgency
      urgency_tier: tierResult, // Alias for consistency with Ideas page (same as tierInfo)
      hoursOld: Math.round(hoursOld),
      // ✅ Include raw_data so pitch can be accessed in StudioCard
      raw_data: signal.raw_data || {}, // Preserve raw_data (includes recommendation.pitch)
      // ✅ Competitor evidence for UI display (matching main signals route format)
      competitors: competitors.length > 0 ? competitors : undefined,
      competitor_count: competitorBreakdown?.total || competitors.length || 0,
      competitor_evidence: competitors.length > 0 ? competitors.map(comp => ({
        icon: comp.isBreakout ? '🔥' : comp.type === 'direct' ? '🔥' : comp.type === 'trendsetter' ? '⚡' : '🌊',
        text: comp.isBreakout 
          ? `${comp.channelName} got ${comp.multiplier?.toFixed(1) || 'N/A'}x their average`
          : `${comp.channelName} covered this`,
        competitorType: comp.type,
        videoTitle: comp.videoTitle,
        videoUrl: comp.videoUrl,
        matchReason: comp.matchedKeywords?.length > 0 
          ? comp.matchedKeywords.slice(0, 3).join(', ')
          : 'Topic match',
        views: comp.views,
        multiplier: comp.multiplier,
        hoursAgo: comp.hoursAgo,
      })) : undefined,
      competitor_boost: (() => {
        let boost = 0;
        // Use new weights: direct_breakout = 35, trendsetter_breakout = 20, indirect_breakout = 10
        if (competitorBreakdown?.hasDirectBreakout) boost += 35;
        else if (competitorBreakdown?.hasTrendsetterSignal) boost += 20;
        // Volume bonuses: direct_volume = 25, trendsetter_volume = 15, indirect_volume = 8
        if (competitorBreakdown?.direct >= 2) boost += 25;
        else if (competitorBreakdown?.trendsetter >= 2) boost += 15;
        else if (competitorBreakdown?.indirect >= 2) boost += 8;
        return boost > 0 ? boost : undefined;
      })(),
      dnaMatch: (typeof dnaMatch === 'object' && dnaMatch !== null) ? dnaMatch.topicName : (dnaMatch || null), // Return English name for display
      dnaMatchId: (typeof dnaMatch === 'object' && dnaMatch !== null) ? dnaMatch.topicId : (dnaMatch || null), // Keep ID for reference
      hasEvidence: competitors.length > 0 || !!dnaMatch,
      scoringSignals: scoringSignals, // What contributed to the score
      multi_signal_scoring: multiSignalScoring, // Full scoring result (matching Ideas page)
      strategicLabel: strategicLabel, // Strategic label (TREND FORMING, etc.)
      competitorBreakout: competitorBreakout, // Breakout video details
      competitorBreakdown: competitorBreakdown, // Counts by type
      lastCoveredVideo: lastCoveredVideo, // Last video on this topic (from findDaysSinceLastPost)
      daysSinceLastPost: daysSinceLastPost, // Days since last post
      matchedKeywords: signalKeywords.slice(0, 10), // Keywords extracted from signal (rule-based + AI)
      aiEntities: aiEntities, // AI-extracted entities (people, countries, organizations, topics)
      aiExtractionMethod: aiFingerprint?.extractionMethod || null, // 'ai', 'regex', 'cached', or null
      patternMatches: earlyPatternMatches.length > 0 ? earlyPatternMatches : patternMatches, // Winning patterns from DNA (prefer earlyPatternMatches)
      // ✅ Cluster information (for grouping related stories)
      cluster_id: signal.cluster_id || null,
      cluster_key: signal.cluster_key || null,
      cluster_size: signal.cluster_size || 1,
      cluster_rank: signal.cluster_rank || 1,
      is_cluster_primary: signal.is_cluster_primary !== false,
      cluster_anchors: signal.cluster_anchors || [],
      cluster_confidence: signal.cluster_confidence || null,
      patternBoost: patternBoost, // Total boost from pattern matching
      // ✅ NEW: Demand scoring data
      demand: {
        score: demandScore.score,
        level: demandScore.demandLevel,
        hasRedditBuzz: demandScore.hasRedditBuzz || false,
        hasWikipediaTrend: demandScore.hasWikipediaTrend || false,
        hasAudienceDemand: demandScore.hasAudienceDemand || false,
        audienceQuestions: demandScore.audienceQuestions || [],
        audienceRequests: demandScore.audienceRequests || [],
        signals: demandScore.signals || []
      },
      // Format recommendation strategy (Long vs Short)
      recommended_strategy: (() => {
        const topicId = dnaMatch?.topicId || signal.dnaMatchId || null;
        if (!topicId || !dnaData?.formatPerformanceByTopic) return null;
        
        const topicStats = dnaData.formatPerformanceByTopic[topicId];
        if (!topicStats) return null;
        
        // Extract stats in format expected by determineContentStrategy
        const statsForStrategy = {
          long_multiplier: topicStats.long_multiplier || topicStats.long?.performanceRatio || 0,
          short_multiplier: topicStats.short_multiplier || topicStats.short?.performanceRatio || 0,
          long_video_count: topicStats.long_video_count || topicStats.long?.videoCount || 0,
          short_video_count: topicStats.short_video_count || topicStats.short?.videoCount || 0
        };
        
        return determineContentStrategy(statsForStrategy, realScore);
      })()
    };
  }));

  // Filter out null signals (Wikipedia signals without DNA match, or errors)
  const validProcessedSignals = processedSignals.filter(s => {
    return s !== null && 
           s !== undefined && 
           typeof s === 'object' && 
           'id' in s && 
           'score' in s;
  });

  console.log(`📊 Processed signals: ${processedSignals.length} total, ${validProcessedSignals.length} valid (${processedSignals.length - validProcessedSignals.length} null/invalid)`);

  // Sort by score (highest first)
  validProcessedSignals.sort((a, b) => {
    const scoreA = (a && typeof a === 'object' && a.score) ? a.score : 0;
    const scoreB = (b && typeof b === 'object' && b.score) ? b.score : 0;
    return scoreB - scoreA;
  });

  // 6. FILTER OUT LOW-QUALITY SIGNALS
  // Only include signals with real score >= 20 (minimum quality threshold)
  // This excludes Reddit signals with fake score=100 but real score=0-19
  const MIN_REAL_SCORE = 20;
  const qualitySignals = validProcessedSignals.filter(s => {
    const realScore = s.score || 0;
    if (realScore < MIN_REAL_SCORE) {
      console.log(`   🚫 Filtered out: "${s.title?.substring(0, 40)}..." (real score: ${realScore} < ${MIN_REAL_SCORE})`);
      return false;
    }
    return true;
  });
  
  console.log(`📊 Quality filter: ${processedSignals.length} signals → ${qualitySignals.length} with real score >= ${MIN_REAL_SCORE}`);
// ============================================
  // STEP: Cluster Similar Signals by Story
  // ============================================
  // Group signals about the same news story (e.g., multiple Greenland articles)
  // This uses hybrid approach: rule-based anchors + AI validation for edge cases
  let clusteredSignals = qualitySignals;
  
  try {
    console.log(`\n🔗 Starting signal clustering...`);
    
    // Only cluster if we have enough signals
    if (qualitySignals.length >= 2) {
      // Group signals by story
      const clusters = await groupSignalsByStoryAndDNA(qualitySignals, {
        requireSameDNA: true,           // Must have same DNA topic
        minHighValueAnchors: 2,          // Need 2+ specific anchors (trump + greenland)
        timeWindowHours: 72,             // Within 72 hours
        useAIValidation: true,           // Use AI for borderline cases (low cost)
        maxAICallsPerRun: 10,            // Limit AI costs per request
        supabase                         // For caching decisions
      });
      
      // Mark signals with cluster info (for UI display)
      clusteredSignals = markSignalsWithClusterInfo(qualitySignals, clusters);

      // Attach clusterSignals array to primary signals (for UI expansion)
      const clusterMap = new Map();
      for (const cluster of clusters) {
        if (cluster.signals.length > 1) {
          clusterMap.set(cluster.id, cluster.signals);
        }
      }

      // Add clusterSignals to each primary signal
      clusteredSignals = clusteredSignals.map(signal => {
        if (signal.is_cluster_primary && signal.cluster_id && clusterMap.has(signal.cluster_id)) {
          return {
            ...signal,
            clusterSignals: clusterMap.get(signal.cluster_id).map(s => ({
              id: s.id,
              title: s.title,
              source: s.source,
              sourceUrl: s.sourceUrl || s.url,
              score: s.score,
              hoursOld: s.hoursOld,
              hoursAgo: s.hoursOld
            }))
          };
        }
        return signal;
      });
      
      // Log results
      const multiSignalClusters = clusters.filter(c => c.signals.length > 1);
      const totalClustered = multiSignalClusters.reduce((sum, c) => sum + c.signals.length, 0);
      
      if (multiSignalClusters.length > 0) {
        console.log(`   ✅ Clustered ${totalClustered} signals into ${multiSignalClusters.length} story groups`);
        for (const cluster of multiSignalClusters.slice(0, 3)) {
          console.log(`      - "${cluster.primarySignal.title?.substring(0, 40)}..." (${cluster.signals.length} signals)`);
        }
      } else {
        console.log(`   ℹ️ No signals clustered (all unique stories)`);
      }
    } else {
      console.log(`   ℹ️ Skipping clustering (only ${qualitySignals.length} signals)`);
      clusteredSignals = qualitySignals.map(s => ({
        ...s,
        cluster_id: null,
        cluster_size: 1,
        is_cluster_primary: true
      }));
    }
  } catch (clusterErr) {
    console.warn(`   ⚠️ Clustering failed (non-fatal):`, clusterErr.message);
    // Continue with unclustered signals
    clusteredSignals = qualitySignals.map(s => ({
      ...s,
      cluster_id: null,
      cluster_size: 1,
      is_cluster_primary: true
    }));
  }

  // ===========================================
  // HIGH-SCORE PROTECTION + TIER LIMITING
  // ===========================================
  
  // Step 1: Separate signals by REAL calculated score (not DB score)
  const protectedSignals = clusteredSignals.filter(signal => {
    // Use real calculated score from multi-signal scoring
    const realScore = signal.multi_signal_scoring?.score || signal.score || signal.final_score || 0;
    return realScore >= 70;
  });
  
  const regularSignals = clusteredSignals.filter(signal => {
    const realScore = signal.multi_signal_scoring?.score || signal.score || signal.final_score || 0;
    return realScore < 70;
  });
  
  console.log(`🛡️ Studio - Protection check (using REAL scores):`);
  console.log(`   - Protected (real score >= 70): ${protectedSignals.length}`);
  console.log(`   - Regular (real score < 70): ${regularSignals.length}`);
  
  // Log some examples of what's protected vs not
  protectedSignals.slice(0, 5).forEach(s => {
    const dbScore = s.dbScore || s.original_learning_score || 0;
    const realScore = s.multi_signal_scoring?.score || s.score || s.final_score || 0;
    console.log(`   ✅ Protected: "${s.title?.substring(0, 40)}..." Real: ${realScore} (DB: ${dbScore})`);
  });
  
  regularSignals.filter(s => (s.dbScore || s.original_learning_score || 0) >= 70).slice(0, 5).forEach(s => {
    const dbScore = s.dbScore || s.original_learning_score || 0;
    const realScore = s.multi_signal_scoring?.score || s.score || s.final_score || 0;
    console.log(`   ❌ NOT protected: "${s.title?.substring(0, 40)}..." Real: ${realScore} (DB: ${dbScore})`);
  });
  

  



  // Step 2: Apply tier limits to REGULAR signals only
  const TIER_LIMITS = {
    post_today: 2,    // Changed from 5 to 2 - forces strict prioritization
    this_week: 7,     // Max 7 planned items
    backlog: 15       // Max 15 library items
  };
  
  // Sort Post Today by priority (highest first), then by score
  const postTodayCandidates = regularSignals.filter(s => s.tier === 'post_today' || s.tier === 'today');
  
  if (postTodayCandidates.length > 0) {
    postTodayCandidates.sort((a, b) => {
      // First sort by priority (if available), then by score
      const priorityA = a.urgency_tier?.priority || a.tierInfo?.priority || (a.multi_signal_scoring?.score || a.score || 0);
      const priorityB = b.urgency_tier?.priority || b.tierInfo?.priority || (b.multi_signal_scoring?.score || b.score || 0);
      if (priorityB !== priorityA) return priorityB - priorityA;
      // If priorities are equal, sort by score
      return (b.multi_signal_scoring?.score || b.score || 0) - (a.multi_signal_scoring?.score || a.score || 0);
    });
    
    // Log Post Today selection
    console.log(`📋 Post Today candidates (${postTodayCandidates.length}):`);
    postTodayCandidates.slice(0, 5).forEach((s, i) => {
      const priority = s.urgency_tier?.priority || s.tierInfo?.priority || (s.multi_signal_scoring?.score || s.score || 0);
      const demandType = s.urgency_tier?.demandType || s.tierInfo?.demandType || 'moment';
      const realScore = s.multi_signal_scoring?.score || s.score || 0;
      console.log(`  ${i + 1}. [${demandType}] "${s.title?.substring(0, 50)}..." (priority: ${priority}, score: ${realScore})`);
    });
  }
  
  // Strict max 2 Post Today - no exceptions
  const effectivePostTodayLimit = TIER_LIMITS.post_today; // Always 2
  const postTodayRegular = postTodayCandidates.slice(0, effectivePostTodayLimit);
  
  const thisWeekRegular = regularSignals
    .filter(s => s.tier === 'this_week' || s.tier === 'week')
    .sort((a, b) => (b.multi_signal_scoring?.score || b.score || 0) - (a.multi_signal_scoring?.score || a.score || 0))
    .slice(0, TIER_LIMITS.this_week);
  
  const backlogRegular = regularSignals
    .filter(s => s.tier === 'backlog' || s.tier === 'evergreen')
    .sort((a, b) => (b.multi_signal_scoring?.score || b.score || 0) - (a.multi_signal_scoring?.score || a.score || 0))
    .slice(0, TIER_LIMITS.backlog);
  
  // Step 3: Combine protected + limited regular (remove duplicates)
  const seenIds = new Set();
  const finalSignals = [];
  
  // Add all protected signals first
  for (const signal of protectedSignals) {
    if (!seenIds.has(signal.id)) {
      seenIds.add(signal.id);
      finalSignals.push(signal);
    }
  }
  
  // Add limited regular signals
  for (const signal of [...postTodayRegular, ...thisWeekRegular, ...backlogRegular]) {
    if (!seenIds.has(signal.id)) {
      seenIds.add(signal.id);
      finalSignals.push(signal);
    }
  }
  
  console.log(`📊 Studio - Final signal breakdown:`);
  console.log(`   - Protected (real score >= 70): ${protectedSignals.length}`);
  console.log(`   - Post Today (regular, limited): ${postTodayRegular.length}`);
  console.log(`   - This Week (regular, limited): ${thisWeekRegular.length}`);
  console.log(`   - Backlog (regular, limited): ${backlogRegular.length}`);
  console.log(`   - TOTAL displayed: ${finalSignals.length}`);
  
  // Filter: Only return primary signals (non-primary are in clusterSignals)
  const displaySignals = finalSignals.filter(s => s.is_cluster_primary !== false);
  
  // Group final signals by tier for response (only primary signals)
  const postToday = displaySignals.filter(s => s.tier === 'post_today' || s.tier === 'today');
  const thisWeek = displaySignals.filter(s => s.tier === 'this_week' || s.tier === 'week');
  const evergreen = displaySignals.filter(s => s.tier === 'backlog' || s.tier === 'evergreen');

  // Log final source distribution
  const finalSourceBreakdown = {};
  finalSignals.forEach(s => {
    const source = s.source || 'Unknown';
    finalSourceBreakdown[source] = (finalSourceBreakdown[source] || 0) + 1;
  });
  console.log('📤 Final source distribution:', finalSourceBreakdown);
  
  // Summary log for easy debugging
  console.log(`\n📊 STUDIO SIGNAL COUNT SUMMARY:`);
  console.log(`   Raw signals from DB: ${signals?.length || 0}`);
  console.log(`   Diverse signals selected: ${diverseSignals?.length || 0}`);
  console.log(`   After processing: ${processedSignals?.length || 0}`);
  console.log(`   Valid processed signals: ${validProcessedSignals?.length || 0}`);
  console.log(`   After quality filter (score >= 20): ${qualitySignals?.length || 0}`);
  console.log(`   Final displayed: ${finalSignals?.length || 0} (${protectedSignals?.length || 0} protected, ${regularSignals?.length || 0} regular)`);
  
  // If no signals, log why
  if (finalSignals.length === 0) {
    console.warn(`⚠️ WARNING: No signals to display!`);
    console.warn(`   - Raw signals from DB: ${signals?.length || 0}`);
    console.warn(`   - Diverse signals: ${diverseSignals?.length || 0}`);
    console.warn(`   - Valid after processing: ${validProcessedSignals?.length || 0}`);
    console.warn(`   - Passed quality filter (score >= 20): ${qualitySignals?.length || 0}`);
    
    // Show sample scores if any signals were processed
    if (validProcessedSignals.length > 0) {
      console.warn(`   Sample scores from processed signals:`);
      validProcessedSignals.slice(0, 5).forEach(s => {
        console.warn(`     - "${s.title?.substring(0, 40)}...": score=${s.score || 0}, tier=${s.tier || 'none'}`);
      });
    }
  }

  return NextResponse.json({
  success: true,
  // NEW: Flat array structure for easy filtering
  signals: displaySignals,
      // BACKWARD COMPATIBILITY: Tier-based structure
      data: {
        postToday,
        thisWeek,
        evergreen
      },
      meta: {
        totalSignals: signals?.length || 0,
        diverseSignalsCount: diverseSignals?.length || 0,
        validProcessedSignals: validProcessedSignals?.length || 0,
        qualitySignals: qualitySignals?.length || 0,
        finalSignals: finalSignals?.length || 0,
        sources: sourceBreakdown,
        finalSourceDistribution: finalSourceBreakdown,
        dnaTopicsCount: dnaTopics?.length || 0,
        competitorVideosCount: competitorVideos?.length || 0,
        signalsWithPitches: finalSignals.filter(s => s.hasPitch).length,
        signalsWithoutPitches: finalSignals.filter(s => !s.hasPitch).length
      }
    });
  } catch (error) {
    console.error('❌ Error in /api/studio/signals:', error);
    console.error('   Stack:', error.stack);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
}

// ============================================================
// TIER LOGIC REFACTOR
// Classifies signals into tiers based on score + competitor signals
// ============================================================

