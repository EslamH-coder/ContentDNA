/**
 * Story Signature Library
 * Automatically detects and groups signals about the same story
 * 
 * Example: 15 Venezuela signals → grouped into 1 story → keep best 3 angles
 * 
 * NOW USES TOPIC INTELLIGENCE for accurate story grouping
 */

import { generateTopicFingerprint, compareTopics, isSameStory, groupRelatedSignals } from './topicIntelligence';

// Keep groupRelatedSignals import for fallback (slow AI-based grouping)

// ============================================
// TOPIC INTELLIGENCE-BASED FUNCTIONS (NEW)
// ============================================

/**
 * Calculate story signature similarity using Topic Intelligence
 * Replaces keyword-based similarity calculation
 */
export async function calculateSignatureSimilarity(signal1, signal2) {
  const result = await compareTopics(
    { title: signal1.title, description: signal1.description || '', id: signal1.id },
    { title: signal2.title, description: signal2.description || '', id: signal2.id }
  );
  
  return {
    similarity: result.confidence,
    isSameStory: result.relationship === 'same_story',
    relationship: result.relationship,
    entityOverlap: result.entityOverlap,
    semanticSimilarity: result.semanticSimilarity,
    // Legacy compatibility
    score: result.confidence,
    matched: result.relationship === 'same_story' || result.relationship === 'related'
  };
}

/**
 * Generate a story signature for a signal using Topic Intelligence
 * Replaces keyword-based signature extraction
 */
export async function generateStorySignature(signal) {
  const fingerprint = await generateTopicFingerprint({
    title: signal.title,
    description: signal.description || '',
    id: signal.id,
    type: 'signal'
  });
  
  return {
    // New fingerprint-based signature
    fingerprint: fingerprint.fingerprint,
    category: fingerprint.topicCategory,
    entities: fingerprint.entities,
    language: fingerprint.language,
    
    // Legacy compatibility fields
    signature: fingerprint.fingerprint,
    signatureKey: fingerprint.topicCategory, // Use category as key
    topics: fingerprint.entities.topics,
    people: fingerprint.entities.people,
    countries: fingerprint.entities.countries,
    organizations: fingerprint.entities.organizations || [],
    keywords: [
      ...fingerprint.entities.topics,
      ...fingerprint.entities.countries,
      ...fingerprint.entities.people,
      ...(fingerprint.entities.organizations || [])
    ],
    action: fingerprint.topicCategory.split('_')[0] || 'general',
    numbers: [] // Numbers extracted separately if needed
  };
}

/**
 * Check if two signals are about the same story
 */
export async function areSameStory(signal1, signal2, threshold = 0.7) {
  const result = await isSameStory(signal1, signal2);
  return result.sameStory && result.confidence >= threshold;
}

/**
 * Fast keyword-based grouping (replaces slow AI-based grouping)
 * Groups signals by key topics/entities without expensive AI calls
 */
