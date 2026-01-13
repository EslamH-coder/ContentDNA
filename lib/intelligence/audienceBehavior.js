/**
 * AUDIENCE BEHAVIOR INTELLIGENCE
 * Understanding WHY the audience cares, not just WHAT they search
 */

// ============================================================
// DEEP INTEREST CLUSTERS
// Based on actual audience behavior analysis
// ============================================================

export const INTEREST_CLUSTERS = {
  
  // ─────────────────────────────────────────────────────────
  // 1. صراع القوى الكبرى
  // ─────────────────────────────────────────────────────────
  power_struggle: {
    id: 'power_struggle',
    name: 'صراع القوى الكبرى',
    nameEn: 'Global Power Struggle',
    icon: '🌍',
    color: 'red',
    weight: 1.0, // Highest engagement
    
    // What drives this interest?
    psychology: {
      deepQuestion: 'من سيسيطر على العالم؟ وكيف يؤثر هذا على منطقتنا؟',
      fear: 'الخوف من تغيرات جيوسياسية تؤثر على الاستقرار',
      desire: 'فهم موازين القوى لاتخاذ قرارات أفضل',
      actionTrigger: 'أخبار عن صراعات أو تحالفات جديدة'
    },
    
    // Keywords that indicate this interest
    keywords: {
      countries: ['الصين', 'أمريكا', 'امريكا', 'روسيا', 'إيران', 'ايران', 'china', 'usa', 'russia', 'iran'],
      leaders: ['ترامب', 'ترمب', 'بوتين', 'شي جين بينغ', 'trump', 'putin', 'xi'],
      concepts: ['حرب', 'عقوبات', 'تحالف', 'صراع', 'هيمنة', 'نفوذ', 'war', 'sanctions', 'alliance'],
      organizations: ['الناتو', 'بريكس', 'nato', 'brics', 'g7', 'g20']
    },
    
    // Behavioral patterns that show this interest
    patterns: [
      'صراع نفوذ بين قوتين',
      'تحالفات جديدة',
      'عقوبات اقتصادية',
      'حرب تجارية',
      'سباق تسلح',
      'توسع جغرافي'
    ],
    
    // Evidence from data
    evidence: {
      searchVolume: 35000,
      avgWatchTime: '9:30',
      topSearches: ['الصين وامريكا', 'حرب ترامب', 'روسيا وأوكرانيا', 'إيران وإسرائيل']
    },
    
    // How to pitch to this audience
    pitchGuidance: {
      angleTypes: ['من سيفوز؟', 'ماذا يعني لنا؟', 'السيناريوهات المحتملة'],
      avoidAngles: ['تحليل سطحي', 'أخبار بدون تحليل'],
      hookStyle: 'سؤال استفزازي عن موازين القوى'
    }
  },

  // ─────────────────────────────────────────────────────────
  // 2. حماية الأموال والاستثمار
  // ─────────────────────────────────────────────────────────
  money_protection: {
    id: 'money_protection',
    name: 'حماية الأموال والاستثمار',
    nameEn: 'Money Protection & Investment',
    icon: '💰',
    color: 'green',
    weight: 0.95,
    
    psychology: {
      deepQuestion: 'كيف أحمي فلوسي من التضخم والأزمات؟ أين أستثمر؟',
      fear: 'الخوف من خسارة المدخرات أو فقدان قيمتها',
      desire: 'بناء ثروة وتأمين المستقبل',
      actionTrigger: 'أخبار عن تغيرات في أسعار الذهب/الدولار/العقارات'
    },
    
    keywords: {
      assets: ['الذهب', 'الدولار', 'العقارات', 'الأسهم', 'البيتكوين', 'gold', 'dollar', 'stocks', 'bitcoin', 'crypto'],
      concepts: ['استثمار', 'ادخار', 'تضخم', 'فائدة', 'محفظة', 'investment', 'savings', 'inflation'],
      actions: ['شراء', 'بيع', 'تحويل', 'تنويع'],
      concerns: ['خسارة', 'ربح', 'عائد', 'مخاطر', 'أمان']
    },
    
    patterns: [
      'ارتفاع/انخفاض أسعار',
      'فرصة استثمارية',
      'تحذير من فقاعة',
      'مقارنة بين أصول',
      'نصائح مالية'
    ],
    
    evidence: {
      searchVolume: 28000,
      avgWatchTime: '11:45',
      topSearches: ['الذهب', 'الدولار هيطلع ولا ينزل', 'أفضل استثمار', 'التضخم']
    },
    
    pitchGuidance: {
      angleTypes: ['هل الوقت مناسب للشراء؟', 'كيف تحمي نفسك؟', 'الفرصة vs المخاطرة'],
      avoidAngles: ['نصائح مباشرة بدون تحليل', 'وعود بأرباح'],
      hookStyle: 'سؤال عن قرار مالي يواجهه المشاهد'
    }
  },

  // ─────────────────────────────────────────────────────────
  // 3. تأثير على الحياة اليومية
  // ─────────────────────────────────────────────────────────
  daily_life_impact: {
    id: 'daily_life_impact',
    name: 'تأثير على الحياة اليومية',
    nameEn: 'Daily Life Impact',
    icon: '🛒',
    color: 'orange',
    weight: 0.95,
    
    psychology: {
      deepQuestion: 'كيف يؤثر هذا على فاتورتي الشهرية وقراراتي اليومية؟',
      fear: 'ارتفاع الأسعار وتآكل القدرة الشرائية',
      desire: 'فهم ما يحدث لاتخاذ قرارات شراء أذكى',
      actionTrigger: 'أخبار عن أسعار البنزين، الغذاء، الكهرباء'
    },
    
    keywords: {
      prices: ['أسعار', 'بنزين', 'كهرباء', 'غاز', 'غذاء', 'سلع', 'prices', 'fuel', 'electricity', 'food'],
      daily: ['فاتورة', 'راتب', 'معيشة', 'مصاريف', 'ميزانية'],
      changes: ['ارتفاع', 'انخفاض', 'زيادة', 'تغيير', 'جديد'],
      policies: ['دعم', 'ضرائب', 'رسوم', 'قرار حكومي']
    },
    
    patterns: [
      'قرار يؤثر على الأسعار',
      'تغيير في الدعم الحكومي',
      'أزمة إمدادات',
      'موسم يؤثر على الأسعار'
    ],
    
    evidence: {
      searchVolume: 22000,
      avgWatchTime: '8:30',
      topSearches: ['أسعار البنزين', 'سعر الدولار اليوم', 'غلاء المعيشة', 'رسوم جديدة']
    },
    
    pitchGuidance: {
      angleTypes: ['كم ستدفع أكثر؟', 'كيف توفر؟', 'متى يتغير؟'],
      avoidAngles: ['أرقام بدون ترجمة عملية'],
      hookStyle: 'ربط مباشر بالحياة اليومية للمشاهد'
    }
  },

  // ─────────────────────────────────────────────────────────
  // 4. قصص النجاح ورواد الأعمال
  // ─────────────────────────────────────────────────────────
  success_stories: {
    id: 'success_stories',
    name: 'قصص النجاح ورواد الأعمال',
    nameEn: 'Success Stories & Entrepreneurs',
    icon: '📈',
    color: 'purple',
    weight: 0.85,
    
    psychology: {
      deepQuestion: 'كيف نجح هؤلاء؟ وما الدروس التي يمكنني تطبيقها؟',
      fear: 'الفشل أو عدم استغلال الفرص',
      desire: 'الإلهام والتعلم من تجارب الآخرين',
      actionTrigger: 'قصة نجاح ملهمة أو درس من فشل'
    },
    
    keywords: {
      people: ['إيلون ماسك', 'ماسك', 'بيزوس', 'بافيت', 'musk', 'bezos', 'buffett', 'رائد أعمال', 'مليونير', 'ملياردير'],
      journey: ['من الصفر', 'قصة نجاح', 'كيف بدأ', 'سر نجاح', 'رحلة'],
      outcomes: ['ثروة', 'إمبراطورية', 'شركة', 'مليار', 'نجاح', 'فشل'],
      lessons: ['درس', 'حكمة', 'استراتيجية', 'خطأ', 'تعلم']
    },
    
    patterns: [
      'من الصفر إلى المليار',
      'كيف بنى إمبراطوريته',
      'الخطأ الذي كلفه الملايين',
      'سر نجاحه الحقيقي',
      'ماذا لو لم يفعل كذا'
    ],
    
    evidence: {
      searchVolume: 15000,
      avgWatchTime: '14:20',
      topSearches: ['قصة إيلون ماسك', 'كيف أصبح غنياً', 'أغنى رجل', 'من الفقر للغنى']
    },
    
    pitchGuidance: {
      angleTypes: ['السر الذي لا يخبرك به أحد', 'الخطأ الذي تجنبه', 'ماذا لو؟'],
      avoidAngles: ['سرد سطحي للأحداث', 'تمجيد بدون تحليل'],
      hookStyle: 'حقيقة مفاجئة عن الشخص أو رحلته'
    }
  },

  // ─────────────────────────────────────────────────────────
  // 5. التكنولوجيا والمستقبل
  // ─────────────────────────────────────────────────────────
  tech_future: {
    id: 'tech_future',
    name: 'التكنولوجيا والمستقبل',
    nameEn: 'Technology & Future',
    icon: '🤖',
    color: 'blue',
    weight: 0.90,
    
    psychology: {
      deepQuestion: 'كيف ستغير التكنولوجيا حياتي ووظيفتي؟ من سيفوز في سباق AI؟',
      fear: 'التخلف عن الركب أو فقدان الوظيفة أو دفع أسعار أعلى',
      desire: 'فهم المستقبل والاستعداد له + معرفة من يقدم أفضل سعر/أداء',
      actionTrigger: 'تطور تقني جديد أو تحول في صناعة أو منافسة بين شركات AI'
    },
    
    keywords: {
      tech: ['ذكاء اصطناعي', 'AI', 'روبوت', 'أتمتة', 'chatgpt', 'جي بي تي', 'deepseek', 'deep seek', 'artificial intelligence', 'machine learning'],
      companies: ['تسلا', 'آبل', 'جوجل', 'مايكروسوفت', 'أوبن أيه آي', 'نفيديا', 'deepseek', 'tesla', 'apple', 'google', 'nvidia', 'openai', 'anthropic', 'claude'],
      concepts: ['مستقبل', 'ثورة', 'تحول', 'اختراع', 'ابتكار', 'نموذج', 'model', 'LLM', 'large language model'],
      impact: ['وظائف', 'صناعات', 'تعليم', 'طب', 'منافسة', 'competition', 'سعر', 'price', 'أرخص', 'cheaper']
    },
    
    patterns: [
      'تقنية جديدة تغير صناعة',
      'AI يهدد وظائف',
      'شركة تقنية تتفوق',
      'سباق تقني بين الكبار',
      'تطبيق جديد للتقنية',
      'deepseek',
      'نموذج جديد',
      'منافسة AI',
      'أرخص من',
      'cheaper than',
      'AI competition',
      'منافسة الذكاء الاصطناعي'
    ],
    
    evidence: {
      searchVolume: 18000,
      avgWatchTime: '10:15',
      topSearches: ['الذكاء الاصطناعي', 'ChatGPT', 'هل AI سيأخذ وظيفتي', 'تسلا روبوتاكسي']
    },
    
    pitchGuidance: {
      angleTypes: ['هل ستخسر وظيفتك؟', 'كيف تستفيد؟', 'ماذا يعني هذا لمستقبلك؟', 'من سيفوز في سباق AI؟', 'كيف تؤثر المنافسة على الأسعار؟'],
      avoidAngles: ['شرح تقني معقد', 'أخبار بدون تحليل الأثر', 'تركيز على الميزانية فقط بدون سياق تقني'],
      hookStyle: 'ربط التقنية بحياة المشاهد مباشرة أو سؤال عن منافسة AI'
    }
  },

  // ─────────────────────────────────────────────────────────
  // 6. الأزمات والفرص
  // ─────────────────────────────────────────────────────────
  crisis_opportunity: {
    id: 'crisis_opportunity',
    name: 'الأزمات والفرص',
    nameEn: 'Crises & Opportunities',
    icon: '⚠️',
    color: 'yellow',
    weight: 0.90,
    
    psychology: {
      deepQuestion: 'كيف أستفيد من الأزمة بدل أن أكون ضحيتها؟',
      fear: 'الخسارة في وقت الأزمات',
      desire: 'إيجاد الفرصة في كل أزمة',
      actionTrigger: 'أزمة اقتصادية أو سياسية تخلق فرصاً'
    },
    
    keywords: {
      crisis: ['أزمة', 'انهيار', 'إفلاس', 'كارثة', 'ركود', 'crisis', 'collapse', 'bankruptcy', 'recession'],
      opportunity: ['فرصة', 'استثمار', 'شراء', 'وقت مناسب'],
      examples: ['2008', 'كورونا', 'covid', 'حرب', 'عقوبات']
    },
    
    patterns: [
      'شركة تنهار = فرصة شراء؟',
      'أزمة تخلق أغنياء جدد',
      'من استفاد من الأزمة',
      'دروس من انهيارات سابقة'
    ],
    
    evidence: {
      searchVolume: 12000,
      avgWatchTime: '13:00',
      topSearches: ['أزمة 2008', 'فرص الركود', 'متى أشتري', 'انهيار البنوك']
    },
    
    pitchGuidance: {
      angleTypes: ['فرصة أم فخ؟', 'من سيستفيد؟', 'التاريخ يعيد نفسه؟'],
      avoidAngles: ['تخويف بدون حلول', 'وعود كاذبة'],
      hookStyle: 'مقارنة بأزمة سابقة أو فرصة ضائعة'
    }
  },

  // ─────────────────────────────────────────────────────────
  // 7. الشأن العربي والإقليمي
  // ─────────────────────────────────────────────────────────
  arab_regional: {
    id: 'arab_regional',
    name: 'الشأن العربي والإقليمي',
    nameEn: 'Arab & Regional Affairs',
    icon: '🏛️',
    color: 'teal',
    weight: 0.85,
    
    psychology: {
      deepQuestion: 'ماذا يحدث في منطقتنا؟ وكيف يؤثر على بلدي؟',
      fear: 'عدم الاستقرار الإقليمي',
      desire: 'فهم التطورات في المنطقة',
      actionTrigger: 'أخبار عن دولة عربية أو قرار إقليمي'
    },
    
    keywords: {
      countries: ['السعودية', 'الإمارات', 'مصر', 'قطر', 'الكويت', 'البحرين', 'العراق', 'سوريا', 'لبنان', 'الأردن', 'فلسطين', 'المغرب', 'الجزائر'],
      regions: ['الخليج', 'المنطقة العربية', 'الشرق الأوسط', 'شمال أفريقيا'],
      entities: ['أرامكو', 'صندوق الاستثمارات', 'نيوم', 'رؤية 2030'],
      concepts: ['تطبيع', 'تحالف', 'استثمار', 'سياحة', 'طاقة متجددة']
    },
    
    patterns: [
      'قرار سعودي/إماراتي جديد',
      'مشروع عملاق في الخليج',
      'تحول اقتصادي في دولة عربية',
      'علاقات جديدة بين دول'
    ],
    
    evidence: {
      searchVolume: 25000,
      avgWatchTime: '9:00',
      topSearches: ['السعودية', 'نيوم', 'مصر', 'الإمارات', 'رؤية 2030']
    },
    
    pitchGuidance: {
      angleTypes: ['ماذا يعني لاقتصاد المنطقة؟', 'هل سينجح؟', 'المقارنة مع تجارب سابقة'],
      avoidAngles: ['أخبار بدون تحليل', 'مدح بدون نقد'],
      hookStyle: 'رقم أو حقيقة مفاجئة عن الدولة/المشروع'
    }
  }
};

