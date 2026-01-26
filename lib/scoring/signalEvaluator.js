/**
 * SIGNAL EVALUATOR - 3-Axis Scoring System (Shadow Mode)
 * 
 * This is the new "producer mode" scoring system that evaluates signals on 3 axes:
 * 1. DNA Score (0-100): Is this MY story? Does it fit channel identity?
 * 2. Urgency Score (0-100): Is there a closing window? Breaking/market-moving?
 * 3. Demand Score (0-100): Will it perform? Proven demand signals?
 * 
 * SHADOW MODE: This runs alongside the existing system for comparison.
 * No production behavior changes until validated.
 * 
 * File: /lib/scoring/signalEvaluator.js
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Tier thresholds
  TIERS: {
    POST_TODAY: {
      dna: 60,
      urgency: 70,
      demand: 50,
    },
    POST_TODAY_MUST_KNOW: {
      dna: 50,  // Lower DNA threshold for Must-Know
      urgency: 60,
    },
    THIS_WEEK: {
      dna: 40,
      urgency: 25,
      demand: 25,
    },
    BACKLOG: {
      dna: 30,  // Lowered from 40 - keep more signals visible
    },
    REJECT: {
      dna: 40, // Below this = reject
    }
  },
  
  // Cache duration for patterns (5 minutes)
  PATTERN_CACHE_MS: 5 * 60 * 1000,
  
  // Recency thresholds (hours)
  RECENCY: {
    BREAKING: 6,
    FRESH: 24,
    RECENT: 48,
    AGING: 72,
  }
};

// Pattern cache
let patternCache = {
  patterns: null,
  loadedAt: null,
  showId: null,
};

// ============================================
// PATTERN LOADING
// ============================================

/**
 * Load patterns from signal_patterns table
 * Merges global patterns with show-specific overrides
 */
async function loadPatterns(showId) {
  // Check cache
  const now = Date.now();
  if (
    patternCache.patterns &&
    patternCache.showId === showId &&
    patternCache.loadedAt &&
    (now - patternCache.loadedAt) < CONFIG.PATTERN_CACHE_MS
  ) {
    return patternCache.patterns;
  }

  try {
    // Load global patterns (show_id IS NULL) and show-specific patterns
    const { data: patterns, error } = await supabase
      .from('signal_patterns')
      .select('*')
      .or(`show_id.is.null,show_id.eq.${showId}`)
      .eq('is_active', true);

    if (error) {
      console.error('❌ [SignalEvaluator] Error loading patterns:', error);
      return getDefaultPatterns();
    }

    // Organize patterns by type
    const organized = {
      entity: [],
      action: [],
      consequence: [],
      market_indicator: [],
      must_know_combo: [],
    };

    // Show-specific patterns override global ones with same name
    const patternMap = new Map();
    
    for (const pattern of (patterns || [])) {
      const key = `${pattern.pattern_type}:${pattern.pattern_name}`;
      const existing = patternMap.get(key);
      
      // Show-specific (show_id not null) takes priority over global
      if (!existing || (pattern.show_id && !existing.show_id)) {
        patternMap.set(key, pattern);
      }
    }

    // Organize into categories
    for (const pattern of patternMap.values()) {
      if (organized[pattern.pattern_type]) {
        organized[pattern.pattern_type].push({
          name: pattern.pattern_name,
          keywords: pattern.keywords || [],
          weight: pattern.weight || 10,
          comboRules: pattern.combo_rules,
        });
      }
    }

    // Update cache
    patternCache = {
      patterns: organized,
      loadedAt: now,
      showId,
    };

    console.log(`📊 [SignalEvaluator] Loaded ${patternMap.size} patterns for show ${showId?.substring(0, 8)}...`);
    return organized;
  } catch (err) {
    console.error('❌ [SignalEvaluator] Exception loading patterns:', err);
    return getDefaultPatterns();
  }
}

/**
 * Fallback patterns if DB load fails
 */
function getDefaultPatterns() {
  return {
    entity: [
      { name: 'Fed', keywords: ['fed', 'federal reserve', 'الفيدرالي'], weight: 15 },
      { name: 'OPEC', keywords: ['opec', 'أوبك'], weight: 15 },
    ],
    action: [
      { name: 'Rate Changes', keywords: ['cuts', 'raises', 'hikes', 'يخفض', 'يرفع'], weight: 10 },
      { name: 'Market Moves', keywords: ['falls', 'rises', 'drops', 'crashes', 'ينخفض', 'يرتفع'], weight: 10 },
    ],
    consequence: [],
    market_indicator: [
      { name: 'Oil', keywords: ['oil', 'crude', 'نفط'], weight: 12 },
      { name: 'Gold', keywords: ['gold', 'ذهب'], weight: 10 },
    ],
    must_know_combo: [],
  };
}

