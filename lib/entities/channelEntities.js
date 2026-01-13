import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cache for channel entities (avoid repeated DB calls)
const entityCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Channel/source names that should NOT count as keyword matches
export const EXCLUDED_SOURCE_NAMES = [
  // Arabic news channels
  'العربية', 'الجزيرة', 'المخبر', 'المخبر الاقتصادي',
  'الشرق', 'العربي', 'الميادين', 'الحرة', 'المشهد',
  'سكاي نيوز', 'روسيا اليوم', 'فرانس 24',
  
  // English news sources
  'bbc', 'cnn', 'reuters', 'رويترز',
  'bloomberg', 'بلومبرغ', 'بلومبيرغ',
  'economist', 'the economist',
  'wsj', 'wall street journal',
  'ft', 'financial times',
  'nyt', 'new york times', 'نيويورك تايمز',
  'cnbc', 'sky news', 'france 24', 'dw',
  'rt', 'al jazeera', 'al arabiya',
  
  // Social platforms (sometimes used as sources)
  'twitter', 'x', 'facebook', 'instagram', 'tiktok', 'youtube',
];

// Cache for excluded names (avoid repeated DB calls)
const excludedNamesCache = new Map();
const EXCLUDED_NAMES_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get all excluded names (auto-extracted from database + static list)
 * @param {string} showId - The show ID to get excluded names for
 * @returns {Promise<string[]>} Array of excluded names (lowercase)
 */
export async function getExcludedNames(showId) {
  if (!showId) {
    return EXCLUDED_SOURCE_NAMES.map(n => n.toLowerCase());
  }

  // Check cache first
  const cached = excludedNamesCache.get(showId);
  if (cached && Date.now() - cached.timestamp < EXCLUDED_NAMES_CACHE_TTL) {
    return cached.data;
  }
  
  console.log(`🔍 Loading excluded names (auto-extracted) for show ${showId}`);
  
  // ✨ NEW: Auto-extract from database (competitors, RSS feeds, RSS items, subreddits)
  const { getExcludedSourceNames } = await import('./sourceNameExtractor');
  const autoExtracted = await getExcludedSourceNames(showId);
  
  // Common section/category words that should NOT be excluded (too generic)
  const COMMON_SECTION_WORDS = ['اقتصاد', 'economy', 'الاقتصاد', 'economic', 'news', 'أخبار', 'sports', 'رياضة', 'politics', 'سياسة'];
  
  // Combine with static list (for backwards compatibility and global sources)
  // FIXED: Remove common section words from excluded names (they're too generic)
  const allExcluded = [...EXCLUDED_SOURCE_NAMES, ...autoExtracted];
  const normalizedExcluded = [...new Set(allExcluded.map(n => n.toLowerCase().trim()))]
    .filter(Boolean)
    .filter(name => !COMMON_SECTION_WORDS.some(cw => name === cw.toLowerCase())); // Remove common words
  
  // Cache the result
  excludedNamesCache.set(showId, {
    data: normalizedExcluded,
    timestamp: Date.now()
  });
  
  console.log(`✅ Loaded ${normalizedExcluded.length} excluded names (${autoExtracted.length} auto-extracted from database)`);
  
  return normalizedExcluded;
}

/**
 * Clear excluded names cache (call when competitors/sources are updated)
 * Also clears the auto-extracted source names cache
 */
export async function clearExcludedNamesCache(showId) {
  if (showId) {
    excludedNamesCache.delete(showId);
    // Also clear auto-extracted source names cache
    const { clearSourceNameCache } = await import('./sourceNameExtractor');
    clearSourceNameCache(showId);
    console.log(`🗑️  Cleared excluded names cache for show ${showId}`);
  } else {
    excludedNamesCache.clear();
    // Also clear all auto-extracted source names caches
    const { clearSourceNameCache } = await import('./sourceNameExtractor');
    clearSourceNameCache();
    console.log('🗑️  Cleared all excluded names caches');
  }
}

/**
 * Get all entities for a channel from DNA topics
 * Returns: { entities: string[], entityWeights: Record<string, number>, topicEntities: Record<string, string[]>, lastUpdated: Date }
 */
