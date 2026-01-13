import { INTEREST_CLUSTERS, CHANNEL_NAMES, normalizeArabic } from './interestClusters.js';
import { dataStore } from '../data/dataStore.js';
import { generateTopicFingerprint, isRelevantCompetitorVideo } from '../topicIntelligence.js';

// ============================================================
// MAIN SCORING FUNCTION
// ============================================================

export async function scoreTopicEnhanced(topic, dataStoreInstance = null) {
  // Handle both object and string formats
  const title = typeof topic === 'string' ? topic : (topic.title || topic.topic || '');
  const description = topic.description || "";
  const source = topic.source || topic.sourceName || "";
  const url = topic.url || topic.link || topic.sourceUrl || "";
  const pubDate = topic.pubDate || topic.publishedAt || topic.date || "";
  
  const fullText = `${title} ${description}`;
  
  // Use provided dataStore or load default
  const data = dataStoreInstance || (await dataStore.load());
  
  // ============================================
  // LAYER 1: BASE SCORE (30 points)
  // ============================================
  let baseScore = 30;
  
  // Recency bonus
  const ageHours = getAgeInHours(pubDate);
  if (ageHours < 6) baseScore += 10;
  else if (ageHours < 24) baseScore += 5;
  else if (ageHours < 72) baseScore += 2;
  
  // ============================================
  // LAYER 2: INTEREST CLUSTER MATCH (0-40 points)
  // ============================================
  const interestResult = matchInterestClusters(fullText);
  let interestScore = 0;
  
  if (interestResult.hasMatch) {
    // Base interest score
    interestScore = Math.min(interestResult.totalScore, 30);
    
    // Cross-cluster bonus
    if (interestResult.matches.length > 1) {
      interestScore += 5 * (interestResult.matches.length - 1);
    }
    
    // Discovery bonus (matches patterns but not keywords)
    if (interestResult.isDiscovery) {
      interestScore += 10;
    }
  }
  
  interestScore = Math.min(interestScore, 40);
  
  // ============================================
  // LAYER 3: SEARCH EVIDENCE (0-15 points)
  // ============================================
  let searchScore = 0;
  let searchEvidence = { hasEvidence: false, terms: [], totalViews: 0 };
  
  if (data?.searchTerms && data.searchTerms.length > 0) {
    searchEvidence = matchSearchTerms(title, data.searchTerms);
    if (searchEvidence.totalViews > 5000) searchScore = 15;
    else if (searchEvidence.totalViews > 1000) searchScore = 10;
    else if (searchEvidence.totalViews > 500) searchScore = 5;
    else if (searchEvidence.totalViews > 0) searchScore = 2;
  }
  
  // ============================================
  // LAYER 4: COMPETITOR EVIDENCE (0-15 points)
  // ============================================
  let competitorScore = 0;
  let competitorEvidence = { hasEvidence: false, count: 0, channels: [], recent: false };
  
  if (data?.competitorVideos && data.competitorVideos.length > 0) {
    competitorEvidence = matchCompetitors(title, data.competitorVideos);
    if (competitorEvidence.count > 0) {
      competitorScore = Math.min(competitorEvidence.count * 3, 10);
      if (competitorEvidence.recent) competitorScore += 5;
    }
  }
  
  // ============================================
  // CALCULATE TOTAL SCORE
  // ============================================
  const totalScore = Math.min(
    baseScore + interestScore + searchScore + competitorScore,
    100
  );
  
  // ============================================
  // DETERMINE RECOMMENDATION LEVEL
  // ============================================
  let level, emoji;
  if (totalScore >= 75) { level = "HIGHLY_RECOMMENDED"; emoji = "🔥"; }
  else if (totalScore >= 55) { level = "RECOMMENDED"; emoji = "✅"; }
  else if (totalScore >= 40) { level = "CONSIDER"; emoji = "🤔"; }
  else { level = "LOW_PRIORITY"; emoji = "📋"; }
  
  // ============================================
  // BUILD RESULT
  // ============================================
  return {
    title,
    description,
    source,
    url,
    pubDate,
    
    scores: {
      base: baseScore,
      interest: interestScore,
      search: searchScore,
      competitor: competitorScore,
      total: totalScore
    },
    
    recommendation: { level, emoji, score: totalScore },
    
    evidence: {
      interest: {
        hasMatch: interestResult.hasMatch,
        primaryCluster: interestResult.primary,
        secondaryClusters: interestResult.secondary,
        deepInterests: interestResult.deepInterests,
        isDiscovery: interestResult.isDiscovery,
        suggestedAngles: interestResult.suggestedAngles
      },
      search: searchEvidence,
      competitor: competitorEvidence
    },
    
    isDiscovery: interestResult.isDiscovery,
    
    summary: buildSummary(interestResult, searchEvidence, competitorEvidence)
  };
}

