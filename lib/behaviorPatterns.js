/**
 * Behavior Pattern Learning System
 * Learns what patterns engage each show's audience
 * Generic - works for ANY show based on their own data
 * NOW USES TOPIC INTELLIGENCE for accurate matching
 */

import { createClient } from '@supabase/supabase-js';
import { generateTopicFingerprint } from './topicIntelligence.js';
// Note: generateTopicFingerprint is ONLY used for SIGNALS in scoreSignalByPatterns
// Comments use simple keyword matching (extractKeywordsSimple) to avoid wasting API calls

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Master function: Learn all behavior patterns for a show
 */
export async function learnBehaviorPatterns(showId) {
  console.log(`🧠 Learning behavior patterns for show: ${showId}`);
  
  // Gather data from all sources
  const [videoPatterns, commentPatterns, competitorPatterns] = await Promise.all([
    analyzeVideoPatterns(showId),
    analyzeCommentPatterns(showId),
    analyzeCompetitorPatterns(showId)
  ]);
  
  // Merge and weight patterns
  const combinedPatterns = mergePatterns(videoPatterns, commentPatterns, competitorPatterns);
  
  console.log(`🧠 Learned ${Object.keys(combinedPatterns).length} behavior patterns`);
  
  return combinedPatterns;
}

/**
 * PART 1: Analyze VIDEO PATTERNS
 * What content patterns perform best for this show?
 */
