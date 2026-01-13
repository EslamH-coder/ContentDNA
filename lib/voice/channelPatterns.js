/**
 * ACTUAL CHANNEL PATTERNS
 * From transcript analysis of top-performing videos
 */

export const HOOK_PATTERNS = {
  // ============================================
  // PATTERN 1: Date Anchor (Most Successful)
  // ============================================
  DATE_ANCHOR: {
    id: 'DATE_ANCHOR',
    name: 'تاريخ + شخصية + حدث',
    views_avg: 2851313,
    
    template: 'في {full_date} {entity_with_title} {action}. {credibility_detail}',
    
    example: 'في 13 فبراير 2025 الرئيس الأمريكي دونالد ترامب استقبل في البيت الأبيض رئيس الوزراء الهندي. المهم بعد ما رحب بيه وأخذه بالحضن...',
    
    requires: {
      full_date: 'في [رقم] [شهر] [سنة]',
      entity_with_title: 'الرئيس/الشركة/الوزير + الاسم',
      action: 'فعل ماضي محدد',
      credibility_detail: 'تفصيلة صغيرة تعطي مصداقية'
    },
    
    validation: (data) => {
      const issues = [];
      if (!/في\s+\d{1,2}\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+\d{4}/.test(data.date)) {
        issues.push('Date must be full: في [day] [month] [year]');
      }
      if (!data.entity_title) {
        issues.push('Entity needs title: الرئيس X, شركة Y');
      }
      return issues;
    }
  },
  
  // ============================================
  // PATTERN 2: Question + Answer (Anti-Clickbait)
  // ============================================
  QUESTION_ANSWER: {
    id: 'QUESTION_ANSWER',
    name: 'سؤال + إجابة فورية',
    views_avg: 2585093,
    
    template: 'هل {direct_question}؟ الإجابة هي {answer}. {explanation}',
    
    example: 'هل أمريكا تقدر تحارب روسيا أو الصين؟ الإجابة هي نعم. أمريكا تقدر. الجيش الأمريكي بوضعه الحالي يقدر يخوض حرب مفتوحة...',
    
    requires: {
      direct_question: 'سؤال واضح يجاوب بنعم/لا',
      answer: 'نعم أو لا (مباشر!)',
      explanation: 'ليه الإجابة كده'
    },
    
    validation: (data) => {
      const issues = [];
      if (!/نعم|لا/.test(data.answer)) {
        issues.push('Answer must be نعم or لا - be direct!');
      }
      if (!data.explanation) {
        issues.push('Need explanation after answer');
      }
      return issues;
    }
  },
  
  // ============================================
  // PATTERN 3: Product + Scale (Big Number)
  // ============================================
  PRODUCT_SCALE: {
    id: 'PRODUCT_SCALE',
    name: 'منتج/شركة + رقم ضخم',
    views_avg: 2688507,
    
    template: '{product} اللي {context}... {connector} قيمتها {big_number}',
    
    example: 'جهاز الآيفون اللي بتنتجه شركة أبل هو المسؤول عن الجزء الأكبر من إيرادات الشركة اللي قيمتها، تحديداً في 1 أبريل 2025، كانت بتقترب من 3.4 تريليون دولار',
    
    requires: {
      product: 'شيء معروف للجمهور',
      context: 'سياق يربط المنتج بالقصة',
      big_number: 'رقم بالتريليون/مليار',
      connector: 'تحديداً / قبل أيام / رسمياً'
    },
    
    validation: (data) => {
      const issues = [];
      if (!/\d+\s*(تريليون|مليار)/.test(data.big_number)) {
        issues.push('Number must be in تريليون or مليار');
      }
      if (!/(تحديداً|قبل أيام|رسمياً)/.test(data.connector || '')) {
        issues.push('Add credibility connector: تحديداً, قبل أيام');
      }
      return issues;
    }
  },
  
  // ============================================
  // PATTERN 4: News + Source (Credibility)
  // ============================================
  NEWS_SOURCE: {
    id: 'NEWS_SOURCE',
    name: 'خبر + مصدر رسمي',
    views_avg: 1809032,
    
    template: 'في {date} {official_source} نشر {surprise_word} {news_description}',
    
    example: 'في 31 أغسطس 2023 نشر التلفزيون الإيراني فجأة تقرير غريب أعلن فيه على لسان الحكومة أنهم نجحوا في اكتشاف...',
    
    requires: {
      date: 'تاريخ كامل',
      official_source: 'مصدر رسمي (تلفزيون، وكالة، وزارة)',
      surprise_word: 'فجأة / بشكل مفاجئ / غريب',
      news_description: 'وصف الخبر'
    }
  }
};

// ============================================
// TITLE PATTERNS (From actual titles)
// ============================================
export const TITLE_PATTERNS = {
  // لماذا + entity + specific action + ?
  WHY_ENTITY: {
    pattern: 'لماذا {entity} {specific_action}؟',
    examples: [
      'لماذا يدعم ترمب المشروع المنافس لقناة السويس؟',
      'لماذا يسحب أكبر صندوق ثروة سيادي أمواله من إسرائيل؟'
    ]
  },
  
  // كيف + entity + mechanism + ?
  HOW_ENTITY: {
    pattern: 'كيف {entity} {mechanism}؟',
    examples: [
      'كيف سيدمر ترمب اقتصاد أمريكا قريباً؟',
      'كيف بنت إيران أكبر ترسانة صواريخ في المنطقة؟',
      'كيف تستطيع أمريكا تفكيك الجيوش الأوروبية؟'
    ]
  },
  
  // هل + question + ? + second question + ?
  DOUBLE_QUESTION: {
    pattern: 'هل {question1}؟ {question2}؟',
    examples: [
      'هل تستطيع أمريكا محاربة الصين وروسيا معاً؟ كيف يحاول ترمب تدبير انقلاب على الصين؟',
      'كيف تعمل بطاقات الائتمان؟ هل تخدع البنوك أصحابها وتورطهم عمداً في الديون؟'
    ]
  }
};

