/**
 * @deprecated This file is deprecated. Use Topic Intelligence instead.
 * 
 * Migration guide:
 * - calculateKeywordScore() → Use calculateDNAScore() from dna-scoring.js
 * - getKeywordWeight() → Use generateTopicFingerprint() entities
 * - matchKeywords() → Use compareTopics() from topicIntelligence.js
 * - calculateMatchScore() → Use Topic Intelligence entity matching
 * 
 * This file is kept for backward compatibility only.
 * All new code should use Topic Intelligence functions.
 */

import { generateTopicFingerprint, compareTopics } from '../topicIntelligence';
import { calculateDNAScore } from '../dna-scoring';

console.warn('⚠️ keywordWeights.js is deprecated. Please migrate to Topic Intelligence.');

/**
 * Keyword weights based on specificity and importance
 * Built from actual channel DNA entities
 * Higher weight = more specific/valuable for matching
 * 
 * @deprecated Use Topic Intelligence entity extraction instead
 */

export const KEYWORD_WEIGHTS = {
  // ============================================
  // === PEOPLE / LEADERS (weight: 10) ===
  // ============================================
  
  // US Leaders
  'trump': 10, 'ترامب': 10, 'ترمب': 10, 'دونالد ترامب': 10, 'دونالد ترمب': 10,
  'biden': 10, 'بايدن': 10, 'جو بايدن': 10,
  'musk': 10, 'ماسك': 10, 'إيلون ماسك': 10, 'ايلون ماسك': 10,
  'powell': 10, 'باول': 10, 'جيروم باول': 10,
  
  // Russian Leaders
  'putin': 10, 'بوتين': 10, 'فلاديمير بوتين': 10,
  
  // Chinese Leaders
  'xi': 10, 'شي': 10, 'شي جين بينغ': 10,
  
  // Middle East Leaders
  'netanyahu': 10, 'نتنياهو': 10, 'بنيامين نتنياهو': 10,
  'khamenei': 10, 'خامنئي': 10, 'علي خامنئي': 10,
  'mbs': 10, 'محمد بن سلمان': 10,
  'maduro': 10, 'مادورو': 10,
  'zelensky': 10, 'زيلينسكي': 10,
  'assad': 10, 'الأسد': 10, 'بشار الأسد': 10,
  'nasrallah': 10, 'نصر الله': 10, 'حسن نصر الله': 10,
  'rouhani': 10, 'روحاني': 10, 'حسن روحاني': 10,
  'macron': 10, 'ماكرون': 10,
  'trudeau': 10, 'ترودو': 10, 'جاستن ترودو': 10, 'جوستين ترودو': 10,
  'zuckerberg': 10, 'زوكربيرغ': 10, 'مارك زوكربيرغ': 10,
  'scholz': 10, 'شولز': 10,
  
  // ============================================
  // === COUNTRIES (weight: 10) ===
  // ============================================
  
  'usa': 10, 'america': 10, 'أمريكا': 10, 'امريكا': 10, 'الولايات المتحدة': 10, 'الولايات المتحدة الأمريكية': 10,
  'china': 10, 'الصين': 10, 'صين': 10,
  'russia': 10, 'روسيا': 10,
  'iran': 10, 'إيران': 10, 'ايران': 10, 'طهران': 10,
  'israel': 10, 'إسرائيل': 10, 'اسرائيل': 10,
  'saudi': 10, 'السعودية': 10, 'سعودية': 10,
  'uae': 10, 'الإمارات': 10, 'الامارات': 10,
  'qatar': 10, 'قطر': 10,
  'turkey': 10, 'تركيا': 10,
  'ukraine': 10, 'أوكرانيا': 10, 'اوكرانيا': 10,
  'taiwan': 10, 'تايوان': 10,
  'india': 10, 'الهند': 10,
  'pakistan': 10, 'باكستان': 10,
  'japan': 10, 'اليابان': 10,
  'germany': 10, 'ألمانيا': 10, 'المانيا': 10,
  'france': 10, 'فرنسا': 10,
  'uk': 10, 'britain': 10, 'بريطانيا': 10,
  'europe': 10, 'أوروبا': 10, 'اوروبا': 10,
  'canada': 10, 'كندا': 10,
  'mexico': 10, 'المكسيك': 10,
  'venezuela': 10, 'فنزويلا': 10,
  'syria': 10, 'سوريا': 10,
  'iraq': 10, 'العراق': 10,
  'egypt': 10, 'مصر': 10,
  'yemen': 10, 'اليمن': 10,
  'lebanon': 10, 'لبنان': 10,
  'jordan': 10, 'الأردن': 10,
  'palestine': 10, 'فلسطين': 10,
  'gaza': 10, 'غزة': 10, 'قطاع غزة': 10,
  'afghanistan': 10, 'أفغانستان': 10,
  'north korea': 10, 'كوريا الشمالية': 10,
  'south korea': 10, 'كوريا الجنوبية': 10,
  'south africa': 10, 'جنوب أفريقيا': 10,
  'greenland': 10, 'غرينلاند': 10,
  'denmark': 10, 'الدنمارك': 10,
  'norway': 10, 'النرويج': 10,
  'netherlands': 10, 'هولندا': 10,
  'spain': 10, 'إسبانيا': 10,
  'italy': 10, 'إيطاليا': 10,
  'ethiopia': 10, 'إثيوبيا': 10,
  'serbia': 10, 'صربيا': 10,
  
  // ============================================
  // === ORGANIZATIONS (weight: 10) ===
  // ============================================
  
  // Financial Institutions
  'fed': 10, 'federal reserve': 10, 'الفيدرالي': 10, 'فيدرالي': 10, 'الاحتياطي الفيدرالي': 10, 'مجلس الاحتياطي الفيدرالي': 10,
  'ecb': 10, 'المركزي الأوروبي': 10, 'البنك المركزي': 10,
  'imf': 10, 'صندوق النقد': 10, 'صندوق النقد الدولي': 10,
  'world bank': 10, 'البنك الدولي': 10,
  'opec': 10, 'أوبك': 10, 'اوبك': 10,
  'brics': 10, 'بريكس': 10,
  
  // Military/Intelligence
  'nato': 10, 'الناتو': 10, 'حلف الناتو': 10, 'قوات الناتو': 10,
  'mossad': 10, 'موساد': 10, 'الموساد': 10,
  'cia': 10,
  'nsa': 10,
  'idf': 10, 'الجيش الإسرائيلي': 10,
  'irgc': 10, 'الحرس الثوري': 10, 'الحرس الثوري الإيراني': 10,
  'hezbollah': 10, 'حزب الله': 10,
  'hamas': 10, 'حماس': 10,
  'houthis': 10, 'الحوثيون': 10, 'الحوثيين': 10,
  'taliban': 10, 'طالبان': 10,
  
  // Tech Companies
  'tesla': 10, 'تسلا': 10,
  'apple': 10, 'آبل': 10, 'ابل': 10,
  'google': 10, 'جوجل': 10, 'غوغل': 10,
  'meta': 10, 'ميتا': 10,
  'facebook': 10, 'فيسبوك': 10,
  'microsoft': 10, 'مايكروسوفت': 10,
  'amazon': 10, 'أمازون': 10, 'امازون': 10,
  'nvidia': 10, 'نفيديا': 10, 'إنفيديا': 10, 'انفيديا': 10,
  'openai': 10, 'أوبن إيه آي': 10,
  'deepseek': 10, 'ديب سيك': 10,
  'chatgpt': 10, 'شات جي بي تي': 10,
  'huawei': 10, 'هواوي': 10,
  'tsmc': 10,
  'arm': 10,
  'softbank': 10, 'سوفت بانك': 10,
  'spacex': 10, 'سبيس إكس': 10,
  'starlink': 10, 'ستارلينك': 10,
  'byd': 10, 'بي واي دي': 10,
  
  // Other Companies
  'aramco': 10, 'أرامكو': 10, 'أرامكو السعودية': 10,
  'adnoc': 10,
  'maersk': 10, 'مايرسك': 10,
  'caterpillar': 10, 'كاتربيلر': 10,
  'boeing': 10, 'بوينغ': 10,
  'lockheed': 10, 'لوكهيد': 10,
  'bmw': 10,
  'volkswagen': 10, 'فولكس فاجن': 10,
  'wells fargo': 10,
  
  // Sovereign Wealth Funds
  'pif': 10, 'صندوق الاستثمارات العامة': 10,
  'norwegian wealth fund': 10, 'صندوق الثروة السيادي النرويجي': 10, 'صندوق الثروة النرويجي': 10,
  
  // ============================================
  // === GEOPOLITICAL TOPICS (weight: 8) ===
  // ============================================
  
  'suez canal': 8, 'قناة السويس': 8,
  'panama canal': 8, 'قناة بنما': 8,
  'red sea': 8, 'البحر الأحمر': 8,
  'strait of hormuz': 8, 'مضيق هرمز': 8,
  'south china sea': 8, 'بحر الصين الجنوبي': 8,
  'arctic': 8, 'القطب الشمالي': 8,
  'belt and road': 8, 'الحزام والطريق': 8, 'استراتيجية الحزام والطريق': 8,
  'middle east': 8, 'الشرق الأوسط': 8,
  'kashmir': 8, 'كشمير': 8,
  'dimona': 8, 'ديمونا': 8, 'مفاعل ديمونا': 8,
  'iron dome': 8, 'القبة الحديدية': 8, 'القباب الحديدية': 8,
  'golden dome': 8, 'القبة الذهبية': 8,
  
  // ============================================
  // === MILITARY/WEAPONS (weight: 8) ===
  // ============================================
  
  'f-35': 8, 'إف-35': 8, 'اف-35': 8,
  'nuclear': 8, 'نووي': 8, 'النووي': 8, 'نووية': 8,
  'nuclear weapons': 8, 'أسلحة نووية': 8, 'الأسلحة النووية': 8,
  'nuclear program': 8, 'برنامج نووي': 8, 'البرنامج النووي': 8, 'برامج نووية': 8,
  'missile': 8, 'صاروخ': 8, 'صواريخ': 8,
  'drone': 8, 'مسيرة': 8, 'مسيرات': 8, 'المسيرات': 8, 'درون': 8,
  'patriot': 8, 'باتريوت': 8, 'الباتريوت': 8,
  'hypersonic': 8,
  'icbm': 8,
  'air defense': 8, 'دفاع جوي': 8, 'الدفاع الجوي': 8,
  
  // ============================================
  // === COMMODITIES (weight: 7) ===
  // ============================================
  
  'oil': 7, 'نفط': 7, 'النفط': 7, 'بترول': 7, 'البترول': 7, 'petroleum': 7, 'crude': 7,
  'gas': 7, 'غاز': 7, 'الغاز': 7, 'lng': 7, 'الغاز الطبيعي المسال': 7, 'غاز طبيعي': 7,
  'gold': 7, 'ذهب': 7, 'الذهب': 7,
  'silver': 7, 'فضة': 7, 'الفضة': 7,
  'copper': 7, 'نحاس': 7,
  'rare earths': 7, 'معادن نادرة': 7,
  'uranium': 7, 'يورانيوم': 7,
  'lithium': 7, 'ليثيوم': 7,
  'wheat': 7, 'قمح': 7,
  
  // ============================================
  // === CURRENCY/FINANCE (weight: 7) ===
  // ============================================
  
  'dollar': 7, 'دولار': 7, 'الدولار': 7,
  'euro': 7, 'يورو': 7, 'اليورو': 7,
  'yuan': 7, 'يوان': 7, 'اليوان': 7, 'اليوان الرقمي': 7,
  'ruble': 7, 'روبل': 7,
  'pound': 7, 'جنيه': 7, 'الجنيه': 7, 'الجنيه المصري': 7,
  'bitcoin': 7, 'بيتكوين': 7,
  'crypto': 7, 'كريبتو': 7, 'عملات رقمية': 7,
  'petrodollar': 7, 'البترودولار': 7,
  'bonds': 7, 'سندات': 7, 'السندات': 7,
  'stocks': 7, 'أسهم': 7, 'الأسهم': 7,
  'treasury': 7, 'الخزانة': 7, 'الخزانة الأمريكية': 7,
  
  // ============================================
  // === ECONOMIC TERMS (weight: 6) ===
  // ============================================
  
  'inflation': 6, 'تضخم': 6, 'التضخم': 6,
  'recession': 6, 'ركود': 6,
  'gdp': 6, 'الناتج المحلي': 6,
  'interest rate': 6, 'فائدة': 6, 'الفائدة': 6, 'أسعار الفائدة': 6,
  'tariff': 6, 'رسوم': 6, 'جمارك': 6, 'تعريفة': 6, 'التعريفات الجمركية': 6, 'الرسوم الجمركية': 6,
  'sanctions': 6, 'عقوبات': 6, 'العقوبات': 6, 'عقوبات اقتصادية': 6,
  'embargo': 6, 'حظر': 6,
  'debt': 6, 'دين': 6, 'ديون': 6, 'الديون': 6,
  'deficit': 6, 'عجز': 6,
  'devaluation': 6, 'تعويم': 6, 'التعويم': 6,
  'trade war': 6, 'حرب تجارية': 6, 'الحرب التجارية': 6,
  'economic war': 6, 'حرب اقتصادية': 6,
  
  // ============================================
  // === TECH TERMS (weight: 6) ===
  // ============================================
  
  'ai': 6, 'artificial intelligence': 6, 'ذكاء اصطناعي': 6, 'الذكاء الاصطناعي': 6,
  'semiconductor': 6, 'chip': 6, 'chips': 6, 'رقائق': 6, 'شرائح': 6, 'الرقائق': 6,
  'quantum': 6, 'كوانتم': 6, 'تكنولوجيا الكوانتم': 6,
  'ev': 6, 'electric vehicle': 6, 'سيارات كهربائية': 6, 'السيارات الكهربائية': 6,
  'robotics': 6, 'روبوتات': 6, 'الروبوتات': 6,
  'automation': 6, 'أتمتة': 6, 'الأتمتة': 6,
  '5g': 6,
  'cybersecurity': 6, 'أمن سيبراني': 6, 'سايبر': 6,
  
  // ============================================
  // === CONFLICT/WAR TERMS (weight: 5) ===
  // ============================================
  
  'war': 5, 'حرب': 5, 'الحرب': 5,
  'invasion': 5, 'غزو': 5,
  'attack': 5, 'هجوم': 5,
  'strike': 5, 'ضربة': 5, 'غارة': 5,
  'conflict': 5, 'صراع': 5,
  'occupation': 5, 'احتلال': 5, 'الاحتلال': 5,
  'blockade': 5, 'حصار': 5,
  'ceasefire': 5, 'وقف إطلاق النار': 5,
  'peace deal': 5, 'اتفاق سلام': 5,
  'military': 5, 'عسكري': 5, 'جيش': 5, 'الجيش': 5,
  'troops': 5, 'قوات': 5, 'قوات عسكرية': 5,
  'espionage': 5, 'تجسس': 5,
  'assassination': 5, 'اغتيال': 5, 'اغتيالات': 5,
  
  // ============================================
  // === POLITICAL EVENTS (weight: 4) ===
  // ============================================
  
  'election': 4, 'انتخابات': 4,
  'summit': 4, 'قمة': 4,
  'deal': 4, 'صفقة': 4,
  'agreement': 4, 'اتفاق': 4, 'اتفاقية': 4,
  'treaty': 4, 'معاهدة': 4,
  'coup': 4, 'انقلاب': 4,
  'protests': 4, 'احتجاجات': 4, 'تظاهرات': 4,
  'crisis': 4, 'أزمة': 4, 'ازمة': 4,
  'collapse': 4, 'انهيار': 4,
  
  // ============================================
  // === MARKET MOVEMENTS (weight: 3) ===
  // ============================================
  
  'surge': 3, 'ارتفاع': 3,
  'plunge': 3, 'drop': 3, 'انخفاض': 3, 'هبوط': 3,
  'rally': 3,
  'crash': 3, 'انهيار': 3,
  'boom': 3,
  'bust': 3,
  'bull': 3,
  'bear': 3,
  
  // ============================================
  // === LOW VALUE (weight: 2) ===
  // ============================================
  
  'economy': 2, 'اقتصاد': 2, 'الاقتصاد': 2, 'economic': 2, 'اقتصادي': 2,
  'market': 2, 'سوق': 2, 'الأسواق': 2, 'أسواق': 2,
  'price': 2, 'سعر': 2, 'أسعار': 2, 'الأسعار': 2,
  'trade': 2, 'تجارة': 2, 'تجاري': 2, 'التجارة': 2,
  'growth': 2, 'نمو': 2,
  'policy': 2, 'سياسة': 2,
  'investment': 2, 'استثمار': 2, 'استثمارات': 2,
  'government': 2, 'حكومة': 2, 'الحكومة': 2,
  'president': 2, 'رئيس': 2, 'الرئيس': 2,
  'minister': 2, 'وزير': 2,
  'report': 2, 'تقرير': 2,
  'company': 2, 'شركة': 2, 'شركات': 2,
  'bank': 2, 'بنك': 2, 'بنوك': 2, 'البنوك': 2,
  'technology': 2, 'تكنولوجيا': 2, 'تقنية': 2,
  'industry': 2, 'صناعة': 2,
  
  // ============================================
  // === GENERIC/STOP WORDS (weight: 0) ===
  // ============================================
  
  // Generic nouns
  'world': 0, 'العالم': 0, 'عالم': 0,
  'more': 0, 'اكثر': 0, 'أكثر': 0,
  'year': 0, 'سنة': 0, 'عام': 0, 'years': 0, 'أعوام': 0,
  'new': 0, 'جديد': 0, 'جديدة': 0,
  'first': 0, 'أول': 0, 'اول': 0,
  'last': 0, 'آخر': 0, 'أخير': 0,
  'time': 0, 'وقت': 0,
  'day': 0, 'يوم': 0,
  'week': 0, 'أسبوع': 0,
  'month': 0, 'شهر': 0,
  'people': 0, 'ناس': 0, 'الناس': 0,
  'thing': 0, 'things': 0, 'شيء': 0,
  'way': 0, 'طريقة': 0,
  'part': 0, 'جزء': 0,
  'place': 0, 'مكان': 0,
  'case': 0, 'حالة': 0,
  'point': 0, 'نقطة': 0,
  'fact': 0, 'حقيقة': 0,
  'number': 0, 'رقم': 0,
  'group': 0, 'مجموعة': 0,
  'problem': 0, 'مشكلة': 0,
  'question': 0, 'سؤال': 0,
  
  // Generic verbs (only showing a sample - the full list is too long)
  'say': 0, 'says': 0, 'said': 0, 'قال': 0, 'يقول': 0, 'تقول': 0,
  'make': 0, 'makes': 0, 'made': 0, 'يجعل': 0,
  'take': 0, 'takes': 0, 'took': 0, 'يأخذ': 0,
  'get': 0, 'gets': 0, 'got': 0, 'يحصل': 0,
  'come': 0, 'comes': 0, 'came': 0, 'يأتي': 0,
  'go': 0, 'goes': 0, 'went': 0, 'يذهب': 0,
  'see': 0, 'sees': 0, 'saw': 0, 'يرى': 0,
  'know': 0, 'knows': 0, 'knew': 0, 'يعرف': 0,
  'think': 0, 'thinks': 0, 'thought': 0, 'يفكر': 0,
  'want': 0, 'wants': 0, 'يريد': 0,
  'use': 0, 'uses': 0, 'used': 0, 'يستخدم': 0,
  'find': 0, 'finds': 0, 'found': 0, 'يجد': 0,
  'give': 0, 'gives': 0, 'gave': 0, 'يعطي': 0,
  'tell': 0, 'tells': 0, 'told': 0, 'يخبر': 0,
  'work': 0, 'works': 0, 'يعمل': 0,
  'call': 0, 'calls': 0, 'يدعو': 0,
  'try': 0, 'tries': 0, 'يحاول': 0,
  'need': 0, 'needs': 0, 'يحتاج': 0,
  'feel': 0, 'feels': 0, 'يشعر': 0,
  'become': 0, 'becomes': 0, 'يصبح': 0,
  'leave': 0, 'leaves': 0, 'يغادر': 0,
  'put': 0, 'puts': 0, 'يضع': 0,
  'mean': 0, 'means': 0, 'يعني': 0,
  'keep': 0, 'keeps': 0, 'يحافظ': 0,
  'let': 0, 'lets': 0,
  'begin': 0, 'begins': 0, 'يبدأ': 0,
  'seem': 0, 'seems': 0, 'يبدو': 0,
  'help': 0, 'helps': 0, 'يساعد': 0,
  'show': 0, 'shows': 0, 'يظهر': 0,
  'hear': 0, 'hears': 0, 'يسمع': 0,
  'play': 0, 'plays': 0, 'يلعب': 0,
  'run': 0, 'runs': 0, 'يركض': 0,
  'move': 0, 'moves': 0, 'يتحرك': 0,
  'live': 0, 'lives': 0, 'يعيش': 0,
  'believe': 0, 'believes': 0, 'يعتقد': 0,
  'hold': 0, 'holds': 0, 'يمسك': 0,
  'bring': 0, 'brings': 0, 'يجلب': 0,
  'happen': 0, 'happens': 0, 'يحدث': 0,
  'write': 0, 'writes': 0, 'يكتب': 0,
  'provide': 0, 'provides': 0, 'يوفر': 0,
  'sit': 0, 'sits': 0, 'يجلس': 0,
  'stand': 0, 'stands': 0, 'يقف': 0,
  'lose': 0, 'loses': 0, 'يخسر': 0,
  'pay': 0, 'pays': 0, 'يدفع': 0,
  'meet': 0, 'meets': 0, 'يقابل': 0,
  'include': 0, 'includes': 0, 'يتضمن': 0,
  'continue': 0, 'continues': 0, 'يستمر': 0,
  'set': 0, 'sets': 0,
  'learn': 0, 'learns': 0, 'يتعلم': 0,
  'change': 0, 'changes': 0, 'يتغير': 0,
  'lead': 0, 'leads': 0, 'يقود': 0,
  'understand': 0, 'understands': 0, 'يفهم': 0,
  'watch': 0, 'watches': 0, 'يشاهد': 0,
  'follow': 0, 'follows': 0, 'يتبع': 0,
  'stop': 0, 'stops': 0, 'يتوقف': 0,
  'create': 0, 'creates': 0, 'يخلق': 0,
  'speak': 0, 'speaks': 0, 'يتكلم': 0,
  'read': 0, 'reads': 0, 'يقرأ': 0,
  'allow': 0, 'allows': 0, 'يسمح': 0,
  'add': 0, 'adds': 0, 'يضيف': 0,
  'spend': 0, 'spends': 0, 'ينفق': 0,
  'grow': 0, 'grows': 0, 'ينمو': 0,
  'open': 0, 'opens': 0, 'يفتح': 0,
  'walk': 0, 'walks': 0, 'يمشي': 0,
  'win': 0, 'wins': 0, 'يفوز': 0,
  'offer': 0, 'offers': 0, 'يعرض': 0,
  'remember': 0, 'remembers': 0, 'يتذكر': 0,
  'love': 0, 'loves': 0, 'يحب': 0,
  'consider': 0, 'considers': 0, 'يعتبر': 0,
  'appear': 0, 'appears': 0, 'يظهر': 0,
  'buy': 0, 'buys': 0, 'يشتري': 0,
  'wait': 0, 'waits': 0, 'ينتظر': 0,
  'serve': 0, 'serves': 0, 'يخدم': 0,
  'die': 0, 'dies': 0, 'يموت': 0,
  'send': 0, 'sends': 0, 'يرسل': 0,
  'expect': 0, 'expects': 0, 'يتوقع': 0,
  'build': 0, 'builds': 0, 'يبني': 0,
  'stay': 0, 'stays': 0, 'يبقى': 0,
  'fall': 0, 'falls': 0, 'يسقط': 0,
  'cut': 0, 'cuts': 0, 'يقطع': 0,
  'reach': 0, 'reaches': 0, 'يصل': 0,
  'kill': 0, 'kills': 0, 'يقتل': 0,
  'remain': 0, 'remains': 0, 'يتبقى': 0,
  
  // Modals
  'may': 0, 'might': 0, 'could': 0, 'would': 0, 'should': 0,
  'will': 0, 'can': 0, 'must': 0,
  
  // Question words
  'how': 0, 'كيف': 0,
  'why': 0, 'لماذا': 0,
  'what': 0, 'ماذا': 0, 'ما': 0,
  'when': 0, 'متى': 0,
  'where': 0, 'أين': 0, 'اين': 0,
  'who': 0, 'من': 0,
  'which': 0, 'أي': 0,
  
  // Pronouns & Determiners
  'this': 0, 'هذا': 0, 'هذه': 0,
  'that': 0, 'ذلك': 0, 'تلك': 0,
  'these': 0, 'هؤلاء': 0,
  'those': 0,
  'i': 0, 'أنا': 0,
  'you': 0, 'أنت': 0, 'انت': 0,
  'he': 0, 'هو': 0,
  'she': 0, 'هي': 0,
  'it': 0,
  'we': 0, 'نحن': 0,
  'they': 0, 'هم': 0,
  'my': 0,
  'your': 0,
  'his': 0,
  'her': 0,
  'its': 0,
  'our': 0,
  'their': 0,
  
  // Prepositions
  'about': 0, 'عن': 0, 'حول': 0,
  'after': 0, 'بعد': 0,
  'before': 0, 'قبل': 0,
  'between': 0, 'بين': 0,
  'during': 0, 'خلال': 0,
  'through': 0,
  'against': 0, 'ضد': 0,
  'into': 0,
  'over': 0, 'فوق': 0,
  'under': 0, 'تحت': 0,
  'on': 0, 'على': 0,
  'in': 0, 'في': 0,
  'to': 0, 'إلى': 0,
  'from': 0,
  'with': 0, 'مع': 0,
  'by': 0,
  'for': 0,
  'at': 0,
  'as': 0,
  'of': 0,
  
  // Conjunctions
  'and': 0, 'و': 0,
  'or': 0, 'أو': 0, 'او': 0,
  'but': 0, 'لكن': 0,
  'if': 0, 'إذا': 0, 'اذا': 0, 'لو': 0,
  'because': 0, 'لأن': 0,
  'while': 0, 'بينما': 0,
  'although': 0, 'رغم': 0,
  'so': 0, 'لذلك': 0,
  'then': 0, 'ثم': 0,
  
  // Adverbs
  'not': 0, 'لا': 0, 'ليس': 0,
  'no': 0,
  'yes': 0, 'نعم': 0,
  'now': 0, 'الآن': 0,
  'today': 0, 'اليوم': 0,
  'again': 0, 'مجددا': 0,
  'here': 0, 'هنا': 0,
  'there': 0, 'هناك': 0,
  'just': 0, 'فقط': 0,
  'also': 0, 'أيضا': 0, 'ايضا': 0,
  'only': 0,
  'very': 0, 'جدا': 0,
  'well': 0,
  'back': 0,
  'even': 0, 'حتى': 0,
  'still': 0,
  'already': 0,
  'always': 0, 'دائما': 0,
  'never': 0, 'أبدا': 0,
  'often': 0, 'غالبا': 0,
  'soon': 0, 'قريبا': 0,
  
  // Adjectives
  'good': 0, 'جيد': 0,
  'bad': 0, 'سيء': 0,
  'great': 0, 'عظيم': 0,
  'big': 0, 'كبير': 0,
  'small': 0, 'صغير': 0,
  'large': 0,
  'high': 0, 'عالي': 0,
  'low': 0, 'منخفض': 0,
  'long': 0, 'طويل': 0,
  'short': 0, 'قصير': 0,
  'old': 0, 'قديم': 0,
  'young': 0, 'شاب': 0,
  'important': 0, 'مهم': 0,
  'different': 0, 'مختلف': 0,
  'same': 0, 'نفس': 0,
  'other': 0, 'آخر': 0,
  'own': 0,
  'right': 0, 'صحيح': 0,
  'wrong': 0, 'خاطئ': 0,
  'possible': 0, 'ممكن': 0,
  'certain': 0,
  'true': 0, 'صحيح': 0,
  'real': 0, 'حقيقي': 0,
  'full': 0, 'كامل': 0,
  'special': 0, 'خاص': 0,
  'free': 0, 'مجاني': 0,
  'clear': 0, 'واضح': 0,
  'sure': 0, 'متأكد': 0,
  'human': 0, 'بشري': 0,
  'local': 0, 'محلي': 0,
  'international': 0, 'دولي': 0,
  'global': 0, 'عالمي': 0,
  'national': 0, 'وطني': 0,
  'public': 0, 'عام': 0,
  'private': 0, 'خاص': 0,
  'political': 0, 'سياسي': 0,
  'social': 0, 'اجتماعي': 0,
  'major': 0, 'رئيسي': 0,
  'recent': 0, 'حديث': 0,
  'early': 0, 'مبكر': 0,
  'late': 0, 'متأخر': 0,
  'hard': 0, 'صعب': 0,
  'easy': 0, 'سهل': 0,
  
  // Articles (English)
  'the': 0, 'a': 0, 'an': 0,
  
  // Arabic articles & common words
  'ال': 0, 'هل': 0, 'أن': 0, 'ان': 0, 'قد': 0,
  'كان': 0, 'كانت': 0, 'يكون': 0, 'تكون': 0,
  'إن': 0, 'لقد': 0, 'عند': 0, 'منذ': 0,
  
  // News-specific stop words
  'news': 0, 'أخبار': 0, 'خبر': 0,
  'breaking': 0, 'عاجل': 0,
  'update': 0, 'تحديث': 0,
  'latest': 0, 'أحدث': 0,
  'official': 0, 'رسمي': 0, 'رسميا': 0,
  'source': 0, 'مصدر': 0, 'مصادر': 0,
  'report': 0, 'تقرير': 0,
  'analysis': 0, 'تحليل': 0,
  'exclusive': 0, 'حصري': 0,
};

