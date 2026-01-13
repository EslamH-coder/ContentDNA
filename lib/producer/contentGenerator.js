/**
 * CONTENT GENERATOR
 * Generates content with FULL context
 */

import { getProducerContext, generateProducerSystemPrompt } from './contextLoader.js';

// ============================================
// GENERATE TITLE AND HOOK
// ============================================
export async function generateContent(storyProfile, angle, llmClient) {
  if (!llmClient || !llmClient.messages || !llmClient.messages.create) {
    // Fallback: use angle suggestions
    return {
      title: angle.suggested_title,
      hook: angle.suggested_hook,
      angle_description: angle.angle.summary,
      patterns_used: ['Fallback'],
      validation: { valid: true, issues: [], passed: [], score: 50 }
    };
  }
  
  const ctx = getProducerContext();
  const systemPrompt = generateProducerSystemPrompt();
  
  // Build detailed prompt with ALL context
  const prompt = `
# المهمة: اكتب عنوان وHook لهذه القصة

## الزاوية المحددة:
${angle.angle.summary}

## الشخص الرئيسي:
${angle.main_person?.name || 'غير محدد'} (${angle.main_person?.title_arabic || ''})

## السؤال:
${angle.hook_question?.question}

## الربط بالعرب:
${angle.arab_connection?.impact}
الدول: ${angle.arab_connection?.countries_to_mention?.join('، ')}

## الأرقام المتاحة:
${storyProfile.elements?.numbers?.map(n => `${n.value}: ${n.context}`).join('\n') || 'لا يوجد'}

## المطلوب:

### 1. العنوان (Title):
- يبدأ بـ هل/كيف/لماذا
- يذكر الشخص بالاسم (مش المؤسسة)
- واضح على شاشة الجوال (أول 5 كلمات = Hook)
- بدون أي عبارة من الممنوعات

### 2. الـ Hook (أول 15-20 ثانية):
- يبدأ مباشرة (لا مقدمات)
- يذكر رقم أو تاريخ محدد
- يوضح المشكلة/الصراع
- يربط بالجمهور العربي
- ينتهي بسؤال أو جملة تشويقية

### 3. الزاوية الكاملة (Angle Description):
- جملتين تشرح الزاوية للمنتج

## أجب بصيغة JSON فقط:
{
  "title": "العنوان",
  "hook": "الـ Hook كاملاً",
  "angle_description": "وصف الزاوية",
  "patterns_used": ["Pattern1", "Pattern2"]
}

## تذكر:
- ممنوع: ${ctx.banned.phrases.slice(0, 5).join('، ')}
- الجمهور: رجال عرب، مصر والسعودية، على الجوال
- أفضل سؤال: "هل"
- أفضل طريقة: اسم شخص + فعل قوي + تأثير على العرب
`;

  try {
    const response = await llmClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0.5,
      messages: [
        { role: 'user', content: `${systemPrompt}\n\n${prompt}` }
      ]
    });
    
    const responseText = response.content[0].text.trim();
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const generated = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
    
    // Validate before returning
    const validation = validateContent(generated, ctx);
    
    return {
      ...generated,
      validation,
      source: {
        article_title: storyProfile.article.title,
        angle_used: angle.angle.summary,
        patterns_matched: storyProfile.patternScores
      }
    };
  } catch (e) {
    console.error('Failed to parse generated content:', e);
    return {
      title: angle.suggested_title,
      hook: angle.suggested_hook,
      angle_description: angle.angle.summary,
      patterns_used: ['Fallback'],
      validation: { valid: false, issues: ['Failed to generate'], passed: [], score: 0 }
    };
  }
}

// ============================================
// VALIDATE CONTENT
// ============================================
function validateContent(content, ctx) {
  const issues = [];
  const passed = [];
  
  // Check for banned phrases
  for (const phrase of ctx.banned.phrases) {
    if (content.title?.includes(phrase) || content.hook?.includes(phrase)) {
      issues.push(`يحتوي على عبارة ممنوعة: "${phrase}"`);
    }
  }
  
  // Check for question start
  if (/^(هل|كيف|لماذا)/.test(content.title)) {
    passed.push('✅ يبدأ بسؤال');
  } else {
    issues.push('⚠️ لا يبدأ بسؤال');
  }
  
  // Check title length
  if (content.title?.length > 70) {
    issues.push('⚠️ العنوان طويل جداً');
  } else if (content.title?.length >= 40) {
    passed.push('✅ طول العنوان مناسب');
  }
  
  // Check for Arab mention
  const arabMentions = ['مصر', 'السعودية', 'الخليج', 'العرب'];
  const hasArabMention = arabMentions.some(m => 
    content.hook?.includes(m) || content.title?.includes(m)
  );
  if (hasArabMention) {
    passed.push('✅ يذكر المنطقة العربية');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    passed,
    score: Math.max(0, 100 - (issues.length * 20))
  };
}




