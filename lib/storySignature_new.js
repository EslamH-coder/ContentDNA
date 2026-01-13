/**
 * Story Signature Library - Topic Intelligence Integration
 * Automatically detects and groups signals about the same story
 * 
 * Example: 15 Venezuela signals → grouped into 1 story → keep best 3 angles
 * 
 * NOW USES TOPIC INTELLIGENCE for accurate story grouping
 */

import { generateTopicFingerprint, compareTopics, isSameStory, groupRelatedSignals } from './topicIntelligence';

// ============================================
// TOPIC INTELLIGENCE-BASED FUNCTIONS (NEW)
// ============================================

/**
 * Calculate story signature similarity using Topic Intelligence
 * Replaces keyword-based similarity calculation
 */
export async function calculateSignatureSimilarity(signal1, signal2) {
  const result = await compareTopics(
    { title: signal1.title, description: signal1.description || '', id: signal1.id },
    { title: signal2.title, description: signal2.description || '', id: signal2.id }
  );
  
  return {
    similarity: result.confidence,
    isSameStory: result.relationship === 'same_story',
    relationship: result.relationship,
    entityOverlap: result.entityOverlap,
    semanticSimilarity: result.semanticSimilarity,
    // Legacy compatibility
    score: result.confidence,
    matched: result.relationship === 'same_story' || result.relationship === 'related'
  };
}

/**
 * Generate a story signature for a signal using Topic Intelligence
 * Replaces keyword-based signature extraction
 */
export async function generateStorySignature(signal) {
  const fingerprint = await generateTopicFingerprint({
    title: signal.title,
    description: signal.description || '',
    id: signal.id,
    type: 'signal'
  });
  
  return {
    // New fingerprint-based signature
    fingerprint: fingerprint.fingerprint,
    category: fingerprint.topicCategory,
    entities: fingerprint.entities,
    language: fingerprint.language,
    
    // Legacy compatibility fields
    signature: fingerprint.fingerprint,
    signatureKey: fingerprint.topicCategory, // Use category as key
    topics: fingerprint.entities.topics,
    people: fingerprint.entities.people,
    countries: fingerprint.entities.countries,
    organizations: fingerprint.entities.organizations,
    keywords: [
      ...fingerprint.entities.topics,
      ...fingerprint.entities.countries,
      ...fingerprint.entities.people,
      ...(fingerprint.entities.organizations || [])
    ],
    action: fingerprint.topicCategory.split('_')[0] || 'general',
    numbers: [] // Numbers extracted separately if needed
  };
}

/**
 * Check if two signals are about the same story
 */
export async function areSameStory(signal1, signal2, threshold = 0.7) {
  const result = await isSameStory(signal1, signal2);
  return result.sameStory && result.confidence >= threshold;
}

/**
 * Group signals by story similarity using Topic Intelligence
 */
export async function groupSignalsByStory(signals, threshold = 0.7) {
  if (!signals || signals.length === 0) return [];
  
  // Use Topic Intelligence groupRelatedSignals
  const groups = await groupRelatedSignals(signals);
  
  return groups.map((group, index) => ({
    id: `story_${index}`,
    signals: group,
    count: group.length,
    representativeSignal: group[0]
  }));
}

// ============================================
// LEGACY FUNCTIONS (DEPRECATED)
// ============================================

/**
 * Extract "story signature" from a signal - LEGACY (keyword-based)
 * @deprecated Use generateStorySignature() instead (uses Topic Intelligence)
 */
export function extractStorySignature(signal) {
  console.warn('⚠️ extractStorySignature is deprecated. Use generateStorySignature() instead.');
  // Keep old implementation for backward compatibility
  const title = (signal.title || '').toLowerCase();
  const titleOriginal = signal.title || '';
  
  // Extract entities (countries, companies, people) - simplified
  const entities = [];
  
  // Simple entity extraction (legacy)
  const countryPatterns = ['venezuela', 'us', 'china', 'saudi', 'iran', 'russia'];
  const peoplePatterns = ['trump', 'biden', 'musk', 'putin', 'xi'];
  
  for (const pattern of [...countryPatterns, ...peoplePatterns]) {
    if (title.includes(pattern)) {
      entities.push(pattern);
    }
  }
  
  const signatureKey = entities.join('_') || 'general';
  
  return {
    entities,
    numbers: [],
    action: 'general',
    signatureKey,
    raw: { title: titleOriginal, source: signal.source }
  };
}