// Default weight for keywords not in the list
export const DEFAULT_KEYWORD_WEIGHT = 3;

// Minimum score required for a valid match
export const MIN_MATCH_SCORE = 12;

// Minimum weight for a keyword to be considered "high value"
export const HIGH_VALUE_THRESHOLD = 6;

/**
 * Normalize Arabic text (remove diacritics, normalize alef/ya variations)
 * Duplicated here to avoid circular dependency with multiSignalScoring.js
 */
function normalizeArabicText(text) {
  if (!text || typeof text !== 'string') return text || '';
  
  return text
    // Remove Arabic diacritics (tashkeel)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize alef variations (أ, إ, آ, ا) to ا
    .replace(/[أإآ]/g, 'ا')
    // Normalize ya variations (ي, ى) to ي
    .replace(/ى/g, 'ي')
    // Normalize ta marbuta (ة) to ه
    .replace(/ة/g, 'ه')
    .trim();
}

/**
 * Keyword translation map (duplicated from multiSignalScoring to avoid circular dependency)
 * Used to map translations to root concepts
 */
const KEYWORD_TRANSLATIONS = {
  'oil': ['oil', 'نفط', 'بترول', 'petroleum', 'crude'],
  'trump': ['trump', 'ترامب', 'ترمب'],
  'china': ['china', 'الصين', 'صين', 'chinese'],
  'venezuela': ['venezuela', 'فنزويلا'],
  'price': ['price', 'سعر', 'أسعار', 'prices'],
  'economy': ['economy', 'اقتصاد', 'الاقتصاد', 'economic'],
  'dollar': ['dollar', 'دولار', 'الدولار'],
  'gold': ['gold', 'ذهب', 'الذهب'],
  'iran': ['iran', 'إيران', 'ايران'],
  'russia': ['russia', 'روسيا'],
  'war': ['war', 'حرب', 'الحرب'],
  'tariff': ['tariff', 'رسوم', 'جمارك', 'tariffs'],
  'sanctions': ['sanctions', 'عقوبات'],
  'inflation': ['inflation', 'تضخم', 'التضخم'],
  'bank': ['bank', 'بنك', 'banking', 'مصرف'],
  'stock': ['stock', 'stocks', 'أسهم', 'سهم', 'بورصة'],
  'market': ['market', 'سوق', 'أسواق'],
  'energy': ['energy', 'طاقة', 'الطاقة'],
  'gas': ['gas', 'غاز', 'الغاز'],
  'investment': ['investment', 'استثمار', 'استثمارات']
};

