/**
 * AUDIENCE BEHAVIOR MODEL
 * Predicts viral potential based on behavioral signals, not topic history
 */

// ============================================
// BEHAVIOR DEFINITIONS
// ============================================
export const BEHAVIORS = {
  CURIOSITY_TRIGGER: {
    id: 'CURIOSITY_TRIGGER',
    name: 'HOW/WHY Question',
    weight: 25,
    description: '100% of high performers use HOW/WHY framing',
    patterns: [
      /كيف\s/i,
      /لماذا\s/i,
      /ليه\s/i,
      /how\s/i,
      /why\s/i,
      /ما\sسبب/i,
      /ما\sهو\sسر/i
    ],
    examples: {
      good: 'كيف سيدمر ترمب اقتصاد أمريكا؟',
      bad: 'ترمب يدمر اقتصاد أمريكا'
    },
    transformation: 'Add كيف or لماذا at the start'
  },

  SCALE_ANCHOR: {
    id: 'SCALE_ANCHOR',
    name: 'Big Number',
    weight: 20,
    description: 'Big number in hook = +1.5M views average',
    patterns: [
      /\d+\s*(تريليون|مليار|مليون)/i,
      /\d+\s*(trillion|billion|million)/i,
      /\d+%/,
      /\$\d+/,
      /\d{3,}\s*(سنة|عام|year)/i
    ],
    examples: {
      good: 'الشركة اللي قيمتها 3.4 تريليون دولار',
      bad: 'الشركة الكبيرة'
    },
    transformation: 'Add specific large number with context'
  },

  DATE_SPECIFICITY: {
    id: 'DATE_SPECIFICITY',
    name: 'Specific Date',
    weight: 10,
    description: 'Specific date = credibility signal',
    patterns: [
      /في\s+\d{1,2}\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)/i,
      /\b\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i,
      /\b20\d{2}\b/
    ],
    examples: {
      good: 'في 13 فبراير 2025 ترامب استقبل...',
      bad: 'مؤخراً ترامب قال...'
    },
    transformation: 'Add specific date (day month year)'
  },

  ENTITY_MAGNETISM: {
    id: 'ENTITY_MAGNETISM',
    name: 'Major Entity',
    weight: 15,
    description: 'Major entity in hook = +693K views',
    patterns: [
      // People
      /ترامب|ترمب|trump/i,
      /ماسك|musk/i,
      /بايدن|biden/i,
      // Countries (poles)
      /أمريكا|امريكا|america|usa/i,
      /الصين|china/i,
      /روسيا|russia/i,
      /إيران|ايران|iran/i,
      // Companies
      /أبل|ابل|apple/i,
      /تسلا|tesla/i,
      /مايكروسوفت|microsoft/i,
      /جوجل|google/i,
      /أمازون|amazon/i,
      /نفيديا|nvidia/i
    ],
    examples: {
      good: 'أبل vs مايكروسوفت: من سيفوز؟',
      bad: 'شركات التقنية تتنافس'
    },
    transformation: 'Add specific company/person name'
  },

  REGIONAL_RELEVANCE: {
    id: 'REGIONAL_RELEVANCE',
    name: 'Arab Connection',
    weight: 15,
    description: '33% of high performers vs 0% of low performers!',
    patterns: [
      /مصر/,
      /السعودية|سعودية/,
      /الإمارات|الامارات|إمارات/,
      /الخليج|خليج/,
      /قطر/,
      /دبي/,
      /الكويت/,
      /البحرين/,
      /عمان/,
      /العرب|عربي/,
      /الشرق الأوسط/,
      /قناة السويس/
    ],
    examples: {
      good: 'كيف يؤثر على مصر والخليج؟',
      bad: 'كيف يؤثر على العالم؟'
    },
    transformation: 'Add specific Arab region impact'
  },

  IMMEDIATE_ANSWER: {
    id: 'IMMEDIATE_ANSWER',
    name: 'Anti-Clickbait',
    weight: 10,
    description: 'Question + immediate answer = trust + curiosity',
    patterns: [
      /\?.*الإجابة/i,
      /\?.*الجواب/i,
      /\?.*نعم/,
      /\?.*لا،/,
      /\?.*بالتأكيد/
    ],
    examples: {
      good: 'هل أمريكا تقدر تحارب الصين؟ الإجابة نعم...',
      bad: 'هل أمريكا تقدر تحارب الصين؟ (شاهد لتعرف)'
    },
    transformation: 'Add answer after question'
  }
};

