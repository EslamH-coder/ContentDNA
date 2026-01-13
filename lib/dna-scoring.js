// DNA Scoring Logic for RSS Items
// Based on topic matching, recency, and relevance
// NOW USES TOPIC INTELLIGENCE for accurate DNA matching

import { generateTopicFingerprint, matchesDNATopic } from './topicIntelligence';

// ============================================================
// STORY POTENTIAL FILTERS
// ============================================================

// REJECT: "Just Numbers" News (no story, just data)
const JUST_NUMBERS_PATTERNS = [
  /grows?\s+\d+(\.\d+)?%/i,
  /falls?\s+\d+(\.\d+)?%/i,
  /rises?\s+to\s+\d+/i,
  /drops?\s+to\s+\d+/i,
  /Q[1-4]\s+(20\d{2}|results|earnings)/i,
  /deficit.*\d+\s*(billion|million|مليار|مليون)/i,
  /surplus.*\d+\s*(billion|million|مليار|مليون)/i,
  /inflation\s+(in|rises|falls)/i,
  /تضخم.*\d+%/,
  /نمو.*\d+%/,
  /عجز.*مليار/,
  /ارتفع.*إلى/,
  /انخفض.*إلى/
];

// REJECT: "No Story" News (simple announcements)
const NO_STORY_PATTERNS = [
  /signs?\s+(agreement|deal|pact)/i,
  /meets?\s+with/i,
  /visits?\s+/i,
  /announces?\s+(plans?|partnership)/i,
  /launches?\s+/i,
  /توقيع\s+اتفاق/,
  /يلتقي\s+/,
  /يزور\s+/,
  /يعلن\s+عن/
];

// BOOST: "Big Story" News (worth a 25-minute episode)
const BIG_STORY_PATTERNS = [
  // Scenarios & What-ifs
  /what.*would|might|could.*look like/i,
  /ماذا لو/,
  /imagine if/i,
  
  // Reveals & Investigations  
  /smoke and mirrors/i,
  /the (real|hidden|secret|true) (story|reason)/i,
  /السر وراء/,
  /الحقيقة/,
  
  // Unexpected & Surprising
  /unexpected|surprising|shocking/i,
  /مفاجئ|صادم/,
  
  // Historic changes
  /overturned|revolutionized|transformed/i,
  /first time (ever|in history)/i,
  /لأول مرة/,
  /تحول تاريخي/,
  
  // Power struggles & Conflicts
  /من الدفاع إلى الهجوم/,
  /يعيد رسم/,
  /war|battle|conflict|showdown/i,
  /حرب|صراع|مواجهة/,
  
  // Big questions
  /why.*\?/i,
  /how.*\?/i,
  /لماذا/,
  /كيف/
];

/**
 * Check if a title is aggregated (combines multiple stories)
 * Returns: true if aggregated, false otherwise
 */
function isAggregatedTitle(title) {
  if (!title) return false;
  
  // Count ".." separators (common in Arabic aggregated titles)
  const doubleDotCount = (title.match(/\.\./g) || []).length;
  if (doubleDotCount >= 2) {
    console.log(`❌ REJECTED (aggregated title - ${doubleDotCount} separators): ${title.substring(0, 50)}...`);
    return true;
  }
  
  // Reject very long titles (usually aggregated)
  if (title.length > 120) {
    console.log(`❌ REJECTED (title too long - ${title.length} chars): ${title.substring(0, 50)}...`);
    return true;
  }
  
  return false;
}

/**
 * Check if a title has story potential
 * Uses patterns from showDna.scoring_keywords if available, otherwise falls back to hardcoded patterns
 * Returns: { score: number, reason: string }
 */