// ============================================================
// ANALYZE SIGNAL BEHAVIOR FIT (STANDALONE)
// ============================================================
export function analyzeAudienceBehavior(item) {
  // Add logging for easier debugging
  try {
    console.log('🧠 Analyzing behavior for:', item?.title || item?.topic || '(no title)');
  } catch {
    // Ignore logging errors in non-browser environments
  }
  
  const title = (item?.title || item?.topic || '').toLowerCase();
  const description = (item?.description || item?.summary || '').toLowerCase();
  const fullText = normalizeArabic(title + ' ' + description);
  
  // If there's no meaningful text, return a safe default
  if (!fullText || fullText.length < 5) {
    try {
      console.warn('⚠️ AudienceBehavior: No text to analyze');
    } catch {}
    return getDefaultBehavior(item);
  }
  
  const analysis = {
    matchedClusters: [],
    primaryCluster: null,
    behaviorInsights: [],
    audienceQuestions: [],
    pitchSuggestions: [],
    overallRelevance: 0
  };
  
  // Analyze each cluster using only the INTEREST_CLUSTERS in this file
  for (const [, cluster] of Object.entries(INTEREST_CLUSTERS)) {
    const match = analyzeClusterMatch(fullText, cluster);
    
    if (match.score > 0) {
      analysis.matchedClusters.push({
        ...match,
        cluster
      });
    }
  }
  
  // Sort by score
  analysis.matchedClusters.sort((a, b) => b.score - a.score);
  
  // If both tech_future and daily_life_impact match, prioritize tech_future for AI content
  const hasTechMatch = analysis.matchedClusters.some(m => m.clusterId === 'tech_future');
  const hasDailyLifeMatch = analysis.matchedClusters.some(m => m.clusterId === 'daily_life_impact');
  const hasAIContent = ['ai', 'deepseek', 'chatgpt', 'claude', 'openai', 'ذكاء اصطناعي'].some(kw => 
    fullText.includes(kw.toLowerCase())
  );
  
  if (hasTechMatch && hasDailyLifeMatch && hasAIContent) {
    // Prioritize tech_future for AI content
    const techMatch = analysis.matchedClusters.find(m => m.clusterId === 'tech_future');
    const dailyLifeMatch = analysis.matchedClusters.find(m => m.clusterId === 'daily_life_impact');
    
    if (techMatch && dailyLifeMatch) {
      // Boost tech score and remove daily_life if tech is close
      if (techMatch.score >= dailyLifeMatch.score * 0.7) {
        // Remove daily_life_impact from matches
        analysis.matchedClusters = analysis.matchedClusters.filter(m => m.clusterId !== 'daily_life_impact');
        // Boost tech score
        techMatch.score = Math.max(techMatch.score, dailyLifeMatch.score + 10);
        // Re-sort
        analysis.matchedClusters.sort((a, b) => b.score - a.score);
        console.log('🎯 Prioritized tech_future over daily_life_impact for AI content');
      }
    }
  }
  
  if (analysis.matchedClusters.length === 0) {
    // No behavioral match → try topic-specific fallback
    try {
      console.warn('⚠️ AudienceBehavior: No clusters matched for text:', fullText.slice(0, 80));
    } catch {}
    return getDefaultBehavior(item);
  }
  
  // Set primary cluster
  analysis.primaryCluster = analysis.matchedClusters[0];
  
  // Generate behavior insights
  analysis.behaviorInsights = generateBehaviorInsights(analysis.matchedClusters);
  
  // Generate audience questions
  analysis.audienceQuestions = generateAudienceQuestions(analysis.matchedClusters);
  
  // Generate pitch suggestions
  analysis.pitchSuggestions = generatePitchSuggestions(analysis.matchedClusters);
  
  // Calculate overall relevance
  analysis.overallRelevance = calculateOverallRelevance(analysis.matchedClusters);
  
  return analysis;
}

