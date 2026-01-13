/**
 * TEMPLATE FALLBACK
 * When auto-fix can't save the content, use these templates
 */

// ============================================
// TITLE TEMPLATES
// ============================================
const TITLE_TEMPLATES = [
  // Template 1: لماذا + entity + action
  (data) => `لماذا ${data.entity} ${data.action}؟`,
  
  // Template 2: كيف + entity + action
  (data) => `كيف ${data.entity} ${data.action}؟`,
  
  // Template 3: entity + number + question
  (data) => data.number 
    ? `${data.entity} و${data.number}: ماذا يعني للخليج؟`
    : `${data.entity}: ماذا يعني للخليج؟`,
  
  // Template 4: Simple what happened
  (data) => `ماذا يحدث في ${data.entity}؟`
];

// ============================================
// HOOK TEMPLATES
// ============================================
const HOOK_TEMPLATES = [
  // Template 1: Date + Entity + Action (Best - 2.85M pattern)
  (data) => {
    const date = formatDate(data.date);
    const source = data.source ? `. بحسب ${data.source}` : '';
    return `في ${date} ${data.entityWithTitle || data.entity} ${data.action}${data.number ? ' ' + data.number : ''}${source}`;
  },
  
  // Template 2: Number lead
  (data) => {
    if (!data.number) return null;
    return `${data.number}... هذا الرقم يعني أن ${data.impact || 'الأسواق العربية ستتأثر بشكل مباشر'}. بحسب ${data.source || 'التقارير'}`;
  },
  
  // Template 3: Simple statement
  (data) => {
    const source = data.source ? `. بحسب ${data.source}` : '';
    return `${data.entityWithTitle || data.entity} ${data.action}${data.number ? ' بنسبة ' + data.number : ''}${source}`;
  }
];

const ARABIC_MONTHS = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
  9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر'
};

function formatDate(dateInput) {
  if (!dateInput) {
    const now = new Date();
    return `${now.getDate()} ${ARABIC_MONTHS[now.getMonth() + 1]} ${now.getFullYear()}`;
  }
  
  if (typeof dateInput === 'string') {
    // Check if already formatted
    if (/\d{1,2}\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)/.test(dateInput)) {
      return dateInput;
    }
    
    // Try to parse
    try {
      const date = new Date(dateInput);
      if (!isNaN(date.getTime())) {
        return `${date.getDate()} ${ARABIC_MONTHS[date.getMonth() + 1]} ${date.getFullYear()}`;
      }
    } catch (e) {
      // Ignore
    }
  }
  
  if (dateInput && typeof dateInput === 'object' && dateInput.day && dateInput.month && dateInput.year) {
    return `${dateInput.day} ${ARABIC_MONTHS[dateInput.month]} ${dateInput.year}`;
  }
  
  // Fallback to today
  const now = new Date();
  return `${now.getDate()} ${ARABIC_MONTHS[now.getMonth() + 1]} ${now.getFullYear()}`;
}

// ============================================
// ENTITY TITLES
// ============================================
const ENTITY_TITLES = {
  'trump': 'الرئيس الأمريكي دونالد ترامب',
  'ترامب': 'الرئيس الأمريكي دونالد ترامب',
  'ترمب': 'الرئيس الأمريكي دونالد ترامب',
  'apple': 'شركة أبل',
  'أبل': 'شركة أبل',
  'iran': 'إيران',
  'إيران': 'إيران',
  'ايران': 'إيران',
  'china': 'الصين',
  'الصين': 'الصين',
  'gold': 'الذهب',
  'الذهب': 'الذهب',
  'oil': 'النفط',
  'النفط': 'النفط',
  'federal reserve': 'البنك الفيدرالي الأمريكي',
  'الفيدرالي': 'البنك الفيدرالي الأمريكي'
};

function getEntityWithTitle(entity) {
  if (!entity) return null;
  const normalized = entity.toLowerCase().trim();
  return ENTITY_TITLES[normalized] || entity;
}

// ============================================
// GENERATE FALLBACK
// ============================================
export function generateFallbackTitle(extractedData) {
  const data = {
    entity: extractedData.entity || extractedData.entity_title || 'الخبر',
    action: extractedData.action || '',
    number: extractedData.number || null
  };
  
  // Try each template until one works
  for (const template of TITLE_TEMPLATES) {
    try {
      const result = template(data);
      if (result && result.length > 10) {
        return {
          title: result,
          source: 'fallback_template',
          templateIndex: TITLE_TEMPLATES.indexOf(template)
        };
      }
    } catch (e) {
      continue;
    }
  }
  
  // Last resort
  return {
    title: `أخبار ${data.entity}: آخر التطورات`,
    source: 'fallback_default'
  };
}

export function generateFallbackHook(extractedData, newsItem = {}) {
  const data = {
    entity: extractedData.entity || extractedData.entity_title || 'الخبر',
    entityWithTitle: getEntityWithTitle(extractedData.entity || extractedData.entity_title),
    action: extractedData.action || 'يعلن',
    number: extractedData.number,
    date: extractedData.date || newsItem.date || newsItem.dateInfo?.formattedDate,
    source: newsItem.source || newsItem.sourceName,
    impact: extractedData.impact
  };
  
  // Try each template
  for (const template of HOOK_TEMPLATES) {
    try {
      const result = template(data);
      if (result && result.length > 20) {
        return {
          hook: result,
          source: 'fallback_template',
          templateIndex: HOOK_TEMPLATES.indexOf(template)
        };
      }
    } catch (e) {
      continue;
    }
  }
  
  // Last resort
  return {
    hook: `${data.entityWithTitle || data.entity} ${data.action}. تابعوا التفاصيل...`,
    source: 'fallback_default'
  };
}




