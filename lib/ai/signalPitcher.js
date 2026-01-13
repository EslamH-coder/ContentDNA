/**
 * SIGNAL PITCHER - Step 2: Generate pitch for filtered signals
 * Only called for signals that passed the filter
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// ============================================================
// STRICT SYSTEM PROMPT
// ============================================================
const SYSTEM_PROMPT = `أنت كاتب محتوى لقناة "المخبر الاقتصادي+" على يوتيوب.

⛔ ممنوع تماماً:
1. اختراع معلومات غير موجودة في الخبر
2. ربط الخبر بدول لم تُذكر فيه
3. المبالغة أو التضخيم
4. استخدام علامات تعجب كثيرة
5. عناوين clickbait رخيصة

✅ مطلوب:
1. اكتب من محتوى الخبر الفعلي فقط
2. الزاوية يجب أن تكون منطقية ومبنية على الخبر
3. إذا الخبر لا يذكر المنطقة العربية، لا تذكرها
4. كن صادقاً ومباشراً

أسلوب القناة:
- تحليل عميق وذكي
- ربط الأحداث ببعضها
- أسلوب مباشر
- المقدم: أشرف إبراهيم`;

// ============================================================
// GENERATE PITCH
// ============================================================
export async function generatePitch(rssItem, filterResult, options = {}) {
  const title = rssItem.title || rssItem.topic || '';
  const description = rssItem.description || rssItem.summary || '';
  const source = rssItem.source || rssItem.sourceName || rssItem.url || '';
  const { format = 'long' } = options;
  
  const formatText = format === 'long' 
    ? '📺 فيديو طويل (25-30 دقيقة)' 
    : '📺 فيديو قصير (8-12 دقيقة)';

  const userPrompt = `اكتب pitch لهذا الخبر:

📰 العنوان: ${title}

📝 التفاصيل: ${description || 'غير متوفر'}

📌 المصدر: ${source}

🎯 الكلمات المطابقة: ${filterResult.matchedKeywords?.join(', ') || 'عام'}

${formatText}

---

اكتب بالتنسيق التالي:

## العنوان
[عنوان من محتوى الخبر، أقل من 60 حرف]

## Hook
[سؤال يجذب المشاهد، مبني على الخبر الفعلي]

## الزاوية
[ما الجديد في هذا الخبر؟ جملة واحدة]

## النقاط الرئيسية
1. [من الخبر]
2. [من الخبر]
3. [من الخبر]

## CTA
[جملة واحدة]

⚠️ تذكير: اكتب فقط ما هو موجود في الخبر!`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const content = response.content[0]?.text || '';
    
    return {
      success: true,
      pitch: parsePitch(content),
      raw: content
    };
    
  } catch (error) {
    console.error('Pitch error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================
// PARSE PITCH
// ============================================================
function parsePitch(content) {
  const pitch = {
    title: '',
    hook: '',
    angle: '',
    mainPoints: [],
    cta: ''
  };

  const titleMatch = content.match(/##\s*العنوان\s*\n([^\n#]+)/);
  if (titleMatch) pitch.title = titleMatch[1].trim();

  const hookMatch = content.match(/##\s*Hook\s*\n([\s\S]*?)(?=\n##|$)/);
  if (hookMatch) pitch.hook = hookMatch[1].trim();

  const angleMatch = content.match(/##\s*الزاوية\s*\n([\s\S]*?)(?=\n##|$)/);
  if (angleMatch) pitch.angle = angleMatch[1].trim();

  const pointsMatch = content.match(/##\s*النقاط الرئيسية\s*\n([\s\S]*?)(?=\n##|$)/);
  if (pointsMatch) {
    const points = pointsMatch[1].match(/\d+\.\s*([^\n]+)/g);
    if (points) {
      pitch.mainPoints = points.map(p => p.replace(/^\d+\.\s*/, '').trim());
    }
  }

  const ctaMatch = content.match(/##\s*CTA\s*\n([\s\S]*?)$/);
  if (ctaMatch) pitch.cta = ctaMatch[1].trim();

  return pitch;
}




