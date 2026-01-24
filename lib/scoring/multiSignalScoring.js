/**
 * MULTI-SIGNAL SCORING SYSTEM
 * Requires at least 2 signals to show an idea
 * Maximum score: 100
 */

// ===========================================
// COMPETITOR SCORING CONFIGURATION
// ===========================================

// Score points by competitor type
export const COMPETITOR_SCORE_WEIGHTS = {
  direct_breakout: 35,      // Direct competitor with breakout video
  direct_volume: 25,        // Multiple direct competitors (2+)
  trendsetter_breakout: 20, // Trendsetter with breakout video
  trendsetter_volume: 8,    // Multiple trendsetters (2+)
  indirect_breakout: 10,    // Indirect competitor with breakout video
  indirect_volume: 8,       // Multiple indirect competitors (2+)
};
import { calculateSemanticSimilarity, classifySimilarity, SIMILARITY_THRESHOLDS } from './competitorEmbeddings.js';
// Breakout multiplier thresholds by competitor type
export const BREAKOUT_THRESHOLDS = {
  direct: 1.3,      // Show direct competitors at 1.3x+ (lower bar - same audience)
  indirect: 1.5,    // Show indirect at 1.5x+ (standard breakout)
  trendsetter: 5.0, // Show trendsetters at 5x+ (they post daily, need real trends)
};

// Labels for UI display
export const COMPETITOR_TYPE_LABELS = {
  direct: { icon: '🔥', label: 'Direct Competitor', color: 'red' },
  indirect: { icon: '📈', label: 'Indirect Competitor', color: 'blue' },
  trendsetter: { icon: '⚡', label: 'Trendsetter', color: 'orange' },
};

// ===========================================
// TIME SENSITIVITY CONFIGURATION
// ===========================================

// Time decay multipliers - how much to multiply the competitor score based on video age
export const TIME_DECAY_MULTIPLIERS = {
  under_6h: 1.5,    // Very fresh - boost score by 50%
  under_24h: 1.25,  // Fresh - boost score by 25%
  under_48h: 1.0,   // Recent - no change
  under_72h: 0.75,  // Getting old - reduce by 25%
  under_7d: 0.5,    // Old - reduce by 50%
  over_7d: 0.25,    // Very old - reduce by 75%
};

// ===========================================
// SOURCE QUALITY CONFIGURATION
// ===========================================

// Premium source allowlist (reused from pitches route)
const SOURCE_QUALITY_PREMIUM = [
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
];

/**
 * Check if signal source is premium (tier-1)
 */
function isPremiumSource(idea) {
  const source = (idea.source || idea.source_name || '').toLowerCase().trim();
  const url = (idea.url || idea.source_url || '').toLowerCase();
  
  // Check premium allowlist
  for (const premium of SOURCE_QUALITY_PREMIUM) {
    if (source.includes(premium.toLowerCase()) || url.includes(premium.toLowerCase())) {
      return true;
    }
  }
  
  // Special cases
  if (source.startsWith('gn:')) return true; // Google News
  if (url.includes('.gov')) return true; // Government sources
  
  return false;
}

// Get time multiplier based on hours ago
function getTimeMultiplier(hoursAgo) {
  if (hoursAgo < 6) return TIME_DECAY_MULTIPLIERS.under_6h;      // 1.5x
  if (hoursAgo < 24) return TIME_DECAY_MULTIPLIERS.under_24h;    // 1.25x
  if (hoursAgo < 48) return TIME_DECAY_MULTIPLIERS.under_48h;    // 1.0x
  if (hoursAgo < 72) return TIME_DECAY_MULTIPLIERS.under_72h;    // 0.75x
  if (hoursAgo < 168) return TIME_DECAY_MULTIPLIERS.under_7d;    // 0.5x (168h = 7 days)
  return TIME_DECAY_MULTIPLIERS.over_7d;                          // 0.25x
}

/**
 * Calculate staleness decay multiplier based on signal age
 * Signals lose priority the longer they exist without being acted on
 * @param {Date|string} createdAt - Signal creation timestamp
 * @returns {number} - Decay multiplier (1.0 = no decay, 0.5 = 50% penalty)
 */
function calculateStalenessDecay(createdAt) {
  if (!createdAt) return 1.0;
  
  const now = new Date();
  const created = new Date(createdAt);
  const hoursOld = (now - created) / (1000 * 60 * 60);
  const daysOld = hoursOld / 24;
  
  // Staleness decay schedule:
  // Day 0-1: No decay (1.0)
  // Day 2: 5% decay (0.95)
  // Day 3: 15% decay (0.85)
  // Day 4: 30% decay (0.70)
  // Day 5+: 50% decay (0.50) - floor
  
  if (daysOld <= 1) return 1.0;
  if (daysOld <= 2) return 0.95;
  if (daysOld <= 3) return 0.85;
  if (daysOld <= 4) return 0.70;
  return 0.50; // Floor - never decay more than 50%
}

// Format time ago for display
function formatTimeAgo(hoursAgo) {
  if (hoursAgo < 1) return 'just now';
  if (hoursAgo < 24) return `${Math.floor(hoursAgo)}h ago`;
  return `${Math.floor(hoursAgo / 24)}d ago`;
}

