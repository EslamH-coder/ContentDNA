/**
 * UNIFIED DEMAND SCORING SYSTEM
 * 
 * Combines multiple demand signals to understand what the audience wants RIGHT NOW:
 * 
 * 1. Reddit signals (r/Economics, r/worldnews, r/geopolitics, r/investing)
 *    → Public discussion, what people are talking about
 * 
 * 2. Wikipedia Trends
 *    → What people are searching/curious about
 * 
 * 3. Audience Comments
 *    → Direct demand from YOUR audience (questions, requests)
 * 
 * 4. Competitor Videos
 *    → Proven topics that work, wave detection
 * 
 * FORMULA:
 * POST TODAY = High Supply (fresh news) + High Demand (audience wants it)
 * 
 * File: /lib/scoring/demandScoring.js
 */

import { extractKeywords, normalizeArabicText } from './multiSignalScoring.js';

// ===========================================
// DEMAND SIGNAL WEIGHTS
// ===========================================

const DEMAND_WEIGHTS = {
  // Reddit signals (public discussion)
  reddit_economics: 15,      // r/Economics - highly relevant
  reddit_worldnews: 10,      // r/worldnews - general interest
  reddit_geopolitics: 15,    // r/geopolitics - highly relevant
  reddit_investing: 12,      // r/investing - relevant
  reddit_other: 5,           // Other subreddits
  
  // Wikipedia (search interest)
  wikipedia_trending: 20,    // People actively searching
  
  // Audience comments (direct demand)
  audience_question: 30,     // They asked a question about this
  audience_request: 35,      // They requested this topic
  audience_actionable: 25,   // Actionable comment about topic
  
  // Competitor signals (proven demand)
  competitor_breakout: 25,   // Topic broke out for competitor
  competitor_volume: 15,     // Multiple competitors covering
};

// ===========================================
// MAIN FUNCTIONS
// ===========================================

/**
 * Calculate demand score for a signal by checking if related content exists
 * in Reddit, Wikipedia, audience comments, and competitor videos
 * 
 * @param {Object} signal - The news signal to check
 * @param {Object} context - Contains redditSignals, wikiSignals, audienceComments, competitorVideos
 * @returns {Object} { score, signals, breakdown }
 */