// ============================================================
// ANALYZE CLUSTER MATCH
// ============================================================
function analyzeClusterMatch(text, cluster) {
  const match = {
    clusterId: cluster.id,
    clusterName: cluster.name,
    icon: cluster.icon,
    score: 0,
    matchedKeywords: [],
    matchedPatterns: [],
    weight: cluster.weight
  };
  
  // Check keywords (with higher weight for tech/AI keywords)
  for (const [category, keywords] of Object.entries(cluster.keywords)) {
    for (const keyword of keywords) {
      const normalizedKeyword = normalizeArabic(keyword.toLowerCase());
      const normalizedText = normalizeArabic(text);
      
      if (normalizedText.includes(normalizedKeyword)) {
        match.matchedKeywords.push({ keyword, category });
        
        // Higher score for tech/AI keywords to prioritize them
        if (cluster.id === 'tech_future' && 
            (category === 'tech' || category === 'companies' || 
             ['deepseek', 'ai', 'chatgpt', 'claude', 'openai'].some(k => keyword.toLowerCase().includes(k)))) {
          match.score += 20; // Higher weight for tech keywords
        } else {
          match.score += 10;
        }
      }
    }
  }
  
  // Check patterns
  for (const pattern of cluster.patterns) {
    const normalizedPattern = normalizeArabic(pattern.toLowerCase());
    const normalizedText = normalizeArabic(text);
    
    if (normalizedText.includes(normalizedPattern)) {
      match.matchedPatterns.push(pattern);
      
      // Higher score for tech patterns
      if (cluster.id === 'tech_future') {
        match.score += 20;
      } else {
        match.score += 15;
      }
    }
  }
  
  // Apply weight
  match.score = Math.round(match.score * cluster.weight);
  
  return match;
}

