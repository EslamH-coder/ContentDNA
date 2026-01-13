/**
 * MULTI-SIGNAL SCORING SYSTEM
 * Requires at least 2 signals to show an idea
 * Maximum score: 100
 */

// Import keyword weighting utilities
import { 
  calculateMatchScore, 
  hasValidKeywordMatch, 
  filterValuableKeywords,
  getUniqueConcepts,
  getRootConcept as getRootConceptWeighted,
  getKeywordWeight
} from './keywordWeights';

// Import topic intelligence for trendsetter matching
import { isRelevantCompetitorVideo } from '../topicIntelligence.js';

/**
 * Calculate idea score based on multiple signals
 * @param {Object} idea - The signal/idea object
 * @param {Object} context - Context data (competitor videos, user videos, DNA, etc.)
 * @param {string[]} excludedNames - Optional array of excluded names (channel/source names) to filter out
 * @returns {Object} Scoring result with score, signals, and validity
 */
export async function calculateIdeaScore(idea, context = {}, excludedNames = []) {
  let score = 0;
  const signals = [];

  const {
    competitorVideos = [],
    userVideos = [],
    dnaTopics = [],
    signalTitle = idea.title || '',
    signalDescription = idea.description || '',
    signalPublishedAt = idea.published_at || idea.created_at,
    signalTopicId = idea.topic_id,
    sourceUrl = idea.url || idea.source_url || null,
    sourceTitle = idea.source || idea.source_name || null,
    sourceCount = idea.source_count || 1,
  } = context;

  // Normalize signal title for matching (include description for better keyword extraction)
  const normalizedTitle = (signalTitle || '').toLowerCase();
  const normalizedText = `${normalizedTitle} ${(signalDescription || '').toLowerCase()}`.trim();
  
  // Extract topic keywords from signal title for validation
  const topicKeywords = extractTopicKeywords(signalTitle);

  // ============================================
  // SIGNAL 1: Competitor Breakout (up to 30 points)
  // Someone in the niche posted about this and got 2x+ their average views
  // Direct competitors get higher weight (30 points) vs indirect (15 points)
  // ============================================
  const competitorBreakout = await findCompetitorBreakout(normalizedTitle, competitorVideos, excludedNames);
  if (competitorBreakout) {
    // DEBUG: Log competitor breakout evidence for Ukraine/Russia ideas
    const isUkraineIdea = signalTitle && (
      signalTitle.toLowerCase().includes('ukraine') ||
      signalTitle.toLowerCase().includes('ukrainian') ||
      signalTitle.toLowerCase().includes('kyiv') ||
      signalTitle.toLowerCase().includes('russia') ||
      signalTitle.toLowerCase().includes('russian')
    );
    if (isUkraineIdea) {
      console.log(`\n🔍 ===== DEBUG Competitor Breakout Evidence for Ukraine/Russia idea =====`);
      console.log(`   Signal title:`, signalTitle);
      console.log(`   competitorBreakout.videoUrl:`, competitorBreakout.videoUrl || 'null');
      console.log(`   competitorBreakout.videoTitle:`, competitorBreakout.videoTitle || 'null');
      console.log(`   competitorBreakout.channelName:`, competitorBreakout.channelName || 'null');
      console.log(`   competitorBreakout.matchedKeywords:`, competitorBreakout.matchedKeywords || []);
    }
    
    // Validate evidence: Check if matched keywords are topic-relevant
    const validatedEvidence = validateEvidence(signalTitle, {
      matchedKeywords: competitorBreakout.matchedKeywords || [],
      videoTitle: competitorBreakout.videoTitle,
      videoUrl: competitorBreakout.videoUrl,
      channelName: competitorBreakout.channelName,
      channelId: competitorBreakout.channelId,
      multiplier: competitorBreakout.multiplier,
      views: competitorBreakout.views,
      averageViews: competitorBreakout.averageViews,
      hoursAgo: competitorBreakout.hoursAgo,
    }, topicKeywords);
    
    // Only add signal if evidence is valid (topic-relevant)
    if (!validatedEvidence) {
      // Evidence doesn't meet minimum topic relevance - skip this signal
      // This prevents false matches on generic words like "about", "week", "says"
      const isDebugIdea = signalTitle?.toLowerCase().includes('venezuela') || signalTitle?.toLowerCase().includes('oil') || signalTitle?.toLowerCase().includes('openai') || signalTitle?.toLowerCase().includes('chatgpt');
      if (isDebugIdea) {
        console.log(`   ⚠️ SKIP competitor breakout: Matched keywords (${competitorBreakout.matchedKeywords?.length || 0}) not topic-relevant enough. Keywords: ${(competitorBreakout.matchedKeywords || []).join(', ')}`);
      }
    } else {
      // Build evidence object from validated competitorBreakout
      const breakoutEvidence = validatedEvidence;
      
      if (competitorBreakout.type === 'direct') {
        // Direct competitor breakout - HIGHEST WEIGHT
        score += 30;
        signals.push({
          type: 'competitor_breakout_direct',
          icon: '🔥',
          text: `Direct competitor: ${competitorBreakout.channelName} got ${competitorBreakout.multiplier.toFixed(1)}x their average`,
          subtext: 'Your core audience is watching this!',
          weight: 'high',
          priority: 1,
          data: competitorBreakout,
          evidence: breakoutEvidence,
        });
      } else if (competitorBreakout.type === 'trendsetter') {
        // Trendsetter signal - HIGH WEIGHT, time-sensitive
        const hoursAgo = competitorBreakout.hoursAgo || 0;
        let trendsetterScore = 20;
        let freshnessText = '';
        
        if (hoursAgo < 6) {
          trendsetterScore = 25; // Breaking - boost score
          freshnessText = `${hoursAgo}h ago - BREAKING`;
        } else if (hoursAgo < 24) {
          trendsetterScore = 20;
          freshnessText = `${hoursAgo}h ago - Fresh`;
        } else if (hoursAgo < 48) {
          trendsetterScore = 15;
          freshnessText = `${Math.floor(hoursAgo / 24)}d ago`;
        } else {
          trendsetterScore = 10;
          freshnessText = `${Math.floor(hoursAgo / 24)}d ago`;
        }
        
        score += trendsetterScore;
        signals.push({
          type: 'competitor_breakout_trendsetter',
          icon: '⚡',
          text: `Trendsetter breakout: ${competitorBreakout.channelName} got ${competitorBreakout.multiplier.toFixed(1)}x their average ${freshnessText}`,
          subtext: 'Trend forming - get ahead of the wave!',
          weight: 'high',
          priority: 2,
          data: competitorBreakout,
          evidence: breakoutEvidence,
        });
      } else {
        // Indirect competitor breakout - MEDIUM WEIGHT
        score += 15;
        signals.push({
          type: 'competitor_breakout_indirect',
          icon: '🌊',
          text: `Trending: ${competitorBreakout.channelName} covered this (${competitorBreakout.multiplier.toFixed(1)}x)`,
          subtext: 'Popular outside your niche',
          weight: 'medium',
          priority: 3,
          data: competitorBreakout,
          evidence: breakoutEvidence,
        });
      }
    }
  }

  // ============================================
  // SIGNAL 2: Multiple Competitors Posted (up to 20 points)
  // 2+ competitors posted about this topic in last 7 days
  // Direct competitors get higher weight, trendsetters get medium-high weight
  // ============================================
  const competitorCounts = countCompetitorMatches(normalizedTitle, competitorVideos, 7, excludedNames);
  const directCount = competitorCounts.direct || 0;
  const indirectCount = competitorCounts.indirect || 0;
  const trendsetterCount = competitorCounts.trendsetter || 0;
  const totalCount = competitorCounts.total || 0;
  
  // Build competitor evidence list for signals
  const competitorEvidence = (competitorCounts.details || []).slice(0, 10).map(detail => {
    // DEBUG: Log competitor evidence URLs for Ukraine/Russia ideas
    const isUkraineIdea = signalTitle && (
      signalTitle.toLowerCase().includes('ukraine') ||
      signalTitle.toLowerCase().includes('ukrainian') ||
      signalTitle.toLowerCase().includes('kyiv') ||
      signalTitle.toLowerCase().includes('russia') ||
      signalTitle.toLowerCase().includes('russian')
    );
    if (isUkraineIdea) {
      console.log(`   🔗 Competitor evidence URL:`, detail.videoUrl || 'null', `for`, detail.name || 'unknown');
    }
    
    return {
      name: detail.name,
      type: detail.type,
      videoTitle: detail.videoTitle || '',
      videoUrl: detail.videoUrl,
      matchedKeywords: detail.matchedKeywords || [],
    };
  });

  // ============================================
  // SIGNAL 2: Multiple Trendsetters (bonus signal)
  // ============================================
  if (trendsetterCount >= 2 && competitorBreakout?.type !== 'trendsetter') {
    score += 15;
    signals.push({
      type: 'trendsetter_volume',
      icon: '⚡',
      text: `${trendsetterCount} trendsetters covering this`,
      subtext: 'Multiple leading sources = trend confirmed',
      weight: 'high',
      priority: 4,
      data: { count: trendsetterCount },
      evidence: {
        competitors: competitorEvidence.filter(c => c.type === 'trendsetter'),
        totalCount: trendsetterCount,
      },
    });
  }

  // ============================================
  // SIGNAL 3: Multiple Competitors Posted (up to 20 points)
  // ============================================
  if (totalCount >= 2) {
    if (directCount >= 2) {
      // Multiple direct competitors - HIGH WEIGHT
      score += 20;
      signals.push({
        type: 'competitor_volume_direct',
        icon: '📊',
        text: `${directCount} direct competitors posted about this`,
        subtext: 'Your audience is definitely interested',
        weight: 'high',
        priority: 5,
        data: { count: directCount, type: 'direct' },
        evidence: {
          competitors: competitorEvidence.filter(c => c.type === 'direct'),
          totalCount: directCount,
        },
      });
    } else if (directCount >= 1 && (trendsetterCount >= 1 || indirectCount >= 1)) {
      // Mix - MEDIUM-HIGH WEIGHT
      score += 15;
      const parts = [];
      if (directCount > 0) parts.push(`${directCount} direct`);
      if (trendsetterCount > 0) parts.push(`${trendsetterCount} trendsetter`);
      if (indirectCount > 0) parts.push(`${indirectCount} indirect`);
      
      signals.push({
        type: 'competitor_volume_mixed',
        icon: '📊',
        text: `${totalCount} competitors: ${parts.join(', ')}`,
        subtext: directCount > 0 ? 'Your audience + broader trend' : 'Growing interest across channels',
        weight: 'medium',
        priority: 6,
        data: { direct: directCount, indirect: indirectCount, trendsetter: trendsetterCount, total: totalCount },
        evidence: {
          competitors: competitorEvidence,
          totalCount: totalCount,
          breakdown: { direct: directCount, indirect: indirectCount, trendsetter: trendsetterCount },
        },
      });
    } else if (trendsetterCount >= 1) {
      // Trendsetters only - MEDIUM WEIGHT
      score += 12;
      signals.push({
        type: 'competitor_volume_trendsetter',
        icon: '📊',
        text: `${trendsetterCount} leading channel${trendsetterCount > 1 ? 's' : ''} covering this`,
        subtext: 'Trend forming - early opportunity',
        weight: 'medium',
        priority: 6,
        data: { count: trendsetterCount },
        evidence: {
          competitors: competitorEvidence.filter(c => c.type === 'trendsetter'),
          totalCount: trendsetterCount,
        },
      });
    } else {
      // Only indirect competitors - LOW-MEDIUM WEIGHT
      score += 10;
      signals.push({
        type: 'competitor_volume_indirect',
        icon: '📊',
        text: `${indirectCount} channels outside your niche covered this`,
        subtext: 'Broader trend - opportunity for reach',
        weight: 'medium',
        priority: 7,
        data: { count: indirectCount, type: 'indirect' },
        evidence: {
          competitors: competitorEvidence.filter(c => c.type === 'indirect'),
          totalCount: indirectCount,
        },
      });
    }
  } else if (totalCount === 1) {
    // Single competitor - note but low weight
    let type = 'indirect';
    if (directCount === 1) type = 'direct';
    else if (trendsetterCount === 1) type = 'trendsetter';
    
    // Get the single competitor details for evidence
    const singleCompetitor = competitorEvidence.find(c => c.type === type) || competitorEvidence[0] || null;
    
    signals.push({
      type: 'competitor_single',
      icon: '👀',
      text: `1 ${type} competitor posted about this`,
      weight: 'low',
      priority: 8,
      data: { type, count: 1 },
      evidence: singleCompetitor ? {
        competitor: singleCompetitor,
        totalCount: 1,
      } : null,
    });
    // No points for single competitor
  }

  // ============================================
  // SIGNAL 3: DNA Match (20 points)
  // Topic matches the channel's content DNA
  // ============================================
  const dnaMatch = findDnaMatch(signalTopicId, normalizedTitle, dnaTopics);
  if (dnaMatch && dnaMatch.length > 0) {
    // Extract matched keywords for evidence
    const signalKeywords = extractKeywords(normalizedTitle);
    // Get keywords and names from matched DNA topics
    const matchedTopicKeywords = [];
    const matchedTopicNames = [];
    dnaMatch.forEach(topicId => {
      const topic = dnaTopics.find(t => 
        (typeof t === 'object' ? t.topic_id || t.id : t) === topicId ||
        (typeof t === 'object' ? t.name : '').toLowerCase().includes(topicId.toLowerCase())
      );
      if (topic && typeof topic === 'object') {
        // Get topic name (prefer English, fallback to ID)
        const topicName = topic.topic_name_en || topic.name || topic.topic_name || topic.topic_name_ar || topicId;
        if (topicName && !matchedTopicNames.includes(topicName)) {
          matchedTopicNames.push(topicName);
        }
        // Get keywords
        if (topic.keywords) {
          matchedTopicKeywords.push(...(Array.isArray(topic.keywords) ? topic.keywords : []));
        }
      }
    });
    const uniqueKeywords = [...new Set(matchedTopicKeywords)].slice(0, 10);
    const uniqueTopicNames = [...new Set(matchedTopicNames)].slice(0, 5);
    
    score += 20;
    // Use English topic names for display (not IDs)
    const dnaMatchNames = uniqueTopicNames.length > 0 
      ? uniqueTopicNames.slice(0, 3).join(', ') + (uniqueTopicNames.length > 3 ? '...' : '')
      : dnaMatch.slice(0, 3).join(', ') + (dnaMatch.length > 3 ? '...' : '');
    
    signals.push({
      type: 'dna_match',
      icon: '✅',
      text: `Matches your DNA: ${dnaMatchNames}`,
      weight: 'medium',
      data: { topics: dnaMatch, topicNames: uniqueTopicNames },
      evidence: {
        matchedTopics: dnaMatch.slice(0, 5),
        matchedTopicNames: uniqueTopicNames,
        matchedKeywords: uniqueKeywords.slice(0, 10),
      },
    });
  }

  // ============================================
  // SIGNAL 4: RSS Recency (15 points)
  // News is fresh (less than 48 hours old)
  // ============================================
  const hoursAgo = calculateHoursAgo(signalPublishedAt);
  if (hoursAgo < 48) {
    // Count how many sources mentioned this (approximate by checking similar signals)
    const actualSourceCount = sourceCount || 1;
    score += 15;
    signals.push({
      type: 'recency',
      icon: '📰',
      text: `Trending: ${actualSourceCount} source${actualSourceCount > 1 ? 's' : ''} in 48h`,
      weight: 'medium',
      data: { hoursAgo, sourceCount: actualSourceCount },
      evidence: {
        sourceUrl: sourceUrl,
        sourceTitle: sourceTitle || signalTitle,
        hoursAgo: hoursAgo,
        sourceCount: actualSourceCount,
      },
    });
  } else if (hoursAgo < 168) {
    // Still recent (within a week) - give partial points
    score += 5;
    signals.push({
      type: 'recency',
      icon: '📰',
      text: `Recent: ${Math.floor(hoursAgo / 24)} days ago`,
      weight: 'low',
      data: { hoursAgo },
      evidence: {
        sourceUrl: sourceUrl,
        sourceTitle: sourceTitle || signalTitle,
        hoursAgo: hoursAgo,
        daysAgo: Math.floor(hoursAgo / 24),
      },
    });
  }

  // ============================================
  // SIGNAL 5: Not Saturated (15 points)
  // User hasn't posted about this topic recently
  // ============================================
  // Use both title and description for better keyword matching (e.g., "Venezuela oil" might be in description)
  const lastPostResult = findDaysSinceLastPost(normalizedText, signalTopicId, userVideos, excludedNames);
  const daysSinceLastPost = lastPostResult.days;
  const lastPostEvidence = lastPostResult.evidence; // Contains matched video details
  
  if (daysSinceLastPost > 30) {
    score += 15;
    signals.push({
      type: 'freshness',
      icon: '⏰',
      text: daysSinceLastPost > 90 
        ? `You haven't covered this topic`
        : `Last covered: ${daysSinceLastPost} days ago`,
      weight: 'low',
      data: { daysSinceLastPost },
      evidence: lastPostEvidence ? {
        matchedVideo: lastPostEvidence.videoTitle,
        matchedKeywords: lastPostEvidence.matchedKeywords,
        videoUrl: lastPostEvidence.videoUrl,
        daysAgo: daysSinceLastPost,
        matchType: lastPostEvidence.matchType,
      } : null,
    });
  }

  // ============================================
  // NEGATIVE: Saturation Penalty
  // If user posted about this in last 14 days, reduce score
  // ============================================
  if (daysSinceLastPost < 14 && daysSinceLastPost !== 999) {
    score -= 30;
    signals.push({
      type: 'saturated',
      icon: '⚠️',
      text: `You posted about this ${daysSinceLastPost} days ago`,
      weight: 'negative',
      data: { daysSinceLastPost },
      evidence: lastPostEvidence ? {
        matchedVideo: lastPostEvidence.videoTitle,
        matchedKeywords: lastPostEvidence.matchedKeywords,
        videoUrl: lastPostEvidence.videoUrl,
        daysAgo: daysSinceLastPost,
        matchType: lastPostEvidence.matchType,
      } : null,
    });
  }

  const positiveSignalCount = signals.filter(s => s.weight !== 'negative').length;

  // If we have at least 1 positive signal OR score >= 30, consider it valid
  // This makes it more lenient for channels without much data
  const isValid = positiveSignalCount >= 1 || score >= 30;

  // ============================================
  // STRATEGIC LABEL
  // ============================================
  let strategicLabel = null;
  
  const hasDirectSignal = competitorBreakout?.type === 'direct' || directCount >= 2;
  const hasTrendsetterSignal = competitorBreakout?.type === 'trendsetter' || trendsetterCount >= 2;
  const hasIndirectSignal = competitorBreakout?.type === 'indirect' || indirectCount >= 2;
  
  if (hasDirectSignal && hasTrendsetterSignal) {
    // Direct + Trendsetter = Highest priority
    strategicLabel = {
      type: 'high_priority',
      icon: '🚨',
      text: 'HIGH PRIORITY: Your audience + trend forming',
      color: 'red'
    };
  } else if (hasDirectSignal) {
    // Only direct
    strategicLabel = {
      type: 'defend',
      icon: '⚠️',
      text: 'YOUR CORE AUDIENCE IS WATCHING THIS',
      color: 'red'
    };
  } else if (hasTrendsetterSignal) {
    // Only trendsetter
    strategicLabel = {
      type: 'trend_forming',
      icon: '⚡',
      text: 'TREND FORMING: Get ahead of the wave',
      color: 'orange'
    };
  } else if (hasIndirectSignal) {
    // Only indirect
    strategicLabel = {
      type: 'opportunity',
      icon: '💡',
      text: 'OPPORTUNITY: Reach new viewers',
      color: 'blue'
    };
  }

  // Sort signals by priority
  signals.sort((a, b) => (a.priority || 99) - (b.priority || 99));

  return {
    score: Math.max(0, Math.min(100, score)),
    signals,
    signalCount: positiveSignalCount,
    isValid,
    strategicLabel,
    // Include competitor breakdown for transparency
    competitorBreakdown: {
      direct: directCount,
      indirect: indirectCount,
      trendsetter: trendsetterCount,
      total: totalCount,
      hasDirectBreakout: competitorBreakout?.type === 'direct',
      hasIndirectBreakout: competitorBreakout?.type === 'indirect',
      hasTrendsetterSignal: competitorBreakout?.type === 'trendsetter' || trendsetterCount >= 1
    }
  };
}