// Get competitor icon by type
function getCompetitorIcon(type) {
    return COMPETITOR_TYPE_LABELS[type]?.icon || '📊';
  }
  
  /**
   * Calculate median of an array of numbers
   * More robust than average for detecting true breakouts (ignores outliers)
   */
  function calculateMedian(values) {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

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
    wikipediaTrendKeywords = new Set(), // Wikipedia trends for score boost
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
  // Add debug logging for competitor video structure
  if (competitorVideos && competitorVideos.length > 0 && process.env.NODE_ENV === 'development') {
    const sample = competitorVideos[0];
    console.log('📊 [DEBUG] Competitor video fields available:', Object.keys(sample).slice(0, 15));
    console.log('📊 [DEBUG] Sample channel_name:', sample.channel_name || sample.channelName || 'NOT FOUND');
    console.log('📊 [DEBUG] Sample competitor_type:', sample.competitor_type || sample.competitorType || 'NOT FOUND');
  }
  
  const competitorBreakout = await findCompetitorBreakout(normalizedTitle, competitorVideos, excludedNames, signalPublishedAt);
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
        // Direct competitor breakout - HIGHEST PRIORITY (same core audience)
        const hoursAgo = competitorBreakout.hoursAgo || 0;
        const baseScore = COMPETITOR_SCORE_WEIGHTS.direct_breakout; // 35
        const timeMultiplier = getTimeMultiplier(hoursAgo);
        const finalScore = Math.round(baseScore * timeMultiplier);
        
        score += finalScore;
        signals.push({
          type: 'competitor_breakout_direct',
          icon: '🔥',
          text: `Direct competitor: ${competitorBreakout.channelName} got ${competitorBreakout.multiplier.toFixed(1)}x their average (${formatTimeAgo(hoursAgo)})`,
          subtext: 'Your core audience is watching this!',
          weight: timeMultiplier >= 1.0 ? 'critical' : 'high',
          priority: 1,
          data: {
            ...competitorBreakout,
            hoursAgo,
            timeMultiplier,
            baseScore,
            finalScore,
          },
          evidence: breakoutEvidence,
        });
      } else if (competitorBreakout.type === 'trendsetter') {
        // Trendsetter signal - MEDIUM PRIORITY (shows trends)
        const hoursAgo = competitorBreakout.hoursAgo || 0;
        const baseScore = COMPETITOR_SCORE_WEIGHTS.trendsetter_breakout; // 20
        const timeMultiplier = getTimeMultiplier(hoursAgo);
        const finalScore = Math.round(baseScore * timeMultiplier);
        
        // Add "major trend" label if multiplier is high
        const isMajorTrend = competitorBreakout.multiplier >= 5.0;
        const trendLabel = isMajorTrend ? ' (major trend)' : '';
        
        score += finalScore;
        signals.push({
          type: 'competitor_breakout_trendsetter',
          icon: '⚡',
          text: `Trendsetter breakout: ${competitorBreakout.channelName} got ${competitorBreakout.multiplier.toFixed(1)}x their average${trendLabel} (${formatTimeAgo(hoursAgo)})`,
          subtext: 'Trend forming - get ahead of the wave!',
          weight: timeMultiplier >= 1.0 ? 'high' : 'medium',
          priority: 2,
          data: {
            ...competitorBreakout,
            hoursAgo,
            timeMultiplier,
            baseScore,
            finalScore,
          },
          evidence: breakoutEvidence,
        });
      } else {
        // Indirect competitor breakout - LOWER PRIORITY (audience interest signal)
        // Scale bonus by multiplier: 2x = +10, 5x = +20, 10x = +30
        const hoursAgo = competitorBreakout.hoursAgo || 0;
        const multiplier = competitorBreakout.multiplier || 1.0;
        const baseScore = Math.min(30, Math.round(multiplier * 4)); // Scale by multiplier
        const timeMultiplier = getTimeMultiplier(hoursAgo);
        const finalScore = Math.round(baseScore * timeMultiplier);
        
        score += finalScore;
        
        if (multiplier >= 5.0) {
          console.log(`   📈 Indirect breakout bonus: +${finalScore} (${multiplier.toFixed(1)}x multiplier)`);
        }
        
        signals.push({
          type: 'competitor_breakout_indirect',
          icon: '📈',
          text: `Indirect breakout: ${competitorBreakout.channelName} got ${multiplier.toFixed(1)}x their average (${formatTimeAgo(hoursAgo)})`,
          subtext: 'Popular outside your niche',
          weight: timeMultiplier >= 1.0 ? 'medium' : 'low',
          priority: 3,
          data: {
            ...competitorBreakout,
            hoursAgo,
            timeMultiplier,
            baseScore,
            finalScore,
            multiplier,
          },
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
      videoId: detail.videoId || detail.video_id || null,
      videoUrl: detail.videoUrl,
      matchedKeywords: detail.matchedKeywords || [],
    };
  });

  // ============================================
  // SIGNAL 2: Multiple Trendsetters (bonus signal)
  // ============================================
  if (trendsetterCount >= 2 && competitorBreakout?.type !== 'trendsetter') {
    score += COMPETITOR_SCORE_WEIGHTS.trendsetter_volume; // 15
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
  // SIGNAL 3: Multiple Competitors Posted (up to 25 points)
  // ============================================
  if (totalCount >= 2) {
    if (directCount >= 2) {
      // Multiple direct competitors - highest weight
      score += COMPETITOR_SCORE_WEIGHTS.direct_volume; // 25
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
      score += COMPETITOR_SCORE_WEIGHTS.trendsetter_volume; // 15
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
      // Only indirect competitors - LOWER WEIGHT
      score += COMPETITOR_SCORE_WEIGHTS.indirect_volume; // 8
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
  // Use HYBRID AI matching for stricter, more accurate results
  // This uses keywords first, then AI validation for edge cases
  const aiFingerprint = context?.aiFingerprint || null;
  
  let dnaMatch = [];
  try {
    // Import hybrid matching function
    const { findDnaMatchHybrid } = await import('@/lib/scoring/dnaMatching.js');
    const hybridResult = await findDnaMatchHybrid(signalTopicId, normalizedTitle, dnaTopics, aiFingerprint);
    
    if (hybridResult.matches && hybridResult.matches.length > 0) {
      dnaMatch = hybridResult.matches;
      console.log(`   🧬 DNA match (${hybridResult.source}): ${dnaMatch.join(', ')} - ${hybridResult.reason || 'Matched'}`);
    } else {
      console.log(`   ⚠️ No DNA match: ${hybridResult.reason || 'Not relevant'}`);
    }
  } catch (hybridError) {
    console.warn(`   ⚠️ Hybrid DNA matching failed, falling back to keyword matching:`, hybridError.message);
    // Fallback to keyword-based matching if hybrid fails
    const dnaMatchRaw = findDnaMatch(signalTopicId, normalizedTitle, dnaTopics, aiFingerprint);
    const signalFullText = `${idea.title || ''} ${idea.description || ''}`;
    dnaMatch = filterByContextGate(dnaMatchRaw, signalFullText, dnaTopics);
    
    // Limit to top 2 matches even in fallback (to prevent excessive matches)
    if (dnaMatch.length > 2) {
      console.log(`   ⚠️ Limiting DNA matches from ${dnaMatch.length} to 2 (top matches)`);
      dnaMatch = dnaMatch.slice(0, 2);
    }
  }
  
  if (dnaMatch && dnaMatch.length > 0) {
    // Extract matched keywords for evidence
    const signalKeywords = extractKeywords(normalizedTitle);
    // Get keywords and names from matched DNA topics
    const matchedTopicKeywords = [];
    const matchedTopicNames = [];
    dnaMatch.forEach(topicId => {
      if (!topicId) return; // Skip undefined/null topicIds
      const topic = dnaTopics.find(t => {
        if (!t) return false;
        const topicIdMatch = (typeof t === 'object' ? t.topic_id || t.id : t) === topicId;
        const nameMatch = typeof t === 'object' && t.name 
          ? (t.name || '').toLowerCase().includes((topicId || '').toLowerCase())
          : false;
        return topicIdMatch || nameMatch;
      });
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
    
    // Increase DNA match bonus based on number of matched topics
    // Multiple topic matches indicate stronger DNA alignment
    // Base: 12, +3 for each additional match, max 15
    const dnaBonus = Math.min(15, 12 + (dnaMatch.length - 1) * 3);
    score += dnaBonus;
    
    // Use English topic names for display (not IDs)
    const dnaMatchNames = uniqueTopicNames.length > 0 
      ? uniqueTopicNames.slice(0, 3).join(', ') + (uniqueTopicNames.length > 3 ? '...' : '')
      : dnaMatch.slice(0, 3).join(', ') + (dnaMatch.length > 3 ? '...' : '');
    
    // Log DNA bonus for high matches or debug signals
    const isDebugDna = signalTitle && (
      signalTitle.toLowerCase().includes('venezuela') ||
      signalTitle.toLowerCase().includes('china') ||
      signalTitle.toLowerCase().includes('iran') ||
      signalTitle.toLowerCase().includes('oil')
    );
    
    if (isDebugDna || dnaMatch.length >= 2) {
      console.log(`   🧬 DNA bonus: +${dnaBonus} (${dnaMatch.length} topic match${dnaMatch.length > 1 ? 'es' : ''})`);
    }
    
    signals.push({
      type: 'dna_match',
      icon: '✅',
      text: `Matches ${dnaMatch.length} DNA topic(s): ${dnaMatchNames}`,
      weight: dnaMatch.length >= 2 ? 'high' : 'medium',
      data: { 
        topics: dnaMatch, 
        topicNames: uniqueTopicNames,
        dnaBonus: dnaBonus, // Store bonus for score breakdown
        matchCount: dnaMatch.length
      },
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
  // If user posted about this recently, reduce score (gentler penalties)
  // ============================================
  if (daysSinceLastPost < 3 && daysSinceLastPost !== 999) {
    // Heavy penalty only for very recent (< 3 days)
    const penalty = 15;
    score -= penalty;
    signals.push({
      type: 'saturated',
      icon: '⚠️',
      text: `You posted about this ${daysSinceLastPost} days ago`,
      weight: 'negative',
      data: { daysSinceLastPost, penalty },
      evidence: lastPostEvidence ? {
        matchedVideo: lastPostEvidence.videoTitle,
        matchedKeywords: lastPostEvidence.matchedKeywords,
        videoUrl: lastPostEvidence.videoUrl,
        daysAgo: daysSinceLastPost,
        matchType: lastPostEvidence.matchType,
      } : null,
    });
  } else if (daysSinceLastPost < 7 && daysSinceLastPost !== 999) {
    // Light penalty for 3-7 days
    const penalty = 5;
    score -= penalty;
    signals.push({
      type: 'saturated',
      icon: '⚠️',
      text: `You posted about this ${daysSinceLastPost} days ago`,
      weight: 'negative',
      data: { daysSinceLastPost, penalty },
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

  // Apply staleness decay based on signal age
  const stalenessDecay = calculateStalenessDecay(idea.created_at || idea.detected_at);
  const decayedScore = Math.round(score * stalenessDecay);

  if (stalenessDecay < 1.0) {
    const daysOld = Math.round((Date.now() - new Date(idea.created_at || idea.detected_at).getTime()) / (1000 * 60 * 60 * 24));
    console.log(`⏰ [Staleness] Signal "${(idea.title || '').substring(0, 50)}..." decayed: ${score} → ${decayedScore} (${Math.round(stalenessDecay * 100)}%, ${daysOld} days old)`);
    
    // Add staleness info to signals array for UI display
    signals.push({
      type: 'staleness_decay',
      text: `Signal is ${daysOld} days old`,
      impact: Math.round((1 - stalenessDecay) * score) * -1, // Negative impact
      decay: stalenessDecay
    });
  }

  // Use decayedScore for final calculation
  score = decayedScore;

  // Apply DNA multiplier if DNA match exists (reward DNA relevance)
  const dnaSignal = signals.find(s => s.type === 'dna_match');
  if (dnaSignal && dnaSignal.data?.dnaBonus > 0) {
    score = score * 1.15;
    console.log(`   🧬 DNA match detected: applying 1.15x multiplier`);
  }

  // Apply source tier adjustment (Tier A premium sources get bonus)
  let sourceTierAdjustment = 0;
  let sourceTierMultiplier = 1.0;
  
  const source_quality = idea.source_quality || (isPremiumSource(idea) ? 'premium' : 'supported');
  if (source_quality === 'premium') {
    // Tier A Boost: +5 points for premium sources
    sourceTierAdjustment = 5;
    console.log(`   💎 Tier A source detected: +${sourceTierAdjustment} boost`);
  }

  // ============================================
  // WIKIPEDIA TREND SUPPORT
  // Boost score if topic is trending on Wikipedia
  // ============================================
  let wikipediaBoost = 0;
  const matchedWikiKeywords = [];
  
  if (wikipediaTrendKeywords && wikipediaTrendKeywords.size > 0) {
    // Check if signal title contains any Wikipedia trending keywords
    const signalWords = normalizedTitle.split(/[\s\-_:,.'""]+/).filter(w => {
      if (w.length < 3) return false;
      // Filter out pure numbers (years, amounts)
      if (/^\d+$/.test(w)) return false;
      return true;
    });
    
    for (const word of signalWords) {
      if (wikipediaTrendKeywords.has(word)) {
        matchedWikiKeywords.push(word);
      }
    }
    
    // Require 2+ matching keywords for boost (avoid false positives)
    if (matchedWikiKeywords.length >= 2) {
      wikipediaBoost = 10; // +10 points for Wikipedia trend match
      console.log(`   📚 Wikipedia trend match: +${wikipediaBoost} (keywords: ${matchedWikiKeywords.slice(0, 5).join(', ')})`);
      
      signals.push({
        type: 'wikipedia_trend',
        icon: '📚',
        text: `Topic trending on Wikipedia`,
        subtext: `Matched: ${matchedWikiKeywords.slice(0, 3).join(', ')}`,
        weight: 'medium',
        priority: 7,
        data: {
          matchedKeywords: matchedWikiKeywords,
          keywordCount: matchedWikiKeywords.length,
          boost: wikipediaBoost
        }
      });
    }
  }

  // Calculate final score with source tier + Wikipedia boost
  score = (score + sourceTierAdjustment + wikipediaBoost) * sourceTierMultiplier;

  // Calculate final score with bounds
  const finalScore = Math.max(0, Math.min(100, score));
  
  // Debug logging for score breakdown (only for high-scoring or debug signals)
  const isHighScore = finalScore >= 60;
  const isDebugSignal = signalTitle && (
    signalTitle.toLowerCase().includes('venezuela') ||
    signalTitle.toLowerCase().includes('china') ||
    signalTitle.toLowerCase().includes('iran')
  );
  
  if (isHighScore || isDebugSignal) {
    // Extract bonuses from signals
    const dnaSignal = signals.find(s => s.type === 'dna_match');
    const competitorSignal = signals.find(s => s.type?.includes('competitor_breakout'));
    const trendingSignal = signals.find(s => s.type === 'recency');
    const freshnessSignal = signals.find(s => s.type === 'freshness');
    const saturationSignal = signals.find(s => s.type === 'saturated');
    const volumeSignals = signals.filter(s => s.type?.includes('competitor_volume') || s.type === 'trendsetter_volume');
    
    const dnaBonus = dnaSignal?.data?.dnaBonus || 0;
    const competitorBonus = competitorSignal?.data?.finalScore || 0;
    const volumeBonus = volumeSignals.reduce((sum, s) => sum + (s.data?.count ? COMPETITOR_SCORE_WEIGHTS[s.type] || 0 : 0), 0);
    const trendingBonus = trendingSignal ? 8 : 0;
    const freshBonus = freshnessSignal ? 8 : 0;
    const penalties = saturationSignal ? Math.abs(saturationSignal.data?.penalty || 0) : 0;
    
    console.log(`📊 SCORE BREAKDOWN for "${signalTitle.substring(0, 50)}...":`);
    console.log(`   Base score: 20`);
    console.log(`   + DNA match: ${dnaBonus} (${dnaSignal?.data?.matchCount || 0} topics)`);
    console.log(`   + Competitor breakout: ${competitorBonus}`);
    console.log(`   + Competitor volume: ${volumeBonus}`);
    console.log(`   + Trending: ${trendingBonus}`);
    console.log(`   + Fresh topic: ${freshBonus}`);
    if (sourceTierAdjustment > 0) {
        console.log(`   + Source tier (Tier A): +${sourceTierAdjustment}`);
      }
      if (wikipediaBoost > 0) {
        console.log(`   + Wikipedia trend: +${wikipediaBoost}`);
      }
      if (dnaSignal && dnaSignal.data?.dnaBonus > 0) {
        console.log(`   × DNA multiplier: 1.15x`);
      }
      console.log(`   - Penalties: ${penalties}`);
      console.log(`   = FINAL: ${finalScore}`);
  }

  return {
    score: finalScore,
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
export async function getUrgencyTier(scoring, idea, dnaData = null) {
  return await determineUrgencyTier(idea, scoring, dnaData);
}

/**
 * Calculate Explicit Demand - based on audience interests from comments
 * Returns score 0-50 based on how well signal matches audience interests
 */
function calculateExplicitDemand(idea, audienceInterests) {
  if (!audienceInterests || !idea) return { score: 0, matches: [] };
  
  const signalText = `${idea.title || ''} ${idea.description || ''}`.toLowerCase();
  const matches = [];
  let totalScore = 0;
  
  // Check comment-based interests (explicit requests)
  const fromComments = audienceInterests.fromComments || [];
  fromComments.forEach(interest => {
    const interestName = (interest.name || interest.id || '').toLowerCase();
    const keywords = interestName.split(/[\s_]+/).filter(k => k.length > 2);
    
    const hasMatch = keywords.some(keyword => signalText.includes(keyword));
    if (hasMatch && interest.mentionCount >= 5) {
      // Score based on mention count (more mentions = higher demand)
      const demandScore = Math.min(15, Math.round(interest.mentionCount / 5));
      totalScore += demandScore;
      matches.push({ type: 'comment', name: interest.name, mentionCount: interest.mentionCount, score: demandScore });
    }
  });
  
  // Check video-based interests (proven engagement)
  const fromVideos = audienceInterests.fromVideos || [];
  fromVideos.forEach(interest => {
    const interestName = (interest.name || interest.id || '').toLowerCase();
    const keywords = interestName.split(/[\s_]+/).filter(k => k.length > 2);
    
    const hasMatch = keywords.some(keyword => signalText.includes(keyword));
    if (hasMatch && interest.multiplier >= 1.1) {
      const demandScore = Math.min(15, Math.round((interest.multiplier - 1) * 30));
      totalScore += demandScore;
      matches.push({ type: 'video', name: interest.name, multiplier: interest.multiplier, score: demandScore });
    }
  });
  
  return { 
    score: Math.min(50, totalScore), 
    matches,
    hasHighDemand: totalScore >= 25  // Top ~5% threshold
  };
}

/**
 * Calculate Inferred Demand - based on topic/pattern performance
 * Returns score 0-40 based on historical performance data
 */
function calculateInferredDemand(idea, topicPerformance, formatPerformance, winningPatterns) {
  if (!idea) return { score: 0, reasons: [] };
  
  let totalScore = 0;
  const reasons = [];
  
  // Get signal's matched topic
  const topicId = idea.primaryTopic || idea.matchedTopics?.[0]?.topicId || idea.topic_id;
  
  // Check topic performance
  if (topicId && topicPerformance?.[topicId]) {
    const perf = topicPerformance[topicId];
    const hasEnoughData = (perf.videoCount || 0) >= 5;
    
    if (perf.performanceRatio >= 1.5) {
      if (hasEnoughData) {
        totalScore += 20;
        reasons.push(`High-performing topic (${perf.performanceRatio.toFixed(2)}x, ${perf.videoCount} videos)`);
      } else {
        totalScore += 8; // Reduced score for low confidence
        reasons.push(`High-performing topic (${perf.performanceRatio.toFixed(2)}x, low confidence - only ${perf.videoCount || 0} videos)`);
      }
    } else if (perf.performanceRatio >= 1.2) {
      if (hasEnoughData) {
        totalScore += 10;
        reasons.push(`Good topic performance (${perf.performanceRatio.toFixed(2)}x, ${perf.videoCount} videos)`);
      } else {
        totalScore += 4; // Reduced score for low confidence
        reasons.push(`Good topic performance (${perf.performanceRatio.toFixed(2)}x, low confidence)`);
      }
    }
    
    if (perf.isCore && hasEnoughData) {
      totalScore += 5;
      reasons.push('Core identity topic');
    }
  }
  
  // Check format performance
  if (topicId && formatPerformance?.[topicId]) {
    const formatPerf = formatPerformance[topicId];
    
    // Only trust format performance if we have enough data
    const longData = formatPerf.long;
    const shortData = formatPerf.short;
    
    const longReliable = longData && (longData.videoCount || 0) >= 3 && longData.confidence !== 'low';
    const shortReliable = shortData && (shortData.videoCount || 0) >= 3 && shortData.confidence !== 'low';
    
    const longRatio = longReliable ? (longData.performanceRatio || 0) : 0;
    const shortRatio = shortReliable ? (shortData.performanceRatio || 0) : 0;
    const bestRatio = Math.max(longRatio, shortRatio);
    
    if (bestRatio >= 2.0) {
      totalScore += 10;
      reasons.push(`Exceptional format performance (${bestRatio.toFixed(2)}x)`);
    } else if (bestRatio >= 1.5) {
      totalScore += 5;
      reasons.push(`Strong format performance (${bestRatio.toFixed(2)}x)`);
    }
  }
  
  // Check winning pattern match
  // Note: patternMatches may not be available yet (calculated after getUrgencyTier)
  // So we check winningPatterns against signal text directly
  if (winningPatterns && winningPatterns.length > 0) {
    const signalText = `${idea.title || ''} ${idea.description || ''}`.toLowerCase();
    const topPatterns = winningPatterns.slice(0, 3);
    
    // Check if signal text matches top winning patterns
    for (const pattern of topPatterns) {
      const patternName = (pattern.name || pattern.nameEn || '').toLowerCase();
      const patternKeywords = patternName.split(/[\s_]+/).filter(k => k.length > 2);
      
      // Simple keyword matching against signal text
      const hasMatch = patternKeywords.some(keyword => signalText.includes(keyword));
      if (hasMatch) {
        totalScore += 10;
        reasons.push(`Matches top winning pattern: ${pattern.name || pattern.id}`);
        break; // Only count once
      }
    }
  }
  
  // Also check if patternMatches are already available (fallback for future use)
  if (idea.patternMatches && idea.patternMatches.length > 0 && winningPatterns) {
    const matchedPatternIds = idea.patternMatches.map(p => p.patternId || p.id);
    const topPatternIds = winningPatterns.slice(0, 3).map(p => p.id || p.pattern_id);
    
    const hasTopPattern = matchedPatternIds.some(id => topPatternIds.includes(id));
    if (hasTopPattern && !reasons.some(r => r.includes('winning pattern'))) {
      totalScore += 10;
      reasons.push('Matches top winning pattern (from patternMatches)');
    }
  }
  
  return {
    score: Math.min(40, totalScore),
    reasons,
    hasHighPerformance: totalScore >= 20
  };
}

/**
 * Calculate Post Today Priority Score
 * Combines all demand types with the base score
 */
function calculatePostTodayPriority(score, hasMomentDemand, explicitDemand, inferredDemand) {
  // Priority formula:
  // Moment + Explicit = highest priority (breaking news audience wants)
  // Moment alone = high priority (time-sensitive)
  // Explicit + Inferred = medium-high (audience wants + historically works)
  // Inferred alone = lower (good topic, no urgency)
  
  let priority = score / 2; // Base contribution (0-50 points)
  
  if (hasMomentDemand) {
    priority += 50; // Breaking news boost
  }
  
  if (explicitDemand.hasHighDemand) {
    priority += 40; // Audience asked for it
  } else if (explicitDemand.score > 0) {
    priority += explicitDemand.score * 0.8; // Partial explicit demand
  }
  
  if (inferredDemand.hasHighPerformance) {
    priority += 20; // Historical performance
  } else if (inferredDemand.score > 0) {
    priority += inferredDemand.score * 0.5; // Partial inferred demand
  }
  
  return Math.round(priority);
}

/**
 * Determine urgency tier based on time-sensitivity signals
 * @param {Object} idea - The idea/signal object
 * @param {Object} scoring - The scoring result with signals
 * @param {Object} dnaData - Optional DNA data for demand calculation
 * @returns {Object} Tier object with category for backlog
 */
async function determineUrgencyTier(idea, scoring, dnaData = null) {
  const { signals, score } = scoring;
  const signalTitle = idea.title || '';
  const signalPublishedAt = idea.published_at || idea.created_at || idea.publishedAt;
  
  // Extract competitor breakdown from signals
  // NOTE: Volume signals contain actual competitor counts in their data/evidence fields
  // A single competitor_volume_mixed signal might represent 5 competitors, not just 1 signal
  const competitorVolumeSignal = signals.find(s => 
    s.type === 'competitor_volume_direct' || 
    s.type === 'competitor_volume_mixed' || 
    s.type === 'competitor_volume_indirect' ||
    s.type === 'competitor_volume_trendsetter'
  );

  const trendsetterVolumeSignal = signals.find(s => s.type === 'trendsetter_volume');

  // Extract actual counts from signal data (not count of signals)
  // For mixed signals, all counts are in one signal
  // For direct/indirect/trendsetter signals, only that type's count is present
  let directCount = 0;
  let indirectCount = 0;
  let trendsetterCount = 0;
  let totalCount = 0;

  if (competitorVolumeSignal) {
    // Mixed signal has all counts in data/evidence.breakdown
    if (competitorVolumeSignal.type === 'competitor_volume_mixed') {
      directCount = competitorVolumeSignal.data?.direct ?? 
                    competitorVolumeSignal.evidence?.breakdown?.direct ?? 0;
      indirectCount = competitorVolumeSignal.data?.indirect ?? 
                      competitorVolumeSignal.evidence?.breakdown?.indirect ?? 0;
      trendsetterCount = competitorVolumeSignal.data?.trendsetter ?? 
                         competitorVolumeSignal.evidence?.breakdown?.trendsetter ?? 0;
      totalCount = competitorVolumeSignal.data?.total ?? 
                   competitorVolumeSignal.evidence?.totalCount ?? 
                   (directCount + indirectCount + trendsetterCount);
    } 
    // Direct signal
    else if (competitorVolumeSignal.type === 'competitor_volume_direct') {
      directCount = competitorVolumeSignal.data?.count ?? 
                    competitorVolumeSignal.evidence?.totalCount ?? 0;
      totalCount = directCount;
    }
    // Indirect signal
    else if (competitorVolumeSignal.type === 'competitor_volume_indirect') {
      indirectCount = competitorVolumeSignal.data?.count ?? 
                      competitorVolumeSignal.evidence?.totalCount ?? 0;
      totalCount = indirectCount;
    }
    // Trendsetter signal
    else if (competitorVolumeSignal.type === 'competitor_volume_trendsetter') {
      trendsetterCount = competitorVolumeSignal.data?.count ?? 
                         competitorVolumeSignal.evidence?.totalCount ?? 0;
      totalCount = trendsetterCount;
    }
  }

  // Also check trendsetter_volume signal (separate signal type)
  if (trendsetterVolumeSignal) {
    const trendsetterVolCount = trendsetterVolumeSignal.data?.count ?? 
                                trendsetterVolumeSignal.evidence?.totalCount ?? 0;
    trendsetterCount = Math.max(trendsetterCount, trendsetterVolCount);
    totalCount = Math.max(totalCount, trendsetterCount + directCount + indirectCount);
  }

  const competitorBreakdown = {
    hasDirectBreakout: signals.some(s => s.type === 'competitor_breakout_direct'),
    hasTrendsetterSignal: signals.some(s => s.type === 'competitor_breakout_trendsetter'),
    hasIndirectBreakout: signals.some(s => s.type === 'competitor_breakout_indirect'),
    directCount,
    trendsetterCount, 
    indirectCount,
    totalCount,
  };

  // DEBUG: Log competitor breakdown extraction
  console.log(`   📊 Competitor breakdown extracted:`, {
    directCount,
    trendsetterCount,
    indirectCount,
    totalCount,
    fromSignal: competitorVolumeSignal?.type || trendsetterVolumeSignal?.type || 'none',
  });
  
  // Extract hoursAgo from evidence or data fields
  const trendsetterBreakout = signals.find(s => s.type === 'competitor_breakout_trendsetter');
  const directBreakout = signals.find(s => s.type === 'competitor_breakout_direct');
  const indirectBreakout = signals.find(s => s.type === 'competitor_breakout_indirect');
  
  // Get hoursAgo from evidence or data object (fallback to data if evidence doesn't have it)
  // Check data first since that's where it's explicitly set, then evidence as fallback
  const trendsetterHoursAgo = trendsetterBreakout?.data?.hoursAgo ?? trendsetterBreakout?.evidence?.hoursAgo;
  const directBreakoutHoursAgo = directBreakout?.data?.hoursAgo ?? directBreakout?.evidence?.hoursAgo;
  const indirectBreakoutHoursAgo = indirectBreakout?.data?.hoursAgo ?? indirectBreakout?.evidence?.hoursAgo;
  
  // Check for time-sensitive signals
  const hasFreshTrendsetter = trendsetterBreakout && trendsetterHoursAgo !== undefined && trendsetterHoursAgo < 6;
  
  // Include indirect breakouts in recent breakout check (they're still valid signals)
  const hasRecentCompetitorBreakout = (
    (directBreakout && directBreakoutHoursAgo !== undefined && directBreakoutHoursAgo < 48) ||
    (trendsetterBreakout && trendsetterHoursAgo !== undefined && trendsetterHoursAgo < 48) ||
    (indirectBreakout && indirectBreakoutHoursAgo !== undefined && indirectBreakoutHoursAgo < 48)
  );
  
  const multipleCompetitorsRecent = competitorBreakdown.totalCount >= 3 && hasRecentCompetitorBreakout;
  
  // ISSUE 3: Check if user recently covered this topic (< 7 days ago)
  // Extract daysSinceLastPost from signals (from 'saturated' or 'freshness' signal)
  const saturatedSignal = signals.find(s => s.type === 'saturated');
  const freshnessSignal = signals.find(s => s.type === 'freshness');
  const daysSinceLastPost = saturatedSignal?.data?.daysSinceLastPost ?? freshnessSignal?.data?.daysSinceLastPost ?? 999;
  const lastPostEvidence = saturatedSignal?.evidence || freshnessSignal?.evidence;
  
  // STEP 4: Tighten isSameStory matching to prevent false matches
  // FIXED: Only demote if it's the SAME story, not just same topic
  // Iran protests TODAY are NEW developments, not the same story from 4 days ago
  // Require exact topic_id match OR 5+ keyword overlap (not 3+) to reduce false positives
  const matchedKeywordsCount = lastPostEvidence?.matchedKeywords?.length || 0;
  // For topic_id match: if matchType is 'topic_id', it means both had the same topic_id (verified in findDaysSinceLastPost)
  const isSameStory = (lastPostEvidence?.matchType === 'topic_id' && signalTopicId) || 
                      (matchedKeywordsCount >= 5); // Require 5+ keywords (was 3+)
  
  // Debug log when keyword match occurs
  if (lastPostEvidence && matchedKeywordsCount >= 5 && lastPostEvidence.matchType !== 'topic_id') {
    console.log(`[RecentlyCovered] Keyword match (${matchedKeywordsCount} keywords): Signal="${signalTitle.substring(0, 50)}" matched Video="${lastPostEvidence.videoTitle?.substring(0, 50)}"`);
  }
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
    console.log(`   daysSinceLastPost: ${daysSinceLastPost} days ${daysSinceLastPost === 999 ? '⚠️ (no user videos found - never posted)' : ''}`);
    console.log(`   isSameStory: ${isSameStory} | isNewDevelopment: ${isNewDevelopment}`);
    console.log(`   recentlyCovered (same story, no new dev): ${recentlyCovered} ${recentlyCovered ? '⚠️ WILL DEMOTE' : ''}`);
    console.log(`   hasDirectBreakout: ${competitorBreakdown.hasDirectBreakout}`);
    console.log(`   hasTrendsetterSignal: ${competitorBreakdown.hasTrendsetterSignal}`);
    console.log(`   hasIndirectBreakout: ${!!indirectBreakout}`);
    console.log(`   trendsetterHoursAgo: ${trendsetterHoursAgo ?? 'undefined'} ${!trendsetterBreakout ? '(no signal found)' : trendsetterHoursAgo === undefined ? '(signal exists but hoursAgo missing)' : `(${trendsetterHoursAgo}h = ${(trendsetterHoursAgo / 24).toFixed(1)}d ago)`}`);
    console.log(`   directBreakoutHoursAgo: ${directBreakoutHoursAgo ?? 'undefined'} ${!directBreakout ? '(no signal found)' : directBreakoutHoursAgo === undefined ? '(signal exists but hoursAgo missing)' : `(${directBreakoutHoursAgo}h = ${(directBreakoutHoursAgo / 24).toFixed(1)}d ago)`}`);
    console.log(`   indirectBreakoutHoursAgo: ${indirectBreakoutHoursAgo ?? 'undefined'} ${!indirectBreakout ? '(no signal found)' : indirectBreakoutHoursAgo === undefined ? '(signal exists but hoursAgo missing)' : `(${indirectBreakoutHoursAgo}h = ${(indirectBreakoutHoursAgo / 24).toFixed(1)}d ago)`}`);
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
    if (indirectBreakout) {
      console.log(`   Indirect breakout evidence:`, {
        hasEvidence: !!indirectBreakout.evidence,
        evidenceHoursAgo: indirectBreakout.evidence?.hoursAgo,
        hasData: !!indirectBreakout.data,
        dataHoursAgo: indirectBreakout.data?.hoursAgo,
        finalHoursAgo: indirectBreakoutHoursAgo,
        dataKeys: indirectBreakout.data ? Object.keys(indirectBreakout.data) : [],
        evidenceKeys: indirectBreakout.evidence ? Object.keys(indirectBreakout.evidence) : []
      });
    } else {
      // Log why no indirect breakout was found
      const indirectSignals = signals.filter(s => s.type === 'competitor_breakout_indirect');
      if (indirectSignals.length > 0) {
        console.log(`   ⚠️ Found ${indirectSignals.length} indirect breakout signal(s) but hoursAgo extraction failed:`, {
          signalData: indirectSignals[0].data,
          signalEvidence: indirectSignals[0].evidence
        });
      }
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
  // 3. Source quality gate: Premium source OR sourceCount >= 3 (tier1_ok)
  // 4. One of these urgency triggers:
  //    a. Direct competitor breakout in last 48h
  //    b. Trendsetter posted < 24h ago (breaking)
  //    c. 3+ competitors covering in last 48h
  //    d. Score >= 80 with any competitor signal
  //    e. Trendsetter < 72h with 2+ competitors covering
  //    f. Breaking + High Score (hoursOld <= 12, score >= 70, tier1_ok)
  
  // Calculate hoursOld for recency checks
  const hoursOld = signalPublishedAt ? calculateHoursAgo(signalPublishedAt) : 999;
  const sourceCount = idea.source_count || 1;
  
  // STEP 1: Source quality gate - Use universal source_quality (from signal_sources) or fallback to legacy check
  // source_quality is set by pitches route using classifySourceQuality(sourceType, sourceUrl)
  // Values: 'premium' (direct feeds, GN with site:), 'supported' (GN topical), 'community' (non-RSS)
  const source_quality = idea.source_quality || (isPremiumSource(idea) ? 'premium' : 'supported'); // Fallback to legacy
  const tier1_ok = source_quality === 'premium';
  
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
      // Calculate demand scores if DNA data is available
      const explicitDemand = dnaData?.audienceInterests 
        ? calculateExplicitDemand(idea, dnaData.audienceInterests)
        : { score: 0, matches: [], hasHighDemand: false };

      const inferredDemand = dnaData 
        ? calculateInferredDemand(idea, dnaData.topicPerformance, dnaData.formatPerformanceByTopic, dnaData.winningPatterns)
        : { score: 0, reasons: [], hasHighPerformance: false };

      // Log demand calculation
      if (explicitDemand.score > 0 || inferredDemand.score > 0) {
        console.log(`   📊 [Demand] "${signalTitle.substring(0, 40)}..." - Explicit: ${explicitDemand.score}, Inferred: ${inferredDemand.score}`);
      }

      // ADJUSTED: Increase trendsetter threshold from 6h to 24h for Post Today
      const hasRecentTrendsetter = trendsetterBreakout && trendsetterHoursAgo !== undefined && trendsetterHoursAgo < 24;
      
      // Helper: Check if there's any competitor activity
      const hasAnyCompetitorActivity = competitorBreakdown.hasDirectBreakout || 
                                       competitorBreakdown.hasTrendsetterSignal || 
                                       competitorBreakdown.hasIndirectBreakout ||
                                       competitorBreakdown.totalCount > 0;
      
      // STEP 1: Source quality gate - Block Post Today if not premium
      if (!tier1_ok) {
        if (isDebugIdea || score >= 70) {
          console.log(`[Tier] Blocked PostToday (not premium): title="${signalTitle.substring(0, 60)}" source="${idea.source || idea.source_name || 'unknown'}" source_quality="${source_quality}"`);
        }
        // Will fall through to This Week / Backlog tier checks below
      } else {
        // All Post Today triggers require tier1_ok = true
        
      if (competitorBreakdown.hasDirectBreakout && hasRecentCompetitorBreakout) {
        const postTodayPriority = calculatePostTodayPriority(score, true, explicitDemand, inferredDemand);
        
        // Validate with AI for high-stakes Post Today decisions (only for high scores)
        if (score >= 85) {
          try {
            const { validatePostTodayDecision } = await import('@/lib/ai/postTodayValidator.js');
            const validation = await validatePostTodayDecision(idea, { score, signals }, {
              name: 'AlMokhbir Aleqtesady+',
              description: 'Economics and geopolitics'
            });
            
            if (!validation.validated) {
              console.log(`   ⚠️ AI rejected Post Today: ${validation.reason}`);
              // Fall through to This Week tier instead
              // Don't return here, let it continue to This Week checks
            } else {
              const finalTier = {
                tier: 'post_today',
                label: 'Post Today',
                icon: '🔴',
                reason: 'Direct competitor breaking out - your audience is watching!',
                color: 'red',
                urgency: 'high',
                triggers: ['direct_breakout'],
                demandType: 'moment',
                priority: postTodayPriority,
                demandDetails: { explicit: explicitDemand, inferred: inferredDemand }
              };
              if (isDebugIdea || score >= 70) {
                console.log(`   ✅ TIER: POST TODAY (Direct competitor breakout < 48h, score: ${score}, priority: ${postTodayPriority}) - AI validated`);
                console.log(`===== END TIER DECISION DEBUG =====\n`);
              }
              return finalTier;
            }
          } catch (validationError) {
            console.warn(`   ⚠️ Post Today validation error (non-fatal):`, validationError.message);
            // On error, proceed with original decision
          }
        }
        
        // If validation passed or score < 85, return Post Today tier
        const finalTier = {
          tier: 'post_today',
          label: 'Post Today',
          icon: '🔴',
          reason: 'Direct competitor breaking out - your audience is watching!',
          color: 'red',
          urgency: 'high',
          triggers: ['direct_breakout'],
          demandType: 'moment',
          priority: postTodayPriority,
          demandDetails: { explicit: explicitDemand, inferred: inferredDemand }
        };
        if (isDebugIdea || score >= 70) {
          console.log(`   ✅ TIER: POST TODAY (Direct competitor breakout < 48h, score: ${score}, priority: ${postTodayPriority})`);
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
      
      // STEP 2: Breaking + High Score trigger (no competitor required, but behind source gate)
      if (hoursOld <= 12 && score >= 70 && !recentlyCovered) {
        // Check for evidence: DNA match OR mechanism keywords OR big numbers
        const hasDnaMatch = signals.some(s => s.type === 'dna_match');
        const signalText = `${signalTitle} ${idea.description || ''}`.toLowerCase();
        const mechanismKeywords = ['tariff', 'sanction', 'inflation', 'debt', 'oil', 'rate', 'interest', 'trade', 'tariff', 'tariff', 'رسوم', 'عقوبات', 'تضخم', 'ديون', 'نفط', 'أسعار', 'فائدة', 'تجارة'];
        const hasMechanism = mechanismKeywords.some(kw => signalText.includes(kw));
        const bigNumberPattern = /(\d+(\.\d+)?)\s*(billion|million|trillion|مليار|مليون|تريليون|%)/i;
        const hasBigNumber = bigNumberPattern.test(signalText);
        
        if (hasDnaMatch || hasMechanism || hasBigNumber) {
          const postTodayPriority = calculatePostTodayPriority(score, false, explicitDemand, inferredDemand);
          const finalTier = {
            tier: 'post_today',
            label: 'Post Today',
            icon: '🔴',
            reason: 'Breaking + high score + premium/multisource',
            color: 'red',
            urgency: 'high',
            triggers: ['breaking_high_score'],
            demandType: 'breaking',
            priority: postTodayPriority,
            demandDetails: { explicit: explicitDemand, inferred: inferredDemand }
          };
          if (isDebugIdea || score >= 70) {
            console.log(`   ✅ TIER: POST TODAY (Breaking + high score: ${hoursOld}h old, score: ${score}, priority: ${postTodayPriority})`);
            console.log(`===== END TIER DECISION DEBUG =====\n`);
          }
          return finalTier;
        }
      }
      
      if (multipleCompetitorsRecent && hasRecentCompetitorBreakout) {
        const postTodayPriority = calculatePostTodayPriority(score, true, explicitDemand, inferredDemand);
        const finalTier = {
          tier: 'post_today',
          label: 'Post Today',
          icon: '🔴',
          reason: 'Multiple competitors covering - topic is hot!',
          color: 'red',
          urgency: 'high',
          triggers: ['multiple_competitors'],
          demandType: 'moment',
          priority: postTodayPriority,
          demandDetails: { explicit: explicitDemand, inferred: inferredDemand }
        };
        if (isDebugIdea || score >= 70) {
          console.log(`   ✅ TIER: POST TODAY (3+ competitors covering < 48h, score: ${score}, priority: ${postTodayPriority})`);
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
      
      if (score >= 80 && (competitorBreakdown.hasDirectBreakout || competitorBreakdown.hasTrendsetterSignal || competitorBreakdown.hasIndirectBreakout)) {
        const postTodayPriority = calculatePostTodayPriority(score, true, explicitDemand, inferredDemand);
        const finalTier = {
          tier: 'post_today',
          label: 'Post Today',
          icon: '🔴',
          reason: 'High relevance + competitor activity',
          color: 'red',
          urgency: 'high',
          triggers: ['high_score_competitor'],
          demandType: 'moment',
          priority: postTodayPriority,
          demandDetails: { explicit: explicitDemand, inferred: inferredDemand }
        };
        if (isDebugIdea || score >= 70) {
          console.log(`   ✅ TIER: POST TODAY (Score >= 80 + competitor activity, score: ${score}, priority: ${postTodayPriority})`);
          console.log(`===== END TIER DECISION DEBUG =====\n`);
        }
        return finalTier;
      }
      
      // NEW: Explicit Demand Trigger (audience is asking for this)
      if (explicitDemand.hasHighDemand && score >= 50 && !recentlyCovered) {
        const postTodayPriority = calculatePostTodayPriority(score, false, explicitDemand, inferredDemand);
        const finalTier = {
          tier: 'post_today',
          label: 'Post Today',
          icon: '🔴',
          reason: `High audience demand (${explicitDemand.matches.map(m => m.name).join(', ')})`,
          color: 'red',
          urgency: 'high',
          triggers: ['explicit_demand'],
          demandType: 'explicit',
          priority: postTodayPriority,
          demandDetails: { explicit: explicitDemand, inferred: inferredDemand }
        };
        if (isDebugIdea || score >= 70) {
          console.log(`   ✅ TIER: POST TODAY (High audience demand, score: ${score}, priority: ${postTodayPriority})`);
          console.log(`===== END TIER DECISION DEBUG =====\n`);
        }
        return finalTier;
      }
      
      // NEW: Inferred + Explicit Demand (audience wants it + historically works)
      if (explicitDemand.score >= 15 && inferredDemand.hasHighPerformance && score >= 55 && !recentlyCovered) {
        const postTodayPriority = calculatePostTodayPriority(score, false, explicitDemand, inferredDemand);
        const finalTier = {
          tier: 'post_today',
          label: 'Post Today',
          icon: '🔴',
          reason: `Audience interest + high-performing topic (${inferredDemand.reasons[0] || 'strong performance'})`,
          color: 'red',
          urgency: 'high',
          triggers: ['explicit_demand', 'inferred_demand'],
          demandType: 'explicit_inferred',
          priority: postTodayPriority,
          demandDetails: { explicit: explicitDemand, inferred: inferredDemand }
        };
        if (isDebugIdea || score >= 70) {
          console.log(`   ✅ TIER: POST TODAY (Audience + performance, score: ${score}, priority: ${postTodayPriority})`);
          console.log(`===== END TIER DECISION DEBUG =====\n`);
        }
        return finalTier;
      }
      
      // NEW: High Inferred Demand with some urgency (great topic + competitor activity)
      if (inferredDemand.hasHighPerformance && hasAnyCompetitorActivity && score >= 60 && !recentlyCovered) {
        const postTodayPriority = calculatePostTodayPriority(score, true, explicitDemand, inferredDemand);
        const finalTier = {
          tier: 'post_today',
          label: 'Post Today',
          icon: '🔴',
          reason: `High-performing topic + competitor activity (${inferredDemand.reasons[0] || 'strong performance'})`,
          color: 'red',
          urgency: 'high',
          triggers: ['inferred_demand', 'competitor_activity'],
          demandType: 'inferred_moment',
          priority: postTodayPriority,
          demandDetails: { explicit: explicitDemand, inferred: inferredDemand }
        };
        if (isDebugIdea || score >= 70) {
          console.log(`   ✅ TIER: POST TODAY (Performance + competitor activity, score: ${score}, priority: ${postTodayPriority})`);
          console.log(`===== END TIER DECISION DEBUG =====\n`);
        }
        return finalTier;
      }
      } // End tier1_ok check block
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
  
  // Define helper variables (used in STEP 3 and throughout This Week checks)
  const hasDnaMatch = signals.some(s => s.type === 'dna_match');
  const isTrending = signals.some(s => s.type === 'recency' || s.type === 'trending');
  
  // STEP 3: Allow This Week for recent stories even if score < 50
  // If hoursOld <= 24 AND score >= 45 AND has any "why now" indicator
  if (hoursOld <= 24 && score >= 45 && !recentlyCovered) {
    const hasWhyNow = hasDnaMatch || isTrending || sourceCount >= 2 || 
                      signals.some(s => s.type === 'pattern_match' || s.type === 'dna_match');
    
    if (hasWhyNow) {
      const finalTier = {
        tier: 'this_week',
        label: 'This Week',
        icon: '🟡',
        reason: `Recent breaking story (${Math.floor(hoursOld)}h old) - plan for this week`,
        color: 'yellow',
        urgency: 'medium'
      };
      if (isDebugIdea || score >= 40) {
        console.log(`   ✅ TIER: THIS WEEK (Recent breaking: ${hoursOld}h old, score: ${score}, has why_now indicator)`);
        console.log(`===== END TIER DECISION DEBUG =====\n`);
      }
      return finalTier;
    }
  }
  
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
  
  // STEP 3: Allow This Week for recent stories even if score < 50
  // If hoursOld <= 24 AND score >= 45 AND has any "why now" indicator
  if (hoursOld <= 24 && score >= 45 && !recentlyCovered) {
    const hasWhyNow = hasDnaMatch || isTrending || sourceCount >= 2 || 
                      signals.some(s => s.type === 'pattern_match' || s.type === 'dna_match');
    
    if (hasWhyNow) {
      const finalTier = {
        tier: 'this_week',
        label: 'This Week',
        icon: '🟡',
        reason: `Recent breaking story (${Math.floor(hoursOld)}h old) - plan for this week`,
        color: 'yellow',
        urgency: 'medium'
      };
      if (isDebugIdea || score >= 40) {
        console.log(`   ✅ TIER: THIS WEEK (Recent breaking: ${hoursOld}h old, score: ${score}, has why_now indicator)`);
        console.log(`===== END TIER DECISION DEBUG =====\n`);
      }
      return finalTier;
    }
  }
  
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
async function findCompetitorBreakout(signalTitle, competitorVideos, excludedNames = [], signalTimestamp = null) {
  // DEBUG: Enhanced logging for all signals to diagnose 0 matches
  const signalTitleLower = (signalTitle || '').toLowerCase();
  
  // DEBUG: Check for specific idea (Venezuela/Oil or Ukraine/Russia)
  const isDebugIdea = signalTitle && (
    (signalTitle.includes('ترامب') && signalTitle.includes('الصين')) ||
    signalTitleLower.includes('venezuela') ||
    signalTitleLower.includes('oil') ||
    signalTitleLower.includes('ukraine') ||
    signalTitleLower.includes('ukrainian') ||
    signalTitleLower.includes('kyiv') ||
    signalTitleLower.includes('russia') ||
    signalTitleLower.includes('russian') ||
    signalTitleLower.includes('iran') ||
    signalTitleLower.includes('إيران')
  );
  
  // Track rejection reasons for summary
  const rejectionStats = {
    noKeywords: 0,
    lowWeight: 0,
    genericFilter: 0,
    matchScore: 0,
    topicCoherence: 0,
    semanticFilter: 0,
    totalChecked: 0,
    totalMatched: 0
  };
  
  // DEBUG: Log for Ukraine/Russia ideas
  const isUkraineIdea = signalTitle && (
    signalTitleLower.includes('ukraine') ||
    signalTitleLower.includes('ukrainian') ||
    signalTitleLower.includes('kyiv') ||
    signalTitleLower.includes('russia') ||
    signalTitleLower.includes('russian')
  );
  
  // Extract keywords with translations (only once, at the start)
  const rawIdeaKeywords = extractKeywords(signalTitle);
  
  // Expand keywords with translations for cross-language matching (Arabic ↔ English)
  const ideaKeywordsSet = new Set();
  for (const kw of rawIdeaKeywords) {
    ideaKeywordsSet.add(normalizeArabicText(kw).toLowerCase());
    // Add translations
    const rootConcept = getRootConcept(kw);
    if (rootConcept && KEYWORD_TRANSLATIONS[rootConcept]) {
      for (const translation of KEYWORD_TRANSLATIONS[rootConcept]) {
        ideaKeywordsSet.add(normalizeArabicText(translation).toLowerCase());
      }
    }
  }
  const ideaKeywords = Array.from(ideaKeywordsSet);
  
  // Enhanced debug logging for competitor matching
  // Enable debug for ALL signals temporarily to diagnose why matches are rejected
  const enableDebugForAll = false; // Set to true to enable detailed logging for all signals
  
  // DIAGNOSTIC: Track detailed matching information
  const diagnosticInfo = {
    signalTitle: signalTitle?.substring(0, 100),
    totalVideos: competitorVideos?.length || 0,
    extractedKeywords: ideaKeywords,
    videosChecked: [],
    matchesFound: [],
    rejectionReasons: {
      noKeywords: [],
      genericFilter: [],
      matchScore: [],
      topicCoherence: [],
      lowWeight: []
    },
    sampleVideoTitles: competitorVideos?.slice(0, 5).map(v => v.title) || []
  };
  
  if (enableDebugForAll || isDebugIdea) {
    console.log(`\n🔍 ===== COMPETITOR BREAKOUT MATCHING =====`);
    console.log(`   Signal: "${signalTitle?.substring(0, 60)}..."`);
    console.log(`   Competitor videos available: ${competitorVideos?.length || 0}`);
    console.log(`   Extracted signal keywords (${ideaKeywords.length} total):`, ideaKeywords.slice(0, 15));
    if (diagnosticInfo.sampleVideoTitles.length > 0) {
      console.log(`   Sample competitor video titles:`, diagnosticInfo.sampleVideoTitles);
    }
  }
  
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
          channelName: video.channel_name || video.channelName || video.competitors?.channel_name || video.competitors?.name || 'Unknown',
          type: video.competitor_type || video.competitorType || video.competitors?.competitor_type || video.competitors?.type || 'indirect',
          medianViews20: video.competitors?.median_views_20 || null,
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
  
  // DEBUG: Log keyword extraction for specific idea
  if (isDebugIdea) {
    console.log('   Extracted keywords from idea (with translations):', ideaKeywords);
    console.log('   Total competitors to check:', Object.keys(competitorStats).length);
  }

  // Check for breakouts matching the signal title
  for (const [competitorId, stats] of Object.entries(competitorStats)) {
    if (stats.videos.length < 3 && stats.type !== 'trendsetter') {
      if (isDebugIdea) {
        console.log(`   Skipping "${stats.channelName}" (${stats.type}): Only ${stats.videos.length} videos (need 5+ for non-trendsetters)`);
      }
      continue; // Need at least 5 videos to calculate average (except for trendsetters)
    }

    // Use median of last 20 videos (more robust than average for breakout detection)
    let medianViews;
    if (stats.medianViews20 && stats.medianViews20 > 0) {
      medianViews = stats.medianViews20;
    } else {
      const recentVids = stats.videos
        .sort((a, b) => new Date(b.published_at || b.publish_date) - new Date(a.published_at || a.publish_date))
        .slice(0, 20);
      const viewCounts = recentVids.map(v => v.views).filter(v => v > 0);
      medianViews = calculateMedian(viewCounts);
    }
    const avgViews = medianViews > 0 ? medianViews : (stats.totalViews / stats.videos.length);

    // Find videos that match the signal within a time window
    const recentVideosRaw = stats.videos.filter(v => {
        // Normalize date field
        const videoDate = v.published_at || v.publish_date;
        if (!videoDate) return false;
        
        const daysAgo = calculateDaysAgo(videoDate);
        
        // TIME GATE: Must be within 7 days of now
        if (daysAgo > 7) return false;
        
        // TIME GATE: If we have signal timestamp, video must be within 72h of signal
        if (signalTimestamp) {
          const signalDate = new Date(signalTimestamp);
          const vidDate = new Date(videoDate);
          const hoursDiff = Math.abs(signalDate - vidDate) / (1000 * 60 * 60);
          if (hoursDiff > 72) {
            return false;
          }
        }
        
        return true; // Passes time gates
      });
  
      // SEMANTIC SIMILARITY GATE: Score each video's relevance to signal
      let recentVideos = [];
      for (const v of recentVideosRaw) {
        // Calculate semantic similarity
        let similarity = null;
        let similarityClass = 'unknown';
        
        try {
          similarity = await calculateSemanticSimilarity(signalTitle, v.title || '');
          const classification = classifySimilarity(similarity);
          similarityClass = classification.level;
          
          // REJECT if clearly different story
          if (similarityClass === 'different') {
            if (isDebugIdea) {
              console.log(`     ❌ SEMANTIC REJECT: "${v.title?.substring(0, 40)}..." (similarity: ${similarity?.toFixed(2)})`);
            }
            rejectionStats.semanticFilter = (rejectionStats.semanticFilter || 0) + 1;
            continue; // Skip this video
          }
          
          // Log high-similarity matches
          if (isDebugIdea && similarity >= SIMILARITY_THRESHOLDS.RELATED) {
            console.log(`     ✅ SEMANTIC MATCH: "${v.title?.substring(0, 40)}..." (similarity: ${similarity?.toFixed(2)}, class: ${similarityClass})`);
          }
        } catch (err) {
          // If semantic check fails, continue with keyword matching
          console.warn(`     ⚠️ Semantic check failed for "${v.title?.substring(0, 30)}...":`, err.message);
        }
        
        // Add similarity data to video for later use
        recentVideos.push({
          ...v,
          similarity,
          similarityClass,
        });
      }
      
      // Filter videos by keyword matching and validation
      const recentVideosFiltered = recentVideos.filter(v => {
      // Extract keywords from title + description for better matching
      const titleKeywords = extractKeywords(v.title || '');
      const descKeywords = extractKeywords((v.description || '').substring(0, 200));
      const videoKeywords = [...new Set([...titleKeywords, ...descKeywords])];
      
      // ISSUE 2 FIX: Check if any keywords match signal with context-aware matching
      const competitorVideoText = `${v.title || ''} ${v.description || ''}`;
      // Also expand video keywords with translations
      const expandedVideoKeywords = new Set();
      for (const vk of videoKeywords) {
        expandedVideoKeywords.add(normalizeArabicText(vk).toLowerCase());
        const rootConcept = getRootConcept(vk);
        if (rootConcept && KEYWORD_TRANSLATIONS[rootConcept]) {
          for (const translation of KEYWORD_TRANSLATIONS[rootConcept]) {
            expandedVideoKeywords.add(normalizeArabicText(translation).toLowerCase());
          }
        }
      }
      const expandedVideoKeywordsArray = Array.from(expandedVideoKeywords);
      
      const matchingKeywords = ideaKeywords.filter(kw => {
        const normalizedKw = normalizeArabicText(kw).toLowerCase();
        
        // Step 1: Check if keyword exists in video (now with cross-language support)
        const hasMatch = expandedVideoKeywordsArray.some(vk => {
          return vk.includes(normalizedKw) || normalizedKw.includes(vk);
        });
        
        if (!hasMatch || normalizedKw.length <= 1) return false;
        
        // Step 2: Only allow keywords with sufficient weight (weight >= 4)
        const weight = getKeywordWeight(kw);
        if (weight < 4) {
          // Low-weight keywords are filtered out (replaces manual exclude lists)
          return false;
        }
        
        // Step 3: Check if this keyword requires context-aware matching (e.g., "federal")
        const contextCheck = requiresContextAwareMatching(kw, competitorVideoText);
        if (contextCheck.requiresContext && !contextCheck.shouldMatch) {
          // Skip this keyword - it's ambiguous without proper context
          return false;
        }
        
        // If context is required, verify the context exists in video text
        if (contextCheck.requiresContext && contextCheck.shouldMatch) {
          const videoTextLower = normalizeArabicText(competitorVideoText).toLowerCase();
          if (contextCheck.context === 'fed') {
            const fedContextWords = ['reserve', 'bank', 'monetary', 'policy', 'interest', 'rate', 'economy', 'اقتصاد'];
            const hasFedContext = fedContextWords.some(ctx => videoTextLower.includes(ctx));
            return hasFedContext;
          } else if (contextCheck.context === 'forces') {
            const forcesContextWords = ['forces', 'force', 'military', 'syria', 'سوريا', 'قوات', 'عسكري'];
            const hasForcesContext = forcesContextWords.some(ctx => videoTextLower.includes(ctx));
            return hasForcesContext;
          }
        }
        
        // Step 4: Additional context-aware filtering for generic words and job titles
        return isKeywordInValidContext(kw, signalTitle, v.title || '', v.description || '');
      });
      
     // STOPWORDS: These are truly generic and should not count as matches alone
      // NOTE: oil, market, economy are NOT stopwords for economics channels - they're core topics!
      const STOPWORDS = new Set([
        'news', 'أخبار', 'report', 'تقرير', 'update', 'تحديث',
        'video', 'فيديو', 'watch', 'شاهد', 'breaking', 'عاجل',
        'latest', 'جديد', 'today', 'اليوم', 'now', 'الآن',
        'says', 'قال', 'new', 'world', 'عالم', 'global', 'عالمي'
      ]);
      
      // ENTITY KEYWORDS: Leaders/countries that need context (valid when paired with topic)
      const ENTITY_KEYWORDS = new Set([
        'trump', 'ترامب', 'biden', 'بايدن', 'putin', 'بوتين',
        'china', 'الصين', 'usa', 'امريكا', 'america',
        'president', 'رئيس', 'government', 'حكومة'
      ]);
      
      // TOPIC KEYWORDS: These ARE the channel's topics - not generic!
      const TOPIC_KEYWORDS = new Set([
        'oil', 'نفط', 'النفط', 'petroleum', 'crude', 'بترول',
        'gas', 'غاز', 'lng',
        'economy', 'اقتصاد', 'economic', 'اقتصادي',
        'market', 'سوق', 'أسواق', 'markets',
        'tariff', 'tariffs', 'رسوم', 'جمارك', 'تعريفة',
        'sanctions', 'عقوبات',
        'dollar', 'دولار', 'currency', 'عملة',
        'inflation', 'تضخم', 'recession', 'ركود',
        'stocks', 'أسهم', 'bonds', 'سندات',
        'gold', 'ذهب', 'bitcoin', 'بيتكوين',
        'fed', 'فيدرالي', 'federal reserve', 'الفيدرالي',
        'opec', 'أوبك', 'brics', 'بريكس',
        'war', 'حرب', 'conflict', 'صراع', 'military', 'عسكري'
      ]);

      // Country names that, when combined with a person, make a valid match
      const COUNTRY_KEYWORDS = new Set([
        'venezuela', 'فنزويلا', 'iran', 'إيران', 'ukraine', 'أوكرانيا', 
        'russia', 'روسيا', 'saudi', 'السعودية', 'egypt', 'مصر', 
        'uae', 'الإمارات', 'syria', 'سوريا', 'yemen', 'اليمن', 
        'iraq', 'العراق', 'lebanon', 'لبنان', 'israel', 'إسرائيل',
        'palestine', 'فلسطين', 'qatar', 'قطر', 'kuwait', 'الكويت',
        'jordan', 'الأردن', 'tunisia', 'تونس', 'algeria', 'الجزائر',
        'libya', 'ليبيا', 'sudan', 'السودان', 'morocco', 'المغرب',
        'pakistan', 'باكستان', 'turkey', 'تركيا', 'india', 'الهند',
        'afghanistan', 'أفغانستان', 'china', 'الصين', 'greenland', 'غرينلاند',
        'taiwan', 'تايوان', 'japan', 'اليابان', 'germany', 'ألمانيا',
        'france', 'فرنسا', 'uk', 'britain', 'بريطانيا', 'canada', 'كندا',
        'europe', 'أوروبا', 'mexico', 'المكسيك'
      ]);

      // Person names
      const PERSON_KEYWORDS = new Set([
        'trump', 'ترامب', 'biden', 'بايدن', 'putin', 'بوتين', 'maduro', 'مادورو',
        'netanyahu', 'نتنياهو', 'mbs', 'محمد بن سلمان', 'sisi', 'السيسي',
        'xi', 'شي', 'jinping', 'macron', 'ماكرون', 'scholz', 'شولتز',
        'zelensky', 'زيلينسكي', 'khamenei', 'خامنئي', 'erdogan', 'أردوغان'
      ]);
      // Categorize matched keywords
      const stopwordMatches = matchingKeywords.filter(k => {
        const normalized = normalizeArabicText(k).toLowerCase();
        return STOPWORDS.has(normalized);
      });
      const entityMatches = matchingKeywords.filter(k => {
        const normalized = normalizeArabicText(k).toLowerCase();
        return ENTITY_KEYWORDS.has(normalized);
      });
      const topicMatches = matchingKeywords.filter(k => {
        const normalized = normalizeArabicText(k).toLowerCase();
        return TOPIC_KEYWORDS.has(normalized);
      });
      const countryMatches = matchingKeywords.filter(k => {
        const normalized = normalizeArabicText(k).toLowerCase();
        return COUNTRY_KEYWORDS.has(normalized);
      });
      const personMatches = matchingKeywords.filter(k => {
        const normalized = normalizeArabicText(k).toLowerCase();
        return PERSON_KEYWORDS.has(normalized);
      });
      const otherMatches = matchingKeywords.filter(k => {
        const normalized = normalizeArabicText(k).toLowerCase();
        return !STOPWORDS.has(normalized) && 
               !ENTITY_KEYWORDS.has(normalized) && 
               !TOPIC_KEYWORDS.has(normalized) &&
               !COUNTRY_KEYWORDS.has(normalized) &&
               !PERSON_KEYWORDS.has(normalized);
      });
      
      // Meaningful = topic keywords + country + person + other (not stopwords, not just entities)
      const meaningfulMatches = [...topicMatches, ...countryMatches, ...personMatches, ...otherMatches];
      
      // Check flags
      const hasCountry = countryMatches.length > 0;
      const hasPerson = personMatches.length > 0;
      const hasEntity = entityMatches.length > 0;
      const hasTopic = topicMatches.length > 0;
      
      // SEMANTIC SIMILARITY BOOST
      // If semantic similarity is high, relax keyword requirements
      const hasHighSimilarity = v.similarity && v.similarity >= SIMILARITY_THRESHOLDS.SAME_STORY;
      const hasRelatedSimilarity = v.similarity && v.similarity >= SIMILARITY_THRESHOLDS.RELATED;
      
      // VALID MATCH RULES (with semantic boost):
      // STRICTER MATCHING: Require 2+ meaningful overlaps to confirm "same story"
      // Single entity matches (just "Trump") are NOT enough
      // BUT: High semantic similarity can override keyword requirements
      const hasValidKeywordCombo = 
        hasHighSimilarity ||                                      // High semantic similarity = auto-match
        // 2+ topic keywords (strong story overlap)
        topicMatches.length >= 2 ||
        // Related similarity + 1 topic keyword (semantic boost)
        (hasRelatedSimilarity && topicMatches.length >= 1) ||
        // 1 topic + 1 entity/country/person (topic + context)
        (topicMatches.length >= 1 && (hasEntity || hasCountry || hasPerson)) ||
        // Entity + Country (specific context)
        (hasEntity && hasCountry) ||
        // Person + Country (specific context)  
        (hasPerson && hasCountry) ||
        // Person + Topic (specific context)
        (hasPerson && hasTopic) ||
        // Country + Topic (specific context)
        (hasCountry && hasTopic) ||
        // 3+ meaningful keywords (strong overlap)
        meaningfulMatches.length >= 3;
        
      if (!hasValidKeywordCombo && matchingKeywords.length > 0) {
        // Track diagnostic info
        diagnosticInfo.rejectionReasons.genericFilter.push({
          videoTitle: v.title?.substring(0, 60),
          matchedKeywords: matchingKeywords,
          topicCount: topicMatches.length,
          entityCount: entityMatches.length,
          countryCount: countryMatches.length,
          personCount: personMatches.length,
          hasCountry: hasCountry,
          hasTopic: hasTopic
        });
        
        if (enableDebugForAll || isDebugIdea) {
          console.log(`     ❌ REJECTED by filter: No valid keyword combination`);
          console.log(`        Topics: ${topicMatches.length}, Entities: ${entityMatches.length}, Countries: ${countryMatches.length}, Persons: ${personMatches.length}`);
          console.log(`        Matched: ${matchingKeywords.join(', ')}`);
        }
        rejectionStats.genericFilter++;
        return false;
      }
      
      // Use keyword weighting system to validate match (with excluded names)
      const matchResult = calculateMatchScore(matchingKeywords, excludedNames);
      
      if (!matchResult.isValidMatch && matchingKeywords.length > 0) {
        // Track diagnostic info
        diagnosticInfo.rejectionReasons.matchScore.push({
          videoTitle: v.title?.substring(0, 60),
          matchedKeywords: matchingKeywords,
          matchScore: matchResult.score,
          concepts: matchResult.concepts?.length || 0,
          debug: matchResult.debug || 'Score too low'
        });
        
        if (enableDebugForAll || isDebugIdea) {
          console.log(`     ❌ REJECTED by match score: ${matchResult.debug || 'Score too low'}`);
          console.log(`        Matched keywords: ${matchingKeywords.join(', ')}`);
          console.log(`        Match score: ${matchResult.score}, Concepts: ${matchResult.concepts?.length || 0}`);
        }
        rejectionStats.matchScore++;
        return false;
      }
      
      // Topic coherence check: Ensure matched keywords are from the same domain
      const hasTopicCoherence = checkTopicCoherence(matchingKeywords, signalTitle, v.title || '', v.description || '');
      
      if (!hasTopicCoherence && matchingKeywords.length > 0) {
        // Track diagnostic info
        diagnosticInfo.rejectionReasons.topicCoherence.push({
          videoTitle: v.title?.substring(0, 60),
          matchedKeywords: matchingKeywords,
          signalTitle: signalTitle?.substring(0, 60),
          videoTitleFull: v.title
        });
        
        if (enableDebugForAll || isDebugIdea) {
          console.log(`     ❌ REJECTED by topic coherence: Keywords don't match same domain`);
          console.log(`        Matched keywords: ${matchingKeywords.join(', ')}`);
        }
        rejectionStats.topicCoherence++;
        return false;
      }
      
      // Final validation: Must pass generic filter, score check AND topic coherence
      const isValidMatch = hasValidKeywordCombo && matchResult.isValidMatch && hasTopicCoherence;
      
      // Track rejection reasons
      rejectionStats.totalChecked++;
      diagnosticInfo.videosChecked.push({
        videoTitle: v.title?.substring(0, 60),
        channelName: stats.channelName,
        type: stats.type,
        matchedKeywords: matchingKeywords,
        isValid: isValidMatch
      });
      
      if (isValidMatch) {
        rejectionStats.totalMatched++;
        // Calculate multiplier for diagnostic info (needed inside filter scope)
        const videoMultiplier = v.views && avgViews > 0 ? v.views / avgViews : 0;
        diagnosticInfo.matchesFound.push({
          videoTitle: v.title?.substring(0, 60),
          channelName: stats.channelName,
          type: stats.type,
          matchedKeywords: matchingKeywords,
          matchScore: matchResult.score,
          multiplier: videoMultiplier
        });
      }
      
      if (isValidMatch && (enableDebugForAll || isDebugIdea)) {
        console.log(`     ✅ MATCH FOUND: "${v.title?.substring(0, 50)}..."`);
        console.log(`        Matched keywords: ${matchingKeywords.join(', ')}`);
        console.log(`        Match score: ${matchResult.score}, Concepts: ${matchResult.concepts?.length || 0}`);
      }
      
      // DEBUG: Log matching for specific idea
      if (isDebugIdea && stats.channelName) {
        // Calculate daysAgo for this video
        const videoDate = v.published_at || v.publish_date;
        const videoDaysAgo = videoDate ? calculateDaysAgo(videoDate) : null;
        console.log(`   Checking "${stats.channelName}" (${stats.type}): "${v.title?.substring(0, 50)}..."`);
        console.log(`     Days ago: ${videoDaysAgo}, Views: ${v.views}, Avg: ${avgViews.toFixed(0)}`);
        console.log(`     Video description (first 100): "${(v.description || '').substring(0, 100)}"`);
        console.log(`     Video keywords (title + description):`, videoKeywords.slice(0, 10));
        console.log(`     Idea keywords:`, ideaKeywords.slice(0, 10));
        console.log(`     Matching keywords:`, matchingKeywords);
        console.log(`     🎯 Match analysis:`, {
          rawKeywords: matchingKeywords.length,
          concepts: matchResult.concepts,
          score: matchResult.score,
          isValid: matchResult.isValidMatch,
          hasTopicCoherence: hasTopicCoherence,
          debug: matchResult.debug
        });
        console.log(`     Match: ${isValidMatch ? '✅ YES' : '❌ NO'} (${matchResult.debug}${!hasTopicCoherence ? ' - FAILED topic coherence' : ''})`);
      }
      
      // Log topic coherence failures
      if (matchResult.isValidMatch && !hasTopicCoherence) {
        console.log(`     ⚠️ REJECTED: Topic coherence check failed`);
        console.log(`        Signal: "${signalTitle.substring(0, 60)}"`);
        console.log(`        Video: "${v.title?.substring(0, 60)}"`);
        console.log(`        Matched keywords: ${matchingKeywords.join(', ')}`);
      }

      // Use keyword weighting system - requires minimum score, high-value concepts, AND topic coherence
      return isValidMatch;
    });
    
    // Replace recentVideos with filtered results
    recentVideos = recentVideosFiltered;
    
    if (isDebugIdea && stats.channelName) {
      console.log(`   Result: ${recentVideos.length} matching videos out of ${stats.videos.length} total for "${stats.channelName}"`);
    }

    for (const video of recentVideos) {
      const multiplier = video.views && avgViews > 0 ? video.views / avgViews : 0;
      
      if (stats.type === 'trendsetter') {
        // For trendsetters, only include breakouts (5.0x+ average) - they post daily, need real trends
        const threshold = BREAKOUT_THRESHOLDS.trendsetter; // 5.0
        if (multiplier >= threshold) {
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
              averageViews: medianViews || avgViews || 0,
              multiplier: multiplier,
              publishedAt: videoDate,
              hoursAgo: hoursAgo,
            });
            
            // DEBUG: Log trendsetter breakout
            if (isDebugIdea) {
                console.log(`   ✅ Trendsetter BREAKOUT: "${stats.channelName}" - ${multiplier.toFixed(2)}x median (${video.views} views / ${medianViews.toFixed(0)} median)`);
            }
          } catch (error) {
            if (isDebugIdea) {
              console.log(`     ⚠️ SKIP: Topic intelligence error - ${error.message}`);
            }
            continue; // Skip this video on error
          }
        } else if (isDebugIdea) {
            console.log(`   ⚠️ Trendsetter NOT a breakout: "${stats.channelName}" - ${multiplier.toFixed(2)}x median (${video.views} views / ${medianViews.toFixed(0)} median) - SKIPPED`);
        }
      } else {
        // For direct/indirect, use type-specific thresholds
        const competitorType = stats.type; // 'direct' or 'indirect'
        const threshold = BREAKOUT_THRESHOLDS[competitorType] || BREAKOUT_THRESHOLDS.indirect; // 1.3 for direct, 1.5 for indirect
        const isBreakout = video.views && avgViews > 0 && (video.views / avgViews) >= threshold;
        
        if (!isBreakout) {
          continue; // Skip if doesn't meet threshold
        }
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
          averageViews: medianViews || avgViews,
          multiplier: video.views / (medianViews || avgViews), 
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

  // Log summary statistics if we checked videos but found no matches (for ALL signals)
  if (rejectionStats.totalChecked > 0 && directBreakouts.length === 0 && trendsetterVideos.length === 0 && indirectBreakouts.length === 0) {
    console.log(`\n📊 ===== COMPETITOR MATCHING DIAGNOSTICS =====`);
    console.log(`   Signal: "${signalTitle?.substring(0, 80)}"`);
    console.log(`   Videos checked: ${rejectionStats.totalChecked}`);
    console.log(`   Matches found: ${rejectionStats.totalMatched}`);
    console.log(`   Extracted keywords (${ideaKeywords.length}):`, ideaKeywords.slice(0, 15).join(', '));
    console.log(`\n   Rejections breakdown:`);
    console.log(`      - Semantic filter: ${rejectionStats.semanticFilter}`);
    console.log(`      - Generic filter: ${rejectionStats.genericFilter}`);
    console.log(`      - Match score: ${rejectionStats.matchScore}`);
    console.log(`      - Topic coherence: ${rejectionStats.topicCoherence}`);
    console.log(`      - Low weight: ${rejectionStats.lowWeight}`);
    console.log(`      - No keywords: ${rejectionStats.noKeywords}`);
    
    // Show sample rejections
    if (diagnosticInfo.rejectionReasons.genericFilter.length > 0) {
      console.log(`\n   📋 Sample generic filter rejections (${Math.min(3, diagnosticInfo.rejectionReasons.genericFilter.length)}):`);
      diagnosticInfo.rejectionReasons.genericFilter.slice(0, 3).forEach((rej, i) => {
        console.log(`      ${i + 1}. "${rej.videoTitle}"`);
        console.log(`         Matched: ${rej.matchedKeywords.join(', ')}`);
        console.log(`         Topics: ${rej.topicCount || 0}, Entities: ${rej.entityCount || 0}, Countries: ${rej.countryCount || 0}, Persons: ${rej.personCount || 0}`);
      });
    }
    
    if (diagnosticInfo.rejectionReasons.matchScore.length > 0) {
      console.log(`\n   📋 Sample match score rejections (${Math.min(3, diagnosticInfo.rejectionReasons.matchScore.length)}):`);
      diagnosticInfo.rejectionReasons.matchScore.slice(0, 3).forEach((rej, i) => {
        console.log(`      ${i + 1}. "${rej.videoTitle}"`);
        console.log(`         Matched: ${rej.matchedKeywords.join(', ')}`);
        console.log(`         Score: ${rej.matchScore}, Concepts: ${rej.concepts}, Reason: ${rej.debug}`);
      });
    }
    
    if (diagnosticInfo.rejectionReasons.topicCoherence.length > 0) {
      console.log(`\n   📋 Sample topic coherence rejections (${Math.min(3, diagnosticInfo.rejectionReasons.topicCoherence.length)}):`);
      diagnosticInfo.rejectionReasons.topicCoherence.slice(0, 3).forEach((rej, i) => {
        console.log(`      ${i + 1}. "${rej.videoTitle}"`);
        console.log(`         Matched: ${rej.matchedKeywords.join(', ')}`);
      });
    }
    
    // Show sample competitor videos that were checked
    if (diagnosticInfo.sampleVideoTitles.length > 0) {
      console.log(`\n   📹 Sample competitor videos checked (${diagnosticInfo.sampleVideoTitles.length}):`);
      diagnosticInfo.sampleVideoTitles.forEach((title, i) => {
        console.log(`      ${i + 1}. "${title?.substring(0, 60)}"`);
      });
    }
    
    // Recommendations
    console.log(`\n   💡 Recommendations:`);
    if (rejectionStats.genericFilter > rejectionStats.matchScore && rejectionStats.genericFilter > rejectionStats.topicCoherence) {
      console.log(`      - Most rejections due to generic keyword filter (${rejectionStats.genericFilter})`);
      console.log(`      - Consider: Relaxing generic filter OR improving keyword extraction`);
    } else if (rejectionStats.matchScore > rejectionStats.topicCoherence) {
      console.log(`      - Most rejections due to low match score (${rejectionStats.matchScore})`);
      console.log(`      - Consider: Adjusting keyword weights OR checking keyword extraction`);
    } else if (rejectionStats.topicCoherence > 0) {
      console.log(`      - Rejections due to topic coherence (${rejectionStats.topicCoherence})`);
      console.log(`      - Consider: Relaxing topic coherence check OR improving context matching`);
    }
    
    if (ideaKeywords.length < 3) {
      console.log(`      - ⚠️ Only ${ideaKeywords.length} keywords extracted - keyword extraction may be too strict`);
    }
    
    console.log(`===== END COMPETITOR MATCHING DIAGNOSTICS =====\n`);
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
  
  // Extract topic keywords for validation (same as findCompetitorBreakout)
  const topicKeywords = extractTopicKeywords(signalTitle);
  
  // DIAGNOSTIC: Track matching info for signals with 0 competitors
  const countDiagnostic = {
    signalTitle: signalTitle?.substring(0, 100),
    totalVideos: competitorVideos?.length || 0,
    videosInDateRange: 0,
    videosChecked: 0,
    matchesFound: 0,
    rejectionReasons: {
      noKeywords: 0,
      genericFilter: 0,
      lowWeight: 0
    }
  };
  
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
      details: [],
      diagnostic: countDiagnostic
    };
  }

  const keywords = extractKeywords(signalTitle);
  
  // Track if we have very few keywords
  if (keywords.length < 3) {
    countDiagnostic.lowKeywordCount = keywords.length;
  }
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
    if (daysAgo > days) {
      continue; // Skip videos outside date range
    }
    countDiagnostic.videosInDateRange++;

    // Extract keywords from title + description for better matching
    const titleKeywords = extractKeywords(video.title || '');
    const descKeywords = extractKeywords((video.description || '').substring(0, 200));
    const videoKeywords = [...new Set([...titleKeywords, ...descKeywords])];
    
    // Check if any keywords match signal (with context-aware filtering)
    // Only count keywords with sufficient weight (weight >= 4)
    const matchingKeywords = keywords.filter(kw => {
      const normalizedKw = normalizeArabicText(kw).toLowerCase();
      
      // Step 1: Check if keyword exists in video
      const found = videoKeywords.some(vk => {
        const normalizedVk = normalizeArabicText(vk).toLowerCase();
        return normalizedVk.includes(normalizedKw) || normalizedKw.includes(normalizedVk);
      });
      
      if (!found || normalizedKw.length <= 1) return false;
      
      // Step 2: Only allow keywords with sufficient weight (weight >= 4)
      const weight = getKeywordWeight(kw);
      if (weight < 4) {
        // Low-weight keywords are filtered out (replaces manual exclude lists)
        // Track this for diagnostics (but don't count as rejection since it's filtered before matching)
        return false;
      }
      
      // Step 3: Context validation
      return isKeywordInValidContext(kw, signalTitle, video.title || '', video.description || '');
    });
    
    // STOPWORDS: These are truly generic and should not count as matches alone
    const STOPWORDS = new Set([
        'news', 'أخبار', 'report', 'تقرير', 'update', 'تحديث',
        'video', 'فيديو', 'watch', 'شاهد', 'breaking', 'عاجل',
        'latest', 'جديد', 'today', 'اليوم', 'now', 'الآن',
        'says', 'قال', 'new', 'world', 'عالم', 'global', 'عالمي'
      ]);
      
      // ENTITY KEYWORDS: Leaders that need context
      const ENTITY_KEYWORDS = new Set([
        'trump', 'ترامب', 'biden', 'بايدن', 'putin', 'بوتين',
        'china', 'الصين', 'usa', 'امريكا', 'america',
        'president', 'رئيس', 'government', 'حكومة'
      ]);
      
      // TOPIC KEYWORDS: Core channel topics - NOT generic!
      const TOPIC_KEYWORDS = new Set([
        'oil', 'نفط', 'النفط', 'petroleum', 'crude', 'بترول',
        'gas', 'غاز', 'lng',
        'economy', 'اقتصاد', 'economic', 'اقتصادي',
        'market', 'سوق', 'أسواق', 'markets',
        'tariff', 'tariffs', 'رسوم', 'جمارك', 'تعريفة',
        'sanctions', 'عقوبات',
        'dollar', 'دولار', 'currency', 'عملة',
        'inflation', 'تضخم', 'recession', 'ركود',
        'stocks', 'أسهم', 'bonds', 'سندات',
        'gold', 'ذهب', 'bitcoin', 'بيتكوين',
        'fed', 'فيدرالي', 'federal reserve', 'الفيدرالي',
        'opec', 'أوبك', 'brics', 'بريكس',
        'war', 'حرب', 'conflict', 'صراع', 'military', 'عسكري'
      ]);
  
      // Country names
      const COUNTRY_KEYWORDS = new Set([
        'venezuela', 'فنزويلا', 'iran', 'إيران', 'ukraine', 'أوكرانيا', 
        'russia', 'روسيا', 'saudi', 'السعودية', 'egypt', 'مصر', 
        'uae', 'الإمارات', 'syria', 'سوريا', 'yemen', 'اليمن', 
        'iraq', 'العراق', 'lebanon', 'لبنان', 'israel', 'إسرائيل',
        'palestine', 'فلسطين', 'qatar', 'قطر', 'kuwait', 'الكويت',
        'jordan', 'الأردن', 'tunisia', 'تونس', 'algeria', 'الجزائر',
        'libya', 'ليبيا', 'sudan', 'السودان', 'morocco', 'المغرب',
        'pakistan', 'باكستان', 'turkey', 'تركيا', 'india', 'الهند',
        'afghanistan', 'أفغانستان', 'greenland', 'غرينلاند',
        'taiwan', 'تايوان', 'japan', 'اليابان', 'germany', 'ألمانيا',
        'france', 'فرنسا', 'uk', 'britain', 'بريطانيا', 'canada', 'كندا',
        'europe', 'أوروبا', 'mexico', 'المكسيك'
      ]);
  
      // Person names
      const PERSON_KEYWORDS = new Set([
        'trump', 'ترامب', 'biden', 'بايدن', 'putin', 'بوتين', 'maduro', 'مادورو',
        'netanyahu', 'نتنياهو', 'mbs', 'محمد بن سلمان', 'sisi', 'السيسي',
        'xi', 'شي', 'jinping', 'macron', 'ماكرون', 'scholz', 'شولتز',
        'zelensky', 'زيلينسكي', 'khamenei', 'خامنئي', 'erdogan', 'أردوغان'
      ]);
  
      // Categorize matched keywords
      const stopwordMatches = matchingKeywords.filter(k => {
        const normalized = normalizeArabicText(k).toLowerCase();
        return STOPWORDS.has(normalized);
      });
      const entityMatches = matchingKeywords.filter(k => {
        const normalized = normalizeArabicText(k).toLowerCase();
        return ENTITY_KEYWORDS.has(normalized);
      });
      const topicMatches = matchingKeywords.filter(k => {
        const normalized = normalizeArabicText(k).toLowerCase();
        return TOPIC_KEYWORDS.has(normalized);
      });
      const countryMatches = matchingKeywords.filter(k => {
        const normalized = normalizeArabicText(k).toLowerCase();
        return COUNTRY_KEYWORDS.has(normalized);
      });
      const personMatches = matchingKeywords.filter(k => {
        const normalized = normalizeArabicText(k).toLowerCase();
        return PERSON_KEYWORDS.has(normalized);
      });
      const otherMatches = matchingKeywords.filter(k => {
        const normalized = normalizeArabicText(k).toLowerCase();
        return !STOPWORDS.has(normalized) && 
               !ENTITY_KEYWORDS.has(normalized) && 
               !TOPIC_KEYWORDS.has(normalized) &&
               !COUNTRY_KEYWORDS.has(normalized) &&
               !PERSON_KEYWORDS.has(normalized);
      });
      
      // Meaningful = topic + country + person + other (not stopwords, not just entities)
      const meaningfulMatches = [...topicMatches, ...countryMatches, ...personMatches, ...otherMatches];
      
      // Check flags
      const hasCountry = countryMatches.length > 0;
      const hasPerson = personMatches.length > 0;
      const hasEntity = entityMatches.length > 0;
      const hasTopic = topicMatches.length > 0;
      
      // SEMANTIC SIMILARITY BOOST (if available)
      // Check if video has similarity data from previous semantic check
      const hasHighSimilarity = video.similarity && video.similarity >= SIMILARITY_THRESHOLDS.SAME_STORY;
      const hasRelatedSimilarity = video.similarity && video.similarity >= SIMILARITY_THRESHOLDS.RELATED;
      
      // VALID MATCH RULES (with semantic boost):
      // STRICTER MATCHING: Require 2+ meaningful overlaps to confirm "same story"
      // Single entity matches (just "Trump") are NOT enough
      // BUT: High semantic similarity can override keyword requirements
      const hasValidKeywordCombo = 
        hasHighSimilarity ||                                      // High semantic similarity = auto-match
        // 2+ topic keywords (strong story overlap)
        topicMatches.length >= 2 ||
        // Related similarity + 1 topic keyword (semantic boost)
        (hasRelatedSimilarity && topicMatches.length >= 1) ||
        // 1 topic + 1 entity/country/person (topic + context)
        (topicMatches.length >= 1 && (hasEntity || hasCountry || hasPerson)) ||
        // Entity + Country (specific context)
        (hasEntity && hasCountry) ||
        // Person + Country (specific context)  
        (hasPerson && hasCountry) ||
        // Person + Topic (specific context)
        (hasPerson && hasTopic) ||
        // Country + Topic (specific context)
        (hasCountry && hasTopic) ||
        // 3+ meaningful keywords (strong overlap)
        meaningfulMatches.length >= 3;
      
      if (!hasValidKeywordCombo && matchingKeywords.length > 0) {
        countDiagnostic.rejectionReasons.genericFilter++;
        if (isDebugIdea || isDebugSignal) {
          console.log(`   ❌ REJECTED: No valid keyword combination`);
          console.log(`      Topics: ${topicMatches.length}, Entities: ${entityMatches.length}, Countries: ${countryMatches.length}`);
          console.log(`      Matched: ${matchingKeywords.join(', ')}`);
        }
        continue;
      }
      
      if (matchingKeywords.length === 0) {
        countDiagnostic.rejectionReasons.noKeywords++;
        continue;
      }
      
      // Topic coherence check
      const hasTopicCoherence = checkTopicCoherence(matchingKeywords, signalTitle, video.title || '', video.description || '');
      
      // Use keyword weighting system to validate match
      const matchResult = calculateMatchScore(matchingKeywords, excludedNames);
      
      // Final validation
      const isValidMatch = hasValidKeywordCombo && matchResult.isValidMatch && hasTopicCoherence;
    if (isDebugIdea && isValidMatch) {
      console.log(`   Video: "${video.title?.substring(0, 50)}..."`);
      const compType = video.competitor_type || video.competitorType || video.competitors?.competitor_type || video.competitors?.type || 'unknown';
      const compName = video.channel_name || video.channelName || video.competitors?.channel_name || video.competitors?.name || 'unknown';
      console.log(`     Type: ${compType}, Channel: ${compName}`);
      console.log(`     Days ago: ${daysAgo}`);
      console.log(`     Video description (first 100): "${(video.description || '').substring(0, 100)}"`);
      console.log(`     Video keywords (title + description):`, videoKeywords.slice(0, 10));
      console.log(`     Matching keywords:`, matchingKeywords);
      console.log(`     🎯 Match analysis:`, {
        rawKeywords: matchingKeywords.length,
        concepts: matchResult.concepts,
        score: matchResult.score,
        isValid: matchResult.isValidMatch,
        hasTopicCoherence: hasTopicCoherence,
        debug: matchResult.debug
      });
      console.log(`     Match: ${isValidMatch ? '✅ YES' : '❌ NO'} (${matchResult.debug}${!hasTopicCoherence ? ' - FAILED topic coherence' : ''})`);
    }
    
    // Log topic coherence failures for debugging
    if (isDebugIdea && matchResult.isValidMatch && !hasTopicCoherence) {
      console.log(`     ⚠️ REJECTED: Topic coherence check failed`);
      console.log(`        Signal: "${signalTitle.substring(0, 60)}"`);
      console.log(`        Video: "${video.title?.substring(0, 60)}"`);
      console.log(`        Matched keywords: ${matchingKeywords.join(', ')}`);
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
    // Also validate evidence for topic relevance (same as breakouts)
    if (isValidMatch) {
      // Validate evidence to ensure topic relevance
      const evidenceToValidate = {
        matchedKeywords: matchingKeywords,
        videoTitle: video.title || '',
        videoUrl: null, // Not needed for validation
        channelName: video.channel_name || video.channelName || video.competitors?.name || 'Unknown',
      };
      
      const validatedEvidence = validateEvidence(signalTitle, evidenceToValidate, topicKeywords);
      
      // Only count if evidence is validated (topic-relevant)
      if (!validatedEvidence) {
        if (isDebugIdea) {
          console.log(`   ⚠️ SKIP volume match: Not topic-relevant enough. Keywords: ${matchingKeywords.join(', ')}`);
        }
        countDiagnostic.rejectionReasons.genericFilter++;
        continue; // Skip this match - not topic-relevant
      }
      
      countDiagnostic.matchesFound++;
      const competitorId = video.competitor_id || video.competitors?.id;
      if (competitorId) {
        const competitorType = video.competitor_type || video.competitorType || video.competitors?.competitor_type || video.competitors?.type || 'indirect';
        const competitorName = video.channel_name || video.channelName || video.competitors?.channel_name || video.competitors?.name || 'Unknown';
        
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
          
           // Get video ID for caching
           const videoId = video.video_id || video.youtube_video_id || video.id;
          
           competitorDetails.push({
             id: competitorId,
             name: competitorName,
             type: competitorType,
             videoTitle: video.title || '',
             videoId: videoId,
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

  const result = {
    direct: directCompetitors.size,
    indirect: indirectCompetitors.size,
    trendsetter: trendsetterCompetitors.size,
    total: directCompetitors.size + indirectCompetitors.size + trendsetterCompetitors.size,
    details: competitorDetails
  };
  
  // Log diagnostics if no matches found (for ALL signals, not just debug ones)
  if (result.total === 0 && countDiagnostic.videosChecked > 0) {
    console.log(`\n📊 ===== COMPETITOR COUNT DIAGNOSTICS =====`);
    console.log(`   Signal: "${signalTitle?.substring(0, 80)}"`);
    console.log(`   Total videos: ${countDiagnostic.totalVideos}`);
    console.log(`   Videos in date range (last ${days} days): ${countDiagnostic.videosInDateRange}`);
    console.log(`   Videos checked: ${countDiagnostic.videosChecked}`);
    console.log(`   Matches found: ${countDiagnostic.matchesFound}`);
    console.log(`   Extracted keywords (${keywords.length}):`, keywords.slice(0, 15).join(', '));
    console.log(`\n   Rejections breakdown:`);
    console.log(`      - No keywords matched: ${countDiagnostic.rejectionReasons.noKeywords}`);
    console.log(`      - Generic filter: ${countDiagnostic.rejectionReasons.genericFilter}`);
    console.log(`      - Low weight: ${countDiagnostic.rejectionReasons.lowWeight}`);
    
    if (countDiagnostic.lowKeywordCount) {
      console.log(`\n   ⚠️ Only ${countDiagnostic.lowKeywordCount} keywords extracted - keyword extraction may be too strict`);
    }
    
    if (countDiagnostic.rejectionReasons.genericFilter > countDiagnostic.rejectionReasons.noKeywords) {
      console.log(`\n   💡 Most rejections due to generic keyword filter (${countDiagnostic.rejectionReasons.genericFilter})`);
      console.log(`      Consider: Relaxing generic filter OR improving keyword extraction`);
    } else if (countDiagnostic.rejectionReasons.noKeywords > 0) {
      console.log(`\n   💡 Most rejections due to no keyword matches (${countDiagnostic.rejectionReasons.noKeywords})`);
      console.log(`      Consider: Checking keyword extraction OR competitor video titles`);
    }
    
    console.log(`===== END COMPETITOR COUNT DIAGNOSTICS =====\n`);
  }
  
  return result;
}

/**
 * Filter DNA matches based on context gate rules
 * Topics with requires_context_gate=true only match if signal contains required keywords
 * This is universal - works for any show based on their topic_definitions settings
 * 
 * @param {string[]} matchedTopicIds - Array of matched topic IDs from findDnaMatch
 * @param {string} signalText - Combined title + description text
 * @param {Array} dnaTopics - Full topic objects from topic_definitions
 * @returns {string[]} - Filtered topic IDs
 */
function filterByContextGate(matchedTopicIds, signalText, dnaTopics) {
  if (!matchedTopicIds || matchedTopicIds.length === 0) {
    return matchedTopicIds;
  }

  const signalTextLower = (signalText || '').toLowerCase();

  const filtered = matchedTopicIds.filter(topicId => {
    // Find the full topic object
    const topic = dnaTopics.find(t => t.topic_id === topicId);
    
    // If topic not found or doesn't require gate, allow it
    if (!topic || !topic.requires_context_gate) {
      return true;
    }

    // Topic requires context gate - check for required keywords
    const gateKeywords = topic.context_gate_keywords || [];
    
    if (gateKeywords.length === 0) {
      // No keywords defined, allow the match
      return true;
    }

    // Check if signal contains ANY of the required keywords
    const hasRequiredContext = gateKeywords.some(keyword => 
      signalTextLower.includes(keyword.toLowerCase())
    );

    if (!hasRequiredContext) {
      console.log(`🚫 [Context Gate] Filtered out topic "${topicId}" - missing required context keywords`);
      return false;
    }

    return true;
  });

  return filtered;
}

/**
 * Find DNA match for signal
 */
function findDnaMatch(signalTopicId, signalTitle, dnaTopics, aiFingerprint = null) {
  const matches = [];
  const matchDetails = [];

  // Ensure dnaTopics is an array
  if (!Array.isArray(dnaTopics)) {
    console.warn('dnaTopics is not an array in findDnaMatch:', typeof dnaTopics);
    return matches;
  }
  
  // Debug logging - Always log for signals with AI fingerprint, or specific debug keywords
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
    signalTitle.toLowerCase().includes('دولار') ||
    signalTitle.toLowerCase().includes('credit card') ||
    signalTitle.toLowerCase().includes('trump') ||
    signalTitle.toLowerCase().includes('iran') ||
    signalTitle.toLowerCase().includes('إيران') ||
    signalTitle.toLowerCase().includes('ayatollah') ||
    signalTitle.toLowerCase().includes('brutal')
  );
  
  // Always log if we have AI fingerprint (to debug why it's not working)
  const shouldLog = isDebugSignal || aiFingerprint?.entities;
  
  if (shouldLog) {
    console.log(`\n🧬 findDnaMatch called for: "${signalTitle?.substring(0, 50)}..."`);
    console.log(`   aiFingerprint received: ${aiFingerprint ? 'YES' : 'NO'}`);
    if (aiFingerprint?.entities) {
      console.log(`   AI entities:`, JSON.stringify({
        countries: aiFingerprint.entities.countries || [],
        topics: aiFingerprint.entities.topics || [],
        organizations: aiFingerprint.entities.organizations || [],
        people: (aiFingerprint.entities.people || []).slice(0, 3)
      }));
    } else {
      console.log(`   ⚠️ No AI fingerprint entities found`);
      if (aiFingerprint) {
        console.log(`   aiFingerprint keys:`, Object.keys(aiFingerprint));
      }
    }
    console.log(`   DNA topics checked: ${dnaTopics?.length || 0}`);
  }
  
  // ===========================================
  // STEP 1: AI FINGERPRINT MATCHING (PREFERRED)
  // ===========================================
  // Define AI entity arrays at the start (for logging/debugging even if no fingerprint)
  const entities = aiFingerprint?.entities || {};
  const aiCountries = (entities.countries || []).filter(Boolean);
  const aiTopics = (entities.topics || []).filter(Boolean);
  const aiPeople = (entities.people || []).filter(Boolean);
  const aiOrganizations = (entities.organizations || []).filter(Boolean);
  
  // If we have AI fingerprint, use it for smarter matching
  if (aiFingerprint?.entities) {
    if (shouldLog) {
      console.log(`   🤖 Running AI fingerprint matching...`);
    }
    
    // Generic words that shouldn't trigger DNA matches by themselves
    const GENERIC_AI_TERMS = new Set([
      // English generic terms
      'war', 'economy', 'economics', 'economic', 'government', 'politics', 'political',
      'business', 'trade', 'market', 'markets', 'finance', 'financial', 'money',
      'news', 'report', 'analysis', 'update', 'crisis', 'conflict', 'issue',
      'policy', 'industry', 'sector', 'growth', 'decline', 'rise', 'fall',
      'president', 'leader', 'official', 'minister', 'company', 'country',
      'jobs', 'employment', 'unemployment', 'job', // Too generic for matching
      // Arabic generic terms
      'حرب', 'اقتصاد', 'سياسة', 'تجارة', 'سوق', 'أزمة', 'حكومة', 'رئيس',
      'شركة', 'دولة', 'وزير', 'مال', 'نمو', 'تراجع', 'ارتفاع', 'انخفاض'
    ]);
    
    // Filter out undefined/null values and generic terms ONCE before loops
    const filteredTopics = (aiFingerprint.entities.topics || [])
      .filter(Boolean)
      .filter(t => {
        if (!t || typeof t !== 'string') return false;
        const tLower = t.toLowerCase();
        if (GENERIC_AI_TERMS.has(tLower)) {
          if (shouldLog) {
            console.log(`   ⚠️ Skipping generic AI topic: "${t}"`);
          }
          return false;
        }
        return true;
      })
      .map(t => t.toLowerCase());
    
    const filteredCountries = (aiFingerprint.entities.countries || [])
      .filter(Boolean)
      .filter(c => {
        if (!c || typeof c !== 'string') return false;
        const cLower = c.toLowerCase();
        if (GENERIC_AI_TERMS.has(cLower)) {
          if (shouldLog) {
            console.log(`   ⚠️ Skipping generic AI country: "${c}"`);
          }
          return false;
        }
        return true;
      })
      .map(c => c.toLowerCase());
    
    const filteredOrganizations = (aiFingerprint.entities.organizations || [])
      .filter(Boolean)
      .filter(o => o && typeof o === 'string')
      .map(o => o.toLowerCase());
    
    const filteredPeople = (aiFingerprint.entities.people || [])
      .filter(Boolean)
      .filter(p => p && typeof p === 'string')
      .map(p => p.toLowerCase());
    
    if (shouldLog) {
      console.log(`   🤖 AI-extracted entities (filtered):`, {
        topics: filteredTopics,
        countries: filteredCountries,
        organizations: filteredOrganizations.slice(0, 5),
        people: filteredPeople.slice(0, 3)
      });
    }
    
    // Match AI-extracted entities against DNA topic keywords
    for (const dnaTopic of dnaTopics) {
      if (!dnaTopic) continue;
      
      // Handle different DNA topic structures
      let dnaTopicId = null;
      let topicKeywords = [];
      let topicDisplayName = '';
      
      if (typeof dnaTopic === 'string') {
        dnaTopicId = dnaTopic;
        topicDisplayName = dnaTopic;
      } else if (typeof dnaTopic === 'object') {
        dnaTopicId = dnaTopic.topic_id || dnaTopic.topicId || dnaTopic.id || dnaTopic.topic;
        topicDisplayName = dnaTopic.topic_name_en || dnaTopic.name || dnaTopic.topic_name || dnaTopicId || 'unknown';
        
        // Extract keywords from DNA topic (use allKeywords if available from unified service)
        if (Array.isArray(dnaTopic.allKeywords)) {
          topicKeywords = dnaTopic.allKeywords.map(k => typeof k === 'string' ? k.toLowerCase().trim() : String(k).toLowerCase().trim());
        } else if (Array.isArray(dnaTopic.keywords)) {
          topicKeywords = dnaTopic.keywords.map(k => typeof k === 'string' ? k.toLowerCase().trim() : String(k).toLowerCase().trim());
        } else if (dnaTopic.keywords && typeof dnaTopic.keywords === 'string') {
          topicKeywords = [dnaTopic.keywords.toLowerCase().trim()];
        } else if (dnaTopic.keywords && typeof dnaTopic.keywords === 'object') {
          topicKeywords = Object.values(dnaTopic.keywords)
            .filter(k => typeof k === 'string')
            .map(k => k.toLowerCase().trim());
        }
        
        // Also check topic name
        const topicName = dnaTopic.name || dnaTopic.topic_name || dnaTopic.topic_name_en || dnaTopic.label_en || '';
        if (topicName && typeof topicName === 'string' && topicName.length > 2) {
          topicKeywords.push(topicName.toLowerCase().trim());
        }
      }
      
      if (!dnaTopicId || topicKeywords.length === 0) continue;
      
      // Check if AI-extracted entities match DNA keywords
      let matchedBy = [];
      
      // Check topics (already filtered for generic terms)
      for (const aiTopic of filteredTopics) {
        if (topicKeywords.some(kw => kw && typeof kw === 'string' && (kw === aiTopic || kw.includes(aiTopic) || aiTopic.includes(kw)))) {
          matchedBy.push({ type: 'ai_topic', value: aiTopic });
        }
      }
      
      // Check countries (with normalization for variations)
      for (const aiCountry of filteredCountries) {
        // Normalize country name for matching (handle variations)
        const normalizedAiCountry = aiCountry
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        
        // Check exact match, substring match, or if DNA keyword contains country name
        const matched = topicKeywords.some(kw => {
          if (!kw || typeof kw !== 'string') return false;
          const normalizedKw = kw.toLowerCase().trim();
          
          // Exact match
          if (normalizedKw === normalizedAiCountry) return true;
          
          // Substring match (e.g., "iran" matches "iran_oil_sanctions")
          if (normalizedKw.includes(normalizedAiCountry) || normalizedAiCountry.includes(normalizedKw)) return true;
          
          // Handle common country name variations
          const countryVariations = {
            'iran': ['إيران', 'ايران', 'persia', 'persian'],
            'usa': ['united states', 'america', 'us', 'أمريكا', 'امريكا'],
            'uk': ['united kingdom', 'britain', 'british', 'بريطانيا'],
            'russia': ['روسيا', 'russian', 'soviet'],
            'china': ['الصين', 'chinese'],
            'saudi arabia': ['السعودية', 'saudi'],
            'egypt': ['مصر'],
            'uae': ['الإمارات', 'emirates', 'united arab emirates'],
          };
          
          // Check if this country has known variations
          for (const [baseName, variations] of Object.entries(countryVariations)) {
            if (normalizedAiCountry.includes(baseName) || baseName.includes(normalizedAiCountry)) {
              // Check if DNA keyword matches any variation
              if (variations.some(v => normalizedKw.includes(v.toLowerCase()) || v.toLowerCase().includes(normalizedKw))) {
                return true;
              }
            }
          }
          
          return false;
        });
        
        if (matched) {
          matchedBy.push({ type: 'ai_country', value: aiCountry });
          
          if (shouldLog) {
            const matchedKw = topicKeywords.find(kw => {
              if (!kw || typeof kw !== 'string') return false;
              const normalizedKw = kw.toLowerCase().trim();
              return normalizedKw === normalizedAiCountry || 
                     normalizedKw.includes(normalizedAiCountry) || 
                     normalizedAiCountry.includes(normalizedKw);
            });
            console.log(`      ✅ Matched AI country "${aiCountry}" with DNA keyword "${matchedKw}"`);
          }
        } else if (shouldLog && (dnaTopicId.toLowerCase().includes('iran') || topicDisplayName.toLowerCase().includes('iran'))) {
          // Debug logging for Iran specifically
          console.log(`      ❌ AI country "${aiCountry}" did NOT match DNA topic "${dnaTopicId}" (${topicDisplayName})`);
          console.log(`         DNA keywords:`, topicKeywords);
          console.log(`         Normalized AI country: "${normalizedAiCountry}"`);
        }
      }
      
      // Check organizations (already filtered for undefined)
      for (const aiOrg of filteredOrganizations) {
        if (topicKeywords.some(kw => kw && typeof kw === 'string' && (kw === aiOrg || kw.includes(aiOrg) || aiOrg.includes(kw)))) {
          matchedBy.push({ type: 'ai_org', value: aiOrg });
        }
      }
      
      // Check people (lower weight, but still count) (already filtered for undefined)
      for (const aiPerson of filteredPeople) {
        if (topicKeywords.some(kw => kw && typeof kw === 'string' && (kw === aiPerson || kw.includes(aiPerson) || aiPerson.includes(kw)))) {
          matchedBy.push({ type: 'ai_person', value: aiPerson });
        }
      }
      
      // Require at least 1 AI-extracted entity to match DNA keywords
      if (matchedBy.length >= 1) {
        if (!matches.includes(dnaTopicId)) {
          matches.push(dnaTopicId);
          matchDetails.push({
            topic_id: dnaTopicId,
            topic_name: dnaTopic.name || dnaTopic.topic_name_en || dnaTopic.topic_name || dnaTopicId,
            matchedBy,
            matchType: 'ai_fingerprint'
          });
          
          if (shouldLog) {
            // Use the actual entity type instead of always saying "AI country"
            const firstMatch = matchedBy[0];
            const entityType = firstMatch?.type?.replace('ai_', '') || 'entity';
            const entityValue = firstMatch?.value || 'unknown';
            console.log(`   ✅ AI ${entityType} "${entityValue}" matched DNA topic "${dnaTopicId}" (${topicDisplayName})`);
            console.log(`      Matched by:`, matchedBy);
            console.log(`      DNA topic keywords:`, topicKeywords.slice(0, 5));
          }
        }
      } else if (shouldLog && (aiCountries.length > 0 || aiTopics.length > 0)) {
        // Log why it didn't match (for debugging)
        const topicName = dnaTopic.name || dnaTopic.topic_name_en || dnaTopic.topic_name || dnaTopicId;
        if (topicName.toLowerCase().includes('iran') || dnaTopicId.toLowerCase().includes('iran')) {
          console.log(`   ❌ No match for DNA topic "${dnaTopicId}" (${topicName})`);
          console.log(`      AI countries:`, aiCountries);
          console.log(`      DNA keywords:`, topicKeywords.slice(0, 10));
          if (aiCountries.length > 0) {
            console.log(`      Checking if "${aiCountries[0]}" matches any of:`, topicKeywords.slice(0, 5));
          }
        }
      }
    }
    
    // If AI matching found results, return them (skip loose keyword matching)
    if (matches.length > 0) {
      if (shouldLog) {
        console.log(`   ✅ DNA matches found via AI: ${matches.join(', ')}`);
        console.log(`===== END DEBUG findDnaMatch =====\n`);
      }
      return matches; // Return array for backward compatibility
    }
    
    if (shouldLog) {
      console.log(`   ⚠️ No AI fingerprint matches, falling back to keyword matching`);
      console.log(`      AI had ${aiCountries.length} countries, ${aiTopics.length} topics, but none matched DNA keywords`);
    }
  } else if (shouldLog) {
    console.log(`   ⚠️ No AI fingerprint provided, falling back to keyword matching`);
  }

  // ===========================================
  // STEP 2: KEYWORD FALLBACK (STRICTER)
  // ===========================================
  // Only used if AI fingerprint didn't match
  // Requires: 2+ keywords with weight >= 4
  const MIN_KEYWORDS_FOR_MATCH = 2;
  const MIN_KEYWORD_WEIGHT = 4;

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
      
      // STRICTER: Require 2+ keywords with weight >= 6 for match
      // This prevents false matches from single generic keywords
      const matchedKeywords = [];
      
      for (const keyword of topicKeywords) {
        if (typeof keyword !== 'string') continue;
        
        const keywordLower = keyword.toLowerCase().trim();
        if (keywordLower.length < 2) continue;
        
        // Skip very short keywords that are too generic
        if (keywordLower.length < 3 && !['ai', 'us', 'uk'].includes(keywordLower)) continue;
        
        // Check keyword weight - only count high-value keywords (weight >= 4)
        const MIN_KEYWORD_WEIGHT = 4;  // Lowered from 6 to allow more keywords
        const weight = getKeywordWeight(keywordLower);
        if (weight < MIN_KEYWORD_WEIGHT) {
          if (isDebugSignal) {
            console.log(`   ⚠️ Skipping low-weight keyword "${keywordLower}" (weight: ${weight} < ${MIN_KEYWORD_WEIGHT})`);
          }
          continue; // Skip generic/low-value keywords
        }
        
        // Check if keyword matches signal keywords
        const isKeywordMatch = signalKeywords.some(sk => {
          const skLower = normalizeArabicText(sk).toLowerCase();
          
          // For very short keywords (2 chars), require exact match only
          if (keywordLower.length === 2) {
            return skLower === keywordLower;
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
          matchedKeywords.push({
            keyword: keywordLower,
            weight: weight
          });
        }
      }
      
      // Only count as match if 2+ high-value keywords matched
      if (matchedKeywords.length >= MIN_KEYWORDS_FOR_MATCH) {
        const topicIdToAdd = dnaTopicId || dnaTopic?.topic_id || dnaTopic?.topicId || dnaTopic?.id;
        if (topicIdToAdd && !matches.includes(topicIdToAdd)) {
          matches.push(topicIdToAdd);
          matchDetails.push({
            topic_id: topicIdToAdd,
            topic_name: dnaTopic?.name || dnaTopic?.topic_name_en || dnaTopic?.topic_name || topicIdToAdd,
            matchedKeywords: matchedKeywords.map(m => m.keyword),
            matchType: 'keyword_fallback',
            keywordCount: matchedKeywords.length
          });
          
          if (isDebugSignal) {
            console.log(`   ✅ DNA match (keyword fallback): ${matchedKeywords.length} keywords matched → topic "${topicIdToAdd}"`);
            console.log(`      Matched keywords:`, matchedKeywords.map(m => `${m.keyword} (weight: ${m.weight})`).join(', '));
          }
        }
      } else if (isDebugSignal && matchedKeywords.length > 0) {
        console.log(`   ❌ Topic "${dnaTopicId}": Only ${matchedKeywords.length} keyword(s) matched (need ${MIN_KEYWORDS_FOR_MATCH}+)`);
      } else if (isDebugSignal) {
        console.log(`   ❌ Topic "${dnaTopicId}": No keywords matched (weight >= ${MIN_KEYWORD_WEIGHT})`);
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
    // Arabic stop words - ORIGINAL forms (with hamza/special chars)
    'في', 'من', 'إلى', 'على', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك',
    'التي', 'الذي', 'اللذان', 'اللتان', 'الذين', 'اللاتي', 'اللواتي',
    'هو', 'هي', 'هم', 'هن', 'نحن', 'أنا', 'أنت', 'أنتم', 'أنتن',
    'كان', 'كانت', 'كانوا', 'يكون', 'تكون', 'أن', 'إن', 'لن', 'لم',
    'ما', 'لا', 'بل', 'حتى', 'إذا', 'إذ', 'لو', 'أو', 'و', 'ف', 'ب', 'ل', 'ك',
    'قد', 'ثم', 'أي', 'كل', 'بعض', 'غير', 'بين', 'فوق', 'تحت', 'أمام', 'خلف',
    'عند', 'منذ', 'حول', 'ضد', 'بدون', 'خلال', 'بعد', 'قبل',
    'يقول', 'قال', 'قالت', 'يعلن', 'أعلن', 'أعلنت',
    'ما', 'كيف', 'لماذا', 'هل', 'ماذا', 'متى', 'أين', 'حيث',
    'الجديد', 'جديدة', 'جديد', 'نحو', 'أثناء',
    'بعض', 'فقط', 'أكثر', 'أقل', 'جدا', 'أيضا', 'الآن',
    'اليوم', 'أمس', 'غدا', 'أسبوع', 'شهر', 'سنة', 'عام',
    'يكون', 'تكون', 'ذهب', 'ذهبت', 'يذهب', 'تذهب',
    'جاء', 'جاءت', 'يأتي', 'تأتي', 'أعطى', 'أعطت', 'يعطي', 'تعطي',
    'أخذ', 'أخذت', 'يأخذ', 'تأخذ',
    // Arabic stop words - NORMALIZED forms (without hamza, normalized alef/ya)
    'الى', 'الي', 'على', 'عن', 'هذا', 'هذه', 'ذلك', 'انا', 'انت', 'انتم',
    'ان', 'لان', 'اذا', 'اذ', 'او', 'اي', 'كانو',
    // Common Arabic prepositions that get extracted incorrectly
    'الذى', 'التى', 'اللى', 'دى', 'ده', 'كده', 'ازاى', 'ليه', 'فين', 'امتى'
  ]);

  // Source/publication names to exclude from keyword extraction
  const SOURCE_NAMES = new Set([
    // English sources
    'business', 'insider', 'reuters', 'bloomberg', 'economist', 'journal',
    'times', 'post', 'guardian', 'cnn', 'bbc', 'fox', 'nbc', 'abc', 'cbs',
    'politico', 'axios', 'verge', 'wired', 'techcrunch', 'engadget',
    'associated', 'press', 'ap', 'afp', 'daily', 'mail', 'telegraph',
    'independent', 'mirror', 'sun', 'express', 'herald', 'tribune',
    'chronicle', 'dispatch', 'gazette', 'observer', 'examiner',
    'supercarblondie', 'supercarblon', 'wsj', 'wall', 'street',
    
    // Arabic sources (transliterated and Arabic)
    'العربية', 'الجزيرة', 'الشرق', 'سكاي', 'روسيا', 'فرانس',
    'arabiya', 'jazeera', 'sharq', 'sky', 'france24', 'france',
    
    // Generic media words
    'news', 'report', 'reports', 'reported', 'reporting',
    'media', 'press', 'wire', 'service', 'network', 'channel',
  ]);
  
  // Words to always exclude (URL parts, common substrings)
  const ALWAYS_EXCLUDE = new Set([
    'com', 'org', 'net', 'www', 'http', 'https', 'html', 'php',
    'using', 'used', 'uses', 'use',
    'says', 'said', 'saying',
    'new', 'old', 'first', 'last',
    'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'from',
    // Source names
    'business', 'insider', 'reuters', 'bloomberg', 'economist', 'journal',
    'times', 'post', 'guardian', 'cnn', 'bbc', 'fox', 'politico', 'axios',
    'supercarblondie', 'supercarblon', 'wsj', 'wall', 'street',
    // Generic words that cause false matches
    'rewards', 'reward', 'warns', 'warned', 'warning',
    'calls', 'called', 'calling',
    'faces', 'facing', 'faced',
    'backs', 'backed', 'backing',
  ]);
  
  // Extract base keywords
  // Filter function - normalize BEFORE checking stopwords
  const isValidKeyword = (word) => {
    if (!word || word.length < 2) return false;
    
    // Normalize the word first
    const normalizedWord = normalizeArabicText(word).toLowerCase().trim();
    
    // NEW: Filter out source/publication names
    if (SOURCE_NAMES.has(normalizedWord)) return false;
    
    // Check against always-exclude list
    if (ALWAYS_EXCLUDE.has(normalizedWord)) return false;
    
    // Check against stopwords using normalized form
    if (stopWords.has(normalizedWord)) return false;
    // Also check original form (in case it's already normalized)
    if (stopWords.has(word.toLowerCase().trim())) return false;
    
    // Filter out pure numbers
    if (/^\d+$/.test(normalizedWord)) return false;
    
    // Filter out very short words (likely noise)
    if (normalizedWord.length < 2) return false;
    
    return true;
  };
  
  const baseKeywords = normalizedText
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ') // Keep Arabic and English letters
    .split(/\s+/)
    .filter(isValidKeyword);
  
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
    if (!matchedKw) return false;
    const normalizedMatched = normalizeArabicText(matchedKw || '').toLowerCase();
    return topicKeywords.some(topicKw => {
      if (!topicKw || typeof topicKw !== 'string') return false;
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
  // IMPORTANT: Preserve ALL original evidence fields including hoursAgo, publishedAt, etc.
  return {
    ...evidence,
    topicKeywordMatches: topicKeywordMatches.slice(0, 5), // Store which topic keywords matched
    // Explicitly preserve critical timing fields
    hoursAgo: evidence.hoursAgo,
    publishedAt: evidence.publishedAt,
    videoPublishedAt: evidence.videoPublishedAt,
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
 * Check if keyword is in valid context (not a false positive)
 * Filters out matches on generic words or words in wrong context
 */
function isKeywordInValidContext(keyword, signalTitle, videoTitle, videoDescription) {
  const kw = normalizeArabicText(keyword).toLowerCase();
  const signalText = normalizeArabicText(signalTitle + ' ' + videoTitle + ' ' + videoDescription).toLowerCase();
  
  // Filter out generic words that shouldn't match
  const genericWords = new Set([
    // English generic words
    'rewards', 'reward', 'about', 'says', 'said', 'week', 'weeks', 'day', 'days',
    'new', 'news', 'latest', 'update', 'updates', 'will', 'could', 'would', 'may',
    'first', 'last', 'big', 'small', 'high', 'low', 'good', 'bad', 'old', 'year', 'years',
    'time', 'way', 'part', 'world', 'month',
    // Arabic prepositions and generic words (normalized forms)
    'الى', 'الي', 'إلى', 'على', 'عن', 'من', 'في', 'مع', 'بين',
    'هذا', 'هذه', 'ذلك', 'تلك', 'هنا', 'هناك',
    'كان', 'كانت', 'يكون', 'تكون',
    'قال', 'قالت', 'يقول', 'تقول',
    'أن', 'ان', 'إن', 'لن', 'لم', 'لا', 'ما',
    'كل', 'بعض', 'أي', 'اي', 'غير',
    'جديد', 'جديده', 'كبير', 'كبيره', 'صغير', 'اول', 'آخر',
    'عام', 'سنه', 'سنوات', 'يوم', 'ايام', 'شهر', 'اسبوع',
    'مكافأة', 'مكافآت'
  ]);
  
  // Check normalized form against generic words
  const normalizedKw = normalizeArabicText(kw).toLowerCase();
  if (genericWords.has(normalizedKw) || genericWords.has(kw.toLowerCase())) {
    // Only allow if it's in a specific context (e.g., "credit card rewards" is OK, but not just "rewards")
    const hasContext = signalText.includes('credit') || signalText.includes('card') || 
                       signalText.includes('credit card') || signalText.includes('بطاقة');
    return hasContext;
  }
  
  // Context-aware matching for "war" - only match if it's about actual war, not job titles
  if (kw === 'war' || kw === 'حرب' || kw === 'الحرب') {
    // Normalize video title for checking
    const normalizedVideoTitle = normalizeArabicText(videoTitle).toLowerCase();
    
    // Check if "war" appears in a job title context (وزير الحرب = Minister of War)
    const jobTitlePatterns = [
      'وزير الحرب', 'minister of war', 'وزير الدفاع', 'minister of defense',
      'secretary of defense', 'secretary of war', 'وزير', 'minister', 'secretary'
    ];
    
    const isJobTitle = jobTitlePatterns.some(pattern => {
      const normalizedPattern = normalizeArabicText(pattern).toLowerCase();
      return signalText.includes(normalizedPattern) || normalizedVideoTitle.includes(normalizedPattern);
    });
    
    if (isJobTitle) {
      // Only match if there are other war-related keywords (actual war topic)
      const warKeywords = ['conflict', 'صراع', 'invasion', 'غزو', 'attack', 'هجوم', 'military', 'عسكري', 'battle', 'معركة'];
      const hasWarContext = warKeywords.some(wk => {
        const normalizedWarKw = normalizeArabicText(wk).toLowerCase();
        return signalText.includes(normalizedWarKw);
      });
      return hasWarContext; // Only match if it's about actual war, not just a job title
    }
  }
  
  return true; // Default: allow the match
}

/**
 * Check topic coherence - ensure matched keywords are from the same domain
 * Prevents false matches like "Trump credit card" matching "Trump defense secretary"
 */
function checkTopicCoherence(matchingKeywords, signalTitle, videoTitle, videoDescription) {
  if (!matchingKeywords || matchingKeywords.length === 0) return false;
  
  // Define topic domains
  const topicDomains = {
    finance: ['credit', 'card', 'rewards', 'debt', 'borrower', 'loan', 'interest', 'rate', 'bank', 'financial', 'اقتصاد', 'مالي', 'قرض', 'دين'],
    military: ['defense', 'secretary', 'minister', 'war', 'military', 'troops', 'army', 'دفاع', 'وزير', 'حرب', 'عسكري', 'جيش', 'قسد', 'sdf', 'قوات', 'سلاح'],
    economy: ['economy', 'economic', 'gdp', 'inflation', 'unemployment', 'اقتصاد', 'اقتصادي', 'تضخم'],
    energy: ['oil', 'gas', 'energy', 'petroleum', 'نفط', 'غاز', 'طاقة', 'lng', 'crude', 'بترول'],
    energy_economics: ['oil price', 'demand', 'supply', 'opec', 'أوبك', 'iea', 'وكالة الطاقة', 'الطلب', 'العرض', 'أسعار النفط', 'barrel', 'برميل', 'forecast', 'توقعات'],
    energy_geopolitics: ['oil field', 'pipeline', 'حقول', 'حقول النفط', 'خط أنابيب', 'control', 'سيطرة', 'قسد', 'sdf'],
    politics: ['president', 'election', 'policy', 'government', 'رئيس', 'انتخاب', 'سياسة', 'حكومة']
  };
  
  // Extract domains from signal and video
  const signalText = normalizeArabicText(signalTitle).toLowerCase();
  const videoText = normalizeArabicText(videoTitle + ' ' + videoDescription).toLowerCase();
  
  const signalDomains = new Set();
  const videoDomains = new Set();
  
  // Check which domains the signal belongs to
  for (const [domain, keywords] of Object.entries(topicDomains)) {
    if (keywords.some(kw => signalText.includes(kw))) {
      signalDomains.add(domain);
    }
    if (keywords.some(kw => videoText.includes(kw))) {
      videoDomains.add(domain);
    }
  }
  
  // If no domains detected, allow the match (fallback)
  if (signalDomains.size === 0 && videoDomains.size === 0) {
    return true;
  }
  
  // Check if there's domain overlap
  let hasOverlap = Array.from(signalDomains).some(domain => videoDomains.has(domain));
  
  // Special handling for energy domain - prevent economics vs geopolitics mismatch
  if (hasOverlap && signalDomains.has('energy') && videoDomains.has('energy')) {
    const signalIsEconEnergy = signalDomains.has('energy_economics');
    const videoIsEconEnergy = videoDomains.has('energy_economics');
    const signalIsGeoEnergy = signalDomains.has('energy_geopolitics') || videoDomains.has('military');
    const videoIsGeoEnergy = videoDomains.has('energy_geopolitics') || videoDomains.has('military');
    
    // If one is clearly economics and other is clearly geopolitics, reject
    if ((signalIsEconEnergy && !videoIsEconEnergy && videoIsGeoEnergy) ||
        (videoIsEconEnergy && !signalIsEconEnergy && signalIsGeoEnergy)) {
      console.log(`     ⚠️ Energy domain mismatch: signal=${signalIsEconEnergy ? 'economics' : 'geopolitics'}, video=${videoIsEconEnergy ? 'economics' : 'geopolitics'}`);
      hasOverlap = false;
    }
  }
  
  // If domains don't overlap, check if it's a person name match (people can appear in different contexts)
  if (!hasOverlap) {
    const peopleKeywords = ['trump', 'ترامب', 'biden', 'بايدن', 'musk', 'ماسك', 'putin', 'بوتين', 'xi', 'شي'];
    const matchedPeople = matchingKeywords.filter(kw => {
      const normalizedKw = normalizeArabicText(kw).toLowerCase();
      return peopleKeywords.some(p => normalizedKw.includes(p) || p.includes(normalizedKw));
    });
    
    // If only matching on person name without other context, require at least 3 other matching keywords
    // This prevents "Trump credit card" matching "Trump defense secretary"
    if (matchedPeople.length > 0) {
      const nonPersonKeywords = matchingKeywords.filter(kw => {
        const normalizedKw = normalizeArabicText(kw).toLowerCase();
        return !peopleKeywords.some(p => normalizedKw.includes(p) || p.includes(normalizedKw));
      });
      
      // Need at least 2 non-person keywords that match, OR 3+ total keywords
      if (nonPersonKeywords.length < 2 && matchingKeywords.length < 3) {
        return false; // Person name + 1 generic word isn't enough if domains don't match
      }
    } else {
      // No person names matched, but domains don't overlap - reject
      return false;
    }
  }
  
  return hasOverlap || matchingKeywords.length >= 3; // Allow if domains overlap OR 3+ keywords match
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
