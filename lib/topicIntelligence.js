/**
 * Universal Topic Intelligence System v2
 * Now with AI-powered entity extraction
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Initialize OpenAI (only if API key is available)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (error) {
    console.warn('OpenAI initialization failed:', error.message);
  }
}

// Initialize Supabase (for caching)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Use AI extraction when regex finds fewer than this many entities
  MIN_ENTITIES_BEFORE_AI: 2,
  // Embedding model
  EMBEDDING_MODEL: 'text-embedding-3-small',
  // Entity extraction model (cheapest that works well)
  EXTRACTION_MODEL: 'gpt-4o-mini',
  // Cache duration in hours
  CACHE_HOURS: 24,
  // Similarity thresholds
  SAME_STORY_THRESHOLD: 0.80,
  RELATED_THRESHOLD: 0.65,
  CROSS_LANG_SAME_STORY_THRESHOLD: 0.55,
};

// ============================================
// PART 1: TOPIC FINGERPRINT GENERATION
// ============================================

/**
 * Generate a topic fingerprint for any content
 * Uses AI extraction when regex isn't enough
 */
export async function generateTopicFingerprint(content, options = {}) {
  // Handle both string and object inputs
  const contentObj = typeof content === 'string' ? { title: content } : content;
  
  const { 
    title, 
    description = '', 
    id = null,
    type = 'signal',
    forceRefresh = false,
    skipEmbedding = false,
    skipCache = false,
    entities: providedEntities = null // Allow passing pre-extracted entities
  } = { ...contentObj, ...options };
  
  if (!title) {
    return {
      title: '',
      embedding: null,
      entities: { people: [], countries: [], organizations: [], topics: [] },
      topicCategory: 'general',
      language: 'en',
      extractionMethod: 'none',
      fingerprint: '',
      generatedAt: new Date().toISOString()
    };
  }
  
  // Generate item ID if not provided (for caching)
  // Try multiple sources: id, signal_id, or generate from title
  const itemId = id || contentObj.signal_id || contentObj.id || generateHashId(title);
  const itemType = type || contentObj.type || 'signal';
  
  // Reduced logging - only log when actually processing (not cached)
  // console.log(`🔍 Processing: id=${itemId}, type=${itemType}, title=${title?.substring(0, 30)}...`);
  
  // ALWAYS check cache first (unless explicitly skipped)
  if (!skipCache && !forceRefresh) {
    try {
      const cached = await getCachedFingerprint(itemId, itemType);
      if (cached) {
        // Reduced logging - only log cache hits (important for performance monitoring)
        return {
          ...cached,
          title // Ensure title is included
        };
      }
    } catch (e) {
      // No cache entry, continue with extraction (silent - expected for new items)
    }
  }
  
  // Reduced logging - only log cache misses (important for debugging)
  // Removed verbose "extracting" log - too noisy
  
  const fullText = `${title} ${description}`.trim();
  
  // STEP 0: Skip extraction for short/irrelevant text
  if (!shouldExtractEntities(fullText, itemType)) {
    // Silent skip - no logging needed for expected behavior
    return {
      title,
      embedding: null,
      entities: { people: [], countries: [], organizations: [], topics: [] },
      topicCategory: 'general',
      language: detectLanguage(title),
      extractionMethod: 'skipped',
      fingerprint: '',
      generatedAt: new Date().toISOString()
    };
  }
  
  // STEP 1: Use provided entities if available (from cache), otherwise extract
  let entities;
  let extractionMethod = 'regex';
  
  if (providedEntities && (
    providedEntities.people?.length > 0 ||
    providedEntities.countries?.length > 0 ||
    providedEntities.topics?.length > 0 ||
    providedEntities.organizations?.length > 0
  )) {
    // Use provided entities (from database cache) - convert to array format for classification
    entities = [
      ...(providedEntities.people || []).map(p => ({ name: p, type: 'PERSON' })),
      ...(providedEntities.countries || []).map(c => ({ name: c, type: 'COUNTRY' })),
      ...(providedEntities.topics || []).map(t => ({ name: t, type: 'TOPIC' })),
      ...(providedEntities.organizations || []).map(o => ({ name: o, type: 'ORG' }))
    ];
    extractionMethod = 'cached';
  } else {
    // STEP 1: Try regex extraction first (free)
    entities = extractEntitiesWithRegex(fullText);
    extractionMethod = 'regex';
    
    // STEP 2: If regex didn't find enough, use AI
    const entityCount = countEntities(entities);
    const entityCountByType = {
      countries: entities.filter(e => e.type === 'COUNTRY').length,
      organizations: entities.filter(e => e.type === 'ORG').length,
      topics: entities.filter(e => e.type === 'TOPIC').length,
      people: entities.filter(e => e.type === 'PERSON').length
    };
    const meaningfulEntityCount = entityCountByType.countries + 
                                  entityCountByType.organizations + 
                                  entityCountByType.topics;
    
    // Only use AI if we found less than 2 meaningful entities (not just people)
    if (meaningfulEntityCount < CONFIG.MIN_ENTITIES_BEFORE_AI && openai) {
      const aiEntities = await extractEntitiesWithAI(title, description);
      if (aiEntities && countEntities(aiEntities) > entityCount) {
        entities = mergeEntities(entities, aiEntities);
        extractionMethod = 'ai';
      }
    }
  }
  // Removed verbose logging - only log errors
  
  // STEP 3: Classify and categorize
  const classifiedEntities = classifyEntities(entities);
  const topicCategory = determineTopicCategory(classifiedEntities, fullText);
  
  // STEP 4: Generate embedding
  let embedding = null;
  if (!skipEmbedding && openai) {
    try {
      embedding = await getEmbedding(title);
    } catch (error) {
      console.warn('Embedding generation failed:', error.message);
    }
  }
  
  // STEP 5: Detect language
  const language = detectLanguage(title);
  
  // Build fingerprint
  const fingerprint = {
    title,
    embedding,
    entities: classifiedEntities,
    topicCategory,
    language,
    extractionMethod,
    fingerprint: generateShortFingerprint(classifiedEntities, topicCategory),
    generatedAt: new Date().toISOString()
  };
  
  // Cache for future use
  if (!skipCache) {
    await cacheFingerprint(itemId, itemType, fingerprint);
  }
  
  return fingerprint;
}