/**
 * Get urgency tier for an idea
 * @param {Object} scoring - Result from calculateIdeaScore
 * @param {Object} idea - The idea object
 * @returns {Object|null} Urgency tier or null if not urgent enough
 */
/**
 * Determine urgency tier based on time-sensitivity, not just score
 * @param {Object} scoring - The scoring result with signals
 * @param {Object} idea - The idea/signal object
 * @returns {Object} Tier object with category for backlog
 */
export function getUrgencyTier(scoring, idea) {
  return determineUrgencyTier(idea, scoring);
}

/**
 * Determine urgency tier based on time-sensitivity signals
 * @param {Object} idea - The idea/signal object
 * @param {Object} scoring - The scoring result with signals
 * @returns {Object} Tier object with category for backlog
 */
function determineUrgencyTier(idea, scoring) {
  const { signals, score } = scoring;
  const signalTitle = idea.title || '';
  const signalPublishedAt = idea.published_at || idea.created_at || idea.publishedAt;
  
  // Extract competitor breakdown from signals
  const competitorBreakdown = {
    hasDirectBreakout: signals.some(s => s.type === 'competitor_breakout_direct'),
    hasTrendsetterSignal: signals.some(s => s.type === 'competitor_breakout_trendsetter'),
    directCount: signals.filter(s => s.type === 'competitor_volume_direct').length,
    trendsetterCount: signals.filter(s => s.type === 'competitor_volume_trendsetter').length,
    indirectCount: signals.filter(s => s.type === 'competitor_volume_indirect').length,
    totalCount: signals.filter(s => s.type?.includes('competitor_volume')).length,
  };
  
  // Extract hoursAgo from evidence or data fields
  const trendsetterBreakout = signals.find(s => s.type === 'competitor_breakout_trendsetter');
  const directBreakout = signals.find(s => s.type === 'competitor_breakout_direct');
  
  // Get hoursAgo from evidence or data object (fallback to data if evidence doesn't have it)
  const trendsetterHoursAgo = trendsetterBreakout?.evidence?.hoursAgo ?? trendsetterBreakout?.data?.hoursAgo;
  const directBreakoutHoursAgo = directBreakout?.evidence?.hoursAgo ?? directBreakout?.data?.hoursAgo;
  
  // Check for time-sensitive signals
  const hasFreshTrendsetter = trendsetterBreakout && trendsetterHoursAgo !== undefined && trendsetterHoursAgo < 6;
  
  const hasRecentCompetitorBreakout = (
    (directBreakout && directBreakoutHoursAgo !== undefined && directBreakoutHoursAgo < 48) ||
    (trendsetterBreakout && trendsetterHoursAgo !== undefined && trendsetterHoursAgo < 48)
  );
  
  const multipleCompetitorsRecent = competitorBreakdown.totalCount >= 3 && hasRecentCompetitorBreakout;
  
  // ISSUE 3: Check if user recently covered this topic (< 7 days ago)
  // Extract daysSinceLastPost from signals (from 'saturated' or 'freshness' signal)
  const saturatedSignal = signals.find(s => s.type === 'saturated');
  const freshnessSignal = signals.find(s => s.type === 'freshness');
  const daysSinceLastPost = saturatedSignal?.data?.daysSinceLastPost ?? freshnessSignal?.data?.daysSinceLastPost ?? 999;
  const lastPostEvidence = saturatedSignal?.evidence || freshnessSignal?.evidence;
  
  // FIXED: Only demote if it's the SAME story, not just same topic
  // Iran protests TODAY are NEW developments, not the same story from 4 days ago
  const isSameStory = lastPostEvidence?.matchType === 'topic_id' || 
                      (lastPostEvidence?.matchedKeywords?.length || 0) >= 3; // Strong match = likely same story
  // FIXED: Get published_at from idea object
  const isNewDevelopment = signalPublishedAt && lastPostEvidence?.videoPublishedAt
    ? new Date(signalPublishedAt) > new Date(lastPostEvidence.videoPublishedAt)
    : false;
  
  // Only consider "recently covered" if it's the SAME story AND not a new development
  // If it's a new development (newer than the video), it's a different story
  const recentlyCovered = daysSinceLastPost < 3 && daysSinceLastPost !== 999 && isSameStory && !isNewDevelopment;
  
  // DEBUG: Log tier decision for all items (especially Ukraine/Russia or recently covered)
  const isDebugIdea = signalTitle && (
    signalTitle.toLowerCase().includes('ukraine') ||
    signalTitle.toLowerCase().includes('ukrainian') ||
    signalTitle.toLowerCase().includes('russia') ||
    signalTitle.toLowerCase().includes('russian') ||
    signalTitle.toLowerCase().includes('kyiv') ||
    signalTitle.toLowerCase().includes('iran') ||
    signalTitle.toLowerCase().includes('إيران') ||
    signalTitle.toLowerCase().includes('protests') ||
    signalTitle.toLowerCase().includes('مظاهرات') ||
    signalTitle.toLowerCase().includes('fed') ||
    signalTitle.toLowerCase().includes('federal') ||
    recentlyCovered ||
    score < 50
  );
  
  if (isDebugIdea || score >= 70 || recentlyCovered) {
    console.log('\n🔍 ===== TIER DECISION DEBUG =====');
    console.log(`   Title: "${signalTitle.substring(0, 80)}"`);
    console.log(`   Score: ${score} ${score < 50 ? '⚠️ LOW SCORE' : ''}`);
    console.log(`   daysSinceLastPost: ${daysSinceLastPost} days`);
    console.log(`   isSameStory: ${isSameStory} | isNewDevelopment: ${isNewDevelopment}`);
    console.log(`   recentlyCovered (same story, no new dev): ${recentlyCovered} ${recentlyCovered ? '⚠️ WILL DEMOTE' : ''}`);
    console.log(`   hasDirectBreakout: ${competitorBreakdown.hasDirectBreakout}`);
    console.log(`   hasTrendsetterSignal: ${competitorBreakdown.hasTrendsetterSignal}`);
    console.log(`   trendsetterHoursAgo: ${trendsetterHoursAgo ?? 'undefined'}`);
    console.log(`   directBreakoutHoursAgo: ${directBreakoutHoursAgo ?? 'undefined'}`);
    console.log(`   hasFreshTrendsetter (< 6h): ${hasFreshTrendsetter}`);
    console.log(`   hasRecentCompetitorBreakout (< 48h): ${hasRecentCompetitorBreakout}`);
    console.log(`   multipleCompetitorsRecent: ${multipleCompetitorsRecent} (${competitorBreakdown.totalCount} competitors)`);
    
    // Log evidence structure
    if (trendsetterBreakout) {
      console.log(`   Trendsetter signal evidence:`, {
        hasEvidence: !!trendsetterBreakout.evidence,
        evidenceHoursAgo: trendsetterBreakout.evidence?.hoursAgo,
        hasData: !!trendsetterBreakout.data,
        dataHoursAgo: trendsetterBreakout.data?.hoursAgo,
        finalHoursAgo: trendsetterHoursAgo
      });
    }
    if (directBreakout) {
      console.log(`   Direct breakout evidence:`, {
        hasEvidence: !!directBreakout.evidence,
        evidenceHoursAgo: directBreakout.evidence?.hoursAgo,
        hasData: !!directBreakout.data,
        dataHoursAgo: directBreakout.data?.hoursAgo,
        finalHoursAgo: directBreakoutHoursAgo
      });
    }
    if (lastPostEvidence) {
      console.log(`   Last post evidence:`, {
        videoTitle: lastPostEvidence.videoTitle?.substring(0, 50),
        matchType: lastPostEvidence.matchType,
        matchedKeywords: lastPostEvidence.matchedKeywords?.slice(0, 5),
        daysAgo: daysSinceLastPost
      });
    }
  }
  
  // ============================================
  // 🔴 POST TODAY - Momentum happening NOW
  // ============================================
  // CONDITIONS:
  // 1. NOT recently covered (SAME story < 3 days) - FIXED: Only demote if same story + no new dev
  // 2. Score >= 50 (minimum quality threshold) - ISSUE 1 FIX
  // 3. One of these urgency triggers:
  //    a. Direct competitor breakout in last 48h
  //    b. Trendsetter posted < 24h ago (breaking)
  //    c. 3+ competitors covering in last 48h
  //    d. Score >= 80 with any competitor signal
  //    e. Trendsetter < 72h with 2+ competitors covering
  
  // FIXED: Only demote if SAME story (not just same topic) AND no new developments
  if (recentlyCovered) {
    if (isDebugIdea || score >= 70) {
      console.log(`   ⚠️ SKIP POST TODAY: User posted about this SAME story ${daysSinceLastPost} days ago (demote to This Week/Backlog)`);
    }
    // Will fall through to This Week / Backlog tier checks below
  } else {
    // ISSUE 1: Require minimum score of 50 for Post Today
    // Even with urgency triggers, items need minimum quality
    const hasMinimumScore = score >= 50;
    
    if (!hasMinimumScore) {
      if (isDebugIdea || score >= 40) {
        console.log(`   ⚠️ SKIP POST TODAY: Score ${score} below minimum threshold (50)`);
      }
      // Will fall through to This Week / Backlog tier checks below
    } else {
      // ADJUSTED: Increase trendsetter threshold from 6h to 24h for Post Today
      const hasRecentTrendsetter = trendsetterBreakout && trendsetterHoursAgo !== undefined && trendsetterHoursAgo < 24;
      
      if (competitorBreakdown.hasDirectBreakout && hasRecentCompetitorBreakout) {
        const finalTier = {
          tier: 'post_today',
          label: 'Post Today',
          icon: '🔴',
          reason: 'Direct competitor breaking out - your audience is watching!',
          color: 'red',
          urgency: 'high'
        };
        if (isDebugIdea || score >= 70) {
          console.log(`   ✅ TIER: POST TODAY (Direct competitor breakout < 48h, score: ${score})`);
          console.log(`===== END TIER DECISION DEBUG =====\n`);
        }
        return finalTier;
      }
      
      if (hasRecentTrendsetter) {
        const finalTier = {
          tier: 'post_today',
          label: 'Post Today',
          icon: '🔴',
          reason: 'Breaking trend - get ahead of the wave!',
          color: 'red',
          urgency: 'high'
        };
        if (isDebugIdea || score >= 70) {
          console.log(`   ✅ TIER: POST TODAY (Trendsetter < 24h, score: ${score})`);
          console.log(`===== END TIER DECISION DEBUG =====\n`);
        }
        return finalTier;
      }
      
      if (multipleCompetitorsRecent && hasRecentCompetitorBreakout) {
        const finalTier = {
          tier: 'post_today',
          label: 'Post Today',
          icon: '🔴',
          reason: 'Multiple competitors covering - topic is hot!',
          color: 'red',
          urgency: 'high'
        };
        if (isDebugIdea || score >= 70) {
          console.log(`   ✅ TIER: POST TODAY (3+ competitors covering < 48h, score: ${score})`);
          console.log(`===== END TIER DECISION DEBUG =====\n`);
        }
        return finalTier;
      }
      
      // NEW: Trendsetter < 72h with 2+ competitors covering (for cases like Ukraine/Russia)
      if (trendsetterBreakout && trendsetterHoursAgo !== undefined && trendsetterHoursAgo < 72 && competitorBreakdown.totalCount >= 2) {
        const finalTier = {
          tier: 'post_today',
          label: 'Post Today',
          icon: '🔴',
          reason: 'Trendsetter breakout + multiple channels covering - act now!',
          color: 'red',
          urgency: 'high'
        };
        if (isDebugIdea || score >= 70) {
          console.log(`   ✅ TIER: POST TODAY (Trendsetter < 72h + ${competitorBreakdown.totalCount} competitors, score: ${score})`);
          console.log(`===== END TIER DECISION DEBUG =====\n`);
        }
        return finalTier;
      }
      
      if (score >= 80 && (competitorBreakdown.hasDirectBreakout || competitorBreakdown.hasTrendsetterSignal)) {
        const finalTier = {
          tier: 'post_today',
          label: 'Post Today',
          icon: '🔴',
          reason: 'High relevance + competitor activity',
          color: 'red',
          urgency: 'high'
        };
        if (isDebugIdea || score >= 70) {
          console.log(`   ✅ TIER: POST TODAY (Score >= 80 + competitor activity, score: ${score})`);
          console.log(`===== END TIER DECISION DEBUG =====\n`);
        }
        return finalTier;
      }
    }
  }
  
  // ============================================
  // 🟡 THIS WEEK - Good opportunity, plan it
  // ============================================
  // Conditions:
  // 1. DNA match + trending, but no competitor rush
  // 2. Trendsetter posted 6-72h ago (wave forming, not crashing)
  // 3. Score >= 50 with DNA match
  // 4. Competitor activity but not breaking out
  
  const hasDnaMatch = signals.some(s => s.type === 'dna_match');
  const isTrending = signals.some(s => s.type === 'recency' || s.type === 'trending');
  // Update hasTrendsetterMedium to check both evidence and data for hoursAgo
  const trendsetterForThisWeek = signals.find(s => s.type === 'competitor_breakout_trendsetter');
  const trendsetterHoursAgoForThisWeek = trendsetterForThisWeek?.evidence?.hoursAgo ?? trendsetterForThisWeek?.data?.hoursAgo;
  const hasTrendsetterMedium = trendsetterForThisWeek && 
    trendsetterHoursAgoForThisWeek !== undefined &&
    trendsetterHoursAgoForThisWeek >= 6 &&
    trendsetterHoursAgoForThisWeek <= 72;
  
  // ISSUE 3: If recently covered (< 7 days), prefer This Week over Backlog (user is interested, just not urgent)
  if (recentlyCovered) {
    // User posted about this recently - demote to This Week (not urgent, but still relevant)
    if (hasDnaMatch || isTrending || score >= 50) {
      const finalTier = {
        tier: 'this_week',
        label: 'This Week',
        icon: '🟡',
        reason: `You posted about this ${daysSinceLastPost} days ago - good follow-up opportunity`,
        color: 'yellow',
        urgency: 'medium'
      };
      if (isDebugIdea || score >= 40) {
        console.log(`   ✅ TIER: THIS WEEK (Recently covered ${daysSinceLastPost} days ago, but has ${hasDnaMatch ? 'DNA match' : isTrending ? 'trending signal' : 'good score'})`);
        console.log(`===== END TIER DECISION DEBUG =====\n`);
      }
      return finalTier;
    }
    // If no positive signals, will fall through to Backlog
  }
  
  if (hasDnaMatch && isTrending && !competitorBreakdown.hasDirectBreakout) {
    const finalTier = {
      tier: 'this_week',
      label: 'This Week',
      icon: '🟡',
      reason: 'Matches your DNA + trending - good opportunity',
      color: 'yellow',
      urgency: 'medium'
    };
    if (isDebugIdea || score >= 70) {
      console.log(`   ✅ TIER: THIS WEEK (DNA match + trending, no direct breakout)`);
      console.log(`===== END TIER DECISION DEBUG =====\n`);
    }
    return finalTier;
  }
  
  if (hasTrendsetterMedium) {
    const finalTier = {
      tier: 'this_week',
      label: 'This Week',
      icon: '🟡',
      reason: 'Trend forming - plan your content',
      color: 'yellow',
      urgency: 'medium'
    };
    if (isDebugIdea || score >= 70) {
      console.log(`   ✅ TIER: THIS WEEK (Trendsetter 6-72h ago: ${trendsetterHoursAgoForThisWeek}h)`);
      console.log(`===== END TIER DECISION DEBUG =====\n`);
    }
    return finalTier;
  }
  
  if (score >= 50 && hasDnaMatch) {
    const finalTier = {
      tier: 'this_week',
      label: 'This Week',
      icon: '🟡',
      reason: 'Good fit for your channel',
      color: 'yellow',
      urgency: 'medium'
    };
    if (isDebugIdea || score >= 70) {
      console.log(`   ✅ TIER: THIS WEEK (Score >= 50 + DNA match)`);
      console.log(`===== END TIER DECISION DEBUG =====\n`);
    }
    return finalTier;
  }
  
  if (competitorBreakdown.totalCount >= 2 && !hasRecentCompetitorBreakout) {
    const finalTier = {
      tier: 'this_week',
      label: 'This Week',
      icon: '🟡',
      reason: 'Competitors covering - consider this topic',
      color: 'yellow',
      urgency: 'medium'
    };
    if (isDebugIdea || score >= 70) {
      console.log(`   ✅ TIER: THIS WEEK (${competitorBreakdown.totalCount} competitors, not recent breakout)`);
      console.log(`===== END TIER DECISION DEBUG =====\n`);
    }
    return finalTier;
  }
  
  // ============================================
  // 🟢 BACKLOG / EVERGREEN - Strategic content library
  // ============================================
  // Everything else goes to backlog with a category
  // But if it's evergreen, use evergreen tier instead
  
  const backlogCategory = determineBacklogCategory(idea, scoring);
  
  // If category is evergreen, use evergreen tier (not backlog)
  const isEvergreenCategory = backlogCategory.type === 'evergreen';
  
  const finalTier = {
    tier: isEvergreenCategory ? 'evergreen' : 'backlog',
    label: isEvergreenCategory ? 'Evergreen' : 'Backlog',
    icon: isEvergreenCategory ? '📚' : '🟢',
    reason: backlogCategory.reason,
    color: isEvergreenCategory ? 'blue' : 'green',
    urgency: 'low',
    category: backlogCategory
  };
  
  if (isDebugIdea || score >= 70) {
    console.log(`   ⚠️ TIER: BACKLOG (No Post Today or This Week triggers met)`);
    console.log(`      Category: ${backlogCategory.type} - ${backlogCategory.label}`);
    console.log(`      Score: ${score}, DNA match: ${hasDnaMatch}, Trending: ${isTrending}`);
    console.log(`      Direct breakout: ${competitorBreakdown.hasDirectBreakout}, Trendsetter: ${competitorBreakdown.hasTrendsetterSignal}`);
    console.log(`===== END TIER DECISION DEBUG =====\n`);
  }
  
  return finalTier;
}

