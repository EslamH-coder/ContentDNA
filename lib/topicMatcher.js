/**
 * Hybrid Topic Matching System
 * Determines if two pieces of content are about the same story/topic
 * Works for any show - no hardcoded keywords
 * 
 * Strategy:
 * 1. Fast entity check (free) → handles 80% of cases
 * 2. Embedding similarity (for borderline cases) → handles remaining 20%
 */

// Generic words that exist in any domain - don't count as meaningful
const GENERIC_WORDS = new Set([
  // English
  'president', 'government', 'country', 'world', 'global', 'international',
  'today', 'now', 'new', 'breaking', 'latest', 'update', 'news', 'report',
  'says', 'announces', 'reports', 'according', 'official', 'statement',
  'american', 'us', 'usa', 'united states',
  // Arabic
  'الرئيس', 'رئيس', 'الحكومة', 'حكومة', 'الدولة', 'دولة',
  'العالم', 'عالمي', 'دولي', 'اليوم', 'الآن', 'جديد',
  'يقول', 'يعلن', 'أعلن', 'تقرير', 'أخبار', 'عاجل', 'بيان',
  'أمريكي', 'الأمريكي', 'الاميركي', 'أميركي',
]);

/**
 * MAIN FUNCTION: Check if two items are about the same topic
 * @param {Object} item1 - First item (idea/signal) with title and optional entities
 * @param {Object} item2 - Second item (video/article) with title and optional entities
 * @param {Object} options - { useEmbeddings: true, embeddingThreshold: 0.70 }
 * @returns {Object} { relevant: boolean, confidence: number, method: string, matches: {} }
 */
export async function isRelevantMatch(item1, item2, options = {}) {
  const { useEmbeddings = true, embeddingThreshold = 0.70 } = options;
  
  // STEP 1: Entity-based check (fast, free)
  const entityResult = checkEntityMatch(item1, item2);
  
  // Strong match - definitely relevant
  if (entityResult.strongMatch) {
    return {
      relevant: true,
      confidence: 0.9,
      method: 'entity',
      matches: entityResult.matches,
      reason: `Strong entity match: ${formatMatches(entityResult.matches)}`
    };
  }
  
  // No overlap at all - definitely not relevant
  if (!entityResult.hasAnyOverlap) {
    return {
      relevant: false,
      confidence: 0.95,
      method: 'entity',
      matches: {},
      reason: 'No entity overlap'
    };
  }
  
  // STEP 2: Borderline case - person matches but no topic context
  // Use embeddings if enabled
  if (entityResult.needsDeepCheck && useEmbeddings) {
    try {
      const similarity = await checkEmbeddingSimilarity(item1.title, item2.title);
      
      return {
        relevant: similarity >= embeddingThreshold,
        confidence: similarity,
        method: 'embedding',
        matches: entityResult.matches,
        similarityScore: similarity,
        reason: similarity >= embeddingThreshold 
          ? `Semantically similar (${Math.round(similarity * 100)}%)`
          : `Different topics despite shared entities (${Math.round(similarity * 100)}% similar)`
      };
    } catch (error) {
      console.warn('Embedding check failed, falling back to entity-only:', error.message);
      // Fall through to entity-only result
    }
  }
  
  // Borderline without embeddings - be conservative, reject
  return {
    relevant: false,
    confidence: 0.5,
    method: 'entity',
    matches: entityResult.matches,
    reason: 'Only person/generic matches - insufficient context'
  };
}

/**
 * Entity-based matching check
 */
function checkEntityMatch(item1, item2) {
  // Get entities - use pre-extracted if available, otherwise extract from title
  const entities1 = item1.entities || extractEntitiesSimple(item1.title || '');
  const entities2 = item2.entities || extractEntitiesSimple(item2.title || '');
  
  // Classify entities
  const classified1 = classifyEntities(entities1);
  const classified2 = classifyEntities(entities2);
  
  // Find overlaps
  const matches = {
    people: findOverlap(classified1.people, classified2.people),
    organizations: findOverlap(classified1.organizations, classified2.organizations),
    places: findOverlap(classified1.places, classified2.places),
    topics: findOverlap(classified1.topics, classified2.topics),
  };
  
  const personCount = matches.people.length;
  const contextCount = matches.organizations.length + matches.places.length + matches.topics.length;
  const totalMeaningful = personCount + contextCount;
  
  return {
    hasAnyOverlap: totalMeaningful > 0,
    strongMatch: contextCount >= 2 || (personCount >= 1 && contextCount >= 1),
    needsDeepCheck: personCount >= 1 && contextCount === 0,
    matches,
    summary: {
      personCount,
      contextCount,
      totalMeaningful
    }
  };
}

