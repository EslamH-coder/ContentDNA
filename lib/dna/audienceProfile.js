/**
 * AUDIENCE PROFILE - المخبر الاقتصادي+
 * Based on Real YouTube Analytics Data (72 videos analyzed)
 */

export const AUDIENCE_DNA = {
  // ============================================
  // DEMOGRAPHICS
  // ============================================
  demographics: {
    gender: {
      male: 94.43,      // Retention: 51%
      female: 5.56,     // Retention: 45%
      dominant: 'male'
    },
    
    top_countries: [
      { code: 'EG', name: 'مصر', views: 13240962, percentage: 21.6 },
      { code: 'SA', name: 'السعودية', views: 9287808, percentage: 15.1 },
      { code: 'MA', name: 'المغرب', views: 5975746, percentage: 9.7 },
      { code: 'DZ', name: 'الجزائر', views: 5079386, percentage: 8.3 },
      { code: 'US', name: 'أمريكا', views: 2525187, percentage: 4.1 },
      { code: 'DE', name: 'ألمانيا', views: 2478160, percentage: 4.0 },
      { code: 'IQ', name: 'العراق', views: 2066325, percentage: 3.4 },
      { code: 'AE', name: 'الإمارات', views: 2024133, percentage: 3.3 },
      { code: 'JO', name: 'الأردن', views: 1882504, percentage: 3.1 },
      { code: 'TN', name: 'تونس', views: 1705112, percentage: 2.8 }
    ],
    
    device: {
      mobile: 68.9,     // Primary device
      tv: 15.5,
      computer: 12.5,
      tablet: 3.1,
      primary: 'mobile'
    },
    
    discovery: {
      browse: 46.3,     // Home/Subscriptions
      suggested: 37.8,  // YouTube recommendations
      search: 2.5,       // Very low!
      direct: 2.5,
      channel_pages: 1.8,
      shorts_feed: 1.7,
      primary: 'browse_suggested' // 84% combined
    }
  },
  
  // ============================================
  // CONTENT PERFORMANCE
  // ============================================
  content_performance: {
    // Question types (by average views)
    question_types: {
      'هل': { avg_views: 1035486, videos: 26, total_views: 26922646, rank: 1 },
      'كيف': { avg_views: 966485, videos: 35, total_views: 33826985, rank: 2 },
      'لماذا': { avg_views: 936724, videos: 29, total_views: 27164985, rank: 3 }
    },
    
    // Top entities (by average views)
    entities: {
      'ترمب': { avg_views: 1291322, videos: 20, total_views: 25826444, rank: 1 },
      'الصين': { avg_views: 1167757, videos: 20, total_views: 23355137, rank: 2 },
      'أمريكا': { avg_views: 950825, videos: 28, total_views: 26623108, rank: 3 },
      'روسيا': { avg_views: 934553, videos: 9, total_views: 8410975, rank: 4 },
      'إيران': { avg_views: 917274, videos: 6, total_views: 5503641, rank: 5 }
    },
    
    // Winning topics
    winning_topics: [
      'ترمب',
      'الصين',
      'أمريكا',
      'روسيا',
      'إيران'
    ],
    
    // Channel averages
    channel_averages: {
      retention: 50.53,
      ctr: 5.59,
      avg_views: 888958, // 64M / 72 videos
      watch_hours: 12018320,
      subscribers_gained: 109859
    }
  },
  
  // ============================================
  // WINNING FORMULAS
  // ============================================
  winning_formulas: {
    // Best title pattern
    title_pattern: '[هل/كيف/لماذا] + [ترمب/أمريكا/الصين] + [conflict/action]',
    
    // Examples of top performers
    top_examples: [
      {
        views: 2851450,
        retention: 52.5,
        ctr: 2.7,
        title_pattern: 'لماذا + ترمب + مصر (قناة السويس)',
        formula: 'لماذا + entity + arab_connection'
      },
      {
        views: 2693831,
        retention: 48.2,
        ctr: 4.7,
        title_pattern: 'كيف + ترمب + أمريكا + الصين',
        formula: 'كيف + entity + conflict'
      },
      {
        views: 2587519,
        retention: 50.2,
        ctr: 4.8,
        title_pattern: 'هل + أمريكا + الصين + روسيا',
        formula: 'هل + multiple_entities + conflict'
      }
    ],
    
    // The perfect video formula
    perfect_video: {
      topic: 'ترمب/أمريكا/الصين + conflict',
      title: 'هل + [bold question]?',
      hook: 'Context → Conflict → Stakes for Arabs',
      length: '20-25 minutes',
      target: 'مصري/سعودي، رجل، على الجوال'
    }
  },
  
  // ============================================
  // AUDIENCE PERSONA
  // ============================================
  persona: {
    name: 'المتابع العربي الفضولي',
    profile: {
      gender: 'male', // 94%
      location: 'مصر أو السعودية أو المغرب',
      device: 'mobile', // 69%
      behavior: 'subscriber_loyal' // 46% from Browse
    },
    interests: [
      'السياسة الدولية (أمريكا، ترمب، الصين)',
      'الصراعات الجيوسياسية',
      'كيف تؤثر الأحداث العالمية على المنطقة العربية',
      'فهم ما يحدث في العالم'
    ],
    questions: [
      'هل أمريكا تقدر تعمل كذا؟',
      'كيف هذا سيأثر علينا؟',
      'لماذا ترمب يعمل كذا؟'
    ],
    behavior_patterns: [
      'يفتح YouTube ويشوف الـ Home',
      'لا يبحث كثيراً - يكتشف',
      'يكمل 50% من الفيديو (جيد!)',
      'يشترك إذا أعجبه المحتوى'
    ]
  },
  
  // ============================================
  // CONTENT RULES
  // ============================================
  content_rules: {
    do: [
      'استخدم "هل" للأسئلة (أعلى views)',
      'اذكر "ترمب" (1.29M avg!)',
      'اربط بالصراع أمريكا-الصين',
      'اجعل العنوان واضح على الجوال',
      'ركز على مصر والسعودية في الأمثلة',
      'استهدف retention 50%+',
      'استهدف CTR 5%+'
    ],
    dont: [
      'لا تتوقع الناس يبحثون (2.5% فقط)',
      'لا تستخدم مواضيع محلية جداً (ceiling)',
      'لا تنسى الـ Suggested Videos (38% من traffic)',
      'لا تستهدف النساء (5% فقط)',
      'لا تتجاهل الجوال (69% من المشاهدات)'
    ]
  },
  
  // ============================================
  // KEY INSIGHTS
  // ============================================
  insights: {
    // Geographic insights
    geographic: {
      egypt_saudi: '37% من المشاهدات (مصر + السعودية)',
      north_africa: '21% من المشاهدات (المغرب + الجزائر + تونس)',
      diaspora: '8% من المشاهدات (أمريكا + ألمانيا)'
    },
    
    // Discovery insights
    discovery: {
      browse_dominant: '46% من Browse = المشتركين المخلصين',
      suggested_important: '38% من Suggested = YouTube يوصي',
      search_irrelevant: '2.5% من Search = الناس لا يبحثون'
    },
    
    // Content insights
    content: {
      question_performance: 'هل > كيف > لماذا (by views)',
      entity_performance: 'ترمب > الصين > أمريكا (by views)',
      ctr_vs_views: 'High CTR (7-9%) ≠ Always high views',
      best_ctr_range: '4-6% CTR with broad appeal = best',
      high_ctr_warning: 'Very high CTR might mean niche topic (ceiling)'
    }
  },
  
  // ============================================
  // TARGET METRICS
  // ============================================
  target_metrics: {
    retention: 50,      // Channel average
    ctr: 5,             // Channel average
    avg_views: 900000,  // Target per video
    watch_hours: 166920, // Target per video (12M / 72)
    subscribers_per_video: 1526 // Target (109K / 72)
  }
};

