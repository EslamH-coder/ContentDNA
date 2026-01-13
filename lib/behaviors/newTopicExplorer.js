import { scoreBehaviors, BEHAVIORS } from './audienceBehaviors.js';
import { exploreNewTopic } from './behaviorPredictor.js';

/**
 * EXPLORE NEW TOPICS SAFELY
 * Use behavior model to predict success before investing
 */

// ============================================
// EVALUATE NEW TOPIC POTENTIAL
// ============================================
export function evaluateNewTopic(topicIdea, context = {}) {
  // Step 1: Generate behavior-optimized angles
  const exploration = exploreNewTopic(topicIdea, context);
  
  // Step 2: Check if ANY angle has high potential
  const highPotentialAngles = exploration.all_angles.filter(a => a.score.score >= 70);
  const mediumPotentialAngles = exploration.all_angles.filter(a => a.score.score >= 50 && a.score.score < 70);
  
  // Step 3: Determine recommendation
  let recommendation;
  let format;
  
  if (highPotentialAngles.length >= 2) {
    recommendation = 'STRONG_GO';
    format = 'LONG_FORM';
  } else if (highPotentialAngles.length === 1) {
    recommendation = 'GO_WITH_BEST_ANGLE';
    format = 'LONG_FORM';
  } else if (mediumPotentialAngles.length >= 2) {
    recommendation = 'TEST_WITH_SHORT';
    format = 'SHORT_FIRST';
  } else {
    recommendation = 'SKIP_OR_REWORK';
    format = 'NONE';
  }
  
  return {
    topic: topicIdea,
    
    evaluation: {
      high_potential_angles: highPotentialAngles.length,
      medium_potential_angles: mediumPotentialAngles.length,
      best_score: exploration.best_angle.score.score
    },
    
    recommendation,
    format,
    
    best_angle: exploration.best_angle,
    
    if_proceed: {
      use_angle: exploration.best_angle.angle,
      behaviors_present: exploration.best_angle.score.behaviors_found.map(b => b.name),
      expected_views: exploration.best_angle.score.expected_views
    },
    
    if_short_test: {
      test_angle: exploration.best_angle.angle,
      success_threshold: 'Viewed % > 65%',
      then: 'If successful, make long-form with same angle'
    }
  };
}

// ============================================
// BATCH EVALUATE NEW TOPICS
// ============================================
export function evaluateTopicIdeas(ideas) {
  const results = ideas.map(idea => {
    // Handle string or object
    const topicIdea = typeof idea === 'string' ? idea : idea.topic;
    const context = typeof idea === 'string' ? {} : idea;
    
    return evaluateNewTopic(topicIdea, context);
  });
  
  // Sort by best score
  results.sort((a, b) => b.evaluation.best_score - a.evaluation.best_score);
  
  // Categorize
  const strongGo = results.filter(r => r.recommendation === 'STRONG_GO');
  const goWithAngle = results.filter(r => r.recommendation === 'GO_WITH_BEST_ANGLE');
  const testFirst = results.filter(r => r.recommendation === 'TEST_WITH_SHORT');
  const skip = results.filter(r => r.recommendation === 'SKIP_OR_REWORK');
  
  return {
    summary: {
      total: results.length,
      strong_go: strongGo.length,
      go_with_angle: goWithAngle.length,
      test_first: testFirst.length,
      skip: skip.length
    },
    
    categories: {
      '🚀 STRONG GO (Long-form now)': strongGo,
      '✅ GO (With best angle)': goWithAngle,
      '🧪 TEST (Short first)': testFirst,
      '⏭️ SKIP (Rework needed)': skip
    },
    
    top_3_topics: results.slice(0, 3).map(r => ({
      topic: r.topic,
      best_angle: r.best_angle.angle,
      score: r.evaluation.best_score,
      recommendation: r.recommendation
    }))
  };
}

// ============================================
// TRANSFORM WEAK TOPIC INTO STRONG ANGLE
// ============================================
export function rescueTopic(weakTopicIdea, availableData = {}) {
  /**
   * Takes a low-scoring topic and tries to make it work
   * by systematically adding missing behaviors
   */
  
  const initialScore = scoreBehaviors(weakTopicIdea);
  
  if (initialScore.score >= 70) {
    return {
      status: 'ALREADY_STRONG',
      message: 'Topic already scores well, no rescue needed',
      angle: weakTopicIdea,
      score: initialScore.score
    };
  }
  
  // Get missing behaviors sorted by weight
  const missing = initialScore.behaviors_missing
    .sort((a, b) => parseInt(b.potential_impact) - parseInt(a.potential_impact));
  
  let rescued = weakTopicIdea;
  const fixes = [];
  
  // Try to add each missing behavior
  for (const behavior of missing) {
    switch (behavior.id) {
      case 'CURIOSITY_TRIGGER':
        if (!/\?$/.test(rescued)) {
          rescued = `لماذا ${rescued}؟`;
          fixes.push('Added WHY question (+25)');
        }
        break;
        
      case 'SCALE_ANCHOR':
        if (availableData.numbers?.length > 0) {
          rescued = rescued.replace('؟', ` (${availableData.numbers[0]})؟`);
          fixes.push(`Added number: ${availableData.numbers[0]} (+20)`);
        }
        break;
        
      case 'ENTITY_MAGNETISM':
        if (availableData.entities?.length > 0) {
          rescued = `${availableData.entities[0]}: ${rescued}`;
          fixes.push(`Added entity: ${availableData.entities[0]} (+15)`);
        }
        break;
        
      case 'REGIONAL_RELEVANCE':
        if (!BEHAVIORS.REGIONAL_RELEVANCE.patterns.some(p => p.test(rescued))) {
          rescued = rescued.replace('؟', '... والتأثير على الخليج؟');
          fixes.push('Added Arab region (+15)');
        }
        break;
    }
    
    // Check if we've reached good score
    const newScore = scoreBehaviors(rescued);
    if (newScore.score >= 70) break;
  }
  
  const finalScore = scoreBehaviors(rescued);
  
  return {
    status: finalScore.score >= 70 ? 'RESCUED' : 'PARTIAL_RESCUE',
    original: weakTopicIdea,
    original_score: initialScore.score,
    rescued: rescued,
    rescued_score: finalScore.score,
    fixes_applied: fixes,
    improvement: finalScore.score - initialScore.score,
    recommendation: finalScore.score >= 70 
      ? 'Topic is now viable!'
      : `Score improved but still needs work. Missing: ${finalScore.behaviors_missing.slice(0, 2).map(b => b.name).join(', ')}`
  };
}

