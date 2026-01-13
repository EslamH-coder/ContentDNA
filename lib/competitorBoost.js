/**
 * Competitor Breakout Boost System
 * Boosts signals when competitors have breakout videos on same topic
 */

import { createClient } from '@supabase/supabase-js';
import { isValidForEvidence } from './contentFilter';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Get competitor breakouts for a show (cached for the refresh cycle)
 */
export async function getCompetitorBreakouts(showId) {
  console.log('🔥 Fetching competitor breakouts for show:', showId);
  
  // Get skip patterns for this show
  let patterns = [];
  try {
    const { data: skipPatterns } = await supabase
      .from('skip_patterns')
      .select('pattern_type, pattern_value')
      .eq('show_id', showId);
    
    patterns = skipPatterns || [];
  } catch (error) {
    // If table doesn't exist, continue without patterns
    console.log('⚠️ Skip patterns table not found, continuing without filters');
    patterns = [];
  }
  
  console.log(`🚫 Loaded ${patterns.length} skip patterns`);

  // Get competitors for this show
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, type')
    .eq('show_id', showId)
    .eq('tracking_enabled', true);

  if (!competitors || competitors.length === 0) {
    console.log('⚠️ No competitors found');
    return { breakouts: [], competitorMap: {} };
  }

  const competitorIds = competitors.map(c => c.id);
  const competitorMap = {};
  competitors.forEach(c => {
    competitorMap[c.id] = { name: c.name, type: c.type };
  });

  // Get all competitor videos (last 90 days for median calculation)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: allVideos } = await supabase
    .from('competitor_videos')
    .select('id, competitor_id, title, views, published_at, duration_seconds, detected_topic, youtube_video_id, entities')
    .in('competitor_id', competitorIds)
    .gte('published_at', ninetyDaysAgo.toISOString())
    .order('published_at', { ascending: false });

  if (!allVideos || allVideos.length === 0) {
    console.log('⚠️ No competitor videos found');
    return { breakouts: [], competitorMap };
  }

  // Filter out videos that are not valid for evidence (NULL topics, "other" topics, skip patterns)
  const validVideos = allVideos.filter(video => isValidForEvidence(video, patterns));
  console.log(`✅ Filtered ${allVideos.length} videos → ${validVideos.length} valid (excluded ${allVideos.length - validVideos.length} with NULL/other topics or skip patterns)`);
  
  // Extract and cache entities for videos that don't have them (using fast regex extraction)
  console.log('🔍 Checking entity cache for competitor videos...');
  const videosNeedingEntities = validVideos.filter(v => !v.entities || Object.keys(v.entities || {}).length === 0);
  console.log(`📝 ${videosNeedingEntities.length} videos need entity extraction (${validVideos.length - videosNeedingEntities.length} already cached)`);
  
  if (videosNeedingEntities.length > 0) {
    // Extract entities using fast regex (no AI)
    const entityUpdates = [];
    for (const video of videosNeedingEntities) {
      const entities = extractEntitiesFast(video.title);
      // Check if we found any entities (object with arrays)
      const hasEntities = entities && (
        entities.people?.length > 0 ||
        entities.countries?.length > 0 ||
        entities.topics?.length > 0 ||
        entities.organizations?.length > 0
      );
      
      if (hasEntities) {
        entityUpdates.push({
          id: video.id,
          entities: entities
        });
        // Update in-memory video immediately
        video.entities = entities;
      }
    }
    
    // Batch update entities in database (async, don't block)
    if (entityUpdates.length > 0) {
      console.log(`💾 Caching entities for ${entityUpdates.length} videos...`);
      // Update in batches to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < entityUpdates.length; i += batchSize) {
        const batch = entityUpdates.slice(i, i + batchSize);
        await Promise.all(
          batch.map(update =>
            supabase
              .from('competitor_videos')
              .update({ entities: update.entities })
              .eq('id', update.id)
          )
        );
      }
      console.log(`✅ Cached entities for ${entityUpdates.length} videos`);
    }
  }

  // Calculate median per competitor per format (using valid videos only)
  const medians = {};
  const videosByCompetitor = {};
  
  validVideos.forEach(v => {
    const format = v.duration_seconds > 90 ? 'long' : 'short';
    const key = `${v.competitor_id}_${format}`;
    
    if (!videosByCompetitor[key]) videosByCompetitor[key] = [];
    videosByCompetitor[key].push(v.views || 0);
  });

  for (const [key, views] of Object.entries(videosByCompetitor)) {
    const sorted = [...views].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medians[key] = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // Find breakouts (last 7 days, 1.5x+ median) - only from valid videos
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const breakouts = [];
  
  validVideos.forEach(v => {
    if (new Date(v.published_at) < sevenDaysAgo) return;
    
    const format = v.duration_seconds > 90 ? 'long' : 'short';
    const medianKey = `${v.competitor_id}_${format}`;
    const median = medians[medianKey] || 0;
    
    if (median === 0 || !v.views || v.views < median * 1.5) return;
    
    const ratio = v.views / median;
    const competitor = competitorMap[v.competitor_id];
    
    breakouts.push({
      id: v.id,
      youtube_video_id: v.youtube_video_id || null, // Add YouTube video ID for linking
      title: v.title,
      views: v.views,
      median,
      ratio: Math.round(ratio * 100) / 100,
      competitorId: v.competitor_id,
      competitorName: competitor?.name || 'Unknown',
      competitorType: competitor?.type || 'direct',
      format,
      detectedTopic: v.detected_topic,
      publishedAt: v.published_at,
      // Extract keywords from title for matching
      keywords: extractKeywords(v.title),
      // Include cached entities (if available)
      entities: v.entities || null
    });
  });

  console.log(`🔥 Found ${breakouts.length} breakout videos`);
  
  return { breakouts, competitorMap };
}

