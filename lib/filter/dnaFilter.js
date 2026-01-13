/**
 * DNA-BASED FILTER
 * Only passes news that matches channel DNA
 * 
 * NOW USES TOPIC INTELLIGENCE for accurate DNA matching
 */

import { generateTopicFingerprint, matchesDNATopic } from '../topicIntelligence';
import { calculateDNAScore } from '../dna-scoring';

// ============================================
// CHANNEL DNA CONFIG
// ============================================
const DNA = {
  // Core topics with keywords
  coreTopics: {
    majorPowers: {
      usa: ['trump', 'ترامب', 'ترمب', 'america', 'أمريكا', 'امريكا', 'biden', 'بايدن', 'white house', 'البيت الأبيض', 'washington', 'واشنطن', 'u.s.', 'united states'],
      china: ['china', 'الصين', 'chinese', 'صيني', 'beijing', 'بكين', 'xi jinping', 'شي جين بينغ', 'xi '],
      russia: ['russia', 'روسيا', 'russian', 'روسي', 'putin', 'بوتين', 'moscow', 'موسكو', 'kremlin']
    },
    regionalPowers: {
      iran: ['iran', 'إيران', 'ايران', 'iranian', 'tehran', 'طهران', 'khamenei'],
      israel: ['israel', 'إسرائيل', 'اسرائيل', 'israeli', 'netanyahu', 'نتنياهو', 'tel aviv'],
      europe: ['europe', 'أوروبا', 'european', 'eu ', 'الاتحاد الأوروبي', 'germany', 'ألمانيا', 'france', 'فرنسا', 'britain', 'بريطانيا']
    },
    economics: {
      dollar: ['dollar', 'الدولار', 'دولار', 'usd', 'currency'],
      oil: ['oil', 'النفط', 'نفط', 'opec', 'أوبك', 'petroleum', 'crude', 'energy'],
      trade: ['trade war', 'حرب تجارية', 'tariff', 'رسوم', 'sanctions', 'عقوبات', 'embargo'],
      fed: ['federal reserve', 'الفيدرالي', 'interest rate', 'فائدة', 'powell', 'central bank'],
      gold: ['gold', 'الذهب', 'ذهب']
    },
    tech: {
      chips: ['chip', 'رقائق', 'semiconductor', 'nvidia', 'tsmc', 'intel'],
      ai: ['artificial intelligence', 'الذكاء الاصطناعي', ' ai ', 'openai', 'chatgpt', 'gpt'],
      giants: ['elon', 'musk', 'ماسك', 'tesla', 'تسلا', 'apple', 'أبل', 'google', 'meta', 'amazon', 'microsoft', 'bezos', 'zuckerberg']
    }
  },
  
  // Arab audience regions
  arabRegions: {
    primary: ['egypt', 'مصر', 'egyptian', 'cairo', 'saudi', 'السعودية', 'riyadh', 'mbs', 'محمد بن سلمان', 'suez', 'السويس', 'قناة السويس'],
    secondary: ['gulf', 'الخليج', 'gcc', 'uae', 'الإمارات', 'dubai', 'دبي', 'qatar', 'قطر', 'kuwait', 'الكويت'],
    tertiary: ['arab', 'العرب', 'middle east', 'الشرق الأوسط', 'morocco', 'المغرب', 'algeria', 'الجزائر', 'iraq', 'العراق']
  },
  
  // REJECTED - These fail immediately
  rejected: {
    countries: ['malaysia', 'ماليزيا', 'zimbabwe', 'زيمبابوي', 'indonesia', 'إندونيسيا', 'thailand', 'تايلاند', 'vietnam', 'فيتنام', 'philippines', 'الفلبين', 'bangladesh', 'بنغلاديش', 'sri lanka', 'سريلانكا', 'nepal', 'نيبال', 'myanmar', 'ميانمار', 'nigeria', 'نيجيريا', 'kenya', 'كينيا', 'argentina', 'الأرجنتين', 'colombia', 'كولومبيا', 'peru', 'بيرو', 'chile', 'تشيلي'],
    topics: ['sports', 'رياضة', 'football', 'soccer', 'كرة', 'entertainment', 'ترفيه', 'celebrity', 'مشاهير', 'weather', 'طقس', 'crime', 'جريمة', 'accident', 'حادث', 'local', 'محلي', 'fashion', 'موضة', 'music', 'موسيقى', 'movie', 'فيلم', 'travel', 'سياحة']
  }
};

