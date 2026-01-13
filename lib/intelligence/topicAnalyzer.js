/**
 * TOPIC ANALYZER
 * Uses Groq to understand topics deeply
 */

import { completeJSON, complete, MODELS } from './groqClient.js';
import { PERSONAS } from './personas.js';

// ============================================
// ANALYZE TOPIC WITH AI
// ============================================
export async function analyzeTopic(topic, context = {}) {
  const personaList = Object.entries(PERSONAS)
    .map(([id, p]) => `- ${id}: ${p.description}`)
    .join('\n');

  const prompt = `
أنت محلل محتوى لقناة يوتيوب اقتصادية عربية اسمها "المخبر الاقتصادي+".

حلل هذا الموضوع:
"${topic}"

${context.description ? `الوصف: ${context.description}` : ''}
${context.source ? `المصدر: ${context.source}` : ''}

الشرائح المستهدفة:
${personaList}

أجب بـ JSON:
{
  "mainTopic": "الموضوع الرئيسي في 3-5 كلمات",
  "relatedTopics": ["موضوع1", "موضوع2", "موضوع3"],
  "primaryPersona": "persona_id الأنسب",
  "secondaryPersonas": ["persona_id", "persona_id"],
  "personaReasons": {
    "persona_id": "سبب المناسبة"
  },
  "suggestedAngle": "زاوية مقترحة للفيديو في جملة واحدة",
  "hookQuestion": "سؤال جذاب لبداية الفيديو",
  "relevanceScore": 0-100,
  "urgency": "breaking" | "this_week" | "this_month" | "evergreen",
  "whyRelevant": "لماذا هذا مهم لجمهورنا"
}
`;

  const result = await completeJSON(prompt, {
    model: MODELS.SMART, // نستخدم النموذج الذكي للتحليل العميق
    temperature: 0.4,
    maxTokens: 600
  });

  if (result.success && result.parsed) {
    return {
      success: true,
      analysis: result.parsed,
      topic
    };
  }

  return {
    success: false,
    analysis: null,
    topic,
    error: result.error
  };
}

// ============================================
// GENERATE CREATIVE PITCH
// ============================================
export async function generatePitch(topic, persona, evidence = []) {
  const personaInfo = PERSONAS[persona] || PERSONAS.curious_learner;
  
  const evidenceText = evidence.length > 0
    ? `\nالأدلة:\n${evidence.map(e => `- ${e}`).join('\n')}`
    : '';

  const prompt = `
أنت كاتب محتوى لقناة "المخبر الاقتصادي+".

اكتب pitch قصير ومقنع لفيديو عن:
"${topic}"

الجمهور المستهدف: ${personaInfo.name}
وصفهم: ${personaInfo.description}
اهتماماتهم: ${personaInfo.interests.join(', ')}
${evidenceText}

اكتب:
1. عنوان جذاب (أقل من 60 حرف)
2. Hook السؤال الافتتاحي
3. الزاوية الفريدة (لماذا نحن؟)
4. الـ CTA (لماذا يشاهد الآن؟)

الأسلوب: مباشر، ذكي، بدون مبالغة
`;

  const result = await complete(prompt, {
    model: MODELS.SMART,
    temperature: 0.7,
    maxTokens: 400
  });

  return {
    success: result.success,
    pitch: result.content,
    persona: personaInfo.name
  };
}

// ============================================
// ANALYZE URL/TREND
// ============================================
export async function analyzeUrl(url, note = '') {
  const prompt = `
حلل هذا الرابط/الـ Trend:

URL: ${url}
${note ? `ملاحظة: ${note}` : ''}

استخرج:
1. ما هو الموضوع؟
2. لماذا قد يكون مهماً؟
3. هل هو trending الآن؟
4. أي شريحة من الجمهور ستهتم؟

أجب بـ JSON:
{
  "topic": "الموضوع",
  "summary": "ملخص قصير",
  "whyTrending": "لماذا منتشر",
  "suggestedPersona": "persona_id",
  "relevance": 0-100,
  "suggestedVideoIdea": "فكرة فيديو"
}
`;

  const result = await completeJSON(prompt, {
    model: MODELS.FAST,
    temperature: 0.3,
    maxTokens: 400
  });

  return {
    success: result.success,
    analysis: result.parsed,
    url
  };
}

// ============================================
// COMPARE WITH COMPETITORS
// ============================================
export async function suggestDifferentiation(topic, competitorApproach = '') {
  const prompt = `
الموضوع: "${topic}"

${competitorApproach ? `طريقة المنافسين: ${competitorApproach}` : ''}

كقناة "المخبر الاقتصادي+" كيف نتميز؟

اقترح 3 زوايا مختلفة:
1. زاوية تحليلية عميقة
2. زاوية تطبيقية عملية
3. زاوية مفاجئة/غير متوقعة

أجب بـ JSON:
{
  "angles": [
    {"type": "analytical", "angle": "...", "hook": "..."},
    {"type": "practical", "angle": "...", "hook": "..."},
    {"type": "surprising", "angle": "...", "hook": "..."}
  ],
  "recommendedAngle": 1-3,
  "reason": "لماذا هذه الزاوية"
}
`;

  const result = await completeJSON(prompt, {
    model: MODELS.SMART,
    temperature: 0.6,
    maxTokens: 500
  });

  return {
    success: result.success,
    differentiation: result.parsed,
    topic
  };
}