/**
 * Get the root concept for a keyword (handles translations)
 * e.g., "ترامب" -> "trump", "نفط" -> "oil"
 */
export function getRootConcept(keyword) {
  if (!keyword || typeof keyword !== 'string') return '';
  
  const lowerKeyword = normalizeArabicText(keyword).toLowerCase().trim();
  
  // Check if this keyword belongs to a translation group
  for (const [root, translations] of Object.entries(KEYWORD_TRANSLATIONS)) {
    if (Array.isArray(translations)) {
      const lowerTranslations = translations.map(t => normalizeArabicText(t).toLowerCase().trim());
      if (lowerTranslations.includes(lowerKeyword)) {
        return root.toLowerCase();
      }
    }
    if (root.toLowerCase() === lowerKeyword) {
      return root.toLowerCase();
    }
  }
  
  return lowerKeyword;
}

/**
 * Get the weight for a keyword
 */
/**
 * Get keyword weight - LEGACY (kept for backward compatibility)
 * @deprecated Use generateTopicFingerprint() for entity extraction instead
 */
let deprecationWarningsShown = {
  getKeywordWeight: false,
  calculateMatchScore: false
};

export function getKeywordWeight(keyword) {
  // Only show deprecation warning once per session (not for every call)
  if (!deprecationWarningsShown.getKeywordWeight) {
    console.warn('⚠️ getKeywordWeight is deprecated. Use generateTopicFingerprint() instead.');
    console.warn('   (This warning will only appear once - function is still used for backwards compatibility)');
    deprecationWarningsShown.getKeywordWeight = true;
  }
  
  if (!keyword || typeof keyword !== 'string') return DEFAULT_KEYWORD_WEIGHT;
  
  const lowerKeyword = normalizeArabicText(keyword).toLowerCase().trim();
  
  // Check exact match first
  if (KEYWORD_WEIGHTS.hasOwnProperty(lowerKeyword)) {
    return KEYWORD_WEIGHTS[lowerKeyword];
  }
  
  // Check if any translation has a weight
  const root = getRootConcept(keyword);
  if (root && KEYWORD_WEIGHTS.hasOwnProperty(root)) {
    return KEYWORD_WEIGHTS[root];
  }
  
  return DEFAULT_KEYWORD_WEIGHT;
}