function hasStoryPotential(title, scoringKeywords = null) {
  if (!title) return { score: 0, reason: 'no_title' };
  
  // Get patterns from database or use defaults
  const justNumbersPatterns = scoringKeywords?.just_numbers_reject || [];
  const noStoryPatterns = scoringKeywords?.no_story_reject || [];
  const bigStoryPatterns = scoringKeywords?.big_story_patterns || [];
  
  // Use database patterns if available, otherwise use hardcoded patterns
  const justNumbersToCheck = justNumbersPatterns.length > 0 
    ? justNumbersPatterns.map(p => new RegExp(p, 'i'))
    : JUST_NUMBERS_PATTERNS;
  
  const noStoryToCheck = noStoryPatterns.length > 0
    ? noStoryPatterns.map(p => new RegExp(p, 'i'))
    : NO_STORY_PATTERNS;
  
  const bigStoryToCheck = bigStoryPatterns.length > 0
    ? bigStoryPatterns.map(p => new RegExp(p, 'i'))
    : BIG_STORY_PATTERNS;
  
  // Immediate reject: Just numbers
  for (const pattern of justNumbersToCheck) {
    if (pattern.test(title)) {
      console.log(`❌ REJECTED (just numbers): ${title.substring(0, 60)}...`);
      return { score: -50, reason: 'just_numbers' };
    }
  }
  
  // Immediate reject: No story
  for (const pattern of noStoryToCheck) {
    if (pattern.test(title)) {
      console.log(`❌ REJECTED (no story): ${title.substring(0, 60)}...`);
      return { score: -30, reason: 'no_story' };
    }
  }
  
  // Big bonus for story potential
  for (const pattern of bigStoryToCheck) {
    if (pattern.test(title)) {
      console.log(`✅ BIG STORY BONUS: ${title.substring(0, 60)}...`);
      return { score: 40, reason: 'big_story' };
    }
  }
  
  return { score: 0, reason: 'neutral' };
}

// Simplified topic taxonomy (extract from your full taxonomy)
// FIXED: Now uses REQUIRED vs SUPPORTING keywords
// REQUIRED keywords must be present to match the topic
// SUPPORTING keywords help but don't match alone
const TOPIC_TAXONOMY = [
  {
    id: "us_china_geopolitics",
    required: ["china", "chinese", "beijing", "taiwan", "الصين", "صين", "بكين", "تايوان"], // REQUIRED: must have one of these
    supporting: ["u.s.", "us", "united states", "washington", "chip", "chips", "semiconductor", "trade war", "tariffs", "أمريكا"], // SUPPORTING: only if required is present
  },
  {
    id: "us_debt_treasuries",
    required: ["treasury", "treasuries", "bond", "bonds", "yields"],
    supporting: ["federal reserve", "fed", "powell", "rate cut", "interest rates"],
  },
  {
    id: "currency_devaluation",
    required: ["currency", "devaluation", "exchange rate", "fx", "foreign exchange"],
    supporting: ["dollar", "yen", "euro", "pound"],
  },
  {
    id: "consumer_credit_cards",
    required: ["credit card", "credit cards", "بطاقات", "بطاقة", "ائتمان", "credit"],
    supporting: ["bnpl", "buy now pay later", "delinquency", "default", "debt", "loan"],
  },
  {
    id: "logistics_supply_chain",
    required: ["supply chain", "shipping", "freight", "logistics"],
    supporting: ["container", "shipping rates", "port"],
  },
  {
    id: "inflation_prices",
    required: ["inflation", "تضخم", "prices", "cpi", "consumer price"],
    supporting: ["price increase", "cost of living"],
  },
  {
    id: "energy_oil_gas_lng",
    required: ["oil", "نفط", "النفط", "gas", "غاز", "lng", "energy", "petroleum", "crude"],
    supporting: ["fuel", "gasoline", "opec", "أوبك"],
  },
  {
    id: "sanctions_econ_war",
    required: ["sanctions", "عقوبات", "embargo", "economic war"],
    supporting: ["trade restrictions"],
  },
];

