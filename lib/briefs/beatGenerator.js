import { ENHANCED_DNA } from '../dna/enhancedDna.js';

/**
 * BEAT STRUCTURE GENERATOR
 * Generate video brief with chapter beats
 */

// ============================================
// Generate Brief with Beats
// ============================================
export function generateBrief(item, analysis) {
  const { 
    hookPattern, 
    storyType, 
    extracted,
    topic 
  } = analysis;
  
  const beatStructure = ENHANCED_DNA.beat_structure;
  const brief = {
    title: item.title,
    generated_at: new Date().toISOString(),
    
    // Video structure
    chapters: [],
    
    // Metadata
    estimated_duration: '25-27 minutes',
    format: 'long_form'
  };
  
  // ============================================
  // CHAPTER 1: HOOK (10-15%)
  // ============================================
  const chapter1 = {
    chapter_number: 1,
    name: beatStructure.chapter_1_hook.name,
    duration: '2.5-4 minutes',
    beats: []
  };
  
  // Beat 1: News Peg
  chapter1.beats.push({
    beat: 'خبر الحلقة',
    content: generateNewsPeg(item, extracted),
    script_hint: `Start with: "في ${extracted.date || '[تاريخ]'}، ${extracted.event || '[الحدث]'} حصل..."`,
    required: true
  });
  
  // Beat 2: Central Question
  chapter1.beats.push({
    beat: 'سؤال الحلقة',
    content: generateCentralQuestion(item, storyType),
    script_hint: 'السؤال اللي هنجاوب عليه النهاردة هو: [السؤال]',
    required: true
  });
  
  // Beat 3: Promise
  chapter1.beats.push({
    beat: 'وعد الحلقة',
    content: generatePromise(storyType),
    script_hint: 'في الحلقة دي هنفهم [1] و [2] و [3]',
    required: true
  });
  
  brief.chapters.push(chapter1);
  
  // ============================================
  // CHAPTER 2: CONTEXT (20-25%)
  // ============================================
  const chapter2 = {
    chapter_number: 2,
    name: beatStructure.chapter_2_context.name,
    duration: '5-6 minutes',
    beats: []
  };
  
  // Beat 1: Historical Context (if needed)
  if (needsHistoricalContext(storyType, topic)) {
    chapter2.beats.push({
      beat: 'فلاشباك/تاريخ',
      content: 'عشان نفهم اللي بيحصل، لازم نرجع لـ [تاريخ/حدث سابق]',
      script_hint: 'Provide 2-3 minutes of relevant background',
      required: false
    });
  }
  
  // Beat 2: Key Players
  chapter2.beats.push({
    beat: 'اللاعبين الرئيسيين',
    content: generateKeyPlayers(extracted),
    script_hint: 'الأطراف الرئيسية: [1] اللي عايز [X]، و[2] اللي عايز [Y]',
    required: true
  });
  
  brief.chapters.push(chapter2);
  
  // ============================================
  // CHAPTER 3: DEEP DIVE (40-50%)
  // ============================================
  const chapter3 = {
    chapter_number: 3,
    name: beatStructure.chapter_3_deep_dive.name,
    duration: '10-12 minutes',
    beats: []
  };
  
  // Beat 1: Data & Evidence
  chapter3.beats.push({
    beat: 'البيانات والأرقام',
    content: generateDataSection(extracted),
    script_hint: 'الأرقام بتقول: [رقم 1]، [رقم 2]، [رقم 3]',
    required: true
  });
  
  // Beat 2: Scenarios
  chapter3.beats.push({
    beat: 'السيناريوهات',
    content: generateScenarios(storyType),
    script_hint: 'لو [X] حصل → [Y]. لو [Z] حصل → [W].',
    required: true
  });
  
  // Beat 3: Regional Impact
  chapter3.beats.push({
    beat: 'التأثير الإقليمي',
    content: generateRegionalImpact(extracted, topic),
    script_hint: 'طيب إيه علاقة ده بـ [الخليج/مصر]؟ [التأثير المحدد]',
    required: true
  });
  
  brief.chapters.push(chapter3);
  
  // ============================================
  // CHAPTER 4: CONCLUSION (10-15%)
  // ============================================
  const chapter4 = {
    chapter_number: 4,
    name: beatStructure.chapter_4_conclusion.name,
    duration: '2.5-4 minutes',
    beats: []
  };
  
  // Beat 1: Answer Question
  chapter4.beats.push({
    beat: 'الإجابة على السؤال',
    content: 'يعني الإجابة على سؤالنا: [الإجابة الواضحة]',
    script_hint: 'Directly answer the central question from Chapter 1',
    required: true
  });
  
  // Beat 2: Personal Relevance
  chapter4.beats.push({
    beat: 'ماذا يعني لك',
    content: generatePersonalRelevance(topic, extracted),
    script_hint: 'ده يعني إيه ليك؟ [تأثير على المشاهد]',
    required: true
  });
  
  // Beat 3: CTA
  chapter4.beats.push({
    beat: 'الدعوة للتفاعل',
    content: 'اكتب رأيك في الكومنتات + اشترك + الحلقة الجاية',
    script_hint: 'End with engagement prompt',
    required: false
  });
  
  brief.chapters.push(chapter4);
  
  return brief;
}

