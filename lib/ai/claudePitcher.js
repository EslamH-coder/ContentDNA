/**
 * CLAUDE PITCH GENERATOR - Stage 2
 * High-quality, culturally-aware Arabic pitches
 */

import { claudeComplete, CLAUDE_MODELS } from './clients.js';

// ============================================
// GENERATE FULL PITCH
// ============================================
export async function generatePitch(topic, evidence, options = {}) {
  const {
    format = 'long' // 'long' (25-30 min) or 'short' (8-12 min)
  } = options;

  // Build context from evidence
  const evidenceContext = buildEvidenceContext(evidence);
  const personaContext = buildPersonaContext(evidence?.personaMatch);

  const systemPrompt = `أنت كاتب محتوى لقناة "المخبر الاقتصادي+" على يوتيوب.

أسلوب القناة:
- تحليل عميق وذكي، ليس إخباري
- ربط الأحداث ببعضها وتفسير "لماذا"
- أسلوب مباشر بدون مبالغة أو clickbait رخيص
- المقدم: أشرف إبراهيم

⚠️ قواعد مهمة:
1. لا تقل "للمستثمر العربي" أو "للمشاهد العربي" - هذا مفهوم ضمنياً
2. لا تبدأ بـ "في هذا الفيديو سنتحدث عن..."
3. لا تستخدم نفس الهيكل في كل pitch
4. كن إبداعياً ومتنوعاً في الزوايا
5. استخدم الأدلة المقدمة لتبرير الموضوع

🚨 قاعدة حرجة للصلة (CRITICAL RULE FOR RELEVANCE):
عندما يكون الخبر ليس عن المنطقة العربية مباشرة:

❌ ممنوع تماماً:
- إجبار علاقة وهمية مثل "أزمة العقارات الصينية ستؤثر على راتبك"
- قول "هذا سيدمر الاقتصاد العربي" عندما لا يوجد تأثير حقيقي
- قول "راتبك في خطر" عندما لا توجد علاقة فعلية
- إجبار الصلة الإقليمية عندما لا توجد

✅ افعل هذا بدلاً من ذلك:
- ابحث عن الزاوية الحقيقية التي يهتم بها المشاهد العربي فعلاً
- اسأل نفسك: "لماذا يهتم المشاهد العربي بهذا فعلاً؟"

أمثلة على زوايا جيدة:
- أزمة العقارات الصينية → "كيف تحل الصين المشكلة؟ دروس للحكومات العربية"
- الفيدرالي الأمريكي → "كيف سيؤثر هذا على أسعار النفط واقتصادات الخليج؟"
- أخبار تسلا → "هل ستصل هذه التقنية للأسواق العربية؟ متى؟"

زوايا جيدة عامة:
- "الدروس التي يمكننا تعلمها"
- "كيف تحل القوى الكبرى المشاكل"
- "التأثير المستقبلي على منطقتنا"
- "فرص أو مخاطر استثمارية"
- "التقنيات/الاتجاهات القادمة إلينا"

أمثلة عناوين ناجحة:
- "لماذا تخسر مصر 10 مليار دولار سنوياً؟"
- "الصين vs أمريكا: من سيفوز بحرب الرقائق؟"
- "كيف أصبحت سنغافورة أغنى من جيرانها؟"
- "الذهب: فقاعة أم فرصة العمر؟"

أمثلة hooks ناجحة:
- "ماذا لو أخبرتك أن..."
- "الرقم الذي لا يريدك أحد أن تعرفه..."
- "في عام 2008، حدث شيء غريب..."
- "هل تساءلت يوماً لماذا...؟"`;

  const userPrompt = `
اكتب pitch لفيديو عن:
"${topic}"

${format === 'long' ? '📺 فيديو طويل (25-30 دقيقة)' : '📺 فيديو قصير (8-12 دقيقة)'}

${evidenceContext}

${personaContext}

---

اكتب:

## العنوان
[عنوان جذاب، أقل من 60 حرف، يثير الفضول]

## Hook
[جملة أو سؤال يجذب المشاهد في أول 5 ثواني]

## الزاوية
[ما الذي يميز تناولنا لهذا الموضوع؟ جملة أو اثنتين]

## النقاط الرئيسية
1. [نقطة]
2. [نقطة]
3. [نقطة]

## CTA
[لماذا يجب أن يشاهد الآن؟ جملة واحدة]
`;

  const result = await claudeComplete(userPrompt, {
    model: CLAUDE_MODELS.SONNET,
    temperature: 0.7,
    maxTokens: 1000,
    system: systemPrompt
  });

  if (result.success) {
    return {
      success: true,
      pitch: parsePitchResponse(result.content),
      raw: result.content
    };
  }

  return { success: false, error: result.error };
}

