/**
 * BEHAVIOR ANALYZER
 * Extracts the 6 behavior patterns from any news story
 * Makes ANY topic work by applying proven audience behavior patterns
 */

// ============================================
// POWER ENTITIES DATABASE
// ============================================
const POWER_ENTITIES = {
  // People (high power)
  people: {
    'trump': { name: 'دونالد ترامب', title: 'الرئيس الأمريكي', power_score: 10 },
    'ترامب': { name: 'دونالد ترامب', title: 'الرئيس الأمريكي', power_score: 10 },
    'ترمب': { name: 'دونالد ترامب', title: 'الرئيس الأمريكي', power_score: 10 },
    'biden': { name: 'جو بايدن', title: 'الرئيس الأمريكي', power_score: 10 },
    'بايدن': { name: 'جو بايدن', title: 'الرئيس الأمريكي', power_score: 10 },
    'xi': { name: 'شي جين بينغ', title: 'الرئيس الصيني', power_score: 10 },
    'putin': { name: 'فلاديمير بوتين', title: 'الرئيس الروسي', power_score: 10 },
    'بوتين': { name: 'فلاديمير بوتين', title: 'الرئيس الروسي', power_score: 10 },
    'musk': { name: 'إيلون ماسك', title: 'أغنى رجل في العالم', power_score: 9 },
    'ماسك': { name: 'إيلون ماسك', title: 'أغنى رجل في العالم', power_score: 9 },
    'mbs': { name: 'محمد بن سلمان', title: 'ولي العهد السعودي', power_score: 9 },
    'محمد بن سلمان': { name: 'محمد بن سلمان', title: 'ولي العهد السعودي', power_score: 9 },
    'bezos': { name: 'جيف بيزوس', title: 'مؤسس أمازون', power_score: 8 },
    'zuckerberg': { name: 'مارك زوكربيرغ', title: 'مؤسس فيسبوك', power_score: 8 },
    'cook': { name: 'تيم كوك', title: 'رئيس أبل', power_score: 8 },
    'altman': { name: 'سام ألتمان', title: 'رئيس OpenAI', power_score: 8 },
    'powell': { name: 'جيروم باول', title: 'رئيس الفيدرالي الأمريكي', power_score: 9 },
    'باول': { name: 'جيروم باول', title: 'رئيس الفيدرالي الأمريكي', power_score: 9 },
  },
  
  // Countries/Institutions (medium power - need person to boost)
  institutions: {
    'america': { name: 'أمريكا', power_score: 8 },
    'أمريكا': { name: 'أمريكا', power_score: 8 },
    'usa': { name: 'أمريكا', power_score: 8 },
    'china': { name: 'الصين', power_score: 8 },
    'الصين': { name: 'الصين', power_score: 8 },
    'russia': { name: 'روسيا', power_score: 7 },
    'روسيا': { name: 'روسيا', power_score: 7 },
    'iran': { name: 'إيران', power_score: 7 },
    'إيران': { name: 'إيران', power_score: 7 },
    'saudi': { name: 'السعودية', power_score: 7 },
    'السعودية': { name: 'السعودية', power_score: 7 },
    'apple': { name: 'أبل', power_score: 7 },
    'أبل': { name: 'أبل', power_score: 7 },
    'google': { name: 'جوجل', power_score: 7 },
    'microsoft': { name: 'مايكروسوفت', power_score: 7 },
    'tesla': { name: 'تسلا', power_score: 7 },
    'openai': { name: 'OpenAI', power_score: 7 },
    'federal reserve': { name: 'الفيدرالي الأمريكي', power_score: 8 },
    'الفيدرالي': { name: 'الفيدرالي الأمريكي', power_score: 8 },
  }
};

// ============================================
// CONFLICT INDICATORS
// ============================================
const CONFLICT_WORDS = {
  english: ['vs', 'versus', 'against', 'war', 'battle', 'fight', 'clash', 'conflict', 'rivalry', 'competition', 'threatens', 'attacks', 'retaliates'],
  arabic: ['ضد', 'حرب', 'صراع', 'معركة', 'مواجهة', 'تهدد', 'ترد', 'تهاجم', 'تنافس']
};