function extractGroupingKey(signal) {
  const title = (signal.title || '').toLowerCase();
  
  // Key topics to group by (order matters - more specific first)
  const groupingTopics = [
    { key: 'iran', patterns: ['iran', 'إيران', 'iranian', 'طهران', 'tehran'] },
    { key: 'venezuela', patterns: ['venezuela', 'فنزويلا', 'maduro', 'مادورو'] },
    { key: 'trump', patterns: ['trump', 'ترامب', 'ترمب', 'donald trump'] },
    { key: 'china', patterns: ['china', 'الصين', 'chinese', 'beijing', 'بكين', 'شي جين بينغ'] },
    { key: 'russia', patterns: ['russia', 'روسيا', 'putin', 'moscow', 'بوتين', 'موسكو'] },
    { key: 'oil', patterns: ['oil', 'نفط', 'opec', 'petroleum', 'crude', 'بترول'] },
    { key: 'ai', patterns: ['ai ', 'artificial intelligence', 'الذكاء الاصطناعي', 'chatgpt', 'openai'] },
    { key: 'gaza', patterns: ['gaza', 'غزة', 'palestine', 'فلسطين', 'israel', 'إسرائيل'] },
    { key: 'ukraine', patterns: ['ukraine', 'أوكرانيا', 'zelensky', 'zelenskiy'] },
    { key: 'saudi', patterns: ['saudi', 'السعودية', 'mbs', 'bin salman', 'بن سلمان'] },
    { key: 'uae', patterns: ['uae', 'الإمارات', 'dubai', 'دبي', 'abu dhabi', 'أبو ظبي'] },
    { key: 'egypt', patterns: ['egypt', 'مصر', 'cairo', 'القاهرة'] },
    { key: 'gold', patterns: ['gold', 'ذهب', 'gold price', 'سعر الذهب'] },
    { key: 'dollar', patterns: ['dollar', 'دولار', 'usd', 'currency', 'عملة'] },
    { key: 'tesla', patterns: ['tesla', 'تسلا', 'musk', 'ماسك', 'elon'] },
    { key: 'nvidia', patterns: ['nvidia', 'إنفيديا', 'gpu', 'ai chip'] },
    { key: 'bitcoin', patterns: ['bitcoin', 'بتكوين', 'crypto', 'cryptocurrency', 'عملة رقمية'] },
  ];
  
  for (const { key, patterns } of groupingTopics) {
    if (patterns.some(p => title.includes(p))) {
      return key;
    }
  }
  
  // Fallback: use first few words as key
  const words = title.split(/\s+/).slice(0, 3).join('_');
  return words.length > 10 ? words.substring(0, 10) : words || 'other';
}

/**
 * Fast keyword-based grouping function
 */
function groupByKeywords(signals) {
  const stories = {};
  const startTime = Date.now();
  
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    
    // Progress logging every 50 signals
    if (i > 0 && i % 50 === 0) {
      console.log(`📰 Grouping progress: ${i}/${signals.length} signals processed`);
    }
    
    const key = extractGroupingKey(signal);
    
    if (!stories[key]) {
      stories[key] = {
        id: `story_${key}_${Date.now()}`,
        signals: [],
        representativeSignal: signal
      };
    }
    stories[key].signals.push(signal);
  }
  
  const duration = Date.now() - startTime;
  console.log(`⚡ Keyword grouping completed in ${duration}ms`);
  
  return Object.values(stories);
}

/**
 * Group signals by story similarity using fast keyword-based grouping
 * Falls back to AI-based grouping only if explicitly requested (and with limits)
 */
export async function groupSignalsByStory(signals, threshold = 0.7, options = {}) {
  if (!signals || signals.length === 0) return [];
  
  const {
    maxSignals = 100,  // Limit signals to process
    timeoutMs = 30000, // 30 second timeout
    useFastGrouping = true // Use fast keyword-based grouping by default
  } = options;
  
  console.log(`📰 Grouping ${signals.length} signals into stories...`);
  
  // Limit signals if too many
  const signalsToProcess = signals.slice(0, maxSignals);
  if (signals.length > maxSignals) {
    console.log(`⚠️ Limiting to ${maxSignals} signals (had ${signals.length})`);
  }
  
  // Use fast keyword-based grouping by default
  if (useFastGrouping) {
    console.log('⚡ Using fast keyword-based grouping...');
    const groups = groupByKeywords(signalsToProcess);
    console.log(`✅ Grouped ${signalsToProcess.length} signals into ${groups.length} stories`);
    return groups.map((group, index) => ({
      id: group.id || `story_${index}`,
      signals: group.signals,
      count: group.signals.length,
      representativeSignal: group.representativeSignal || group.signals[0]
    }));
  }
  
  // Fallback: AI-based grouping with timeout (only if explicitly requested)
  console.log('🤖 Using AI-based grouping (slower)...');
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Story grouping timeout')), timeoutMs)
  );
  
  try {
    const groups = await Promise.race([
      groupRelatedSignals(signalsToProcess),
      timeoutPromise
    ]);
    
    return groups.map((group, index) => ({
      id: `story_${index}`,
      signals: group,
      count: group.length,
      representativeSignal: group[0]
    }));
  } catch (error) {
    if (error.message === 'Story grouping timeout') {
      console.log('⚠️ Story grouping timed out, falling back to keyword grouping');
      // Fallback to fast grouping
      const groups = groupByKeywords(signalsToProcess);
      return groups.map((group, index) => ({
        id: group.id || `story_${index}`,
        signals: group.signals,
        count: group.signals.length,
        representativeSignal: group.representativeSignal || group.signals[0]
      }));
    }
    throw error;
  }
}

