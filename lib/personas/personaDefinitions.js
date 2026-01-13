/**
 * PERSONA DEFINITIONS
 * Based on actual channel data from المخبر الاقتصادي+
 */

export const PERSONAS = {
  // ============================================
  // PERSONA 1: Egyptian Business Professional
  // ============================================
  egyptian_business: {
    id: 'egyptian_business',
    name: 'رجل الأعمال المصري',
    icon: '🇪🇬',
    color: '#e74c3c',
    
    // Demographics
    demographics: {
      countries: ['EG'],
      percentage: 21.6,  // From YouTube data
      gender: 'male',
      ageRange: '25-44',
      device: 'mobile'
    },
    
    // What they care about
    interests: {
      primary: [
        'سعر الجنيه المصري',
        'الاستيراد والتصدير',
        'قناة السويس',
        'العلاقات مصر-أمريكا',
        'الاستثمار في مصر',
        'قرارات البنك المركزي المصري'
      ],
      secondary: [
        'أسعار الطاقة',
        'الدولار',
        'صندوق النقد الدولي',
        'التضخم'
      ]
    },
    
    // Keywords that trigger this persona
    triggerKeywords: [
      'مصر', 'egypt', 'egyptian', 'مصري',
      'الجنيه', 'pound', 'egp',
      'السويس', 'suez',
      'القاهرة', 'cairo',
      'البنك المركزي المصري',
      'السيسي'
    ],
    
    // What adjacent content they watch
    adjacentContent: [
      { type: 'business_news', examples: ['CNBC عربية', 'العربية بيزنس'] },
      { type: 'local_economy', examples: ['قنوات اقتصادية مصرية'] }
    ],
    
    // Best performing content for this persona
    winningTopics: [
      'قناة السويس', // 2.8M views
      'تأثير X على الجنيه',
      'مصر وصندوق النقد'
    ],
    
    // Content gaps to fill
    contentGaps: [],
    
    // Growth trend
    trend: 'stable' // growing, stable, declining
  },
  
  // ============================================
  // PERSONA 2: Gulf Oil & Energy Follower
  // ============================================
  gulf_oil: {
    id: 'gulf_oil',
    name: 'متابع النفط الخليجي',
    icon: '🛢️',
    color: '#f39c12',
    
    demographics: {
      countries: ['SA', 'AE', 'KW', 'QA', 'BH', 'OM'],
      percentage: 25.1,  // Combined Gulf
      gender: 'male',
      ageRange: '25-54',
      device: 'mobile'
    },
    
    interests: {
      primary: [
        'أسعار النفط',
        'أوبك وأوبك+',
        'أرامكو',
        'رؤية 2030',
        'الطاقة المتجددة في الخليج',
        'الريال والدرهم'
      ],
      secondary: [
        'العلاقات السعودية-الأمريكية',
        'الاستثمارات السيادية',
        'نيوم',
        'التنويع الاقتصادي'
      ]
    },
    
    triggerKeywords: [
      'السعودية', 'saudi', 'سعودي',
      'الإمارات', 'uae', 'إماراتي', 'دبي', 'أبوظبي',
      'النفط', 'oil', 'نفط',
      'أوبك', 'opec',
      'أرامكو', 'aramco',
      'الريال', 'الدرهم',
      'محمد بن سلمان', 'mbs',
      'رؤية 2030', 'نيوم', 'neom',
      'الخليج', 'gulf', 'gcc'
    ],
    
    adjacentContent: [
      { type: 'energy_news', examples: ['Bloomberg Energy', 'OilPrice'] },
      { type: 'business', examples: ['CNBC', 'Bloomberg Markets'] }
    ],
    
    winningTopics: [
      'أوبك تخفض الإنتاج',
      'أرامكو vs شركات النفط',
      'مستقبل النفط'
    ],
    
    contentGaps: [],
    trend: 'growing'
  },
  
  // ============================================
  // PERSONA 3: Geopolitics Analyst
  // ============================================
  geopolitics: {
    id: 'geopolitics',
    name: 'المحلل الجيوسياسي',
    icon: '🌍',
    color: '#3498db',
    
    demographics: {
      countries: ['ALL'],  // Across all countries
      percentage: 30,  // Estimated
      gender: 'male',
      ageRange: '18-44',
      device: 'mixed'
    },
    
    interests: {
      primary: [
        'صراع أمريكا والصين',
        'روسيا وأوكرانيا',
        'ترامب والسياسة الأمريكية',
        'إيران والملف النووي',
        'الصراع في الشرق الأوسط',
        'القوى العظمى'
      ],
      secondary: [
        'حلف الناتو',
        'العقوبات الدولية',
        'الحروب التجارية',
        'الانتخابات الأمريكية'
      ]
    },
    
    triggerKeywords: [
      'ترامب', 'trump', 'ترمب',
      'الصين', 'china', 'شي جين بينغ',
      'روسيا', 'russia', 'بوتين', 'putin',
      'أمريكا', 'america', 'usa',
      'إيران', 'iran',
      'حرب', 'war', 'صراع', 'conflict',
      'عقوبات', 'sanctions',
      'نووي', 'nuclear',
      'أوكرانيا', 'ukraine',
      'تايوان', 'taiwan'
    ],
    
    adjacentContent: [
      { type: 'geopolitics', examples: ['Visualpolitik', 'Caspian Report'] },
      { type: 'documentaries', examples: ['الجزيرة وثائقية', 'DW وثائقية'] },
      { type: 'podcasts', examples: ['Lex Fridman', 'Joe Rogan'] }
    ],
    
    winningTopics: [
      'هل تستطيع أمريكا محاربة الصين وروسيا؟', // 2.5M
      'ترامب vs الجميع',
      'الحرب القادمة'
    ],
    
    contentGaps: [],
    trend: 'growing'
  },
  
  // ============================================
  // PERSONA 4: Tech & Future Enthusiast
  // ============================================
  tech_future: {
    id: 'tech_future',
    name: 'متابع التقنية والمستقبل',
    icon: '💻',
    color: '#9b59b6',
    
    demographics: {
      countries: ['ALL'],
      percentage: 15,
      gender: 'male',
      ageRange: '18-34',
      device: 'mixed'
    },
    
    interests: {
      primary: [
        'الذكاء الاصطناعي',
        'إيلون ماسك',
        'حرب الرقائق',
        'شركات التقنية الكبرى',
        'مستقبل التكنولوجيا',
        'العملات الرقمية'
      ],
      secondary: [
        'تسلا',
        'أبل',
        'مايكروسوفت',
        'جوجل',
        'الفضاء'
      ]
    },
    
    triggerKeywords: [
      'الذكاء الاصطناعي', 'ai', 'artificial intelligence',
      'ماسك', 'musk', 'elon',
      'تسلا', 'tesla',
      'رقائق', 'chips', 'semiconductor',
      'نفيديا', 'nvidia',
      'أبل', 'apple',
      'جوجل', 'google',
      'chatgpt', 'openai',
      'بيتكوين', 'bitcoin', 'كريبتو', 'crypto'
    ],
    
    adjacentContent: [
      { type: 'tech_explainers', examples: ['Kurzgesagt', 'Veritasium'] },
      { type: 'tech_news', examples: ['MKBHD', 'Linus Tech'] },
      { type: 'arab_science', examples: ['الدحيح', 'إيجيكولوجي'] }
    ],
    
    winningTopics: [
      'حرب الرقائق: أمريكا vs الصين',
      'ماسك يتحكم في X',
      'ChatGPT يغير كل شيء'
    ],
    
    contentGaps: [],
    trend: 'growing'
  },
  
  // ============================================
  // PERSONA 5: Individual Investor
  // ============================================
  investor: {
    id: 'investor',
    name: 'المستثمر الفردي',
    icon: '📊',
    color: '#27ae60',
    
    demographics: {
      countries: ['EG', 'SA', 'AE', 'MA', 'DZ'],
      percentage: 15,
      gender: 'male',
      ageRange: '25-54',
      device: 'mobile'
    },
    
    interests: {
      primary: [
        'الذهب',
        'الدولار',
        'الفيدرالي وأسعار الفائدة',
        'البورصات العالمية',
        'التضخم',
        'أين أستثمر أموالي؟'
      ],
      secondary: [
        'العقارات',
        'الأسهم',
        'السندات',
        'المعادن الثمينة'
      ]
    },
    
    triggerKeywords: [
      'الذهب', 'gold',
      'الدولار', 'dollar',
      'الفيدرالي', 'federal reserve', 'fed',
      'فائدة', 'interest rate',
      'تضخم', 'inflation',
      'بورصة', 'stock', 'market',
      'استثمار', 'invest',
      'انهيار', 'crash', 'crisis'
    ],
    
    adjacentContent: [
      { type: 'investing', examples: ['قنوات التداول', 'تحليل فني'] },
      { type: 'personal_finance', examples: ['قنوات مالية شخصية'] }
    ],
    
    winningTopics: [
      'هل سينهار الدولار؟',
      'الذهب يصل لأعلى سعر',
      'الفيدرالي يغير كل شيء'
    ],
    
    contentGaps: [],
    trend: 'stable'
  },
  
  // ============================================
  // PERSONA 6: Maghreb Viewer (Morocco, Algeria)
  // ============================================
  maghreb: {
    id: 'maghreb',
    name: 'المشاهد المغاربي',
    icon: '🇲🇦',
    color: '#e67e22',
    
    demographics: {
      countries: ['MA', 'DZ', 'TN', 'LY'],
      percentage: 18,  // Morocco 9.7% + Algeria 8.3%
      gender: 'male',
      ageRange: '18-44',
      device: 'mobile'
    },
    
    interests: {
      primary: [
        'العلاقات مع أوروبا',
        'الهجرة',
        'فرنسا والمغرب العربي',
        'أسعار الطاقة',
        'التجارة مع أوروبا'
      ],
      secondary: [
        'إسبانيا والمغرب',
        'الغاز الجزائري',
        'الفوسفات المغربي',
        'الاتحاد الأوروبي'
      ]
    },
    
    triggerKeywords: [
      'المغرب', 'morocco', 'مغربي',
      'الجزائر', 'algeria', 'جزائري',
      'تونس', 'tunisia',
      'فرنسا', 'france',
      'إسبانيا', 'spain',
      'أوروبا', 'europe',
      'الهجرة', 'migration',
      'المغرب العربي', 'maghreb'
    ],
    
    adjacentContent: [
      { type: 'europe_focused', examples: ['France 24 عربي', 'DW عربي'] },
      { type: 'local', examples: ['قنوات مغاربية'] }
    ],
    
    winningTopics: [
      'أوروبا تحتاج الغاز الجزائري',
      'المغرب والصحراء',
      'فرنسا vs المغرب العربي'
    ],
    
    contentGaps: ['محتوى أكثر عن المغرب العربي'],
    trend: 'growing'
  },
  
  // ============================================
  // PERSONA 7: Employee - Personal Finance
  // ============================================
  employee: {
    id: 'employee',
    name: 'الموظف - الاقتصاد الشخصي',
    icon: '👔',
    color: '#16a085',
    
    demographics: {
      countries: ['EG', 'SA', 'AE', 'MA', 'DZ', 'JO', 'LB'],
      percentage: 20,  // Estimated
      gender: 'mixed',
      ageRange: '25-45',
      device: 'mobile'
    },
    
    interests: {
      primary: [
        'إدارة الراتب',
        'الادخار',
        'الاقتصاد السلوكي',
        'التقاعد',
        'كيف أوفر من راتبي',
        'الديون والقروض'
      ],
      secondary: [
        'التأمين',
        'الاستثمار الشخصي',
        'الضريبة',
        'المعاش'
      ]
    },
    
    triggerKeywords: [
      'راتب', 'salary',
      'ادخار', 'إدخار', 'saving',
      'ميزانية', 'budget',
      'ديون', 'debts',
      'قرض', 'loan',
      'تقاعد', 'retirement',
      'معاش', 'pension',
      'تأمين', 'insurance',
      'الطبقة المتوسطة', 'middle class',
      'اقتصاد سلوكي', 'behavioral economics'
    ],
    
    adjacentContent: [
      { type: 'personal_finance', examples: ['قنوات مالية شخصية', 'نصائح مالية'] },
      { type: 'lifestyle', examples: ['قنوات أسلوب حياة'] }
    ],
    
    winningTopics: [
      'كيف تدخر من راتبك الشهري؟',
      'الاقتصاد السلوكي وعاداتك المالية',
      'خطة التقاعد المبكر'
    ],
    
    contentGaps: [],
    trend: 'growing'
  },
  
  // ============================================
  // PERSONA 8: Student Entrepreneur
  // ============================================
  student_entrepreneur: {
    id: 'student_entrepreneur',
    name: 'الطالب - ريادة الأعمال',
    icon: '🚀',
    color: '#e74c3c',
    
    demographics: {
      countries: ['ALL'],
      percentage: 12,  // Estimated
      gender: 'mixed',
      ageRange: '18-28',
      device: 'mobile'
    },
    
    interests: {
      primary: [
        'المشاريع الناشئة',
        'ريادة الأعمال',
        'التمويل',
        'قصص النجاح',
        'كيف أبدأ مشروعي',
        'الستارت أب'
      ],
      secondary: [
        'التسويق الرقمي',
        'التجارة الإلكترونية',
        'العمل الحر',
        'الاستثمار في المشاريع'
      ]
    },
    
    triggerKeywords: [
      'ستارت اب', 'startup',
      'مشروع', 'project', 'business',
      'ريادة', 'entrepreneurship',
      'رائد أعمال', 'entrepreneur',
      'تمويل', 'funding',
      'مستثمر', 'investor',
      'MVP', 'pitch',
      'حاضنة', 'incubator',
      'مسرعة', 'accelerator',
      'freelance', 'عمل حر',
      'دخل إضافي', 'side hustle'
    ],
    
    adjacentContent: [
      { type: 'entrepreneurship', examples: ['قنوات ريادة أعمال', 'Y Combinator'] },
      { type: 'business_stories', examples: ['قصص نجاح', 'How I Built This'] }
    ],
    
    winningTopics: [
      'كيف تبدأ مشروعك بدون رأس مال؟',
      'قصص نجاح startups عربية',
      'أخطاء رواد الأعمال المبتدئين'
    ],
    
    contentGaps: [],
    trend: 'growing'
  }
};

// ============================================
// PERSONA SERVING TRACKER
// ============================================
export const PERSONA_SERVING_GOALS = {
  // Ideal content distribution per week
  weekly: {
    'geopolitics': 3,      // Most popular
    'gulf_oil': 2,
    'egyptian_business': 2,
    'investor': 2,
    'tech_future': 1,
    'maghreb': 1,
    'employee': 2,         // New
    'student_entrepreneur': 1  // New
  },
  
  // Minimum per month
  monthly: {
    'geopolitics': 10,
    'gulf_oil': 6,
    'egyptian_business': 6,
    'investor': 6,
    'tech_future': 4,
    'maghreb': 4,
    'employee': 6,         // New
    'student_entrepreneur': 4  // New
  }
};