function normalizeText(text) {
  return (text || "")
    .toString()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Infer topic ID from text - LEGACY (keyword-based)
 * @deprecated Consider using generateTopicFingerprint() for better accuracy
 */
function inferTopicIdFromText(text, topicTaxonomy = TOPIC_TAXONOMY) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  const taxonomy = Array.isArray(topicTaxonomy) ? topicTaxonomy : TOPIC_TAXONOMY;
  const scores = new Map();

  for (const topic of taxonomy) {
    // FIXED: Require REQUIRED keywords to match (not just any keyword)
    // Check if topic has required/supporting structure (new format) or keywords (old format)
    const requiredKeywords = topic.required || [];
    const supportingKeywords = topic.supporting || [];
    const oldFormatKeywords = Array.isArray(topic.keywords) ? topic.keywords : [];
    
    // Use new format (required/supporting) if available, otherwise fall back to old format
    let hasRequiredMatch = false;
    let requiredMatchCount = 0;
    let supportingMatchCount = 0;
    
    if (requiredKeywords.length > 0) {
      // New format: Must have at least 1 REQUIRED keyword
      for (const keyword of requiredKeywords) {
        const normalizedKeyword = normalizeText(keyword);
        if (normalized.includes(normalizedKeyword)) {
          hasRequiredMatch = true;
          requiredMatchCount++;
        }
      }
      
      if (!hasRequiredMatch) {
        continue; // Skip this topic - no required keywords matched
      }
      
      // Count supporting keywords (bonus, but not required)
      for (const keyword of supportingKeywords) {
        const normalizedKeyword = normalizeText(keyword);
        if (normalized.includes(normalizedKeyword)) {
          supportingMatchCount++;
        }
      }
      
      // Score: required matches weighted higher
      const score = requiredMatchCount * 2 + supportingMatchCount;
      scores.set(topic.id, score);
    } else if (oldFormatKeywords.length > 0) {
      // Old format: fall back to any keyword match (for backwards compatibility)
      let matchCount = 0;
      for (const keyword of oldFormatKeywords) {
        const normalizedKeyword = normalizeText(keyword);
        if (normalized.includes(normalizedKeyword)) {
          matchCount++;
        }
      }
      
      if (matchCount > 0) {
        const score = matchCount / Math.max(1, oldFormatKeywords.length);
        scores.set(topic.id, score);
      }
    }
  }

  if (scores.size === 0) return null;

  // Return topic with highest score
  let bestTopic = null;
  let bestScore = 0;

  for (const [topicId, score] of scores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topicId;
    }
  }

  return bestTopic;
}

function recencyWeight(ageDays) {
  if (ageDays == null || ageDays < 0) return 0.1;
  if (ageDays <= 1) return 1.0;
  if (ageDays <= 3) return 0.8;
  if (ageDays <= 7) return 0.6;
  if (ageDays <= 14) return 0.4;
  if (ageDays <= 30) return 0.2;
  return 0.1;
}

// ============================================================
// ARABIC SOURCES BONUS
// ============================================================
const ARABIC_SOURCES_BONUS = {
  'aljazeera': 20,
  'alarabiya': 20,
  'العربية': 20,
  'الجزيرة': 20,
  'asharq': 20,
  'الشرق': 20,
  'skynewsarabia': 15,
  'سكاي نيوز': 15
};

// ============================================================
// ENGAGEMENT KEYWORDS
// ============================================================
const ENGAGEMENT_KEYWORDS = {
  // High engagement - ideas people want to share
  high_engagement: {
    keywords: [
      'what if', 'ماذا لو', 'imagine', 'تخيل',
      'secret', 'سر', 'revealed', 'كشف',
      'first time', 'لأول مرة', 'never before',
      'how to', 'كيف', 'why', 'لماذا',
      'truth about', 'حقيقة', 'myth', 'خرافة',
      'mistake', 'خطأ', 'wrong', 'غلط',
      'millionaire', 'مليونير', 'billionaire', 'ملياردير',
      'from zero', 'من الصفر', 'success story', 'قصة نجاح',
      'warning', 'تحذير', 'danger', 'خطر',
      'opportunity', 'فرصة', 'chance',
      'future', 'مستقبل', '2030', '2050',
      'vs', 'versus', 'ضد', 'مقابل',
      'war', 'حرب', 'battle', 'معركة', 'conflict', 'صراع',
      'collapse', 'انهيار', 'crash', 'سقوط',
      'revolution', 'ثورة', 'breakthrough', 'اختراق'
    ],
    bonus: 25
  },
  
  // Medium engagement - affects daily life
  medium_engagement: {
    keywords: [
      'price', 'سعر', 'cost', 'تكلفة',
      'salary', 'راتب', 'income', 'دخل',
      'savings', 'مدخرات', 'investment', 'استثمار',
      'job', 'وظيفة', 'career', 'مهنة',
      'your money', 'فلوسك', 'your future', 'مستقبلك',
      'inflation', 'تضخم', 'recession', 'ركود',
      'gold', 'ذهب', 'dollar', 'دولار', 'oil', 'نفط'
    ],
    bonus: 15
  },
  
  // Low engagement - just information
  low_engagement: {
    keywords: [
      'quarterly', 'فصلي', 'annual', 'سنوي',
      'report', 'تقرير', 'statistics', 'إحصائيات',
      'meeting', 'اجتماع', 'conference', 'مؤتمر',
      'agreement', 'اتفاقية', 'signs', 'يوقع'
    ],
    penalty: -20
  }
};

