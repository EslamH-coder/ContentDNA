/**
 * CONTEXT LOADER
 * Loads all channel context ONCE at startup
 * Everything the system needs to think like a producer
 */

import { loadDNA } from '../dna/dnaStorage.js';
import { AUDIENCE_DNA } from '../dna/audienceProfile.js';

// ============================================
// GLOBAL CONTEXT (Loaded once, used everywhere)
// ============================================
let PRODUCER_CONTEXT = null;

export async function loadProducerContext() {
  if (PRODUCER_CONTEXT) {
    return PRODUCER_CONTEXT;
  }
  
  console.log('📚 Loading Producer Context...');
  
  // Load DNA
  const dna = await loadDNA();
  
  PRODUCER_CONTEXT = {
    // Channel DNA
    dna: {
      show_name: dna?.metadata?.channel_name || 'المخبر الاقتصادي+',
      topics: dna?.topics || {},
      hooks: dna?.hooks || {},
      format: dna?.format || {},
      insights: dna?.insights || {},
      banned: dna?.banned || {}
    },
    
    // Audience Profile
    audience: {
      // Demographics
      demographics: {
        gender: { male: 94.43, female: 5.56 },
        top_countries: [
          { code: 'EG', name: 'مصر', percentage: 21.6 },
          { code: 'SA', name: 'السعودية', percentage: 15.1 },
          { code: 'MA', name: 'المغرب', percentage: 9.7 },
          { code: 'DZ', name: 'الجزائر', percentage: 8.3 },
          { code: 'US', name: 'أمريكا', percentage: 4.1 },
          { code: 'DE', name: 'ألمانيا', percentage: 4.0 }
        ],
        device: { mobile: 68.9, tv: 15.5, computer: 12.5 }
      },
      
      // How they find videos
      discovery: {
        browse: 46.3,      // Home/Subscriptions - loyal subscribers
        suggested: 37.8,   // YouTube recommendations
        search: 2.5        // They DON'T search!
      },
      
      // What they want
      interests: [
        'السياسة الدولية',
        'الصراعات الجيوسياسية', 
        'تأثير الأحداث العالمية على العرب',
        'القوى الكبرى (أمريكا، الصين، روسيا)',
        'الشخصيات المؤثرة (ترامب، ماسك، إلخ)'
      ],
      
      // Questions they have
      mental_questions: [
        'هل هذا سيؤثر علينا؟',
        'من سيفوز في هذا الصراع؟',
        'ماذا يعني هذا لمستقبلنا؟',
        'لماذا يفعلون هذا؟'
      ]
    },
    
    // Behavior Patterns
    patterns: loadBehaviorPatterns(),
    
    // Top Videos (for reference)
    topVideos: loadTopVideos(),
    
    // Banned content
    banned: loadBannedContent(),
    
    // Loaded timestamp
    loadedAt: new Date().toISOString()
  };
  
  console.log('✅ Producer Context Loaded');
  console.log(`   - ${Object.keys(PRODUCER_CONTEXT.dna.topics || {}).length} topics tracked`);
  console.log(`   - ${PRODUCER_CONTEXT.topVideos.length} top videos loaded`);
  console.log(`   - ${PRODUCER_CONTEXT.banned.phrases.length} banned phrases`);
  
  return PRODUCER_CONTEXT;
}

export function getProducerContext() {
  if (!PRODUCER_CONTEXT) {
    throw new Error('Producer context not loaded! Call loadProducerContext() first.');
  }
  return PRODUCER_CONTEXT;
}

// ============================================
// LOAD BEHAVIOR PATTERNS
// ============================================
function loadBehaviorPatterns() {
  return {
    // Pattern 1: Certainty from Uncertainty
    certainty: {
      description: 'الجمهور يريد إجابة واضحة على سؤال غير واضح',
      trigger: 'هل questions promise YES/NO answer',
      weight: 20,
      examples: [
        'هل تستطيع أمريكا محاربة الصين وروسيا معاً؟',
        'هل سينهار الدولار؟',
        'هل يستطيع ترامب ضم كندا؟'
      ]
    },
    
    // Pattern 2: Power Dynamics
    power: {
      description: 'شخص قوي يتخذ قرارات تؤثر على الآخرين',
      trigger: 'Powerful person/entity making decisions',
      weight: 18,
      examples: [
        'كيف يقرر رجل واحد مصير الاقتصاد العالمي؟',
        'لماذا ترامب يهدد العالم؟'
      ]
    },
    
    // Pattern 3: Conflict
    conflict: {
      description: 'صراع بين طرفين - من سيفوز؟',
      trigger: 'Two sides with clear stakes',
      weight: 18,
      examples: [
        'أمريكا vs الصين: من سيسيطر على الاقتصاد؟',
        'حرب الرقائق: من يتحكم في المستقبل؟'
      ]
    },
    
    // Pattern 4: Arab Stakes
    arab_stakes: {
      description: 'كيف يؤثر هذا على الجمهور العربي؟',
      trigger: 'Clear impact on Egypt/Saudi/Gulf/Arabs',
      weight: 20,
      examples: [
        'كيف يرفع قرار أمريكي أسعار البنزين في مصر؟',
        'ماذا يعني هذا للريال السعودي؟'
      ],
      regions_to_mention: ['مصر', 'السعودية', 'الخليج', 'العرب', 'المنطقة العربية']
    },
    
    // Pattern 5: Mobile First
    mobile_first: {
      description: 'Hook في أول 5 كلمات',
      trigger: '69% watch on mobile, first 5 words = everything',
      weight: 12,
      rule: 'Start with هل/كيف/لماذا + power entity'
    },
    
    // Pattern 6: Personality over Policy
    personality: {
      description: 'اسم شخص أفضل من مؤسسة',
      trigger: 'Trump (1.29M) > America (950K)',
      weight: 12,
      examples: [
        '✅ ترامب يهدد الصين',
        '❌ الإدارة الأمريكية تعلن سياسات جديدة'
      ]
    }
  };
}

