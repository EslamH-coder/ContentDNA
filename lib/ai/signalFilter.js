/**
 * SIGNAL FILTER - Step 1: Quick relevance check
 * Uses simple rules + optional LLM for edge cases
 */

// ============================================================
// WHITELIST: Topics we ALWAYS want
// ============================================================
const WHITELIST_KEYWORDS = [
  // Arab countries (expanded with variations)
  'saudi', 'السعودية', 'سعودي', 'uae', 'الإمارات', 'إمارات', 'اماراتي',
  'dubai', 'دبي', 'abu dhabi', 'أبوظبي',
  'egypt', 'مصر', 'مصري', 'cairo', 'القاهرة',
  'qatar', 'قطر', 'qatari', 'doha', 'الدوحة',
  'kuwait', 'الكويت', 'كويتي',
  'bahrain', 'البحرين', 'بحريني',
  'oman', 'عمان', 'عماني',
  'iraq', 'العراق', 'عراقي',
  'syria', 'سوريا', 'سوري',
  'jordan', 'الأردن', 'أردني',
  'lebanon', 'لبنان', 'لبناني',
  'palestine', 'فلسطين', 'فلسطيني', 'gaza', 'غزة',
  'yemen', 'اليمن', 'يمني',
  'morocco', 'المغرب', 'مغربي',
  'algeria', 'الجزائر', 'جزائري',
  'tunisia', 'تونس', 'تونسي',
  'libya', 'ليبيا', 'ليبي',
  'sudan', 'السودان', 'سوداني',
  'arab', 'عرب', 'عربي', 'خليج', 'خليجي', 'gulf', 'middle east', 'الشرق الأوسط',
  'opec', 'أوبك',
  
  // Major powers
  'china', 'الصين', 'صين', 'صيني', 'chinese', 'beijing', 'بكين',
  'america', 'أمريكا', 'امريكا', 'أمريكي', 'usa', 'us', 'united states', 'washington',
  'russia', 'روسيا', 'روسي', 'russian', 'moscow', 'موسكو',
  'india', 'الهند', 'هندي', 'indian',
  'europe', 'أوروبا', 'أوروبي', 'european', 'eu',
  'germany', 'ألمانيا', 'german',
  'france', 'فرنسا', 'french',
  'uk', 'britain', 'بريطانيا', 'british', 'england',
  'japan', 'اليابان', 'japanese',
  
  // Leaders
  'trump', 'ترامب', 'ترمب',
  'biden', 'بايدن',
  'putin', 'بوتين',
  'xi', 'شي جين بينغ',
  'mbs', 'محمد بن سلمان', 'ولي العهد',
  
  // Major companies
  'tesla', 'تسلا',
  'apple', 'آبل', 'ابل', 'iphone', 'آيفون',
  'google', 'جوجل', 'alphabet',
  'amazon', 'أمازون', 'امازون',
  'microsoft', 'مايكروسوفت',
  'nvidia', 'إنفيديا', 'نفيديا',
  'meta', 'فيسبوك', 'facebook',
  'openai', 'chatgpt', 'شات جي بي تي',
  'aramco', 'أرامكو', 'ارامكو',
  'sabic', 'سابك',
  'adnoc', 'أدنوك',
  
  // Economic topics (CRITICAL - very important!)
  'oil', 'نفط', 'petroleum', 'crude', 'خام', 'برنت', 'brent',
  'gas', 'غاز', 'natural gas',
  'gold', 'ذهب', 'الذهب',
  'dollar', 'دولار', 'الدولار', 'usd',
  'euro', 'يورو',
  'yuan', 'يوان', 'renminbi',
  'bitcoin', 'بيتكوين', 'crypto', 'cryptocurrency',
  'stock', 'أسهم', 'سهم', 'stocks', 'shares',
  'market', 'سوق', 'markets', 'أسواق',
  'bank', 'بنك', 'banking', 'مصرف',
  'fed', 'federal reserve', 'الفيدرالي', 'الاحتياطي',
  'ecb', 'المركزي الأوروبي',
  'interest rate', 'فائدة', 'سعر الفائدة',
  'inflation', 'تضخم', 'التضخم',
  'recession', 'ركود',
  'tariff', 'رسوم', 'جمركي', 'جمركية', 'tariffs',
  'sanctions', 'عقوبات',
  'trade war', 'حرب تجارية',
  'investment', 'استثمار', 'invest',
  'economy', 'اقتصاد', 'economic', 'اقتصادي',
  
  // Tech topics
  'ai', 'artificial intelligence', 'ذكاء اصطناعي',
  'robot', 'روبوت',
  'ev', 'electric vehicle', 'سيارة كهربائية',
  'chip', 'chips', 'semiconductor', 'رقائق',
  
  // Important concepts
  'war', 'حرب',
  'crisis', 'أزمة',
  'deal', 'صفقة',
  'billion', 'مليار',
  'trillion', 'تريليون',
  'growth', 'نمو',
  'profit', 'أرباح', 'ربح',
  'loss', 'خسارة', 'خسائر',
  
  // Influential people
  'elon musk', 'إيلون ماسك', 'ماسك',
  'jeff bezos', 'بيزوس',
  'warren buffett', 'بافيت',
  'mark zuckerberg', 'زوكربيرج'
];

