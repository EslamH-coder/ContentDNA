/**
 * PRE-FILTER SYSTEM
 * Scores news items WITHOUT using any LLM
 * Pure JavaScript - regex, keywords, rules
 * NOW USES TOPIC INTELLIGENCE for smart pre-filtering
 */

import { generateTopicFingerprint, matchesDNATopic } from '../topicIntelligence.js';
import { calculateDNAScore } from '../dna-scoring.js';

// ============================================
// CONFIGURATION (From Channel DNA)
// ============================================
const CONFIG = {
  // High-value keywords (boost score)
  powerKeywords: {
    // People (highest value)
    people: [
      { en: 'trump', ar: 'ترامب', boost: 25 },
      { en: 'trump', ar: 'ترمب', boost: 25 },
      { en: 'biden', ar: 'بايدن', boost: 20 },
      { en: 'musk', ar: 'ماسك', boost: 20 },
      { en: 'xi', ar: 'شي جين بينغ', boost: 18 },
      { en: 'putin', ar: 'بوتين', boost: 18 },
      { en: 'mbs', ar: 'محمد بن سلمان', boost: 18 },
      { en: 'powell', ar: 'باول', boost: 15 },
      { en: 'zuckerberg', ar: 'زوكربيرغ', boost: 12 },
      { en: 'bezos', ar: 'بيزوس', boost: 12 },
      { en: 'altman', ar: 'ألتمان', boost: 12 },
    ],
    
    // Countries/Entities (medium value)
    entities: [
      { en: 'china', ar: 'الصين', boost: 15 },
      { en: 'america', ar: 'أمريكا', boost: 12 },
      { en: 'usa', ar: 'الولايات المتحدة', boost: 12 },
      { en: 'russia', ar: 'روسيا', boost: 12 },
      { en: 'iran', ar: 'إيران', boost: 12 },
      { en: 'saudi', ar: 'السعودية', boost: 15 },
      { en: 'egypt', ar: 'مصر', boost: 15 },
      { en: 'uae', ar: 'الإمارات', boost: 12 },
      { en: 'israel', ar: 'إسرائيل', boost: 12 },
      { en: 'europe', ar: 'أوروبا', boost: 10 },
      { en: 'germany', ar: 'ألمانيا', boost: 8 },
    ],
    
    // Topics (variable value)
    topics: [
      { en: 'tariff', ar: 'رسوم', boost: 15 },
      { en: 'trade war', ar: 'حرب تجارية', boost: 18 },
      { en: 'sanctions', ar: 'عقوبات', boost: 15 },
      { en: 'oil', ar: 'النفط', boost: 12 },
      { en: 'dollar', ar: 'الدولار', boost: 12 },
      { en: 'federal reserve', ar: 'الفيدرالي', boost: 15 },
      { en: 'interest rate', ar: 'فائدة', boost: 12 },
      { en: 'inflation', ar: 'تضخم', boost: 10 },
      { en: 'ai', ar: 'الذكاء الاصطناعي', boost: 12 },
      { en: 'nuclear', ar: 'نووي', boost: 15 },
      { en: 'war', ar: 'حرب', boost: 15 },
      { en: 'military', ar: 'عسكري', boost: 12 },
      { en: 'crypto', ar: 'كريبتو', boost: 8 },
      { en: 'bitcoin', ar: 'بيتكوين', boost: 8 },
      { en: 'gold', ar: 'الذهب', boost: 10 },
    ]
  },
  
  // Arab relevance keywords (bonus)
  arabKeywords: [
    'مصر', 'السعودية', 'الإمارات', 'الخليج', 'العرب', 'المغرب', 
    'الجزائر', 'العراق', 'الأردن', 'قطر', 'الكويت', 'البحرين',
    'egypt', 'saudi', 'uae', 'gulf', 'arab', 'middle east',
    'قناة السويس', 'الريال', 'الجنيه', 'الدرهم'
  ],
  
  // Conflict indicators (bonus)
  conflictKeywords: [
    'vs', 'versus', 'against', 'war', 'battle', 'clash', 'conflict',
    'threatens', 'attacks', 'retaliates', 'sanctions', 'bans',
    'ضد', 'حرب', 'صراع', 'معركة', 'يهدد', 'يهاجم', 'عقوبات'
  ],
  
  // Low-value indicators (reduce score)
  lowValueKeywords: [
    'quarterly results', 'earnings report', 'stock price',
    'نتائج ربع', 'تقرير أرباح', 'سعر السهم',
    'local news', 'weather', 'sports', 'entertainment',
    'أخبار محلية', 'طقس', 'رياضة', 'ترفيه'
  ],
  
  // Minimum score to pass to LLM
  // Lowered to 30 for testing (was 60 - too strict)
  threshold: 30
};