export async function getChannelEntities(showId) {
  if (!showId) {
    console.warn('⚠️ No showId provided to getChannelEntities');
    return { entities: [], entityWeights: {}, topicEntities: {}, lastUpdated: new Date() };
  }

  // Check cache first
  const cached = entityCache.get(showId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`📦 Using cached entities for show ${showId} (${cached.data.entities.length} entities)`);
    return cached.data;
  }
  
  console.log(`🔍 Loading entities from DNA for show ${showId}`);
  
  // Fetch DNA topics with keywords and scoring_keywords
  const { data: showDna, error } = await supabase
    .from('show_dna')
    .select('topics, scoring_keywords')
    .eq('show_id', showId)
    .single();
  
  if (error || !showDna) {
    console.error('Error fetching DNA topics:', error);
    return { entities: [], entityWeights: {}, topicEntities: {}, lastUpdated: new Date() };
  }
  
  // Extract and deduplicate entities
  const allEntities = new Set();
  const entityWeights = {};
  const topicEntities = {}; // Map topic_id -> entities
  
  // Process topics array
  let dnaTopics = [];
  if (showDna.topics) {
    if (Array.isArray(showDna.topics)) {
      dnaTopics = showDna.topics;
    } else if (typeof showDna.topics === 'string') {
      try {
        dnaTopics = JSON.parse(showDna.topics);
      } catch (e) {
        console.warn('Failed to parse topics as JSON:', e);
      }
    }
  }
  
  for (const topic of dnaTopics || []) {
    const topicId = topic.topic_id || topic.topicId || topic.id;
    const topicName = topic.name || topic.topic_name || topicId;
    
    if (!topicId) continue;
    
    topicEntities[topicId] = [];
    
    // Extract keywords from topic
    const keywords = topic.keywords || [];
    if (!Array.isArray(keywords)) continue;
    
    for (const keyword of keywords) {
      if (!keyword || typeof keyword !== 'string') continue;
      
      const trimmed = keyword.trim();
      if (trimmed.length === 0) continue;
      
      allEntities.add(trimmed);
      topicEntities[topicId].push(trimmed);
      
      // Keywords from DNA topics get high weight (10)
      entityWeights[trimmed.toLowerCase()] = 10;
      
      // Also add common variations
      const variations = getEntityVariations(trimmed);
      for (const variation of variations) {
        allEntities.add(variation);
        entityWeights[variation.toLowerCase()] = 10;
      }
    }
  }
  
  // Also extract from scoring_keywords (high_engagement, medium_engagement)
  if (showDna.scoring_keywords) {
    const highEngagement = showDna.scoring_keywords.high_engagement || [];
    const mediumEngagement = showDna.scoring_keywords.medium_engagement || [];
    
    for (const keyword of [...highEngagement, ...mediumEngagement]) {
      if (!keyword || typeof keyword !== 'string') continue;
      
      const trimmed = keyword.trim();
      if (trimmed.length === 0) continue;
      
      allEntities.add(trimmed);
      
      // High engagement keywords get weight 10, medium get weight 7
      const weight = highEngagement.includes(keyword) ? 10 : 7;
      if (!entityWeights[trimmed.toLowerCase()] || entityWeights[trimmed.toLowerCase()] < weight) {
        entityWeights[trimmed.toLowerCase()] = weight;
      }
      
      // Add variations
      const variations = getEntityVariations(trimmed);
      for (const variation of variations) {
        allEntities.add(variation);
        if (!entityWeights[variation.toLowerCase()] || entityWeights[variation.toLowerCase()] < weight) {
          entityWeights[variation.toLowerCase()] = weight;
        }
      }
    }
  }
  
  const result = {
    entities: Array.from(allEntities),
    entityWeights,
    topicEntities,
    lastUpdated: new Date()
  };
  
  // Cache the result
  entityCache.set(showId, {
    data: result,
    timestamp: Date.now()
  });
  
  console.log(`✅ Loaded ${result.entities.length} entities from ${dnaTopics?.length || 0} DNA topics`);
  
  return result;
}

/**
 * Get common variations of an entity (handle Arabic/English)
 */
