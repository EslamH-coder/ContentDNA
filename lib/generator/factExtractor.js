/**
 * FACT EXTRACTOR
 * Extracts ONLY verifiable facts from article
 * No inference, no invention
 */

// ============================================
// EXTRACT FACTS FROM ARTICLE
// ============================================
export async function extractFacts(articleContent, groqClient) {
  const prompt = `
أنت مدقق حقائق صارم. استخرج فقط المعلومات الموجودة فعلاً في النص.

## قواعد صارمة:
1. استخرج فقط ما هو مذكور صراحة
2. لا تستنتج أو تفترض
3. إذا لم يذكر رقم، اكتب "غير مذكور"
4. إذا لم يذكر اسم، اكتب "غير مذكور"

## النص:
"""
${articleContent.substring(0, 4000)}
"""

## استخرج:

{
  "main_claim": "الادعاء الرئيسي في الخبر (جملة واحدة فقط)",
  
  "numbers": {
    "mentioned": true/false,
    "values": [
      {"number": "الرقم بالضبط", "context": "السياق"}
    ]
  },
  
  "people": {
    "mentioned": true/false,
    "names": [
      {"name": "الاسم بالضبط", "title": "المنصب إن ذُكر", "quote": "اقتباس مباشر إن وجد"}
    ]
  },
  
  "entities": {
    "countries": ["الدول المذكورة فقط"],
    "companies": ["الشركات المذكورة فقط"],
    "organizations": ["المنظمات المذكورة فقط"]
  },
  
  "timeframe": {
    "mentioned": true/false,
    "when": "التاريخ أو الفترة إن ذُكرت"
  },
  
  "source_tone": "neutral/positive/negative/alarming",
  
  "superlatives_in_source": {
    "has_superlatives": true/false,
    "examples": ["أي كلمات مبالغة موجودة في الأصل"]
  },
  
  "what_source_does_NOT_say": [
    "أشياء قد يفترضها القارئ لكنها غير مذكورة"
  ]
}

أجب بـ JSON فقط.
`;

  try {
    const response = await groqClient.complete({
      prompt,
      temperature: 0.1, // Very low for accuracy
      model: 'fast'
    });
    
    // Clean response
    let jsonStr = response.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse facts:', e);
    return null;
  }
}

// ============================================
// VALIDATE CLAIM AGAINST FACTS
// ============================================
export function validateClaim(claim, extractedFacts) {
  const issues = [];
  
  if (!extractedFacts) {
    return { valid: false, issues: [{ type: 'no_facts', message: 'لا توجد حقائق مستخرجة' }] };
  }
  
  // Check for numbers not in source
  const numbersInClaim = claim.match(/\d+(\.\d+)?(%|مليار|مليون|تريليون|billion|million|trillion)?/g) || [];
  const numbersInSource = extractedFacts.numbers?.values?.map(n => n.number) || [];
  
  for (const num of numbersInClaim) {
    const found = numbersInSource.some(srcNum => {
      const srcNumStr = String(srcNum);
      return srcNumStr.includes(num) || num.includes(srcNumStr);
    });
    
    if (!found && extractedFacts.numbers?.mentioned === true) {
      issues.push({
        type: 'invented_number',
        value: num,
        message: `الرقم "${num}" غير موجود في المصدر الأصلي`
      });
    }
  }
  
  // Check for superlatives not in source
  const superlatives = [
    'أكبر', 'الأكبر', 'أعظم', 'الأعظم', 'أول', 'الأول',
    'أخطر', 'الأخطر', 'أسوأ', 'الأسوأ', 'تاريخي', 'غير مسبوق',
    'في التاريخ', 'على الإطلاق', 'لأول مرة'
  ];
  
  for (const sup of superlatives) {
    if (claim.includes(sup)) {
      const inSource = extractedFacts.superlatives_in_source?.examples?.some(
        e => e.includes(sup)
      );
      if (!inSource && !extractedFacts.superlatives_in_source?.has_superlatives) {
        issues.push({
          type: 'exaggeration',
          value: sup,
          message: `"${sup}" غير موجودة في المصدر - مبالغة محتملة`
        });
      }
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}