// ============================================================
// BLACKLIST: Topics we NEVER want
// ============================================================
const BLACKLIST_KEYWORDS = [
  // Sports (unless major economic impact)
  'sports', 'nfl', 'nba', 'mlb', 'nhl', 'premier league',
  
  // Entertainment gossip
  'celebrity gossip', 'kardashian', 'reality tv',
  
  // Truly irrelevant
  'horoscope', 'astrology',
  'recipe', 'cooking show',
  'local weather'
];

// ============================================================
// LOCAL US NEWS BLACKLIST (not relevant to Arab audience)
// ============================================================
const LOCAL_BLACKLIST = [
  'tennessee', 'ohio', 'california', 'texas', 'florida',
  'michigan', 'pennsylvania', 'new york state', 'illinois',
  'mayor', 'county', 'local', 'governor', 'state legislature',
  'city council', 'school board', 'municipal'
];

// ============================================================
// BORING OFFICIAL NEWS BLACKLIST
// ============================================================
const BORING_BLACKLIST = [
  'quarterly report', 'Q1', 'Q2', 'Q3', 'Q4',
  'grows 2%', 'grows 3%', 'rises 1%', 'falls 2%',
  'credit rating', 'fitch rates', 'moody\'s rates',
  'signs agreement', 'meets with', 'visits',
  'annual report', 'fiscal year'
];

// ============================================================
// MAIN FILTER FUNCTION
// ============================================================
export function filterSignal(rssItem) {
  const title = (rssItem.title || rssItem.topic || '').toLowerCase();
  const description = (rssItem.description || rssItem.summary || '').toLowerCase();
  const text = title + ' ' + description;
  
  const result = {
    passed: false,
    reason: '',
    matchedKeywords: [],
    confidence: 0
  };
  
  // Step 1: Check blacklist first
  for (const keyword of BLACKLIST_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      result.reason = `Blacklisted: contains "${keyword}"`;
      result.confidence = 90;
      return result;
    }
  }
  
  // Step 1.5: Check local US news blacklist (reject completely)
  for (const word of LOCAL_BLACKLIST) {
    if (text.includes(word.toLowerCase())) {
      result.reason = `Local US news: "${word}" - not relevant to Arab audience`;
      result.confidence = 95;
      return result;
    }
  }
  
  // Step 1.6: Check boring official news (will be penalized in scoring, not rejected here)
  // This is handled in the scoring function, not here
  
  // Step 2: Check whitelist
  const matchedKeywords = [];
  for (const keyword of WHITELIST_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }
  
  if (matchedKeywords.length > 0) {
    result.passed = true;
    result.reason = `Matched: "${matchedKeywords.slice(0, 3).join(', ')}"`;
    result.matchedKeywords = matchedKeywords;
    result.confidence = Math.min(95, 80 + (matchedKeywords.length * 5));
    return result;
  }
  
  // FALLBACK: If item has high relevance score from Groq, let it pass
  if (rssItem.relevanceScore && rssItem.relevanceScore >= 60) {
    result.passed = true;
    result.reason = 'High relevance score (fallback)';
    result.matchedKeywords = [];
    result.confidence = 75;
    return result;
  }
  
  // Also check if score field exists (from DNA scoring or other systems)
  if (rssItem.score && typeof rssItem.score === 'number' && rssItem.score >= 60) {
    result.passed = true;
    result.reason = 'High score (fallback)';
    result.matchedKeywords = [];
    result.confidence = 75;
    return result;
  }
  
  result.passed = false;
  result.reason = 'No relevant keywords found';
  result.confidence = 70;
  return result;
}

// ============================================================
// BATCH FILTER
// ============================================================
export function filterSignals(rssItems) {
  const results = {
    passed: [],
    skipped: [],
    summary: {}
  };
  
  for (const item of rssItems) {
    const filterResult = filterSignal(item);
    
    if (filterResult.passed) {
      results.passed.push({ item, filter: filterResult });
    } else {
      results.skipped.push({ item, filter: filterResult });
    }
  }
  
  results.summary = {
    total: rssItems.length,
    passed: results.passed.length,
    skipped: results.skipped.length,
    passRate: Math.round((results.passed.length / rssItems.length) * 100) + '%'
  };
  
  return results;
}