// ============================================================
// BORING OFFICIAL NEWS BLACKLIST (for scoring penalty)
// ============================================================
const BORING_BLACKLIST = [
  'quarterly report', 'Q1', 'Q2', 'Q3', 'Q4',
  'grows 2%', 'grows 3%', 'rises 1%', 'falls 2%',
  'credit rating', 'fitch rates', 'moody\'s rates',
  'signs agreement', 'meets with', 'visits',
  'annual report', 'fiscal year'
];

// ============================================================
// CALCULATE ENGAGEMENT SCORE
// ============================================================
function calculateEngagementScore(title, description, source = '') {
  let score = 0;
  const text = (title + ' ' + description + ' ' + source).toLowerCase();
  
  // Check high engagement
  for (const keyword of ENGAGEMENT_KEYWORDS.high_engagement.keywords) {
    if (text.includes(keyword.toLowerCase())) {
      score += ENGAGEMENT_KEYWORDS.high_engagement.bonus;
      break; // Only add once
    }
  }
  
  // Check medium engagement
  for (const keyword of ENGAGEMENT_KEYWORDS.medium_engagement.keywords) {
    if (text.includes(keyword.toLowerCase())) {
      score += ENGAGEMENT_KEYWORDS.medium_engagement.bonus;
      break;
    }
  }
  
  // Check low engagement (penalty)
  for (const keyword of ENGAGEMENT_KEYWORDS.low_engagement.keywords) {
    if (text.includes(keyword.toLowerCase())) {
      score += ENGAGEMENT_KEYWORDS.low_engagement.penalty;
      break;
    }
  }
  
  // Check boring blacklist (penalty)
  for (const word of BORING_BLACKLIST) {
    if (text.includes(word.toLowerCase())) {
      score -= 30;
      break; // Only penalize once
    }
  }
  
  return score;
}

// ============================================================
// GET ARABIC SOURCE BONUS
// ============================================================
function getArabicSourceBonus(source = '') {
  if (!source) return 0;
  
  const sourceLower = source.toLowerCase();
  for (const [key, bonus] of Object.entries(ARABIC_SOURCES_BONUS)) {
    if (sourceLower.includes(key.toLowerCase())) {
      return bonus;
    }
  }
  return 0;
}

/**
 * Score an RSS item against show DNA
 * @param {Object} rssItem - RSS item with title, description, etc.
 * @param {Array} dnaTopics - Array of topic IDs that match the show's DNA
 * @param {Object} scoringKeywords - Optional scoring keywords from show_dna table (just_numbers_reject, no_story_reject, etc.)
 * @returns {Object} Scoring result with score, hook_potential, topicId, etc.
 */
