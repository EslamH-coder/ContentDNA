import { scoreBehaviors, BEHAVIORS, PENALTIES } from './audienceBehaviors.js';

/**
 * PREDICT SUCCESS FOR ANY CONTENT
 * Topic-agnostic - uses behavioral patterns only
 */

// ============================================
// ANALYZE ANY RSS ITEM
// ============================================
export function analyzeItemBehaviors(item) {
  const content = `${item.title || ''} ${item.description || ''}`;
  
  const behaviorScore = scoreBehaviors(content);
  
  return {
    item: {
      title: item.title,
      url: item.link
    },
    
    behavior_analysis: behaviorScore,
    
    // What makes this work (or not)
    strengths: behaviorScore.behaviors_found.map(b => b.name),
    weaknesses: behaviorScore.behaviors_missing.slice(0, 3).map(b => b.name),
    
    // Actionable recommendations
    how_to_improve: behaviorScore.recommendations,
    
    // Final prediction
    viral_potential: behaviorScore.prediction,
    expected_views: behaviorScore.expected_views,
    
    // Should we pursue this?
    recommendation: behaviorScore.score >= 50 
      ? 'PROCEED' 
      : 'IMPROVE_FIRST'
  };
}

// ============================================
// COMPARE MULTIPLE ANGLES
// ============================================
export function compareAngles(angles) {
  const scored = angles.map(angle => ({
    angle,
    ...scoreBehaviors(angle)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return {
    best_angle: scored[0],
    all_angles: scored,
    recommendation: `Use "${scored[0].angle}" - highest behavior score (${scored[0].score})`
  };
}

// ============================================
// GENERATE BEHAVIOR-OPTIMIZED ANGLE
// ============================================
export function generateOptimizedAngle(rawIdea, extractedData) {
  // Start with raw idea
  let angle = rawIdea;
  const modifications = [];
  
  // 1. Add CURIOSITY if missing
  if (!/كيف|لماذا|ليه/.test(angle)) {
    angle = `لماذا ${angle}؟`;
    modifications.push('Added WHY question');
  }
  
  // 2. Add NUMBER if available
  if (extractedData.numbers?.length > 0 && !/\d+\s*(مليار|مليون|تريليون)/.test(angle)) {
    const bigNumber = extractedData.numbers.find(n => /مليار|مليون|تريليون|billion|million/i.test(n));
    if (bigNumber) {
      angle = angle.replace('؟', ` (${bigNumber})؟`);
      modifications.push('Added big number');
    }
  }
  
  // 3. Add ENTITY if available
  if (extractedData.entities?.length > 0 && !BEHAVIORS.ENTITY_MAGNETISM.patterns.some(p => p.test(angle))) {
    angle = `${extractedData.entities[0]}: ${angle}`;
    modifications.push('Added entity');
  }
  
  // 4. Add ARAB REGION if missing
  if (!BEHAVIORS.REGIONAL_RELEVANCE.patterns.some(p => p.test(angle))) {
    angle = angle.replace('؟', '... والتأثير على الخليج؟');
    modifications.push('Added Arab relevance');
  }
  
  return {
    original: rawIdea,
    optimized: angle,
    modifications,
    score_before: scoreBehaviors(rawIdea).score,
    score_after: scoreBehaviors(angle).score
  };
}

// ============================================
// EXPLORE NEW TOPIC WITH BEHAVIORS
// ============================================
export function exploreNewTopic(topicIdea, context = {}) {
  /**
   * Takes any new topic and generates behavior-optimized angles
   */
  
  const angles = [];
  
  // Angle 1: HOW question
  angles.push({
    type: 'HOW_QUESTION',
    angle: `كيف ${topicIdea}؟`,
    behaviors: ['CURIOSITY_TRIGGER']
  });
  
  // Angle 2: WHY question
  angles.push({
    type: 'WHY_QUESTION',
    angle: `لماذا ${topicIdea}؟`,
    behaviors: ['CURIOSITY_TRIGGER']
  });
  
  // Angle 3: With big number (if provided)
  if (context.number) {
    angles.push({
      type: 'SCALE_ANCHOR',
      angle: `${context.number}: ${topicIdea}`,
      behaviors: ['SCALE_ANCHOR', 'CURIOSITY_TRIGGER']
    });
  }
  
  // Angle 4: With entity (if provided)
  if (context.entity) {
    angles.push({
      type: 'ENTITY_FOCUS',
      angle: `${context.entity} و${topicIdea}... كيف؟`,
      behaviors: ['ENTITY_MAGNETISM', 'CURIOSITY_TRIGGER']
    });
  }
  
  // Angle 5: Arab relevance
  angles.push({
    type: 'ARAB_ANGLE',
    angle: `${topicIdea}... والتأثير على الخليج ومصر`,
    behaviors: ['REGIONAL_RELEVANCE']
  });
  
  // Angle 6: Combined (all behaviors)
  if (context.entity && context.number) {
    angles.push({
      type: 'FULL_OPTIMIZED',
      angle: `لماذا ${context.entity} استثمر ${context.number} في ${topicIdea}؟ التأثير على الخليج`,
      behaviors: ['CURIOSITY_TRIGGER', 'ENTITY_MAGNETISM', 'SCALE_ANCHOR', 'REGIONAL_RELEVANCE']
    });
  }
  
  // Score all angles
  const scored = angles.map(a => ({
    ...a,
    score: scoreBehaviors(a.angle)
  }));
  
  scored.sort((a, b) => b.score.score - a.score.score);
  
  return {
    topic: topicIdea,
    angles_generated: scored.length,
    best_angle: scored[0],
    all_angles: scored,
    recommendation: `Best angle: "${scored[0].angle}" (Score: ${scored[0].score.score})`
  };
}