// ============================================
// LEGACY FUNCTIONS (DEPRECATED - kept for backward compatibility)
// ============================================

/**
 * Extract "story signature" from a signal - LEGACY (keyword-based)
 * @deprecated Use generateStorySignature() instead (uses Topic Intelligence)
 */
export function extractStorySignature(signal) {
  console.warn('⚠️ extractStorySignature is deprecated. Use generateStorySignature() instead.');
  const title = (signal.title || '').toLowerCase();
  const titleOriginal = signal.title || '';
  
  // Extract entities (countries, companies, people)
  const entities = extractEntities(title, titleOriginal);
  
  // Extract numbers (these make stories unique)
  const numbers = extractNumbers(titleOriginal);
  
  // Extract action/theme
  const action = extractAction(title, titleOriginal);
  
  // Create signature key for grouping
  const signatureKey = [...entities.slice(0, 3), action].filter(Boolean).sort().join('_');
  
  return {
    entities,      // ['venezuela', 'us', 'trump']
    numbers,       // ['$11.5B', '15%']
    action,        // 'crisis' | 'deal' | 'surge' | 'collapse'
    signatureKey,  // 'crisis_trump_us_venezuela'
    raw: { title: titleOriginal, source: signal.source }
  };
}

// Entity extraction - countries, companies, people
function extractEntities(title, titleOriginal) {
  const entities = [];
  
  // Countries (English + Arabic patterns)
  const countries = {
    'venezuela': ['venezuela', 'venezuelan', 'maduro', 'caracas', 'فنزويلا', 'مادورو'],
    'us': ['united states', ' us ', 'u.s.', 'america', 'american', 'washington', 'أمريكا', 'واشنطن'],
    'china': ['china', 'chinese', 'beijing', 'الصين', 'بكين', 'الصيني'],
    'saudi': ['saudi', 'riyadh', 'السعودية', 'الرياض', 'السعودي'],
    'iran': ['iran', 'iranian', 'tehran', 'إيران', 'طهران', 'الإيراني'],
    'russia': ['russia', 'russian', 'moscow', 'روسيا', 'موسكو', 'الروسي'],
    'egypt': ['egypt', 'egyptian', 'cairo', 'مصر', 'القاهرة', 'المصري'],
    'qatar': ['qatar', 'doha', 'قطر', 'الدوحة', 'القطري'],
    'uae': ['uae', 'emirates', 'dubai', 'abu dhabi', 'الإمارات', 'دبي', 'أبوظبي'],
    'turkey': ['turkey', 'turkish', 'ankara', 'erdogan', 'تركيا', 'أنقرة', 'أردوغان'],
    'germany': ['germany', 'german', 'berlin', 'ألمانيا', 'برلين', 'الألماني'],
    'uk': ['britain', 'british', 'uk', 'u.k.', 'london', 'بريطانيا', 'لندن'],
    'india': ['india', 'indian', 'delhi', 'mumbai', 'الهند', 'الهندي'],
    'japan': ['japan', 'japanese', 'tokyo', 'اليابان', 'طوكيو'],
    'taiwan': ['taiwan', 'taiwanese', 'taipei', 'تايوان'],
    'israel': ['israel', 'israeli', 'tel aviv', 'إسرائيل', 'تل أبيب'],
    'ukraine': ['ukraine', 'ukrainian', 'kyiv', 'kiev', 'أوكرانيا', 'كييف'],
    'syria': ['syria', 'syrian', 'damascus', 'سوريا', 'دمشق'],
    'iraq': ['iraq', 'iraqi', 'baghdad', 'العراق', 'بغداد'],
    'lebanon': ['lebanon', 'lebanese', 'beirut', 'لبنان', 'بيروت'],
    'jordan': ['jordan', 'jordanian', 'amman', 'الأردن', 'عمان'],
    'morocco': ['morocco', 'moroccan', 'rabat', 'المغرب', 'الرباط'],
    'algeria': ['algeria', 'algerian', 'algiers', 'الجزائر'],
    'sudan': ['sudan', 'sudanese', 'khartoum', 'السودان', 'الخرطوم'],
    'libya': ['libya', 'libyan', 'tripoli', 'ليبيا', 'طرابلس'],
    'kuwait': ['kuwait', 'kuwaiti', 'الكويت', 'الكويتي'],
    'bahrain': ['bahrain', 'bahraini', 'manama', 'البحرين', 'المنامة'],
    'oman': ['oman', 'omani', 'muscat', 'عمان', 'مسقط', 'العماني'],
  };
  
  // Major companies/organizations
  const companies = {
    'tesla': ['tesla', 'تسلا'],
    'apple': ['apple', 'iphone', 'أبل', 'آيفون'],
    'nvidia': ['nvidia', 'إنفيديا', 'نفيديا'],
    'amd': ['amd', ' amd '],
    'intel': ['intel', 'إنتل'],
    'google': ['google', 'alphabet', 'جوجل', 'غوغل'],
    'microsoft': ['microsoft', 'مايكروسوفت'],
    'amazon': ['amazon', 'aws', 'أمازون'],
    'meta': ['meta', 'facebook', 'instagram', 'ميتا', 'فيسبوك'],
    'openai': ['openai', 'chatgpt', 'gpt-4', 'أوبن إيه آي'],
    'anthropic': ['anthropic', 'claude'],
    'aramco': ['aramco', 'أرامكو'],
    'adnoc': ['adnoc', 'أدنوك'],
    'sabic': ['sabic', 'سابك'],
    'opec': ['opec', 'أوبك'],
    'fed': ['federal reserve', 'the fed', 'الفيدرالي', 'الاحتياطي'],
    'ecb': ['ecb', 'european central bank', 'المركزي الأوروبي'],
    'imf': ['imf', 'international monetary fund', 'صندوق النقد'],
    'world_bank': ['world bank', 'البنك الدولي'],
    'boeing': ['boeing', 'بوينغ'],
    'airbus': ['airbus', 'إيرباص'],
    'toyota': ['toyota', 'تويوتا'],
    'samsung': ['samsung', 'سامسونغ'],
    'asml': ['asml'],
    'tsmc': ['tsmc', 'taiwan semiconductor'],
    'jpmorgan': ['jpmorgan', 'jp morgan', 'جي بي مورغان'],
    'goldman': ['goldman sachs', 'goldman', 'غولدمان'],
    'blackrock': ['blackrock', 'بلاك روك'],
    'berkshire': ['berkshire', 'بيركشاير'],
    'softbank': ['softbank', 'سوفت بنك'],
  };
  
  // Key people
  const people = {
    'trump': ['trump', 'ترامب', 'ترمب'],
    'biden': ['biden', 'بايدن'],
    'musk': ['musk', 'elon musk', 'ماسك', 'إيلون'],
    'bezos': ['bezos', 'بيزوس'],
    'zuckerberg': ['zuckerberg', 'زوكربيرغ'],
    'cook': ['tim cook', 'تيم كوك'],
    'altman': ['sam altman', 'altman', 'ألتمان'],
    'dimon': ['dimon', 'jamie dimon', 'ديمون'],
    'buffett': ['buffett', 'warren buffett', 'بافيت'],
    'dalio': ['dalio', 'ray dalio', 'داليو'],
    'powell': ['powell', 'jerome powell', 'باول'],
    'lagarde': ['lagarde', 'christine lagarde', 'لاغارد'],
    'xi': ['xi jinping', 'xi', 'شي جين بينغ'],
    'putin': ['putin', 'بوتين'],
    'zelensky': ['zelensky', 'zelenskyy', 'زيلينسكي'],
    'netanyahu': ['netanyahu', 'نتنياهو'],
    'mbs': ['mbs', 'mohammed bin salman', 'محمد بن سلمان', 'ولي العهد السعودي'],
    'mbz': ['mbz', 'mohammed bin zayed', 'محمد بن زايد'],
    'erdogan': ['erdogan', 'أردوغان'],
    'maduro': ['maduro', 'مادورو'],
    'modi': ['modi', 'narendra modi', 'مودي'],
  };
  
  const allPatterns = { ...countries, ...companies, ...people };
  const combinedText = `${title} ${titleOriginal}`.toLowerCase();
  
  for (const [entity, patterns] of Object.entries(allPatterns)) {
    if (patterns.some(p => combinedText.includes(p.toLowerCase()))) {
      entities.push(entity);
    }
  }
  
  // ADD: Topic-specific keywords that should NOT group together
  // These add special "_topic_" markers to prevent wrong grouping
  const distinctTopics = {
    'tariffs': ['tariff', 'tariffs', 'تعريفات', 'رسوم جمركية', 'liberation day', 'يوم التحرير', 'trade war', 'حرب تجارية'],
    'venezuela': ['venezuela', 'venezuelan', 'maduro', 'caracas', 'فنزويلا', 'مادورو', 'venezuelan oil'],
    'iran': ['iran', 'iranian', 'tehran', 'إيران', 'طهران', 'nuclear deal', 'الاتفاق النووي'],
    'ukraine': ['ukraine', 'ukrainian', 'kyiv', 'kiev', 'أوكرانيا', 'كييف', 'russian invasion'],
    'china_trade': ['china trade', 'us-china', 'trade war', 'tariffs on china', 'الصين التجارة'],
    'oil_markets': ['oil price', 'crude oil', 'opec', 'نفط', 'أسعار النفط', 'oil market'],
  };
  
  // Check which distinct topic this signal belongs to
  for (const [topic, patterns] of Object.entries(distinctTopics)) {
    if (patterns.some(p => combinedText.includes(p.toLowerCase()))) {
      entities.push(`_topic_${topic}`); // Special marker to prevent wrong grouping
    }
  }
  
  return [...new Set(entities)]; // Remove duplicates
}