/**
 * Calculate similarity between two story signatures - LEGACY (keyword-based)
 * @deprecated Use calculateSignatureSimilarity() instead (uses Topic Intelligence)
 */
export function calculateSimilarity(sig1, sig2) {
  console.warn('⚠️ calculateSimilarity is deprecated. Use calculateSignatureSimilarity() instead.');
  // Keep old implementation for backward compatibility
  const entities1 = new Set(sig1.entities || []);
  const entities2 = new Set(sig2.entities || []);
  const entityOverlap = [...entities1].filter(e => entities2.has(e)).length;
  const entityTotal = new Set([...entities1, ...entities2]).size;
  const entityScore = entityTotal > 0 ? entityOverlap / entityTotal : 0;
  
  if (entityOverlap < 2) {
    return { similarity: 0, entityOverlap, actionMatch: false, numberMatch: false };
  }
  
  const actionScore = (sig1.action === sig2.action) ? 1 : 0;
  const similarity = (entityScore * 0.6) + (actionScore * 0.25);
  
  return {
    similarity,
    entityOverlap,
    actionMatch: sig1.action === sig2.action,
    numberMatch: false
  };
}

/**
 * Group all signals into story clusters - LEGACY (keyword-based)
 * @deprecated Use groupSignalsByStory() instead (uses Topic Intelligence)
 */
export function groupIntoStories(signals, similarityThreshold = 0.55) {
  console.warn('⚠️ groupIntoStories is deprecated. Use groupSignalsByStory() instead.');
  // Keep old implementation for backward compatibility
  if (!signals || signals.length === 0) return [];
  
  const signalsWithSigs = signals.map(signal => ({
    ...signal,
    signature: extractStorySignature(signal)
  }));
  
  const stories = [];
  const assigned = new Set();
  
  signalsWithSigs.sort((a, b) => {
    const scoreA = a.final_score || a.combined_score || a.relevance_score || 0;
    const scoreB = b.final_score || b.combined_score || b.relevance_score || 0;
    return scoreB - scoreA;
  });
  
  for (const signal of signalsWithSigs) {
    const signalKey = signal.id || signal.url || signal.title?.substring(0, 50) || `signal_${Math.random()}`;
    if (assigned.has(signalKey)) continue;
    
    const story = {
      id: `story_${signal.signature.signatureKey || 'unknown'}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      anchor: signal,
      signals: [signal],
      entities: signal.signature.entities,
      action: signal.signature.action,
    };
    
    assigned.add(signalKey);
    
    // Find related signals
    for (const otherSignal of signalsWithSigs) {
      const otherKey = otherSignal.id || otherSignal.url || otherSignal.title?.substring(0, 50) || `signal_${Math.random()}`;
      if (assigned.has(otherKey)) continue;
      
      const sim = calculateSimilarity(signal.signature, otherSignal.signature);
      if (sim.similarity >= similarityThreshold) {
        story.signals.push(otherSignal);
        assigned.add(otherKey);
      }
    }
    
    stories.push(story);
  }
  
  return stories;
}

/**
 * Select best signals from each story - unchanged
 */
export function selectBestFromStories(stories, maxPerStory = 3) {
  const selected = [];
  
  for (const story of stories) {
    // Sort signals by score
    const sorted = [...story.signals].sort((a, b) => {
      const scoreA = a.final_score || a.combined_score || a.relevance_score || 0;
      const scoreB = b.final_score || b.combined_score || b.relevance_score || 0;
      return scoreB - scoreA;
    });
    
    selected.push(...sorted.slice(0, maxPerStory));
  }
  
  return selected;
}