// ============================================
// AXIS 1: DNA SCORE
// ============================================

/**
 * Calculate DNA Score (0-100)
 * Measures how well the signal fits the channel's identity/topics
 * 
 * @param {Object} signal - The signal object
 * @param {Object} dnaMatch - DNA match result from existing system
 * @param {Array} dnaTopics - Channel's DNA topics
 * @returns {Object} { score, confidence, matchedTopics, reason }
 */
export function calculateDnaScore(signal, dnaMatch, dnaTopics = []) {
  let score = 0;
  let confidence = 'low';
  const matchedTopics = [];
  const reasons = [];

  // If no DNA match at all - return UNKNOWN, not zero
  if (!dnaMatch) {
    return {
      score: null,
      confidence: 'unknown',
      matchedTopics: [],
      reason: 'DNA unavailable - needs manual review',
    };
  }

  // Extract topic info from dnaMatch (handles different formats)
  const topicId = dnaMatch.topicId || dnaMatch.matchedTopicId || dnaMatch;
  const topicName = dnaMatch.topicName || dnaMatch.topicId || topicId;
  const matchConfidence = dnaMatch.confidence || 50;
  const matchSource = dnaMatch.source || 'unknown';
  const matchedKeywords = dnaMatch.matchedKeywords || [];
  const matchedHighValueKeywords = dnaMatch.matchedHighValueKeywords || [];

  // Base score from match confidence
  if (matchSource === 'ai' || matchSource === 'cached') {
    // AI-validated match - higher base
    score = Math.min(80, matchConfidence);
    reasons.push(`AI-validated match (${matchConfidence}%)`);
  } else if (matchSource === 'keywords') {
    // Keyword-only match - lower base
    score = Math.min(60, matchConfidence * 0.8);
    reasons.push(`Keyword match (${matchConfidence}%)`);
  } else {
    score = Math.min(50, matchConfidence * 0.7);
    reasons.push(`Match source: ${matchSource}`);
  }

  // Boost for high-value keywords
  if (matchedHighValueKeywords && matchedHighValueKeywords.length > 0) {
    const hvBoost = Math.min(20, matchedHighValueKeywords.length * 8);
    score += hvBoost;
    reasons.push(`+${hvBoost} for ${matchedHighValueKeywords.length} high-value keywords`);
  }

  // Boost for multiple keyword matches
  if (matchedKeywords && matchedKeywords.length >= 3) {
    score += 10;
    reasons.push('+10 for 3+ keyword matches');
  }

  // Get topic performance if available
  if (topicId && dnaTopics && dnaTopics.length > 0) {
    const topic = dnaTopics.find(t => t.topic_id === topicId);
    if (topic) {
      matchedTopics.push({
        topicId: topic.topic_id,
        topicName: topic.topic_name_en || topic.topic_id,
        likedCount: topic.liked_count || 0,
        rejectedCount: topic.rejected_count || 0,
        producedCount: topic.produced_count || 0,
      });

      // Boost for proven performing topics
      const successRate = topic.match_count > 5
        ? (topic.liked_count + topic.produced_count) / topic.match_count
        : 0;
      
      if (successRate > 0.5) {
        score += 10;
        reasons.push('+10 for proven topic (>50% success)');
      }
    }
  }

  // Cap at 100
  score = Math.min(100, Math.max(0, Math.round(score)));

  // Determine confidence level
  if (score >= 70) confidence = 'high';
  else if (score >= 50) confidence = 'medium';
  else if (score >= 30) confidence = 'low';
  else confidence = 'very_low';

  return {
    score,
    confidence,
    matchedTopics,
    topicId,
    topicName,
    reason: reasons.join('; '),
  };
}

// ============================================
// AXIS 2: URGENCY SCORE
// ============================================

/**
 * Calculate Urgency Score (0-100)
 * Measures time-sensitivity: Is there a closing window?
 * 
 * @param {Object} signal - The signal object
 * @param {Object} context - { hoursOld, competitorBreakdown, patterns }
 * @returns {Object} { score, isMustKnow, mustKnowType, triggers, reason }
 */
