/**
 * Keyword Classification for Meaningful Matching
 * Classifies keywords as Generic, Person, or Topic-Specific
 */

// ============================================
// KEYWORD TYPES
// ============================================

export const KEYWORD_TYPES = {
  // GENERIC - these alone don't indicate topic
  generic: [
    'أمريكي', 'الأمريكي', 'الاميركي', 'أميركي', 'american', 'us', 'usa',
    'الرئيس', 'president', 'رئيس',
    'الحكومة', 'government', 'حكومة',
    'العالم', 'world', 'عالمي', 'global',
    'الدولة', 'country', 'دولة',
    'today', 'اليوم', 'now', 'الآن',
    'new', 'جديد', 'الجديد',
  ],
  
  // PERSON - need topic context to be meaningful
  person: [
    'trump', 'ترامب', 'ترمب', 'دونالد',
    'biden', 'بايدن',
    'musk', 'ماسك', 'إيلون',
    'putin', 'بوتين',
    'xi', 'شي',
  ],
  
  // TOPIC-SPECIFIC - these indicate actual story topic
  topic: [
    // Finance/Consumer
    'credit', 'بطاقات', 'بطاقة', 'ائتمان', 'bank', 'بنك', 'loan', 'قرض', 'fee', 'رسوم', 'consumer', 'مستهلك',
    
    // Trade
    'tariff', 'تعريفة', 'جمارك', 'trade', 'تجارة', 'import', 'export', 'صادرات', 'واردات',
    
    // Countries (as topics)
    'china', 'الصين', 'صين', 'chinese', 'صيني',
    'russia', 'روسيا', 'روسي',
    'iran', 'إيران', 'ايران', 'إيراني',
    'venezuela', 'فنزويلا',
    'ukraine', 'أوكرانيا',
    
    // Energy
    'oil', 'نفط', 'النفط', 'بترول', 'gas', 'غاز', 'opec', 'أوبك',
    
    // Tech
    'ai', 'chip', 'رقاقة', 'nvidia', 'tech', 'تقنية',
    
    // Crypto
    'bitcoin', 'بيتكوين', 'crypto', 'كريبتو',
    
    // Military
    'war', 'حرب', 'military', 'عسكري', 'missile', 'صاروخ', 'attack', 'هجوم',
    
    // Economy
    'inflation', 'تضخم', 'recession', 'ركود', 'economy', 'اقتصاد',
    
    // Protests/Politics
    'protest', 'تظاهر', 'مظاهرات', 'election', 'انتخاب',
  ]
};

/**
 * Extract and classify keywords from text
 */
export function extractClassifiedKeywords(text) {
  if (!text) return { generic: [], person: [], topic: [] };
  
  const t = text.toLowerCase();
  const result = {
    generic: [],
    person: [],
    topic: []
  };
  
  for (const word of KEYWORD_TYPES.generic) {
    if (t.includes(word.toLowerCase())) {
      result.generic.push(word);
    }
  }
  
  for (const word of KEYWORD_TYPES.person) {
    if (t.includes(word.toLowerCase())) {
      result.person.push(word);
    }
  }
  
  for (const word of KEYWORD_TYPES.topic) {
    if (t.includes(word.toLowerCase())) {
      result.topic.push(word);
    }
  }
  
  return result;
}

/**
 * Check if two texts have MEANINGFUL match
 * Not just generic keywords
 */
export function hasMeaningfulMatch(text1, text2) {
  const kw1 = extractClassifiedKeywords(text1);
  const kw2 = extractClassifiedKeywords(text2);
  
  // Find overlaps by type
  const personOverlap = kw1.person.filter(p => kw2.person.includes(p));
  const topicOverlap = kw1.topic.filter(t => kw2.topic.includes(t));
  const genericOverlap = kw1.generic.filter(g => kw2.generic.includes(g));
  
  // MEANINGFUL MATCH RULES:
  // ✅ 2+ topic keywords overlap (same subject matter)
  // ✅ 1 person + 1+ topic overlap (person in same context)
  // ❌ Person + generic only (too loose)
  // ❌ Generic only (meaningless)
  
  const hasMeaningful = 
    topicOverlap.length >= 2 ||
    (personOverlap.length >= 1 && topicOverlap.length >= 1);
  
  return {
    meaningful: hasMeaningful,
    personOverlap,
    topicOverlap,
    genericOverlap,
    // For display, only show meaningful matches
    displayMatches: [...personOverlap, ...topicOverlap],
    reason: hasMeaningful 
      ? `Matched: ${[...personOverlap, ...topicOverlap].join(', ')}`
      : `Rejected: Only generic matches (${[...personOverlap, ...genericOverlap].join(', ')})`
  };
}
