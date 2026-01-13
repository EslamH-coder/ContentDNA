import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export async function POST(request) {
  try {
    const { topic, evidence, format } = await request.json();
    
    if (!topic) {
      return NextResponse.json({
        success: false,
        error: 'Topic is required'
      }, { status: 400 });
    }

    const formatName = format?.name || 'فيديو طويل';
    const formatIcon = format?.icon || '🎬';
    
    // Build evidence summary
    const evidenceText = [
      evidence.search_volume > 0 ? `حجم البحث: ${evidence.search_volume.toLocaleString()}` : null,
      evidence.competitor_videos > 0 ? `فيديوهات منافسين: ${evidence.competitor_videos}` : null,
      evidence.competitor_success > 0 ? `فيديوهات ناجحة: ${evidence.competitor_success}` : null,
      evidence.has_current_event ? 'حدث جاري حالياً' : null,
      evidence.comment_mentions > 0 ? `طلبات من الجمهور: ${evidence.comment_mentions}` : null
    ].filter(Boolean).join('، ');

    const systemPrompt = `أنت كاتب محتوى محترف لقناة "المخبر الاقتصادي+" على يوتيوب.

أسلوب القناة:
- تحليل عميق وذكي، ليس إخباري سطحي
- ربط الأحداث ببعضها وإظهار الصورة الكاملة
- أسلوب مباشر بدون clickbait رخيص
- المقدم: أشرف إبراهيم

القواعد الذهبية:
1. اكتب pitch بناءً على محتوى الموضوع الفعلي فقط
2. لا تخترع معلومات أو أرقام غير موجودة
3. لا تضخم أو تبالغ في التأثير
4. الزاوية يجب أن تكون طبيعية ومنطقية
5. لا تقل "للمستثمر العربي" - هذا مفهوم ضمنياً

أمثلة hooks جيدة:
- "الرقم الذي يخفيه الجميع..."
- "ماذا يعني هذا القرار لمحفظتك؟"
- "قصة لم يروِها أحد..."
- "التاريخ يعيد نفسه..."`;

    const userPrompt = `اكتب pitch للموضوع التالي:

📌 الموضوع: ${topic}
${formatIcon} الفورمات: ${formatName}
📊 الأدلة: ${evidenceText || 'لا توجد أدلة متاحة'}

اكتب بالعربية:
## العنوان
[عنوان جذاب وصادق، أقل من 60 حرف]

## Hook
[سؤال أو جملة تجذب في أول 5 ثواني]

## الزاوية
[ما الذي يميز تناولنا؟ جملة واحدة]

## النقاط الرئيسية
1. [نقطة من الموضوع]
2. [نقطة]
3. [نقطة]
4. [نقطة - اختياري]
5. [نقطة - اختياري]

## CTA
[لماذا يشاهد الآن؟]

⚠️ تذكر: لا تخترع معلومات غير موجودة!`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userPrompt
      }]
    });

    const pitchText = response.content[0]?.text || '';
    
    // Parse the pitch
    const pitch = {
      title: '',
      hook: '',
      angle: '',
      mainPoints: [],
      cta: ''
    };

    // Extract title
    const titleMatch = pitchText.match(/##\s*العنوان\s*\n([^\n#]+)/);
    if (titleMatch) pitch.title = titleMatch[1].trim();

    // Extract hook
    const hookMatch = pitchText.match(/##\s*Hook\s*\n([\s\S]*?)(?=\n##|$)/);
    if (hookMatch) pitch.hook = hookMatch[1].trim();

    // Extract angle
    const angleMatch = pitchText.match(/##\s*الزاوية\s*\n([\s\S]*?)(?=\n##|$)/);
    if (angleMatch) pitch.angle = angleMatch[1].trim();

    // Extract main points
    const pointsMatch = pitchText.match(/##\s*النقاط الرئيسية\s*\n([\s\S]*?)(?=\n##|$)/);
    if (pointsMatch) {
      const points = pointsMatch[1].match(/\d+\.\s*([^\n]+)/g);
      if (points) {
        pitch.mainPoints = points.map(p => p.replace(/^\d+\.\s*/, '').trim());
      }
    }

    // Extract CTA
    const ctaMatch = pitchText.match(/##\s*CTA\s*\n([\s\S]*?)$/);
    if (ctaMatch) pitch.cta = ctaMatch[1].trim();

    return NextResponse.json({
      success: true,
      pitch,
      raw: pitchText
    });
  } catch (error) {
    console.error('Pitch generation error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}




