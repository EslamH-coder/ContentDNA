import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const { signal, showDna, format = 'long_form' } = await request.json()

    if (!signal) {
      return NextResponse.json(
        { error: 'Signal data is required' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Extract signal information
    const signalTitle = signal.title || 'Untitled Signal'
    const signalDescription = signal.description || ''
    const signalUrl = signal.url || ''
    const signalScore = signal.score || 0
    const signalHookPotential = signal.hook_potential || 0
    const signalType = signal.type || 'news'
    const signalTopic = signal.raw_data?.scoring?.topicId || 'general'
    const signalSource = signal.raw_data?.sourceName || 'Unknown Source'
    
    // Build the prompt for Arabic content generation
    const prompt = `أنت مساعد إنتاج محتوى متخصص في الاقتصاد والجيوسياسة للقنوات العربية على يوتيوب.

══════════════════════════════════════════════════════
المهمة: إنشاء بريف (Brief) لفيديو مقترح بناءً على إشارة RSS
══════════════════════════════════════════════════════

**معلومات الإشارة:**
- العنوان: ${signalTitle}
- الوصف: ${signalDescription.substring(0, 500)}
- المصدر: ${signalSource}
- النوع: ${signalType}
- الموضوع: ${signalTopic}
- النقاط: ${signalScore}/10
- إمكانية الجذب: ${signalHookPotential}/10
${signalUrl ? `- الرابط: ${signalUrl}` : ''}

**DNA القناة (المواضيع المفضلة):**
${showDna && Array.isArray(showDna) ? showDna.join(', ') : 'غير محدد'}

**الصيغة المطلوبة:** ${format === 'long_form' ? 'فيديو طويل (25-30 دقيقة)' : 'شورت (45 ثانية)'}

${format === 'long_form' 
  ? `⚠️ **مهم جداً - للفيديو الطويل فقط:**
- هذه الإشارة يجب أن تكون مناسبة للفيديو الطويل (موضوع معقد يحتاج شرح عميق)
- إذا كانت الإشارة بسيطة جداً أو خبر سريع، رفضها وقل "هذه الإشارة مناسبة للشورت فقط"
- الفيديو الطويل يحتاج: موضوع معقد، تحليل عميق، ربط بسياق أوسع، شرح تفصيلي`
  : `⚠️ **مهم جداً - للشورت فقط:**
- هذه الإشارة يجب أن تكون مناسبة للشورت (خبر سريع، كشف سريع، معلومة قوية)
- إذا كانت الإشارة معقدة جداً أو تحتاج شرح طويل، رفضها وقل "هذه الإشارة مناسبة للفيديو الطويل فقط"
- الشورت يحتاج: Hook قوي جداً، معلومة واحدة مركزة، أثر عملي مباشر، دعوة للتفاعل`
}

══════════════════════════════════════════════════════
المطلوب: إنشاء بريف بالعربية يحتوي على:
══════════════════════════════════════════════════════

1. **العنوان المقترح** (55-80 حرف):
   - يجب أن يحتوي على: أرقام/نسب مئوية + سؤال مباشر + أثر محلي
   - مثال: "النفط يرتفع 10%: إيه تأثير على أسعار البنزين في مصر؟"
   - ⚠️ ممنوع نسخ عنوان RSS حرفياً - يجب أن يكون جديد تماماً

2. **Hook (جملة افتتاحية)** (≤ 18 كلمة):
   ${format === 'long_form' 
     ? '- جملة واحدة تفتح السؤال/المشكلة مباشرة (15 ثانية الأولى)'
     : '- جملة قوية جداً (3 ثواني الأولى - يجب أن تحافظ على المشاهد)'
   }
   - مثال: "هل تعرف أن ارتفاع أسعار النفط سيؤثر على راتبك الشهري؟"

3. **الزاوية (Angle)**:
   - جملة واحدة توضح نهج الفيديو
   ${format === 'long_form'
     ? '- للفيديو الطويل: ربط الخبر العالمي (RSS) بتأثيره العملي على المشاهد العربي + شرح عميق'
     : '- للشورت: كشف سريع + أثر عملي مباشر + دعوة للتفاعل'
   }

4. **لماذا الآن (Why Now)**:
   - سبب التوقيت (من RSS أو ترند)
   - مثال: "هذا الأسبوع: ارتفاع أسعار النفط 10%"

5. **لمن (Target Audience)**:
   - الشخصية المستهدفة
   - مثال: "موظف/موظفة في منتصف المسار المهني مهتم بالاقتصاد العملي"

6. **النقاط الرئيسية (Key Points)** (3-5 نقاط):
   ${format === 'long_form'
     ? '- للفيديو الطويل: 5-7 نقاط رئيسية للتغطية العميقة'
     : '- للشورت: 3 نقاط فقط - الأهم والأكثر تأثيراً'
   }
   - كل نقطة في سطر منفصل

7. **النتيجة العملية (Practical Outcome)**:
   - ما الذي سيحصل عليه المشاهد
   - مثال: "فهم تأثير ارتفاع النفط على ميزانيته الشخصية + خطوات عملية للتعامل معه"

${format === 'long_form' 
  ? '8. **المدة المقترحة:** 25-30 دقيقة\n9. **هدف الاستبقاء:** 74%+ عند 30 ثانية'
  : '8. **المدة المقترحة:** 45 ثانية\n9. **هدف الاستبقاء:** 115%+ عند 3 ثواني\n10. **هدف Shorts Feed:** 90%+'
}

══════════════════════════════════════════════════════
قواعد صارمة:
══════════════════════════════════════════════════════

✅ يجب:
- العنوان جديد تماماً (لا ينسخ RSS)
- يحتوي على أرقام/سؤال/أثر محلي
- بالعربية الفصحى البسيطة
- يركز على الجانب العملي
${format === 'short_form' 
  ? '- للشورت: Hook قوي جداً في أول 3 ثواني، معلومة واحدة مركزة، أثر عملي مباشر'
  : '- للفيديو الطويل: موضوع معقد يحتاج شرح عميق، ربط بسياق أوسع، تحليل تفصيلي'
}

❌ ممنوع:
- نسخ عنوان RSS حرفياً أو ترجمته
- عناوين عامة بدون أرقام/زمن/خطر/فرصة
- "القصة الكاملة" / "ماذا يحدث الآن؟" / "شرح مبسط"
${format === 'short_form'
  ? '- للشورت: مواضيع معقدة تحتاج شرح طويل، تحليل عميق، معلومات كثيرة'
  : '- للفيديو الطويل: أخبار بسيطة جداً، معلومات سريعة، مواضيع سطحية'
}

أعد الإجابة بصيغة JSON:
{
  "title_ar": "...",
  "hook_ar": "...",
  "angle_ar": "...",
  "why_now_ar": "...",
  "target_audience_ar": "...",
  "key_points_ar": ["...", "...", "..."],
  "practical_outcome_ar": "...",
  "format": "${format}",
  "duration": "${format === 'long_form' ? '25-30 دقيقة' : '45 ثانية'}",
  "target_retention": "${format === 'long_form' ? '74%+ عند 30 ثانية' : '115%+ عند 3 ثواني'}"
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    // Extract text from response
    const responseText = message.content[0].text

    // Try to parse JSON from response
    let brief
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                       responseText.match(/(\{[\s\S]*\})/)
      if (jsonMatch) {
        brief = JSON.parse(jsonMatch[1])
      } else {
        // Fallback: return raw text
        brief = { raw: responseText }
      }
    } catch (e) {
      // If parsing fails, return raw text
      brief = { raw: responseText, error: 'Failed to parse JSON response' }
    }

    return NextResponse.json({ 
      success: true,
      brief,
      rawResponse: responseText 
    })
  } catch (error) {
    console.error('Error generating brief:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to generate brief',
        details: error.toString()
      },
      { status: 500 }
    )
  }
}