/**
 * Determine backlog category for strategic organization
 * @param {Object} idea - The idea/signal object
 * @param {Object} scoring - The scoring result
 * @returns {Object} Category object
 */
function determineBacklogCategory(idea, scoring) {
  const title = (idea.title || '').toLowerCase();
  const titleAr = idea.title || '';
  const { signals } = scoring;
  
  // ============================================
  // 📚 EVERGREEN - Educational, timeless content
  // ============================================
  // EXPANDED: More patterns to catch evergreen content
  const evergreenKeywords = {
    en: [
      'how to', 'what is', 'guide', 'explained', 'basics', 'introduction', 
      'understanding', 'why do', 'how does', 'wall street', 'stock market',
      'investment', 'fundamentals', 'principles', 'from .* to', 'history of',
      'works', 'matters', 'decoded', 'unveiled', 'revealed'
    ],
    ar: [
      'كيف', 'لماذا', 'شرح', 'دليل', 'أساسيات', 'مقدمة', 'فهم', 'ما هو', 'ما هي',
      'وول ستريت', 'سوق الأسهم', 'استثمار', 'مبادئ', 'من.*إلى', 'تاريخ',
      'يعمل', 'مهم', 'كيف تحول', 'فك', 'كشف'
    ]
  };
  
  // Check for evergreen patterns
  const matchesEvergreenPattern = evergreenKeywords.en.some(kw => {
    const pattern = new RegExp(kw.replace(/\./g, '\\.'), 'i');
    return pattern.test(title);
  }) || evergreenKeywords.ar.some(kw => {
    const pattern = new RegExp(kw.replace(/\./g, '\\.'), 'i');
    return pattern.test(titleAr);
  });
  
  // Check if no date references (timeless)
  const hasDateReference = /2024|2025|2026|2027|today|yesterday|tomorrow|اليوم|أمس|غدا|يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر/i.test(title);
  
  // Also check for Wall Street / market analysis (often evergreen)
  const isMarketAnalysis = /wall street|وول ستريت|stock market|سوق الأسهم|NYSE|NASDAQ|dow jones/i.test(title);
  
  if ((matchesEvergreenPattern || isMarketAnalysis) && !hasDateReference) {
    return {
      type: 'evergreen',
      label: 'Evergreen',
      icon: '📚',
      reason: 'Educational content - works anytime',
      bestFor: 'Slow news days, building library',
      color: 'blue'
    };
  }
  
  // ============================================
  // 🌍 MACRO TREND - Ongoing big stories
  // ============================================
  const macroTrendKeywords = {
    entities: ['china', 'الصين', 'russia', 'روسيا', 'america', 'أمريكا', 'iran', 'إيران', 'saudi', 'السعودية', 'europe', 'أوروبا'],
    topics: ['war', 'حرب', 'conflict', 'صراع', 'trade war', 'حرب تجارية', 'sanctions', 'عقوبات', 'oil', 'نفط', 'dollar', 'دولار']
  };
  
  const isMacroTrend = (macroTrendKeywords.entities.some(kw => title.includes(kw.toLowerCase()) || titleAr.includes(kw)) &&
                       macroTrendKeywords.topics.some(kw => title.includes(kw.toLowerCase()) || titleAr.includes(kw))) ||
                      // Also check if user has covered this topic before (30+ days ago)
                      signals.some(s => s.type === 'freshness' && s.evidence?.daysAgo > 30);
  
  if (isMacroTrend) {
    return {
      type: 'macro_trend',
      label: 'Macro Trend',
      icon: '🌍',
      reason: 'Ongoing story - revisit when news breaks',
      bestFor: 'Next major development in this story',
      color: 'purple'
    };
  }
  
  // ============================================
  // 📅 SEASONAL - Time-specific content
  // ============================================
  const seasonalKeywords = {
    en: ['2027', '2028', 'predictions', 'forecast', 'outlook', 'year ahead', 'ramadan', 'christmas', 'new year', 'black friday', 'q1', 'q2', 'q3', 'q4'],
    ar: ['2027', '2028', 'توقعات', 'تنبؤات', 'رمضان', 'العام الجديد', 'الربع الأول', 'الربع الثاني']
  };
  
  const isSeasonal = seasonalKeywords.en.some(kw => title.includes(kw.toLowerCase())) ||
                     seasonalKeywords.ar.some(kw => titleAr.includes(kw));
  
  if (isSeasonal) {
    return {
      type: 'seasonal',
      label: 'Seasonal',
      icon: '📅',
      reason: 'Time-specific content - save for right moment',
      bestFor: 'Schedule for appropriate date',
      color: 'orange'
    };
  }
  
  // ============================================
  // 🔍 DEEP DIVE - Default for complex topics
  // ============================================
  // Check if topic is complex (multiple DNA matches or patterns)
  const multipleDnaMatches = signals.filter(s => s.type === 'dna_match').length > 1;
  const multiplePatterns = (idea.behavior_patterns || []).length > 1;
  
  if (multipleDnaMatches || multiplePatterns) {
    return {
      type: 'deep_dive',
      label: 'Deep Dive',
      icon: '🔍',
      reason: 'Complex topic - worth a detailed analysis',
      bestFor: 'When you have time for quality content',
      color: 'teal'
    };
  }
  
  // ============================================
  // Default: Evergreen
  // ============================================
  return {
    type: 'evergreen',
    label: 'Evergreen',
    icon: '📚',
    reason: 'Good topic for your content library',
    bestFor: 'When you need content ideas',
    color: 'blue'
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find competitor breakout video
 * A breakout is when a competitor video gets 2x+ their average views
 * Returns the best breakout, prioritizing direct competitors
 */
async function findCompetitorBreakout(signalTitle, competitorVideos, excludedNames = []) {
  // DEBUG: Check for specific idea (Venezuela/Oil or Ukraine/Russia)
  const isDebugIdea = signalTitle && (
    (signalTitle.includes('ترامب') && signalTitle.includes('الصين')) ||
    signalTitle.toLowerCase().includes('venezuela') ||
    signalTitle.toLowerCase().includes('oil') ||
    signalTitle.toLowerCase().includes('ukraine') ||
    signalTitle.toLowerCase().includes('ukrainian') ||
    signalTitle.toLowerCase().includes('kyiv') ||
    signalTitle.toLowerCase().includes('russia') ||
    signalTitle.toLowerCase().includes('russian')
  );
  
  // DEBUG: Log for Ukraine/Russia ideas
  const isUkraineIdea = signalTitle && (
    signalTitle.toLowerCase().includes('ukraine') ||
    signalTitle.toLowerCase().includes('ukrainian') ||
    signalTitle.toLowerCase().includes('kyiv') ||
    signalTitle.toLowerCase().includes('russia') ||
    signalTitle.toLowerCase().includes('russian')
  );
  
  if (!competitorVideos || competitorVideos.length === 0) {
    if (isDebugIdea) {
      console.log('🔍 DEBUG findCompetitorBreakout: No competitor videos available');
      console.log('   Signal title:', signalTitle);
    }
    return null;
  }
  
  if (isUkraineIdea) {
    console.log(`\n🔍 ===== DEBUG findCompetitorBreakout for Ukraine/Russia idea =====`);
    console.log(`   Signal title:`, signalTitle);
    console.log(`   Total competitor videos to check:`, competitorVideos.length);
  }
  
  if (isDebugIdea) {
    console.log('\n🔍 DEBUG findCompetitorBreakout for:', signalTitle);
    console.log('   Total competitor videos:', competitorVideos.length);
  }

  // Group videos by competitor to calculate averages
  const competitorStats = {};
  for (const video of competitorVideos) {
    const competitorId = video.competitor_id || video.competitors?.id;
    if (!competitorId) {
      // DEBUG: Log missing competitor_id
      if (signalTitle && (signalTitle.toLowerCase().includes('venezuela') || signalTitle.toLowerCase().includes('oil'))) {
        console.log('🔍 DEBUG: Video missing competitor_id:', {
          video_id: video.id || video.video_id,
          has_competitors: !!video.competitors,
          competitors_id: video.competitors?.id
        });
      }
      continue;
    }

    if (!competitorStats[competitorId]) {
      competitorStats[competitorId] = {
        videos: [],
        totalViews: 0,
        channelName: video.competitors?.name || 'Unknown',
        type: video.competitors?.type || 'indirect', // Default to indirect if not specified (valid: 'direct', 'indirect', 'trendsetter')
      };
    }

    if (video.views && video.views > 0) {
      competitorStats[competitorId].videos.push(video);
      competitorStats[competitorId].totalViews += video.views;
    }
  }

  // Separate breakouts by type
  const directBreakouts = [];
  const indirectBreakouts = [];
  const trendsetterVideos = [];

  // Extract keywords with translations (only once, outside the loop)
  const ideaKeywords = extractKeywords(signalTitle);
  
  // DEBUG: Log keyword extraction for specific idea
  if (isDebugIdea) {
    console.log('   Extracted keywords from idea (with translations):', ideaKeywords);
    console.log('   Total competitors to check:', Object.keys(competitorStats).length);
  }

  // Check for breakouts matching the signal title
  for (const [competitorId, stats] of Object.entries(competitorStats)) {
    if (stats.videos.length < 5 && stats.type !== 'trendsetter') {
      if (isDebugIdea) {
        console.log(`   Skipping "${stats.channelName}" (${stats.type}): Only ${stats.videos.length} videos (need 5+ for non-trendsetters)`);
      }
      continue; // Need at least 5 videos to calculate average (except for trendsetters)
    }

    const avgViews = stats.totalViews / stats.videos.length;

    // Find videos from last 7 days that match the signal
    const recentVideos = stats.videos.filter(v => {
      // Normalize date field (some tables use publish_date, others use published_at)
      const videoDate = v.published_at || v.publish_date;
      const daysAgo = calculateDaysAgo(videoDate);
      if (daysAgo > 7) return false;

      // Extract keywords from title + description for better matching
      const titleKeywords = extractKeywords(v.title || '');
      const descKeywords = extractKeywords((v.description || '').substring(0, 200));
      const videoKeywords = [...new Set([...titleKeywords, ...descKeywords])];
      
      // ISSUE 2 FIX: Check if any keywords match signal with context-aware matching
      const competitorVideoText = `${v.title || ''} ${v.description || ''}`;
      const matchingKeywords = ideaKeywords.filter(kw => {
        // Check if this keyword requires context-aware matching
        const contextCheck = requiresContextAwareMatching(kw, competitorVideoText);
        if (contextCheck.requiresContext && !contextCheck.shouldMatch) {
          // Skip this keyword - it's ambiguous without proper context
          return false;
        }
        
        const normalizedKw = normalizeArabicText(kw).toLowerCase();
        const hasMatch = videoKeywords.some(vk => {
          const normalizedVk = normalizeArabicText(vk).toLowerCase();
          return normalizedVk.includes(normalizedKw) || normalizedKw.includes(normalizedVk);
        });
        
        // If context is required, verify the context exists in video text
        if (contextCheck.requiresContext && contextCheck.shouldMatch) {
          const videoTextLower = normalizeArabicText(competitorVideoText).toLowerCase();
          if (contextCheck.context === 'fed') {
            const fedContextWords = ['reserve', 'bank', 'monetary', 'policy', 'interest', 'rate', 'economy', 'اقتصاد'];
            const hasFedContext = fedContextWords.some(ctx => videoTextLower.includes(ctx));
            return hasMatch && hasFedContext;
          } else if (contextCheck.context === 'forces') {
            const forcesContextWords = ['forces', 'force', 'military', 'syria', 'سوريا', 'قوات', 'عسكري'];
            const hasForcesContext = forcesContextWords.some(ctx => videoTextLower.includes(ctx));
            return hasMatch && hasForcesContext;
          }
        }
        
        return hasMatch && normalizedKw.length > 1; // Minimum keyword length
      });
      
      // Use keyword weighting system to validate match (with excluded names)
      const matchResult = calculateMatchScore(matchingKeywords, excludedNames);
      
      // DEBUG: Log matching for specific idea
      if (isDebugIdea && stats.channelName) {
        console.log(`   Checking "${stats.channelName}" (${stats.type}): "${v.title?.substring(0, 50)}..."`);
        console.log(`     Days ago: ${daysAgo}, Views: ${v.views}, Avg: ${avgViews.toFixed(0)}`);
        console.log(`     Video description (first 100): "${(v.description || '').substring(0, 100)}"`);
        console.log(`     Video keywords (title + description):`, videoKeywords.slice(0, 10));
        console.log(`     Idea keywords:`, ideaKeywords.slice(0, 10));
        console.log(`     Matching keywords:`, matchingKeywords);
        console.log(`     🎯 Match analysis:`, {
          rawKeywords: matchingKeywords.length,
          concepts: matchResult.concepts,
          score: matchResult.score,
          isValid: matchResult.isValidMatch,
          debug: matchResult.debug
        });
        console.log(`     Match: ${matchResult.isValidMatch ? '✅ YES' : '❌ NO'} (${matchResult.debug})`);
      }

      // Use keyword weighting system - requires minimum score and high-value concepts
      return matchResult.isValidMatch;
    });
    
    if (isDebugIdea && stats.channelName) {
      console.log(`   Result: ${recentVideos.length} matching videos out of ${stats.videos.length} total for "${stats.channelName}"`);
    }

    for (const video of recentVideos) {
      const multiplier = video.views && avgViews > 0 ? video.views / avgViews : 0;
      
      if (stats.type === 'trendsetter') {
        // For trendsetters, only include breakouts (1.5x+ average), not any post
        if (multiplier >= 1.5) {
          // Normalize date field (some tables use publish_date, others use published_at)
          const videoDate = video.published_at || video.publish_date;
          const hoursAgo = Math.floor((Date.now() - new Date(videoDate)) / (1000 * 60 * 60));
          
          // Use topic intelligence for trendsetter matching (replaces old keyword matching)
          try {
            const matchResult = await isRelevantCompetitorVideo(
              { title: signalTitle },
              { title: video.title || '', description: video.description || '' }
            );
            
            if (!matchResult.relevant) {
              if (isDebugIdea) {
                console.log(`     ⚠️ SKIP: Not relevant - ${matchResult.reason || 'no match'}`);
                console.log(`       Relationship: ${matchResult.relationship}, Confidence: ${matchResult.confidence?.toFixed(2)}`);
                console.log(`       Semantic similarity: ${matchResult.semanticSimilarity?.toFixed(2)}`);
              }
              continue; // Skip this video - not relevant
            }
            
            // Use displayMatches from topic intelligence (entity overlap)
            const displayMatches = matchResult.displayMatches || [];
            
            // Generate video URL with fallbacks
            // IMPORTANT: competitor_videos uses 'youtube_video_id' column (no youtube_url column)
            // Use normalized video_id (which is mapped from youtube_video_id) or youtube_video_id directly
            const youtubeVideoId = video.video_id || video.youtube_video_id || video.id;
            // competitor_videos doesn't have youtube_url, so always construct from youtube_video_id
            const trendsetterVideoUrl = youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : null;
            
            // DEBUG: Log URL generation for Ukraine/Russia ideas
            const isUkraineIdea = signalTitle && (
              signalTitle.toLowerCase().includes('ukraine') ||
              signalTitle.toLowerCase().includes('ukrainian') ||
              signalTitle.toLowerCase().includes('kyiv') ||
              signalTitle.toLowerCase().includes('russia') ||
              signalTitle.toLowerCase().includes('russian')
            );
            if (isUkraineIdea) {
              console.log(`     🔗 Trendsetter video URL generation:`);
              console.log(`       video.youtube_video_id (raw):`, video.youtube_video_id || 'null');
              console.log(`       video.video_id (normalized):`, video.video_id || 'null');
              console.log(`       video.id:`, video.id || 'null');
              console.log(`       Final youtubeVideoId:`, youtubeVideoId);
              console.log(`       Final videoUrl:`, trendsetterVideoUrl);
              console.log(`       ⚠️ Note: competitor_videos has NO youtube_url column, URL must be constructed from youtube_video_id`);
            }
            
            trendsetterVideos.push({
              type: 'trendsetter',
              channelId: competitorId,
              channelName: stats.channelName,
              videoId: youtubeVideoId,
              videoTitle: video.title || '',
              videoUrl: trendsetterVideoUrl,
              videoDescription: (video.description || '').substring(0, 200),
              matchedKeywords: displayMatches, // Use entity matches from topic intelligence
              matchScore: matchResult.confidence || 0,
              views: video.views || 0,
              averageViews: avgViews || 0,
              multiplier: multiplier,
              publishedAt: videoDate,
              hoursAgo: hoursAgo,
            });
            
            // DEBUG: Log trendsetter breakout
            if (isDebugIdea) {
              console.log(`   ✅ Trendsetter BREAKOUT: "${stats.channelName}" - ${multiplier.toFixed(2)}x average (${video.views} views / ${avgViews.toFixed(0)} avg)`);
            }
          } catch (error) {
            if (isDebugIdea) {
              console.log(`     ⚠️ SKIP: Topic intelligence error - ${error.message}`);
            }
            continue; // Skip this video on error
          }
        } else if (isDebugIdea) {
          console.log(`   ⚠️ Trendsetter NOT a breakout: "${stats.channelName}" - ${multiplier.toFixed(2)}x average (${video.views} views / ${avgViews.toFixed(0)} avg) - SKIPPED`);
        }
      } else if (video.views && video.views >= avgViews * 2) {
        // For direct/indirect, only include breakouts (2x+ average)
        // ISSUE 2 FIX: Extract matched keywords with context-aware matching
        const titleKeywords = extractKeywords(video.title || '');
        const descKeywords = extractKeywords((video.description || '').substring(0, 200));
        const videoKeywords = [...new Set([...titleKeywords, ...descKeywords])];
        const directIndirectVideoText = `${video.title || ''} ${video.description || ''}`;
        const matchedKeywords = ideaKeywords.filter(kw => {
          // Check if this keyword requires context-aware matching
          const contextCheck = requiresContextAwareMatching(kw, directIndirectVideoText);
          if (contextCheck.requiresContext && !contextCheck.shouldMatch) {
            // Skip this keyword - it's ambiguous without proper context
            return false;
          }
          
          const normalizedKw = normalizeArabicText(kw).toLowerCase();
          const hasMatch = videoKeywords.some(vk => {
            const normalizedVk = normalizeArabicText(vk).toLowerCase();
            return normalizedVk.includes(normalizedKw) || normalizedKw.includes(normalizedVk);
          });
          
          // If context is required, verify the context exists
          if (contextCheck.requiresContext && contextCheck.shouldMatch) {
            const videoTextLower = normalizeArabicText(directIndirectVideoText).toLowerCase();
            if (contextCheck.context === 'fed') {
              const fedContextWords = ['reserve', 'bank', 'monetary', 'policy', 'interest', 'rate', 'economy', 'اقتصاد'];
              const hasFedContext = fedContextWords.some(ctx => videoTextLower.includes(ctx));
              return hasMatch && hasFedContext;
            } else if (contextCheck.context === 'forces') {
              const forcesContextWords = ['forces', 'force', 'military', 'syria', 'سوريا', 'قوات', 'عسكري'];
              const hasForcesContext = forcesContextWords.some(ctx => videoTextLower.includes(ctx));
              return hasMatch && hasForcesContext;
            }
          }
          
          return hasMatch && normalizedKw.length > 1;
        });
        
        // Use keyword weighting system to validate match (with excluded names)
        const matchResult = calculateMatchScore(matchedKeywords, excludedNames);
        if (!matchResult.isValidMatch) {
          if (isDebugIdea) {
            console.log(`     ⚠️ SKIP: Invalid match - ${matchResult.debug}`);
            console.log(`       Raw keywords: ${matchedKeywords.slice(0, 5).join(', ')}`);
            console.log(`       Concepts: ${matchResult.concepts.join(', ')} (${matchResult.conceptCount})`);
            console.log(`       Score: ${matchResult.score} (need >= 12)`);
          }
          continue; // Skip this video - not enough weighted match score
        }
        
        // Normalize date field (some tables use publish_date, others use published_at)
        const videoDate = video.published_at || video.publish_date;
        
        // Generate video URL with fallbacks
        // IMPORTANT: competitor_videos uses 'youtube_video_id' column (no youtube_url column)
        // Use normalized video_id (which is mapped from youtube_video_id) or youtube_video_id directly
        const youtubeVideoId = video.video_id || video.youtube_video_id || video.id;
        // competitor_videos doesn't have youtube_url, so always construct from youtube_video_id
        const breakoutVideoUrl = youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : null;
        
        // DEBUG: Log URL generation for Ukraine/Russia ideas
        const isUkraineIdea = signalTitle && (
          signalTitle.toLowerCase().includes('ukraine') ||
          signalTitle.toLowerCase().includes('ukrainian') ||
          signalTitle.toLowerCase().includes('kyiv') ||
          signalTitle.toLowerCase().includes('russia') ||
          signalTitle.toLowerCase().includes('russian')
        );
        if (isUkraineIdea) {
          console.log(`     🔗 Competitor breakout video URL generation:`);
          console.log(`       video.youtube_video_id (raw):`, video.youtube_video_id || 'null');
          console.log(`       video.video_id (normalized):`, video.video_id || 'null');
          console.log(`       video.id:`, video.id || 'null');
          console.log(`       Final youtubeVideoId:`, youtubeVideoId);
          console.log(`       Final videoUrl:`, breakoutVideoUrl);
          console.log(`       ⚠️ Note: competitor_videos has NO youtube_url column, URL must be constructed from youtube_video_id`);
        }
        
        // Update matchedKeywords to show clean concepts for evidence
        const cleanMatchedKeywords = matchResult.concepts;
        
        const breakout = {
          type: stats.type,
          channelId: competitorId,
          channelName: stats.channelName,
          videoId: youtubeVideoId,
          videoTitle: video.title || '',
          videoUrl: breakoutVideoUrl,
          videoDescription: (video.description || '').substring(0, 200),
          matchedKeywords: cleanMatchedKeywords, // Use clean concepts instead of raw keywords
          matchScore: matchResult.score,
          views: video.views,
          averageViews: avgViews,
          multiplier: video.views / avgViews,
          publishedAt: videoDate,
          hoursAgo: Math.floor((Date.now() - new Date(videoDate)) / (1000 * 60 * 60)),
        };

        if (stats.type === 'direct') {
          directBreakouts.push(breakout);
        } else {
          // 'indirect' - treated as indirect for scoring
          indirectBreakouts.push(breakout);
        }
      }
    }
  }

  // Prioritize: direct > trendsetter > indirect
  if (directBreakouts.length > 0) {
    const best = directBreakouts.sort((a, b) => b.multiplier - a.multiplier)[0];
    if (isDebugIdea) {
      console.log('   ✅ Found direct breakout:', best);
      console.log('===== END findCompetitorBreakout DEBUG =====\n');
    }
    return best;
  }

  // For trendsetters, prioritize recency over multiplier
  if (trendsetterVideos.length > 0) {
    const best = trendsetterVideos.sort((a, b) => {
      // Sort by recency first (newest first), then by multiplier
      if (a.hoursAgo !== b.hoursAgo) {
        return a.hoursAgo - b.hoursAgo;
      }
      return b.multiplier - a.multiplier;
    })[0];
    if (isDebugIdea) {
      console.log('   ✅ Found trendsetter video:', best);
      console.log('===== END findCompetitorBreakout DEBUG =====\n');
    }
    return best;
  }

  // Otherwise return best indirect breakout
  if (indirectBreakouts.length > 0) {
    const best = indirectBreakouts.sort((a, b) => b.multiplier - a.multiplier)[0];
    if (isDebugIdea) {
      console.log('   ✅ Found indirect breakout:', best);
      console.log('===== END findCompetitorBreakout DEBUG =====\n');
    }
    return best;
  }

  if (isDebugIdea) {
    console.log('   ❌ No breakouts found');
    console.log(`   Direct breakouts: ${directBreakouts.length}, Trendsetter videos: ${trendsetterVideos.length}, Indirect breakouts: ${indirectBreakouts.length}`);
    console.log('===== END findCompetitorBreakout DEBUG =====\n');
  }

  return null;
}

/**
 * Count how many competitors posted about this topic in last N days
 * Returns object with direct, indirect, and total counts
 * @param {string} signalTitle - The signal/idea title
 * @param {Array} competitorVideos - Array of competitor videos
 * @param {number} days - Number of days to look back
 * @param {string[]} excludedNames - Optional array of excluded names (channel/source names) to filter out
 */
function countCompetitorMatches(signalTitle, competitorVideos, days = 7, excludedNames = []) {
  // DEBUG: Check for specific idea
  const isDebugIdea = signalTitle && (
    signalTitle.includes('ترامب') && signalTitle.includes('الصين')
  );
  
  if (!competitorVideos || competitorVideos.length === 0) {
    if (isDebugIdea) {
      console.log('🔍 DEBUG countCompetitorMatches: No competitor videos available');
      console.log('   Signal title:', signalTitle);
    }
    return {
      direct: 0,
      indirect: 0,
      trendsetter: 0,
      total: 0,
      details: []
    };
  }

  const keywords = extractKeywords(signalTitle);
  const directCompetitors = new Set();
  const indirectCompetitors = new Set();
  const trendsetterCompetitors = new Set();
  const competitorDetails = [];
  
  if (isDebugIdea) {
    console.log('\n🔍 DEBUG countCompetitorMatches for:', signalTitle);
    console.log('   Extracted keywords:', keywords);
    console.log('   Total competitor videos to check:', competitorVideos.length);
  }
  
  const isDebugSignal = signalTitle && (signalTitle.toLowerCase().includes('venezuela') || signalTitle.toLowerCase().includes('oil'));
  if (isDebugSignal) {
    console.log('🔍 DEBUG countCompetitorMatches:', {
      signalTitle: signalTitle?.substring(0, 60),
      extractedKeywords: keywords.slice(0, 10),
      competitorVideosCount: competitorVideos.length
    });
  }

  for (const video of competitorVideos) {
    // Normalize date field (some tables use publish_date, others use published_at)
    const videoDate = video.published_at || video.publish_date;
    const daysAgo = calculateDaysAgo(videoDate);
    if (daysAgo > days) continue;

    // Extract keywords from title + description for better matching
    const titleKeywords = extractKeywords(video.title || '');
    const descKeywords = extractKeywords((video.description || '').substring(0, 200));
    const videoKeywords = [...new Set([...titleKeywords, ...descKeywords])];
    
    // Check if any keywords match signal
    const matchingKeywords = keywords.filter(kw => {
      const normalizedKw = normalizeArabicText(kw).toLowerCase();
      return videoKeywords.some(vk => {
        const normalizedVk = normalizeArabicText(vk).toLowerCase();
        return normalizedVk.includes(normalizedKw) || normalizedKw.includes(normalizedVk);
      }) && normalizedKw.length > 1; // Minimum keyword length
    });
    
    // Use keyword weighting system to validate match (with excluded names)
    const matchResult = calculateMatchScore(matchingKeywords, excludedNames);
    const isValidMatch = matchResult.isValidMatch;
    
    if (isDebugIdea && isValidMatch) {
      console.log(`   Video: "${video.title?.substring(0, 50)}..."`);
      console.log(`     Type: ${video.competitors?.type || 'unknown'}, Channel: ${video.competitors?.name || 'unknown'}`);
      console.log(`     Days ago: ${daysAgo}`);
      console.log(`     Video description (first 100): "${(video.description || '').substring(0, 100)}"`);
      console.log(`     Video keywords (title + description):`, videoKeywords.slice(0, 10));
      console.log(`     Matching keywords:`, matchingKeywords);
      console.log(`     🎯 Match analysis:`, {
        rawKeywords: matchingKeywords.length,
        concepts: matchResult.concepts,
        score: matchResult.score,
        isValid: matchResult.isValidMatch,
        debug: matchResult.debug
      });
      console.log(`     Match: ${isValidMatch ? '✅ YES' : '❌ NO'} (${matchResult.debug})`);
    }
    
    if (isDebugIdea && daysAgo <= days) {
      // Log all videos checked for debugging (not just matches)
      console.log(`   Video checked: "${video.title?.substring(0, 40)}..." | Type: ${video.competitors?.type || 'unknown'} | Days: ${daysAgo} | Match: ${isValidMatch ? 'YES' : 'NO'} | Keywords: ${matchingKeywords.length} → Score: ${matchResult.score} (${matchResult.concepts.join(', ')})`);
    }

    if (isDebugSignal && isValidMatch) {
      console.log('🔍 DEBUG: Competitor video match:', {
        videoTitle: video.title?.substring(0, 50),
        videoDescription: (video.description || '').substring(0, 100),
        videoKeywords: videoKeywords.slice(0, 10),
        matchingKeywords,
        matchResult: {
          concepts: matchResult.concepts,
          score: matchResult.score,
          isValid: matchResult.isValidMatch
        },
        competitorId: video.competitor_id || video.competitors?.id,
        type: video.competitors?.type
      });
    }

    // Use keyword weighting system - requires minimum score and high-value concepts
    if (isValidMatch) {
      const competitorId = video.competitor_id || video.competitors?.id;
      if (competitorId) {
        const competitorType = video.competitors?.type || 'indirect';
        const competitorName = video.competitors?.name || 'Unknown';
        
        if (competitorType === 'direct') {
          directCompetitors.add(competitorId);
        } else if (competitorType === 'trendsetter') {
          // Trendsetters tracked separately
          trendsetterCompetitors.add(competitorId);
        } else {
          // 'indirect' - treated as indirect for scoring
          indirectCompetitors.add(competitorId);
        }
        
        // Track details for each unique competitor with evidence
        const existingDetail = competitorDetails.find(d => d.id === competitorId);
        if (!existingDetail) {
          // Generate video URL with fallbacks
          // IMPORTANT: competitor_videos uses 'youtube_video_id' column (no youtube_url column)
          // Use normalized video_id (which is mapped from youtube_video_id) or youtube_video_id directly
          const youtubeVideoId = video.video_id || video.youtube_video_id || video.id;
          // competitor_videos doesn't have youtube_url, so always construct from youtube_video_id
          const competitorVideoUrl = youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : null;
          
          // DEBUG: Log URL generation for ALL competitor matches (not just Ukraine/Russia)
          if (matchingKeywords.length >= 2) {
            const isDebugIdea = signalTitle && (
              signalTitle.toLowerCase().includes('ukraine') ||
              signalTitle.toLowerCase().includes('ukrainian') ||
              signalTitle.toLowerCase().includes('kyiv') ||
              signalTitle.toLowerCase().includes('russia') ||
              signalTitle.toLowerCase().includes('russian') ||
              signalTitle.toLowerCase().includes('gold') ||
              signalTitle.toLowerCase().includes('ذهب') ||
              signalTitle.toLowerCase().includes('openai') ||
              signalTitle.toLowerCase().includes('chatgpt')
            );
            if (isDebugIdea) {
              console.log(`     🔗 Competitor video URL generation:`);
              console.log(`       Video title: "${video.title?.substring(0, 50)}..."`);
              console.log(`       video.youtube_video_id (raw):`, video.youtube_video_id || 'null');
              console.log(`       video.video_id (normalized):`, video.video_id || 'null');
              console.log(`       video.id:`, video.id || 'null');
              console.log(`       Final youtubeVideoId:`, youtubeVideoId);
              console.log(`       Final videoUrl:`, competitorVideoUrl);
              console.log(`       ⚠️ Note: competitor_videos has NO youtube_url column, URL must be constructed from youtube_video_id`);
            }
          }
          
          competitorDetails.push({
            id: competitorId,
            name: competitorName,
            type: competitorType,
            videoTitle: video.title || '',
            videoUrl: competitorVideoUrl,
            matchedKeywords: matchResult.concepts, // Use clean concepts
            matchScore: matchResult.score,
          });
        } else {
          // If already exists, update with more recent video if needed
          const existingDate = existingDetail.published_at || existingDetail.publish_date || '9999-01-01';
          const existingDaysAgo = calculateDaysAgo(existingDate);
          if (daysAgo < existingDaysAgo) {
            existingDetail.videoTitle = video.title || '';
            // Generate video URL with fallbacks
            // IMPORTANT: competitor_videos uses 'youtube_video_id' column (no youtube_url column)
            // Use normalized video_id (which is mapped from youtube_video_id) or youtube_video_id directly
            const youtubeVideoId = video.video_id || video.youtube_video_id || video.id;
            // competitor_videos doesn't have youtube_url, so always construct from youtube_video_id
            const updatedVideoUrl = youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : null;
            existingDetail.videoUrl = updatedVideoUrl;
            // Merge concepts (avoid duplicates)
            const existingConcepts = existingDetail.matchedKeywords || [];
            const newConcepts = matchResult.concepts || [];
            existingDetail.matchedKeywords = [...new Set([...existingConcepts, ...newConcepts])];
            existingDetail.matchScore = Math.max(existingDetail.matchScore || 0, matchResult.score);
            // Normalize date field (some tables use publish_date, others use published_at)
            existingDetail.published_at = videoDate;
            existingDetail.publish_date = videoDate; // Keep both for consistency
          }
        }
      }
    }
  }

  if (isDebugSignal) {
    console.log('🔍 DEBUG: Final competitor counts:', {
      direct: directCompetitors.size,
      indirect: indirectCompetitors.size,
      trendsetter: trendsetterCompetitors.size,
      total: directCompetitors.size + indirectCompetitors.size + trendsetterCompetitors.size
    });
  }
  
  if (isDebugIdea) {
    console.log('   Final counts:', {
      direct: directCompetitors.size,
      indirect: indirectCompetitors.size,
      trendsetter: trendsetterCompetitors.size,
      total: directCompetitors.size + indirectCompetitors.size + trendsetterCompetitors.size
    });
    console.log('===== END countCompetitorMatches DEBUG =====\n');
  }

  return {
    direct: directCompetitors.size,
    indirect: indirectCompetitors.size,
    trendsetter: trendsetterCompetitors.size,
    total: directCompetitors.size + indirectCompetitors.size + trendsetterCompetitors.size,
    details: competitorDetails
  };
}

/**
 * Find DNA match for signal
 */
function findDnaMatch(signalTopicId, signalTitle, dnaTopics) {
  const matches = [];

  // Ensure dnaTopics is an array
  if (!Array.isArray(dnaTopics)) {
    console.warn('dnaTopics is not an array in findDnaMatch:', typeof dnaTopics);
    return matches;
  }

  // DEBUG: Log DNA matching attempt for Venezuela/oil signals
  const isDebugSignal = signalTitle && (
    signalTitle.toLowerCase().includes('venezuela') || 
    signalTitle.toLowerCase().includes('oil') || 
    signalTitle.toLowerCase().includes('tanker') ||
    signalTitle.toLowerCase().includes('openai') ||
    signalTitle.toLowerCase().includes('chatgpt') ||
    signalTitle.toLowerCase().includes('ukraine') ||
    signalTitle.toLowerCase().includes('ukrainian') ||
    signalTitle.toLowerCase().includes('gold') ||
    signalTitle.toLowerCase().includes('ذهب') ||
    signalTitle.toLowerCase().includes('دولار')
  );
  if (isDebugSignal) {
    console.log(`\n🔍 ===== DEBUG findDnaMatch =====`);
    console.log(`   Signal title:`, signalTitle?.substring(0, 100));
    console.log(`   Signal topicId:`, signalTopicId);
    console.log(`   DNA topics count:`, dnaTopics.length);
    console.log(`   DNA topics sample:`, dnaTopics.slice(0, 3).map(t => ({
      topic_id: t.topic_id || t.topicId || t.id,
      keywords: (t.keywords?.slice(0, 5) || []).join(', ') || 'no keywords',
      name: t.name || t.topic_name || 'no name'
    })));
  }

  // Check by topic_id first
  if (signalTopicId && dnaTopics.length > 0) {
    const dnaTopic = dnaTopics.find(t => {
      if (!t) return false;
      // Handle different topic_id field names
      const tId = t.topic_id || t.topicId || t.id || t.topic;
      return tId === signalTopicId || String(tId) === String(signalTopicId);
    });
    if (dnaTopic) {
      matches.push(signalTopicId);
      if (isDebugSignal) {
        console.log('✅ DEBUG: DNA match found by topic_id:', signalTopicId);
      }
    }
  }

  // Hardcoded topic keywords as fallback (from TOPIC_KEYWORDS in topicKeywords.js)
  // These are used when DNA topics don't have keywords or structure
  // FIXED: Now uses REQUIRED keywords only (must have one to match)
  const HARDCODED_TOPIC_KEYWORDS = {
    'energy_oil_gas_lng': {
      required: ['oil', 'نفط', 'النفط', 'gas', 'غاز', 'lng', 'energy', 'petroleum', 'crude'],
      supporting: ['opec', 'أوبك', 'pipeline', 'oil price', 'aramco']
    },
    'us_china_geopolitics': {
      required: ['china', 'chinese', 'beijing', 'taiwan', 'الصين', 'صين', 'بكين', 'تايوان'], // REQUIRED: must have one
      supporting: ['trade war', 'tariff', 'الصين', 'أمريكا', 'trump china', 'america', 'usa', 'united states'] // SUPPORTING: only if required is present
    },
    'sanctions_econ_war': {
      required: ['sanctions', 'embargo', 'boycott', 'عقوبات', 'حظر'],
      supporting: []
    },
    'logistics_supply_chain': {
      required: ['shipping', 'supply chain', 'logistics', 'freight'],
      supporting: ['port', 'container']
    },
    'consumer_credit_cards': {
      required: ['credit card', 'credit cards', 'بطاقات', 'بطاقة', 'ائتمان', 'credit'],
      supporting: ['bnpl', 'buy now pay later', 'delinquency', 'default', 'debt', 'loan']
    }
  };

  // Direct check against hardcoded keywords if DNA topics are empty or don't have proper structure
  // FIX: Use extracted keywords for better matching (not substring)
  if (signalTitle && (dnaTopics.length === 0 || dnaTopics.every(t => {
    const hasTopicId = t?.topic_id || t?.topicId || t?.id;
    const hasKeywords = Array.isArray(t?.keywords) && t.keywords.length > 0;
    return !hasTopicId && !hasKeywords;
  }))) {
    const signalKeywords = extractKeywords(signalTitle);
    const signalTitleLower = signalTitle.toLowerCase();
    
    // Check each hardcoded topic
    for (const [topicId, topicDef] of Object.entries(HARDCODED_TOPIC_KEYWORDS)) {
      // FIXED: Support both old format (array) and new format (object with required/supporting)
      const requiredKeywords = topicDef.required || (Array.isArray(topicDef) ? topicDef : []);
      const supportingKeywords = topicDef.supporting || [];
      
      // Must have at least 1 REQUIRED keyword to match
      let hasRequiredMatch = false;
      for (const keyword of requiredKeywords) {
        const keywordLower = keyword.toLowerCase().trim();
        // Skip very short keywords (except for specific ones like 'us', 'ai', 'uk' which require exact match)
        if (keywordLower.length < 3 && !['ai', 'us', 'uk'].includes(keywordLower)) continue;
        
        // Check if keyword appears in extracted keywords (better matching)
        const isKeywordMatch = signalKeywords.some(sk => {
          const skLower = normalizeArabicText(sk).toLowerCase();
          
          // For very short keywords (2 chars), require exact match only (no substring)
          // This prevents "openai" from matching "ai" or "unveils" from matching "us"
          if (keywordLower.length === 2) {
            return skLower === keywordLower; // Exact match only
          }
          
          // For short keywords (3 chars), require word boundary match
          if (keywordLower.length === 3) {
            return skLower === keywordLower || 
                   skLower.includes(` ${keywordLower} `) ||
                   skLower.startsWith(`${keywordLower} `) ||
                   skLower.endsWith(` ${keywordLower}`);
          }
          
          // For longer keywords (4+ chars), allow substring match (less likely to be false positive)
          return skLower.includes(keywordLower) || keywordLower.includes(skLower);
        });
        
        if (isKeywordMatch) {
          hasRequiredMatch = true;
          if (!matches.includes(topicId)) {
            matches.push(topicId);
            if (isDebugSignal) {
              console.log(`   ✅ DNA match (hardcoded fallback): REQUIRED keyword "${keywordLower}" → topic "${topicId}"`);
            }
            break; // Found match for this topic
          }
        } else if (isDebugSignal && keywordLower.length <= 3) {
          // Debug why short keywords didn't match
          console.log(`   ❌ Hardcoded REQUIRED keyword "${keywordLower}" did NOT match (word boundary check)`);
        }
      }
      
      if (!hasRequiredMatch && isDebugSignal && requiredKeywords.length > 0) {
        console.log(`   ❌ Topic "${topicId}": No REQUIRED keywords matched (checked ${requiredKeywords.length} required keywords)`);
      }
    }
  }

  // Also check by keyword matching if we have topic definitions
  // Enhanced: Check both English and Arabic keywords, and use extractKeywords for better matching
  // Also use topic_id from signal if it matches any DNA topic
  if (dnaTopics.length > 0 && signalTitle) {
    const signalTitleLower = signalTitle.toLowerCase();
    const signalKeywords = extractKeywords(signalTitle);
    
    if (isDebugSignal) {
      console.log('🔍 DEBUG: Extracted keywords from signal:', signalKeywords.slice(0, 10));
    }
    
    for (const dnaTopic of dnaTopics) {
      if (!dnaTopic) continue;
      
      // Handle different DNA topic structures
      // Could be: object with topic_id/keywords, or just a string (topic_id), or just an object with id
      let dnaTopicId = null; // DNA topic's topic_id (different from signalTopicId parameter)
      let topicKeywords = [];
      
      if (typeof dnaTopic === 'string') {
        // If it's just a string, treat it as topic_id
        dnaTopicId = dnaTopic;
      } else if (typeof dnaTopic === 'object') {
        dnaTopicId = dnaTopic.topic_id || dnaTopic.topicId || dnaTopic.id || dnaTopic.topic;
        
        // Handle different keyword field structures
        if (Array.isArray(dnaTopic.keywords)) {
          topicKeywords = dnaTopic.keywords;
        } else if (dnaTopic.keywords && typeof dnaTopic.keywords === 'string') {
          topicKeywords = [dnaTopic.keywords];
        } else if (dnaTopic.keywords && typeof dnaTopic.keywords === 'object') {
          // If keywords is an object, try to extract values
          topicKeywords = Object.values(dnaTopic.keywords).filter(k => typeof k === 'string');
        }
        
        // Also check if topic has a name that could match
        const topicName = dnaTopic.name || dnaTopic.topic_name || dnaTopic.label_en || dnaTopic.label_ar || '';
        if (topicName && typeof topicName === 'string' && topicName.length > 2) {
          topicKeywords.push(topicName.toLowerCase());
        }
      }
      
      // If we have a topic_id, check if signal's topic_id matches DNA topic's topic_id
      if (signalTopicId && dnaTopicId && signalTopicId === dnaTopicId) {
        if (!matches.includes(signalTopicId)) {
          matches.push(signalTopicId);
          if (isDebugSignal) {
            console.log('✅ DEBUG: DNA match found by topic_id:', signalTopicId);
          }
          continue; // Found match, move to next topic
        }
      }
      
      // If no keywords in DNA topic, try hardcoded keywords as fallback
      if (topicKeywords.length === 0 && dnaTopicId && HARDCODED_TOPIC_KEYWORDS[dnaTopicId]) {
        const hardcodedDef = HARDCODED_TOPIC_KEYWORDS[dnaTopicId];
        // Support both old format (array) and new format (object with required/supporting)
        if (Array.isArray(hardcodedDef)) {
          topicKeywords = hardcodedDef;
        } else {
          // New format: use required keywords (must have one to match)
          topicKeywords = hardcodedDef.required || [];
        }
        if (isDebugSignal) {
          console.log('🔍 DEBUG: Using hardcoded REQUIRED keywords for topic:', dnaTopicId, topicKeywords.slice(0, 5));
        }
      }
      
      // If still no keywords to check, skip
      if (topicKeywords.length === 0) continue;
      
      if (isDebugSignal) {
        console.log('🔍 DEBUG: Checking DNA topic:', {
          topic_id: dnaTopicId,
          topic_name: dnaTopic?.name || dnaTopic?.topic_name,
          keywords: topicKeywords.slice(0, 5),
          keywords_type: typeof dnaTopic?.keywords
        });
      }
      
      // FIX: Use word boundaries or exact keyword matching (not substring)
      // This prevents "OpenAI" from matching "ai" or "us_china_geopolitics" from matching "unveils"
      for (const keyword of topicKeywords) {
        if (typeof keyword !== 'string') continue;
        
        const keywordLower = keyword.toLowerCase().trim();
        if (keywordLower.length < 2) continue;
        
        // Skip very short keywords that are too generic (like 'us', 'ai' as standalone words)
        // These can cause false matches when they appear as substrings
        // FIX: For 'us' and 'ai', only match as whole words (word boundaries required)
        if (keywordLower.length < 3 && !['ai', 'us', 'uk'].includes(keywordLower)) continue;
        
        // For very short keywords ('us', 'ai', 'uk'), require strict word boundary matching
        // This prevents "unveils" from matching "us" or "openai" from matching "ai"
        const isKeywordMatch = signalKeywords.some(sk => {
          const skLower = normalizeArabicText(sk).toLowerCase();
          
          // For very short keywords (2 chars), require exact match only (no substring)
          // This prevents "openai" from matching "ai" or "unveils" from matching "us"
          if (keywordLower.length === 2) {
            return skLower === keywordLower; // Exact match only
          }
          
          // For longer keywords (3+ chars), allow word boundary matching
          return skLower === keywordLower || 
                 skLower.includes(` ${keywordLower} `) ||
                 skLower.startsWith(`${keywordLower} `) ||
                 skLower.endsWith(` ${keywordLower}`) ||
                 // For multi-word keywords, check each word
                 (keywordLower.includes(' ') && keywordLower.split(' ').every(kw => skLower.includes(kw)));
        });
        
        if (isKeywordMatch) {
          const topicIdToAdd = dnaTopicId || dnaTopic?.topic_id || dnaTopic?.topicId || dnaTopic?.id;
          if (topicIdToAdd && !matches.includes(topicIdToAdd)) {
            matches.push(topicIdToAdd);
            if (isDebugSignal) {
              console.log(`   ✅ DNA match found: keyword "${keywordLower}" → topic "${topicIdToAdd}"`);
              console.log(`      Matched signal keywords:`, signalKeywords.filter(sk => {
                const skLower = normalizeArabicText(sk).toLowerCase();
                if (keywordLower.length === 2) {
                  return skLower === keywordLower;
                }
                return skLower === keywordLower || 
                       skLower.includes(` ${keywordLower} `) ||
                       skLower.startsWith(`${keywordLower} `) ||
                       skLower.endsWith(` ${keywordLower}`);
              }));
            }
            break; // Found a match for this topic, move to next topic
          }
        } else if (isDebugSignal && keywordLower.length <= 3) {
          // Debug why short keywords didn't match
          console.log(`   ❌ Short keyword "${keywordLower}" did NOT match (word boundary check)`);
          console.log(`      Signal keywords checked:`, signalKeywords.slice(0, 10));
        }
        
        // Also check if keyword appears in title as whole word (fallback, but stricter)
        // Use word boundaries for short keywords to avoid false matches
        if (keywordLower.length >= 4) {
          // Longer keywords can use substring match (less likely to be false positive)
          // But still prefer whole word matching
          const titleWords = signalTitleLower.split(/\s+/);
          const isTitleMatch = titleWords.some(word => {
            const normalizedWord = normalizeArabicText(word).toLowerCase();
            return normalizedWord === keywordLower || 
                   normalizedWord.includes(keywordLower) || 
                   keywordLower.includes(normalizedWord);
          });
          
          if (isTitleMatch) {
            const topicIdToAdd = dnaTopicId || dnaTopic?.topic_id || dnaTopic?.topicId || dnaTopic?.id;
            if (topicIdToAdd && !matches.includes(topicIdToAdd)) {
              matches.push(topicIdToAdd);
              if (isDebugSignal) {
                console.log('✅ DEBUG: DNA match found by substring (long keyword):', keywordLower, '→', topicIdToAdd);
              }
              break;
            }
          }
        }
      }
    }
    
    if (isDebugSignal) {
      console.log(`   Final DNA matches:`, matches.length > 0 ? matches : 'none');
      if (matches.length === 0) {
        console.log(`   ⚠️ No DNA matches found - checked ${dnaTopics.length} topics`);
      }
      console.log(`===== END DEBUG findDnaMatch =====\n`);
    }
  }

  return matches;
}

/**
 * Find days since user last posted about this topic
 * @param {string} signalText - Combined signal title + description for keyword extraction
 * @param {string} signalTopicId - Topic ID from signal (optional)
 * @param {Array} userVideos - User's channel videos to check against
 */
function findDaysSinceLastPost(signalText, signalTopicId, userVideos, excludedNames = []) {
  // DEBUG: Log user videos count first
  console.log('\n🔍 DEBUG findDaysSinceLastPost - START');
  console.log('   User videos count:', userVideos?.length || 0);
  console.log('   User videos is array?', Array.isArray(userVideos));
  
  // Check if user videos have real titles (not "شعار" placeholder)
  if (userVideos && userVideos.length > 0) {
    const placeholderTitles = userVideos.filter(v => 
      v.title === 'شعار' || 
      v.title === 'logo' || 
      !v.title || 
      v.title.trim() === '' ||
      v.title.length < 3
    ).length;
    if (placeholderTitles > 0) {
      console.error(`   ⚠️ WARNING: ${placeholderTitles}/${userVideos.length} videos have placeholder/empty titles`);
      console.error(`   Sample titles:`, userVideos.slice(0, 5).map(v => `"${v.title}"`).join(', '));
      console.error(`   This will prevent matching. Check database column names or data.`);
    }
  }
  
  if (!userVideos || userVideos.length === 0) {
    console.log('   ⚠️ No user videos available - returning 999 (never posted)');
    return { days: 999, evidence: null }; // No videos = never posted
  }

  // DEBUG: Check if this is a Venezuela/oil idea OR Ukraine/Russia idea (check both title and description)
  const isVenezuelaIdea = signalText && (
    signalText.toLowerCase().includes('venezuela') || 
    signalText.toLowerCase().includes('فنزويلا') ||
    signalText.toLowerCase().includes('oil') ||
    signalText.toLowerCase().includes('نفط') ||
    signalText.toLowerCase().includes('tanker') ||
    signalText.toLowerCase().includes('ناقلة') ||
    signalText.toLowerCase().includes('russian-flagged') ||
    signalText.toLowerCase().includes('trump') ||
    signalText.toLowerCase().includes('ترامب')
  );
  
  // DEBUG: Check if this is a Ukraine/Russia idea
  const isUkraineIdea = signalText && (
    signalText.toLowerCase().includes('ukraine') ||
    signalText.toLowerCase().includes('ukrainian') ||
    signalText.toLowerCase().includes('kyiv') ||
    signalText.toLowerCase().includes('kiev') ||
    signalText.toLowerCase().includes('russia') ||
    signalText.toLowerCase().includes('russian') ||
    signalText.toLowerCase().includes('روسيا') ||
    (signalText.toLowerCase().includes('attack') && signalText.toLowerCase().includes('capital'))
  );

  if (isVenezuelaIdea || isUkraineIdea) {
    console.log(`\n🔍 ===== DEBUG findDaysSinceLastPost for ${isUkraineIdea ? 'Ukraine/Russia' : 'Venezuela/Oil'} idea =====`);
    console.log('   Signal text (title + description):', signalText.substring(0, 200));
    console.log('   Signal topic ID:', signalTopicId);
    console.log('   User videos available:', userVideos.length);
    console.log('   Sample user video structure:', {
      hasTitle: !!userVideos[0]?.title,
      hasDescription: !!userVideos[0]?.description,
      hasPublishedAt: !!userVideos[0]?.published_at,
      hasTopicId: !!userVideos[0]?.topic_id,
      sampleTitle: userVideos[0]?.title?.substring(0, 60),
      sampleDescription: userVideos[0]?.description?.substring(0, 60),
    });
  }

  // Extract keywords with bilingual translations (from both title and description)
  const keywords = extractKeywords(signalText);
  
  if (isVenezuelaIdea || isUkraineIdea) {
    console.log('   Extracted signal keywords (with translations):', keywords.slice(0, 30)); // Show first 30
    console.log('   Total signal keywords:', keywords.length);
    
    // Extract topic keywords for validation
    const topicKeywords = extractTopicKeywords(signalText);
    console.log('   Topic keywords (filtered):', topicKeywords);
  }

  // ============================================
  // FILTER: Skip placeholder titles ("شعار")
  // Recent videos (Dec 27) have "شعار", older videos have real titles
  // ============================================
  const validUserVideos = (userVideos || []).filter(v => {
    // Skip placeholder/empty titles
    if (!v.title || v.title.trim() === '' || v.title === 'شعار' || v.title === 'logo' || v.title.length < 3) {
      return false;
    }
    // Must have published_at or publish_date for date calculation
    // (channel_videos uses publish_date, videos table uses published_at - normalization handles this)
    const hasDate = v.published_at || v.publish_date;
    if (!hasDate) {
      return false;
    }
    return true;
  });
  
  const placeholderCount = (userVideos?.length || 0) - validUserVideos.length;
  if (placeholderCount > 0) {
    console.log(`   ⚠️ Filtered out ${placeholderCount} videos with placeholder titles ("شعار" or empty)`);
    console.log(`   Using ${validUserVideos.length} valid videos for matching`);
  }
  
  if (isVenezuelaIdea) {
    console.log(`\n   📹 Checking ${validUserVideos.length} valid videos (filtered from ${userVideos.length} total)`);
    if (placeholderCount > 0) {
      console.log(`   ⚠️ Skipped ${placeholderCount} videos with placeholder titles`);
    }
  }

  let mostRecentDays = 999;
  let matchedVideos = [];
  let matchCount = 0;
  let topicIdMatches = 0;
  let keywordMatches = 0;
  let mostRecentMatch = null; // Store evidence for most recent match

  // Use filtered videos for matching
  for (let i = 0; i < validUserVideos.length; i++) {
    const video = validUserVideos[i];
    
    if ((isVenezuelaIdea || isUkraineIdea) && i < 5) {
      // Log first 5 videos for Venezuela/Ukraine ideas
      console.log(`\n   📹 Video ${i + 1}/${validUserVideos.length}:`);
      console.log(`     Title: "${video.title?.substring(0, 80)}"`);
      console.log(`     Description: "${(video.description || '').substring(0, 100)}"`);
      console.log(`     Published at: ${video.published_at || 'N/A'}`);
      console.log(`     Topic ID: ${video.topic_id || 'N/A'}`);
      console.log(`     Signal Topic ID: ${signalTopicId || 'N/A'}`);
    }

    // Check by topic_id first
    if (signalTopicId && video.topic_id === signalTopicId) {
      // Normalize date field (channel_videos uses publish_date, videos uses published_at - normalization should handle this, but add fallback)
      const videoDate = video.published_at || video.publish_date;
      const daysAgo = calculateDaysAgo(videoDate);
      if (daysAgo < mostRecentDays) {
        mostRecentDays = daysAgo;
        matchedVideos.push({ video: video.title, matchType: 'topic_id', daysAgo });
        matchCount++;
        topicIdMatches++;
        
        // Generate video URL with fallbacks
        const topicIdVideoUrl = video.youtube_url || (video.video_id ? `https://www.youtube.com/watch?v=${video.video_id}` : null) || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : null);
        
        // Store evidence for most recent match
        mostRecentMatch = {
          videoTitle: video.title,
          videoUrl: topicIdVideoUrl,
          matchedKeywords: ['topic_id_match'],
          daysAgo: daysAgo,
          matchType: 'topic_id',
        };
      }
      if (isVenezuelaIdea || isUkraineIdea) {
        console.log(`     ✅ MATCH by topic_id: "${video.title?.substring(0, 60)}..." - ${daysAgo} days ago`);
      }
      continue; // If matched by topic_id, skip title matching (already matched)
    }

    // Check by title + description matching (with Arabic normalization and bilingual keywords)
    // FIX: Require title match OR 2+ topic keywords (not just any keywords from description)
    // Extract keywords from title ONLY first (stronger signal)
    const titleKeywords = extractKeywords(video.title || '');
    const descKeywords = extractKeywords((video.description || '').substring(0, 200));
    
    // Extract topic keywords from signal (filtered, topic-relevant)
    const signalTopicKeywords = extractTopicKeywords(signalText);
    
    if ((isVenezuelaIdea || isUkraineIdea) && i < 5) {
      console.log(`     Title keywords (${titleKeywords.length}):`, titleKeywords.slice(0, 10));
      console.log(`     Description keywords (${descKeywords.length}):`, descKeywords.slice(0, 10));
      console.log(`     Signal topic keywords:`, signalTopicKeywords);
    }
    
    // Check for title match first (stronger signal)
    const titleMatchingKeywords = keywords.filter(kw => {
      const normalizedKw = normalizeArabicText(kw).toLowerCase();
      return titleKeywords.some(vk => {
        const normalizedVk = normalizeArabicText(vk).toLowerCase();
        return normalizedVk.includes(normalizedKw) || normalizedKw.includes(normalizedVk);
      }) && normalizedKw.length > 1;
    });
    
    // Check for topic keyword matches in title (topic-relevant)
    const titleTopicMatches = signalTopicKeywords.filter(topicKw => {
      const normalizedTopic = normalizeArabicText(topicKw).toLowerCase();
      return titleKeywords.some(vk => {
        const normalizedVk = normalizeArabicText(vk).toLowerCase();
        return normalizedVk.includes(normalizedTopic) || normalizedTopic.includes(normalizedVk);
      });
    });
    
    // Check for topic keyword matches in description (weaker, but acceptable if 2+)
    const descTopicMatches = signalTopicKeywords.filter(topicKw => {
      const normalizedTopic = normalizeArabicText(topicKw).toLowerCase();
      return descKeywords.some(vk => {
        const normalizedVk = normalizeArabicText(vk).toLowerCase();
        return normalizedVk.includes(normalizedTopic) || normalizedTopic.includes(normalizedVk);
      });
    });
    
    // Combined keyword matches (for evidence) - also with context-aware matching
    const allVideoKeywords = [...new Set([...titleKeywords, ...descKeywords])];
    const allVideoText = `${video.title || ''} ${video.description || ''}`;
    const matchingKeywords = keywords.filter(kw => {
      // ISSUE 2 FIX: Check if this keyword requires context-aware matching
      const contextCheck = requiresContextAwareMatching(kw, allVideoText);
      if (contextCheck.requiresContext && !contextCheck.shouldMatch) {
        // Skip this keyword - it's ambiguous without proper context
        return false;
      }
      
      const normalizedKw = normalizeArabicText(kw).toLowerCase();
      const hasMatch = allVideoKeywords.some(vk => {
        const normalizedVk = normalizeArabicText(vk).toLowerCase();
        return normalizedVk.includes(normalizedKw) || normalizedKw.includes(normalizedVk);
      });
      
      // If context is required, verify the context exists
      if (contextCheck.requiresContext && contextCheck.shouldMatch) {
        const videoTextLower = normalizeArabicText(allVideoText).toLowerCase();
        if (contextCheck.context === 'fed') {
          const fedContextWords = ['reserve', 'bank', 'monetary', 'policy', 'interest', 'rate', 'economy', 'اقتصاد'];
          const hasFedContext = fedContextWords.some(ctx => videoTextLower.includes(ctx));
          return hasMatch && hasFedContext;
        } else if (contextCheck.context === 'forces') {
          const forcesContextWords = ['forces', 'force', 'military', 'syria', 'سوريا', 'قوات', 'عسكري'];
          const hasForcesContext = forcesContextWords.some(ctx => videoTextLower.includes(ctx));
          return hasMatch && hasForcesContext;
        }
      }
      
      return hasMatch && normalizedKw.length > 1;
    });

    // Use keyword weighting system for matching (with excluded names)
    // Require title match with valid score OR topic match with valid score
    const titleMatchResult = calculateMatchScore(titleMatchingKeywords, excludedNames);
    const titleTopicMatchResult = calculateMatchScore(titleTopicMatches, excludedNames);
    const descTopicMatchResult = calculateMatchScore(descTopicMatches, excludedNames);
    // For topic match, combine title and desc topic matches
    const allTopicKeywords = [...titleTopicMatches, ...descTopicMatches];
    const topicMatchResult = calculateMatchScore(allTopicKeywords, excludedNames);
    
    const hasTitleMatch = titleMatchResult.isValidMatch; // Valid weighted match in title
    const hasTopicMatch = topicMatchResult.isValidMatch; // Valid weighted match in topics (title or desc)
    const hasMatch = hasTitleMatch || hasTopicMatch;

    if ((isVenezuelaIdea || isUkraineIdea) && i < 5) {
      // Normalize date field (channel_videos uses publish_date, videos uses published_at)
      const videoDate = video.published_at || video.publish_date;
      const daysAgo = calculateDaysAgo(videoDate);
      console.log(`     Signal keywords (sample):`, keywords.slice(0, 10));
      console.log(`     Signal topic keywords:`, signalTopicKeywords);
      console.log(`     Title matching keywords:`, titleMatchingKeywords);
      console.log(`     Title topic matches:`, titleTopicMatches);
      console.log(`     Description topic matches:`, descTopicMatches);
      console.log(`     All matching keywords:`, matchingKeywords);
      console.log(`     🎯 Title match analysis:`, {
        rawKeywords: titleMatchingKeywords.length,
        concepts: titleMatchResult.concepts,
        score: titleMatchResult.score,
        isValid: titleMatchResult.isValidMatch,
        debug: titleMatchResult.debug
      });
      console.log(`     🎯 Topic match analysis:`, {
        rawKeywords: allTopicKeywords.length,
        concepts: topicMatchResult.concepts,
        score: topicMatchResult.score,
        isValid: topicMatchResult.isValidMatch,
        debug: topicMatchResult.debug
      });
      console.log(`     Match result: ${hasMatch ? '✅ YES' : '❌ NO'} (${hasTitleMatch ? 'title match' : hasTopicMatch ? 'topic match' : 'insufficient score/concepts'})`);
      console.log(`     Days ago: ${daysAgo}`);
    }
    
    // DEBUG: Log for Gold/Dollar ideas specifically
    const isGoldIdea = signalText && (
      signalText.toLowerCase().includes('gold') ||
      signalText.toLowerCase().includes('ذهب') ||
      (signalText.toLowerCase().includes('dollar') && !signalText.toLowerCase().includes('aircraft'))
    );
    if (isGoldIdea && hasMatch && i < 5) {
      console.log(`     ⚠️ GOLD/DOLLAR IDEA MATCH CHECK:`);
      console.log(`       Video title: "${video.title?.substring(0, 80)}"`);
      console.log(`       Video description (first 100): "${(video.description || '').substring(0, 100)}"`);
      console.log(`       Title matches: ${titleMatchingKeywords.join(', ')}`);
      console.log(`       Topic matches: ${[...titleTopicMatches, ...descTopicMatches].join(', ')}`);
      console.log(`       Should this match? ${hasTitleMatch ? 'YES (title)' : hasTopicMatch ? 'YES (topic)' : 'NO'}`);
    }

    if (hasMatch) {
      // Normalize date field (channel_videos uses publish_date, videos uses published_at)
      const videoDate = video.published_at || video.publish_date;
      const daysAgo = calculateDaysAgo(videoDate);
      if (daysAgo < mostRecentDays) {
        mostRecentDays = daysAgo;
        matchedVideos.push({ 
          video: video.title, 
          matchType: 'keywords', 
          daysAgo,
          matchedKeywords: matchingKeywords 
        });
        matchCount++;
        keywordMatches++;
        
        // Store evidence for most recent match
        const videoUrl = video.youtube_url || (video.video_id ? `https://www.youtube.com/watch?v=${video.video_id}` : null) || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : null);
        
        // DEBUG: Log URL generation for Ukraine/Russia ideas
        if (isUkraineIdea) {
          console.log(`     🔗 Video URL generation:`);
          console.log(`       video.youtube_url:`, video.youtube_url || 'null');
          console.log(`       video.video_id:`, video.video_id || 'null');
          console.log(`       video.id:`, video.id || 'null');
          console.log(`       Final videoUrl:`, videoUrl);
        }
        
        // Use clean concepts for evidence (with excluded names)
        const evidenceMatchResult = calculateMatchScore(matchingKeywords, excludedNames);
        mostRecentMatch = {
          videoTitle: video.title,
          videoUrl: videoUrl,
          matchedKeywords: evidenceMatchResult.concepts, // Use clean concepts instead of raw keywords
          matchScore: evidenceMatchResult.score,
          titleMatches: titleMatchResult.concepts, // Clean concepts from title
          topicMatches: topicMatchResult.concepts, // Clean concepts from topics
          matchType: hasTitleMatch ? 'title_keywords' : 'topic_keywords',
          daysAgo: daysAgo,
        };
      }
      if (isVenezuelaIdea) {
        console.log(`     ✅ MATCH by keywords: "${video.title?.substring(0, 60)}..." - ${daysAgo} days ago (matched: ${matchingKeywords.slice(0, 5).join(', ')})`);
      }
    } else if (isVenezuelaIdea && matchingKeywords.length === 1) {
      // Log why it didn't match (only 1 keyword, need 2+)
      console.log(`     ❌ NO MATCH: Only ${matchingKeywords.length} keyword matched ("${matchingKeywords[0]}"), need 2+ keywords`);
    }
  }

  // Log summary for all calls
  console.log('   📊 findDaysSinceLastPost summary:');
  console.log(`     Signal text (first 100 chars): "${signalText?.substring(0, 100)}"`);
  console.log(`     Total user videos available: ${userVideos?.length || 0}`);
  console.log(`     Valid videos (after filtering placeholders): ${validUserVideos.length}`);
  console.log(`     Total matches found: ${matchCount} (${topicIdMatches} by topic_id, ${keywordMatches} by keywords)`);
  console.log(`     Most recent match: ${mostRecentDays === 999 ? '❌ NONE - never posted' : `✅ ${mostRecentDays} days ago`}`);
  
  // If no matches found, log detailed debug info (for all ideas, not just Venezuela)
  if (mostRecentDays === 999 && validUserVideos.length > 0) {
    console.log(`\n   ⚠️ NO MATCHES FOUND - Debugging why:`);
    console.log(`     Signal keywords (${keywords.length} total):`, keywords.slice(0, 15));
    console.log(`     Signal topic ID: ${signalTopicId || 'none'}`);
    console.log(`     Valid user videos checked: ${validUserVideos.length}`);
    console.log(`     User videos topic IDs (unique):`, [...new Set(validUserVideos.filter(v => v.topic_id).map(v => v.topic_id))].slice(0, 5).join(', ') || 'none');
    
    // Show sample video keywords to see why they don't match
    console.log(`     Sample user video keywords (first 3 valid videos):`);
    validUserVideos.slice(0, 3).forEach((v, i) => {
      const titleKws = extractKeywords(v.title || '').slice(0, 10);
      const descKws = extractKeywords((v.description || '').substring(0, 200)).slice(0, 10);
      const videoKws = [...new Set([...titleKws, ...descKws])];
      console.log(`       ${i + 1}. "${v.title?.substring(0, 70)}..."`);
      console.log(`          Video keywords (${videoKws.length}):`, videoKws.slice(0, 10));
      console.log(`          Topic ID: ${v.topic_id || 'none'}`);
      
      // Check for any overlap
      const overlap = keywords.filter(kw => videoKws.some(vk => {
        const nKw = normalizeArabicText(kw).toLowerCase();
        const nVk = normalizeArabicText(vk).toLowerCase();
        return nKw.includes(nVk) || nVk.includes(nKw);
      }));
      console.log(`          Overlapping keywords: ${overlap.length > 0 ? overlap.slice(0, 5).join(', ') : 'NONE'}`);
    });
  }
  
  if (isVenezuelaIdea) {
    console.log(`\n   🔍 Venezuela/Oil Idea - Detailed Results:`);
    console.log(`     Final result: ${mostRecentDays === 999 ? '❌ NO MATCHES - You haven\'t covered this topic' : `✅ ${mostRecentDays} days ago`}`);
    console.log(`     Matched videos: ${matchedVideos.length}`);
    if (matchedVideos.length > 0) {
      console.log('     ✅ Matched videos:');
      matchedVideos.forEach((m, i) => {
        console.log(`       ${i + 1}. "${m.video?.substring(0, 80)}..."`);
        console.log(`          Days ago: ${m.daysAgo}, Match type: ${m.matchType}${m.matchedKeywords ? `, Keywords: ${m.matchedKeywords.slice(0, 5).join(', ')}` : ''}`);
      });
    } else {
      console.log('     ❌ No videos matched - detailed analysis above');
    }
    console.log('===== END findDaysSinceLastPost DEBUG (Venezuela) =====\n');
  }
  
  console.log('🔍 DEBUG findDaysSinceLastPost - END\n');
  
  // Return both days and evidence
  return {
    days: mostRecentDays,
    evidence: mostRecentMatch,
  };
}