// Extract numbers - signals with same specific numbers are likely same story
function extractNumbers(title) {
  const numbers = [];
  
  // Money patterns: $11.5B, $400M, €2 billion, 500 million
  const moneyRegex = /[\$€£¥][\d.,]+\s*[BMKTbmkt]?(illion|rillion)?|\d+[\d.,]*\s*(billion|million|trillion|مليار|مليون|ترليون)/gi;
  const moneyMatches = title.match(moneyRegex) || [];
  numbers.push(...moneyMatches.map(m => m.toLowerCase().replace(/\s+/g, '').substring(0, 20)));
  
  // Percentage patterns: 29%, 15.5%, up 10%
  const percentRegex = /[\d.,]+\s*%/g;
  const percentMatches = title.match(percentRegex) || [];
  numbers.push(...percentMatches.map(m => m.replace(/\s+/g, '')));
  
  // Specific large numbers with context
  const specificNumRegex = /\d{2,}[\d.,]*\s*(deals|companies|jobs|employees|users|customers|attacks|shipments|factories|plants)/gi;
  const specificMatches = title.match(specificNumRegex) || [];
  numbers.push(...specificMatches.map(m => m.toLowerCase().replace(/\s+/g, '')));
  
  return [...new Set(numbers)]; // Remove duplicates
}