// ============================================
// LOAD TOP VIDEOS
// ============================================
function loadTopVideos() {
  return [
    {
      title: 'لماذا يدعم ترمب المشروع المنافس لقناة السويس؟',
      views: 2851450,
      retention: 52.55,
      ctr: 2.7,
      patterns_used: ['لماذا', 'ترامب', 'مصر (قناة السويس)'],
      why_it_worked: 'Power person + Arab stakes (Egypt) + Clear question'
    },
    {
      title: 'كيف سيدمر ترمب اقتصاد أمريكا قريباً؟',
      views: 2693831,
      retention: 48.23,
      ctr: 4.72,
      patterns_used: ['كيف', 'ترامب', 'Bold claim'],
      why_it_worked: 'Power person + Conflict + Dramatic stakes'
    },
    {
      title: 'هل تستطيع أمريكا محاربة الصين وروسيا معاً؟',
      views: 2587519,
      retention: 50.18,
      ctr: 4.77,
      patterns_used: ['هل', 'Conflict', 'Multiple powers'],
      why_it_worked: 'Yes/No question + Major conflict + Clear stakes'
    },
    {
      title: 'كيف يقود ترمب الإمبراطورية الأمريكية نحو الانهيار؟',
      views: 2220924,
      retention: 55.12,
      ctr: 4.55,
      patterns_used: ['كيف', 'ترامب', 'Dramatic claim'],
      why_it_worked: 'Power person + Bold narrative + High retention'
    },
    {
      title: 'كيف أصبحت الصين وحشاً كبيراً لا تقدر أمريكا وحدها على إيقافه؟',
      views: 1627775,
      retention: 51.19,
      ctr: 5.74,
      patterns_used: ['كيف', 'Conflict', 'Power shift'],
      why_it_worked: 'Dramatic framing + Conflict + Power dynamics'
    }
  ];
}

// ============================================
// LOAD BANNED CONTENT
// ============================================
function loadBannedContent() {
  return {
    phrases: [
      // Generic AI openers
      'هل تعلم أن',
      'هل تعلم ان', 
      'هل تعرف أن',
      'ما لا تعرفه',
      'الحقائق المخفية',
      'السر الذي',
      'الصدمة',
      
      // Fake personalization
      'في بلدك',
      'فاتورتك الشهرية',
      'أسعارك',
      'ميزانيتك الشخصية',
      
      // Clickbait
      'لن تصدق',
      'مفاجأة صادمة',
      'صدمة كبرى',
      'كارثة',
      'ومعه خطة',
      'أسعار كل شيء',
      'عائد لـ'
    ],
    
    weak_patterns: [
      'تطورات جديدة في',
      'آخر المستجدات',
      'تحديث حول',
      'تقرير عن'
    ]
  };
}

// ============================================
// GENERATE LLM SYSTEM PROMPT
// ============================================
export function generateProducerSystemPrompt() {
  const ctx = getProducerContext();
  
  return `
أنت منتج محتوى لقناة "${ctx.dna.show_name}" على يوتيوب.

# جمهورك:
- ${ctx.audience.demographics.gender.male}% رجال
- أكبر الدول: ${ctx.audience.demographics.top_countries.slice(0, 3).map(c => c.name).join('، ')}
- ${ctx.audience.demographics.device.mobile}% يشاهدون على الجوال
- ${ctx.audience.discovery.browse}% يكتشفون من الـ Home (مشتركين مخلصين)
- لا يبحثون! (${ctx.audience.discovery.search}% فقط من البحث)

# ما يريده الجمهور:
${ctx.audience.interests.map(i => `- ${i}`).join('\n')}

# الأسئلة في ذهنهم:
${ctx.audience.mental_questions.map(q => `- "${q}"`).join('\n')}

# الأنماط الناجحة (6 Patterns):
1. سؤال "هل" (يعد بإجابة نعم/لا) - الأفضل!
2. شخص قوي يتخذ قرارات (ترامب أفضل من "أمريكا")
3. صراع بين طرفين (من سيفوز؟)
4. تأثير واضح على العرب (مصر، السعودية، الخليج)
5. Hook في أول 5 كلمات (للجوال)
6. اسم شخص بدل مؤسسة

# أفضل الفيديوهات أداءً:
${ctx.topVideos.slice(0, 3).map(v => `- "${v.title}" (${v.views.toLocaleString()} مشاهدة)`).join('\n')}

# ممنوع نهائياً:
${ctx.banned.phrases.map(p => `- "${p}"`).join('\n')}

# مهمتك:
1. اقرأ الخبر كاملاً (مش بس العنوان)
2. فكر: "وين الزاوية اللي تهم جمهوري؟"
3. فكر: "وين الصراع؟ وين القوة؟ وين التأثير على العرب؟"
4. اكتب عنوان وhook يطبق الأنماط الـ 6
`;
}