// ============================================
// ARAB RELEVANCE INDICATORS
// ============================================
const ARAB_REGIONS = {
  direct: ['مصر', 'السعودية', 'الإمارات', 'الخليج', 'المغرب', 'الجزائر', 'العراق', 'الأردن', 'تونس', 'العرب', 'العربي', 'العربية'],
  indirect: ['النفط', 'البترول', 'الدولار', 'قناة السويس', 'الشرق الأوسط', 'الحج', 'رمضان']
};

// ============================================
// POWER ACTION WORDS
// ============================================
const POWER_ACTIONS = {
  english: ['decides', 'announces', 'orders', 'bans', 'launches', 'threatens', 'demands', 'controls', 'dominates', 'reveals', 'warns'],
  arabic: ['يقرر', 'يعلن', 'يأمر', 'يحظر', 'يطلق', 'يهدد', 'يطالب', 'يسيطر', 'يكشف', 'يحذر', 'يفرض', 'يمنع']
};

// ============================================
// MAIN ANALYZER
// ============================================
export function analyzeBehaviorPatterns(newsItem) {
  const text = `${newsItem.title || ''} ${newsItem.description || ''}`.toLowerCase();
  const arabicText = `${newsItem.title || ''} ${newsItem.description || ''}`;
  
  const analysis = {
    // Pattern 1: Certainty from Uncertainty
    pattern1_certainty: analyzeUncertainty(newsItem),
    
    // Pattern 2: Power Dynamics
    pattern2_power: analyzePowerDynamics(text, arabicText),
    
    // Pattern 3: Conflict
    pattern3_conflict: analyzeConflict(text, arabicText),
    
    // Pattern 4: Arab Stakes
    pattern4_arab: analyzeArabRelevance(arabicText, newsItem),
    
    // Pattern 5: Mobile First
    pattern5_mobile: analyzeMobileFirst(newsItem.title),
    
    // Pattern 6: Personality over Policy
    pattern6_personality: analyzePersonality(text, arabicText)
  };
  
  // Calculate total score
  analysis.total_score = calculateTotalScore(analysis);
  analysis.patterns_matched = countPatternsMatched(analysis);
  analysis.recommendation = getRecommendation(analysis);
  
  return analysis;
}

// ============================================
// PATTERN 1: CERTAINTY FROM UNCERTAINTY
// ============================================
function analyzeUncertainty(newsItem) {
  const title = newsItem.title || '';
  
  // Check for question patterns
  const hasHalQuestion = /^هل\s/.test(title) || /هل\s.*\?|؟/.test(title);
  const hasKayfQuestion = /^كيف\s/.test(title) || /كيف\s.*\?|؟/.test(title);
  const hasLimadhaQuestion = /^لماذا\s/.test(title) || /لماذا\s.*\?|؟/.test(title);
  const hasEnglishQuestion = /^(will|can|does|is|are|has|should)\s/i.test(title);
  
  // "هل" questions are best (promise YES/NO answer)
  let score = 0;
  let question_type = null;
  
  if (hasHalQuestion) {
    score = 10;
    question_type = 'هل (YES/NO)';
  } else if (hasKayfQuestion) {
    score = 8;
    question_type = 'كيف (HOW)';
  } else if (hasLimadhaQuestion) {
    score = 8;
    question_type = 'لماذا (WHY)';
  } else if (hasEnglishQuestion) {
    score = 6;
    question_type = 'English question';
  } else if (title.includes('?') || title.includes('؟')) {
    score = 5;
    question_type = 'Implicit question';
  }
  
  return {
    score,
    has_question: score > 0,
    question_type,
    suggestion: score < 7 ? 'Reframe as "هل [bold claim]؟" for better engagement' : null
  };
}

// ============================================
// PATTERN 2: POWER DYNAMICS
// ============================================
function analyzePowerDynamics(text, arabicText) {
  let powerEntity = null;
  let powerScore = 0;
  let hasPowerAction = false;
  
  // Find power entities
  for (const [key, entity] of Object.entries(POWER_ENTITIES.people)) {
    if (text.includes(key) || arabicText.includes(key)) {
      if (entity.power_score > powerScore) {
        powerEntity = entity;
        powerScore = entity.power_score;
      }
    }
  }
  
  // If no person found, check institutions
  if (!powerEntity) {
    for (const [key, entity] of Object.entries(POWER_ENTITIES.institutions)) {
      if (text.includes(key) || arabicText.includes(key)) {
        if (entity.power_score > powerScore) {
          powerEntity = entity;
          powerScore = entity.power_score;
        }
      }
    }
  }
  
  // Check for power actions
  for (const action of [...POWER_ACTIONS.english, ...POWER_ACTIONS.arabic]) {
    if (text.includes(action) || arabicText.includes(action)) {
      hasPowerAction = true;
      break;
    }
  }
  
  const score = powerEntity ? (powerScore * (hasPowerAction ? 1 : 0.7)) : 0;
  
  return {
    score: Math.round(score),
    power_entity: powerEntity,
    has_power_action: hasPowerAction,
    suggestion: !powerEntity ? 'Identify who has POWER in this story (person > institution)' : null
  };
}