export async function calculateUrgencyScore(signal, context = {}) {
  const {
    hoursOld = 999,
    competitorBreakdown = {},
    showId = null,
  } = context;

  let score = 0;
  const triggers = [];

  // DEBUG: Log inputs to diagnose urgency calculation
  const signalTitle = (signal.title || '').substring(0, 40);
  console.log(`   🕐 [Urgency Debug] "${signalTitle}..." hoursOld=${hoursOld}, competitors=${JSON.stringify(competitorBreakdown)}`);
  let isMustKnow = false;
  let mustKnowType = null;

  const title = (signal.title || '').toLowerCase();
  const description = (signal.description || '').toLowerCase();
  const fullText = `${title} ${description}`;

  // Load patterns
  const patterns = await loadPatterns(showId);

  // ============================================
  // COMPONENT 1: Recency (up to 40 points)
  // ============================================
  if (hoursOld < CONFIG.RECENCY.BREAKING) {
    score += 40;
    triggers.push({ type: 'recency', text: 'Breaking news (<6h)', points: 40 });
  } else if (hoursOld < CONFIG.RECENCY.FRESH) {
    score += 30;
    triggers.push({ type: 'recency', text: 'Fresh news (<24h)', points: 30 });
  } else if (hoursOld < CONFIG.RECENCY.RECENT) {
    score += 20;
    triggers.push({ type: 'recency', text: 'Recent news (<48h)', points: 20 });
  } else if (hoursOld < CONFIG.RECENCY.AGING) {
    score += 10;
    triggers.push({ type: 'recency', text: 'Aging news (<72h)', points: 10 });
  }

  // ============================================
  // COMPONENT 2: Must-Know Detection (up to 35 points)
  // ============================================
  const mustKnowResult = detectMustKnow(fullText, patterns);
  
  if (mustKnowResult.isMustKnow) {
    isMustKnow = true;
    mustKnowType = mustKnowResult.type;
    score += mustKnowResult.points;
    triggers.push({
      type: 'must_know',
      text: mustKnowResult.reason,
      points: mustKnowResult.points,
      matchedPatterns: mustKnowResult.matchedPatterns,
    });
  }

  // ============================================
  // COMPONENT 3: Competitor Urgency (up to 25 points)
  // ============================================
  if (competitorBreakdown?.hasDirectBreakout) {
    score += 25;
    triggers.push({ type: 'competitor', text: 'Direct competitor breakout', points: 25 });
  } else if (competitorBreakdown?.hasTrendsetterSignal) {
    score += 15;
    triggers.push({ type: 'competitor', text: 'Trendsetter signal', points: 15 });
  } else if ((competitorBreakdown?.direct || 0) >= 2) {
    score += 20;
    triggers.push({ type: 'competitor', text: '2+ direct competitors', points: 20 });
  } else if ((competitorBreakdown?.total || 0) >= 3) {
    score += 10;
    triggers.push({ type: 'competitor', text: '3+ total competitors', points: 10 });
  }

  // Cap at 100
  score = Math.min(100, Math.max(0, Math.round(score)));

  return {
    score,
    isMustKnow,
    mustKnowType,
    triggers,
    reason: triggers.map(t => t.text).join('; ') || 'No urgency signals',
  };
}

/**
 * Detect if signal is "Must-Know" based on pattern matching
 * Must-Know = Market-moving news that doesn't require competitor validation
 */