// ============================================
// MAIN PRE-FILTER FUNCTION
// ============================================
export function preFilterNews(newsItem) {
  const startTime = Date.now();
  
  const title = (newsItem.title || '').toLowerCase();
  const description = (newsItem.description || '').toLowerCase();
  const fullText = `${title} ${description}`;
  
  let score = 30; // Base score
  const matches = {
    people: [],
    entities: [],
    topics: [],
    arab: [],
    conflict: []
  };
  const boosts = [];
  const penalties = [];
  
  // ============================================
  // CHECK POWER KEYWORDS
  // ============================================
  
  // People (highest priority)
  for (const keyword of CONFIG.powerKeywords.people) {
    if (fullText.includes(keyword.en) || fullText.includes(keyword.ar)) {
      score += keyword.boost;
      matches.people.push(keyword.ar || keyword.en);
      boosts.push(`+${keyword.boost} (Person: ${keyword.ar || keyword.en})`);
    }
  }
  
  // Entities
  for (const keyword of CONFIG.powerKeywords.entities) {
    if (fullText.includes(keyword.en) || fullText.includes(keyword.ar)) {
      score += keyword.boost;
      matches.entities.push(keyword.ar || keyword.en);
      boosts.push(`+${keyword.boost} (Entity: ${keyword.ar || keyword.en})`);
    }
  }
  
  // Topics
  for (const keyword of CONFIG.powerKeywords.topics) {
    if (fullText.includes(keyword.en) || fullText.includes(keyword.ar)) {
      score += keyword.boost;
      matches.topics.push(keyword.ar || keyword.en);
      boosts.push(`+${keyword.boost} (Topic: ${keyword.ar || keyword.en})`);
    }
  }
  
  // ============================================
  // CHECK ARAB RELEVANCE
  // ============================================
  for (const keyword of CONFIG.arabKeywords) {
    if (fullText.includes(keyword.toLowerCase())) {
      score += 10;
      matches.arab.push(keyword);
      boosts.push(`+10 (Arab relevance: ${keyword})`);
      break; // Only count once
    }
  }
  
  // ============================================
  // CHECK CONFLICT
  // ============================================
  for (const keyword of CONFIG.conflictKeywords) {
    if (fullText.includes(keyword.toLowerCase())) {
      score += 8;
      matches.conflict.push(keyword);
      boosts.push(`+8 (Conflict: ${keyword})`);
      break; // Only count once
    }
  }
  
  // ============================================
  // CHECK FOR NUMBERS (Good for hooks)
  // ============================================
  const hasNumbers = /\d+\s*(%|billion|million|trillion|مليار|مليون|تريليون)/.test(fullText);
  if (hasNumbers) {
    score += 5;
    boosts.push('+5 (Has specific numbers)');
  }
  
  // ============================================
  // PENALTIES
  // ============================================
  
  // Low-value content
  for (const keyword of CONFIG.lowValueKeywords) {
    if (fullText.includes(keyword.toLowerCase())) {
      score -= 15;
      penalties.push(`-15 (Low value: ${keyword})`);
      break;
    }
  }
  
  // Too short title (probably not substantial)
  if (title.length < 30) {
    score -= 10;
    penalties.push('-10 (Title too short)');
  }
  
  // Old news (if date available)
  if (newsItem.pubDate) {
    const ageInHours = (Date.now() - new Date(newsItem.pubDate).getTime()) / (1000 * 60 * 60);
    if (ageInHours > 72) {
      score -= 10;
      penalties.push('-10 (Old news > 72h)');
    }
  }
  
  // ============================================
  // BONUS: Multiple pattern match
  // ============================================
  const patternsMatched = [
    matches.people.length > 0,
    matches.entities.length > 0,
    matches.conflict.length > 0,
    matches.arab.length > 0
  ].filter(Boolean).length;
  
  if (patternsMatched >= 3) {
    score += 15;
    boosts.push('+15 (Multiple patterns matched)');
  }
  
  // ============================================
  // CAP SCORE
  // ============================================
  score = Math.max(0, Math.min(100, score));
  
  const processingTime = Date.now() - startTime;
  
  return {
    // Core result
    score,
    pass: score >= CONFIG.threshold,
    
    // Details
    matches,
    boosts,
    penalties,
    patternsMatched,
    
    // Recommendation
    priority: score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW',
    recommendation: score >= 80 ? 'PROCESS_NOW' : score >= 60 ? 'PROCESS' : 'SKIP',
    
    // Performance
    processingTime: `${processingTime}ms`,
    
    // Original
    newsItem
  };
}