/**
 * Normalize Arabic text (remove diacritics, normalize alef/ya variations)
 */
export function normalizeArabicText(text) {
  if (!text || typeof text !== 'string') return text;
  
  return text
    // Remove Arabic diacritics (tashkeel)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize alef variations (أ, إ, آ, ا) to ا
    .replace(/[أإآ]/g, 'ا')
    // Normalize ya variations (ي, ى) to ي
    .replace(/ى/g, 'ي')
    // Normalize ta marbuta (ة) to ه
    .replace(/ة/g, 'ه')
    .trim();
}

/**
 * Bilingual keyword translation map
 */
export const KEYWORD_TRANSLATIONS = {
  'oil': ['oil', 'نفط', 'بترول', 'petroleum', 'crude'],
  'trump': ['trump', 'ترامب', 'ترمب'],
  'china': ['china', 'الصين', 'صين', 'chinese'],
  'venezuela': ['venezuela', 'فنزويلا'],
  'price': ['price', 'سعر', 'أسعار', 'prices'],
  'economy': ['economy', 'اقتصاد', 'الاقتصاد', 'economic'],
  'dollar': ['dollar', 'دولار', 'الدولار'],
  'gold': ['gold', 'ذهب', 'الذهب'],
  'iran': ['iran', 'إيران', 'ايران'],
  'russia': ['russia', 'روسيا'],
  'war': ['war', 'حرب', 'الحرب'],
  'tariff': ['tariff', 'رسوم', 'جمارك', 'tariffs'],
  'sanctions': ['sanctions', 'عقوبات'],
  'inflation': ['inflation', 'تضخم', 'التضخم'],
  // REMOVED: 'fed': ['fed', 'federal', 'فيدرالي', 'الفيدرالي']
  // ISSUE 2 FIX: "federal" is too generic - matches both "Federal Reserve" (Fed) and "Federal forces" (Syria)
  // Instead, use context-aware matching: require "fed" + "reserve"/"bank"/"monetary"/"policy" for Fed
  // Or require "federal" + "forces"/"military" for Syria - handled separately in matching logic
  'bank': ['bank', 'بنك', 'banking', 'مصرف'],
  'stock': ['stock', 'stocks', 'أسهم', 'سهم', 'بورصة'],
  'market': ['market', 'سوق', 'أسواق'],
  'energy': ['energy', 'طاقة', 'الطاقة'],
  'gas': ['gas', 'غاز', 'الغاز'],
  'investment': ['investment', 'استثمار', 'استثمارات']
};

