/**
 * Unified Topic Detection System
 * Single source of truth for topic assignment across all content
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Cache DNA topics per show (refresh every hour)
let topicCache = {};
let cacheTimestamp = {};
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Get DNA topics for a show (with caching)
 */
export async function getDNATopics(showId) {
  const now = Date.now();
  
  if (topicCache[showId] && (now - cacheTimestamp[showId]) < CACHE_DURATION) {
    return topicCache[showId];
  }

  const { data: topics, error } = await supabase
    .from('topic_definitions')
    .select('topic_id, keywords')
    .eq('show_id', showId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching DNA topics:', error);
    return [];
  }

  topicCache[showId] = topics || [];
  cacheTimestamp[showId] = now;
  
  console.log(`📚 Loaded ${topics?.length || 0} DNA topics for show`);
  return topicCache[showId];
}

/**
 * Detect topic for any content using DNA keywords
 * 
 * @param {string} title - Content title
 * @param {string} description - Content description (optional)
 * @param {string} showId - Show ID to get DNA topics
 * @returns {object} { topicId, confidence, matchedKeywords }
 */
export async function detectTopic(title, description = '', showId) {
  if (!title || !showId) {
    return { topicId: 'other_stories', confidence: 0, matchedKeywords: [] };
  }

  const topics = await getDNATopics(showId);
  
  if (!topics || topics.length === 0) {
    return { topicId: 'other_stories', confidence: 0, matchedKeywords: [] };
  }

  // Use synchronous detection with loaded topics
  return detectTopicSync(title, description, topics);
}

/**
 * Detect topics for multiple items (batch processing)
 */
export async function detectTopicsBatch(items, showId) {
  const topics = await getDNATopics(showId);
  
  return items.map(item => {
    const result = detectTopicSync(item.title, item.description || '', topics);
    return {
      ...item,
      detected_topic: result.topicId,
      topic_confidence: result.confidence,
      topic_keywords: result.matchedKeywords
    };
  });
}

/**
 * Synchronous topic detection (when topics already loaded)
 * Uses word boundary matching to prevent false positives from substrings
 */
export function detectTopicSync(title, description, topics) {
    if (!title || !topics || topics.length === 0) {
      return { topicId: 'other_stories', confidence: 0, matchedKeywords: [] };
    }
  
    const text = `${title} ${description || ''}`.toLowerCase();
    const titleLower = title.toLowerCase();
    
    let bestMatch = {
      topicId: 'other_stories',
      confidence: 0,
      matchedKeywords: []
    };
  
    for (const topic of topics) {
      if (!topic.keywords || !Array.isArray(topic.keywords) || topic.keywords.length === 0) {
        continue;
      }
  
      const matchedKeywords = [];
      let matchScore = 0;
  
      for (const keyword of topic.keywords) {
        if (!keyword || keyword.length < 2) continue;
        
        const keywordLower = keyword.toLowerCase();
        
        // Use word boundary regex to prevent substring matches
        // e.g., "ICE" should not match "price", "ai" should not match "ertain"
        const escapedKeyword = keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundaryRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
        
        if (wordBoundaryRegex.test(text)) {
          matchedKeywords.push(keyword);
          
          // Weight by keyword length (longer = more specific = higher score)
          matchScore += Math.min(keyword.length, 10);
          
          // Bonus for title match (more important than description)
          if (wordBoundaryRegex.test(titleLower)) {
            matchScore += 5;
          }
        }
      }
  
      // Calculate confidence (0-100)
      const confidence = Math.min(matchScore * 10, 100);
  
      if (matchScore > bestMatch.confidence && matchedKeywords.length >= 1) {
        bestMatch = {
          topicId: topic.topic_id,
          confidence,
          matchedKeywords
        };
      }
    }
  
    return bestMatch;
  }

/**
 * Clear cache (call when DNA topics are updated)
 */
export function clearTopicCache(showId = null) {
  if (showId) {
    delete topicCache[showId];
    delete cacheTimestamp[showId];
    console.log(`🗑️ Cleared topic cache for show: ${showId}`);
  } else {
    topicCache = {};
    cacheTimestamp = {};
    console.log('🗑️ Cleared all topic caches');
  }
}

export default {
  getDNATopics,
  detectTopic,
  detectTopicsBatch,
  detectTopicSync,
  clearTopicCache
};