function detectMustKnow(text, patterns) {
  const result = {
    isMustKnow: false,
    type: null,
    points: 0,
    reason: '',
    matchedPatterns: [],
  };

  // Check for number in text (required for most Must-Know)
  const hasNumber = /\d+%|\$\d+|\d+\s*(billion|million|trillion|bn|m\b|مليار|مليون|تريليون)/i.test(text);

  // Match patterns by type
  const matches = {
    entity: [],
    action: [],
    consequence: [],
    market_indicator: [],
  };

  for (const type of ['entity', 'action', 'consequence', 'market_indicator']) {
    for (const pattern of (patterns[type] || [])) {
      for (const keyword of (pattern.keywords || [])) {
        if (keyword) {
          // Use word boundary regex to prevent substring matches
          // e.g., "Goldman" should NOT match "gold", "detain" should NOT match "ai"
          const escapedKeyword = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const wordBoundaryRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
          
          if (wordBoundaryRegex.test(text)) {
            matches[type].push({
              pattern: pattern.name,
              keyword,
              weight: pattern.weight,
            });
            break; // One match per pattern is enough
          }
        }
      }
    }
  }

  // Count what we matched
  const hasEntity = matches.entity.length > 0;
  const hasAction = matches.action.length > 0;
  const hasMarketIndicator = matches.market_indicator.length > 0;
  const hasConsequence = matches.consequence.length > 0;

  // ============================================
  // MUST-KNOW RULES
  // ============================================

  // Rule 1: Entity + Action + Number (strongest)
  if (hasEntity && hasAction && hasNumber) {
    result.isMustKnow = true;
    result.type = 'entity_action_number';
    result.points = 35;
    result.reason = `Must-Know: ${matches.entity[0]?.pattern} + ${matches.action[0]?.pattern} + number`;
    result.matchedPatterns = [...matches.entity, ...matches.action];
  }
  // Rule 2: Market Indicator + Action + Number
  else if (hasMarketIndicator && hasAction && hasNumber) {
    result.isMustKnow = true;
    result.type = 'market_action_number';
    result.points = 30;
    result.reason = `Must-Know: ${matches.market_indicator[0]?.pattern} + ${matches.action[0]?.pattern} + number`;
    result.matchedPatterns = [...matches.market_indicator, ...matches.action];
  }
  // Rule 3: Entity + Action (no number, but still important)
  else if (hasEntity && hasAction) {
    result.isMustKnow = true;
    result.type = 'entity_action';
    result.points = 20;
    result.reason = `Likely Must-Know: ${matches.entity[0]?.pattern} + ${matches.action[0]?.pattern}`;
    result.matchedPatterns = [...matches.entity, ...matches.action];
  }
  // Rule 4: Market Indicator + Action (e.g., "Oil falls")
  else if (hasMarketIndicator && hasAction) {
    result.isMustKnow = true;
    result.type = 'market_action';
    result.points = 20;
    result.reason = `Likely Must-Know: ${matches.market_indicator[0]?.pattern} + ${matches.action[0]?.pattern}`;
    result.matchedPatterns = [...matches.market_indicator, ...matches.action];
  }

  return result;
}

// ============================================
// AXIS 3: DEMAND SCORE
// ============================================

/**
 * Calculate Demand Score (0-100)
 * Measures confidence that this will perform
 * Wraps existing demandScoring.js but normalizes output
 * 
 * @param {Object} existingDemandScore - Result from calculateDemandScore()
 * @param {Object} competitorBreakdown - Competitor data
 * @returns {Object} { score, confidence, signals, reason }
 */
/**
 * Calculate Demand Score (0-100)
 * Measures confidence that this will perform
 * STRICTER VERSION: Requires real evidence, not just generic matches
 * 
 * @param {Object} existingDemandScore - Result from calculateDemandScore()
 * @param {Object} competitorBreakdown - Competitor data
 * @returns {Object} { score, confidence, signals, reason }
 */