// Extract action/theme - what's happening in this story?
function extractAction(title, titleOriginal) {
  const combinedText = `${title} ${titleOriginal}`.toLowerCase();
  
  const actionPatterns = {
    'crisis': ['crisis', 'collapse', 'crash', 'plunge', 'plummet', 'turmoil', 'chaos', 'أزمة', 'انهيار', 'أسوأ', 'كارثة'],
    'surge': ['surge', 'soar', 'jump', 'rally', 'record high', 'all-time high', 'boom', 'ارتفاع', 'قفزة', 'قياسي', 'طفرة'],
    'drop': ['drop', 'fall', 'decline', 'slump', 'sink', 'tumble', 'انخفاض', 'تراجع', 'هبوط'],
    'deal': ['deal', 'acquire', 'acquisition', 'merger', 'buy', 'purchase', 'takeover', 'صفقة', 'استحواذ', 'اندماج'],
    'funding': ['raise', 'funding', 'investment', 'bond', 'ipo', 'debt', 'loan', 'سندات', 'تمويل', 'استثمار', 'طرح'],
    'conflict': ['war', 'strike', 'attack', 'raid', 'capture', 'invasion', 'military', 'حرب', 'ضربة', 'هجوم', 'غزو', 'عسكري'],
    'sanctions': ['sanction', 'tariff', 'ban', 'restrict', 'blockade', 'embargo', 'عقوبات', 'رسوم', 'حظر', 'حصار'],
    'policy': ['policy', 'regulation', 'law', 'bill', 'reform', 'قانون', 'تشريع', 'إصلاح', 'سياسة'],
    'tech': ['ai', 'artificial intelligence', 'chip', 'robot', 'autonomous', 'ذكاء اصطناعي', 'رقاقة', 'روبوت'],
    'energy': ['oil', 'gas', 'lng', 'energy', 'renewable', 'solar', 'wind', 'نفط', 'غاز', 'طاقة'],
    'earnings': ['earnings', 'profit', 'revenue', 'results', 'quarterly', 'أرباح', 'إيرادات', 'نتائج'],
    'layoff': ['layoff', 'cut', 'fire', 'restructure', 'downsize', 'تسريح', 'خفض', 'إعادة هيكلة'],
    'launch': ['launch', 'unveil', 'announce', 'reveal', 'introduce', 'debut', 'إطلاق', 'كشف', 'إعلان'],
  };
  
  for (const [action, patterns] of Object.entries(actionPatterns)) {
    if (patterns.some(p => combinedText.includes(p))) {
      return action;
    }
  }
  
  return 'general';
}