/**
 * Extract keywords from title for matching
 */
function extractKeywords(title) {
  if (!title) return [];
  
  // Common words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'this', 'that', 'these', 'those', 'it', 'its', 'how', 'why', 'what', 'when',
    'من', 'في', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'التي', 'الذي', 'هل',
    'كيف', 'لماذا', 'ماذا', 'متى', 'أين', 'ما', 'و', 'أو', 'لكن', 'ثم'
  ]);
  
  // Extract words, filter stop words and short words
  const words = title
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')  // Keep Arabic and English
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));
  
  return [...new Set(words)];  // Unique keywords
}

// Topics that should NOT be used for matching (too generic)
const EXCLUDED_TOPICS = ['other_stories', 'other_misc', 'other', 'uncategorized'];

/**
 * Keyword classification (inline to avoid import issues)
 */
const KEYWORD_TYPES = {
  generic: ['أمريكي', 'الأمريكي', 'الاميركي', 'أميركي', 'american', 'us', 'usa', 'الرئيس', 'president', 'رئيس'],
  person: ['trump', 'ترامب', 'ترمب', 'دونالد', 'biden', 'بايدن', 'musk', 'ماسك', 'putin', 'بوتين'],
  topic: ['credit', 'بطاقات', 'بطاقة', 'ائتمان', 'bank', 'بنك', 'china', 'الصين', 'صين', 'iran', 'إيران', 'ايران', 'oil', 'نفط', 'gas', 'غاز', 'tariff', 'trade', 'تجارة']
};

function extractClassifiedKeywords(text) {
  if (!text) return { generic: [], person: [], topic: [] };
  const t = text.toLowerCase();
  const result = { generic: [], person: [], topic: [] };
  for (const word of KEYWORD_TYPES.generic) if (t.includes(word.toLowerCase())) result.generic.push(word);
  for (const word of KEYWORD_TYPES.person) if (t.includes(word.toLowerCase())) result.person.push(word);
  for (const word of KEYWORD_TYPES.topic) if (t.includes(word.toLowerCase())) result.topic.push(word);
  return result;
}