export function scoreRssItemAgainstDna(rssItem, dnaTopics = [], scoringKeywords = null) {
  // Extract scoringKeywords from parameter (if provided as object with scoring_keywords property)
  // Handle both cases: scoringKeywords passed directly, or showDna object passed
  let localScoringKeywords = null;
  if (scoringKeywords) {
    // If scoringKeywords is an object with scoring_keywords property (showDna object)
    if (scoringKeywords.scoring_keywords) {
      localScoringKeywords = scoringKeywords.scoring_keywords;
    } else if (typeof scoringKeywords === 'object' && !Array.isArray(scoringKeywords)) {
      // If scoringKeywords is already the scoring_keywords object
      localScoringKeywords = scoringKeywords;
    }
  }
  
  // Ensure dnaTopics is an array
  let dnaTopicsArray = dnaTopics || []
  if (typeof dnaTopicsArray === 'string') {
    try {
      dnaTopicsArray = JSON.parse(dnaTopicsArray)
    } catch (e) {
      dnaTopicsArray = []
    }
  }
  if (!Array.isArray(dnaTopicsArray)) {
    dnaTopicsArray = []
  }
  
  const title = String(rssItem?.title || "");
  const description = String(rssItem?.description || "");
  // Ensure categories are strings before joining - handle any type safely
  const categories = Array.isArray(rssItem?.categories) 
    ? rssItem.categories.map(cat => {
        try {
          return String(cat || "");
        } catch (e) {
          return ""; // Skip invalid categories
        }
      }).filter(cat => cat.length > 0).join(" ") 
    : "";
  
  const textBlob = `${title} ${description} ${categories}`.trim();
  if (!textBlob) {
    return {
      score: 0,
      hook_potential: 0,
      topicId: null,
      reason: "Empty content",
    };
  }

  // Check for aggregated titles (combines multiple stories) - reject early
  if (isAggregatedTitle(title)) {
    return {
      score: 0,
      hook_potential: 0,
      topicId: null,
      ageDays: null,
      recency: 0,
      dnaMatchScore: 0,
      contentQuality: 0,
      storyPotential: 'aggregated_title',
      reason: `REJECTED: aggregated_title - "${title.substring(0, 50)}..."`,
    };
  }

  // Infer topic from RSS item
  const inferredTopicId = inferTopicIdFromText(textBlob);
  
  // Calculate age in days
  const pubDate = rssItem?.pubDate || rssItem?.publishedAt || "";
  const pubDateMs = pubDate ? Date.parse(pubDate) : Date.now();
  const ageDays = pubDateMs ? (Date.now() - pubDateMs) / (1000 * 60 * 60 * 24) : null;
  const recency = recencyWeight(ageDays);

  // DNA match score (0-1)
  let dnaMatchScore = 0;
  if (inferredTopicId && Array.isArray(dnaTopicsArray) && dnaTopicsArray.length > 0) {
    if (dnaTopicsArray.includes(inferredTopicId)) {
      dnaMatchScore = 1.0; // Perfect match
    } else {
      // Partial match based on topic similarity (simplified)
      dnaMatchScore = 0.3;
    }
  } else if (inferredTopicId) {
    // No DNA topics defined, but we have a topic match
    // Give a base score even without DNA to allow items through
    dnaMatchScore = 0.5;
  } else if (dnaTopicsArray.length === 0) {
    // No DNA defined at all - give minimum score based on content quality
    // This allows items to pass when DNA is empty
    dnaMatchScore = 0.2; // Minimum base score when no DNA
  }

  // Content quality score (based on title length, description presence)
  const titleLength = title.length;
  const hasDescription = description.length > 50;
  const contentQuality = Math.min(1.0, (titleLength / 100) * 0.6 + (hasDescription ? 0.4 : 0));

  // Combined base score (0-10 scale)
  // Weight: 50% DNA match, 30% recency, 20% content quality
  let baseScore = (dnaMatchScore * 0.5 + recency * 0.3 + contentQuality * 0.2) * 10;
  
  // If DNA is empty, give minimum score based on recency and content quality
  // This ensures items can pass even without DNA topics defined
  if (dnaTopicsArray.length === 0 && baseScore < 2.0) {
    // Minimum score: 2.0 (20/100) when DNA is empty but content is decent
    baseScore = Math.max(2.0, (recency * 0.6 + contentQuality * 0.4) * 5);
  }
  
  // Add engagement score (converted from 0-100 scale to 0-10 scale)
  const engagementScore = calculateEngagementScore(title, description, rssItem?.source || '');
  const engagementBonus = engagementScore / 10; // Convert to 0-10 scale
  
  // Add Arabic source bonus (converted from 0-100 scale to 0-10 scale)
  const source = rssItem?.source || rssItem?.sourceName || '';
  const arabicBonus = getArabicSourceBonus(source) / 10; // Convert to 0-10 scale
  
  // Add story potential check (CRITICAL: reject "just numbers" and "no story" news)
  // Use patterns from scoring_keywords if provided, otherwise use hardcoded patterns
  const storyCheck = hasStoryPotential(title, localScoringKeywords);
  const storyBonus = storyCheck.score / 10; // Convert to 0-10 scale (negative for rejection)
  
  // If story check rejects (negative score), return early with rejection
  if (storyCheck.score < 0) {
    return {
      score: Math.max(0, baseScore + storyBonus), // Will be very low or 0
      hook_potential: 0,
      topicId: inferredTopicId,
      ageDays: ageDays ? Number(ageDays.toFixed(1)) : null,
      recency,
      dnaMatchScore,
      contentQuality,
      storyPotential: storyCheck.reason,
      reason: `REJECTED: ${storyCheck.reason} - "${title.substring(0, 50)}..."`,
    };
  }
  
  // Final score: base + engagement + Arabic source bonus + story bonus
  // Cap at 10 (0-10 scale)
  const score = Math.min(10, Math.max(0, baseScore + engagementBonus + arabicBonus + storyBonus));

  // Hook potential (0-10 scale)
  // Based on recency and topic match strength
  // Formula: (recency * 0.6 + dnaMatchScore * 0.4) * 10
  // This gives 0-10 range, but user reports seeing 10-96, so there might be a scale mismatch
  // Keeping formula but ensuring it's capped at 10
  let hookPotential = (recency * 0.6 + dnaMatchScore * 0.4) * 10;
  // Cap at 10 (0-10 scale)
  hookPotential = Math.min(10, Math.max(0, hookPotential));

  return {
    score: Number(score.toFixed(1)),
    hook_potential: Number(hookPotential.toFixed(1)),
    topicId: inferredTopicId,
    ageDays: ageDays ? Number(ageDays.toFixed(1)) : null,
    recency,
    dnaMatchScore,
    contentQuality,
    storyPotential: storyCheck.reason,
    reason: storyCheck.reason === 'big_story'
      ? `Big story: ${inferredTopicId ? `Matched topic: ${inferredTopicId}` : 'Strong narrative potential'}`
      : inferredTopicId 
        ? `Matched topic: ${inferredTopicId} (DNA: ${dnaMatchScore > 0.5 ? 'strong' : 'weak'})`
        : "No topic match found",
  };
}

