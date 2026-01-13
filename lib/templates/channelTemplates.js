/**
 * CHANNEL DNA TEMPLATES
 * From actual successful videos - DO NOT MODIFY
 * Source: Transcript analysis of top-performing videos
 */

// ============================================
// TITLE TEMPLATES (From actual channel titles)
// ============================================
export const TITLE_TEMPLATES = {
  // Pattern 1: WHY + ENTITY + ACTION (Most common, highest views)
  // Example: "لماذا يدعم ترمب المشروع المنافس لقناة السويس؟"
  WHY_ENTITY: {
    id: 'WHY_ENTITY',
    template: 'لماذا {entity} {action}؟',
    views_avg: 2851313,
    requires: ['entity', 'action'],
    examples: [
      'لماذا يدعم ترمب المشروع المنافس لقناة السويس؟',
      'لماذا يسحب أكبر صندوق ثروة سيادي أمواله من إسرائيل؟'
    ]
  },

  // Pattern 2: HOW + ENTITY + MECHANISM
  // Example: "كيف سيدمر ترمب اقتصاد أمريكا قريباً؟"
  HOW_ENTITY: {
    id: 'HOW_ENTITY',
    template: 'كيف {entity} {mechanism}؟',
    views_avg: 2688507,
    requires: ['entity', 'mechanism'],
    examples: [
      'كيف سيدمر ترمب اقتصاد أمريكا قريباً؟',
      'كيف بنت إيران أكبر ترسانة صواريخ في المنطقة؟',
      'كيف تستطيع أمريكا تفكيك الجيوش الأوروبية عبر الأقمار الصناعية؟'
    ]
  },

  // Pattern 3: QUESTION + QUESTION (Double hook)
  // Example: "هل تستطيع أمريكا محاربة الصين وروسيا معاً؟"
  DOUBLE_QUESTION: {
    id: 'DOUBLE_QUESTION',
    template: 'هل {question1}؟ {question2}؟',
    views_avg: 2585093,
    requires: ['question1', 'question2'],
    examples: [
      'هل تستطيع أمريكا محاربة الصين وروسيا معاً؟ كيف يحاول ترمب تدبير انقلاب على الصين؟',
      'كيف تعمل بطاقات الائتمان؟ هل تخدع البنوك أصحابها وتورطهم عمداً في الديون؟'
    ]
  },

  // Pattern 4: ENTITY + NUMBER + CONTEXT
  // Example: "أبل تخسر 115 مليون دولار: ماذا حدث؟"
  ENTITY_NUMBER: {
    id: 'ENTITY_NUMBER',
    template: '{entity} {action} {number}: {question}',
    views_avg: 1809032,
    requires: ['entity', 'action', 'number'],
    examples: [
      'أبل تدفع غرامة 115 مليون دولار: لماذا؟',
      'ترامب يرفع الرسوم 60%: ماذا يعني للخليج؟'
    ]
  }
};