function hasMeaningfulMatch(text1, text2) {
  const kw1 = extractClassifiedKeywords(text1);
  const kw2 = extractClassifiedKeywords(text2);
  const personOverlap = kw1.person.filter(p => kw2.person.includes(p));
  const topicOverlap = kw1.topic.filter(t => kw2.topic.includes(t));
  const genericOverlap = kw1.generic.filter(g => kw2.generic.includes(g));
  const hasMeaningful = topicOverlap.length >= 2 || (personOverlap.length >= 1 && topicOverlap.length >= 1);
  return {
    meaningful: hasMeaningful,
    personOverlap,
    topicOverlap,
    genericOverlap,
    displayMatches: [...personOverlap, ...topicOverlap],
    reason: hasMeaningful ? `Matched: ${[...personOverlap, ...topicOverlap].join(', ')}` : `Rejected: Only generic matches`
  };
}

/**
 * Check if two titles share enough keywords
 * FIXED: Now uses meaningful matching (person+topic or 2+topic, not just generic)
 */
function hasKeywordOverlap(title1, title2, minMatches = 2) {
  // NEW: Use meaningful matching (classifies keywords as generic/person/topic)
  const meaningfulMatch = hasMeaningfulMatch(title1, title2);
  
  if (meaningfulMatch.meaningful) {
    // Meaningful match found - return the display matches
    return {
      hasEnough: true,
      matches: meaningfulMatch.displayMatches,
      count: meaningfulMatch.displayMatches.length,
      isMeaningful: true
    };
  }
  
  // No meaningful match - check if we have enough generic matches (for backwards compatibility)
  // But require higher threshold for generic-only matches
  const stopWords = [
    'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'are', 'was', 'were',
    'في', 'من', 'إلى', 'على', 'و', 'أن', 'هذا', 'هذه', 'التي', 'الذي', 'عن', 'مع'
  ];
  
  const extractWords = (text) => {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s\u0600-\u06FF]/g, ' ') // Keep Arabic and English letters
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));
  };
  
  const words1 = new Set(extractWords(title1));
  const words2 = new Set(extractWords(title2));
  
  const overlap = [...words1].filter(w => words2.has(w));
  
  // FIXED: Require higher threshold for generic-only matches
  // If no meaningful match, require 3+ generic matches (was 2)
  const requiredMatches = meaningfulMatch.personOverlap.length > 0 ? minMatches : Math.max(minMatches, 3);
  
  return {
    hasEnough: overlap.length >= requiredMatches,
    matches: overlap,
    count: overlap.length,
    isMeaningful: false,
    reason: meaningfulMatch.reason
  };
}

/**
 * Extract entities (people, countries) from title - FAST regex version (no AI)
 * Returns structured entities object compatible with topicIntelligence format
 */