/**
 * Calculate similarity between two story signatures - LEGACY (keyword-based)
 * @deprecated Use calculateSignatureSimilarity() instead (uses Topic Intelligence)
 */
export function calculateSimilarity(sig1, sig2) {
  console.warn('⚠️ calculateSimilarity is deprecated. Use calculateSignatureSimilarity() instead.');
  // Entity overlap (most important - 60% weight, increased from 50%)
  const entities1 = new Set(sig1.entities);
  const entities2 = new Set(sig2.entities);
  const entityOverlap = [...entities1].filter(e => entities2.has(e)).length;
  const entityTotal = new Set([...entities1, ...entities2]).size;
  const entityScore = entityTotal > 0 ? entityOverlap / entityTotal : 0;
  
  // STRICTER: Must have at least 2 entities in common (not just 1)
  if (entityOverlap < 2) {
    return { similarity: 0, entityOverlap, actionMatch: false, numberMatch: false };
  }
  
  // Action/theme match (25% weight, reduced from 30%)
  const actionScore = sig1.action === sig2.action ? 1 : 0;
  
  // Number overlap - if both have same specific number, very likely same story (15% weight, reduced from 20%)
  const nums1 = new Set(sig1.numbers);
  const nums2 = new Set(sig2.numbers);
  const numOverlap = [...nums1].filter(n => nums2.has(n)).length;
  const numberScore = numOverlap > 0 ? 1 : 0;
  
  // Weighted similarity score - give more weight to entities
  // Entities: 60%, Action: 25%, Numbers: 15%
  const similarity = (entityScore * 0.6) + (actionScore * 0.25) + (numberScore * 0.15);
  
  return {
    similarity,
    entityOverlap,
    actionMatch: sig1.action === sig2.action,
    numberMatch: numOverlap > 0,
  };
}