export async function calculateDemandScore(signal, context = {}) {
  const {
    redditSignals = [],
    wikiSignals = [],
    audienceComments = [],
    competitorVideos = [],
    competitorBreakdown = {}
  } = context;

  const demandSignals = [];
  let totalScore = 0;
  const breakdown = {
    reddit: 0,
    wikipedia: 0,
    audienceComments: 0,
    competitors: 0
  };

  // Extract keywords from signal for matching
  const signalTitle = signal.title || '';
  const signalKeywords = extractKeywords(signalTitle);
  const signalKeywordsLower = signalKeywords.map(k => k.toLowerCase());

  // ===========================================
  // 1. CHECK REDDIT SIGNALS
  // ===========================================
  const redditMatches = findMatchingSignals(signal, redditSignals, signalKeywordsLower);
  
  if (redditMatches.length > 0) {
    for (const match of redditMatches) {
      const source = (match.source || '').toLowerCase();
      let weight = DEMAND_WEIGHTS.reddit_other;
      let subreddit = 'reddit';
      
      if (source.includes('economics')) {
        weight = DEMAND_WEIGHTS.reddit_economics;
        subreddit = 'r/Economics';
      } else if (source.includes('worldnews')) {
        weight = DEMAND_WEIGHTS.reddit_worldnews;
        subreddit = 'r/worldnews';
      } else if (source.includes('geopolitics')) {
        weight = DEMAND_WEIGHTS.reddit_geopolitics;
        subreddit = 'r/geopolitics';
      } else if (source.includes('investing')) {
        weight = DEMAND_WEIGHTS.reddit_investing;
        subreddit = 'r/investing';
      }
      
      totalScore += weight;
      breakdown.reddit += weight;
      
      demandSignals.push({
        type: 'reddit_discussion',
        source: subreddit,
        title: match.title,
        weight: weight,
        matchedKeywords: match.matchedKeywords,
        hoursAgo: calculateHoursAgo(match.published_at),
        icon: '💬',
        text: `Discussed on ${subreddit}`
      });
    }
    
    // Bonus for multiple Reddit threads (2+ = trending topic)
    if (redditMatches.length >= 2) {
      const multiBonus = Math.min(15, redditMatches.length * 5);
      totalScore += multiBonus;
      breakdown.reddit += multiBonus;
      demandSignals.push({
        type: 'reddit_trending',
        icon: '🔥',
        text: `Trending: ${redditMatches.length} Reddit threads`,
        weight: multiBonus
      });
    }
  }

  // ===========================================
  // 2. CHECK WIKIPEDIA TRENDS
  // ===========================================
  const wikiMatches = findMatchingSignals(signal, wikiSignals, signalKeywordsLower);
  
  if (wikiMatches.length > 0) {
    totalScore += DEMAND_WEIGHTS.wikipedia_trending;
    breakdown.wikipedia += DEMAND_WEIGHTS.wikipedia_trending;
    
    demandSignals.push({
      type: 'wikipedia_trending',
      icon: '📚',
      text: `Wikipedia trending: ${wikiMatches[0].title?.substring(0, 50)}`,
      weight: DEMAND_WEIGHTS.wikipedia_trending,
      matchedKeywords: wikiMatches[0].matchedKeywords
    });
  }

  // ===========================================
  // 3. CHECK AUDIENCE COMMENTS
  // ===========================================
  const commentMatches = findMatchingComments(signal, audienceComments, signalKeywordsLower);
  
  if (commentMatches.length > 0) {
    for (const comment of commentMatches) {
      let weight = 10; // Base weight
      let type = 'audience_interest';
      let text = 'Audience mentioned this topic';
      
      // Higher weight for questions and requests
      if (comment.question) {
        weight = DEMAND_WEIGHTS.audience_question;
        type = 'audience_question';
        text = `Audience asked: "${comment.question.substring(0, 60)}..."`;
      } else if (comment.request) {
        weight = DEMAND_WEIGHTS.audience_request;
        type = 'audience_request';
        text = `Audience requested: "${comment.request.substring(0, 60)}..."`;
      } else if (comment.is_actionable) {
        weight = DEMAND_WEIGHTS.audience_actionable;
        type = 'audience_actionable';
        text = `Actionable comment about this topic`;
      }
      
      // Boost for popular comments (likes > 5)
      if (comment.likes > 5) {
        weight += Math.min(10, comment.likes);
      }
      
      totalScore += weight;
      breakdown.audienceComments += weight;
      
      demandSignals.push({
        type,
        icon: '🎯',
        text,
        weight,
        commentId: comment.id,
        likes: comment.likes
      });
    }
    
    // Cap audience comment contribution
    if (breakdown.audienceComments > 50) {
      const excess = breakdown.audienceComments - 50;
      totalScore -= excess;
      breakdown.audienceComments = 50;
    }
  }

  // ===========================================
  // 4. COMPETITOR DEMAND (already calculated)
  // ===========================================
  if (competitorBreakdown) {
    if (competitorBreakdown.hasDirectBreakout) {
      totalScore += DEMAND_WEIGHTS.competitor_breakout;
      breakdown.competitors += DEMAND_WEIGHTS.competitor_breakout;
      demandSignals.push({
        type: 'competitor_breakout',
        icon: '🔥',
        text: 'Direct competitor breakout',
        weight: DEMAND_WEIGHTS.competitor_breakout
      });
    }
    
    if (competitorBreakdown.total >= 3) {
      totalScore += DEMAND_WEIGHTS.competitor_volume;
      breakdown.competitors += DEMAND_WEIGHTS.competitor_volume;
      demandSignals.push({
        type: 'competitor_volume',
        icon: '📈',
        text: `${competitorBreakdown.total} competitors covering`,
        weight: DEMAND_WEIGHTS.competitor_volume
      });
    }
  }

  // ===========================================
  // CALCULATE DEMAND LEVEL
  // ===========================================
  let demandLevel = 'low';
  if (totalScore >= 60) {
    demandLevel = 'high';
  } else if (totalScore >= 30) {
    demandLevel = 'medium';
  }

  return {
    score: Math.min(100, totalScore),
    demandLevel,
    signals: demandSignals,
    breakdown,
    hasRedditBuzz: redditMatches.length > 0,
    hasWikipediaTrend: wikiMatches.length > 0,
    hasAudienceDemand: commentMatches.length > 0,
    audienceQuestions: commentMatches.filter(c => c.question).map(c => c.question),
    audienceRequests: commentMatches.filter(c => c.request).map(c => c.request)
  };
}

/**
 * Find signals that match based on keywords
 */
function findMatchingSignals(targetSignal, signals, targetKeywords) {
  const matches = [];
  
  for (const signal of signals) {
    if (signal.id === targetSignal.id) continue; // Skip self
    
    const signalKeywords = extractKeywords(signal.title || '');
    const matchedKeywords = [];
    
    for (const kw of signalKeywords) {
      const kwLower = kw.toLowerCase();
      // Require keyword length >= 3 to avoid false matches
      if (kwLower.length >= 3 && targetKeywords.some(tk => 
        tk === kwLower || 
        (tk.length >= 4 && kwLower.length >= 4 && (tk.includes(kwLower) || kwLower.includes(tk)))
      )) {
        matchedKeywords.push(kw);
      }
    }
    
    // Require at least 2 matching keywords
    if (matchedKeywords.length >= 2) {
      matches.push({
        ...signal,
        matchedKeywords
      });
    }
  }
  
  return matches;
}

/**
 * Find audience comments that match the signal topic
 */