async function analyzeVideoPatterns(showId) {
  const { data: videos } = await supabase
    .from('channel_videos')
    .select('title, views, topic_id, format, hook_text, publish_date')
    .eq('show_id', showId)
    .eq('format', 'Long')
    .gt('views', 0)
    .order('views', { ascending: false });

  if (!videos || videos.length === 0) {
    return {};
  }

  // Calculate average views for baseline
  const avgViews = videos.reduce((sum, v) => sum + (v.views || 0), 0) / videos.length;
  
  // Get top performing videos (above average)
  const topVideos = videos.filter(v => (v.views || 0) > avgViews);
  
  // Extract patterns from top videos
  const patterns = {};
  
  // Pattern detectors - these detect CONCEPTS, not keywords
  const patternDetectors = [
    {
      id: 'superpower_tension',
      name: 'Global Power Tension',
      name_ar: 'صراع القوى العظمى',
      detect: (title) => {
        const powers = ['us', 'usa', 'america', 'أمريكا', 'امريكا', 'china', 'الصين', 'صين', 
                       'russia', 'روسيا', 'iran', 'إيران', 'ايران', 'eu', 'europe', 'أوروبا',
                       'nato', 'الناتو', 'india', 'الهند', 'japan', 'اليابان', 'taiwan', 'تايوان'];
        const tension = ['vs', 'against', 'ضد', 'war', 'حرب', 'conflict', 'صراع', 'tension', 'توتر',
                        'sanctions', 'عقوبات', 'ban', 'حظر', 'restrict', 'crisis', 'أزمة'];
        const titleLower = title.toLowerCase();
        const powerCount = powers.filter(p => titleLower.includes(p)).length;
        const hasTension = tension.some(t => titleLower.includes(t));
        return powerCount >= 1 && hasTension;
      }
    },
    {
      id: 'personal_impact',
      name: 'Personal Economic Impact',
      name_ar: 'التأثير الشخصي',
      detect: (title) => {
        const personal = ['you', 'your', 'أنت', 'عليك', 'لك', 'محفظتك', 'جيبك', 'حياتك',
                         'affect', 'يؤثر', 'impact', 'تأثير', 'how', 'كيف', 'why', 'لماذا'];
        const titleLower = title.toLowerCase();
        return personal.filter(p => titleLower.includes(p)).length >= 2;
      }
    },
    {
      id: 'hidden_truth',
      name: 'Hidden Truth / Secrets',
      name_ar: 'الحقيقة المخفية',
      detect: (title) => {
        const secrets = ['secret', 'سر', 'أسرار', 'hidden', 'مخفي', 'truth', 'حقيقة', 
                        'real reason', 'السبب الحقيقي', "don't tell", 'لا يخبرونك',
                        'nobody knows', 'لا أحد يعرف', 'revealed', 'كشف', 'expose', 'فضح'];
        const titleLower = title.toLowerCase();
        return secrets.some(s => titleLower.includes(s));
      }
    },
    {
      id: 'tech_race',
      name: 'Technology Race / Competition',
      name_ar: 'سباق التكنولوجيا',
      detect: (title) => {
        const tech = ['ai', 'الذكاء الاصطناعي', 'chip', 'رقاقة', 'semiconductor', 'أشباه الموصلات',
                     'nvidia', 'نفيديا', 'tech', 'تقنية', 'technology', 'تكنولوجيا'];
        const race = ['race', 'سباق', 'war', 'حرب', 'battle', 'معركة', 'competition', 'منافسة',
                     'dominance', 'هيمنة', 'lead', 'تفوق'];
        const titleLower = title.toLowerCase();
        const hasTech = tech.some(t => titleLower.includes(t));
        const hasRace = race.some(r => titleLower.includes(r));
        return hasTech && hasRace;
      }
    },
    {
      id: 'economic_crisis',
      name: 'Economic Crisis / Collapse',
      name_ar: 'الأزمات الاقتصادية',
      detect: (title) => {
        const crisis = ['crisis', 'أزمة', 'collapse', 'انهيار', 'crash', 'fall', 'سقوط',
                       'recession', 'ركود', 'inflation', 'تضخم', 'bubble', 'فقاعة',
                       'default', 'إفلاس', 'debt', 'دين', 'ديون'];
        const titleLower = title.toLowerCase();
        return crisis.some(c => titleLower.includes(c));
      }
    },
    {
      id: 'resource_control',
      name: 'Resource Control / Geopolitics',
      name_ar: 'السيطرة على الموارد',
      detect: (title) => {
        const resources = ['oil', 'نفط', 'بترول', 'gas', 'غاز', 'gold', 'ذهب', 'rare earth',
                          'lithium', 'ليثيوم', 'uranium', 'يورانيوم', 'water', 'مياه', 'food', 'غذاء'];
        const control = ['control', 'سيطرة', 'war', 'حرب', 'supply', 'إمداد', 'shortage', 'نقص',
                        'weapon', 'سلاح', 'leverage', 'ورقة ضغط'];
        const titleLower = title.toLowerCase();
        const hasResource = resources.some(r => titleLower.includes(r));
        const hasControl = control.some(c => titleLower.includes(c));
        return hasResource || (hasResource && hasControl);
      }
    },
    {
      id: 'money_wealth',
      name: 'Money & Wealth Stories',
      name_ar: 'قصص المال والثروة',
      detect: (title) => {
        const money = ['billion', 'مليار', 'million', 'مليون', 'trillion', 'تريليون',
                      'rich', 'غني', 'wealth', 'ثروة', 'fortune', 'money', 'مال', 'أموال',
                      'profit', 'ربح', 'loss', 'خسارة', '$', '💰'];
        const titleLower = title.toLowerCase();
        return money.some(m => titleLower.includes(m));
      }
    },
    {
      id: 'future_prediction',
      name: 'Future Predictions',
      name_ar: 'توقعات المستقبل',
      detect: (title) => {
        const future = ['2025', '2026', '2027', '2030', 'future', 'مستقبل', 'will', 'سوف',
                       'coming', 'قادم', 'next', 'القادم', 'predict', 'توقع', 'expect', 'متوقع'];
        const titleLower = title.toLowerCase();
        return future.some(f => titleLower.includes(f));
      }
    }
  ];

  // Analyze each pattern
  for (const detector of patternDetectors) {
    const matchingVideos = topVideos.filter(v => detector.detect(v.title || ''));
    
    if (matchingVideos.length >= 2) {  // Need at least 2 videos to establish pattern
      const patternAvgViews = matchingVideos.reduce((sum, v) => sum + (v.views || 0), 0) / matchingVideos.length;
      const multiplier = patternAvgViews / avgViews;
      
      patterns[detector.id] = {
        id: detector.id,
        name: detector.name,
        name_ar: detector.name_ar,
        source: 'videos',
        videoCount: matchingVideos.length,
        avgViews: Math.round(patternAvgViews),
        multiplier: Math.round(multiplier * 100) / 100,
        confidence: Math.min(matchingVideos.length / 5, 1),  // 5+ videos = 100% confidence
        examples: matchingVideos.slice(0, 3).map(v => (v.title || '').substring(0, 80)),
        detector: detector.detect  // Keep detector function for matching signals
      };
    }
  }

  console.log(`📺 Video patterns found: ${Object.keys(patterns).length}`);
  return patterns;
}

