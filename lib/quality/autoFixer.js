/**
 * AUTO-FIX SYSTEM
 * Instead of rejecting bad output, try to fix it automatically
 */

// ============================================
// REPLACEMENTS (Bad → Good)
// ============================================
const AUTO_REPLACEMENTS = [
  // "هل تعلم" → Direct statement
  {
    pattern: /^هل تعلم أن\s*/i,
    replacement: '',
    note: 'Removed "هل تعلم أن"'
  },
  {
    pattern: /^هل تعرف أن\s*/i,
    replacement: '',
    note: 'Removed "هل تعرف أن"'
  },
  {
    pattern: /^هل تعلم ان\s*/i,
    replacement: '',
    note: 'Removed "هل تعلم ان"'
  },
  
  // "في بلدك" → Specific region
  {
    pattern: /في بلدك/gi,
    replacement: 'في المنطقة العربية',
    note: 'Replaced "في بلدك" with specific region'
  },
  
  // "فاتورتك" → General impact
  {
    pattern: /فاتورتك الشهرية/gi,
    replacement: 'تكاليف المعيشة',
    note: 'Replaced personal "فاتورتك" with general'
  },
  {
    pattern: /فاتورة البنزين في بلدك/gi,
    replacement: 'أسعار الوقود في المنطقة',
    note: 'Replaced personal fuel bill with regional'
  },
  
  // "ميزانيتك الشخصية" → General
  {
    pattern: /ميزانيتك الشخصية/gi,
    replacement: 'الاقتصاد المحلي',
    note: 'Replaced personal budget with general'
  },
  
  // "أسعارك" → "الأسعار"
  {
    pattern: /أسعارك/gi,
    replacement: 'الأسعار',
    note: 'Removed personal "ك" from prices'
  },
  
  // "ما لا تعرفه" → Remove
  {
    pattern: /ما لا تعرفه عن\s*/gi,
    replacement: '',
    note: 'Removed "ما لا تعرفه"'
  },
  
  // "الحقائق المخفية" → Direct
  {
    pattern: /الحقائق المخفية (عن|وراء)\s*/gi,
    replacement: 'حقيقة ',
    note: 'Simplified "الحقائق المخفية"'
  },
  
  // "السر الذي" → Direct
  {
    pattern: /السر الذي\s*/gi,
    replacement: '',
    note: 'Removed "السر الذي"'
  },
  
  // "ومعه خطة" → Remove
  {
    pattern: /\s*ومعه خطة\s*/gi,
    replacement: '',
    note: 'Removed "ومعه خطة"'
  },
  
  // "عائد لـ" → Remove
  {
    pattern: /\s*عائد لـ\s*/gi,
    replacement: '',
    note: 'Removed "عائد لـ"'
  },
  {
    pattern: /\s*عائد إلى\s*/gi,
    replacement: '',
    note: 'Removed "عائد إلى"'
  },
  
  // "اليوم سنتحدث" → Remove
  {
    pattern: /^اليوم سنتحدث\s*/i,
    replacement: '',
    note: 'Removed "اليوم سنتحدث"'
  }
];

// ============================================
// ENHANCEMENTS (Add missing elements)
// ============================================
const ENHANCEMENTS = {
  // Add source if missing
  addSource: (text, newsSource) => {
    if (!text.includes('بحسب') && !text.includes('وفقاً') && !text.includes('حسب') && newsSource) {
      return {
        text: text.replace(/[.،]?\s*$/, `. بحسب ${newsSource}`),
        note: `Added source: ${newsSource}`
      };
    }
    return { text, note: null };
  },
  
  // Add date if missing (use today or news date)
  addDate: (text, newsDate) => {
    const hasDate = /في\s+\d{1,2}\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)/.test(text);
    
    if (!hasDate && newsDate) {
      // Don't add to questions
      if (text.startsWith('هل') || text.startsWith('كيف') || text.startsWith('لماذا')) {
        return { text, note: null };
      }
      return {
        text: `في ${newsDate}، ${text}`,
        note: `Added date: ${newsDate}`
      };
    }
    return { text, note: null };
  },
  
  // Capitalize first letter after fixes
  cleanStart: (text) => {
    // Remove leading spaces and fix capitalization
    let cleaned = text.trim();
    
    // If starts with lowercase after removal, capitalize
    if (cleaned.length > 0) {
      // Arabic doesn't have capitalization, but fix spacing
      cleaned = cleaned.replace(/^\s+/, '');
    }
    
    return { text: cleaned, note: null };
  }
};