// ============================================================
// TOPIC INTELLIGENCE-BASED DNA SCORING (NEW)
// ============================================================

/**
 * Calculate DNA score using Topic Intelligence
 * Replaces keyword-based taxonomy matching with entity/category matching
 * @param {Object} signal - Signal with title, description
 * @param {Object} showDNA - Show DNA object with topics array
 * @returns {Promise<Object>} DNA score result
 */
export async function calculateDNAScore(signal, showDNA) {
  const fingerprint = await generateTopicFingerprint({
    title: signal.title,
    description: signal.description || '',
    id: signal.id,
    type: 'signal',
    skipEmbedding: true // Skip embedding for speed
  });
  
  let score = 0;
  const matches = [];
  const signalCategory = fingerprint.topicCategory;
  
  // Check against each DNA topic
  for (const dnaTopic of showDNA.topics || []) {
    const topicId = dnaTopic.id || dnaTopic.name || dnaTopic;
    const result = await matchesDNATopic(
      { title: signal.title, fingerprint },
      topicId
    );
    
    if (result.matches) {
      const topicWeight = dnaTopic.weight || 1;
      const boost = Math.round(result.confidence * 20 * topicWeight);
      
      score += boost;
      matches.push({
        dnaTopic: dnaTopic.name || dnaTopic.id || dnaTopic,
        signalCategory,
        confidence: result.confidence,
        boost
      });
    }
  }
  
  // Check entity matches (countries, people)
  for (const dnaEntity of showDNA.entities || []) {
    const entityName = dnaEntity.name || dnaEntity;
    const entityType = dnaEntity.type || 'any';
    
    let entityMatched = false;
    
    if (entityType === 'country' || entityType === 'any') {
      entityMatched = fingerprint.entities.countries.some(
        c => c.toLowerCase() === entityName.toLowerCase()
      );
    }
    
    if (!entityMatched && (entityType === 'person' || entityType === 'any')) {
      entityMatched = fingerprint.entities.people.some(
        p => p.toLowerCase() === entityName.toLowerCase()
      );
    }
    
    if (!entityMatched && (entityType === 'topic' || entityType === 'any')) {
      entityMatched = fingerprint.entities.topics.some(
        t => t.toLowerCase() === entityName.toLowerCase()
      );
    }
    
    if (entityMatched) {
      const entityWeight = dnaEntity.weight || 1;
      const boost = Math.round(10 * entityWeight);
      
      score += boost;
      matches.push({
        dnaEntity: entityName,
        type: entityType,
        boost
      });
    }
  }
  
  return {
    score,
    matches,
    signalCategory,
    signalEntities: fingerprint.entities,
    // Legacy compatibility
    dnaScore: score,
    matchedTopics: matches.filter(m => m.dnaTopic).map(m => m.dnaTopic),
    matchedEntities: matches.filter(m => m.dnaEntity).map(m => m.dnaEntity)
  };
}

/**
 * Check if signal matches any DNA topic using Topic Intelligence
 */
export async function signalMatchesDNA(signal, showDNA) {
  const result = await calculateDNAScore(signal, showDNA);
  return {
    matches: result.score > 0,
    score: result.score,
    details: result.matches
  };
}

/**
 * Get the primary DNA match for a signal using Topic Intelligence
 */
export async function getPrimaryDNAMatch(signal, showDNA) {
  const result = await calculateDNAScore(signal, showDNA);
  
  if (result.matches.length === 0) {
    return null;
  }
  
  // Return highest confidence match
  const best = result.matches.reduce((a, b) => 
    (a.confidence || a.boost) > (b.confidence || b.boost) ? a : b
  );
  
  return {
    topic: best.dnaTopic || best.dnaEntity,
    confidence: best.confidence || (best.boost / 20),
    category: result.signalCategory
  };
}

