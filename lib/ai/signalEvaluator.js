/**
 * SIGNAL EVALUATOR V4
 * Two-Step: Evaluate FIRST, then Pitch only if worthy
 * 
 * PHILOSOPHY:
 * - Be HONEST about whether a topic fits
 * - SKIP is better than forcing a bad angle
 * - NO invented connections to "Arab economy"
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// ============================================================
// STEP 1: EVALUATE - Is this signal worth covering?
// ============================================================

const EVALUATION_SYSTEM_PROMPT = `أنت مقيّم محتوى لقناة "المخبر الاقتصادي+" على يوتيوب.

مهمتك: تقييم ما إذا كان الخبر يستحق تغطية أم لا.

⚠️ قواعد التقييم:
1. كن صارماً وصادقاً - SKIP أفضل من pitch ضعيف
2. لا تخترع علاقة بالمنطقة العربية إذا لم تكن موجودة فعلاً
3. لا تضخم أهمية خبر عادي
4. فكر: "هل المشاهد العربي سيستفيد فعلاً من هذا؟"

معايير القبول ✅ (واحد على الأقل):
- الخبر يؤثر مباشرة على الاقتصاد العربي/الخليجي
- الخبر عن قوة كبرى (أمريكا، الصين، روسيا) له تبعات عالمية
- الخبر عن تحول تقني/اقتصادي كبير يهم أي شخص
- الخبر فيه درس أو قصة ملهمة عالمية
- الخبر عن شركة/شخصية الجمهور يعرفها ومهتم بها

معايير الرفض ❌:
- خبر داخلي لشركة غير معروفة عربياً
- خبر محلي لدولة بعيدة بدون تأثير خارجي
- خبر تقني تفصيلي لا يهم غير المتخصصين
- خبر يحتاج "تأليف" علاقة بالمنطقة

أمثلة:
✅ "الصين تفرض رسوماً على السيارات الأمريكية" → مناسب (حرب تجارية، تأثير عالمي)
✅ "تسلا تطلق روبوتاكسي" → مناسب (تحول تقني كبير، ماسك معروف)
✅ "انهيار سيليكون فالي بنك" → مناسب (أزمة مصرفية، درس مالي)
❌ "شركة طاقة بريطانية تستثمر في software" → غير مناسب (خبر محلي)
❌ "مدينة أمريكية صغيرة تمنع AI" → غير مناسب (لا تأثير)
❌ "تعيين CEO جديد لشركة يابانية" → غير مناسب (لا يهم الجمهور)`;

export async function evaluateSignal(rssItem) {
  const title = rssItem.title || rssItem.topic || '';
  const description = rssItem.description || rssItem.summary || '';
  const source = rssItem.source || rssItem.sourceName || rssItem.url || '';
  const pubDate = rssItem.pubDate || rssItem.publishedAt || rssItem.date || '';
  
  const userPrompt = `قيّم هذا الخبر:

📰 العنوان: ${title}

📝 الوصف: ${description || 'غير متوفر'}

📌 المصدر: ${source}

---

أجب بتنسيق JSON فقط:
{
  "decision": "PROCEED" أو "SKIP",
  "confidence": رقم من 1-10,
  "reason": "سبب القرار في جملة واحدة",
  "relevance_type": "direct_impact" أو "global_trend" أو "educational" أو "none",
  "suggested_angle": "الزاوية الطبيعية إذا PROCEED، أو null إذا SKIP"
}

لا تكتب أي شيء آخر غير الـ JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: EVALUATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const content = response.content[0]?.text || '';
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { 
        decision: 'SKIP', 
        reason: 'Failed to parse evaluation', 
        confidence: 0,
        relevance_type: 'none',
        suggested_angle: null
      };
    }
    
    const evaluation = JSON.parse(jsonMatch[0]);
    return {
      decision: evaluation.decision || 'SKIP',
      confidence: evaluation.confidence || 0,
      reason: evaluation.reason || 'No reason provided',
      relevance_type: evaluation.relevance_type || 'none',
      suggested_angle: evaluation.suggested_angle || null,
      rawResponse: content
    };
    
  } catch (error) {
    console.error('Evaluation error:', error.message);
    return { 
      decision: 'SKIP', 
      reason: `Error: ${error.message}`, 
      confidence: 0,
      relevance_type: 'none',
      suggested_angle: null
    };
  }
}

// ============================================================
// STEP 2: PITCH - Only if evaluation passed
// ============================================================

const PITCH_SYSTEM_PROMPT = `أنت كاتب محتوى لقناة "المخبر الاقتصادي+" على يوتيوب.

القواعد الذهبية:
1. اكتب pitch بناءً على محتوى الخبر الفعلي فقط
2. لا تخترع معلومات أو أرقام غير موجودة
3. لا تضخم أو تبالغ في التأثير
4. الزاوية يجب أن تكون طبيعية ومنطقية
5. لا تقل "للمستثمر العربي" - هذا مفهوم ضمنياً

أسلوب القناة:
- تحليل عميق وذكي، ليس إخباري
- ربط الأحداث ببعضها
- أسلوب مباشر بدون clickbait رخيص
- المقدم: أشرف إبراهيم

أمثلة hooks جيدة:
- "الرقم الذي يخفيه الجميع..."
- "ماذا يعني هذا القرار لمحفظتك؟"
- "قصة لم يروِها أحد..."
- "التاريخ يعيد نفسه..."`;

export async function generatePitch(rssItem, evaluation, options = {}) {
  const title = rssItem.title || rssItem.topic || '';
  const description = rssItem.description || rssItem.summary || '';
  const source = rssItem.source || rssItem.sourceName || rssItem.url || '';
  const { format = 'long' } = options;
  
  // Only proceed if evaluation passed
  if (evaluation.decision !== 'PROCEED') {
    return {
      success: false,
      skipped: true,
      reason: evaluation.reason
    };
  }

  const userPrompt = `
اكتب pitch لهذا الخبر:

📰 الخبر: ${title}
📝 التفاصيل: ${description || 'غير متوفر'}
📌 المصدر: ${source}

🎯 الزاوية المقترحة: ${evaluation.suggested_angle || 'زاوية طبيعية من محتوى الخبر'}
📺 الشكل: ${format === 'long' ? 'فيديو طويل (25-30 دقيقة)' : 'فيديو قصير (8-12 دقيقة)'}

---

اكتب:

## العنوان
[عنوان جذاب وصادق، أقل من 60 حرف]

## Hook
[سؤال أو جملة تجذب في أول 5 ثواني]

## الزاوية
[ما الذي يميز تناولنا؟ جملة واحدة]

## النقاط الرئيسية
1. [نقطة من الخبر الفعلي]
2. [نقطة]
3. [نقطة]

## CTA
[لماذا يشاهد الآن؟]

⚠️ تذكر: لا تخترع معلومات غير موجودة في الخبر!
`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: PITCH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const content = response.content[0]?.text || '';
    
    return {
      success: true,
      pitch: parsePitch(content),
      evaluation,
      raw: content
    };
    
  } catch (error) {
    console.error('Pitch error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================
// PARSE PITCH RESPONSE
// ============================================================

function parsePitch(content) {
  const pitch = {
    title: '',
    hook: '',
    angle: '',
    mainPoints: [],
    cta: ''
  };

  // Extract title
  const titleMatch = content.match(/##\s*العنوان\s*\n([^\n#]+)/);
  if (titleMatch) pitch.title = titleMatch[1].trim();

  // Extract hook
  const hookMatch = content.match(/##\s*Hook\s*\n([\s\S]*?)(?=\n##|$)/);
  if (hookMatch) pitch.hook = hookMatch[1].trim();

  // Extract angle
  const angleMatch = content.match(/##\s*الزاوية\s*\n([\s\S]*?)(?=\n##|$)/);
  if (angleMatch) pitch.angle = angleMatch[1].trim();

  // Extract main points
  const pointsMatch = content.match(/##\s*النقاط الرئيسية\s*\n([\s\S]*?)(?=\n##|$)/);
  if (pointsMatch) {
    const points = pointsMatch[1].match(/\d+\.\s*([^\n]+)/g);
    if (points) {
      pitch.mainPoints = points.map(p => p.replace(/^\d+\.\s*/, '').trim());
    }
  }

  // Extract CTA
  const ctaMatch = content.match(/##\s*CTA\s*\n([\s\S]*?)$/);
  if (ctaMatch) pitch.cta = ctaMatch[1].trim();

  return pitch;
}