// ============================================
// MAIN DNA FILTER FUNCTION
// ============================================
export function dnaFilter(newsItem) {
  const title = (newsItem.title || '').toLowerCase();
  const description = (newsItem.description || '').toLowerCase();
  const content = (newsItem.content || '').toLowerCase();
  const fullText = `${title} ${description} ${content}`;
  
  const result = {
    newsItem,
    pass: false,
    score: 0,
    reasons: [],
    matches: {
      coreTopic: null,
      arabRelevance: null,
      rejected: null
    }
  };
  
  // ============================================
  // STEP 1: CHECK REJECTED TOPICS (Immediate fail)
  // ============================================
  for (const country of DNA.rejected.countries) {
    if (fullText.includes(country.toLowerCase())) {
      // Check if it's in context of major power (e.g., "China invests in Zimbabwe")
      const hasMajorPower = checkMajorPower(fullText);
      if (!hasMajorPower) {
        result.matches.rejected = country;
        result.reasons.push(`❌ Rejected country: ${country}`);
        result.score = 0;
        result.pass = false;
        return result;
      }
    }
  }
  
  for (const topic of DNA.rejected.topics) {
    if (fullText.includes(topic.toLowerCase())) {
      result.matches.rejected = topic;
      result.reasons.push(`❌ Rejected topic: ${topic}`);
      result.score = 0;
      result.pass = false;
      return result;
    }
  }
  
  // ============================================
  // STEP 2: CHECK CORE TOPICS (Must match at least one)
  // ============================================
  let coreTopicScore = 0;
  let matchedCoreTopic = null;
  
  // Check Major Powers (highest priority)
  for (const [power, keywords] of Object.entries(DNA.coreTopics.majorPowers)) {
    for (const keyword of keywords) {
      if (fullText.includes(keyword.toLowerCase())) {
        coreTopicScore = Math.max(coreTopicScore, 40);
        matchedCoreTopic = `majorPower:${power}`;
        result.reasons.push(`✅ Major power: ${power} (${keyword})`);
        break;
      }
    }
  }
  
  // Check Regional Powers
  for (const [power, keywords] of Object.entries(DNA.coreTopics.regionalPowers)) {
    for (const keyword of keywords) {
      if (fullText.includes(keyword.toLowerCase())) {
        coreTopicScore = Math.max(coreTopicScore, 30);
        if (!matchedCoreTopic) matchedCoreTopic = `regionalPower:${power}`;
        result.reasons.push(`✅ Regional power: ${power} (${keyword})`);
        break;
      }
    }
  }
  
  // Check Economics
  for (const [topic, keywords] of Object.entries(DNA.coreTopics.economics)) {
    for (const keyword of keywords) {
      if (fullText.includes(keyword.toLowerCase())) {
        coreTopicScore = Math.max(coreTopicScore, 35);
        if (!matchedCoreTopic) matchedCoreTopic = `economics:${topic}`;
        result.reasons.push(`✅ Economics: ${topic} (${keyword})`);
        break;
      }
    }
  }
  
  // Check Tech
  for (const [topic, keywords] of Object.entries(DNA.coreTopics.tech)) {
    for (const keyword of keywords) {
      if (fullText.includes(keyword.toLowerCase())) {
        coreTopicScore = Math.max(coreTopicScore, 25);
        if (!matchedCoreTopic) matchedCoreTopic = `tech:${topic}`;
        result.reasons.push(`✅ Tech: ${topic} (${keyword})`);
        break;
      }
    }
  }
  
  // No core topic match = fail
  if (!matchedCoreTopic) {
    result.reasons.push('❌ No core topic match');
    result.score = 0;
    result.pass = false;
    return result;
  }
  
  result.matches.coreTopic = matchedCoreTopic;
  result.score = coreTopicScore;
  
  // ============================================
  // STEP 3: CHECK ARAB RELEVANCE (Bonus points)
  // ============================================
  let arabScore = 0;
  let arabMatch = null;
  
  // Primary (Egypt, Saudi) - highest bonus
  for (const keyword of DNA.arabRegions.primary) {
    if (fullText.includes(keyword.toLowerCase())) {
      arabScore = 25;
      arabMatch = `primary:${keyword}`;
      result.reasons.push(`✅ Arab primary: ${keyword}`);
      break;
    }
  }
  
  // Secondary (Gulf)
  if (!arabMatch) {
    for (const keyword of DNA.arabRegions.secondary) {
      if (fullText.includes(keyword.toLowerCase())) {
        arabScore = 20;
        arabMatch = `secondary:${keyword}`;
        result.reasons.push(`✅ Arab secondary: ${keyword}`);
        break;
      }
    }
  }
  
  // Tertiary (Other Arab)
  if (!arabMatch) {
    for (const keyword of DNA.arabRegions.tertiary) {
      if (fullText.includes(keyword.toLowerCase())) {
        arabScore = 15;
        arabMatch = `tertiary:${keyword}`;
        result.reasons.push(`✅ Arab tertiary: ${keyword}`);
        break;
      }
    }
  }
  
  result.matches.arabRelevance = arabMatch;
  result.score += arabScore;
  
  // ============================================
  // STEP 4: BONUS FOR PATTERNS
  // ============================================
  
  // Conflict pattern (X vs Y, war, etc.)
  const conflictKeywords = ['vs', 'versus', 'war', 'حرب', 'conflict', 'صراع', 'against', 'ضد', 'threatens', 'يهدد', 'sanctions', 'عقوبات', 'attack', 'هجوم'];
  for (const keyword of conflictKeywords) {
    if (fullText.includes(keyword.toLowerCase())) {
      result.score += 10;
      result.reasons.push(`✅ Conflict pattern: ${keyword}`);
      break;
    }
  }
  
  // Multiple major powers (e.g., US + China)
  const majorPowerCount = countMajorPowers(fullText);
  if (majorPowerCount >= 2) {
    result.score += 15;
    result.reasons.push(`✅ Multiple powers: ${majorPowerCount}`);
  }
  
  // Question in title (هل، كيف، لماذا)
  if (/^(هل|كيف|لماذا|why|how|will|can)/i.test(title)) {
    result.score += 5;
    result.reasons.push('✅ Question format');
  }
  
  // Has specific numbers
  if (/\d+\s*(%|billion|million|مليار|مليون|تريليون)/.test(fullText)) {
    result.score += 5;
    result.reasons.push('✅ Has numbers');
  }
  
  // ============================================
  // STEP 5: FINAL DECISION
  // ============================================
  
  // Minimum score to pass
  const PASS_THRESHOLD = 40;
  
  result.score = Math.min(100, result.score);
  result.pass = result.score >= PASS_THRESHOLD;
  
  if (!result.pass) {
    result.reasons.push(`❌ Score ${result.score} < threshold ${PASS_THRESHOLD}`);
  }
  
  return result;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function checkMajorPower(text) {
  const majorKeywords = ['trump', 'ترامب', 'america', 'أمريكا', 'china', 'الصين', 'russia', 'روسيا', 'biden', 'putin', 'xi'];
  return majorKeywords.some(k => text.includes(k.toLowerCase()));
}

function countMajorPowers(text) {
  let count = 0;
  const powers = {
    usa: ['trump', 'ترامب', 'america', 'أمريكا', 'biden', 'u.s.'],
    china: ['china', 'الصين', 'xi', 'beijing'],
    russia: ['russia', 'روسيا', 'putin']
  };
  
  for (const [power, keywords] of Object.entries(powers)) {
    if (keywords.some(k => text.includes(k.toLowerCase()))) {
      count++;
    }
  }
  
  return count;
}

// ============================================
// BATCH FILTER
// ============================================
export function dnaFilterBatch(newsItems) {
  const results = newsItems.map(item => dnaFilter(item));
  
  // Separate passed and failed
  const passed = results.filter(r => r.pass);
  const failed = results.filter(r => !r.pass);
  
  // Sort passed by score
  passed.sort((a, b) => b.score - a.score);
  
  return {
    passed,
    failed,
    toProcess: passed.map(p => ({ newsItem: p.newsItem, score: p.score, priority: p.score >= 60 ? 'HIGH' : p.score >= 50 ? 'MEDIUM' : 'LOW' })),
    skipped: failed.map(f => ({ newsItem: f.newsItem, score: f.score, reason: f.reasons.find(r => r.startsWith('❌')) || 'Low score' })),
    stats: {
      total: newsItems.length,
      passed: passed.length,
      failed: failed.length,
      passRate: `${((passed.length / newsItems.length) * 100).toFixed(1)}%`,
      avgScore: passed.length > 0 
        ? (passed.reduce((a, b) => a + b.score, 0) / passed.length).toFixed(1)
        : 0,
      highPriority: passed.filter(p => p.score >= 60).length,
      estimatedSavings: `~${((failed.length / newsItems.length) * 100).toFixed(0)}% items filtered`,
      
      // Rejection reasons
      rejectionReasons: countRejectionReasons(failed)
    }
  };
}

function countRejectionReasons(failed) {
  const reasons = {};
  
  for (const item of failed) {
    for (const reason of item.reasons) {
      if (reason.startsWith('❌')) {
        reasons[reason] = (reasons[reason] || 0) + 1;
      }
    }
  }
  
  return Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

// ============================================
// QUICK CHECK (For UI - instant feedback)
// ============================================
export function quickDNACheck(title) {
  const lower = title.toLowerCase();
  
  // Quick reject check
  const rejected = DNA.rejected.countries.concat(DNA.rejected.topics);
  for (const r of rejected) {
    if (lower.includes(r.toLowerCase())) {
      return { pass: false, reason: `Rejected: ${r}` };
    }
  }
  
  // Quick core topic check
  const allCoreKeywords = [
    ...DNA.coreTopics.majorPowers.usa,
    ...DNA.coreTopics.majorPowers.china,
    ...DNA.coreTopics.majorPowers.russia,
    ...DNA.coreTopics.regionalPowers.iran,
    ...DNA.coreTopics.economics.dollar,
    ...DNA.coreTopics.economics.oil,
    ...DNA.coreTopics.tech.giants
  ];
  
  const hasCoreTopic = allCoreKeywords.some(k => lower.includes(k.toLowerCase()));
  
  if (!hasCoreTopic) {
    return { pass: false, reason: 'No core topic' };
  }
  
  return { pass: true, reason: 'Matches DNA' };
}

// ============================================
// TOPIC INTELLIGENCE-BASED FILTERING (NEW)
// ============================================

/**
 * Filter signals by DNA match using Topic Intelligence
 * Replaces keyword-based filtering with entity/category matching
 * @param {Array} signals - Array of signals to filter
 * @param {Object} showDNA - Show DNA object with topics array
 * @param {Object} options - Options: minScore, requireMatch, includeNonMatching
 * @returns {Promise<Array>} Filtered signals with DNA info attached
 */
export async function filterByDNA(signals, showDNA, options = {}) {
  const {
    minScore = 1,
    requireMatch = false,
    includeNonMatching = true
  } = options;
  
  console.log(`🧬 Filtering ${signals.length} signals by DNA using Topic Intelligence...`);
  
  const results = await Promise.all(
    signals.map(async (signal) => {
      const dnaResult = await calculateDNAScore(signal, showDNA);
      
      return {
        signal,
        dnaScore: dnaResult.score,
        dnaMatches: dnaResult.matches,
        category: dnaResult.signalCategory,
        passesFilter: dnaResult.score >= minScore
      };
    })
  );
  
  // Separate matching and non-matching
  const matching = results.filter(r => r.passesFilter);
  const nonMatching = results.filter(r => !r.passesFilter);
  
  console.log(`🧬 DNA Filter: ${matching.length} matching, ${nonMatching.length} non-matching`);
  
  if (requireMatch) {
    return matching.map(r => ({
      ...r.signal,
      dnaScore: r.dnaScore,
      dnaMatches: r.dnaMatches,
      dnaCategory: r.category
    }));
  }
  
  // Return all, but with DNA info attached
  return results.map(r => ({
    ...r.signal,
    dnaScore: r.dnaScore,
    dnaMatches: r.dnaMatches,
    dnaCategory: r.category,
    matchesDNA: r.passesFilter
  }));
}

/**
 * Quick check if signal matches DNA (without full scoring)
 * Uses Topic Intelligence for entity/category matching
 */
export async function signalPassesDNAFilter(signal, showDNA) {
  const fingerprint = await generateTopicFingerprint({
    title: signal.title,
    description: signal.description || '',
    id: signal.id,
    type: 'signal',
    skipEmbedding: true // Skip embedding for speed
  });
  
  // Check category match
  for (const dnaTopic of showDNA.topics || []) {
    const topicId = dnaTopic.id || dnaTopic.name || dnaTopic;
    const result = await matchesDNATopic({ title: signal.title, fingerprint }, topicId);
    if (result.matches) return true;
  }
  
  // Check entity match
  const allDNAEntities = (showDNA.entities || []).map(e => 
    (e.name || e).toLowerCase()
  );
  
  const signalEntities = [
    ...fingerprint.entities.countries,
    ...fingerprint.entities.people,
    ...fingerprint.entities.topics
  ].map(e => e.toLowerCase());
  
  const hasEntityMatch = signalEntities.some(e => allDNAEntities.includes(e));
  
  return hasEntityMatch;
}