function getEntityVariations(entity) {
  const variations = [];
  
  // Common Arabic/English mappings
  const mappings = {
    'ترامب': ['trump', 'ترمب', 'دونالد ترامب', 'دونالد ترمب'],
    'trump': ['ترامب', 'ترمب'],
    'الصين': ['china', 'صين'],
    'china': ['الصين', 'صين'],
    'روسيا': ['russia'],
    'russia': ['روسيا'],
    'إيران': ['iran', 'ايران'],
    'iran': ['إيران', 'ايران'],
    'أمريكا': ['usa', 'america', 'امريكا', 'الولايات المتحدة'],
    'america': ['أمريكا', 'امريكا', 'الولايات المتحدة'],
    'السعودية': ['saudi', 'سعودية'],
    'saudi': ['السعودية', 'سعودية'],
    'إسرائيل': ['israel', 'اسرائيل'],
    'israel': ['إسرائيل', 'اسرائيل'],
    'نفط': ['oil', 'النفط', 'بترول'],
    'oil': ['نفط', 'النفط', 'بترول'],
    'ذهب': ['gold', 'الذهب'],
    'gold': ['ذهب', 'الذهب'],
    'دولار': ['dollar', 'الدولار'],
    'dollar': ['دولار', 'الدولار'],
    'الفيدرالي': ['fed', 'federal reserve', 'فيدرالي'],
    'fed': ['الفيدرالي', 'فيدرالي'],
    'تسلا': ['tesla'],
    'tesla': ['تسلا'],
    'نتنياهو': ['netanyahu', 'بنيامين نتنياهو'],
    'netanyahu': ['نتنياهو', 'بنيامين نتنياهو'],
    'بوتين': ['putin', 'فلاديمير بوتين'],
    'putin': ['بوتين'],
    'ماسك': ['musk', 'إيلون ماسك', 'ايلون ماسك'],
    'musk': ['ماسك', 'إيلون ماسك'],
    'غزة': ['gaza', 'قطاع غزة'],
    'gaza': ['غزة', 'قطاع غزة'],
    'أوكرانيا': ['ukraine', 'اوكرانيا'],
    'ukraine': ['أوكرانيا', 'اوكرانيا'],
    'حزب الله': ['hezbollah'],
    'hezbollah': ['حزب الله'],
    'الحوثيون': ['houthis', 'الحوثيين'],
    'houthis': ['الحوثيون', 'الحوثيين'],
  };
  
  const lowerEntity = entity.toLowerCase();
  
  // Exact match
  if (mappings[lowerEntity]) {
    variations.push(...mappings[lowerEntity]);
  }
  
  // Check if entity contains any mapped terms
  for (const [key, values] of Object.entries(mappings)) {
    if (lowerEntity.includes(key) || key.includes(lowerEntity)) {
      variations.push(...values.filter(v => v.toLowerCase() !== lowerEntity));
    }
  }
  
  return [...new Set(variations)]; // Deduplicate
}

/**
 * Normalize Arabic text (remove diacritics, normalize alef/ya variations)
 */
function normalizeArabicText(text) {
  if (!text || typeof text !== 'string') return text || '';
  
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove diacritics
    .replace(/[أإآ]/g, 'ا') // Normalize alef
    .replace(/ى/g, 'ي') // Normalize ya
    .replace(/ة/g, 'ه') // Normalize ta marbuta
    .trim();
}

/**
 * Check if text contains any channel entity
 * Returns: { matches: boolean, matchedEntities: string[], matchScore: number }
 */
export function matchesChannelEntities(text, channelEntities) {
  if (!text || !channelEntities?.entities?.length) {
    return { matches: false, matchedEntities: [], matchScore: 0 };
  }
  
  const normalizedText = normalizeArabicText(text).toLowerCase();
  const matchedEntities = [];
  let matchScore = 0;
  
  for (const entity of channelEntities.entities) {
    const normalizedEntity = normalizeArabicText(entity).toLowerCase();
    
    // Check if entity appears in text (as word or substring for compound entities)
    if (normalizedText.includes(normalizedEntity)) {
      matchedEntities.push(entity);
      matchScore += channelEntities.entityWeights[normalizedEntity] || 5;
    }
  }
  
  return {
    matches: matchedEntities.length > 0,
    matchedEntities: [...new Set(matchedEntities)], // Deduplicate
    matchScore
  };
}

/**
 * Clear cache for a channel (call when DNA is updated)
 */
export function clearEntityCache(showId) {
  if (showId) {
    entityCache.delete(showId);
    console.log(`🗑️  Cleared entity cache for show ${showId}`);
  } else {
    entityCache.clear();
    console.log('🗑️  Cleared all entity caches');
  }
}

/**
 * Get entity weights merged with base weights
 * This combines DNA entities with the default keyword weights
 */
export async function getMergedEntityWeights(showId) {
  const { KEYWORD_WEIGHTS } = await import('../scoring/keywordWeights');
  const channelEntities = await getChannelEntities(showId);
  
  // Merge: Channel DNA entities override defaults
  const mergedWeights = { ...KEYWORD_WEIGHTS };
  
  for (const [entity, weight] of Object.entries(channelEntities.entityWeights)) {
    // DNA entities always get high weight (override defaults)
    mergedWeights[entity] = Math.max(weight, mergedWeights[entity] || 0);
  }
  
  return mergedWeights;
}