// ============================================================
// COMBINED: EVALUATE + PITCH
// ============================================================

export async function processSignal(rssItem, options = {}) {
  console.log(`\n📰 Processing: "${(rssItem.title || rssItem.topic || '').substring(0, 50)}..."`);
  
  // Step 1: Evaluate
  const evaluation = await evaluateSignal(rssItem);
  console.log(`   → ${evaluation.decision} (${evaluation.confidence}/10): ${evaluation.reason}`);
  
  if (evaluation.decision === 'SKIP') {
    return {
      success: true,
      skipped: true,
      evaluation,
      rssItem
    };
  }
  
  // Step 2: Generate pitch
  const pitchResult = await generatePitch(rssItem, evaluation, options);
  
  return {
    success: pitchResult.success,
    skipped: false,
    evaluation,
    pitch: pitchResult.pitch,
    rssItem
  };
}

// ============================================================
// BATCH PROCESS
// ============================================================

export async function processSignals(rssItems, options = {}) {
  const results = {
    processed: [],
    skipped: [],
    errors: [],
    summary: {}
  };
  
  for (const item of rssItems) {
    try {
      const result = await processSignal(item, options);
      
      if (result.skipped) {
        results.skipped.push(result);
      } else if (result.success) {
        results.processed.push(result);
      } else {
        results.errors.push(result);
      }
    } catch (error) {
      results.errors.push({ rssItem: item, error: error.message });
    }
  }
  
  results.summary = {
    total: rssItems.length,
    processed: results.processed.length,
    skipped: results.skipped.length,
    errors: results.errors.length,
    skipRate: Math.round((results.skipped.length / rssItems.length) * 100) + '%'
  };
  
  console.log('\n📊 Summary:');
  console.log(`   Total: ${results.summary.total}`);
  console.log(`   ✅ Processed: ${results.summary.processed}`);
  console.log(`   ❌ Skipped: ${results.summary.skipped} (${results.summary.skipRate})`);
  console.log(`   ⚠️ Errors: ${results.summary.errors}`);
  
  return results;
}