// ============================================================
// GENERATE BEHAVIOR INSIGHTS
// ============================================================
function generateBehaviorInsights(matchedClusters) {
  const insights = [];
  
  for (const match of matchedClusters.slice(0, 3)) {
    const cluster = match.cluster;
    
    insights.push({
      icon: cluster.icon,
      type: 'psychology',
      title: 'لماذا يهتم الجمهور؟',
      text: cluster.psychology.deepQuestion,
      detail: `الدافع: ${cluster.psychology.desire}`
    });
    
    if (cluster.evidence.avgWatchTime) {
      insights.push({
        icon: '⏱️',
        type: 'engagement',
        title: 'مستوى الاهتمام',
        text: `متوسط المشاهدة: ${cluster.evidence.avgWatchTime}`,
        detail: `${cluster.evidence.searchVolume.toLocaleString()} عملية بحث`
      });
    }
  }
  
  return insights;
}

// ============================================================
// GENERATE AUDIENCE QUESTIONS
// ============================================================
function generateAudienceQuestions(matchedClusters) {
  const questions = [];
  
  for (const match of matchedClusters.slice(0, 2)) {
    const cluster = match.cluster;
    
    // Main question from psychology
    questions.push({
      icon: '❓',
      question: cluster.psychology.deepQuestion,
      source: cluster.name
    });
    
    // Fear-based question
    questions.push({
      icon: '😰',
      question: `كيف أحمي نفسي من ${cluster.psychology.fear}؟`,
      source: 'مخاوف الجمهور'
    });
  }
  
  return questions.slice(0, 4);
}

