/**
 * GROUNDED GENERATOR
 * Generates content based ONLY on extracted facts
 */

import { loadIntelligence } from '../intelligence/intelligenceLoader.js';
import { extractFacts, validateClaim } from './factExtractor.js';

// ============================================
// GENERATE GROUNDED CONTENT
// ============================================
export async function generateGroundedContent(articleContent, newsItem, groqClient) {
  // Step 1: Load intelligence
  const intelligence = await loadIntelligence();
  
  // Step 2: Extract facts from article
  console.log('   📋 Extracting facts...');
  const facts = await extractFacts(articleContent, groqClient);
  
  if (!facts) {
    return { success: false, error: 'Failed to extract facts' };
  }
  
  // Step 3: Generate with strict grounding
  console.log('   ✍️ Generating grounded content...');
  const generated = await generateWithFacts(facts, intelligence, groqClient);
  
  if (!generated) {
    return { success: false, error: 'Failed to generate content' };
  }
  
  // Step 4: Validate output
  console.log('   🔍 Validating output...');
  const validation = validateOutput(generated, facts, intelligence.dna);
  
  // Step 5: Auto-fix if needed
  if (!validation.valid) {
    console.log('   🔧 Auto-fixing issues...');
    const fixed = await autoFix(generated, validation.issues, intelligence.dna, groqClient);
    return {
      success: true,
      output: fixed,
      facts,
      validation: validateOutput(fixed, facts, intelligence.dna),
      wasFixed: true
    };
  }
  
  return {
    success: true,
    output: generated,
    facts,
    validation,
    wasFixed: false
  };
}

// ============================================
// GENERATE WITH FACTS
// ============================================
async function generateWithFacts(facts, intelligence, groqClient) {
  const { dna, competitors, savedVideos } = intelligence;
  
  const prompt = `
أنت كاتب محتوى لقناة "المخبر الاقتصادي+" على يوتيوب.

# ⚠️ قواعد صارمة جداً:

## 1. ممنوع منعاً باتاً:
${dna.bannedPhrases.map(p => `- "${p}"`).join('\n')}

## 2. ممنوع اختراع معلومات:
- لا تضف أي رقم غير موجود في الحقائق
- لا تضف أي اقتباس غير موجود
- لا تبالغ أو تضخم

## 3. استخدم فقط هذه الحقائق المستخرجة:
${JSON.stringify(facts, null, 2)}

# الحقائق المتاحة:

## الادعاء الرئيسي:
${facts.main_claim || 'غير محدد'}

## الأرقام المذكورة:
${facts.numbers?.mentioned 
  ? facts.numbers.values.map(n => `- ${n.number}: ${n.context}`).join('\n')
  : '⚠️ لا توجد أرقام في المصدر - لا تخترع أرقاماً!'}

## الأشخاص المذكورون:
${facts.people?.mentioned
  ? facts.people.names.map(p => `- ${p.name} (${p.title || 'غير مذكور'})`).join('\n')
  : 'لا يوجد'}

## الكيانات:
- دول: ${facts.entities?.countries?.join('، ') || 'غير مذكور'}
- شركات: ${facts.entities?.companies?.join('، ') || 'غير مذكور'}

## الإطار الزمني:
${facts.timeframe?.mentioned ? facts.timeframe.when : 'غير محدد'}

## نبرة المصدر الأصلي:
${facts.source_tone || 'neutral'}

## ⚠️ ما لا يقوله المصدر (لا تفترضه):
${facts.what_source_does_NOT_say?.map(x => `- ${x}`).join('\n') || 'لا يوجد'}

# السياق التنافسي:
${competitors.hotTopics?.length > 0 
  ? `المنافسون يغطون حالياً: ${competitors.hotTopics.join('، ')}`
  : 'لا توجد بيانات'}

# المطلوب:

أنشئ محتوى يعتمد فقط على الحقائق أعلاه:

{
  "title": "عنوان يبدأ بـ هل/كيف/لماذا (بدون أرقام مخترعة)",
  "hook": "أول 20 ثانية (بدون 'هل تعلم' أو أي عبارة ممنوعة)",
  "angle": "الزاوية",
  "facts_used": ["قائمة الحقائق المستخدمة من المصدر"],
  "facts_NOT_used": ["حقائق تجنبناها لأنها غير موجودة"]
}

# أمثلة على أنماط ناجحة:
${dna.winningPatterns.titleStructures.map(s => `- ${s}`).join('\n')}

تذكر: 
- ممنوع "هل تعلم أن" أو أي عبارة من القائمة الممنوعة
- ممنوع اختراع أرقام
- ممنوع المبالغة إلا إذا المصدر يبالغ

أجب بـ JSON فقط.
`;

  try {
    const response = await groqClient.complete({
      prompt,
      temperature: 0.4,
      model: 'powerful'
    });
    
    let jsonStr = response.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse generated content:', e);
    return null;
  }
}

