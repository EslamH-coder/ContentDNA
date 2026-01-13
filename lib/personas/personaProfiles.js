/**
 * PERSONA PROFILES UTILITY
 * Merges basic persona definitions with deep profiles
 */

import { PERSONAS } from './personaDefinitions.js';
import { PERSONA_DEEP_PROFILES, CONTENT_PRIORITIES, GOLDEN_RULE } from './personaDeepProfiles.js';

// ============================================
// GET ENRICHED PERSONA
// ============================================
export function getEnrichedPersona(personaId) {
  const basic = PERSONAS[personaId];
  const deep = PERSONA_DEEP_PROFILES[personaId];
  
  if (!basic) return null;
  
  return {
    ...basic,
    deepProfile: deep || null,
    // Merge demographics if available
    demographics: deep?.demographics || basic.demographics,
    // Add pain points and demands
    painPoints: deep?.painPoints || [],
    demands: deep?.demands || [],
    contentGaps: deep?.contentGaps || [],
    priorityTopics: deep?.priorityTopics || [],
    contentStyle: deep?.contentStyle || {},
    weeklyTarget: deep?.weeklyTarget || 1
  };
}

// ============================================
// GET ALL ENRICHED PERSONAS
// ============================================
export function getAllEnrichedPersonas() {
  return Object.keys(PERSONAS).map(id => getEnrichedPersona(id));
}

// ============================================
// GET PRIORITY TOPICS FOR PERSONA
// ============================================
export function getPriorityTopicsForPersona(personaId) {
  const deep = PERSONA_DEEP_PROFILES[personaId];
  if (!deep || !deep.priorityTopics) return [];
  
  return deep.priorityTopics
    .sort((a, b) => {
      const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });
}

// ============================================
// GET CONTENT SUGGESTIONS FOR PERSONA
// ============================================
export function getContentSuggestionsForPersona(personaId) {
  const deep = PERSONA_DEEP_PROFILES[personaId];
  if (!deep) return [];
  
  const suggestions = [];
  
  // Add priority topics
  if (deep.priorityTopics) {
    deep.priorityTopics.forEach(topic => {
      suggestions.push({
        topic: topic.topic,
        priority: topic.priority,
        evidence: topic.searchViews ? `${topic.searchViews} بحث` : 'طلب من الجمهور',
        format: deep.contentStyle?.format || 'medium',
        duration: deep.contentStyle?.duration || '15-25 دقيقة',
        exampleTitles: deep.contentStyle?.exampleTitles || []
      });
    });
  }
  
  // Add demands as suggestions
  if (deep.demands) {
    deep.demands.forEach(demand => {
      suggestions.push({
        topic: demand.replace(/["']/g, ''),
        priority: 'MEDIUM',
        evidence: 'طلب مباشر من الجمهور',
        source: 'comment'
      });
    });
  }
  
  return suggestions;
}

// ============================================
// GET UNDERSERVED PERSONAS WITH SUGGESTIONS
// ============================================
export async function getUnderservedPersonasWithSuggestions() {
  const { getUnderservedPersonas } = await import('./personaTracker.js');
  const underserved = await getUnderservedPersonas();
  
  return underserved.map(persona => ({
    ...persona,
    suggestions: getContentSuggestionsForPersona(persona.id),
    deepProfile: PERSONA_DEEP_PROFILES[persona.id] || null
  }));
}

// ============================================
// MATCH TOPIC TO PERSONA (Enhanced)
// ============================================
export function matchTopicToPersona(topic, useDeepProfiles = true) {
  const topicLower = topic.toLowerCase();
  const matches = [];
  
  for (const [personaId, persona] of Object.entries(PERSONAS)) {
    let score = 0;
    const reasons = [];
    
    // Basic keyword matching
    const keywords = persona.triggerKeywords || [];
    const matchedKeywords = keywords.filter(kw => 
      topicLower.includes(kw.toLowerCase())
    );
    
    if (matchedKeywords.length > 0) {
      score += matchedKeywords.length * 10;
      reasons.push(`Keywords: ${matchedKeywords.join(', ')}`);
    }
    
    // Deep profile matching
    if (useDeepProfiles) {
      const deep = PERSONA_DEEP_PROFILES[personaId];
      
      if (deep) {
        // Check search terms
        if (deep.watching?.topSearchTerms) {
          const searchMatch = deep.watching.topSearchTerms.find(st => 
            topicLower.includes(st.term.toLowerCase())
          );
          if (searchMatch) {
            score += Math.min(50, searchMatch.views / 100);
            reasons.push(`Search term: ${searchMatch.term} (${searchMatch.views} views)`);
          }
        }
        
        // Check priority topics
        if (deep.priorityTopics) {
          const priorityMatch = deep.priorityTopics.find(pt => 
            topicLower.includes(pt.topic.toLowerCase()) ||
            pt.topic.toLowerCase().includes(topicLower)
          );
          if (priorityMatch) {
            score += priorityMatch.priority === 'HIGH' ? 30 : 15;
            reasons.push(`Priority topic: ${priorityMatch.topic}`);
          }
        }
      }
    }
    
    if (score > 0) {
      matches.push({
        personaId,
        persona: getEnrichedPersona(personaId),
        score,
        reasons
      });
    }
  }
  
  // Sort by score
  matches.sort((a, b) => b.score - a.score);
  
  return matches[0] || null;
}

// ============================================
// GET CONTENT PRIORITIES
// ============================================
export function getContentPriorities() {
  return CONTENT_PRIORITIES;
}

// ============================================
// GET GOLDEN RULE
// ============================================
export function getGoldenRule() {
  return GOLDEN_RULE;
}

// Export deep profiles for direct access
export { PERSONA_DEEP_PROFILES, CONTENT_PRIORITIES, GOLDEN_RULE };




