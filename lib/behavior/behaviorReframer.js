/**
 * BEHAVIOR REFRAMER
 * Takes low-scoring content and suggests improvements based on patterns
 */

// ============================================
// TITLE REFRAME TEMPLATES
// ============================================
const TITLE_TEMPLATES = {
  // Pattern 1: Certainty (هل questions)
  certainty: [
    'هل {entity} {action}؟',
    'هل سينجح {entity} في {goal}؟',
    'هل ستنهار {entity}؟',
    'هل يستطيع {entity} {action}؟'
  ],
  
  // Pattern 2 + 6: Power + Personality
  power_person: [
    'كيف يسيطر {person} على {domain}؟',
    'لماذا يخاف {person} من {threat}؟',
    'ماذا يخطط {person} لـ{target}؟',
    '{person} يتحدى {opponent}: ماذا سيحدث؟'
  ],
  
  // Pattern 3: Conflict
  conflict: [
    '{entity_a} vs {entity_b}: من سيفوز؟',
    '{entity_a} ضد {entity_b}: من يتحكم في {stakes}؟',
    'حرب {entity_a} و{entity_b}: كيف ستؤثر على {arab_region}؟'
  ],
  
  // Pattern 4: Arab Stakes
  arab_stakes: [
    'كيف يؤثر {event} على {arab_region}؟',
    'لماذا يجب أن يهتم {arab_audience} بـ{topic}؟',
    '{global_event}: ماذا يعني للعرب؟'
  ]
};

// ============================================
// MAIN REFRAME FUNCTION
// ============================================
export function reframeContent(newsItem, analysis) {
  const suggestions = [];
  
  // Collect all suggestions from analysis
  if (analysis.pattern1_certainty?.suggestion) {
    suggestions.push({
      pattern: 'Certainty',
      suggestion: analysis.pattern1_certainty.suggestion,
      templates: TITLE_TEMPLATES.certainty
    });
  }
  
  if (analysis.pattern2_power?.suggestion) {
    suggestions.push({
      pattern: 'Power',
      suggestion: analysis.pattern2_power.suggestion,
      templates: TITLE_TEMPLATES.power_person
    });
  }
  
  if (analysis.pattern3_conflict?.suggestion) {
    suggestions.push({
      pattern: 'Conflict',
      suggestion: analysis.pattern3_conflict.suggestion,
      templates: TITLE_TEMPLATES.conflict
    });
  }
  
  if (analysis.pattern4_arab?.suggestion) {
    suggestions.push({
      pattern: 'Arab Stakes',
      suggestion: analysis.pattern4_arab.suggestion,
      templates: TITLE_TEMPLATES.arab_stakes
    });
  }
  
  if (analysis.pattern5_mobile?.suggestion) {
    suggestions.push({
      pattern: 'Mobile First',
      suggestion: analysis.pattern5_mobile.suggestion,
      templates: []
    });
  }
  
  if (analysis.pattern6_personality?.suggestion) {
    suggestions.push({
      pattern: 'Personality',
      suggestion: analysis.pattern6_personality.suggestion,
      templates: TITLE_TEMPLATES.power_person
    });
  }
  
  // Generate alternative titles
  const alternativeTitles = generateAlternativeTitles(newsItem, analysis);
  
  return {
    original: newsItem.title,
    suggestions,
    alternative_titles: alternativeTitles,
    priority_fix: getPriorityFix(analysis)
  };
}

// ============================================
// GENERATE ALTERNATIVE TITLES
// ============================================
function generateAlternativeTitles(newsItem, analysis) {
  const alternatives = [];
  const power = analysis.pattern2_power;
  const conflict = analysis.pattern3_conflict;
  
  // If we have entities, generate alternatives
  const entity = power?.power_entity?.name || conflict?.entities_found?.[0];
  
  if (entity) {
    // هل question version
    alternatives.push({
      title: `هل سينجح ${entity} في تحقيق أهدافه؟`,
      patterns_used: ['Certainty', 'Power'],
      estimated_improvement: '+20%'
    });
    
    // Conflict version if two entities
    if (conflict?.entities_found?.length >= 2) {
      alternatives.push({
        title: `${conflict.entities_found[0]} vs ${conflict.entities_found[1]}: من سيفوز؟`,
        patterns_used: ['Conflict'],
        estimated_improvement: '+25%'
      });
    }
    
    // Arab stakes version
    alternatives.push({
      title: `كيف يؤثر قرار ${entity} على الخليج ومصر؟`,
      patterns_used: ['Power', 'Arab Stakes'],
      estimated_improvement: '+30%'
    });
  }
  
  return alternatives;
}

// ============================================
// GET PRIORITY FIX
// ============================================
function getPriorityFix(analysis) {
  // Find the lowest scoring pattern that has highest weight
  const patternScores = [
    { name: 'Arab Stakes', score: analysis.pattern4_arab?.score || 0, weight: 20 },
    { name: 'Certainty', score: analysis.pattern1_certainty?.score || 0, weight: 20 },
    { name: 'Power', score: analysis.pattern2_power?.score || 0, weight: 18 },
    { name: 'Conflict', score: analysis.pattern3_conflict?.score || 0, weight: 18 },
  ];
  
  // Sort by (10 - score) * weight to find biggest opportunity
  patternScores.sort((a, b) => {
    const opportunityA = (10 - a.score) * a.weight;
    const opportunityB = (10 - b.score) * b.weight;
    return opportunityB - opportunityA;
  });
  
  const priority = patternScores[0];
  
  if (priority.score >= 7) {
    return null; // No priority fix needed
  }
  
  return {
    pattern: priority.name,
    current_score: priority.score,
    potential_gain: `+${Math.round((10 - priority.score) * priority.weight / 10)}%`,
    action: getActionForPattern(priority.name)
  };
}

function getActionForPattern(pattern) {
  const actions = {
    'Certainty': 'Reframe as "هل [bold claim]؟" question',
    'Power': 'Identify the powerful person/entity making decisions',
    'Conflict': 'Frame as [A] vs [B] with clear stakes',
    'Arab Stakes': 'Add explicit impact on Egypt/Saudi/Gulf'
  };
  return actions[pattern] || 'Review and improve';
}




