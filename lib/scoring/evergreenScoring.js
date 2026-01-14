/**
 * Unified Evergreen Scoring
 * Scores Reddit and Wikipedia signals using DNA matching (same methodology as RSS)
 * 
 * This ensures fairness: all sources use the same scoring system
 */

import { loadTopics } from '@/lib/taxonomy/unifiedTaxonomyService';
import { extractKeywords } from './multiSignalScoring';

/**
 * Score evergreen signals (Reddit, Wikipedia) using DNA matching
 * Same methodology as RSS scoring for fairness
 */
export async function scoreEvergreenSignal(signal, showId, dnaTopics = null) {
  // Load DNA topics if not provided
  if (!dnaTopics) {
    dnaTopics = await loadTopics(showId);
  }
  
  const title = signal.title || '';
  const description = signal.description || signal.content || '';
  const fullText = `${title} ${description}`.toLowerCase();
  
  // 1. DNA MATCHING (most important - 40% weight)
  const dnaMatch = matchAgainstDNA(fullText, dnaTopics);
  const dnaScore = calculateDnaScore(dnaMatch);
  
  // 2. SOURCE QUALITY (25% weight)
  const qualityScore = getEvergreenSourceQuality(signal.source, signal.source_type, signal.subreddit);
  
  // 3. ENGAGEMENT (20% weight) - Reddit: upvotes, Wikipedia: views/trending
  const engagementScore = calculateEngagementScore(signal);
  
  // 4. FRESHNESS (15% weight)
  const freshnessScore = calculateFreshnessScore(signal.created_at || signal.createdAt);
  
  // 5. COMBINE SCORES
  const combinedScore = Math.round(
    (dnaScore * 0.40) +        // 40% DNA match (most important)
    (qualityScore * 0.25) +    // 25% source quality
    (engagementScore * 0.20) + // 20% engagement
    (freshnessScore * 0.15)    // 15% freshness
  );
  
  // 6. BONUSES
  let finalScore = combinedScore;
  
  // Multiple DNA topic match bonus
  if (dnaMatch.matchedTopics.length >= 2) {
    finalScore += 10;
  }
  
  // Viral content bonus (Reddit)
  if (signal.upvotes && signal.upvotes > 1000) {
    finalScore += 5;
  }
  
  // High engagement bonus (Reddit)
  if (signal.comments && signal.comments > 200) {
    finalScore += 5;
  }
  
  // Trending bonus (Wikipedia)
  if (signal.trending_score && signal.trending_score > 0.8) {
    finalScore += 5;
  }
  
  // Question format bonus (Reddit)
  if (signal.isQuestion) {
    finalScore += 5;
  }
  
  // Cap at 100
  finalScore = Math.min(100, Math.max(0, finalScore));
  
  // 7. STORE BREAKDOWN
  signal.score = finalScore;
  signal.dna_score = dnaScore;
  signal.quality_score = qualityScore;
  signal.engagement_score = engagementScore;
  signal.freshness_score = freshnessScore;
  signal.combined_score = combinedScore;
  signal.dna_reasons = dnaMatch.reasons;
  signal.matched_topics = dnaMatch.matchedTopics;
  signal.matched_topic_names = dnaMatch.matchedTopicNames;
  
  return signal;
}

/**
 * Match signal against DNA topics using proper keyword extraction and matching
 * Uses the same approach as RSS scoring
 */
function matchAgainstDNA(text, dnaTopics) {
  const matchedTopics = [];
  const matchedTopicNames = [];
  const reasons = [];
  
  // Extract keywords from signal text (same as RSS)
  const signalKeywords = extractKeywords(text);
  
  if (!dnaTopics || dnaTopics.length === 0) {
    return { matchedTopics, matchedTopicNames, reasons };
  }
  
  for (const topic of dnaTopics) {
    if (!topic) continue;
    
    const topicId = topic.topic_id || topic.topicId || topic.id;
    const topicName = topic.topic_name_en || topic.topic_name || topic.name || topicId;
    
    // Get all keywords for this topic (merged from keywords + learned_keywords)
    const topicKeywords = topic.allKeywords || 
                         (Array.isArray(topic.keywords) ? topic.keywords : []) ||
                         (Array.isArray(topic.learned_keywords) ? topic.learned_keywords : []);
    
    if (!topicId || !topicKeywords || topicKeywords.length === 0) continue;
    
    // Check for keyword matches (case-insensitive, normalized)
    let matched = false;
    let matchedKeyword = null;
    
    for (const keyword of topicKeywords) {
      if (!keyword || typeof keyword !== 'string') continue;
      
      const normalizedKeyword = keyword.toLowerCase().trim();
      
      // Check if any signal keyword matches this DNA keyword
      for (const signalKw of signalKeywords) {
        const normalizedSignalKw = signalKw.toLowerCase().trim();
        
        // Exact match or substring match
        if (normalizedSignalKw === normalizedKeyword || 
            normalizedSignalKw.includes(normalizedKeyword) || 
            normalizedKeyword.includes(normalizedSignalKw)) {
          matched = true;
          matchedKeyword = keyword;
          break;
        }
      }
      
      if (matched) break;
    }
    
    // Also check if topic name itself matches
    if (!matched && topicName) {
      const normalizedTopicName = topicName.toLowerCase().trim();
      for (const signalKw of signalKeywords) {
        const normalizedSignalKw = signalKw.toLowerCase().trim();
        if (normalizedSignalKw.includes(normalizedTopicName) || 
            normalizedTopicName.includes(normalizedSignalKw)) {
          matched = true;
          matchedKeyword = topicName;
          break;
        }
      }
    }
    
    if (matched) {
      matchedTopics.push(topicId);
      matchedTopicNames.push(topicName);
      reasons.push(`DNA match: ${topicName} (keyword: ${matchedKeyword})`);
    }
  }
  
  return { matchedTopics, matchedTopicNames, reasons };
}