// ============================================
// TOPIC INTELLIGENCE-BASED PRE-FILTERING (NEW)
// ============================================

/**
 * Pre-filter signals using Topic Intelligence
 * Fast filtering before expensive scoring
 */
export async function preFilterSignals(signals, showData = {}, options = {}) {
  const {
    requireDNAMatch = false,
    excludeCategories = [],
    includeCategories = [],
    minEntityCount = 0,
    maxAge = 72 // hours
  } = options;
  
  console.log(`🔍 Pre-filtering ${signals.length} signals using Topic Intelligence...`);
  
  const results = {
    passed: [],
    filtered: [],
    stats: {
      total: signals.length,
      byReason: {}
    }
  };
  
  for (const signal of signals) {
    const filterResult = await shouldPassFilter(signal, showData, {
      requireDNAMatch,
      excludeCategories,
      includeCategories,
      minEntityCount,
      maxAge
    });
    
    if (filterResult.pass) {
      results.passed.push({
        ...signal,
        fingerprint: filterResult.fingerprint,
        category: filterResult.category
      });
    } else {
      results.filtered.push({
        signal,
        reason: filterResult.reason
      });
      results.stats.byReason[filterResult.reason] = 
        (results.stats.byReason[filterResult.reason] || 0) + 1;
    }
  }
  
  results.stats.passed = results.passed.length;
  results.stats.filtered = results.filtered.length;
  
  console.log(`🔍 Pre-filter: ${results.passed.length} passed, ${results.filtered.length} filtered`);
  
  return results;
}

/**
 * Check if a single signal should pass the filter
 */