// ============================================
// BUILD EVIDENCE CONTEXT
// ============================================
function buildEvidenceContext(evidence) {
  if (!evidence || !evidence.hasEvidence) {
    return '⚠️ لا توجد أدلة قوية على اهتمام الجمهور بهذا الموضوع.';
  }

  const parts = ['📊 أدلة اهتمام الجمهور:'];

  if (evidence.searchEvidence?.found) {
    parts.push(`• بحث: ${evidence.searchEvidence.summary}`);
  }

  if (evidence.audienceEvidence?.found) {
    parts.push(`• ${evidence.audienceEvidence.summary}`);
    // Add sample titles
    const samples = evidence.audienceEvidence.matchedVideos.slice(0, 2);
    for (const v of samples) {
      parts.push(`  - "${(v.title || '').substring(0, 50)}..."`);
    }
  }

  if (evidence.competitorEvidence?.found) {
    parts.push(`• المنافسون: ${evidence.competitorEvidence.summary}`);
    // Add sample titles
    const samples = evidence.competitorEvidence.matchedVideos.slice(0, 2);
    for (const v of samples) {
      parts.push(`  - "${(v.title || '').substring(0, 50)}..." (${v.channel || 'Unknown'})`);
    }
  }

  if (evidence.commentEvidence?.found) {
    parts.push(`• طلبات الجمهور: ${evidence.commentEvidence.summary}`);
  }

  return parts.join('\n');
}

// ============================================
// BUILD PERSONA CONTEXT
// ============================================
function buildPersonaContext(personaMatch) {
  if (!personaMatch?.found) {
    return '';
  }

  const p = personaMatch.primaryPersona;
  
  return `
👤 الجمهور المستهدف: ${p.name || p.nameEn}
- ${p.description || ''}
- اهتماماتهم: ${(p.interests?.primary || p.interests || []).join('، ')}
- سؤالهم النموذجي: "${p.sampleQuestion || ''}"
`;
}

// ============================================
// BUILD PITCH PROMPT
// ============================================
function buildPitchPrompt(topic, persona, evidence, sourceType, format) {
  const formatGuide = format === 'long' 
    ? '📺 فيديو طويل (25-30 دقيقة) - تحليل عميق وشامل'
    : '📺 فيديو قصير (8-12 دقيقة) - مركز ومباشر';

  const evidenceText = evidence.length > 0
    ? `\n\nالأدلة على اهتمام الجمهور:\n${evidence.map(e => `• ${e}`).join('\n')}`
    : '';

  const personaText = persona
    ? `\n\nالجمهور المستهدف:\n• ${persona.name}\n• ${persona.description}\n• اهتماماتهم: ${persona.interests.join(', ')}`
    : '';

  return `
اكتب pitch لفيديو عن هذا الموضوع:

"${topic}"

${formatGuide}
${personaText}
${evidenceText}

اكتب بالضبط هذا الهيكل:

## العنوان
[عنوان جذاب، أقل من 60 حرف، يثير الفضول بدون clickbait]

## Hook
[سؤال أو حقيقة صادمة تجذب المشاهد في أول 5 ثواني]
[لا تقل "في هذا الفيديو" أبداً]

## الزاوية الفريدة
[ما الذي يميز تناولنا لهذا الموضوع؟]
[كيف نربطه بحياة المشاهد العربي؟]

## النقاط الرئيسية
1. [نقطة 1]
2. [نقطة 2]
3. [نقطة 3]

## CTA
[لماذا يجب أن يشاهد الآن؟]

---

مهم:
- اكتب بالعربية الفصحى المبسطة
- كن ذكياً ومباشراً
- لا تبالغ ولا تستخدم clickbait رخيص
- اربط الموضوع بالواقع العربي
`;
}