/**
 * Calculate match score for a set of matched keywords - LEGACY
 * @deprecated Use Topic Intelligence compareTopics() or entity matching instead
 * @param {string[]} matchedKeywords - Array of matched keywords
 * @param {string[]} excludedNames - Optional array of excluded names (channel/source names) to filter out
 */
export function calculateMatchScore(matchedKeywords, excludedNames = []) {
  // Only show deprecation warning once per session (not for every call)
  if (!deprecationWarningsShown.calculateMatchScore) {
    console.warn('⚠️ calculateMatchScore is deprecated. Use Topic Intelligence compareTopics() or entity matching instead.');
    console.warn('   (This warning will only appear once - function is still used for backwards compatibility)');
    deprecationWarningsShown.calculateMatchScore = true;
  }
  
  if (!matchedKeywords || matchedKeywords.length === 0) {
    return {
      score: 0,
      conceptCount: 0,
      concepts: [],
      hasHighValueConcept: false,
      hasVeryHighValueConcept: false,
      isValidMatch: false,
      debug: 'No keywords provided'
    };
  }
  
  // Filter out channel/source names if provided
  // FIXED: Only filter exact matches or require minimum length to avoid filtering common words
  let filteredKeywords = matchedKeywords;
  if (excludedNames && excludedNames.length > 0) {
    // Common words that should NOT be filtered (even if they match excluded names)
    const COMMON_WORDS = ['اقتصاد', 'economy', 'الاقتصاد', 'economic', 'اقتصادي', 'news', 'أخبار', 'channel', 'قناة'];
    
    filteredKeywords = matchedKeywords.filter(keyword => {
      if (!keyword || typeof keyword !== 'string') return false;
      const lower = keyword.toLowerCase().trim();
      
      // Skip filtering if keyword is a common word (too generic to filter)
      if (COMMON_WORDS.some(cw => lower === cw.toLowerCase())) {
        return true; // Keep common words, don't filter them
      }
      
      // Check if keyword matches any excluded name
      // FIXED: Only exact match for short/common words, allow substring for longer names
      const isExcluded = excludedNames.some(excluded => {
        // For short excluded names (< 5 chars), require exact match only
        if (excluded.length < 5) {
          return lower === excluded;
        }
        
        // For longer names, check exact match or if keyword is exactly the excluded name
        if (lower === excluded) return true;
        
        // For compound names (e.g., "al arabiya news"), allow substring matching
        // But only if the keyword is longer and clearly contains the source name
        if (lower.length > excluded.length + 3 && lower.includes(excluded)) {
          return true;
        }
        
        return false;
      });
      
      return !isExcluded;
    });
    
    // Log filtered keywords for debugging (reduced verbosity)
    const filteredOut = matchedKeywords.filter(k => !filteredKeywords.includes(k));
    // Only log if it's a significant filter (more than 2 keywords filtered)
    // This reduces noise when processing many signals
    if (filteredOut.length > 2) {
      console.log(`🚫 Filtered out ${filteredOut.length} channel/source names:`, filteredOut.slice(0, 3));
    }
  }
  
  // If all keywords were filtered out, return invalid match
  if (filteredKeywords.length === 0) {
    return {
      score: 0,
      conceptCount: 0,
      concepts: [],
      hasHighValueConcept: false,
      hasVeryHighValueConcept: false,
      isValidMatch: false,
      debug: `All keywords filtered out (channel/source names): ${matchedKeywords.join(', ')}`
    };
  }
  
  // Group by root concept and keep highest weight for each
  const conceptScores = new Map();
  const conceptKeywords = new Map(); // Track original keywords for each concept
  
  for (const keyword of filteredKeywords) {
    const root = getRootConcept(keyword);
    const weight = getKeywordWeight(keyword);
    
    // Skip zero-weight keywords entirely
    if (weight === 0) {
      continue;
    }
    
    // Keep highest weight for each concept
    if (!conceptScores.has(root) || conceptScores.get(root) < weight) {
      conceptScores.set(root, weight);
    }
    
    // Track all keywords that map to this concept
    if (!conceptKeywords.has(root)) {
      conceptKeywords.set(root, []);
    }
    conceptKeywords.get(root).push(keyword);
  }
  
  // Calculate total score
  let totalScore = 0;
  let hasHighValueConcept = false;
  let hasVeryHighValueConcept = false;
  const concepts = [];
  
  for (const [concept, weight] of conceptScores.entries()) {
    totalScore += weight;
    concepts.push(concept);
    if (weight >= HIGH_VALUE_THRESHOLD) {
      hasHighValueConcept = true;
    }
    if (weight >= 10) {
      hasVeryHighValueConcept = true;
    }
  }
  
  // A valid match requires:
  // 1. Minimum score threshold (12)
  // 2. At least one high-value concept (weight >= 6)
  // 3. At least 2 unique concepts OR one very high value concept (10+)
  const isValidMatch = (
    totalScore >= MIN_MATCH_SCORE && 
    hasHighValueConcept &&
    (conceptScores.size >= 2 || hasVeryHighValueConcept)
  );
  
  return {
    score: totalScore,
    conceptCount: conceptScores.size,
    concepts,
    conceptKeywords: Object.fromEntries(conceptKeywords),
    hasHighValueConcept,
    hasVeryHighValueConcept,
    isValidMatch,
    debug: `Score: ${totalScore}, Concepts: ${conceptScores.size}, HighValue: ${hasHighValueConcept}, VeryHigh: ${hasVeryHighValueConcept}`
  };
}