/**
 * Generate consistent hash ID from title if no ID provided
 */
function generateHashId(text) {
  if (!text) return `unknown_${Date.now()}`;
  // Simple hash from text (consistent across calls)
  let hash = 0;
  const normalizedText = text.trim().toLowerCase();
  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `hash_${Math.abs(hash)}`;
}

// ============================================
// PART 2: ENTITY EXTRACTION - REGEX (FREE)
// ============================================

/**
 * Check if we should extract entities from this text
 * Skips short text, comments, religious/greeting patterns
 */
function shouldExtractEntities(text, itemType) {
  // Skip very short text
  if (!text || text.length < 30) return false;
  
  // Skip if it's a comment and has no news value
  if (itemType === 'comment') {
    // Skip religious phrases
    if (text.includes('اللهم') || text.includes('سبحان') || text.includes('الحمد')) return false;
    // Skip short reactions
    if (text.length < 50) return false;
  }
  
  // Skip greeting-only text
  const greetings = ['مرحبا', 'السلام عليكم', 'هلا', 'أهلا', 'شكرا', 'جزاك الله'];
  const textLower = text.toLowerCase();
  if (greetings.some(g => textLower.includes(g)) && text.length < 60) return false;
  
  return true;
}

function extractEntitiesWithRegex(text) {
  if (!text) return [];
  
  const entities = [];
  
  // PEOPLE
  const people = [
    { pattern: /trump|ترامب|ترمب|دونالد\s*ترامب/gi, name: 'Trump', type: 'PERSON' },
    { pattern: /biden|بايدن|جو\s*بايدن/gi, name: 'Biden', type: 'PERSON' },
    { pattern: /musk|ماسك|إيلون|ايلون/gi, name: 'Musk', type: 'PERSON' },
    { pattern: /putin|بوتين|فلاديمير/gi, name: 'Putin', type: 'PERSON' },
    { pattern: /xi\s*jinping|شي\s*جين\s*بينغ|الرئيس\s*الصيني/gi, name: 'Xi Jinping', type: 'PERSON' },
    { pattern: /netanyahu|نتنياهو|نتانياهو/gi, name: 'Netanyahu', type: 'PERSON' },
    { pattern: /zelensky|زيلينسكي/gi, name: 'Zelensky', type: 'PERSON' },
    { pattern: /maduro|مادورو/gi, name: 'Maduro', type: 'PERSON' },
    { pattern: /erdogan|أردوغان/gi, name: 'Erdogan', type: 'PERSON' },
    { pattern: /mbs|محمد\s*بن\s*سلمان/gi, name: 'MBS', type: 'PERSON' },
    { pattern: /khamenei|خامنئي/gi, name: 'Khamenei', type: 'PERSON' },
  ];
  
  // ARABIC COUNTRIES (expanded)
  const arabicCountries = {
    'تونس': 'Tunisia', 'الجزائر': 'Algeria', 'المغرب': 'Morocco',
    'ليبيا': 'Libya', 'مصر': 'Egypt', 'السودان': 'Sudan',
    'العراق': 'Iraq', 'سوريا': 'Syria', 'لبنان': 'Lebanon',
    'الأردن': 'Jordan', 'فلسطين': 'Palestine', 'اليمن': 'Yemen',
    'السعودية': 'Saudi Arabia', 'الإمارات': 'UAE', 'قطر': 'Qatar',
    'الكويت': 'Kuwait', 'البحرين': 'Bahrain', 'عمان': 'Oman',
    'تركيا': 'Turkey', 'إيران': 'Iran', 'ايران': 'Iran',
    'أفغانستان': 'Afghanistan', 'باكستان': 'Pakistan', 'الهند': 'India',
    'فنزويلا': 'Venezuela', 'فينزويلا': 'Venezuela', 'كوبا': 'Cuba',
    'البرازيل': 'Brazil', 'المكسيك': 'Mexico', 'الأرجنتين': 'Argentina',
    'كندا': 'Canada', 'بريطانيا': 'UK', 'فرنسا': 'France',
    'ألمانيا': 'Germany', 'المانيا': 'Germany', 'إيطاليا': 'Italy',
    'إسبانيا': 'Spain', 'اليونان': 'Greece', 'روسيا': 'Russia',
    'أوكرانيا': 'Ukraine', 'اوكرانيا': 'Ukraine', 'الصين': 'China',
    'اليابان': 'Japan', 'كوريا': 'Korea'
  };
  
  // COUNTRIES (expanded with Arabic support)
  const countries = [
    { pattern: /china|chinese|الصين|صين|الصيني|صيني|بكين|بيجين/gi, name: 'China', type: 'COUNTRY' },
    { pattern: /russia|russian|روسيا|روسي|الروسي|موسكو/gi, name: 'Russia', type: 'COUNTRY' },
    { pattern: /iran|iranian|إيران|ايران|إيراني|ايراني|طهران/gi, name: 'Iran', type: 'COUNTRY' },
    { pattern: /america|american|usa|us\b|الأمريك|أمريك|امريك|الولايات\s*المتحدة|واشنطن/gi, name: 'USA', type: 'COUNTRY' },
    { pattern: /venezuela|فنزويلا|فينزويلا/gi, name: 'Venezuela', type: 'COUNTRY' },
    { pattern: /ukraine|ukrainian|أوكرانيا|اوكرانيا|كييف/gi, name: 'Ukraine', type: 'COUNTRY' },
    { pattern: /saudi|السعودية|سعودي|الرياض/gi, name: 'Saudi Arabia', type: 'COUNTRY' },
    { pattern: /israel|israeli|إسرائيل|اسرائيل|إسرائيلي/gi, name: 'Israel', type: 'COUNTRY' },
    { pattern: /egypt|egyptian|مصر|مصري|القاهرة/gi, name: 'Egypt', type: 'COUNTRY' },
    { pattern: /turkey|turkish|تركيا|تركي|أنقرة/gi, name: 'Turkey', type: 'COUNTRY' },
    { pattern: /india|indian|الهند|هندي/gi, name: 'India', type: 'COUNTRY' },
    { pattern: /japan|japanese|اليابان|ياباني/gi, name: 'Japan', type: 'COUNTRY' },
    { pattern: /germany|german|ألمانيا|المانيا|ألماني/gi, name: 'Germany', type: 'COUNTRY' },
    { pattern: /france|french|فرنسا|فرنسي/gi, name: 'France', type: 'COUNTRY' },
    { pattern: /uk|britain|british|بريطانيا|بريطاني|لندن/gi, name: 'UK', type: 'COUNTRY' },
    { pattern: /tunisia|tunisian|تونس/gi, name: 'Tunisia', type: 'COUNTRY' },
    { pattern: /algeria|algerian|الجزائر/gi, name: 'Algeria', type: 'COUNTRY' },
    { pattern: /morocco|moroccan|المغرب/gi, name: 'Morocco', type: 'COUNTRY' },
    { pattern: /libya|libyan|ليبيا/gi, name: 'Libya', type: 'COUNTRY' },
    { pattern: /sudan|sudanese|السودان/gi, name: 'Sudan', type: 'COUNTRY' },
    { pattern: /iraq|iraqi|العراق/gi, name: 'Iraq', type: 'COUNTRY' },
    { pattern: /syria|syrian|سوريا/gi, name: 'Syria', type: 'COUNTRY' },
    { pattern: /lebanon|lebanese|لبنان/gi, name: 'Lebanon', type: 'COUNTRY' },
    { pattern: /jordan|jordanian|الأردن/gi, name: 'Jordan', type: 'COUNTRY' },
    { pattern: /palestine|palestinian|فلسطين/gi, name: 'Palestine', type: 'COUNTRY' },
    { pattern: /yemen|yemeni|اليمن/gi, name: 'Yemen', type: 'COUNTRY' },
    { pattern: /uae|emirates|الإمارات/gi, name: 'UAE', type: 'COUNTRY' },
    { pattern: /qatar|qatari|قطر/gi, name: 'Qatar', type: 'COUNTRY' },
    { pattern: /kuwait|kuwaiti|الكويت/gi, name: 'Kuwait', type: 'COUNTRY' },
    { pattern: /bahrain|bahraini|البحرين/gi, name: 'Bahrain', type: 'COUNTRY' },
    { pattern: /oman|omani|عمان/gi, name: 'Oman', type: 'COUNTRY' },
  ];
  
  // ARABIC TOPICS (expanded)
  const arabicTopics = {
    'تحويلات': 'remittances', 'أمن': 'security', 'اقتصاد': 'economy',
    'نفط': 'oil', 'بترول': 'petroleum', 'غاز': 'gas', 'طاقة': 'energy',
    'حرب': 'war', 'سلام': 'peace', 'صراع': 'conflict',
    'انتخابات': 'elections', 'تصويت': 'voting',
    'رئيس': 'president', 'حكومة': 'government', 'برلمان': 'parliament',
    'بنك': 'bank', 'دولار': 'dollar', 'يورو': 'euro', 'ذهب': 'gold',
    'فائدة': 'interest', 'تضخم': 'inflation', 'بطالة': 'unemployment',
    'استثمار': 'investment', 'ديون': 'debt', 'عملة': 'currency',
    'رسوم جمركية': 'tariffs', 'عقوبات': 'sanctions', 'حصار': 'blockade',
    'لاجئين': 'refugees', 'هجرة': 'immigration',
    'نووي': 'nuclear', 'صواريخ': 'missiles', 'أسلحة': 'weapons'
  };
  
  // TOPICS (expanded)
  const topics = [
    // Trade & Tariffs
    { pattern: /tariff|تعريف|جمارك|جمركي|رسوم\s*جمركية/gi, name: 'tariffs', type: 'TOPIC' },
    { pattern: /trade\s*war|حرب\s*تجارية/gi, name: 'trade_war', type: 'TOPIC' },
    { pattern: /trade|تجار|التجارة/gi, name: 'trade', type: 'TOPIC' },
    { pattern: /import|export|صادر|وارد/gi, name: 'trade', type: 'TOPIC' },
    
    // Finance & Banking
    { pattern: /credit\s*card|بطاقات?\s*(الائتمان|ائتمان|الإئتمان)/gi, name: 'credit_cards', type: 'TOPIC' },
    { pattern: /bank|بنك|بنوك|مصرف/gi, name: 'banking', type: 'TOPIC' },
    { pattern: /interest\s*rate|سعر\s*الفائدة|فائدة/gi, name: 'interest_rates', type: 'TOPIC' },
    { pattern: /fed|federal\s*reserve|الفيدرالي|الاحتياطي/gi, name: 'federal_reserve', type: 'TOPIC' },
    
    // Consumer & Economy
    { pattern: /consumer|مستهلك|المستهلكين/gi, name: 'consumer', type: 'TOPIC' },
    { pattern: /exploit|استغلال/gi, name: 'exploitation', type: 'TOPIC' },
    { pattern: /inflation|تضخم|التضخم/gi, name: 'inflation', type: 'TOPIC' },
    { pattern: /recession|ركود|الركود/gi, name: 'recession', type: 'TOPIC' },
    { pattern: /economy|economic|اقتصاد|اقتصادي/gi, name: 'economy', type: 'TOPIC' },
    { pattern: /unemployment|بطالة/gi, name: 'unemployment', type: 'TOPIC' },
    { pattern: /debt|ديون/gi, name: 'debt', type: 'TOPIC' },
    { pattern: /currency|عملة/gi, name: 'currency', type: 'TOPIC' },
    { pattern: /remittances|تحويلات/gi, name: 'remittances', type: 'TOPIC' },
    
    // Energy
    { pattern: /oil|petroleum|نفط|النفط|بترول/gi, name: 'oil', type: 'TOPIC' },
    { pattern: /gas|natural\s*gas|غاز|الغاز/gi, name: 'gas', type: 'TOPIC' },
    { pattern: /energy|طاقة/gi, name: 'energy', type: 'TOPIC' },
    { pattern: /opec|أوبك/gi, name: 'opec', type: 'TOPIC' },
    
    // Politics & Conflict
    { pattern: /protest|تظاهر|مظاهر|احتجاج|تظاهرات/gi, name: 'protests', type: 'TOPIC' },
    { pattern: /sanction|عقوب|العقوبات/gi, name: 'sanctions', type: 'TOPIC' },
    { pattern: /blockade|حصار/gi, name: 'blockade', type: 'TOPIC' },
    { pattern: /war(?!\s*trade)|حرب(?!\s*تجارية)/gi, name: 'war', type: 'TOPIC' },
    { pattern: /conflict|صراع/gi, name: 'conflict', type: 'TOPIC' },
    { pattern: /peace|سلام/gi, name: 'peace', type: 'TOPIC' },
    { pattern: /nuclear|نووي|النووي/gi, name: 'nuclear', type: 'TOPIC' },
    { pattern: /missiles|صواريخ/gi, name: 'missiles', type: 'TOPIC' },
    { pattern: /weapons|أسلحة/gi, name: 'weapons', type: 'TOPIC' },
    { pattern: /election|انتخاب|الانتخابات|تصويت/gi, name: 'election', type: 'TOPIC' },
    { pattern: /military|عسكري|الجيش/gi, name: 'military', type: 'TOPIC' },
    { pattern: /government|حكومة/gi, name: 'government', type: 'TOPIC' },
    { pattern: /parliament|برلمان/gi, name: 'parliament', type: 'TOPIC' },
    { pattern: /refugees|لاجئين/gi, name: 'refugees', type: 'TOPIC' },
    { pattern: /immigration|هجرة/gi, name: 'immigration', type: 'TOPIC' },
    
    // Technology
    { pattern: /\bai\b|artificial\s*intelligence|الذكاء\s*الاصطناعي|ذكاء\s*اصطناعي/gi, name: 'ai', type: 'TOPIC' },
    { pattern: /chip|semiconductor|رقاقة|رقائق|أشباه\s*الموصلات/gi, name: 'chips', type: 'TOPIC' },
    { pattern: /nvidia|نفيديا/gi, name: 'nvidia', type: 'TOPIC' },
    
    // Crypto
    { pattern: /bitcoin|بيتكوين/gi, name: 'bitcoin', type: 'TOPIC' },
    { pattern: /crypto|cryptocurrency|كريبتو|عملات?\s*رقمية/gi, name: 'crypto', type: 'TOPIC' },
    
    // Commodities
    { pattern: /gold|ذهب|الذهب/gi, name: 'gold', type: 'TOPIC' },
    { pattern: /dollar|دولار|الدولار/gi, name: 'dollar', type: 'TOPIC' },
    { pattern: /euro|يورو/gi, name: 'euro', type: 'TOPIC' },
  ];
  
  // ARABIC ORGANIZATIONS (expanded)
  const arabicOrganizations = {
    'قسد': 'SDF', 'داعش': 'ISIS', 'القاعدة': 'Al-Qaeda',
    'حماس': 'Hamas', 'حزب الله': 'Hezbollah', 'فتح': 'Fatah',
    'الناتو': 'NATO', 'أوبك': 'OPEC', 'بريكس': 'BRICS',
    'الأمم المتحدة': 'UN', 'صندوق النقد': 'IMF',
    'البنك الدولي': 'World Bank', 'الاتحاد الأوروبي': 'EU',
    'جامعة الدول العربية': 'Arab League', 'مجلس التعاون': 'GCC'
  };
  
  // ORGANIZATIONS
  const organizations = [
    { pattern: /apple|آبل|أبل/gi, name: 'Apple', type: 'ORG' },
    { pattern: /google|جوجل|غوغل/gi, name: 'Google', type: 'ORG' },
    { pattern: /microsoft|مايكروسوفت/gi, name: 'Microsoft', type: 'ORG' },
    { pattern: /amazon|أمازون/gi, name: 'Amazon', type: 'ORG' },
    { pattern: /tesla|تسلا/gi, name: 'Tesla', type: 'ORG' },
    { pattern: /meta|facebook|فيسبوك|ميتا/gi, name: 'Meta', type: 'ORG' },
    { pattern: /openai/gi, name: 'OpenAI', type: 'ORG' },
    { pattern: /nato|الناتو/gi, name: 'NATO', type: 'ORG' },
    { pattern: /opec|أوبك/gi, name: 'OPEC', type: 'ORG' },
    { pattern: /brics|بريكس/gi, name: 'BRICS', type: 'ORG' },
    { pattern: /imf|صندوق\s*النقد/gi, name: 'IMF', type: 'ORG' },
    { pattern: /world\s*bank|البنك\s*الدولي/gi, name: 'World Bank', type: 'ORG' },
    { pattern: /eu|الاتحاد\s*الأوروبي/gi, name: 'EU', type: 'ORG' },
    { pattern: /hamas|حماس/gi, name: 'Hamas', type: 'ORG' },
    { pattern: /hezbollah|حزب\s*الله/gi, name: 'Hezbollah', type: 'ORG' },
    { pattern: /fatah|فتح/gi, name: 'Fatah', type: 'ORG' },
    { pattern: /isis|داعش|القاعدة/gi, name: 'ISIS', type: 'ORG' },
  ];
  
  // Process regex patterns
  [...people, ...countries, ...topics, ...organizations].forEach(({ pattern, name, type }) => {
    if (pattern.test(text)) {
      if (!entities.find(e => e.name === name && e.type === type)) {
        entities.push({ name, type });
      }
    }
  });
  
  // Process Arabic dictionaries (simple text matching)
  for (const [arabic, english] of Object.entries(arabicCountries)) {
    if (text.includes(arabic) && !entities.find(e => e.name === english && e.type === 'COUNTRY')) {
      entities.push({ name: english, type: 'COUNTRY' });
    }
  }
  
  for (const [arabic, english] of Object.entries(arabicOrganizations)) {
    if (text.includes(arabic) && !entities.find(e => e.name === english && e.type === 'ORG')) {
      entities.push({ name: english, type: 'ORG' });
    }
  }
  
  for (const [arabic, english] of Object.entries(arabicTopics)) {
    if (text.includes(arabic) && !entities.find(e => e.name === english && e.type === 'TOPIC')) {
      entities.push({ name: english, type: 'TOPIC' });
    }
  }
  
  return entities;
}