// ============================================
// PATTERN 3: CONFLICT
// ============================================
function analyzeConflict(text, arabicText) {
  let hasConflictWord = false;
  let conflictType = null;
  
  // Check for conflict words
  for (const word of [...CONFLICT_WORDS.english, ...CONFLICT_WORDS.arabic]) {
    if (text.includes(word) || arabicText.includes(word)) {
      hasConflictWord = true;
      conflictType = word;
      break;
    }
  }
  
  // Check for two entities (X vs Y pattern)
  const entities = [];
  for (const [key, entity] of Object.entries({...POWER_ENTITIES.people, ...POWER_ENTITIES.institutions})) {
    if (text.includes(key) || arabicText.includes(key)) {
      entities.push(entity.name);
    }
  }
  
  const hasTwoSides = entities.length >= 2;
  
  let score = 0;
  if (hasConflictWord && hasTwoSides) score = 10;
  else if (hasTwoSides) score = 7;
  else if (hasConflictWord) score = 5;
  
  return {
    score,
    has_conflict: hasConflictWord,
    has_two_sides: hasTwoSides,
    entities_found: entities.slice(0, 2),
    conflict_type: conflictType,
    suggestion: score < 7 ? 'Frame as [A] vs [B]: من سيفوز؟' : null
  };
}

// ============================================
// PATTERN 4: ARAB STAKES
// ============================================
function analyzeArabRelevance(arabicText, newsItem) {
  let score = 0;
  const foundRegions = [];
  const foundIndirect = [];
  
  // Direct mentions
  for (const region of ARAB_REGIONS.direct) {
    if (arabicText.includes(region)) {
      foundRegions.push(region);
      score += 3;
    }
  }
  
  // Indirect mentions
  for (const indicator of ARAB_REGIONS.indirect) {
    if (arabicText.includes(indicator)) {
      foundIndirect.push(indicator);
      score += 1.5;
    }
  }
  
  // Cap at 10
  score = Math.min(10, score);
  
  // Generate impact suggestion
  let impactSuggestion = null;
  if (score < 5) {
    impactSuggestion = generateArabImpactSuggestion(newsItem);
  }
  
  return {
    score: Math.round(score),
    direct_mentions: foundRegions,
    indirect_mentions: foundIndirect,
    suggestion: impactSuggestion
  };
}

function generateArabImpactSuggestion(newsItem) {
  const title = (newsItem.title || '').toLowerCase();
  
  // Generate contextual suggestions
  if (title.includes('oil') || title.includes('energy') || title.includes('نفط')) {
    return 'Add: "كيف يؤثر على أسعار البنزين في الخليج؟"';
  }
  if (title.includes('dollar') || title.includes('currency') || title.includes('دولار')) {
    return 'Add: "ماذا يعني للجنيه المصري والريال السعودي؟"';
  }
  if (title.includes('tech') || title.includes('ai') || title.includes('تكنولوجيا')) {
    return 'Add: "كيف سيؤثر على وظائف الشباب العربي؟"';
  }
  if (title.includes('trade') || title.includes('tariff') || title.includes('تجارة')) {
    return 'Add: "كيف ستتأثر أسعار السلع في مصر والخليج؟"';
  }
  
  return 'Ask: "كيف يؤثر هذا على المنطقة العربية؟"';
}