function extractEntitiesFast(title) {
  if (!title) return { people: [], countries: [], topics: [], organizations: [] };
  
  const titleLower = (title || '').toLowerCase();
  const entities = {
    people: [],
    countries: [],
    topics: [],
    organizations: []
  };
  
  // People
  if (/\btrump\b|ترامب|ترمب|دونالد/i.test(title)) entities.people.push('Trump');
  if (/\bbiden\b|بايدن|جو بايدن/i.test(title)) entities.people.push('Biden');
  if (/\bputin\b|بوتين|فلاديمير/i.test(title)) entities.people.push('Putin');
  if (/\bxi\b|شي|جين بينغ/i.test(title)) entities.people.push('Xi Jinping');
  if (/\bmaduro\b|مادورو/i.test(title)) entities.people.push('Maduro');
  if (/\bmusk\b|ماسك|إيلون/i.test(title)) entities.people.push('Musk');
  if (/\bnetanyahu\b|نتنياهو/i.test(title)) entities.people.push('Netanyahu');
  if (/\bzelensky\b|زيلينسكي/i.test(title)) entities.people.push('Zelensky');
  if (/\berdogan\b|أردوغان/i.test(title)) entities.people.push('Erdogan');
  if (/\bmbs\b|محمد بن سلمان/i.test(title)) entities.people.push('MBS');
  if (/\bkhamenei\b|خامنئي/i.test(title)) entities.people.push('Khamenei');
  
  // Countries/Regions
  if (/\bchina\b|الصين|صين|chinese|بكين/i.test(title)) entities.countries.push('China');
  if (/\brussia\b|روسيا|russian|موسكو/i.test(title)) entities.countries.push('Russia');
  if (/\biran\b|إيران|ايران|iranian|tehran|طهران/i.test(title)) entities.countries.push('Iran');
  if (/\bvenezuela\b|فنزويلا|caracas|كاراكاس/i.test(title)) entities.countries.push('Venezuela');
  if (/\bsaudi\b|السعودية|saudi arabia|الرياض/i.test(title)) entities.countries.push('Saudi Arabia');
  if (/\buae\b|الإمارات|emirates|دبي|dubai/i.test(title)) entities.countries.push('UAE');
  if (/\begypt\b|مصر|egyptian|القاهرة/i.test(title)) entities.countries.push('Egypt');
  if (/\bukraine\b|أوكرانيا|اوكرانيا|ukrainian|كييف/i.test(title)) entities.countries.push('Ukraine');
  if (/\bisrael\b|إسرائيل|israeli/i.test(title)) entities.countries.push('Israel');
  if (/\bturkey\b|تركيا|turkish/i.test(title)) entities.countries.push('Turkey');
  if (/\busa\b|us\b|america|american|الولايات المتحدة|واشنطن/i.test(title)) entities.countries.push('USA');
  if (/\bpalestine\b|فلسطين|palestinian|gaza|غزة/i.test(title)) entities.countries.push('Palestine');
  
  // Topics
  if (/oil|نفط|بترول|opec|أوبك|petroleum/i.test(title)) entities.topics.push('Oil');
  if (/gold|ذهب|gold price|سعر الذهب/i.test(title)) entities.topics.push('Gold');
  if (/dollar|دولار|usd|currency|عملة/i.test(title)) entities.topics.push('Currency');
  if (/\bai\b|artificial intelligence|الذكاء الاصطناعي|chatgpt/i.test(title)) entities.topics.push('AI');
  if (/bitcoin|بتكوين|crypto|cryptocurrency/i.test(title)) entities.topics.push('Crypto');
  if (/trade|تجارة|tariff|تعريفة|sanction|عقوبات/i.test(title)) entities.topics.push('Trade');
  if (/war|حرب|conflict|صراع/i.test(title)) entities.topics.push('War');
  if (/election|انتخاب|vote|تصويت/i.test(title)) entities.topics.push('Election');
  if (/crisis|أزمة|recession|ركود/i.test(title)) entities.topics.push('Crisis');
  
  // Organizations
  if (/nato|حلف الناتو/i.test(title)) entities.organizations.push('NATO');
  if (/un\b|united nations|الأمم المتحدة/i.test(title)) entities.organizations.push('UN');
  if (/eu\b|european union|الاتحاد الأوروبي/i.test(title)) entities.organizations.push('EU');
  if (/opec|أوبك/i.test(title)) entities.organizations.push('OPEC');
  if (/tesla|تسلا/i.test(title)) entities.organizations.push('Tesla');
  if (/nvidia|إنفيديا/i.test(title)) entities.organizations.push('Nvidia');
  
  return entities;
}

/**
 * Extract entities (people, countries) from title - LEGACY (kept for backward compatibility)
 * @deprecated Use extractEntitiesFast() instead
 */
function extractEntities(title) {
  const entities = extractEntitiesFast(title);
  // Convert to legacy array format
  return [
    ...entities.people,
    ...entities.countries,
    ...entities.topics,
    ...entities.organizations
  ];
}

/**
 * Extract topic context from title
 * Returns array of topic categories (e.g., ['finance_consumer', 'iran_politics'])
 */