/**
 * Get root concept for a keyword (handles translations)
 * Example: "الصين" or "صين" or "china" all return "china"
 * Example: "war" or "حرب" both return "war"
 */
function getRootConcept(keyword) {
  if (!keyword || typeof keyword !== 'string') return keyword?.toLowerCase() || '';
  
  const normalizedKw = normalizeArabicText(keyword).toLowerCase();
  
  // Check if this keyword belongs to a translation group
  for (const [root, translations] of Object.entries(KEYWORD_TRANSLATIONS)) {
    // Check if keyword matches the root (case-insensitive)
    if (normalizedKw === root.toLowerCase()) {
      return root.toLowerCase();
    }
    
    // Check if keyword matches any translation (normalized)
    const normalizedTranslations = translations.map(t => normalizeArabicText(t).toLowerCase());
    if (normalizedTranslations.includes(normalizedKw)) {
      return root.toLowerCase();
    }
    
    // Also check if keyword contains root or vice versa (for partial matches)
    // But only if both are >= 3 chars to avoid false matches
    if (normalizedKw.length >= 3 && root.length >= 3) {
      if (normalizedKw.includes(root.toLowerCase()) || root.toLowerCase().includes(normalizedKw)) {
        return root.toLowerCase();
      }
    }
  }
  
  // Return normalized keyword as-is if not in translation map
  return normalizedKw;
}