// ============================================
// PATTERN 5: MOBILE FIRST
// ============================================
function analyzeMobileFirst(title) {
  if (!title) return { score: 0, suggestion: 'No title provided' };
  
  const words = title.split(/\s+/);
  const first5Words = words.slice(0, 5).join(' ');
  
  // Check if first 5 words create curiosity
  let score = 5; // Base score
  
  // Bonus for starting with question
  if (/^(هل|كيف|لماذا|ماذا)/.test(first5Words)) {
    score += 3;
  }
  
  // Bonus for having number in first 5 words
  if (/\d+/.test(first5Words)) {
    score += 1;
  }
  
  // Bonus for power entity in first 5 words
  for (const key of Object.keys(POWER_ENTITIES.people)) {
    if (first5Words.toLowerCase().includes(key)) {
      score += 1;
      break;
    }
  }
  
  // Penalty for starting with show name
  if (/^المُخبر|^المخبر/.test(first5Words)) {
    score -= 2;
  }
  
  // Penalty for too long title (hard to read on mobile)
  if (title.length > 70) {
    score -= 1;
  }
  
  score = Math.min(10, Math.max(0, score));
  
  return {
    score,
    first_5_words: first5Words,
    title_length: title.length,
    suggestion: score < 7 ? 'Start with hook word (هل/كيف/لماذا) + power entity in first 5 words' : null
  };
}

// ============================================
// PATTERN 6: PERSONALITY OVER POLICY
// ============================================
function analyzePersonality(text, arabicText) {
  let hasPerson = false;
  let personName = null;
  let hasOnlyInstitution = true;
  
  // Check for person names
  for (const [key, entity] of Object.entries(POWER_ENTITIES.people)) {
    if (text.includes(key) || arabicText.includes(key)) {
      hasPerson = true;
      personName = entity.name;
      hasOnlyInstitution = false;
      break;
    }
  }
  
  // Check if only institution mentioned
  if (!hasPerson) {
    for (const key of Object.keys(POWER_ENTITIES.institutions)) {
      if (text.includes(key) || arabicText.includes(key)) {
        hasOnlyInstitution = true;
        break;
      }
    }
  }
  
  const score = hasPerson ? 10 : (hasOnlyInstitution ? 3 : 0);
  
  return {
    score,
    has_person: hasPerson,
    person_name: personName,
    has_only_institution: hasOnlyInstitution && !hasPerson,
    suggestion: !hasPerson ? 'Replace institution with person name (e.g., "أبل" → "تيم كوك")' : null
  };
}

// ============================================
// CALCULATE TOTAL SCORE
// ============================================
function calculateTotalScore(analysis) {
  const weights = {
    pattern1_certainty: 20,
    pattern2_power: 18,
    pattern3_conflict: 18,
    pattern4_arab: 20,
    pattern5_mobile: 12,
    pattern6_personality: 12
  };
  
  let totalScore = 0;
  let maxScore = 0;
  
  for (const [pattern, weight] of Object.entries(weights)) {
    const patternScore = analysis[pattern]?.score || 0;
    totalScore += (patternScore / 10) * weight;
    maxScore += weight;
  }
  
  return Math.round((totalScore / maxScore) * 100);
}

// ============================================
// COUNT PATTERNS MATCHED
// ============================================
function countPatternsMatched(analysis) {
  let count = 0;
  
  if (analysis.pattern1_certainty?.score >= 7) count++;
  if (analysis.pattern2_power?.score >= 7) count++;
  if (analysis.pattern3_conflict?.score >= 7) count++;
  if (analysis.pattern4_arab?.score >= 7) count++;
  if (analysis.pattern5_mobile?.score >= 7) count++;
  if (analysis.pattern6_personality?.score >= 7) count++;
  
  return count;
}

// ============================================
// GET RECOMMENDATION
// ============================================
function getRecommendation(analysis) {
  const matched = analysis.patterns_matched;
  const score = analysis.total_score;
  
  if (matched >= 5) {
    return {
      status: 'EXCELLENT',
      message: 'Strong match with audience behavior patterns',
      color: 'green',
      action: 'Ready to produce'
    };
  } else if (matched >= 4) {
    return {
      status: 'GOOD',
      message: 'Good potential, minor improvements possible',
      color: 'green',
      action: 'Consider suggestions below'
    };
  } else if (matched >= 3) {
    return {
      status: 'FAIR',
      message: 'Needs reframing to match audience expectations',
      color: 'yellow',
      action: 'Apply suggestions before proceeding'
    };
  } else {
    return {
      status: 'WEAK',
      message: 'Does not match audience behavior patterns',
      color: 'red',
      action: 'Significant reframing needed or skip this topic'
    };
  }
}