function extractTopicContext(title) {
  const topics = [];
  const titleLower = (title || '').toLowerCase();
  
  // Economic/Financial/Consumer topics
  if (/credit|card|بطاقات|ائتمان|bank|بنك|loan|قرض|debt|دين|consumer|مستهلك|exploit|استغلال|fee|رسوم/i.test(titleLower)) {
    topics.push('finance_consumer');
  }
  
  // Foreign policy / Iran
  if (/iran|إيران|ايران|tehran|طهران|protest|تظاهر|مظاهر|regime|نظام/i.test(titleLower)) {
    topics.push('iran_politics');
  }
  
  // Trade / Tariffs
  if (/tariff|تعريف|trade|تجار|import|export|رسوم|sanction|عقوبة/i.test(titleLower)) {
    topics.push('trade_policy');
  }
  
  // Venezuela
  if (/venezuela|فنزويلا|maduro|مادورو|caracas|كاراكاس/i.test(titleLower)) {
    topics.push('venezuela');
  }
  
  // China relations
  if (/china|الصين|صين|beijing|بكين|chinese|taiwan|تايوان/i.test(titleLower)) {
    topics.push('china_relations');
  }
  
  // Oil / Energy
  if (/oil|نفط|بترول|gas|غاز|energy|طاقة|opec|أوبك/i.test(titleLower)) {
    topics.push('energy');
  }
  
  // Tech
  if (/\bai\b|chip|رقاقة|tech|تقني|nvidia|semiconductor|أشباه/i.test(titleLower)) {
    topics.push('technology');
  }
  
  // Gold / Commodities
  if (/gold|ذهب|silver|فضة|commodity|سلع/i.test(titleLower)) {
    topics.push('commodities');
  }
  
  // Crypto
  if (/bitcoin|بيتكوين|crypto|كريبتو|blockchain|بلوك تشين/i.test(titleLower)) {
    topics.push('crypto');
  }
  
  // War / Conflict
  if (/war|حرب|conflict|صراع|battle|معركة/i.test(titleLower)) {
    topics.push('conflict');
  }
  
  // Economic crisis
  if (/crisis|أزمة|recession|ركود|collapse|انهيار|inflation|تضخم/i.test(titleLower)) {
    topics.push('economic_crisis');
  }
  
  // Elections / Democracy
  if (/election|انتخاب|vote|تصويت|democracy|ديمقراطية|presidential|رئاسي/i.test(titleLower)) {
    topics.push('elections');
  }
  
  return topics;
}

/**
 * Import universal topic intelligence
 */
import { isRelevantCompetitorVideo } from './topicIntelligence.js';

/**
 * Check if a competitor video is relevant to a signal
 * UPDATED: Uses universal topic intelligence (entity-based + embeddings)
 */
async function isRelevantMatch(signal, video) {
  const signalTitle = signal.title || '';
  const videoTitle = video.title || '';
  const signalTopic = signal.matched_topic || signal.raw_data?.topicId || null;
  
  // Match if same specific topic (highest confidence)
  if (signalTopic && signalTopic === video.detectedTopic && !EXCLUDED_TOPICS.includes(video.detectedTopic)) {
    return { 
      relevant: true, 
      reason: `topic: ${video.detectedTopic}`, 
      method: 'topic_id',
      confidence: 0.95,
      matches: { topics: [video.detectedTopic] }
    };
  }
  
  // Use universal topic intelligence matcher
  // Use cached entities if available (from database), otherwise extract on-the-fly
  const videoEntities = video.entities || (video.title ? extractEntitiesFast(video.title) : null);
  
  try {
    const matchResult = await isRelevantCompetitorVideo(
      { title: signalTitle, entities: signal.entities || null },
      { title: videoTitle, entities: videoEntities }
    );
    
    // Convert to expected format
    return {
      relevant: matchResult.relevant,
      reason: matchResult.reason,
      method: matchResult.semanticSimilarity > 0 ? 'embedding' : 'entity',
      confidence: matchResult.confidence,
      matches: {
        people: matchResult.entityOverlap?.people || [],
        countries: matchResult.entityOverlap?.countries || [],
        topics: matchResult.entityOverlap?.topics || [],
        organizations: matchResult.entityOverlap?.organizations || []
      },
      similarityScore: matchResult.semanticSimilarity
    };
  } catch (error) {
    console.warn('Topic intelligence matching failed, falling back to topic ID check:', error.message);
    
    // Fallback: topic ID match only
    if (signalTopic && signalTopic === video.detectedTopic) {
      return { 
        relevant: true, 
        reason: `topic: ${video.detectedTopic}`, 
        method: 'topic_id_fallback',
        confidence: 0.9
      };
    }
    
    return { 
      relevant: false, 
      reason: 'matching_failed', 
      method: 'fallback',
      confidence: 0
    };
  }
}

/**
 * Calculate competitor boost for a signal
 * UPDATED: Uses hybrid topic matching (entity-based + embeddings)
 */
