/**
 * Competitor Video Embeddings
 * Generates and compares embeddings for semantic similarity matching
 */

import { getEmbedding, cosineSimilarity } from '@/lib/topicIntelligence.js';

// Thresholds for competitor matching
export const SIMILARITY_THRESHOLDS = {
  SAME_STORY: 0.80,      // High confidence - same story
  RELATED: 0.65,         // Medium - related topic, might be same story
  BORDERLINE: 0.60,      // Low - needs strong keyword evidence
  REJECT: 0.60,          // Below this = definitely not same story (raised from 0.50)
};

// Cache for signal embeddings (avoid regenerating during same request)
const signalEmbeddingCache = new Map();

/**
 * Get embedding for a signal (with caching)
 */
export async function getSignalEmbedding(signalTitle) {
  if (!signalTitle) return null;
  
  const cacheKey = signalTitle.substring(0, 100).toLowerCase();
  if (signalEmbeddingCache.has(cacheKey)) {
    return signalEmbeddingCache.get(cacheKey);
  }
  
  try {
    const embedding = await getEmbedding(signalTitle);
    if (embedding) {
      signalEmbeddingCache.set(cacheKey, embedding);
      // Limit cache size
      if (signalEmbeddingCache.size > 100) {
        const firstKey = signalEmbeddingCache.keys().next().value;
        signalEmbeddingCache.delete(firstKey);
      }
    }
    return embedding;
  } catch (err) {
    console.warn(`⚠️ Failed to get signal embedding:`, err.message);
    return null;
  }
}

/**
 * Calculate semantic similarity between signal and video
 */
export async function calculateSemanticSimilarity(signalTitle, videoTitle, videoEmbedding = null) {
  try {
    // Get signal embedding
    const signalEmb = await getSignalEmbedding(signalTitle);
    if (!signalEmb) return null;
    
    // Get video embedding (use cached if available)
    let videoEmb = videoEmbedding;
    if (!videoEmb) {
      videoEmb = await getEmbedding(videoTitle);
    }
    if (!videoEmb) return null;
    
    // Calculate cosine similarity
    const similarity = cosineSimilarity(signalEmb, videoEmb);
    return similarity;
  } catch (err) {
    console.warn(`⚠️ Semantic similarity failed:`, err.message);
    return null;
  }
}

/**
 * Classify similarity score
 */
export function classifySimilarity(score) {
  if (score === null || score === undefined) {
    return { level: 'unknown', needsAI: false };
  }
  
  if (score >= SIMILARITY_THRESHOLDS.SAME_STORY) {
    return { level: 'same_story', needsAI: false };
  } else if (score >= SIMILARITY_THRESHOLDS.RELATED) {
    return { level: 'related', needsAI: true };
  } else if (score >= SIMILARITY_THRESHOLDS.BORDERLINE) {
    return { level: 'borderline', needsAI: true };
  } else {
    return { level: 'different', needsAI: false };
  }
}

/**
 * Batch process videos for semantic similarity
 * Returns videos sorted by similarity with classification
 */
export async function rankVideosBySimilarity(signalTitle, videos, limit = 10) {
  const signalEmb = await getSignalEmbedding(signalTitle);
  if (!signalEmb) {
    console.warn(`⚠️ Could not get signal embedding, skipping semantic ranking`);
    return videos.map(v => ({ ...v, similarity: null, similarityClass: 'unknown' }));
  }
  
  const results = [];
  
  for (const video of videos) {
    let similarity = null;
    
    // Try to use cached embedding from video
    if (video.title_embedding) {
      const videoEmb = typeof video.title_embedding === 'string' 
        ? JSON.parse(video.title_embedding) 
        : video.title_embedding;
      similarity = cosineSimilarity(signalEmb, videoEmb);
    } else {
      // Generate on the fly (slower)
      const videoEmb = await getEmbedding(video.title || '');
      if (videoEmb) {
        similarity = cosineSimilarity(signalEmb, videoEmb);
      }
    }
    
    const classification = classifySimilarity(similarity);
    
    results.push({
      ...video,
      similarity,
      similarityClass: classification.level,
      needsAIValidation: classification.needsAI,
    });
  }
  
  // Sort by similarity (highest first), nulls last
  results.sort((a, b) => {
    if (a.similarity === null && b.similarity === null) return 0;
    if (a.similarity === null) return 1;
    if (b.similarity === null) return -1;
    return b.similarity - a.similarity;
  });
  
  return results.slice(0, limit);
}

export default {
  getSignalEmbedding,
  calculateSemanticSimilarity,
  classifySimilarity,
  rankVideosBySimilarity,
  SIMILARITY_THRESHOLDS,
};