export function calculateDemandScoreAxis(existingDemandScore, competitorBreakdown = {}) {
  // If no existing demand score, return UNKNOWN
  if (!existingDemandScore) {
    return {
      score: null,
      confidence: 'unknown',
      signals: [],
      reason: 'No demand data available',
    };
  }

  let score = 0;
  const signals = existingDemandScore.signals || [];
  const reasons = [];

  // ============================================
  // STRICT DEMAND SIGNALS (Real Evidence)
  // ============================================
  
  // 1. Competitor breakout = STRONGEST signal (proven demand)
  if (competitorBreakdown?.hasDirectBreakout) {
    score += 40;
    reasons.push('Direct competitor breakout');
  } else if ((competitorBreakdown?.direct || 0) >= 2) {
    score += 30;
    reasons.push('Multiple direct competitors');
  } else if (competitorBreakdown?.hasTrendsetterSignal) {
    score += 20;
    reasons.push('Trendsetter signal');
  } else if ((competitorBreakdown?.total || 0) >= 3) {
    score += 15;
    reasons.push('3+ competitors covering');
  }

  // 2. Reddit buzz = MEDIUM signal (public discussion)
  if (existingDemandScore.hasRedditBuzz) {
    const redditSignals = signals.filter(s => s.type?.includes('reddit'));
    if (redditSignals.length >= 2) {
      score += 25;
      reasons.push(`Reddit trending (${redditSignals.length} threads)`);
    } else {
      score += 15;
      reasons.push('Reddit discussion');
    }
  }

  // 3. Wikipedia trend = MEDIUM signal (search interest)
  if (existingDemandScore.hasWikipediaTrend) {
    score += 15;
    reasons.push('Wikipedia trending');
  }

  // 4. Audience demand = WEAK signal (often generic matches)
  // Only count if there are SPECIFIC questions (not just topic matches)
  if (existingDemandScore.hasAudienceDemand) {
    const questionCount = existingDemandScore.audienceQuestions?.length || 0;
    const requestCount = existingDemandScore.audienceRequests?.length || 0;
    
    // Only count if we have actual requests, not just generic matches
    if (requestCount > 0) {
      score += Math.min(20, requestCount * 10);
      reasons.push(`${requestCount} audience request(s)`);
    } else if (questionCount > 0 && questionCount <= 5) {
      // A few specific questions = might be real
      score += 10;
      reasons.push(`${questionCount} audience question(s)`);
    }
    // If questionCount > 5, it's probably generic matching - don't add points
  }

  // ============================================
  // CONFIDENCE LEVEL
  // ============================================
  let confidence = 'low';
  
  if (score >= 50) {
    confidence = 'high';
  } else if (score >= 30) {
    confidence = 'medium';
  } else if (score > 0) {
    confidence = 'low';
  } else {
    confidence = 'none';
    score = null; // No real demand signals
  }

  return {
    score,
    confidence,
    signals,
    reason: reasons.length > 0 ? reasons.join('; ') : 'No strong demand signals',
  };
}

// ============================================
// TIER DETERMINATION
// ============================================

/**
 * Determine tier based on 3 axes
 * Implements two-lane Post Today logic
 * 
 * @param {Object} scores - { dna, urgency, demand }
 * @param {Object} context - { isMustKnow, mustKnowType, hoursOld }
 * @returns {Object} { tier, lane, confidence, reason }
 */
export function determineTier(scores, context = {}) {
  const { dna, urgency, demand } = scores;
  const { isMustKnow = false, mustKnowType = null, hoursOld = 999 } = context;

  // ============================================
  // GATE 0: Handle Unknown Data
  // ============================================
  if (dna.score === null) {
    return {
      tier: 'needs_review',
      lane: null,
      confidence: 'unknown',
      reason: 'DNA unavailable - cannot auto-classify',
      scores: { dna: null, urgency: urgency.score, demand: demand?.score },
    };
  }

  // ============================================
  // GATE 1: DNA Check (Hard Requirement)
  // ============================================
  if (dna.score < CONFIG.TIERS.REJECT.dna) {
    return {
      tier: 'reject',
      lane: null,
      confidence: 'high',
      reason: `DNA score too low (${dna.score} < ${CONFIG.TIERS.REJECT.dna}) - not channel's story`,
      scores: { dna: dna.score, urgency: urgency.score, demand: demand.score },
    };
  }

  // ============================================
  // POST TODAY: Lane 1 - Momentum (Competitor Driven)
  // ============================================
  if (
    dna.score >= CONFIG.TIERS.POST_TODAY.dna &&
    urgency.score >= CONFIG.TIERS.POST_TODAY.urgency &&
    demand.score >= CONFIG.TIERS.POST_TODAY.demand
  ) {
    return {
      tier: 'post_today',
      lane: 'momentum',
      confidence: 'high',
      reason: `All 3 axes above threshold (DNA: ${dna.score}, Urgency: ${urgency.score}, Demand: ${demand.score})`,
      scores: { dna: dna.score, urgency: urgency.score, demand: demand.score },
    };
  }

  // ============================================
  // POST TODAY: Lane 2 - Must-Know (Importance Driven)
  // ============================================
  if (
    isMustKnow &&
    dna.score >= CONFIG.TIERS.POST_TODAY_MUST_KNOW.dna &&
    urgency.score >= CONFIG.TIERS.POST_TODAY_MUST_KNOW.urgency &&
    hoursOld < 24
  ) {
    return {
      tier: 'post_today',
      lane: 'must_know',
      confidence: 'medium',
      reason: `Must-Know signal (${mustKnowType}) with DNA ${dna.score} and Urgency ${urgency.score}`,
      scores: { dna: dna.score, urgency: urgency.score, demand: demand.score },
    };
  }

  // ============================================
  // THIS WEEK
  // ============================================
  if (
    dna.score >= CONFIG.TIERS.THIS_WEEK.dna &&
    (urgency.score >= CONFIG.TIERS.THIS_WEEK.urgency || demand.score >= CONFIG.TIERS.THIS_WEEK.demand)
  ) {
    return {
      tier: 'this_week',
      lane: null,
      confidence: urgency.score >= 50 || demand.score >= 50 ? 'medium' : 'low',
      reason: `DNA ${dna.score} with moderate urgency (${urgency.score}) or demand (${demand.score})`,
      scores: { dna: dna.score, urgency: urgency.score, demand: demand.score },
    };
  }

  // ============================================
  // BACKLOG (Evergreen)
  // ============================================
  if (dna.score >= CONFIG.TIERS.BACKLOG.dna) {
    return {
      tier: 'backlog',
      lane: null,
      confidence: 'low',
      reason: `DNA match (${dna.score}) but low urgency/demand`,
      scores: { dna: dna.score, urgency: urgency.score, demand: demand.score },
    };
  }

  // Shouldn't reach here (caught by DNA gate), but just in case
  return {
    tier: 'reject',
    lane: null,
    confidence: 'high',
    reason: 'Did not meet any tier criteria',
    scores: { dna: dna.score, urgency: urgency.score, demand: demand.score },
  };
}

