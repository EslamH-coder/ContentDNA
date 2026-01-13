/**
 * SMART DEDUPLICATION
 * Prevents duplicate topics from being recommended
 * NOW USES TOPIC INTELLIGENCE for accurate semantic matching
 */

import { dataStore } from '../data/dataStore.js';
import { isSameStory, generateTopicFingerprint, compareTopics } from '../topicIntelligence.js';

/**
 * Check if a topic/signal is a duplicate - LEGACY (text-based)
 * @deprecated Use isDuplicateSignal() instead (uses Topic Intelligence)
 */
export function isDuplicate(topic, existingTopics = []) {
  console.warn('⚠️ isDuplicate is deprecated. Use isDuplicateSignal() for signal objects or isDuplicateTopic() for topics.');
  
  const normalized = normalizeForComparison(topic);
  
  // Check against existing topics in this batch
  for (const existing of existingTopics) {
    const existingNorm = normalizeForComparison(existing);
    
    // Exact match
    if (normalized === existingNorm) return true;
    
    // High similarity (> 70%)
    if (calculateSimilarity(normalized, existingNorm) > 0.7) return true;
  }
  
  // Check against global processed set
  if (dataStore.isDuplicate(topic)) return true;
  
  return false;
}

/**
 * Check if a signal is a duplicate of existing signals using Topic Intelligence
 * Uses semantic matching for accurate duplicate detection
 */
export async function isDuplicateSignal(newSignal, existingSignals = [], options = {}) {
  const {
    threshold = 0.85,  // High threshold for duplicates
    checkTitle = true,
    checkContent = true
  } = options;
  
  if (!existingSignals || existingSignals.length === 0) {
    return { isDuplicate: false };
  }
  
  // Generate fingerprint for new signal
  const newFingerprint = await generateTopicFingerprint({
    title: typeof newSignal === 'string' ? newSignal : (newSignal.title || newSignal.topic || ''),
    description: typeof newSignal === 'string' ? '' : (newSignal.description || ''),
    id: typeof newSignal === 'string' ? undefined : newSignal.id,
    type: 'signal',
    skipEmbedding: true // Skip embedding for speed
  });
  
  // Check against existing signals
  for (const existing of existingSignals) {
    const existingTitle = typeof existing === 'string' ? existing : (existing.title || existing.topic || '');
    const existingDesc = typeof existing === 'string' ? '' : (existing.description || '');
    
    const result = await compareTopics(
      { title: typeof newSignal === 'string' ? newSignal : newSignal.title, fingerprint: newFingerprint },
      { title: existingTitle, description: existingDesc },
      { requireSameStory: true }
    );
    
    // High semantic similarity = likely duplicate
    if (result.semanticSimilarity && result.semanticSimilarity >= threshold) {
      return {
        isDuplicate: true,
        duplicateOf: existing,
        confidence: result.semanticSimilarity,
        reason: `${Math.round(result.semanticSimilarity * 100)}% semantically similar to existing signal`
      };
    }
    
    // Same story with high confidence = duplicate
    if (result.relationship === 'same_story' && result.confidence >= threshold) {
      return {
        isDuplicate: true,
        duplicateOf: existing,
        confidence: result.confidence,
        reason: `Same story: ${result.reason || 'high confidence match'}`
      };
    }
  }
  
  return { isDuplicate: false };
}

/**
 * Check if a topic string is a duplicate using Topic Intelligence
 * Convenience function for string topics
 */
export async function isDuplicateTopic(newTopic, existingTopics = [], threshold = 0.85) {
  if (!existingTopics || existingTopics.length === 0) {
    return { isDuplicate: false };
  }
  
  const newSignal = { title: newTopic };
  const existingSignals = existingTopics.map(t => ({ title: typeof t === 'string' ? t : (t.title || t.topic || '') }));
  
  return await isDuplicateSignal(newSignal, existingSignals, { threshold });
}

/**
 * Deduplicate items - LEGACY (text-based)
 * @deprecated Use deduplicateSignals() for semantic deduplication
 */