// ============================================
// PART 3: ENTITY EXTRACTION - AI (SMART)
// ============================================

/**
 * Use AI to extract entities when regex isn't enough
 * Cost: ~$0.0003 per extraction
 */
async function extractEntitiesWithAI(title, description = '') {
  if (!openai) {
    console.warn('OpenAI not available, skipping AI extraction');
    return null;
  }
  
  // Double-check: skip short/irrelevant text even in AI extraction
  const fullText = `${title} ${description}`.trim();
  if (!shouldExtractEntities(fullText, 'signal')) {
    console.log(`⏭️ Skipping AI extraction for short/irrelevant text`);
    return null;
  }
  
  try {
    const text = description ? `${title}\n${description}` : title;
    
    const response = await openai.chat.completions.create({
      model: CONFIG.EXTRACTION_MODEL,
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are an entity extractor. Extract entities from news headlines/descriptions.
Return ONLY valid JSON with this structure:
{
  "people": ["Person Name"],
  "countries": ["Country Name"],
  "organizations": ["Org Name"],
  "topics": ["topic_keyword"]
}

Rules:
- Use English names for people and countries (e.g., "China" not "الصين")
- Topics should be lowercase keywords (e.g., "tariffs", "oil", "protests")
- Only include clearly mentioned entities
- If unsure, omit rather than guess`
        },
        {
          role: 'user',
          content: text
        }
      ]
    });
    
    const content = response.choices[0]?.message?.content || '{}';
    
    // Parse JSON, handling potential markdown code blocks
    let parsed;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch {
      console.error('Failed to parse AI response:', content);
      return null;
    }
    
    // Convert to our entity format
    const entities = [];
    
    (parsed.people || []).forEach(name => {
      entities.push({ name, type: 'PERSON' });
    });
    
    (parsed.countries || []).forEach(name => {
      entities.push({ name, type: 'COUNTRY' });
    });
    
    (parsed.organizations || []).forEach(name => {
      entities.push({ name, type: 'ORG' });
    });
    
    (parsed.topics || []).forEach(name => {
      entities.push({ name: name.toLowerCase(), type: 'TOPIC' });
    });
    
    console.log('🤖 AI extracted:', entities);
    return entities;
    
  } catch (error) {
    console.error('AI extraction error:', error);
    return null;
  }
}

// ============================================
// PART 4: HELPER FUNCTIONS
// ============================================

function countEntities(entities) {
  if (!entities || !Array.isArray(entities)) return 0;
  return entities.length;
}

function mergeEntities(regex, ai) {
  if (!ai) return regex;
  
  const merged = [...regex];
  const existingNames = new Set(regex.map(e => e.name.toLowerCase()));
  
  for (const entity of ai) {
    if (!existingNames.has(entity.name.toLowerCase())) {
      merged.push(entity);
      existingNames.add(entity.name.toLowerCase());
    }
  }
  
  return merged;
}

function classifyEntities(entities) {
  const classified = {
    people: [],
    countries: [],
    organizations: [],
    topics: []
  };
  
  for (const entity of entities) {
    const type = entity.type?.toUpperCase();
    const name = entity.name;
    
    switch (type) {
      case 'PERSON':
      case 'PER':
        if (!classified.people.includes(name)) classified.people.push(name);
        break;
      case 'COUNTRY':
      case 'GPE':
      case 'LOC':
        if (!classified.countries.includes(name)) classified.countries.push(name);
        break;
      case 'ORG':
      case 'ORGANIZATION':
        if (!classified.organizations.includes(name)) classified.organizations.push(name);
        break;
      default:
        if (!classified.topics.includes(name)) classified.topics.push(name);
    }
  }
  
  return classified;
}

function determineTopicCategory(entities, text) {
  const { people, countries, topics } = entities;
  const hasUSA = countries.includes('USA');
  const hasChina = countries.includes('China');
  const hasRussia = countries.includes('Russia');
  const hasIran = countries.includes('Iran');
  const hasUkraine = countries.includes('Ukraine');
  const hasTrump = people.includes('Trump');
  
  // Credit cards / Consumer finance
  if (topics.some(t => ['credit_cards', 'consumer', 'exploitation', 'banking'].includes(t))) {
    if (hasUSA || hasTrump || /أمريك|امريك|american/i.test(text)) {
      return 'us_domestic_finance';
    }
    return 'consumer_finance';
  }
  
  // US-China relations
  if ((hasUSA || hasTrump) && hasChina) {
    if (topics.some(t => ['tariffs', 'trade', 'trade_war'].includes(t))) return 'us_china_trade';
    if (topics.some(t => ['ai', 'chips', 'nvidia'].includes(t))) return 'us_china_tech';
    return 'us_china_geopolitics';
  }
  
  // China + tariffs (implies US)
  if (hasChina && topics.some(t => ['tariffs', 'trade', 'trade_war'].includes(t))) {
    return 'us_china_trade';
  }
  
  // Russia-Ukraine
  if (hasRussia || hasUkraine) {
    if (topics.includes('war')) return 'russia_ukraine_war';
    return 'russia_relations';
  }
  
  // Iran
  if (hasIran) {
    if (topics.includes('nuclear')) return 'iran_nuclear';
    if (topics.includes('protests')) return 'iran_domestic';
    if (topics.includes('sanctions')) return 'iran_sanctions';
    return 'iran_general';
  }
  
  // US Domestic
  if (hasUSA && countries.length === 1) {
    if (topics.some(t => ['inflation', 'recession', 'economy'].includes(t))) return 'us_economy';
    if (topics.includes('election')) return 'us_politics';
    return 'us_domestic';
  }
  
  // Energy
  if (topics.some(t => ['oil', 'gas', 'opec'].includes(t))) return 'energy';
  
  // Tech
  if (topics.some(t => ['ai', 'chips', 'nvidia'].includes(t))) return 'technology';
  
  // Crypto
  if (topics.some(t => ['bitcoin', 'crypto'].includes(t))) return 'crypto';
  
  // Gold/Commodities
  if (topics.some(t => ['gold', 'dollar'].includes(t))) return 'commodities';
  
  return 'general';
}

function detectLanguage(text) {
  if (!text) return 'en';
  
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
  const arabicMatches = text.match(arabicPattern) || [];
  const arabicCount = arabicMatches.length;
  
  // Count all characters (excluding spaces)
  const totalChars = text.replace(/\s/g, '').length;
  
  const arabicRatio = totalChars > 0 ? arabicCount / totalChars : 0;
  return arabicRatio > 0.25 ? 'ar' : 'en';
}

function generateShortFingerprint(entities, category) {
  const parts = [
    category,
    ...entities.people.slice(0, 2).map(p => p.toLowerCase()),
    ...entities.countries.slice(0, 2).map(c => c.toLowerCase()),
    ...entities.topics.slice(0, 3).map(t => t.toLowerCase())
  ];
  return parts.filter(Boolean).join('|');
}

// ============================================
// PART 5: EMBEDDINGS
// ============================================

const embeddingCache = new Map();
const CACHE_MAX_SIZE = 1000;

export async function getEmbedding(text) {
  if (!openai || !text) return null;
  
  const cacheKey = text.substring(0, 200).toLowerCase().trim();
  
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }
  
  try {
    const response = await openai.embeddings.create({
      model: CONFIG.EMBEDDING_MODEL,
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
  } catch (error) {
    console.error('Embedding error:', error);
    return null;
  }
}

export function cosineSimilarity(a, b) {
  if (!a || !b || !Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  
  let dot = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dot / denominator;
}

// ============================================
// PART 6: COMPARISON FUNCTIONS
// ============================================

/**
 * Main comparison function - used by all other functions
 */
export async function compareTopics(item1, item2, options = {}) {
  const { 
    requireSameStory = false,
    similarityThreshold = CONFIG.RELATED_THRESHOLD,
  } = options;
  
  // Generate fingerprints - use cached entities if provided to avoid re-extraction
  let fp1 = item1.fingerprint;
  let fp2 = item2.fingerprint;
  
  // If entities are provided, pass them to avoid re-extraction
  if (!fp1) {
    fp1 = await generateTopicFingerprint(item1, { 
      entities: item1.entities || null, // Pass cached entities if available
      skipEmbedding: true // Skip embedding for competitor videos (faster, not needed for matching)
    });
  }
  
  if (!fp2) {
    fp2 = await generateTopicFingerprint(item2, { 
      entities: item2.entities || null, // Pass cached entities if available
      skipEmbedding: true // Skip embedding for competitor videos (faster, not needed for matching)
    });
  }
  
  // Check category match
  const sameCategory = fp1.topicCategory === fp2.topicCategory;
  
  // Analyze entity overlap
  const entityOverlap = analyzeEntityOverlap(fp1.entities, fp2.entities);
  
  // Calculate semantic similarity
  let semanticSimilarity = 0;
  if (fp1.embedding && fp2.embedding) {
    semanticSimilarity = cosineSimilarity(fp1.embedding, fp2.embedding);
  }
  
  // Detect cross-language
  const isCrossLanguage = fp1.language !== fp2.language;
  
  // Analyze overlap quality
  const hasTopicOverlap = entityOverlap.details.topics?.length > 0;
  const hasCountryOverlap = entityOverlap.details.countries?.length > 0;
  const hasOnlyPersonOverlap = entityOverlap.details.people?.length > 0 && 
                                !hasTopicOverlap && !hasCountryOverlap;
  
  // Adjust thresholds for cross-language
  const sameStoryThreshold = isCrossLanguage ? CONFIG.CROSS_LANG_SAME_STORY_THRESHOLD : CONFIG.SAME_STORY_THRESHOLD;
  const relatedThreshold = isCrossLanguage ? 0.50 : CONFIG.RELATED_THRESHOLD;
  
  // Determine relationship
  let relationship = 'unrelated';
  let confidence = 0;
  
  // Same story detection
  if (semanticSimilarity >= sameStoryThreshold && entityOverlap.score >= 0.4) {
    relationship = 'same_story';
    confidence = Math.max(semanticSimilarity, entityOverlap.score);
  }
  // Cross-language with good entity match
  else if (isCrossLanguage && entityOverlap.score >= 0.5 && (hasTopicOverlap || hasCountryOverlap)) {
    relationship = 'same_story';
    confidence = entityOverlap.score;
  }
  // High semantic similarity alone
  else if (semanticSimilarity >= sameStoryThreshold) {
    relationship = 'same_story';
    confidence = semanticSimilarity;
  }
  // Related topic (requires more than just person)
  else if ((semanticSimilarity >= relatedThreshold || 
           (sameCategory && entityOverlap.score >= 0.3)) && 
           !hasOnlyPersonOverlap) {
    relationship = 'related_topic';
    confidence = Math.max(semanticSimilarity, entityOverlap.score);
  }
  // Person-only overlap with low semantic = unrelated
  else if (hasOnlyPersonOverlap && semanticSimilarity < relatedThreshold) {
    relationship = 'unrelated';
    confidence = 1 - semanticSimilarity;
  }
  // Loosely related
  else if ((sameCategory && !hasOnlyPersonOverlap) || entityOverlap.score >= 0.3) {
    relationship = 'loosely_related';
    confidence = Math.max(entityOverlap.score, 0.4);
  }
  
  // Final match decision
  const isMatch = requireSameStory 
    ? relationship === 'same_story'
    : relationship !== 'unrelated';
  
  return {
    isMatch,
    relationship,
    confidence,
    sameCategory,
    semanticSimilarity,
    entityOverlap: entityOverlap.details,
    entityScore: entityOverlap.score,
    isCrossLanguage,
    fingerprints: { 
      fp1: fp1.fingerprint, 
      fp2: fp2.fingerprint,
      category1: fp1.topicCategory,
      category2: fp2.topicCategory
    },
    reason: `${relationship} - Entities: ${formatOverlap(entityOverlap.details)} | Semantic: ${Math.round(semanticSimilarity * 100)}%`
  };
}

function analyzeEntityOverlap(e1, e2) {
  const findOverlap = (arr1 = [], arr2 = []) => {
    const set2 = new Set(arr2.map(x => x.toLowerCase()));
    return arr1.filter(x => set2.has(x.toLowerCase()));
  };
  
  const overlap = {
    people: findOverlap(e1.people, e2.people),
    countries: findOverlap(e1.countries, e2.countries),
    organizations: findOverlap(e1.organizations, e2.organizations),
    topics: findOverlap(e1.topics, e2.topics),
  };
  
  // Calculate weighted score (topics and countries matter more)
  const weights = { people: 1, countries: 2.5, organizations: 1.5, topics: 2.5 };
  
  let totalWeight = 0;
  let matchedWeight = 0;
  
  for (const [key, items] of Object.entries(overlap)) {
    const weight = weights[key];
    const total1 = e1[key]?.length || 0;
    const total2 = e2[key]?.length || 0;
    const matched = items.length;
    
    if (total1 > 0 || total2 > 0) {
      totalWeight += weight;
      if (matched > 0) {
        matchedWeight += weight * (matched / Math.max(total1, total2, 1));
      }
    }
  }
  
  return {
    score: totalWeight > 0 ? matchedWeight / totalWeight : 0,
    details: overlap
  };
}

function formatOverlap(overlap) {
  const parts = [];
  if (overlap.people?.length) parts.push(`people: ${overlap.people.join(', ')}`);
  if (overlap.countries?.length) parts.push(`countries: ${overlap.countries.join(', ')}`);
  if (overlap.topics?.length) parts.push(`topics: ${overlap.topics.join(', ')}`);
  if (overlap.organizations?.length) parts.push(`orgs: ${overlap.organizations.join(', ')}`);
  return parts.join('; ') || 'none';
}

// ============================================
// PART 7: SPECIALIZED FUNCTIONS (Public API)
// ============================================

/**
 * Check if competitor video is relevant to idea
 * Uses weighted scoring to require multiple entity overlaps (no AI needed)
 */
export async function isRelevantCompetitorVideo(idea, video) {
  const result = await compareTopics(
    { title: idea.title || idea, ...idea },
    { title: video.title || video, ...video },
    { requireSameStory: false }
  );
  
  // Calculate match score based on entity overlaps (no AI - just smart comparison)
  // result.entityOverlap is the details object with people, countries, topics, organizations arrays
  const overlap = result.entityOverlap || {};
  
  let matchScore = 0;
  
  // People overlap (most specific - worth 3 points each)
  const peopleOverlap = (overlap.people || []).length;
  matchScore += peopleOverlap * 3;
  
  // Topic overlap (worth 2 points each)
  const topicOverlap = (overlap.topics || []).length;
  matchScore += topicOverlap * 2;
  
  // Organization overlap (worth 2 points each)
  const orgOverlap = (overlap.organizations || []).length;
  matchScore += orgOverlap * 2;
  
  // Country overlap (worth 1 point each - too common alone)
  const countryOverlap = (overlap.countries || []).length;
  matchScore += countryOverlap * 1;
  
  // Require minimum score of 3
  // Examples that pass:
  //   - 1 person match (3) ✅
  //   - 1 topic + 1 country (2+1=3) ✅
  //   - 1 org + 1 country (2+1=3) ✅
  //   - 3 countries (1+1+1=3) ✅
  // Examples that fail:
  //   - 1 country only (1) ❌
  //   - 2 countries only (2) ❌
  
  const isRelevant = matchScore >= 3;
  
  // Log weak matches for debugging
  if (!isRelevant && countryOverlap > 0 && peopleOverlap === 0 && topicOverlap === 0 && orgOverlap === 0) {
    console.log(`⚠️ Skipping weak competitor match (score ${matchScore}): only ${countryOverlap} country overlap - "${(idea.title || '').substring(0, 40)}" vs "${(video.title || '').substring(0, 40)}"`);
  }
  
  // Also allow high semantic similarity as fallback (for edge cases)
  const hasHighSemanticSimilarity = result.semanticSimilarity >= 0.75;
  
  const relevant = isRelevant || hasHighSemanticSimilarity;
  
  return {
    relevant,
    ...result,
    matchScore, // Include score for debugging
    displayMatches: [
      ...(overlap.people || []),
      ...(overlap.countries || []),
      ...(overlap.topics || []),
      ...(overlap.organizations || [])
    ]
  };
}

/**
 * Check if idea matches a DNA topic
 */
export async function matchesDNATopic(idea, dnaTopic) {
  const fp = await generateTopicFingerprint(idea);
  
  // Direct match
  if (fp.topicCategory === dnaTopic) {
    return { matches: true, ideaCategory: fp.topicCategory, dnaTopic, confidence: 0.95 };
  }
  
  // Partial match (same prefix)
  const ideaPrefix = fp.topicCategory.split('_')[0];
  const dnaPrefix = dnaTopic.split('_')[0];
  if (ideaPrefix === dnaPrefix) {
    return { matches: true, ideaCategory: fp.topicCategory, dnaTopic, confidence: 0.7 };
  }
  
  return { matches: false, ideaCategory: fp.topicCategory, dnaTopic, confidence: 0.1 };
}

/**
 * Check if two signals are about the same story
 */
export async function isSameStory(signal1, signal2) {
  const result = await compareTopics(
    { title: signal1.title || signal1, ...signal1 },
    { title: signal2.title || signal2, ...signal2 },
    { requireSameStory: true }
  );
  
  return {
    sameStory: result.relationship === 'same_story',
    ...result
  };
}

/**
 * Check if topic has been covered before
 */
export async function hasBeenCovered(idea, videos) {
  if (!videos || videos.length === 0) {
    return { covered: false };
  }
  
  for (const video of videos) {
    const result = await compareTopics(
      { title: idea.title || idea, ...idea },
      { title: video.title || video, ...video },
      { requireSameStory: true }
    );
    
    if (result.relationship === 'same_story' && result.confidence >= 0.7) {
      return { covered: true, matchingVideo: video, ...result };
    }
  }
  return { covered: false };
}

/**
 * Find signals that should be grouped together
 */
export async function groupRelatedSignals(signals) {
  if (!signals || signals.length === 0) {
    return [];
  }
  
  const groups = [];
  const used = new Set();
  
  for (let i = 0; i < signals.length; i++) {
    if (used.has(i)) continue;
    
    const group = [signals[i]];
    used.add(i);
    
    for (let j = i + 1; j < signals.length; j++) {
      if (used.has(j)) continue;
      
      const result = await isSameStory(signals[i], signals[j]);
      if (result.sameStory) {
        group.push(signals[j]);
        used.add(j);
      }
    }
    
    groups.push(group);
  }
  
  return groups;
}

// ============================================
// PART 8: CACHING
// ============================================

async function cacheFingerprint(itemId, itemType, fingerprint) {
  try {
    // Ensure itemId is a string
    const stringItemId = String(itemId || 'unknown');
    const stringItemType = String(itemType || 'signal');
    
    // Don't cache the full embedding to save space, just the essential data
    const cacheData = {
      item_id: stringItemId,
      item_type: stringItemType,
      fingerprint_str: fingerprint.fingerprint || '',
      entities: fingerprint.entities || {},
      topic_category: fingerprint.topicCategory || 'general',
      language: fingerprint.language || 'en',
      extraction_method: fingerprint.extractionMethod || 'regex',
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('topic_fingerprints')
      .upsert(cacheData, { 
        onConflict: 'item_id,item_type',
        ignoreDuplicates: false 
      })
      .select();
    
    if (error) {
      // Only log errors (not successes) to reduce noise
      console.error('❌ Cache save ERROR:', {
        code: error.code,
        message: error.message,
        itemId: stringItemId,
        itemType: stringItemType,
        details: error.details,
        hint: error.hint
      });
    }
    // Removed success logging - too verbose, only log errors
  } catch (e) {
    console.error('❌ Cache save EXCEPTION:', e.message);
    // Only log message, not full stack in production
    if (process.env.NODE_ENV === 'development') {
      console.error('Stack:', e.stack);
    }
  }
}

async function getCachedFingerprint(itemId, itemType) {
  try {
    // Ensure itemId is a string for comparison
    const stringItemId = String(itemId || '');
    const stringItemType = String(itemType || 'signal');
    
    const { data, error } = await supabase
      .from('topic_fingerprints')
      .select('*')
      .eq('item_id', stringItemId)
      .eq('item_type', stringItemType)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found, which is fine
      // Silent - cache misses are expected for new items
      return null;
    }
    
    if (data) {
      // Check if cache is still valid
      const cacheAge = Date.now() - new Date(data.updated_at).getTime();
      const maxAge = CONFIG.CACHE_HOURS * 60 * 60 * 1000;
      
      if (cacheAge < maxAge) {
        return {
          title: data.title || null,
          fingerprint: data.fingerprint_str,
          entities: data.entities,
          topicCategory: data.topic_category,
          language: data.language,
          extractionMethod: data.extraction_method,
          embedding: null, // Will regenerate if needed
          fromCache: true,
          generatedAt: data.updated_at
        };
      }
    }
  } catch (error) {
    // Not found or error - will generate fresh
  }
  return null;
}

// ============================================
// EXPORTS
// ============================================

/**
 * Batch process multiple signals with parallel processing
 */
export async function processSignalsBatch(signals, options = {}) {
  const { 
    batchSize = 10,
    skipEmbedding = true,
    skipCache = false 
  } = options;
  
  const results = [];
  
  for (let i = 0; i < signals.length; i += batchSize) {
    const batch = signals.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(signals.length / batchSize);
    
    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} items)...`);
    
    const batchResults = await Promise.all(
      batch.map(signal => 
        generateTopicFingerprint({
          title: signal.title || signal.topic || '',
          description: signal.description || '',
          id: signal.id,
          type: signal.type || 'signal'
        }, {
          skipEmbedding,
          skipCache
        }).catch(err => {
          console.error(`Error processing signal "${signal.title?.substring(0, 30)}":`, err.message);
          return null;
        })
      )
    );
    
    results.push(...batchResults.filter(r => r !== null));
  }
  
  console.log(`✅ Processed ${results.length}/${signals.length} signals successfully`);
  return results;
}

export default {
  generateTopicFingerprint,
  processSignalsBatch,
  compareTopics,
  isRelevantCompetitorVideo,
  matchesDNATopic,
  isSameStory,
  hasBeenCovered,
  groupRelatedSignals,
  getEmbedding,
  cosineSimilarity,
};