// ============================================
// BEHAVIOR PENALTIES
// ============================================
export const PENALTIES = {
  CLICKBAIT_QUESTION: {
    id: 'CLICKBAIT_QUESTION',
    name: 'Unanswered Question',
    weight: -10,
    description: 'Question without answer feels clickbaity',
    detect: (content) => {
      const hasQuestion = /\?/.test(content);
      const hasAnswer = /الإجابة|الجواب|نعم|لا،|بالتأكيد/.test(content);
      return hasQuestion && !hasAnswer;
    }
  },

  VAGUE_THREAT: {
    id: 'VAGUE_THREAT',
    name: 'Generic Threat',
    weight: -15,
    description: '"في خطر" without specificity performs poorly',
    detect: (content) => {
      return /في خطر|كارثة|انهيار/.test(content) && 
             !/\d+/.test(content); // No number to make it specific
    }
  },

  NO_ENTITY: {
    id: 'NO_ENTITY',
    name: 'Missing Entity',
    weight: -10,
    description: 'Content without recognizable entity struggles',
    detect: (content) => {
      const entityPatterns = BEHAVIORS.ENTITY_MAGNETISM.patterns;
      return !entityPatterns.some(p => p.test(content));
    }
  }
};

// ============================================
// SCORE CONTENT BY BEHAVIORS
// ============================================
export function scoreBehaviors(content) {
  const result = {
    score: 30, // Base score
    behaviors_found: [],
    behaviors_missing: [],
    penalties: [],
    recommendations: []
  };

  // Check each behavior
  for (const [key, behavior] of Object.entries(BEHAVIORS)) {
    const found = behavior.patterns.some(pattern => pattern.test(content));
    
    if (found) {
      result.score += behavior.weight;
      result.behaviors_found.push({
        id: behavior.id,
        name: behavior.name,
        impact: `+${behavior.weight}`,
        description: behavior.description
      });
    } else {
      result.behaviors_missing.push({
        id: behavior.id,
        name: behavior.name,
        potential_impact: `+${behavior.weight}`,
        how_to_add: behavior.transformation,
        example: behavior.examples.good
      });
    }
  }

  // Check penalties
  for (const [key, penalty] of Object.entries(PENALTIES)) {
    if (penalty.detect(content)) {
      result.score += penalty.weight;
      result.penalties.push({
        id: penalty.id,
        name: penalty.name,
        impact: `${penalty.weight}`,
        description: penalty.description
      });
    }
  }

  // Cap score
  result.score = Math.min(100, Math.max(0, result.score));

  // Prediction
  if (result.score >= 70) {
    result.prediction = 'HIGH_POTENTIAL';
    result.expected_views = '1M+';
  } else if (result.score >= 50) {
    result.prediction = 'MEDIUM_POTENTIAL';
    result.expected_views = '500K-1M';
  } else {
    result.prediction = 'LOW_POTENTIAL';
    result.expected_views = '<500K';
  }

  // Generate recommendations
  result.recommendations = result.behaviors_missing
    .sort((a, b) => parseInt(b.potential_impact) - parseInt(a.potential_impact))
    .slice(0, 3)
    .map(b => ({
      action: `Add ${b.name}`,
      how: b.how_to_add,
      example: b.example,
      potential_gain: b.potential_impact
    }));

  return result;
}

// ============================================
// TRANSFORM CONTENT TO ADD BEHAVIORS
// ============================================
export function transformWithBehaviors(content, targetBehaviors = ['CURIOSITY_TRIGGER', 'SCALE_ANCHOR', 'REGIONAL_RELEVANCE']) {
  let transformed = content;
  const applied = [];

  for (const behaviorId of targetBehaviors) {
    const behavior = BEHAVIORS[behaviorId];
    if (!behavior) continue;

    // Check if already has this behavior
    if (behavior.patterns.some(p => p.test(transformed))) {
      continue;
    }

    // Apply transformation based on behavior type
    switch (behaviorId) {
      case 'CURIOSITY_TRIGGER':
        if (!/كيف|لماذا|ليه/.test(transformed)) {
          transformed = 'كيف ' + transformed + '؟';
          applied.push('Added HOW/WHY');
        }
        break;

      case 'REGIONAL_RELEVANCE':
        if (!BEHAVIORS.REGIONAL_RELEVANCE.patterns.some(p => p.test(transformed))) {
          transformed = transformed + '... وتأثيره على الخليج ومصر';
          applied.push('Added Arab relevance');
        }
        break;

      // Add more transformations as needed
    }
  }

  return {
    original: content,
    transformed,
    transformations_applied: applied,
    new_score: scoreBehaviors(transformed)
  };
}