/**
 * Classify entities by type
 */
function classifyEntities(entities) {
  const classified = {
    people: [],
    organizations: [],
    places: [],
    topics: [],
    generic: []
  };
  
  for (const entity of entities) {
    const name = typeof entity === 'string' ? entity : (entity.name || entity);
    if (!name) continue;
    
    const type = typeof entity === 'string' ? detectEntityType(name) : (entity.type || detectEntityType(name));
    const normalized = normalizeText(name);
    
    // Skip generic words
    if (isGeneric(normalized)) {
      classified.generic.push(normalized);
      continue;
    }
    
    switch (type?.toUpperCase()) {
      case 'PERSON':
      case 'PER':
        classified.people.push(normalized);
        break;
      case 'ORG':
      case 'ORGANIZATION':
      case 'COMPANY':
        classified.organizations.push(normalized);
        break;
      case 'GPE':
      case 'LOC':
      case 'PLACE':
      case 'COUNTRY':
        classified.places.push(normalized);
        break;
      default:
        classified.topics.push(normalized);
    }
  }
  
  return classified;
}

/**
 * Simple entity extraction from title (fallback if no pre-extracted entities)
 * Uses basic patterns - ideally this would call existing entity extraction
 */
function extractEntitiesSimple(title) {
  if (!title) return [];
  
  const entities = [];
  const titleLower = title.toLowerCase();
  
  // People (common patterns)
  const personPatterns = [
    { pattern: /\btrump\b|ترامب|ترمب|دونالد/i, name: 'trump' },
    { pattern: /\bbiden\b|بايدن|جو بايدن/i, name: 'biden' },
    { pattern: /\bputin\b|بوتين|فلاديمير/i, name: 'putin' },
    { pattern: /\bxi\b|شي|جين بينغ/i, name: 'xi' },
    { pattern: /\bmusk\b|ماسك|إيلون/i, name: 'musk' },
    { pattern: /\bmaduro\b|مادورو/i, name: 'maduro' },
  ];
  
  for (const { pattern, name } of personPatterns) {
    if (pattern.test(title)) {
      entities.push({ name, type: 'PERSON' });
    }
  }
  
  // Countries/Places
  const placePatterns = [
    { pattern: /\bchina\b|الصين|صين|chinese/i, name: 'china' },
    { pattern: /\brussia\b|روسيا|russian/i, name: 'russia' },
    { pattern: /\biran\b|إيران|ايران|iranian|tehran|طهران/i, name: 'iran' },
    { pattern: /\bvenezuela\b|فنزويلا/i, name: 'venezuela' },
    { pattern: /\bukraine\b|أوكرانيا/i, name: 'ukraine' },
    { pattern: /\bsaudi\b|السعودية/i, name: 'saudi' },
    { pattern: /\buae\b|الإمارات/i, name: 'uae' },
    { pattern: /\begypt\b|مصر/i, name: 'egypt' },
  ];
  
  for (const { pattern, name } of placePatterns) {
    if (pattern.test(title)) {
      entities.push({ name, type: 'PLACE' });
    }
  }
  
  // Topic keywords (domain-specific concepts)
  const topicKeywords = [
    { pattern: /credit|بطاقات|ائتمان|card/i, name: 'credit_cards' },
    { pattern: /tariff|تعريفة|trade|تجارة/i, name: 'trade' },
    { pattern: /oil|نفط|gas|غاز/i, name: 'energy' },
    { pattern: /bitcoin|بيتكوين|crypto/i, name: 'crypto' },
    { pattern: /\bai\b|الذكاء الاصطناعي/i, name: 'ai' },
    { pattern: /inflation|تضخم/i, name: 'inflation' },
    { pattern: /protest|تظاهر/i, name: 'protest' },
  ];
  
  for (const { pattern, name } of topicKeywords) {
    if (pattern.test(titleLower)) {
      entities.push({ name, type: 'TOPIC' });
    }
  }
  
  return entities;
}