// ============================================================
// GENERATE PITCH SUGGESTIONS
// ============================================================
function generatePitchSuggestions(matchedClusters) {
  const suggestions = [];
  
  for (const match of matchedClusters.slice(0, 2)) {
    const cluster = match.cluster;
    const guidance = cluster.pitchGuidance;
    
    // Suggested angles
    for (const angle of guidance.angleTypes.slice(0, 2)) {
      suggestions.push({
        type: 'angle',
        icon: '🎯',
        text: angle,
        source: cluster.name
      });
    }
    
    // Hook style
    suggestions.push({
      type: 'hook',
      icon: '🪝',
      text: guidance.hookStyle,
      source: cluster.name
    });
    
    // What to avoid
    for (const avoid of guidance.avoidAngles.slice(0, 1)) {
      suggestions.push({
        type: 'avoid',
        icon: '⚠️',
        text: `تجنب: ${avoid}`,
        source: cluster.name
      });
    }
  }
  
  return suggestions;
}

// ============================================================
// CALCULATE OVERALL RELEVANCE
// ============================================================
function calculateOverallRelevance(matchedClusters) {
  if (matchedClusters.length === 0) return 0;
  
  // Primary cluster score
  const primaryScore = matchedClusters[0].score;
  
  // Cross-cluster bonus
  const crossClusterBonus = Math.min(20, (matchedClusters.length - 1) * 10);
  
  // Cap at 100
  return Math.min(100, primaryScore + crossClusterBonus);
}