async function shouldPassFilter(signal, showData, options) {
  const {
    requireDNAMatch,
    excludeCategories,
    includeCategories,
    minEntityCount,
    maxAge
  } = options;
  
  // Generate fingerprint
  const fingerprint = await generateTopicFingerprint({
    title: typeof signal === 'string' ? signal : (signal.title || signal.topic || ''),
    description: typeof signal === 'string' ? '' : (signal.description || ''),
    id: typeof signal === 'string' ? undefined : signal.id,
    type: 'signal',
    skipEmbedding: true // Skip embedding for faster filtering
  });
  
  const category = fingerprint.topicCategory;
  
  // Check 1: Age filter
  const publishedAt = typeof signal === 'string' ? null : (signal.publishedAt || signal.published_at);
  if (publishedAt && maxAge) {
    const hoursAgo = (new Date() - new Date(publishedAt)) / (1000 * 60 * 60);
    if (hoursAgo > maxAge) {
      return { pass: false, reason: 'too_old', fingerprint, category };
    }
  }
  
  // Check 2: Excluded categories
  if (excludeCategories.length > 0 && excludeCategories.includes(category)) {
    return { pass: false, reason: 'excluded_category', fingerprint, category };
  }
  
  // Check 3: Required categories (if specified)
  if (includeCategories.length > 0 && !includeCategories.includes(category)) {
    return { pass: false, reason: 'not_in_included_categories', fingerprint, category };
  }
  
  // Check 4: Minimum entity count
  const entityCount = fingerprint.entities.people.length +
                      fingerprint.entities.countries.length +
                      fingerprint.entities.topics.length;
  if (entityCount < minEntityCount) {
    return { pass: false, reason: 'insufficient_entities', fingerprint, category };
  }
  
  // Check 5: DNA match (if required)
  if (requireDNAMatch && showData.dna) {
    let hasDNAMatch = false;
    
    for (const dnaTopic of showData.dna.topics || []) {
      const match = await matchesDNATopic(
        { title: typeof signal === 'string' ? signal : signal.title, fingerprint },
        dnaTopic.id || dnaTopic
      );
      if (match.matches) {
        hasDNAMatch = true;
        break;
      }
    }
    
    if (!hasDNAMatch) {
      // Also check entity match
      const dnaEntities = (showData.dna.entities || []).map(e => 
        (e.name || e).toLowerCase()
      );
      const signalEntities = [
        ...fingerprint.entities.countries,
        ...fingerprint.entities.people,
        ...fingerprint.entities.topics
      ].map(e => e.toLowerCase());
      
      hasDNAMatch = signalEntities.some(e => dnaEntities.includes(e));
    }
    
    if (!hasDNAMatch) {
      return { pass: false, reason: 'no_dna_match', fingerprint, category };
    }
  }
  
  // All checks passed
  return { pass: true, fingerprint, category };
}

/**
 * Quick category filter (very fast, no AI)
 */
export async function filterByCategory(signals, allowedCategories) {
  const results = [];
  
  for (const signal of signals) {
    const fingerprint = await generateTopicFingerprint({
      title: typeof signal === 'string' ? signal : (signal.title || signal.topic || ''),
      skipEmbedding: true
    });
    
    if (allowedCategories.includes(fingerprint.topicCategory)) {
      results.push({ ...signal, category: fingerprint.topicCategory });
    }
  }
  
  return results;
}

// ============================================
// BATCH FILTER
// ============================================
export function preFilterBatch(newsItems) {
  const results = newsItems.map(item => preFilterNews(item));
  
  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  
  // Separate by recommendation
  const toProcess = results.filter(r => r.pass);
  const skipped = results.filter(r => !r.pass);
  
  return {
    // Items to send to LLM
    toProcess,
    
    // Items skipped
    skipped,
    
    // Stats
    stats: {
      total: newsItems.length,
      passed: toProcess.length,
      skipped: skipped.length,
      passRate: `${((toProcess.length / newsItems.length) * 100).toFixed(1)}%`,
      avgScore: (results.reduce((a, b) => a + b.score, 0) / results.length).toFixed(1),
      highPriority: toProcess.filter(r => r.priority === 'HIGH').length,
      estimatedSavings: `${((skipped.length / newsItems.length) * 100).toFixed(0)}% API calls saved`
    }
  };
}

// ============================================
// QUICK CHECK (Ultra-fast for real-time)
// ============================================
export function quickCheck(title) {
  const lower = title.toLowerCase();
  
  // Quick power person check
  const powerPeople = ['trump', 'ترامب', 'ترمب', 'musk', 'ماسك', 'biden', 'بايدن', 'putin', 'بوتين'];
  const hasPowerPerson = powerPeople.some(p => lower.includes(p));
  
  // Quick conflict check
  const conflictWords = ['war', 'حرب', 'vs', 'against', 'ضد', 'threatens', 'يهدد'];
  const hasConflict = conflictWords.some(c => lower.includes(c));
  
  // Quick arab check
  const arabWords = ['egypt', 'مصر', 'saudi', 'السعودية', 'gulf', 'الخليج', 'arab', 'العرب'];
  const hasArab = arabWords.some(a => lower.includes(a));
  
  return {
    dominated: hasPowerPerson && (hasConflict || hasArab),
    hasPowerPerson,
    hasConflict,
    hasArab,
    quickScore: (hasPowerPerson ? 40 : 0) + (hasConflict ? 20 : 0) + (hasArab ? 20 : 0)
  };
}