/**
 * Calculate DNA score based on matches
 */
function calculateDnaScore(dnaMatch) {
  const matchCount = dnaMatch.matchedTopics.length;
  
  if (matchCount === 0) return 20;      // No match - low base score
  if (matchCount === 1) return 50;      // Single topic match
  if (matchCount === 2) return 70;      // Two topic matches
  if (matchCount >= 3) return 90;       // Multiple matches - high relevance
  
  return 20;
}

/**
 * Get source quality rating
 */
function getEvergreenSourceQuality(source, sourceType, subreddit = null) {
  // Reddit subreddit quality
  const redditQuality = {
    'r/Economics': 85,
    'r/geopolitics': 85,
    'r/investing': 80,
    'r/finance': 80,
    'r/worldnews': 70,
    'r/technology': 75,
    'r/business': 70,
    'r/stocks': 65,
    'r/economy': 75,
    'r/markets': 70,
    'default_reddit': 50
  };
  
  // Wikipedia - generally high quality
  const wikipediaQuality = 75;
  
  // Check subreddit first (most specific)
  if (subreddit) {
    const subredditKey = `r/${subreddit}`;
    if (redditQuality[subredditKey]) {
      return redditQuality[subredditKey];
    }
  }
  
  // Check source string
  if (sourceType === 'reddit' || (source && source.startsWith('r/'))) {
    const sourceKey = source || `r/${subreddit}`;
    return redditQuality[sourceKey] || redditQuality['default_reddit'];
  }
  
  if (sourceType === 'wikipedia' || (source && source.includes('Wikipedia'))) {
    return wikipediaQuality;
  }
  
  return 50; // Default
}

/**
 * Calculate engagement score
 */
function calculateEngagementScore(signal) {
  // Reddit: upvotes + comments
  if (signal.upvotes !== undefined || signal.score !== undefined) {
    const upvotes = signal.upvotes || signal.score || 0;
    const comments = signal.comments || signal.num_comments || 0;
    
    // Logarithmic scale, capped at 40
    const upvoteScore = Math.min(30, Math.log10(upvotes + 1) * 10);
    const commentScore = Math.min(10, Math.log10(comments + 1) * 5);
    
    return Math.round(upvoteScore + commentScore);
  }
  
  // Wikipedia: trending score or view count
  if (signal.trending_score !== undefined) {
    return Math.round(signal.trending_score * 40);
  }
  
  if (signal.views !== undefined || signal.wikipedia_views !== undefined) {
    const views = signal.views || signal.wikipedia_views || 0;
    return Math.min(40, Math.round(Math.log10(views + 1) * 10));
  }
  
  // Wikipedia rank-based (higher rank = more views)
  if (signal.rank !== undefined) {
    if (signal.rank <= 10) return 40;
    if (signal.rank <= 25) return 30;
    if (signal.rank <= 50) return 20;
    return 15;
  }
  
  return 20; // Default medium engagement
}

/**
 * Calculate freshness score
 */
function calculateFreshnessScore(createdAt) {
  if (!createdAt) return 30;
  
  const now = new Date();
  const created = new Date(createdAt);
  const hoursAgo = (now - created) / (1000 * 60 * 60);
  
  if (hoursAgo < 6) return 50;       // Very fresh
  if (hoursAgo < 24) return 40;      // Fresh
  if (hoursAgo < 48) return 30;      // Recent
  if (hoursAgo < 168) return 20;     // This week
  return 10;                          // Older
}

/**
 * Batch score multiple evergreen signals
 */
export async function scoreEvergreenSignals(signals, showId) {
  if (!signals || signals.length === 0) {
    return [];
  }
  
  const dnaTopics = await loadTopics(showId);
  
  console.log(`📊 Scoring ${signals.length} evergreen signals against ${dnaTopics.length} DNA topics...`);
  
  const scoredSignals = [];
  for (const signal of signals) {
    const scored = await scoreEvergreenSignal(signal, showId, dnaTopics);
    scoredSignals.push(scored);
  }
  
  // Log summary
  const avgScore = scoredSignals.reduce((sum, s) => sum + (s.score || 0), 0) / scoredSignals.length;
  const dnaMatched = scoredSignals.filter(s => s.matched_topics?.length > 0).length;
  const avgDnaScore = scoredSignals.reduce((sum, s) => sum + (s.dna_score || 0), 0) / scoredSignals.length;
  
  console.log(`✅ Evergreen scoring complete:`);
  console.log(`   - Average score: ${avgScore.toFixed(1)}`);
  console.log(`   - Average DNA score: ${avgDnaScore.toFixed(1)}`);
  console.log(`   - DNA matched: ${dnaMatched}/${signals.length} (${((dnaMatched / signals.length) * 100).toFixed(1)}%)`);
  
  return scoredSignals;
}