// ============================================================
// FORMAT FOR UI
// ============================================================
export function formatBehaviorForUI(analysis) {
  if (!analysis || !analysis.primaryCluster) {
    return null;
  }
  
  return {
    // Primary Interest
    primaryInterest: {
      icon: analysis.primaryCluster.icon,
      name: analysis.primaryCluster.clusterName,
      question: analysis.primaryCluster.cluster.psychology.deepQuestion,
      score: analysis.primaryCluster.score
    },
    
    // Secondary Interests
    secondaryInterests: analysis.matchedClusters.slice(1, 3).map(m => ({
      icon: m.icon,
      name: m.clusterName,
      score: m.score
    })),
    
    // Behavior Insights
    insights: analysis.behaviorInsights,
    
    // Audience Questions
    questions: analysis.audienceQuestions,
    
    // Pitch Suggestions
    pitchSuggestions: analysis.pitchSuggestions,
    
    // Keywords Found
    keywords: analysis.matchedClusters[0]?.matchedKeywords || [],
    
    // Overall Score
    relevanceScore: analysis.overallRelevance,
    
    // Evidence from data
    evidence: {
      searchVolume: analysis.primaryCluster.cluster.evidence.searchVolume,
      avgWatchTime: analysis.primaryCluster.cluster.evidence.avgWatchTime,
      topSearches: analysis.primaryCluster.cluster.evidence.topSearches.slice(0, 3)
    }
  };
}