// ============================================
// Helper Functions
// ============================================

function generateNewsPeg(item, extracted) {
  const date = extracted.date || '[التاريخ]';
  const entity = extracted.entity || '[الجهة]';
  const event = item.title.substring(0, 50);
  
  return `في ${date}، ${entity} أعلن/حصل ${event}`;
}

function generateCentralQuestion(item, storyType) {
  const questionTemplates = {
    'THREAT': 'هل [X] فعلاً خطر؟ وإيه اللي ممكن يحصل؟',
    'OPPORTUNITY': 'ليه [X] مهم؟ وإيه اللي ممكن نستفيده؟',
    'SHIFT': 'إيه اللي اتغير؟ وليه دلوقتي؟',
    'RACE': 'مين هيكسب السباق؟ وإيه الموقف دلوقتي؟',
    'CONFLICT': 'مين هيكسب؟ وإيه المعني للمنطقة؟',
    'REVEAL': 'إيه الحقيقة؟ وليه محدش بيتكلم عنها؟'
  };
  
  return questionTemplates[storyType?.primary] || 'إيه القصة الكاملة؟ وإيه اللي هيحصل؟';
}

function generatePromise(storyType) {
  return 'في الحلقة دي هنفهم: [1] الخلفية الكاملة، [2] الأرقام والحقائق، [3] التأثير عليك وعلى المنطقة';
}

function needsHistoricalContext(storyType, topic) {
  const contextTopics = ['us_china_geopolitics', 'missiles_air_defense', 'logistics_supply_chain'];
  const contextStoryTypes = ['SHIFT', 'CONSEQUENCE', 'CONFLICT'];
  
  return contextTopics.includes(topic) || contextStoryTypes.includes(storyType?.primary);
}

function generateKeyPlayers(extracted) {
  const entities = extracted.entities || [];
  if (entities.length >= 2) {
    return `الأطراف: ${entities[0]} (اللي عايز [X]) vs ${entities[1]} (اللي عايز [Y])`;
  }
  return 'الأطراف الرئيسية: [حدد اللاعبين ومصالحهم]';
}

function generateDataSection(extracted) {
  const numbers = extracted.numbers || [];
  if (numbers.length > 0) {
    return `الأرقام المهمة: ${numbers.slice(0, 3).join('، ')}`;
  }
  return 'البيانات: [أضف الأرقام والإحصائيات]';
}

function generateScenarios(storyType) {
  return 'السيناريو الأول: [X] → السيناريو الثاني: [Y] → الأرجح: [Z]';
}

function generateRegionalImpact(extracted, topic) {
  const regions = extracted.regions || ['الخليج', 'مصر'];
  return `التأثير على ${regions[0] || 'المنطقة'}: [حدد التأثير المباشر]`;
}

function generatePersonalRelevance(topic, extracted) {
  const templates = {
    'us_china_geopolitics': 'ده ممكن يأثر على أسعار المنتجات والوظائف في المنطقة',
    'logistics_supply_chain': 'ده ممكن يأثر على أسعار الشحن وتوافر المنتجات',
    'missiles_air_defense': 'ده ممكن يأثر على الأمن الإقليمي والاستثمارات',
    'big_tech_platforms': 'ده ممكن يأثر على الوظائف التقنية وفرص العمل'
  };
  
  return templates[topic] || 'ده يعني إيه ليك؟ [أضف التأثير الشخصي]';
}

// ============================================
// Generate Short Brief
// ============================================
export function generateShortBrief(item, analysis) {
  return {
    format: 'short',
    duration: '30-45 seconds',
    structure: {
      hook_3s: 'أول 3 ثواني: [الرقم/الحقيقة الصادمة]',
      body_20s: '20 ثانية: [الشرح السريع]',
      cta_5s: 'آخر 5 ثواني: [شوف الحلقة الكاملة]'
    },
    key_fact: analysis.extracted.numbers?.[0] || '[الحقيقة الرئيسية]',
    hook_text: `${analysis.extracted.numbers?.[0] || '[رقم]'}... ${item.title.substring(0, 30)}`,
    note: 'Focus on ONE shocking fact. No context needed.'
  };
}