/**
 * Check if keywords constitute a valid match
 * @param {string[]} matchedKeywords - Array of matched keywords
 * @param {string[]} excludedNames - Optional array of excluded names (channel/source names) to filter out
 */
export function hasValidKeywordMatch(matchedKeywords, excludedNames = []) {
  const result = calculateMatchScore(matchedKeywords, excludedNames);
  return result.isValidMatch;
}

/**
 * Filter matched keywords to only include valuable ones (weight > 0)
 */
export function filterValuableKeywords(keywords) {
  if (!keywords || !Array.isArray(keywords)) return [];
  return keywords.filter(k => getKeywordWeight(k) > 0);
}

/**
 * Get unique concepts from keywords (for display)
 */
export function getUniqueConcepts(matchedKeywords) {
  const result = calculateMatchScore(matchedKeywords);
  return result.concepts;
}

/**
 * Get weights for a specific channel (DNA + base weights)
 * @param {string} showId - The show ID to get channel-specific weights for
 * @returns {Promise<Record<string, number>>} Merged weights object
 */
export async function getWeightsForChannel(showId) {
  if (!showId) {
    console.warn('⚠️ No showId provided to getWeightsForChannel, using base weights');
    return KEYWORD_WEIGHTS;
  }

  try {
    // Get channel-specific entities
    const { getChannelEntities } = await import('../entities/channelEntities');
    const channelEntities = await getChannelEntities(showId);
    
    // Start with base weights
    const weights = { ...KEYWORD_WEIGHTS };
    
    // Override with DNA entities (high priority)
    for (const [entity, weight] of Object.entries(channelEntities.entityWeights)) {
      weights[entity.toLowerCase()] = weight;
    }
    
    return weights;
  } catch (error) {
    console.error('Error loading channel entities for weights:', error);
    return KEYWORD_WEIGHTS; // Fallback to base weights
  }
}