/**
 * PART 2: Analyze COMMENT PATTERNS
 * What topics/themes does the audience ASK about?
 */
async function analyzeCommentPatterns(showId) {
  const { data: comments } = await supabase
    .from('audience_comments')
    .select('text, question, topic, likes, is_actionable')
    .eq('show_id', showId)
    .order('likes', { ascending: false })
    .limit(500);

  if (!comments || comments.length === 0) {
    return {};
  }

  const patterns = {};
  
  // Extract themes from comments
  const themeDetectors = [
    {
      id: 'explain_request',
      name: 'Explanation Requests',
      name_ar: 'طلبات الشرح',
      keywords: ['explain', 'اشرح', 'شرح', 'وضح', 'فهمني', 'what is', 'ما هو', 'ما هي', 'يعني ايه', 'كيف']
    },
    {
      id: 'topic_request',
      name: 'Topic Requests',
      name_ar: 'طلبات مواضيع',
      keywords: ['video about', 'حلقة عن', 'موضوع عن', 'تتكلم عن', 'تحكي عن', 'cover', 'غطي']
    },
    {
      id: 'personal_finance',
      name: 'Personal Finance Questions',
      name_ar: 'أسئلة التمويل الشخصي',
      keywords: ['invest', 'استثمر', 'save', 'ادخر', 'my money', 'فلوسي', 'أموالي', 'محفظتي', 'portfolio']
    },
    {
      id: 'local_economy',
      name: 'Local Economy Interest',
      name_ar: 'اهتمام بالاقتصاد المحلي',
      keywords: ['egypt', 'مصر', 'saudi', 'السعودية', 'uae', 'الإمارات', 'jordan', 'الأردن', 'morocco', 'المغرب']
    },
    {
      id: 'crypto_interest',
      name: 'Cryptocurrency Interest',
      name_ar: 'اهتمام بالعملات الرقمية',
      keywords: ['bitcoin', 'بيتكوين', 'crypto', 'كريبتو', 'عملات رقمية', 'ethereum', 'blockchain']
    },
    {
      id: 'gold_interest',
      name: 'Gold & Commodities Interest',
      name_ar: 'اهتمام بالذهب والسلع',
      keywords: ['gold', 'ذهب', 'الذهب', 'silver', 'فضة', 'commodity', 'سلع']
    }
  ];

  for (const detector of themeDetectors) {
    const matchingComments = comments.filter(c => {
      const text = ((c.text || c.question || '')).toLowerCase();
      return detector.keywords.some(k => text.includes(k.toLowerCase()));
    });

    if (matchingComments.length >= 3) {  // Need at least 3 comments
      const totalLikes = matchingComments.reduce((sum, c) => sum + (c.likes || 0), 0);
      
      patterns[detector.id] = {
        id: detector.id,
        name: detector.name,
        name_ar: detector.name_ar,
        source: 'comments',
        commentCount: matchingComments.length,
        totalLikes: totalLikes,
        avgLikes: Math.round(totalLikes / matchingComments.length),
        confidence: Math.min(matchingComments.length / 10, 1),
        examples: matchingComments.slice(0, 3).map(c => ((c.text || c.question || '')).substring(0, 100)),
        keywords: detector.keywords
      };
    }
  }

  // NEW: Use simple keyword matching to categorize comments by topic
  // NO AI - just fast keyword detection to avoid wasting API calls on comments
  const categoryMentions = {};
  
  // Process each comment with simple keyword extraction (NO AI)
  for (const comment of comments) {
    const text = comment.text || comment.question || '';
    
    // Skip short comments
    if (text.length < 20) continue;
    
    // Skip religious/greeting text
    if (text.includes('اللهم') || text.includes('سبحان') || text.includes('الحمد')) continue;
    
    // Extract keywords using simple pattern matching (no AI)
    const keywords = extractKeywordsSimple(text);
    
    // Track topic mentions based on keywords
    for (const keyword of keywords) {
      const key = keyword.type === 'country' ? `country_${keyword.name.toLowerCase()}` : keyword.name;
      
      if (!categoryMentions[key]) {
        categoryMentions[key] = { count: 0, totalLikes: 0, examples: [] };
      }
      categoryMentions[key].count += 1;
      categoryMentions[key].totalLikes += comment.likes || 0;
      if (categoryMentions[key].examples.length < 3) {
        categoryMentions[key].examples.push(text.substring(0, 100));
      }
    }
  }
  
  // Convert to patterns
  for (const [key, data] of Object.entries(categoryMentions)) {
    if (data.count >= 3) { // Minimum 3 mentions
      patterns[`audience_interest_${key}`] = {
        id: `audience_interest_${key}`,
        name: `Audience Interest: ${key.replace('country_', '').replace('_', ' ')}`,
        name_ar: `اهتمام الجمهور: ${key}`,
        source: 'comments',
        mentionCount: data.count,
        totalLikes: data.totalLikes,
        confidence: Math.min(data.count / 15, 1),
        // NEW: Store as category, not keyword
        category: key.startsWith('country_') ? null : key,
        country: key.startsWith('country_') ? key.replace('country_', '') : null,
        examples: data.examples
      };
    }
  }

  // Reduced logging - only log if patterns found
  if (Object.keys(patterns).length > 0) {
    console.log(`💬 Comment patterns found: ${Object.keys(patterns).length}`);
  }
  return patterns;
}