export async function calculateCompetitorBoost(signal, breakouts) {
  if (!breakouts || breakouts.length === 0) {
    return { boost: 0, evidence: [] };
  }

  const signalTitle = (signal.title || '').toLowerCase();
  const signalDescription = (signal.description || '').toLowerCase();
  const signalKeywords = signal.matched_keywords || [];
  const signalTopic = signal.matched_topic || signal.raw_data?.topicId || null;
  
  const matchingBreakouts = [];

  for (const breakout of breakouts) {
    // Use hybrid topic matcher (entity-based + embeddings)
    const relevance = await isRelevantMatch(signal, breakout);
    
    if (!relevance.relevant) {
      continue; // Don't use this as evidence
    }
    
    // Calculate match score for ranking
    let matchScore = 0;
    let matchReasons = [];

    // Topic match gets highest score
    if (breakout.detectedTopic && signalTopic && breakout.detectedTopic === signalTopic) {
      matchScore += 5;
      matchReasons.push(`topic: ${breakout.detectedTopic}`);
    }

    // Use match information from hybrid matcher
    if (relevance.matches) {
      const matchSummary = [];
      if (relevance.matches.people?.length) {
        matchScore += relevance.matches.people.length * 2;
        matchSummary.push(`people: ${relevance.matches.people.join(', ')}`);
      }
      if (relevance.matches.countries?.length) {
        matchScore += relevance.matches.countries.length * 2;
        matchSummary.push(`countries: ${relevance.matches.countries.join(', ')}`);
      }
      if (relevance.matches.topics?.length) {
        matchScore += relevance.matches.topics.length * 3; // Topics weighted higher
        matchSummary.push(`topics: ${relevance.matches.topics.join(', ')}`);
      }
      if (relevance.matches.organizations?.length) {
        matchScore += relevance.matches.organizations.length * 2;
        matchSummary.push(`orgs: ${relevance.matches.organizations.join(', ')}`);
      }
      
      if (matchSummary.length > 0) {
        matchReasons.push(matchSummary.join('; '));
      }
    }
    
    // Add embedding similarity score if available
    if (relevance.method === 'embedding' && relevance.similarityScore) {
      matchScore += Math.round(relevance.similarityScore * 10); // 0-10 bonus from similarity
      matchReasons.push(`similarity: ${Math.round(relevance.similarityScore * 100)}%`);
    }

    // Build display matches from meaningful entities (not raw keywords)
    const displayMatches = [];
    if (relevance.matches?.people?.length) {
      displayMatches.push(...relevance.matches.people);
    }
    if (relevance.matches?.countries?.length) {
      displayMatches.push(...relevance.matches.countries);
    }
    if (relevance.matches?.topics?.length) {
      displayMatches.push(...relevance.matches.topics);
    }
    
    // Add to matching breakouts (relevance already verified)
    matchingBreakouts.push({
      ...breakout,
      matchScore: matchScore || 1, // Minimum score if no explicit scoring
      matchReasons: matchReasons.length > 0 ? matchReasons : [relevance.reason],
      matchMethod: relevance.method,
      matchConfidence: relevance.confidence,
      matchedEntities: relevance.matches || {},
      matchedKeywords: displayMatches.length > 0 ? displayMatches : [] // Use meaningful entities
    });
  }

  if (matchingBreakouts.length === 0) {
    return { boost: 0, evidence: [] };
  }

  // Sort by match score and views
  matchingBreakouts.sort((a, b) => (b.matchScore * b.views) - (a.matchScore * a.views));

  // Calculate boost
  let boost = 0;
  const evidence = [];

  // Primary boost from best match
  const bestMatch = matchingBreakouts[0];
  
  // Direct competitor = higher boost
  if (bestMatch.competitorType === 'direct') {
    boost += 15;
  } else {
    boost += 10;
  }

  // High-performing breakout = extra boost
  if (bestMatch.ratio >= 3) {
    boost += 10;  // 3x+ their median = very viral
  } else if (bestMatch.ratio >= 2) {
    boost += 5;   // 2x+ their median = solid breakout
  }

  // Multiple competitors covering = extra validation
  const uniqueCompetitors = new Set(matchingBreakouts.map(b => b.competitorId));
  if (uniqueCompetitors.size >= 2) {
    boost += 5;
  }

  // Cap at 25
  boost = Math.min(boost, 25);

  // Build evidence with detailed information
  for (const match of matchingBreakouts.slice(0, 3)) {  // Top 3
    // Extract video ID from breakout if available
    const videoId = match.youtube_video_id || match.id || null;
    const videoUrl = videoId ? `https://youtube.com/watch?v=${videoId}` : null;
    
    // Build match reason text
    let matchReasonText = '';
    if (match.matchReasons && match.matchReasons.length > 0) {
      const reasons = match.matchReasons.map(r => {
        if (r === 'topic_match') return `topic: ${match.detectedTopic || signalTopic}`;
        return r;
      });
      matchReasonText = reasons.join(', ');
    } else if (match.detectedTopic) {
      matchReasonText = `topic: ${match.detectedTopic}`;
    } else {
      matchReasonText = 'keyword overlap';
    }
    
    // Extract matched entities/keywords from match
    const matchedKeywords = [];
    if (match.matchedEntities) {
      if (match.matchedEntities.people?.length) matchedKeywords.push(...match.matchedEntities.people);
      if (match.matchedEntities.countries?.length) matchedKeywords.push(...match.matchedEntities.countries);
      if (match.matchedEntities.topics?.length) matchedKeywords.push(...match.matchedEntities.topics);
      if (match.matchedEntities.organizations?.length) matchedKeywords.push(...match.matchedEntities.organizations);
    }
    
    // Fallback: extract from matchReasons if no entities
    if (matchedKeywords.length === 0 && match.matchReasons) {
      const keywordReasons = match.matchReasons
        .filter(r => r.startsWith('keywords:') || r.includes(': '))
        .map(r => r.split(': ')[1]?.split(', ') || [])
        .flat();
      matchedKeywords.push(...keywordReasons);
    }
    
    evidence.push({
      type: 'competitor_breakout',
      icon: '🔥',
      // Basic info
      competitorName: match.competitorName,
      competitorType: match.competitorType,
      
      // Verification details
      videoTitle: match.title,
      videoId: videoId,
      videoUrl: videoUrl,
      
      // Match explanation
      matchReason: matchReasonText,
      matchedKeywords: matchedKeywords,
      matchedTopic: match.detectedTopic || signalTopic,
      matchMethod: match.matchMethod || 'entity',
      matchConfidence: match.matchConfidence,
      
      // Stats
      views: match.views,
      ratio: match.ratio,
      format: match.format,
      median: match.median,
      
      // Display text
      text: `${match.competitorName} breakout: ${formatNumber(match.views)} views (${match.ratio}x their median)`,
      
      // Detailed text for expanded view
      detailedText: `"${match.title.substring(0, 60)}${match.title.length > 60 ? '...' : ''}" matched via ${matchReasonText}`
    });
  }

  console.log(`📊 Signal "${signal.title?.substring(0, 40) || 'Unknown'}..." → Competitor boost: +${boost} (${matchingBreakouts.length} matches)`);

  return { boost, evidence };
}

/**
 * Find shared phrases between two titles
 */
function findSharedPhrases(title1, title2) {
  const importantPhrases = [
    'trump', 'ترامب', 'biden', 'بايدن',
    'china', 'الصين', 'russia', 'روسيا', 'iran', 'إيران',
    'oil', 'نفط', 'gold', 'ذهب', 'dollar', 'دولار',
    'war', 'حرب', 'crisis', 'أزمة', 'collapse', 'انهيار',
    'ai', 'الذكاء الاصطناعي', 'bitcoin', 'بيتكوين',
    'tariff', 'رسوم', 'sanctions', 'عقوبات'
  ];

  return importantPhrases.filter(phrase => 
    title1.includes(phrase) && title2.includes(phrase)
  );
}

/**
 * Format number helper
 */
function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return Math.round(num / 1000) + 'K';
  return num.toString();
}

export default {
  getCompetitorBreakouts,
  calculateCompetitorBoost
};