/**
 * Count unique concept matches (deduplicates translations)
 * Example: ["china", "الصين", "صين"] → 1 concept (china)
 * Example: ["china", "war", "حرب"] → 2 concepts (china, war)
 * Example: ["oil", "نفط", "بترول"] → 1 concept (oil)
 */
function countUniqueConceptMatches(matchedKeywords) {
  if (!matchedKeywords || matchedKeywords.length === 0) return 0;
  
  const concepts = new Set();
  for (const keyword of matchedKeywords) {
    const rootConcept = getRootConcept(keyword);
    if (rootConcept && rootConcept.length >= 2) { // Skip very short "concepts"
      concepts.add(rootConcept);
    }
  }
  
  return concepts.size;
}

/**
 * Check if keyword requires context-aware matching (e.g., "federal" needs context)
 */
function requiresContextAwareMatching(keyword, text) {
  const kwLower = normalizeArabicText(keyword).toLowerCase();
  const textLower = normalizeArabicText(text).toLowerCase();
  
  // ISSUE 2 FIX: "federal"/"fed"/"فيدرالي" requires context
  if (kwLower === 'fed' || kwLower === 'federal' || kwLower === 'فيدرالي' || kwLower === 'الفيدرالي') {
    // For Federal Reserve (Fed monetary policy), require context words:
    const fedContextWords = ['reserve', 'bank', 'monetary', 'policy', 'interest', 'rate', 'economy', 'economy', 'اقتصاد'];
    const hasFedContext = fedContextWords.some(ctx => textLower.includes(ctx));
    
    // For Federal forces (Syria), require context words:
    const forcesContextWords = ['forces', 'force', 'military', 'syria', 'سوريا', 'قوات', 'عسكري'];
    const hasForcesContext = forcesContextWords.some(ctx => textLower.includes(ctx));
    
    // If neither context is present, don't match (too ambiguous)
    if (!hasFedContext && !hasForcesContext) {
      return { requiresContext: true, shouldMatch: false, reason: 'federal_without_context' };
    }
    
    // If both contexts are present, prioritize Fed context (more common in economic news)
    if (hasFedContext) {
      return { requiresContext: true, shouldMatch: true, context: 'fed' };
    }
    
    // Only match if Forces context is present (Syria context)
    return { requiresContext: true, shouldMatch: hasForcesContext, context: 'forces' };
  }
  
  return { requiresContext: false, shouldMatch: true };
}