// Helper function to check if two topics are related
function areTopicsRelated(topic1, topic2) {
  // Both null = both uncategorized, can group
  if (!topic1 && !topic2) return true;
  
  // One has topic, other doesn't = different categories, don't group
  if (!topic1 || !topic2) return false;
  
  // Both have topics = check if same or related
  if (topic1 === topic2) return true;
  
  // Define related topic groups
  const relatedGroups = [
    ['us_china_relations', 'china_economy', 'trade_wars'],
    ['latin_america_geopolitics', 'energy_geopolitics', 'oil_markets'],
    ['gulf_economies', 'saudi_vision_2030', 'uae_economy'],
    ['tech_companies_analysis', 'ai_disruption', 'semiconductors'],
    ['currency_devaluation', 'inflation', 'central_banks'],
  ];
  
  for (const group of relatedGroups) {
    if (group.includes(topic1) && group.includes(topic2)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Group all signals into story clusters - LEGACY (keyword-based)
 * @deprecated Use groupSignalsByStory() instead (uses Topic Intelligence)
 */
export function groupIntoStories(signals, similarityThreshold = 0.55) {
  console.warn('⚠️ groupIntoStories is deprecated. Use groupSignalsByStory() instead.');
  if (!signals || signals.length === 0) return [];
  
  // Extract signatures for all signals
  const signalsWithSigs = signals.map(signal => ({
    ...signal,
    signature: extractStorySignature(signal)
  }));
  
  const stories = [];
  const assigned = new Set();
  
  // Sort by score (best signals first - they become story anchors)
  signalsWithSigs.sort((a, b) => {
    const scoreA = a.final_score || a.combined_score || a.relevance_score || 0;
    const scoreB = b.final_score || b.combined_score || b.relevance_score || 0;
    return scoreB - scoreA;
  });
  
  for (const signal of signalsWithSigs) {
    // Use id if available, otherwise use url or title as fallback
    const signalKey = signal.id || signal.url || signal.title?.substring(0, 50) || `signal_${Math.random()}`;
    if (assigned.has(signalKey)) continue;
    
    // Start new story cluster with this signal as anchor
    const story = {
      id: `story_${signal.signature.signatureKey || 'unknown'}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      anchor: signal,
      signals: [signal],
      entities: signal.signature.entities,
      action: signal.signature.action,
    };
    
    assigned.add(signalKey);
    
    // Find all similar signals
    for (const otherSignal of signalsWithSigs) {
      const otherKey = otherSignal.id || otherSignal.url || otherSignal.title?.substring(0, 50) || `signal_${Math.random()}`;
      if (assigned.has(otherKey)) continue;
      
      const { similarity, entityOverlap } = calculateSimilarity(signal.signature, otherSignal.signature);
      
      // NEW: Check if matched_topic is same or related
      const sameTopicCategory = (
        signal.matched_topic === otherSignal.matched_topic ||
        // Allow grouping if topics are related
        areTopicsRelated(signal.matched_topic, otherSignal.matched_topic)
      );
      
      // Must have:
      // 1. High similarity (55%+)
      // 2. At least 2 common entities (not just 1) - enforced in calculateSimilarity
      // 3. Same or related topic category
      if (similarity >= similarityThreshold && entityOverlap >= 2 && sameTopicCategory) {
        story.signals.push(otherSignal);
        assigned.add(otherKey);
      }
    }
    
    stories.push(story);
  }
  
  console.log(`📚 Grouped ${signals.length} signals into ${stories.length} stories`);
  
  // Log big stories for debugging
  const bigStories = stories.filter(s => s.signals.length > 3);
  bigStories.forEach(s => {
    console.log(`🔥 Big story (${s.signals.length} signals): ${s.entities.slice(0, 3).join(', ')} - ${s.action}`);
  });
  
  return stories;
}

// Select best signals from each story cluster
export function selectBestFromStories(stories, maxPerStory = 3) {
  const selected = [];
  
  for (const story of stories) {
    // Sort signals within story by quality
    const ranked = rankSignalsInStory(story.signals);
    
    // Take top N, ensuring language diversity
    const picks = selectDiverseSignals(ranked, maxPerStory);
    
    // FIXED: story_size = actual picks saved, not original detected count
    const actualSize = picks.length;
    const originalSize = story.signals.length;
    
    // Mark story metadata on each picked signal
    picks.forEach((signal, idx) => {
      signal.story_id = story.id;
      signal.story_rank = idx + 1;
      signal.story_size = actualSize;  // Changed from story.signals.length - shows actual saved count
      signal.story_original_size = originalSize;  // Store original detected count for reference
      signal.is_story_anchor = idx === 0;
    });
    
    selected.push(...picks);
  }
  
  // Sort final list by score
  selected.sort((a, b) => {
    const scoreA = a.final_score || a.combined_score || a.relevance_score || 0;
    const scoreB = b.final_score || b.combined_score || b.relevance_score || 0;
    return scoreB - scoreA;
  });
  
  console.log(`✂️ Selected ${selected.length} signals from ${stories.length} stories`);
  
  return selected;
}

// Rank signals within a single story by quality
function rankSignalsInStory(signals) {
  const premiumSources = [
    'financial times', 'ft.com', 'economist', 'wall street journal', 'wsj',
    'bloomberg', 'reuters', 'new york times', 'nyt', 'washington post',
    'الجزيرة', 'العربية', 'الشرق', 'سكاي نيوز', 'bbc arabic'
  ];
  
  const genericPatterns = [
    'market react', 'investor react', 'stock rise', 'stock fall', 
    'what happen', 'what now', 'how will', 'could be', 'may be',
    'as it happened', 'live update'
  ];
  
  return [...signals].sort((a, b) => {
    let scoreA = a.final_score || a.combined_score || a.relevance_score || 50;
    let scoreB = b.final_score || b.combined_score || b.relevance_score || 50;
    
    // Boost: Has specific numbers in title
    if (a.signature?.numbers?.length > 0) scoreA += 15;
    if (b.signature?.numbers?.length > 0) scoreB += 15;
    
    // Boost: Premium source
    const sourceA = (a.source || '').toLowerCase();
    const sourceB = (b.source || '').toLowerCase();
    if (premiumSources.some(s => sourceA.includes(s))) scoreA += 10;
    if (premiumSources.some(s => sourceB.includes(s))) scoreB += 10;
    
    // Penalty: Generic angle (market reacts, what now, etc.)
    const titleA = (a.title || '').toLowerCase();
    const titleB = (b.title || '').toLowerCase();
    if (genericPatterns.some(p => titleA.includes(p))) scoreA -= 20;
    if (genericPatterns.some(p => titleB.includes(p))) scoreB -= 20;
    
    // Boost: Question format (often more engaging)
    if (titleA.includes('?')) scoreA += 5;
    if (titleB.includes('?')) scoreB += 5;
    
    // Boost: Exclusive/inside/reveals (unique angles)
    const exclusivePatterns = ['exclusive', 'inside', 'reveals', 'leaked'];
    if (exclusivePatterns.some(p => titleA.includes(p))) scoreA += 10;
    if (exclusivePatterns.some(p => titleB.includes(p))) scoreB += 10;
    
    return scoreB - scoreA;
  });
}

// Select diverse signals (mix of languages and sources)
function selectDiverseSignals(ranked, maxCount) {
  const selected = [];
  let hasArabic = false;
  let hasEnglish = false;
  const usedSources = new Set();
  
  for (const signal of ranked) {
    if (selected.length >= maxCount) break;
    
    const isArabic = /[\u0600-\u06FF]/.test(signal.title);
    const source = (signal.source || '').toLowerCase();
    
    // First pick: always take best signal
    if (selected.length === 0) {
      selected.push(signal);
      if (isArabic) hasArabic = true;
      else hasEnglish = true;
      usedSources.add(source);
      continue;
    }
    
    // Calculate diversity bonus
    let diversityBonus = 0;
    
    // Language diversity - prefer mix of Arabic and English
    if (isArabic && !hasArabic) diversityBonus += 3;
    if (!isArabic && !hasEnglish) diversityBonus += 3;
    
    // Source diversity - prefer different sources
    if (!usedSources.has(source)) diversityBonus += 1;
    
    // Accept if it adds diversity or we need more signals
    if (diversityBonus > 0 || selected.length < 2) {
      selected.push(signal);
      if (isArabic) hasArabic = true;
      else hasEnglish = true;
      usedSources.add(source);
    }
  }
  
  return selected;
}

// Export all functions
export default {
  extractStorySignature,
  calculateSimilarity,
  groupIntoStories,
  selectBestFromStories,
};