/**
 * Calculate match score using channel-specific weights
 * @param {string[]} matchedKeywords - Array of matched keywords
 * @param {string} showId - The show ID to get channel-specific weights
 * @returns {Promise<Object>} Match score result with same structure as calculateMatchScore
 */
export async function calculateMatchScoreForChannel(matchedKeywords, showId) {
  if (!matchedKeywords || matchedKeywords.length === 0) {
    return {
      score: 0,
      conceptCount: 0,
      concepts: [],
      hasHighValueConcept: false,
      hasVeryHighValueConcept: false,
      isValidMatch: false,
      debug: 'No keywords provided'
    };
  }

  // ✨ NEW: Auto-filter source names using database extraction
  const { filterOutSourceNames } = await import('../entities/sourceNameExtractor');
  const { filtered: filteredKeywords, removed } = showId 
    ? await filterOutSourceNames(matchedKeywords, showId)
    : { filtered: matchedKeywords, removed: [] };
  
  // If all keywords were filtered out, return invalid match
  if (filteredKeywords.length === 0) {
    return {
      score: 0,
      conceptCount: 0,
      concepts: [],
      hasHighValueConcept: false,
      hasVeryHighValueConcept: false,
      isValidMatch: false,
      debug: `All keywords filtered out (channel/source names): ${matchedKeywords.join(', ')}`
    };
  }

  // Get channel-specific weights
  const weights = await getWeightsForChannel(showId);
  
  // Group by root concept and keep highest weight for each
  const conceptScores = new Map();
  const conceptKeywords = new Map();
  
  for (const keyword of filteredKeywords) {
    const root = getRootConcept(keyword);
    const weight = weights[keyword.toLowerCase()] ?? weights[root] ?? DEFAULT_KEYWORD_WEIGHT;
    
    // Skip zero-weight keywords entirely
    if (weight === 0) {
      continue;
    }
    
    // Keep highest weight for each concept
    if (!conceptScores.has(root) || conceptScores.get(root) < weight) {
      conceptScores.set(root, weight);
    }
    
    // Track all keywords that map to this concept
    if (!conceptKeywords.has(root)) {
      conceptKeywords.set(root, []);
    }
    conceptKeywords.get(root).push(keyword);
  }
  
  // Calculate total score
  let totalScore = 0;
  let hasHighValueConcept = false;
  let hasVeryHighValueConcept = false;
  const concepts = [];
  
  for (const [concept, weight] of conceptScores.entries()) {
    totalScore += weight;
    concepts.push(concept);
    if (weight >= HIGH_VALUE_THRESHOLD) {
      hasHighValueConcept = true;
    }
    if (weight >= 10) {
      hasVeryHighValueConcept = true;
    }
  }
  
  // A valid match requires:
  // 1. Minimum score threshold (12)
  // 2. At least one high-value concept (weight >= 6)
  // 3. At least 2 unique concepts OR one very high value concept (10+)
  const isValidMatch = (
    totalScore >= MIN_MATCH_SCORE && 
    hasHighValueConcept &&
    (conceptScores.size >= 2 || hasVeryHighValueConcept)
  );
  
  return {
    score: totalScore,
    conceptCount: conceptScores.size,
    concepts,
    conceptKeywords: Object.fromEntries(conceptKeywords),
    hasHighValueConcept,
    hasVeryHighValueConcept,
    isValidMatch,
    debug: `Score: ${totalScore}, Concepts: ${conceptScores.size}, HighValue: ${hasHighValueConcept}, VeryHigh: ${hasVeryHighValueConcept}`
  };
}