export function deduplicateItems(items, keyField = 'title') {
  console.warn('⚠️ deduplicateItems is deprecated. Use deduplicateSignals() for semantic deduplication.');
  
  const seen = new Map();
  const unique = [];
  
  for (const item of items) {
    const key = item[keyField] || item.topic || '';
    const normalized = normalizeForComparison(key);
    
    // Also check URL for exact duplicates
    const urlKey = item.url || item.link || '';
    
    if (seen.has(normalized) || (urlKey && seen.has(urlKey))) {
      continue; // Skip duplicate
    }
    
    seen.set(normalized, true);
    if (urlKey) seen.set(urlKey, true);
    unique.push(item);
  }
  
  return unique;
}

/**
 * Deduplicate a batch of signals using Topic Intelligence
 * Returns unique signals only
 */
export async function deduplicateSignals(signals, options = {}) {
  const {
    threshold = 0.85,
    keepFirst = true  // Keep first occurrence, remove later ones
  } = options;
  
  if (!signals || signals.length === 0) return { unique: [], duplicates: [], stats: { total: 0, unique: 0, duplicates: 0 } };
  
  console.log(`🔍 Deduplicating ${signals.length} signals using Topic Intelligence...`);
  
  const unique = [];
  const duplicates = [];
  
  for (const signal of signals) {
    const dupCheck = await isDuplicateSignal(signal, unique, { threshold });
    
    if (dupCheck.isDuplicate) {
      duplicates.push({
        signal,
        duplicateOf: dupCheck.duplicateOf,
        confidence: dupCheck.confidence,
        reason: dupCheck.reason
      });
    } else {
      unique.push(signal);
    }
  }
  
  console.log(`🔍 Deduplication: ${unique.length} unique, ${duplicates.length} duplicates removed`);
  
  return {
    unique,
    duplicates,
    stats: {
      total: signals.length,
      unique: unique.length,
      duplicates: duplicates.length
    }
  };
}

/**
 * Find all duplicates of a specific signal
 */
export async function findDuplicates(signal, candidates, threshold = 0.80) {
  const duplicates = [];
  
  const signalFingerprint = await generateTopicFingerprint({
    title: typeof signal === 'string' ? signal : (signal.title || signal.topic || ''),
    description: typeof signal === 'string' ? '' : (signal.description || ''),
    id: typeof signal === 'string' ? undefined : signal.id,
    type: 'signal',
    skipEmbedding: true
  });
  
  for (const candidate of candidates) {
    const candidateId = typeof candidate === 'string' ? candidate : candidate.id;
    const signalId = typeof signal === 'string' ? undefined : signal.id;
    
    if (candidateId === signalId) continue;
    
    const candidateTitle = typeof candidate === 'string' ? candidate : (candidate.title || candidate.topic || '');
    const candidateDesc = typeof candidate === 'string' ? '' : (candidate.description || '');
    
    const result = await compareTopics(
      { title: typeof signal === 'string' ? signal : signal.title, fingerprint: signalFingerprint },
      { title: candidateTitle, description: candidateDesc },
      { requireSameStory: true }
    );
    
    if (result.relationship === 'same_story' && result.confidence >= threshold) {
      duplicates.push({
        signal: candidate,
        similarity: result.confidence,
        semanticSimilarity: result.semanticSimilarity,
        entityOverlap: result.entityOverlap
      });
    }
  }
  
  return duplicates.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
}

/**
 * Merge duplicate signals into one (combine sources, keep best metadata)
 */
export function mergeDuplicates(signals) {
  if (signals.length === 0) return null;
  if (signals.length === 1) return signals[0];
  
  // Sort by score/quality to pick best as base
  const sorted = [...signals].sort((a, b) => (b.score || 0) - (a.score || 0));
  const base = { ...sorted[0] };
  
  // Merge sources
  const allSources = new Set();
  for (const signal of signals) {
    if (signal.source) allSources.add(signal.source);
    if (signal.sources) signal.sources.forEach(s => allSources.add(s));
  }
  base.sources = Array.from(allSources);
  base.sourceCount = base.sources.length;
  
  // Keep earliest published date
  const dates = signals.map(s => s.publishedAt || s.published_at).filter(Boolean);
  if (dates.length > 0) {
    base.publishedAt = dates.sort()[0];
  }
  
  // Note that this is merged
  base.mergedFrom = signals.length;
  base.isMerged = true;
  
  return base;
}

function normalizeForComparison(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const words1 = new Set(str1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(str2.split(' ').filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = [...words1].filter(w => words2.has(w));
  const union = new Set([...words1, ...words2]);
  
  return intersection.length / union.size;
}