/**
 * Expand keywords with translations
 */
export function expandKeywordsWithTranslations(keywords) {
  const expanded = new Set();
  
  for (const keyword of keywords) {
    // Add original keyword
    expanded.add(keyword);
    
    // Check if keyword (or its normalized version) matches any translation key
    const normalizedKey = normalizeArabicText(keyword).toLowerCase();
    
    for (const [key, translations] of Object.entries(KEYWORD_TRANSLATIONS)) {
      // Check if keyword matches the key or any translation
      if (normalizedKey.includes(key.toLowerCase()) || 
          key.toLowerCase().includes(normalizedKey) ||
          translations.some(t => normalizedKey.includes(normalizeArabicText(t).toLowerCase()))) {
        // Add all translations
        translations.forEach(t => expanded.add(t));
        expanded.add(key);
      }
    }
  }
  
  return Array.from(expanded);
}

/**
 * Extract keywords from text (with bilingual support and Arabic normalization)
 * Also removes channel name hashtags and common source names
 */
export function extractKeywords(text) {
  if (!text) return [];
  
  // Remove channel name hashtags before extracting keywords
  // Common Arabic news channel hashtags
  let cleanedText = text
    .replace(/#العربية/g, '')
    .replace(/#الجزيرة/g, '')
    .replace(/#المخبر/g, '')
    .replace(/#المخبر_الاقتصادي/g, '')
    .replace(/#الشرق/g, '')
    .replace(/#العربي/g, '')
    .replace(/#الميادين/g, '')
    .replace(/#الحرة/g, '')
    .replace(/#المشهد/g, '')
    .replace(/#سكاي_نيوز/g, '')
    .replace(/#روسيا_اليوم/g, '')
    .replace(/#فرانس_24/g, '')
    // English news source hashtags
    .replace(/#bbc/gi, '')
    .replace(/#cnn/gi, '')
    .replace(/#reuters/gi, '')
    .replace(/#bloomberg/gi, '')
    .replace(/#wsj/gi, '')
    .replace(/#ft/gi, '')
    .replace(/#nyt/gi, '')
    .replace(/#cnbc/gi, '')
    .replace(/#rt/gi, '');
  
  // Normalize Arabic text first
  const normalizedText = normalizeArabicText(cleanedText);
  
  // Remove common stop words and extract meaningful words
  // Expanded list to filter out generic words that cause false matches
  const stopWords = new Set([
    // English common words
    'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
    'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when', 'where',
    'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'just', 'now', 'also', 'then', 'once', 'here',
    'there', 'where', 'when', 'about', 'after', 'before', 'above', 'below',
    'between', 'under', 'again', 'further',
    // Time-related common words
    'week', 'weeks', 'day', 'days', 'month', 'months', 'year', 'years',
    'today', 'yesterday', 'tomorrow', 'ago', 'later', 'soon', 'now',
    // Common verbs/actions (less topic-specific)
    'says', 'said', 'saying', 'tell', 'told', 'tells', 'go', 'goes', 'went',
    'come', 'comes', 'came', 'get', 'gets', 'got', 'give', 'gives', 'gave',
    'take', 'takes', 'took', 'make', 'makes', 'made', 'see', 'sees', 'saw',
    'know', 'knows', 'knew', 'think', 'thinks', 'thought', 'want', 'wants',
    'look', 'looks', 'seem', 'seems', 'try', 'tries', 'tried', 'use', 'uses',
    'find', 'finds', 'found', 'work', 'works', 'worked', 'call', 'calls',
    'ask', 'asks', 'asked', 'show', 'shows', 'showed', 'move', 'moves', 'moved',
    'play', 'plays', 'played', 'live', 'lives', 'lived', 'believe', 'believes',
    'hold', 'holds', 'held', 'bring', 'brings', 'brought', 'happen', 'happens',
    'write', 'writes', 'wrote', 'sit', 'sits', 'sat', 'stand', 'stands', 'stood',
    'lose', 'loses', 'lost', 'pay', 'pays', 'paid', 'meet', 'meets', 'met',
    'include', 'includes', 'included', 'continue', 'continues', 'continued',
    'set', 'sets', 'change', 'changes', 'changed', 'lead', 'leads', 'led',
    'understand', 'understands', 'understood', 'watch', 'watches', 'watched',
    'follow', 'follows', 'followed', 'stop', 'stops', 'stopped', 'create',
    'creates', 'created', 'speak', 'speaks', 'spoke', 'read', 'reads', 'read',
    'allow', 'allows', 'allowed', 'add', 'adds', 'added', 'spend', 'spends',
    'spent', 'grow', 'grows', 'grew', 'open', 'opens', 'opened', 'walk',
    'walks', 'walked', 'win', 'wins', 'won', 'teach', 'teaches', 'taught',
    'offer', 'offers', 'offered', 'remember', 'remembers', 'remembered',
    'consider', 'considers', 'considered', 'appear', 'appears', 'appeared',
    'buy', 'buys', 'bought', 'serve', 'serves', 'served', 'die', 'dies', 'died',
    'send', 'sends', 'sent', 'build', 'builds', 'built', 'stay', 'stays', 'stayed',
    'fall', 'falls', 'fell', 'cut', 'cuts', 'cut', 'reach', 'reaches', 'reached',
    'kill', 'kills', 'killed', 'raise', 'raises', 'raised', 'pass', 'passes', 'passed',
    'sell', 'sells', 'sold', 'decide', 'decides', 'decided', 'return', 'returns',
    'returned', 'explain', 'explains', 'explained', 'develop', 'develops', 'developed',
    'carry', 'carries', 'carried', 'break', 'breaks', 'broke', 'receive', 'receives',
    'received', 'agree', 'agrees', 'agreed', 'support', 'supports', 'supported',
    'hit', 'hits', 'produce', 'produces', 'produced', 'eat', 'eats', 'ate',
    'cover', 'covers', 'covered', 'catch', 'catches', 'caught', 'draw', 'draws',
    'drew', 'choose', 'chooses', 'chose', 'wear', 'wears', 'wore', 'fight',
    'fights', 'fought', 'throw', 'throws', 'threw', 'accept', 'accepts', 'accepted',
    'expect', 'expects', 'expected', 'protect', 'protects', 'protected',
    'provide', 'provides', 'provided', 'report', 'reports', 'reported',
    'announce', 'announces', 'announced', 'unveil', 'unveils', 'unveiled',
    'reveal', 'reveals', 'revealed', 'declare', 'declares', 'declared',
    // Common adjectives (less topic-specific)
    'new', 'first', 'last', 'long', 'great', 'little', 'old', 'right', 'big',
    'high', 'different', 'small', 'large', 'next', 'early', 'young', 'important',
    'public', 'bad', 'same', 'able', 'human', 'local', 'late', 'hard', 'major',
    'better', 'economic', 'strong', 'possible', 'whole', 'free', 'military',
    'true', 'federal', 'international', 'full', 'special', 'easy', 'clear',
    'recent', 'certain', 'personal', 'open', 'red', 'difficult', 'available',
    'likely', 'national', 'political', 'real', 'best', 'right', 'social',
    'only', 'sure', 'low', 'early', 'large', 'important', 'public', 'bad',
    'same', 'able', 'small', 'human', 'local', 'late', 'hard', 'major',
    'better', 'economic', 'strong', 'possible', 'whole', 'free', 'military',
    'true', 'federal', 'international', 'full', 'special', 'easy', 'clear',
    'recent', 'certain', 'personal', 'open', 'red', 'difficult', 'available',
    // Numbers and quantifiers (less topic-specific)
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'hundred', 'thousand', 'million', 'billion', 'many', 'much',
    // Generic news/media words (not topic-specific)
    'worldnews', 'comments', 'news', 'article', 'post', 'thread', 'reddit',
    'subreddit', 'r/', 'submission', 'comment', 'discussion', 'thread',
    // Arabic news/media words (not topic-specific)
    'رسميا', 'رسمي', 'عاجل', 'خبر', 'أخبار', 'خبرا', 'أخبارا',
    'تقرير', 'تقريرا', 'بيان', 'بيانا', 'تصريح', 'تصريحا',
    // Arabic stop words (normalized)
    'في', 'من', 'إلى', 'على', 'و', 'أن', 'هذا', 'هذه', 'التي', 'الذي',
    'ما', 'كيف', 'لماذا', 'هل', 'عن', 'مع', 'بعد', 'قبل', 'كل', 'بين',
    'الجديد', 'جديدة', 'جديد', 'نحو', 'عند', 'حول', 'حتى', 'خلال', 'أثناء',
    'أو', 'ثم', 'لكن', 'إذا', 'لأن', 'حيث', 'ماذا', 'متى', 'أين',
    'بعض', 'أي', 'غير', 'فقط', 'أكثر', 'أقل', 'جدا', 'أيضا', 'الآن',
    'اليوم', 'أمس', 'غدا', 'أسبوع', 'شهر', 'سنة', 'عام', 'كان', 'كانت',
    'يكون', 'تكون', 'يكون', 'تكون', 'قال', 'قالت', 'يقول', 'تقول',
    'ذهب', 'ذهبت', 'يذهب', 'تذهب', 'جاء', 'جاءت', 'يأتي', 'تأتي',
    'أعطى', 'أعطت', 'يعطي', 'تعطي', 'أخذ', 'أخذت', 'يأخذ', 'تأخذ'
  ]);

  // Extract base keywords
  const baseKeywords = normalizedText
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ') // Keep Arabic and English letters
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Prioritize topic-specific keywords (nouns, named entities) over verbs/adjectives
  // This helps avoid false matches on generic words
  const prioritizedKeywords = prioritizeTopicKeywords(baseKeywords);
  
  // Expand with translations
  const expandedKeywords = expandKeywordsWithTranslations(prioritizedKeywords);
  
  return expandedKeywords;
}

/**
 * Prioritize topic-specific keywords (nouns, named entities) over verbs/adjectives
 * This helps avoid false matches on generic action words
 */
function prioritizeTopicKeywords(keywords) {
  // Common verb endings that indicate less topic-specific words
  const verbEndings = ['ing', 'ed', 'es', 's', 'er', 'est', 'ly'];
  
  // Prioritize: Named entities (capitalized), longer words (more specific), non-verb forms
  return keywords.sort((a, b) => {
    // Prefer longer words (more specific)
    if (b.length !== a.length) return b.length - a.length;
    
    // Prefer words that don't end with verb endings
    const aIsVerb = verbEndings.some(ending => a.endsWith(ending));
    const bIsVerb = verbEndings.some(ending => b.endsWith(ending));
    if (aIsVerb && !bIsVerb) return 1;
    if (!aIsVerb && bIsVerb) return -1;
    
    return 0;
  });
}

/**
 * Extract topic-specific keywords from signal title
 * These are the most important keywords that should match for relevance
 */
function extractTopicKeywords(title) {
  if (!title) return [];
  
  // Additional stop words for topic extraction (filter out generic words)
  const topicStopWords = new Set([
    'worldnews', 'comments', 'news', 'article', 'post', 'thread', 'reddit',
    'subreddit', 'r/', 'submission', 'comment', 'discussion',
    'رسميا', 'رسمي', 'عاجل', 'خبر', 'أخبار', 'خبرا', 'أخبارا',
    'تقرير', 'تقريرا', 'بيان', 'بيانا', 'تصريح', 'تصريحا'
  ]);
  
  // Extract keywords and prioritize named entities and topic nouns
  const keywords = extractKeywords(title);
  
  // Filter to prioritize topic-relevant keywords:
  // - Named entities (capitalized words)
  // - Longer words (more specific)
  // - Non-verb forms
  // - NOT generic news/media words
  const topicKeywords = keywords.filter(kw => {
    // Skip very short words
    if (kw.length < 3) return false;
    
    // Skip generic news/media words
    const normalizedKw = normalizeArabicText(kw).toLowerCase();
    if (topicStopWords.has(normalizedKw)) return false;
    
    // Prioritize capitalized words (likely named entities like "OpenAI", "ChatGPT", "Venezuela", "Ukraine", "Russia")
    if (/^[A-Z]/.test(kw)) return true;
    
    // Prioritize longer words (more specific, e.g., "chatgpt", "venezuela", "ukrainian" vs "about")
    if (kw.length >= 6) return true;
    
    // Skip common verb endings (less topic-specific)
    const verbEndings = ['ing', 'ed', 'es', 'ly'];
    if (verbEndings.some(ending => kw.endsWith(ending))) return false;
    
    return true;
  });
  
  return topicKeywords.slice(0, 10); // Top 10 topic keywords
}

/**
 * Validate evidence to ensure matched keywords are topic-relevant
 * Returns null if evidence is not valid (too generic), otherwise returns validated evidence
 */
function validateEvidence(signalTitle, evidence, topicKeywords = null) {
  if (!evidence || !evidence.matchedKeywords || evidence.matchedKeywords.length === 0) {
    return null;
  }
  
  // Require minimum 2 unique CONCEPT matches (deduplicates translations)
  // This ensures that "china, الصين, صين" counts as 1 concept, not 3 keywords
  const uniqueConcepts = countUniqueConceptMatches(evidence.matchedKeywords);
  if (uniqueConcepts < 2) {
    return null; // Not enough unique concepts matched
  }
  
  // Extract topic keywords if not provided
  if (!topicKeywords) {
    topicKeywords = extractTopicKeywords(signalTitle);
  }
  
  // If no topic keywords found, still require minimum 2 keyword matches
  if (!topicKeywords || topicKeywords.length === 0) {
    // Fallback: At least require 2 keyword matches (already validated above)
    // IMPORTANT: Preserve all original evidence fields including hoursAgo
    return { ...evidence };
  }
  
  // Check if at least 1 topic keyword appears in matched keywords
  // This ensures the match is topic-relevant, not just on generic words
  const topicKeywordMatches = evidence.matchedKeywords.filter(matchedKw => {
    const normalizedMatched = normalizeArabicText(matchedKw).toLowerCase();
    return topicKeywords.some(topicKw => {
      const normalizedTopic = normalizeArabicText(topicKw).toLowerCase();
      return normalizedMatched.includes(normalizedTopic) || normalizedTopic.includes(normalizedMatched);
    });
  });
  
  // Require at least 2 TOPIC keyword matches AND minimum 2 total keyword matches
  // This prevents matches only on generic words like "worldnews", "comments", "رسميا"
  // Example: "Ukrainian capital Kyiv" should match "russia", "ukraine", "kyiv" (topic keywords)
  // NOT: "worldnews", "comments" (generic words)
  if (topicKeywordMatches.length < 2) {
    return null; // Evidence not topic-relevant enough - need 2+ topic keywords matched
  }
  
  // Return validated evidence with topic keyword matches highlighted
  return {
    ...evidence,
    topicKeywordMatches: topicKeywordMatches.slice(0, 5), // Store which topic keywords matched
  };
}

/**
 * Calculate hours ago from timestamp
 */
function calculateHoursAgo(timestamp) {
  if (!timestamp) return 999;
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 999;
  const now = new Date();
  return (now - date) / (1000 * 60 * 60);
}

/**
 * Calculate days ago from timestamp
 */
function calculateDaysAgo(timestamp) {
  if (!timestamp) return 999;
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 999;
  const now = new Date();
  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}