// ============================================
// MAIN AUTO-FIX FUNCTION
// ============================================
export function autoFix(content, context = {}) {
  const { newsSource, newsDate, newsTitle } = context;
  
  if (!content || typeof content !== 'string') {
    return {
      original: content,
      fixed: content || '',
      wasFixed: false,
      fixes: [],
      fixCount: 0
    };
  }
  
  let fixed = content;
  const fixes = [];
  
  // Step 1: Apply replacements
  for (const rule of AUTO_REPLACEMENTS) {
    if (rule.pattern.test(fixed)) {
      fixed = fixed.replace(rule.pattern, rule.replacement);
      fixes.push(rule.note);
    }
  }
  
  // Step 2: Apply enhancements
  // Add source
  const sourceResult = ENHANCEMENTS.addSource(fixed, newsSource);
  fixed = sourceResult.text;
  if (sourceResult.note) fixes.push(sourceResult.note);
  
  // Add date (only for hooks, not titles)
  if (context.isHook) {
    const dateResult = ENHANCEMENTS.addDate(fixed, newsDate);
    fixed = dateResult.text;
    if (dateResult.note) fixes.push(dateResult.note);
  }
  
  // Clean start
  const cleanResult = ENHANCEMENTS.cleanStart(fixed);
  fixed = cleanResult.text;
  
  return {
    original: content,
    fixed,
    wasFixed: fixes.length > 0,
    fixes,
    fixCount: fixes.length
  };
}

// ============================================
// AUTO-FIX TITLE SPECIFICALLY
// ============================================
export function autoFixTitle(title, context = {}) {
  if (!title || typeof title !== 'string') {
    return {
      original: title,
      fixed: title || '',
      wasFixed: false,
      fixes: []
    };
  }
  
  let fixed = title;
  const fixes = [];
  
  // Remove English source names from title
  const englishSourcePattern = /\s*-\s*(Al Jazeera|Reuters|Bloomberg|BBC|CNN|AP News|Euronews\.com|The Guardian|Financial Times).*$/i;
  if (englishSourcePattern.test(fixed)) {
    fixed = fixed.replace(englishSourcePattern, '');
    fixes.push('Removed English source from title');
  }
  
  // Remove "ما لا تخبرك به" etc
  const genericPatterns = [
    { pattern: /ما لا تخبرك به\s*/gi, note: 'Removed generic AI phrase' },
    { pattern: /ما لا يريدونك أن تعرفه عن\s*/gi, note: 'Removed generic AI phrase' },
    { pattern: /الحقيقة الصادمة (عن|حول)\s*/gi, replacement: 'حقيقة ', note: 'Simplified generic phrase' }
  ];
  
  for (const { pattern, replacement, note } of genericPatterns) {
    if (pattern.test(fixed)) {
      fixed = fixed.replace(pattern, replacement || '');
      fixes.push(note || 'Removed generic AI phrase from title');
    }
  }
  
  // Ensure ends with ? if it's a question
  if (!fixed.endsWith('؟') && !fixed.endsWith('?')) {
    // If it's a statement, try to make it a question
    if (!fixed.includes('؟') && !fixed.includes('?')) {
      // Add question based on content
      if (fixed.includes('كيف') || fixed.includes('لماذا') || fixed.includes('هل')) {
        fixed = fixed.replace(/[.،]?\s*$/, '؟');
        fixes.push('Added question mark');
      }
    }
  }
  
  return {
    original: title,
    fixed: fixed.trim(),
    wasFixed: fixes.length > 0,
    fixes
  };
}