/**
 * Simple keyword extraction from comments (NO AI)
 * Fast, free, and sufficient for comment analysis
 */
function extractKeywordsSimple(text) {
  const keywords = [];
  const textLower = text.toLowerCase();
  
  // Topic request patterns
  const topicRequestPatterns = [
    { pattern: /حلقة عن|فيديو عن|تكلم عن|اتكلم عن|موضوع عن/i, type: 'request' }
  ];
  
  // Country patterns (simple regex)
  const countryPatterns = [
    { pattern: /الصين|صين|china|chinese/i, name: 'china', type: 'country' },
    { pattern: /أمريكا|امريكا|usa|us\b|america|american/i, name: 'usa', type: 'country' },
    { pattern: /روسيا|russia|russian/i, name: 'russia', type: 'country' },
    { pattern: /إيران|ايران|iran|iranian/i, name: 'iran', type: 'country' },
    { pattern: /مصر|egypt|egyptian/i, name: 'egypt', type: 'country' },
    { pattern: /السعودية|saudi|saudi arabia/i, name: 'saudi_arabia', type: 'country' },
    { pattern: /الإمارات|uae|emirates/i, name: 'uae', type: 'country' },
    { pattern: /تركيا|turkey|turkish/i, name: 'turkey', type: 'country' },
    { pattern: /فنزويلا|venezuela/i, name: 'venezuela', type: 'country' },
    { pattern: /أوكرانيا|ukraine/i, name: 'ukraine', type: 'country' },
    { pattern: /فلسطين|palestine|palestinian/i, name: 'palestine', type: 'country' },
    { pattern: /إسرائيل|israel|israeli/i, name: 'israel', type: 'country' }
  ];
  
  // Topic patterns
  const topicPatterns = [
    { pattern: /نفط|oil|بترول|petroleum/i, name: 'oil', type: 'topic' },
    { pattern: /ذهب|gold/i, name: 'gold', type: 'topic' },
    { pattern: /عملات رقمية|crypto|cryptocurrency|بيتكوين|bitcoin/i, name: 'crypto', type: 'topic' },
    { pattern: /اقتصاد|economy|economic/i, name: 'economy', type: 'topic' },
    { pattern: /حرب|war/i, name: 'war', type: 'topic' },
    { pattern: /عقوبات|sanctions/i, name: 'sanctions', type: 'topic' },
    { pattern: /تجارة|trade/i, name: 'trade', type: 'topic' },
    { pattern: /بنك|bank/i, name: 'banking', type: 'topic' },
    { pattern: /دولار|dollar/i, name: 'dollar', type: 'topic' },
    { pattern: /تضخم|inflation/i, name: 'inflation', type: 'topic' }
  ];
  
  // Check for topic requests
  for (const { pattern, type } of topicRequestPatterns) {
    if (pattern.test(text)) {
      keywords.push({ name: 'topic_request', type });
    }
  }
  
  // Check for countries
  for (const { pattern, name, type } of countryPatterns) {
    if (pattern.test(text)) {
      keywords.push({ name, type });
    }
  }
  
  // Check for topics
  for (const { pattern, name, type } of topicPatterns) {
    if (pattern.test(text)) {
      keywords.push({ name, type });
    }
  }
  
  // Deduplicate
  const seen = new Set();
  return keywords.filter(k => {
    const key = `${k.type}_${k.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * PART 3: Analyze COMPETITOR PATTERNS
 * What's working for competitors? What gaps exist?
 */
async function analyzeCompetitorPatterns(showId) {
  // Get competitors for this show
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, type')
    .eq('show_id', showId);

  if (!competitors || competitors.length === 0) {
    return {};
  }

  const competitorIds = competitors.map(c => c.id);

  // Get competitor videos
  const { data: videos } = await supabase
    .from('competitor_videos')
    .select('title, views, published_at, competitor_id, detected_topic')
    .in('competitor_id', competitorIds)
    .order('views', { ascending: false })
    .limit(200);

  if (!videos || videos.length === 0) {
    return {};
  }

  const patterns = {};

  // Find what topics are TRENDING with competitors (recent + high views)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentVideos = videos.filter(v => {
    if (!v.published_at) return false;
    return new Date(v.published_at) > thirtyDaysAgo;
  });
  const avgViews = videos.reduce((sum, v) => sum + (v.views || 0), 0) / videos.length;

  // Use same pattern detectors as video analysis
  const patternDetectors = [
    {
      id: 'competitor_superpower_tension',
      name: 'Competitors: Power Conflicts',
      detect: (title) => {
        const powers = ['us', 'usa', 'china', 'russia', 'iran', 'أمريكا', 'الصين', 'روسيا'];
        const tension = ['vs', 'war', 'حرب', 'conflict', 'صراع', 'sanctions', 'عقوبات', 'crisis'];
        const titleLower = title.toLowerCase();
        return powers.some(p => titleLower.includes(p)) && tension.some(t => titleLower.includes(t));
      }
    },
    {
      id: 'competitor_tech',
      name: 'Competitors: Tech Topics',
      detect: (title) => {
        const tech = ['ai', 'chip', 'nvidia', 'tech', 'الذكاء الاصطناعي', 'رقاقة', 'تقنية'];
        return tech.some(t => title.toLowerCase().includes(t));
      }
    },
    {
      id: 'competitor_crisis',
      name: 'Competitors: Crisis Coverage',
      detect: (title) => {
        const crisis = ['crisis', 'أزمة', 'collapse', 'انهيار', 'crash', 'recession', 'ركود'];
        return crisis.some(c => title.toLowerCase().includes(c));
      }
    }
  ];

  for (const detector of patternDetectors) {
    const matchingVideos = recentVideos.filter(v => detector.detect(v.title || ''));
    
    if (matchingVideos.length >= 2) {
      const patternAvgViews = matchingVideos.reduce((sum, v) => sum + (v.views || 0), 0) / matchingVideos.length;
      
      patterns[detector.id] = {
        id: detector.id,
        name: detector.name,
        source: 'competitors',
        videoCount: matchingVideos.length,
        avgViews: Math.round(patternAvgViews),
        isHot: patternAvgViews > avgViews * 1.5,  // 50% above average = hot
        confidence: Math.min(matchingVideos.length / 5, 1),
        examples: matchingVideos.slice(0, 3).map(v => (v.title || '').substring(0, 80)),
        detector: detector.detect
      };
    }
  }

  // Find GAPS: Topics competitors cover that show hasn't
  // This will be cross-referenced with show's videos in mergePatterns

  console.log(`👥 Competitor patterns found: ${Object.keys(patterns).length}`);
  return patterns;
}

/**
 * PART 4: Merge patterns from all sources
 */
function mergePatterns(videoPatterns, commentPatterns, competitorPatterns) {
  const merged = {};

  // Add video patterns (highest weight - proven performance)
  for (const [id, pattern] of Object.entries(videoPatterns)) {
    merged[id] = {
      ...pattern,
      weight: 3,  // Highest weight - proven by YOUR audience
      totalScore: pattern.multiplier * 3
    };
  }

  // Add comment patterns (variable weight based on type)
  for (const [id, pattern] of Object.entries(commentPatterns)) {
    if (merged[id]) {
      // Pattern exists from videos - boost it
      merged[id].commentSupport = true;
      merged[id].totalScore += 2;
    } else {
      // Differentiate: Audience Interest patterns get lower weight
      const weight = pattern.topic ? 1 : 2;  // Audience Interest: 1, Theme patterns: 2
      merged[id] = {
        ...pattern,
        weight: weight,
        totalScore: weight
      };
    }
  }

  // Add competitor patterns (lower weight - external validation)
  for (const [id, pattern] of Object.entries(competitorPatterns)) {
    const baseId = id.replace('competitor_', '');
    if (merged[baseId]) {
      // Pattern exists from your data - competitor validates it
      merged[baseId].competitorValidation = true;
      merged[baseId].totalScore += 1;
    } else {
      merged[id] = {
        ...pattern,
        weight: 1,
        totalScore: pattern.isHot ? 2 : 1
      };
    }
  }

  // Sort by total score
  const sorted = Object.entries(merged)
    .sort((a, b) => b[1].totalScore - a[1].totalScore);

  return Object.fromEntries(sorted);
}

/**
 * Helper: Get topic variations for matching
 * Includes English and Arabic variations
 */
function getTopicVariations(topic) {
  const variations = {
    'china': ['china', 'chinese', 'beijing', 'الصين', 'صين', 'الصيني', 'بكين'],
    'russia': ['russia', 'russian', 'moscow', 'putin', 'روسيا', 'روسي', 'بوتين', 'موسكو'],
    'iran': ['iran', 'iranian', 'tehran', 'إيران', 'ايران', 'إيراني', 'طهران'],
    'trump': ['trump', 'ترامب', 'ترمب', 'دونالد ترامب'],
    'oil': ['oil', 'petroleum', 'نفط', 'النفط', 'بترول'],
    'gold': ['gold', 'ذهب', 'الذهب'],
    'dollar': ['dollar', 'usd', 'دولار', 'الدولار'],
    'crypto': ['bitcoin', 'crypto', 'cryptocurrency', 'بيتكوين', 'كريبتو', 'عملات رقمية'],
    'ai': ['ai', 'artificial intelligence', 'الذكاء الاصطناعي', 'ذكاء اصطناعي'],
    'inflation': ['inflation', 'تضخم', 'التضخم'],
    'war': ['war', 'حرب', 'الحرب'],
  };
  
  return variations[topic?.toLowerCase()] || [topic?.toLowerCase()].filter(Boolean);
}

/**
 * Check if a topic is the PRIMARY subject of a signal
 * Not just mentioned somewhere in the text
 * Requires topic to appear in the TITLE (not description)
 */
function isTopicPrimarySubject(signal, topic) {
  const title = (signal.title || '').toLowerCase();
  
  if (!title || title.length === 0) return false;
  
  // Topic variations to check
  const topicVariations = getTopicVariations(topic);
  
  // Check if ANY variation appears in the TITLE (not description)
  // Title is the best indicator of what the signal is ABOUT
  const inTitle = topicVariations.some(v => title.includes(v.toLowerCase()));
  
  if (!inTitle) return false;
  
  // Additional check: Make sure it's not just a passing mention
  // The topic should appear early in the title (first 60% of characters)
  // OR the title should be short (< 80 chars) and contain the topic
  
  const titleLength = title.length;
  const topicPosition = topicVariations.reduce((minPos, v) => {
    const pos = title.indexOf(v.toLowerCase());
    return pos >= 0 && (minPos === -1 || pos < minPos) ? pos : minPos;
  }, -1);
  
  // Topic appears in first 60% of title, or title is short
  return topicPosition >= 0 && (topicPosition < titleLength * 0.6 || titleLength < 80);
}

/**
 * PART 5: Score a signal against learned patterns
 * NOW USES TOPIC INTELLIGENCE for accurate matching
 * @param {Object} signal - The signal to score
 * @param {Object} patterns - Learned behavior patterns
 * @param {Object} learnedWeights - Learned pattern weights from user feedback (optional)
 */
export async function scoreSignalByPatterns(signal, patterns, learnedWeights = {}) {
  const title = signal.title || '';
  const description = signal.description || '';
  
  // Generate fingerprint for this signal (uses cache if available)
  const signalFingerprint = await generateTopicFingerprint({
    title,
    description,
    id: signal.id,
    type: 'signal',
    skipEmbedding: true, // Skip embedding for pattern matching (not needed)
    skipCache: false // Use cache for performance
  });
  
  const matches = [];
  let totalBoost = 0;

  for (const [patternId, pattern] of Object.entries(patterns)) {
    let isMatch = false;
    let matchConfidence = 0;

    // METHOD 1: Detector function (behavior patterns like "superpower_tension")
    if (pattern.detector && typeof pattern.detector === 'function') {
      isMatch = pattern.detector(signal.title || '');
      matchConfidence = isMatch ? 0.8 : 0;
    }
    // METHOD 2: Keywords (theme patterns) - NOW SMARTER
    else if (pattern.keywords && Array.isArray(pattern.keywords)) {
      // Check if signal's topics/entities overlap with pattern keywords
      const signalTopics = [
        ...signalFingerprint.entities.topics.map(t => t.toLowerCase()),
        ...signalFingerprint.entities.countries.map(c => c.toLowerCase()),
        signalFingerprint.topicCategory
      ];
      
      const keywordMatches = pattern.keywords.filter(kw => 
        signalTopics.some(t => t.toLowerCase().includes(kw.toLowerCase()))
      );
      
      isMatch = keywordMatches.length >= 1;
      matchConfidence = keywordMatches.length / Math.max(pattern.keywords.length, 1);
    }
    // METHOD 3: Topic-based patterns (e.g., "audience_interest_china")
    // THIS IS THE KEY FIX - use topic intelligence instead of simple includes()
    else if (pattern.topic) {
      // NEW (smart): Check if signal is actually ABOUT this topic
      const topicMatch = isSignalAboutTopic(signalFingerprint, pattern.topic);
      isMatch = topicMatch.matches;
      matchConfidence = topicMatch.confidence;
    }
    // METHOD 4: Category-based patterns (new - from topic intelligence)
    else if (pattern.category) {
      const categoryMatch = signalFingerprint.topicCategory === pattern.category;
      isMatch = categoryMatch;
      matchConfidence = categoryMatch ? 0.8 : 0;
    }
    else if (pattern.country) {
      const countryMatch = signalFingerprint.entities.countries.some(
        c => c.toLowerCase() === pattern.country.toLowerCase()
      );
      isMatch = countryMatch;
      matchConfidence = countryMatch ? 0.7 : 0;
    }

    if (isMatch && matchConfidence > 0.3) {
      let boost = 0;
      let evidence = '';

      if (pattern.source === 'videos') {
        // Pattern bonus: 1.1x = +3, 1.2x = +6, 1.3x = +9, 1.4x+ = +12 (capped)
        const patternBonus = Math.min(12, Math.round((pattern.multiplier - 1) * 30));
        boost = Math.round(patternBonus * matchConfidence);
        evidence = `Matches "${pattern.name}" pattern (your videos avg ${formatNumber(pattern.avgViews)} views, ${pattern.multiplier}x your average)`;
      } else if (pattern.source === 'comments') {
        if (pattern.topic) {
          boost = Math.min(pattern.mentionCount * matchConfidence, 10);
          evidence = `${pattern.mentionCount} audience comments about this topic`;
        } else {
          boost = Math.min((pattern.commentCount || 0) * 2 * matchConfidence, 15);
          evidence = `${pattern.commentCount || 0} audience comments asking for this`;
        }
      } else if (pattern.source === 'competitors') {
        boost = pattern.isHot ? 15 : 10;
        boost = Math.round(boost * matchConfidence);
        evidence = `Trending with competitors (${pattern.videoCount} recent videos)`;
      }

      // Bonus for multi-source validation
      if (pattern.commentSupport) boost += 5;
      if (pattern.competitorValidation) boost += 5;

      // Apply learned weight multiplier
      const learnedWeight = learnedWeights[patternId]?.weight || 1.0;
      boost = Math.round(boost * learnedWeight);

      if (boost > 0) {
        matches.push({
          patternId,
          patternName: pattern.name,
          patternNameAr: pattern.name_ar,
          source: pattern.source,
          boost,
          evidence,
          confidence: matchConfidence,
          isLearned: learnedWeights[patternId]?.liked > 0,
          // NEW: Include what actually matched
          matchedEntities: {
            topics: signalFingerprint.entities.topics,
            countries: signalFingerprint.entities.countries,
            category: signalFingerprint.topicCategory
          }
        });

        totalBoost += boost;
      }
    }
  }

  // Cap total boost at 50
  totalBoost = Math.min(totalBoost, 50);

  return {
    totalBoost,
    matches,
    fingerprint: signalFingerprint,
    summary: matches.length > 0 
      ? `Matches ${matches.length} behavior pattern(s)` 
      : 'No behavior patterns matched'
  };
}

/**
 * Check if a signal is actually ABOUT a topic (not just mentions it)
 * Uses Topic Intelligence for accurate matching
 */
function isSignalAboutTopic(signalFingerprint, topic) {
  const topicLower = topic.toLowerCase();
  
  // Check 1: Is this topic in the signal's countries?
  const countryMatch = signalFingerprint.entities.countries.some(
    c => c.toLowerCase().includes(topicLower) || topicLower.includes(c.toLowerCase())
  );
  
  // Check 2: Is this topic in the signal's topics?
  const topicMatch = signalFingerprint.entities.topics.some(
    t => t.toLowerCase().includes(topicLower) || topicLower.includes(t.toLowerCase())
  );
  
  // Check 3: Is this topic in the category?
  const categoryMatch = signalFingerprint.topicCategory.toLowerCase().includes(topicLower);
  
  // Check 4: Is this topic a person?
  const personMatch = signalFingerprint.entities.people.some(
    p => p.toLowerCase().includes(topicLower)
  );
  
  // Calculate confidence
  let confidence = 0;
  if (countryMatch) confidence += 0.4;
  if (topicMatch) confidence += 0.4;
  if (categoryMatch) confidence += 0.3;
  if (personMatch) confidence += 0.2;
  
  // Must have at least country, topic, or category match (not just person)
  const matches = countryMatch || topicMatch || categoryMatch;
  
  return {
    matches,
    confidence: Math.min(confidence, 1),
    details: { countryMatch, topicMatch, categoryMatch, personMatch }
  };
}

/**
 * Helper: Format number
 */
function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return Math.round(num / 1000) + 'K';
  return num.toString();
}

/**
 * Cache patterns for a show (call periodically, not on every request)
 * Uses in-memory cache + optional database cache
 */
let patternCache = {};
let cacheTimestamp = {};
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function getShowPatterns(showId, forceRefresh = false) {
  const now = Date.now();
  
  // Check in-memory cache first
  if (!forceRefresh && patternCache[showId] && (now - cacheTimestamp[showId]) < CACHE_DURATION) {
    return patternCache[showId];
  }

  // Try database cache
  if (!forceRefresh) {
    try {
      const { data: cached } = await supabase
        .from('show_behavior_patterns')
        .select('patterns, learned_at')
        .eq('show_id', showId)
        .maybeSingle();

      if (cached && cached.patterns) {
        const cacheAge = now - new Date(cached.learned_at).getTime();
        if (cacheAge < CACHE_DURATION) {
          // Restore detector functions from pattern definitions
          const patterns = cached.patterns;
          patternCache[showId] = patterns;
          cacheTimestamp[showId] = now;
          return patterns;
        }
      }
    } catch (dbError) {
      console.warn('Could not load patterns from database cache:', dbError);
      // Continue to learn fresh patterns
    }
  }

  // Learn fresh patterns
  const patterns = await learnBehaviorPatterns(showId);
  
  // Update in-memory cache
  patternCache[showId] = patterns;
  cacheTimestamp[showId] = now;
  
  // Save to database cache (async, don't wait)
  try {
    const { error: saveError } = await supabase
      .from('show_behavior_patterns')
      .upsert({
        show_id: showId,
        patterns: patterns,
        learned_at: new Date().toISOString(),
        video_count: Object.values(patterns).filter(p => p.source === 'videos').length,
        comment_count: Object.values(patterns).filter(p => p.source === 'comments').length,
        competitor_video_count: Object.values(patterns).filter(p => p.source === 'competitors').length
      }, {
        onConflict: 'show_id'
      });

    if (saveError) {
      console.warn('Could not save patterns to database cache:', saveError);
    }
  } catch (saveError) {
    console.warn('Error saving patterns to database:', saveError);
  }
  
  return patterns;
}

export default {
  learnBehaviorPatterns,
  scoreSignalByPatterns,
  getShowPatterns
};