// ============================================================
// INTEREST MATCHING
// ============================================================

function matchInterestClusters(text) {
  const normalized = normalizeArabic(text);
  const matches = [];
  
  for (const [id, cluster] of Object.entries(INTEREST_CLUSTERS)) {
    let score = 0;
    const matchedKeywords = [];
    const matchedPatterns = [];
    
    // Check keywords (10 points each)
    for (const keyword of cluster.keywords) {
      if (normalized.includes(normalizeArabic(keyword))) {
        score += 10;
        matchedKeywords.push(keyword);
      }
    }
    
    // Check patterns (5 points each)
    for (const pattern of cluster.patterns) {
      if (normalized.includes(normalizeArabic(pattern))) {
        score += 5;
        matchedPatterns.push(pattern);
      }
    }
    
    // Apply weight
    score = Math.round(score * cluster.weight);
    
    if (score > 0) {
      matches.push({
        id,
        name: cluster.name,
        icon: cluster.icon,
        score,
        matchedKeywords,
        matchedPatterns,
        deepInterests: cluster.deepInterests,
        color: cluster.color
      });
    }
  }
  
  // Sort by score
  matches.sort((a, b) => b.score - a.score);
  
  const primary = matches[0] || null;
  const secondary = matches.slice(1, 3);
  
  // Check if discovery (patterns match but no direct keywords)
  const isDiscovery = primary && 
    primary.matchedPatterns.length > 0 && 
    primary.matchedKeywords.length === 0;
  
  // Generate suggested angles
  const suggestedAngles = [];
  if (primary) {
    suggestedAngles.push(...primary.deepInterests.slice(0, 2).map(interest => ({
      angle: interest,
      cluster: primary.name,
      icon: primary.icon
    })));
  }
  if (secondary.length > 0) {
    suggestedAngles.push({
      angle: secondary[0].deepInterests[0],
      cluster: secondary[0].name,
      icon: secondary[0].icon,
      crossover: true
    });
  }
  
  return {
    hasMatch: matches.length > 0,
    matches,
    primary: primary ? { name: primary.name, icon: primary.icon, score: primary.score, color: primary.color } : null,
    secondary: secondary.map(s => ({ name: s.name, icon: s.icon, color: s.color })),
    deepInterests: primary?.deepInterests || [],
    isDiscovery,
    suggestedAngles,
    totalScore: matches.reduce((sum, m) => sum + m.score, 0)
  };
}

// ============================================================
// SEARCH TERMS MATCHING
// ============================================================

function matchSearchTerms(title, searchTerms) {
  const normalized = normalizeArabic(title);
  const matched = [];
  let totalViews = 0;
  
  for (const term of searchTerms) {
    // Skip channel names
    if (isChannelName(term.term)) continue;
    
    const normalizedTerm = normalizeArabic(term.term);
    if (normalized.includes(normalizedTerm) || 
        normalizedTerm.split(' ').some(w => w.length > 2 && normalized.includes(w))) {
      matched.push({ term: term.term, views: term.views || 0 });
      totalViews += term.views || 0;
    }
  }
  
  return {
    hasEvidence: matched.length > 0,
    terms: matched.slice(0, 5),
    totalViews
  };
}

function isChannelName(term) {
  const normalized = normalizeArabic(term);
  return CHANNEL_NAMES.some(name => normalized.includes(normalizeArabic(name)));
}

// ============================================================
// COMPETITOR MATCHING
// ============================================================

/**
 * Match competitors - LEGACY (keyword-based)
 * @deprecated Use matchCompetitorsWithTopicIntelligence() instead
 */