// ============================================
// MAIN EVALUATION FUNCTION
// ============================================

/**
 * Evaluate a signal using 3-axis scoring (SHADOW MODE)
 * Returns evaluation result for logging/comparison
 * 
 * @param {Object} signal - The signal object
 * @param {Object} context - All context data
 * @returns {Object} Full evaluation result
 */
export async function evaluateSignal(signal, context = {}) {
  const {
    dnaMatch = null,
    dnaTopics = [],
    demandScore = null,
    competitorBreakdown = {},
    hoursOld = 999,
    showId = null,
    currentTier = null,      // Current system's tier (for comparison)
    currentScore = null,     // Current system's score (for comparison)
  } = context;

  const startTime = Date.now();

  try {
    // Calculate 3 axes
    const dna = calculateDnaScore(signal, dnaMatch, dnaTopics);
    
    const urgency = await calculateUrgencyScore(signal, {
      hoursOld,
      competitorBreakdown,
      showId,
    });
    
    const demand = calculateDemandScoreAxis(demandScore, competitorBreakdown);

    // Determine tier
    const tierResult = determineTier(
      { dna, urgency, demand },
      { 
        isMustKnow: urgency.isMustKnow, 
        mustKnowType: urgency.mustKnowType,
        hoursOld,
      }
    );

    // ============================================
    // SAFETY: Shadow can only PROMOTE, not DEMOTE
    // (unless it's a hard reject due to very low DNA)
    // ============================================
    const tierRanking = {
      'reject': 0,
      'needs_review': 1,
      'backlog': 2,
      'evergreen': 2,  // Same level as backlog
      'this_week': 3,
      'post_today': 4,
    };

    const currentRank = tierRanking[currentTier] || 2;
    const shadowRank = tierRanking[tierResult.tier] || 2;

    // Only allow shadow to change tier if:
    // 1. It's a PROMOTION (shadow rank > current rank), OR
    // 2. It's a hard REJECT (DNA < 30 - clearly off-topic)
    const isPromotion = shadowRank > currentRank;
    const isHardReject = tierResult.tier === 'reject' && dna.score !== null && dna.score < 30;
    
    // 🌲 EVERGREEN PROTECTION: Never demote evergreen content
    // Evergreen is valuable educational content - only allow promotion or keep it
    const isEvergreenProtected = currentTier === 'evergreen' && shadowRank <= currentRank && !isHardReject;

    const finalTier = (isPromotion || isHardReject) 
      ? tierResult.tier 
      : (isEvergreenProtected 
          ? currentTier  // Keep evergreen if shadow wants to demote
          : (currentTier || tierResult.tier));  // Fall back to shadow if no current tier

    const finalLane = (isPromotion || isHardReject)
      ? tierResult.lane
      : (isEvergreenProtected 
          ? null  // Keep current lane for protected evergreen
          : null);

    const tierWasOverridden = finalTier !== tierResult.tier;

    const processingTime = Date.now() - startTime;

    // Build result
    const result = {
      signalId: signal.id,
      signalTitle: signal.title?.substring(0, 60),
      
      // 3-Axis Scores
      axes: {
        dna: {
          score: dna.score,
          confidence: dna.confidence,
          topicId: dna.topicId,
          topicName: dna.topicName,
        },
        urgency: {
          score: urgency.score,
          isMustKnow: urgency.isMustKnow,
          mustKnowType: urgency.mustKnowType,
          triggers: urgency.triggers,
        },
        demand: {
          score: demand.score,
          confidence: demand.confidence,
        },
      },
      
      // New tier result (with safety override)
      newTier: finalTier,
      newLane: finalLane,
      shadowTier: tierResult.tier,  // Original shadow calculation (for logging)
      shadowLane: tierResult.lane,
      newConfidence: tierResult.confidence,
      newReason: tierWasOverridden 
        ? (isEvergreenProtected
            ? `${tierResult.reason} [PROTECTED: Evergreen content kept, shadow wanted ${tierResult.tier}]`
            : `${tierResult.reason} [OVERRIDE: Shadow wanted ${tierResult.tier} but kept ${finalTier}]`)
        : tierResult.reason,
      tierWasOverridden,
      
      // Comparison with current system
     comparison: {
      currentTier,
      currentScore,
      newTier: finalTier,
      shadowWanted: tierResult.tier,
      tierChanged: currentTier !== finalTier,
      wasOverridden: tierWasOverridden,
      improvement: isPromotion 
        ? 'promoted' 
        : (isHardReject 
            ? 'rejected' 
            : (isEvergreenProtected 
                ? 'protected (evergreen)' 
                : 'kept')),
    },
      
      // Debug info
      processingTime,
      evaluatedAt: new Date().toISOString(),
    };

    // Log for shadow mode analysis
    logShadowResult(result);

    return result;
  } catch (err) {
    console.error(`❌ [SignalEvaluator] Error evaluating signal:`, err);
    return {
      signalId: signal.id,
      error: err.message,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Get arrow emoji for tier change direction
 */
function getChangeArrow(from, to) {
  const tierOrder = ['reject', 'needs_review', 'backlog', 'this_week', 'post_today'];
  const fromIdx = tierOrder.indexOf(from);
  const toIdx = tierOrder.indexOf(to);
  
  if (fromIdx === -1 || toIdx === -1) return '↔️';
  if (toIdx > fromIdx) return '⬆️'; // Promoted
  if (toIdx < fromIdx) return '⬇️'; // Demoted
  return '↔️'; // Same
}

/**
 * Log shadow mode result for analysis
 */
/**
 * Log shadow mode result for analysis
 */
function logShadowResult(result) {
  const {
    signalTitle,
    axes,
    newTier,
    newLane,
    comparison,
  } = result;

  // Only log interesting cases (tier changes or Must-Know)
  const isInteresting = 
    comparison.tierChanged ||
    axes.urgency.isMustKnow ||
    newTier === 'post_today' ||
    newTier === 'reject';

  if (isInteresting) {
    console.log(`\n🔬 [SHADOW] Signal: "${signalTitle}..."`);
    console.log(`   📊 DNA: ${axes.dna.score} | Urgency: ${axes.urgency.score} | Demand: ${axes.demand.score}`);
    
    // Show urgency breakdown
    if (axes.urgency.triggers && axes.urgency.triggers.length > 0) {
      console.log(`   ⏱️ Urgency breakdown: ${axes.urgency.triggers.map(t => `${t.text}(+${t.points})`).join(', ')}`);
    } else {
      console.log(`   ⏱️ Urgency breakdown: No triggers found`);
    }
    
    if (axes.urgency.isMustKnow) {
      console.log(`   ⚡ MUST-KNOW: ${axes.urgency.mustKnowType}`);
    }
    
    console.log(`   📋 Current: ${comparison.currentTier} (score: ${comparison.currentScore})`);
    console.log(`   📋 New: ${newTier}${newLane ? ` (${newLane})` : ''}`);
    
    if (comparison.tierChanged) {
      const arrow = getChangeArrow(comparison.currentTier, newTier);
      console.log(`   ${arrow} TIER CHANGED: ${comparison.currentTier} → ${newTier}`);
    }
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  evaluateSignal,
  calculateDnaScore,
  calculateUrgencyScore,
  calculateDemandScoreAxis,
  determineTier,
  loadPatterns,
  CONFIG,
};