// ============================================
// HOOK TEMPLATES (From actual video transcripts)
// ============================================
export const HOOK_TEMPLATES = {
  // Pattern 1: DATE + ENTITY + ACTION (Best performer - 2.85M views)
  // "في 13 فبراير 2025 الرئيس الأمريكي دونالد ترامب استقبل..."
  DATE_ENTITY_ACTION: {
    id: 'DATE_ENTITY_ACTION',
    template: 'في {date} {entity_with_title} {action}. {detail}',
    views_avg: 2851313,
    retention_30s: 76,
    requires: ['date', 'entity_with_title', 'action'],
    example: 'في 13 فبراير 2025 الرئيس الأمريكي دونالد ترامب استقبل في البيت الأبيض رئيس الوزراء الهندي ناريندرا مودي. المهم بعد ما رحب بيه...'
  },

  // Pattern 2: QUESTION + IMMEDIATE ANSWER (2.59M views)
  // "هل أمريكا تقدر تحارب روسيا؟ الإجابة هي نعم."
  QUESTION_ANSWER: {
    id: 'QUESTION_ANSWER',
    template: 'هل {question}؟ الإجابة هي {answer}. {explanation}',
    views_avg: 2585093,
    retention_30s: 75,
    requires: ['question', 'answer', 'explanation'],
    example: 'هل أمريكا تقدر تحارب روسيا أو الصين؟ الإجابة هي نعم. أمريكا تقدر. الجيش الأمريكي بوضعه الحالي يقدر يخوض حرب مفتوحة...'
  },

  // Pattern 3: PRODUCT + BIG NUMBER (2.69M views)
  // "جهاز الآيفون... الشركة اللي قيمتها 3.4 تريليون دولار"
  PRODUCT_NUMBER: {
    id: 'PRODUCT_NUMBER',
    template: '{product} اللي {context}... {entity} اللي قيمتها {number}',
    views_avg: 2688507,
    retention_30s: 74,
    requires: ['product', 'entity', 'number'],
    example: 'جهاز الآيفون اللي بتنتجه شركة أبل هو المسؤول عن الجزء الأكبر من إيرادات الشركة اللي قيمتها 3.4 تريليون دولار...'
  },

  // Pattern 4: NEWS + SOURCE (1.81M views)
  // "في 31 أغسطس 2023 نشر التلفزيون الإيراني فجأة تقرير غريب..."
  NEWS_SOURCE: {
    id: 'NEWS_SOURCE',
    template: 'في {date} {source} نشر {surprise} {news}',
    views_avg: 1809032,
    retention_30s: 72,
    requires: ['date', 'source', 'news'],
    example: 'في 31 أغسطس 2023 نشر التلفزيون الإيراني فجأة تقرير غريب أعلن فيه على لسان الحكومة...'
  },

  // Pattern 5: NUMBER + IMPACT (For economic news)
  NUMBER_IMPACT: {
    id: 'NUMBER_IMPACT',
    template: '{number}... هذا الرقم يعني أن {impact}',
    views_avg: 1500000,
    retention_30s: 73,
    requires: ['number', 'impact'],
    example: '60% رسوم جمركية... هذا الرقم يعني أن أسعار الإلكترونيات في الخليج سترتفع 25%'
  }
};

// ============================================
// ENTITY TITLES (How the channel refers to entities)
// ============================================
export const ENTITY_TITLES = {
  'trump': 'الرئيس الأمريكي دونالد ترامب',
  'ترامب': 'الرئيس الأمريكي دونالد ترامب',
  'ترمب': 'الرئيس الأمريكي دونالد ترامب',
  'biden': 'الرئيس الأمريكي جو بايدن',
  'بايدن': 'الرئيس الأمريكي جو بايدن',
  'apple': 'شركة أبل الأمريكية',
  'أبل': 'شركة أبل الأمريكية',
  'ابل': 'شركة أبل الأمريكية',
  'microsoft': 'شركة مايكروسوفت',
  'مايكروسوفت': 'شركة مايكروسوفت',
  'tesla': 'شركة تسلا',
  'تسلا': 'شركة تسلا',
  'musk': 'إيلون ماسك',
  'ماسك': 'إيلون ماسك',
  'china': 'الصين',
  'الصين': 'الصين',
  'iran': 'إيران',
  'إيران': 'إيران',
  'ايران': 'إيران',
  'usa': 'أمريكا',
  'america': 'أمريكا',
  'أمريكا': 'أمريكا',
  'امريكا': 'أمريكا',
  'russia': 'روسيا',
  'روسيا': 'روسيا',
  'saudi': 'السعودية',
  'السعودية': 'السعودية',
  'uae': 'الإمارات',
  'الإمارات': 'الإمارات',
  'الامارات': 'الإمارات',
  'egypt': 'مصر',
  'مصر': 'مصر'
};

// ============================================
// ARAB REGION IMPACTS (For regional relevance)
// ============================================
export const ARAB_IMPACTS = {
  'tariffs': 'أسعار الإلكترونيات والملابس في أسواق الخليج',
  'trade_war': 'الاستثمارات الخليجية في أمريكا والصين',
  'oil': 'إيرادات النفط الخليجية',
  'tech': 'الوظائف التقنية في الخليج',
  'military': 'الأمن الإقليمي في الخليج',
  'currency': 'قيمة العملات المرتبطة بالدولار',
  'inflation': 'أسعار السلع في الأسواق العربية',
  'default': 'المنطقة العربية'
};

// ============================================
// MONTHS IN ARABIC
// ============================================
export const ARABIC_MONTHS = {
  1: 'يناير',
  2: 'فبراير',
  3: 'مارس',
  4: 'أبريل',
  5: 'مايو',
  6: 'يونيو',
  7: 'يوليو',
  8: 'أغسطس',
  9: 'سبتمبر',
  10: 'أكتوبر',
  11: 'نوفمبر',
  12: 'ديسمبر'
};