// ============================================
// VALIDATE OUTPUT
// ============================================
function validateOutput(generated, facts, dna) {
  const issues = [];
  
  if (!generated) {
    return { valid: false, issues: [{ type: 'generation_failed', message: 'فشل التوليد' }] };
  }
  
  const fullText = `${generated.title || ''} ${generated.hook || ''}`;
  
  // Check banned phrases
  for (const phrase of dna.bannedPhrases) {
    if (fullText.includes(phrase)) {
      issues.push({
        type: 'banned_phrase',
        value: phrase,
        message: `يحتوي على عبارة ممنوعة: "${phrase}"`
      });
    }
  }
  
  // Validate claims against facts
  const claimValidation = validateClaim(fullText, facts);
  issues.push(...claimValidation.issues);
  
  // Check for exaggeration words
  for (const word of dna.exaggerationWords) {
    if (fullText.includes(word)) {
      // Check if it's in the source
      const inSource = facts.superlatives_in_source?.examples?.some(e => e.includes(word));
      if (!inSource && facts.superlatives_in_source?.has_superlatives !== true) {
        issues.push({
          type: 'exaggeration',
          value: word,
          message: `مبالغة غير موجودة في المصدر: "${word}"`
        });
      }
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
    score: Math.max(0, 100 - (issues.length * 20))
  };
}

// ============================================
// AUTO-FIX ISSUES
// ============================================
async function autoFix(generated, issues, dna, groqClient) {
  if (!generated || issues.length === 0) return generated;
  
  const prompt = `
أصلح هذا المحتوى بناءً على المشاكل المكتشفة:

## المحتوى الحالي:
العنوان: ${generated.title}
الـ Hook: ${generated.hook}

## المشاكل المكتشفة:
${issues.map(i => `- ${i.type}: ${i.message}`).join('\n')}

## قواعد الإصلاح:
1. إذا وجدت عبارة ممنوعة → احذفها وأعد صياغة الجملة
2. إذا وجدت رقم مخترع → احذفه أو استخدم وصف عام
3. إذا وجدت مبالغة → خفف اللهجة

## العبارات الممنوعة (احذفها فوراً):
${dna.bannedPhrases.slice(0, 10).map(p => `- "${p}"`).join('\n')}

## أمثلة على الإصلاح:
- "هل تعلم أن الصين..." → "الصين..."
- "ترفع إنفاقها 15%" (رقم مخترع) → "تعلن زيادة إنفاقها"
- "أكبر خطة في التاريخ" (مبالغة) → "خطة جديدة"

أجب بـ JSON:
{
  "title": "العنوان المصحح",
  "hook": "الـ Hook المصحح",
  "fixes_applied": ["قائمة الإصلاحات"]
}
`;

  try {
    const response = await groqClient.complete({
      prompt,
      temperature: 0.2,
      model: 'fast'
    });
    
    let jsonStr = response.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const fixed = JSON.parse(jsonStr);
    return {
      ...generated,
      title: fixed.title || generated.title,
      hook: fixed.hook || generated.hook,
      fixes_applied: fixed.fixes_applied || []
    };
  } catch (e) {
    console.error('Auto-fix failed:', e);
    return generated;
  }
}




