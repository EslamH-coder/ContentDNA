/**
 * BANNED PHRASES - Generic AI patterns to NEVER use
 */

export const BANNED_PHRASES = [
  // Generic AI mystery/secret patterns
  'الحقائق المخفية',
  'الحقيقة المخفية',
  'السر الذي',
  'الأسرار التي',
  'ما لا تعرفه',
  'ما لم يخبروك',
  'الحقيقة الصادمة',
  'الحقيقة الكاملة',
  
  // Generic AI openers (COMMON!)
  'هل تعلم أن',
  'هل تعلم ان',
  'دعني أخبرك',
  'في هذا المقال',
  'سنتعرف على',
  'اليوم سنتحدث',
  
  // Clickbait patterns
  'لن تصدق',
  'مفاجأة صادمة',
  'صدمة كبيرة',
  'كارثة قادمة',
  'خطر كبير',
  'العد التنازلي',
  'نهاية العالم',
  'ومعه خطة',        // ← من Screenshot!
  
  // Fake personalization
  'كيف سترتفع أسعارك',
  'ستؤثر على حياتك',
  'فاتورتك الشهرية',
  'مستقبلك في خطر',
  'راتبك سيتأثر',
  
  // Vague exaggeration
  'أسعار كل شيء',    // ← من Screenshot!
  'كل شيء سيتغير',
  'في خطر كبير',
  'كارثة وشيكة',
  'انهيار قريب',
  
  // Movie trailer style
  'عائد لـ',         // ← من Screenshot!
  'عائد إلى',
  '... ومعه'         // ← من Screenshot!
];

// Phrases that need NUMBERS to be valid
export const NEEDS_NUMBER = [
  'في خطر',      // OK if: "500 مليار دولار في خطر"
  'سيرتفع',      // OK if: "سيرتفع 15%"
  'سينخفض',      // OK if: "سينخفض 20%"
  'خسارة',       // OK if: "خسارة 3 تريليون"
  'تأثير'        // OK if: "تأثير بقيمة 100 مليار"
];

export function containsBannedPhrase(text) {
  const found = [];
  
  for (const phrase of BANNED_PHRASES) {
    if (text.includes(phrase)) {
      found.push(phrase);
    }
  }
  
  return {
    hasBanned: found.length > 0,
    banned: found
  };
}

export function validateNeedsNumber(text) {
  const issues = [];
  
  for (const phrase of NEEDS_NUMBER) {
    if (text.includes(phrase)) {
      // Check if there's a number nearby (within 50 chars)
      const index = text.indexOf(phrase);
      const context = text.substring(Math.max(0, index - 50), Math.min(text.length, index + 50));
      
      if (!/\d+\s*(مليار|مليون|تريليون|%|دولار|ريال)/.test(context)) {
        issues.push({
          phrase,
          problem: `"${phrase}" used without specific number`,
          fix: `Add number: e.g., "100 مليار ${phrase}"`
        });
      }
    }
  }
  
  return issues;
}