function matchCompetitors(title, competitorVideos) {
  console.warn('⚠️ matchCompetitors is deprecated. Use matchCompetitorsWithTopicIntelligence() instead.');
  
  const normalized = normalizeArabic(title);
  const keywords = normalized.split(' ').filter(w => w.length > 2);
  
  const matched = [];
  const channels = new Set();
  let recent = false;
  
  for (const video of competitorVideos) {
    const videoNorm = normalizeArabic(video.title || '');
    if (keywords.some(kw => videoNorm.includes(kw))) {
      matched.push(video);
      channels.add(video.channelName || video.creator || video.channel || '');
      
      const ageHours = getAgeInHours(video.uploadDate || video.pubDate || video.publishedAt || video.date);
      if (ageHours < 168) recent = true; // Last 7 days
    }
  }
  
  return {
    hasEvidence: matched.length > 0,
    count: matched.length,
    channels: Array.from(channels).slice(0, 3),
    recent
  };
}

/**
 * Match competitors using Topic Intelligence
 * Uses semantic matching for accurate competitor detection
 */
export async function matchCompetitorsWithTopicIntelligence(signal, competitorVideos, options = {}) {
  const { limit = 30, minConfidence = 0.7 } = options;
  
  const matched = [];
  const channels = new Set();
  let recent = false;
  
  // Generate fingerprint once
  const signalFingerprint = await generateTopicFingerprint({
    title: typeof signal === 'string' ? signal : (signal.title || signal.topic || ''),
    description: typeof signal === 'string' ? '' : (signal.description || ''),
    id: typeof signal === 'string' ? undefined : signal.id,
    type: 'signal',
    skipEmbedding: true // Skip embedding for speed
  });
  
  // Check against competitors
  for (const video of competitorVideos.slice(0, limit)) {
    const videoMatch = await isRelevantCompetitorVideo(
      { title: typeof signal === 'string' ? signal : signal.title, fingerprint: signalFingerprint },
      { title: video.title }
    );
    
    if (videoMatch.relevant && videoMatch.confidence >= minConfidence) {
      matched.push({
        ...video,
        confidence: videoMatch.confidence,
        matchReason: videoMatch.reason
      });
      channels.add(video.channelName || video.creator || video.channel || '');
      
      const ageHours = getAgeInHours(video.uploadDate || video.pubDate || video.publishedAt || video.date);
      if (ageHours < 168) recent = true; // Last 7 days
    }
  }
  
  return {
    hasEvidence: matched.length > 0,
    count: matched.length,
    videos: matched,
    channels: Array.from(channels).slice(0, 3),
    recent
  };
}

// ============================================================
// UTILITIES
// ============================================================

function getAgeInHours(dateStr) {
  if (!dateStr) return 999;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 999;
    return (Date.now() - date.getTime()) / (1000 * 60 * 60);
  } catch {
    return 999;
  }
}

function buildSummary(interest, search, competitor) {
  const parts = [];
  
  if (interest.primary) {
    parts.push(`${interest.primary.icon} ${interest.primary.name}`);
  }
  
  if (search.hasEvidence) {
    parts.push(`🔍 ${search.totalViews.toLocaleString()} بحث`);
  }
  
  if (competitor.hasEvidence) {
    const recentTag = competitor.recent ? " (حديث!)" : "";
    parts.push(`📺 ${competitor.count} منافس${recentTag}`);
  }
  
  if (interest.isDiscovery) {
    parts.push(`💡 اكتشاف`);
  }
  
  return parts.length > 0 ? parts.join(' | ') : 'موضوع إخباري';
}

// ============================================================
// BATCH SCORING
// ============================================================

export async function scoreRSSFeed(items, dataStoreInstance = null) {
  // Load data store if not provided
  const data = dataStoreInstance || (await dataStore.load());
  
  const scored = await Promise.all(
    items.map(item => scoreTopicEnhanced(item, data))
  );
  
  // Sort by total score
  scored.sort((a, b) => b.scores.total - a.scores.total);
  
  return {
    items: scored,
    summary: {
      total: scored.length,
      highlyRecommended: scored.filter(i => i.recommendation.level === 'HIGHLY_RECOMMENDED').length,
      recommended: scored.filter(i => i.recommendation.level === 'RECOMMENDED').length,
      consider: scored.filter(i => i.recommendation.level === 'CONSIDER').length,
      lowPriority: scored.filter(i => i.recommendation.level === 'LOW_PRIORITY').length,
      discoveries: scored.filter(i => i.isDiscovery).length
    }
  };
}