/**
 * Get audience context for LLM prompts
 */
export function getAudienceContext() {
  return `
# AUDIENCE PROFILE - المخبر الاقتصادي+

## من هم الجمهور؟
- رجال (94%) - المحتوى يخاطب عقلية الرجل العربي
- من مصر (22%) أو السعودية (15%) أو المغرب (10%)
- يشاهدون على الجوال (69%)
- مشتركين مخلصين (46% من Browse) + YouTube يوصي (38% من Suggested)

## ما الذي ينجح؟
### أفضل أنواع الأسئلة (بالترتيب):
1. **هل** → 1,035,486 avg views ← الأفضل!
2. **كيف** → 966,485 avg views
3. **لماذا** → 936,724 avg views

### أفضل الكيانات (بالترتيب):
1. **ترمب** → 1,291,322 avg views ← الأفضل!
2. **الصين** → 1,167,757 avg views
3. **أمريكا** → 950,825 avg views
4. **روسيا** → 934,553 avg views
5. **إيران** → 917,274 avg views

## الصيغة الفائزة:
\`\`\`
[هل/كيف/لماذا] + [ترمب/أمريكا/الصين] + [conflict/action]
\`\`\`

## أمثلة من أفضل الفيديوهات:
- "لماذا + ترمب + مصر (قناة السويس)" → 2.85M views
- "كيف + ترمب + أمريكا + الصين" → 2.69M views
- "هل + أمريكا + الصين + روسيا" → 2.59M views

## ما يريده الجمهور:
- "اشرحلي إيه اللي بيحصل في العالم"
- "هل ده هيأثر علينا؟"
- "مين هيكسب؟ أمريكا ولا الصين؟"

## قواعد المحتوى:
✅ استخدم "هل" للأسئلة
✅ اذكر "ترمب" أو "أمريكا" أو "الصين"
✅ اربط بالصراع أمريكا-الصين
✅ اجعل العنوان واضح على الجوال
✅ ركز على مصر والسعودية في الأمثلة

❌ لا تتوقع الناس يبحثون (2.5% فقط)
❌ لا تستخدم مواضيع محلية جداً (ceiling)
❌ لا تنسى الـ Suggested Videos (38% من traffic)
`;
}

