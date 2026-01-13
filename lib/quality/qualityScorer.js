/**
 * QUALITY SCORER
 * Score content quality - show score to user but don't block
 */

// ============================================
// SCORING CRITERIA
// ============================================
const CRITERIA = {
  // Positive (add points)
  positive: [
    {
      name: 'has_date',
      points: 15,
      test: (text) => /في\s+\d{1,2}\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)/.test(text),
      description: 'تاريخ محدد'
    },
    {
      name: 'has_number',
      points: 15,
      test: (text) => /\d+\s*(%|مليون|مليار|تريليون|دولار|ريال)/.test(text),
      description: 'رقم محدد'
    },
    {
      name: 'has_source',
      points: 10,
      test: (text) => /(بحسب|وفقاً لـ?|حسب)\s+\w+/.test(text),
      description: 'مصدر موثق'
    },
    {
      name: 'has_entity_title',
      points: 10,
      test: (text) => /(الرئيس|رئيس الوزراء|شركة|وزير|مدير)\s+\w+/.test(text),
      description: 'كيان بلقبه'
    },
    {
      name: 'has_arab_region',
      points: 10,
      test: (text) => /(الخليج|السعودية|الإمارات|مصر|العرب|المنطقة العربية)/.test(text),
      description: 'ربط بالمنطقة العربية'
    },
    {
      name: 'has_how_why',
      points: 10,
      test: (text) => /^(كيف|لماذا|هل)\s+/.test(text),
      description: 'سؤال واضح'
    },
    {
      name: 'good_length',
      points: 5,
      test: (text) => text.length >= 50 && text.length <= 200,
      description: 'طول مناسب'
    }
  ],
  
  // Negative (subtract points) - Warnings not blockers
  negative: [
    {
      name: 'has_banned_phrase',
      points: -20,
      test: (text) => /(هل تعلم|هل تعرف|ما لا تعرفه|الحقائق المخفية|السر الذي)/.test(text),
      description: '⚠️ يحتوي عبارة عامة',
      warning: true
    },
    {
      name: 'has_fake_personal',
      points: -15,
      test: (text) => /(في بلدك|فاتورتك|أسعارك|ميزانيتك)/.test(text),
      description: '⚠️ personalization غير مناسب',
      warning: true
    },
    {
      name: 'has_english',
      points: -10,
      test: (text) => /[a-zA-Z]{4,}/.test(text),
      description: '⚠️ يحتوي كلمات إنجليزية',
      warning: true
    },
    {
      name: 'too_short',
      points: -10,
      test: (text) => text.length < 30,
      description: '⚠️ قصير جداً',
      warning: true
    },
    {
      name: 'no_specifics',
      points: -10,
      test: (text) => !/\d/.test(text) && !/(بحسب|وفقاً)/.test(text),
      description: '⚠️ بدون أرقام أو مصادر',
      warning: true
    }
  ]
};

// ============================================
// CALCULATE SCORE
// ============================================
export function calculateQualityScore(text) {
  if (!text || typeof text !== 'string') {
    return {
      score: 0,
      grade: 'F',
      positives: [],
      negatives: [],
      warnings: [],
      status: 'needs_improvement',
      color: 'red'
    };
  }
  
  let score = 50; // Base score
  const positives = [];
  const negatives = [];
  const warnings = [];
  
  // Check positive criteria
  for (const criterion of CRITERIA.positive) {
    if (criterion.test(text)) {
      score += criterion.points;
      positives.push({
        name: criterion.name,
        points: criterion.points,
        description: criterion.description
      });
    }
  }
  
  // Check negative criteria
  for (const criterion of CRITERIA.negative) {
    if (criterion.test(text)) {
      score += criterion.points; // points are negative
      negatives.push({
        name: criterion.name,
        points: criterion.points,
        description: criterion.description
      });
      if (criterion.warning) {
        warnings.push(criterion.description);
      }
    }
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  // Determine grade
  let grade;
  if (score >= 80) grade = 'A';
  else if (score >= 65) grade = 'B';
  else if (score >= 50) grade = 'C';
  else if (score >= 35) grade = 'D';
  else grade = 'F';
  
  return {
    score,
    grade,
    positives,
    negatives,
    warnings,
    
    // Simple status for UI
    status: score >= 50 ? 'ok' : 'needs_improvement',
    color: score >= 70 ? 'green' : score >= 50 ? 'yellow' : 'red'
  };
}

// ============================================
// SCORE TITLE SPECIFICALLY
// ============================================
export function scoreTitleQuality(title) {
  if (!title || typeof title !== 'string') {
    return {
      score: 0,
      issues: [],
      strengths: [],
      status: 'needs_improvement'
    };
  }
  
  let score = 50;
  const issues = [];
  const strengths = [];
  
  // Positive checks
  if (/^(لماذا|كيف|هل)\s+/.test(title)) {
    score += 15;
    strengths.push('يبدأ بسؤال');
  }
  
  if (/\d+/.test(title)) {
    score += 10;
    strengths.push('يحتوي رقم');
  }
  
  if (title.endsWith('؟')) {
    score += 5;
    strengths.push('ينتهي بعلامة استفهام');
  }
  
  if (title.length >= 30 && title.length <= 80) {
    score += 5;
    strengths.push('طول مناسب');
  }
  
  // Negative checks
  if (/(هل تعلم|ما لا تعرفه|الحقائق المخفية)/.test(title)) {
    score -= 20;
    issues.push('يحتوي عبارة AI عامة');
  }
  
  if (/[a-zA-Z]{3,}/.test(title)) {
    score -= 15;
    issues.push('يحتوي كلمات إنجليزية');
  }
  
  if (/\.{3}|…/.test(title)) {
    score -= 10;
    issues.push('يحتوي "..." (clickbait style)');
  }
  
  score = Math.max(0, Math.min(100, score));
  
  return {
    score,
    issues,
    strengths,
    status: score >= 50 ? 'ok' : 'needs_improvement'
  };
}