// ============================================================
// DEFAULT / FALLBACK BEHAVIOR OBJECT
// ============================================================
function getDefaultBehavior(item) {
  // Try to generate topic-specific fallback based on item content
  const title = (item?.title || item?.topic || '').toLowerCase();
  const description = (item?.description || item?.summary || '').toLowerCase();
  const fullText = normalizeArabic(title + ' ' + description);
  
  // Check for AI/tech keywords even if no cluster matched
  const aiKeywords = ['ai', 'ذكاء اصطناعي', 'deepseek', 'chatgpt', 'claude', 'openai', 'nvidia', 'artificial intelligence'];
  const hasAI = aiKeywords.some(kw => fullText.includes(kw.toLowerCase()));
  
  if (hasAI) {
    // Return tech_future cluster as fallback for AI content
    const techCluster = INTEREST_CLUSTERS.tech_future;
    return {
      matchedClusters: [{
        clusterId: techCluster.id,
        clusterName: techCluster.name,
        icon: techCluster.icon,
        score: 50, // Medium score for fallback
        matchedKeywords: [],
        matchedPatterns: [],
        weight: techCluster.weight,
        cluster: techCluster
      }],
      primaryCluster: {
        clusterId: techCluster.id,
        clusterName: techCluster.name,
        icon: techCluster.icon,
        score: 50,
        matchedKeywords: [],
        matchedPatterns: [],
        weight: techCluster.weight,
        cluster: techCluster
      },
      behaviorInsights: [{
        icon: techCluster.icon,
        type: 'psychology',
        title: 'لماذا يهتم الجمهور؟',
        text: techCluster.psychology.deepQuestion,
        detail: `الدافع: ${techCluster.psychology.desire}`
      }],
      audienceQuestions: [{
        icon: '❓',
        question: techCluster.psychology.deepQuestion,
        source: techCluster.name
      }],
      pitchSuggestions: techCluster.pitchGuidance.angleTypes.slice(0, 2).map(angle => ({
        type: 'angle',
        icon: '🎯',
        text: angle,
        source: techCluster.name
      })),
      overallRelevance: 50
    };
  }
  
  // Generic fallback
  return {
    matchedClusters: [],
    primaryCluster: null,
    behaviorInsights: [],
    audienceQuestions: [],
    pitchSuggestions: [],
    overallRelevance: 0
  };
}

// ============================================================
// UTILITIES
// ============================================================
function normalizeArabic(text) {
  if (!text) return '';
  return text
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي');
}