function findMatchingComments(signal, comments, signalKeywords) {
  const matches = [];
  
  for (const comment of comments) {
    // Skip non-actionable general comments
    if (comment.type === 'other' && !comment.is_actionable && !comment.question && !comment.request) {
      continue;
    }
    
    // Check topic match
    const commentTopic = (comment.topic || '').toLowerCase();
    const commentText = (comment.text || '').toLowerCase();
    const commentQuestion = (comment.question || '').toLowerCase();
    const commentRequest = (comment.request || '').toLowerCase();
    
    const allCommentText = `${commentTopic} ${commentText} ${commentQuestion} ${commentRequest}`;
    
    let matchCount = 0;
    for (const kw of signalKeywords) {
      if (kw.length >= 3 && allCommentText.includes(kw)) {
        matchCount++;
      }
    }
    
    // Require at least 1 keyword match for comments (they're shorter)
    if (matchCount >= 1) {
      matches.push(comment);
    }
  }
  
  return matches;
}

/**
 * Helper: Calculate hours ago
 */
function calculateHoursAgo(dateStr) {
  if (!dateStr) return 999;
  const date = new Date(dateStr);
  const now = new Date();
  return (now - date) / (1000 * 60 * 60);
}

// ===========================================
// ENHANCED POST TODAY LOGIC
// ===========================================

/**
 * Determine if signal should be POST TODAY using supply + demand
 * 
 * POST TODAY = Fresh Supply + High Demand
 */
export function shouldPostToday(signal, scoring, demandScore, competitorBreakdown) {
  const hoursAgo = calculateHoursAgo(signal.published_at || signal.publishedAt);
  const supplyScore = scoring?.score || 0;
  const demandLevel = demandScore?.demandLevel || 'low';
  
  // ===========================================
  // CRITERION 1: Wave + Direct Breakout (< 12h)
  // ===========================================
  if (competitorBreakdown?.hasDirectBreakout && hoursAgo < 12) {
    return {
      qualifies: true,
      reason: '🔥 WAVE + BREAKOUT',
      details: `Direct competitor breakout ${hoursAgo.toFixed(1)}h ago`,
      priority: 1,
      format: 'SHORT'
    };
  }
  
  // ===========================================
  // CRITERION 2: High Demand + Fresh (< 12h)
  // ===========================================
  if (demandLevel === 'high' && hoursAgo < 12) {
    return {
      qualifies: true,
      reason: '🎯 HIGH DEMAND',
      details: `Demand score: ${demandScore.score}, ${hoursAgo.toFixed(1)}h old`,
      priority: 2,
      format: demandScore.hasAudienceDemand ? 'LONG' : 'SHORT',
      audienceQuestions: demandScore.audienceQuestions
    };
  }
  
  // ===========================================
  // CRITERION 3: Reddit Trending + Fresh (< 6h)
  // ===========================================
  const redditCount = demandScore?.signals?.filter(s => s.type?.includes('reddit')).length || 0;
  if (redditCount >= 2 && hoursAgo < 6) {
    return {
      qualifies: true,
      reason: '💬 REDDIT TRENDING',
      details: `${redditCount} Reddit threads, ${hoursAgo.toFixed(1)}h old`,
      priority: 3,
      format: 'SHORT'
    };
  }
  
  // ===========================================
  // CRITERION 4: Audience Asked + Fresh (< 24h)
  // ===========================================
  if (demandScore?.hasAudienceDemand && demandScore.audienceQuestions?.length > 0 && hoursAgo < 24) {
    return {
      qualifies: true,
      reason: '❓ AUDIENCE ASKED',
      details: `Audience question: "${demandScore.audienceQuestions[0]?.substring(0, 40)}..."`,
      priority: 4,
      format: 'LONG', // Answer their question properly
      audienceQuestions: demandScore.audienceQuestions
    };
  }
  
  // ===========================================
  // CRITERION 5: Trendsetter Ignition (2+ in 6h)
  // ===========================================
  if ((competitorBreakdown?.trendsetterCount || 0) >= 2 && hoursAgo < 6) {
    return {
      qualifies: true,
      reason: '⚡ TRENDSETTER IGNITION',
      details: `${competitorBreakdown.trendsetterCount} trendsetters posting`,
      priority: 5,
      format: 'SHORT'
    };
  }
  
  // ===========================================
  // CRITERION 6: Market-Moving + Numbers (< 6h)
  // ===========================================
  const marketKeywords = ['oil', 'نفط', 'fed', 'rate', 'فائدة', 'sanctions', 'عقوبات', 'crash', 'انهيار'];
  const hasMarket = marketKeywords.some(kw => (signal.title || '').toLowerCase().includes(kw));
  const hasNumbers = /\d+%|\$\d+|\d+\s*(billion|million|مليار|مليون)/.test(signal.title || '');
  
  if (hasMarket && hasNumbers && hoursAgo < 6) {
    return {
      qualifies: true,
      reason: '📊 MARKET-MOVING',
      details: `Market news with data, ${hoursAgo.toFixed(1)}h old`,
      priority: 6,
      format: 'SHORT'
    };
  }
  
  // Does not qualify
  return { qualifies: false };
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  calculateDemandScore,
  shouldPostToday,
  DEMAND_WEIGHTS
};