// ============================================
// PARSE PITCH RESPONSE
// ============================================
export function parsePitchResponse(content) {
  const sections = {
    title: '',
    hook: '',
    angle: '',
    mainPoints: [],
    cta: '',
    raw: content
  };

  // Extract title
  const titleMatch = content.match(/##\s*العنوان\s*\n([^\n#]+)/);
  if (titleMatch) sections.title = titleMatch[1].trim();

  // Extract hook
  const hookMatch = content.match(/##\s*Hook\s*\n([\s\S]*?)(?=\n##|$)/);
  if (hookMatch) sections.hook = hookMatch[1].trim();

  // Extract angle
  const angleMatch = content.match(/##\s*الزاوية الفريدة\s*\n([\s\S]*?)(?=\n##|$)/);
  if (angleMatch) sections.angle = angleMatch[1].trim();

  // Extract main points
  const pointsMatch = content.match(/##\s*النقاط الرئيسية\s*\n([\s\S]*?)(?=\n##|$)/);
  if (pointsMatch) {
    const points = pointsMatch[1].match(/\d+\.\s*([^\n]+)/g);
    if (points) {
      sections.mainPoints = points.map(p => p.replace(/^\d+\.\s*/, '').trim());
    }
  }

  // Extract CTA
  const ctaMatch = content.match(/##\s*CTA\s*\n([\s\S]*?)(?=\n---|$)/);
  if (ctaMatch) sections.cta = ctaMatch[1].trim();

  return sections;
}

// ============================================
// GENERATE QUICK PITCH (Lighter version)
// ============================================
export async function generateQuickPitch(topic, persona = null) {
  const personaInfo = persona ? getPersonaById(persona) : null;
  
  const prompt = `
اكتب pitch سريع لفيديو عن: "${topic}"
${personaInfo ? `للجمهور: ${personaInfo.name}` : ''}

أجب بـ JSON:
{
  "title": "عنوان جذاب أقل من 60 حرف",
  "hook": "سؤال أو حقيقة صادمة في جملة واحدة",
  "angle": "الزاوية الفريدة في جملة واحدة",
  "format": "long|short",
  "urgency": "breaking|this_week|this_month|evergreen"
}`;

  const result = await claudeComplete(prompt, {
    model: CLAUDE_MODELS.HAIKU, // Use Haiku for quick pitches (cheaper)
    temperature: 0.7,
    maxTokens: 400
  });

  if (result.success && result.parsed) {
    return {
      success: true,
      ...result.parsed,
      persona: personaInfo?.name || 'General'
    };
  }

  return { success: false, error: result.error };
}

// ============================================
// IMPROVE EXISTING PITCH
// ============================================
export async function improvePitch(currentPitch, feedback = '') {
  const prompt = `
هذا pitch حالي:

العنوان: ${currentPitch.title}
Hook: ${currentPitch.hook}
الزاوية: ${currentPitch.angle}

${feedback ? `الملاحظات: ${feedback}` : 'حسّن هذا الـ pitch ليكون أكثر جاذبية'}

اكتب نسخة محسنة بنفس الهيكل.
`;

  const result = await claudeComplete(prompt, {
    model: CLAUDE_MODELS.SONNET,
    temperature: 0.8,
    maxTokens: 800
  });

  return {
    success: result.success,
    improved: result.content
  };
}

// ============================================
// GENERATE MULTIPLE ANGLES
// ============================================
export async function generateAngles(topic, count = 3) {
  const prompt = `
الموضوع: "${topic}"

اقترح ${count} زوايا مختلفة لتناول هذا الموضوع في فيديو:

لكل زاوية اكتب:
1. العنوان
2. الـ Hook
3. لماذا هذه الزاوية مميزة؟
4. أي persona تخدم؟

الزوايا يجب أن تكون مختلفة تماماً عن بعضها.
`;

  const result = await claudeComplete(prompt, {
    model: CLAUDE_MODELS.SONNET,
    temperature: 0.9,
    maxTokens: 1500
  });

  return {
    success: result.success,
    angles: result.content
  };
}