/**
 * Score content against audience preferences
 */
export function scoreForAudience(title, hook, topic) {
  let score = 0;
  const reasons = [];
  
  // Check question type
  if (title.includes('هل')) {
    score += 30;
    reasons.push('يستخدم "هل" (أعلى views)');
  } else if (title.includes('كيف')) {
    score += 25;
    reasons.push('يستخدم "كيف" (جيد)');
  } else if (title.includes('لماذا')) {
    score += 20;
    reasons.push('يستخدم "لماذا" (جيد)');
  }
  
  // Check entities
  if (title.includes('ترمب') || hook.includes('ترمب')) {
    score += 30;
    reasons.push('يذكر "ترمب" (1.29M avg views)');
  }
  if (title.includes('الصين') || hook.includes('الصين')) {
    score += 25;
    reasons.push('يذكر "الصين" (1.17M avg views)');
  }
  if (title.includes('أمريكا') || hook.includes('أمريكا')) {
    score += 20;
    reasons.push('يذكر "أمريكا" (950K avg views)');
  }
  
  // Check Arab connection
  if (title.includes('مصر') || title.includes('السعودية') || 
      hook.includes('مصر') || hook.includes('السعودية')) {
    score += 15;
    reasons.push('يربط بمصر أو السعودية (37% من الجمهور)');
  }
  
  // Check conflict/action
  if (title.includes('صراع') || title.includes('حرب') || 
      title.includes('مواجهة') || title.includes('تحدي')) {
    score += 10;
    reasons.push('يذكر صراع/مواجهة (مهم للجمهور)');
  }
  
  return {
    score: Math.min(100, score),
    reasons,
    audience_fit: score >= 50 ? 'high' : score >= 30 ? 'medium' : 'low'
  };
}