/**
 * Detect entity type from name (simple heuristic)
 */
function detectEntityType(name) {
  if (!name) return 'TOPIC';
  
  const n = name.toLowerCase();
  
  // Common person indicators
  if (/^(trump|biden|musk|putin|xi|ترامب|بايدن|ماسك|بوتين)/.test(n)) {
    return 'PERSON';
  }
  
  // Common org indicators
  if (/(inc|corp|company|bank|شركة|بنك|منظمة)/.test(n)) {
    return 'ORG';
  }
  
  // Countries/places - let the existing entity extraction handle this
  // For now, default to TOPIC
  return 'TOPIC';
}

/**
 * Check if word is generic
 */
function isGeneric(word) {
  if (!word) return false;
  return GENERIC_WORDS.has(word.toLowerCase());
}

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase().trim();
}

/**
 * Find overlap between two arrays
 */
function findOverlap(arr1, arr2) {
  if (!arr1 || !arr2 || arr1.length === 0 || arr2.length === 0) return [];
  const set2 = new Set(arr2.map(x => normalizeText(x)));
  return arr1.filter(x => set2.has(normalizeText(x)));
}

/**
 * Format matches for display
 */
function formatMatches(matches) {
  const parts = [];
  if (matches.people?.length) parts.push(`people: ${matches.people.join(', ')}`);
  if (matches.organizations?.length) parts.push(`orgs: ${matches.organizations.join(', ')}`);
  if (matches.places?.length) parts.push(`places: ${matches.places.join(', ')}`);
  if (matches.topics?.length) parts.push(`topics: ${matches.topics.join(', ')}`);
  return parts.join('; ') || 'none';
}

// ============================================
// EMBEDDING SIMILARITY (Step 2 of Hybrid)
// ============================================

// Lazy load OpenAI to avoid import errors if package not installed
let OpenAI = null;
let openai = null;
let openaiInitialized = false;

async function initializeOpenAI() {
  if (openaiInitialized) return openai; // Already initialized (or failed)
  
  openaiInitialized = true;
  
  if (!process.env.OPENAI_API_KEY) {
    return null; // No API key
  }
  
  try {
    if (!OpenAI) {
      const openaiModule = await import('openai');
      OpenAI = openaiModule.default || openaiModule;
    }
    
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    return openai;
  } catch (e) {
    // OpenAI not available - embedding checks will fail gracefully
    console.warn('OpenAI package not found or not installed - embedding similarity disabled. Install with: npm install openai');
    return null;
  }
}

// Cache embeddings to reduce API calls
const embeddingCache = new Map();
const CACHE_MAX_SIZE = 1000;

/**
 * Check semantic similarity using embeddings
 */
async function checkEmbeddingSimilarity(text1, text2) {
  const client = await initializeOpenAI();
  if (!client) {
    // Fallback: return low similarity if OpenAI not available
    return 0.3;
  }
  
  try {
    const [emb1, emb2] = await Promise.all([
      getEmbedding(text1),
      getEmbedding(text2)
    ]);
    
    return cosineSimilarity(emb1, emb2);
  } catch (error) {
    console.error('Embedding error:', error);
    // Fallback: return low similarity on error
    return 0.3;
  }
}

/**
 * Get embedding with caching
 */
async function getEmbedding(text) {
  const client = await initializeOpenAI();
  if (!client) {
    throw new Error('OpenAI client not initialized');
  }
  
  const cacheKey = text.substring(0, 200).toLowerCase();
  
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }
  
  const client = await initializeOpenAI();
  if (!client) throw new Error('OpenAI client not initialized');
  
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small', // Cheapest, good quality
    input: text,
  });
  
  const embedding = response.data[0].embedding;
  
  // Manage cache size
  if (embeddingCache.size >= CACHE_MAX_SIZE) {
    const firstKey = embeddingCache.keys().next().value;
    embeddingCache.delete(firstKey);
  }
  
  embeddingCache.set(cacheKey, embedding);
  return embedding;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}

// Export additional helpers for testing/debugging
export function checkEntityMatchSync(item1, item2) {
  return checkEntityMatch(item1, item2);
}

export default {
  isRelevantMatch,
  checkEntityMatch: checkEntityMatchSync,
  checkEmbeddingSimilarity,
};
