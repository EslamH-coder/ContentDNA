/**
 * AI CLIENTS - Groq + Claude
 */

// ============================================
// GROQ CLIENT (Fast & Cheap - for filtering)
// ============================================
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

export const GROQ_MODELS = {
  FAST: 'llama-3.1-8b-instant',      // $0.05/1M tokens
  SMART: 'llama-3.3-70b-versatile'   // $0.59/1M tokens
};

export async function groqComplete(prompt, options = {}) {
  const {
    model = GROQ_MODELS.FAST,
    temperature = 0.3,
    maxTokens = 500,
    jsonMode = false
  } = options;

  if (!GROQ_API_KEY) {
    console.warn('⚠️ GROQ_API_KEY not set');
    return { success: false, error: 'GROQ_API_KEY not configured' };
  }

  try {
    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
        response_format: jsonMode ? { type: 'json_object' } : undefined
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    return {
      success: true,
      content,
      parsed: jsonMode ? safeParseJSON(content) : null,
      usage: data.usage
    };
  } catch (error) {
    console.error('Groq error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// CLAUDE CLIENT (Quality - for pitching)
// ============================================
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1/messages';

export const CLAUDE_MODELS = {
  SONNET: 'claude-sonnet-4-20250514',    // Best balance
  HAIKU: 'claude-haiku-4-20250514'        // Faster, cheaper
};

export async function claudeComplete(prompt, options = {}) {
  const {
    model = CLAUDE_MODELS.SONNET,
    temperature = 0.7,
    maxTokens = 1000,
    system = null
  } = options;

  if (!ANTHROPIC_API_KEY) {
    console.warn('⚠️ ANTHROPIC_API_KEY not set');
    return { success: false, error: 'ANTHROPIC_API_KEY not configured' };
  }

  try {
    const response = await fetch(ANTHROPIC_BASE_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: system || getDefaultSystem(),
        messages: [{ role: 'user', content: prompt }],
        temperature
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';
    
    return {
      success: true,
      content,
      parsed: safeParseJSON(content),
      usage: data.usage
    };
  } catch (error) {
    console.error('Claude error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// DEFAULT SYSTEM PROMPT FOR CLAUDE
// ============================================
function getDefaultSystem() {
  return `أنت كاتب محتوى محترف لقناة "المخبر الاقتصادي+" على يوتيوب.

القناة:
- قناة عربية تقدم تحليلات اقتصادية وجيوسياسية عميقة
- أسلوب ذكي، مباشر، بدون مبالغة أو clickbait رخيص
- تستهدف جمهور متعلم يريد فهم ما وراء الأخبار
- المقدم: أشرف إبراهيم

أسلوب العناوين الناجحة:
- "لماذا تخسر مصر 10 مليار دولار سنوياً؟"
- "الصين vs أمريكا: من سيفوز بحرب الرقائق؟"
- "كيف أصبحت سنغافورة أغنى من جيرانها؟"
- "الذهب: فقاعة أم فرصة العمر؟"

أسلوب الـ Hooks الناجحة:
- تبدأ بسؤال مثير أو حقيقة صادمة
- تربط الموضوع العالمي بحياة المشاهد العربي
- لا تستخدم "في هذا الفيديو سنتحدث عن..."

ممنوع:
- العناوين الطويلة المملة
- الـ Clickbait الكاذب
- الوعود المبالغ فيها
- الأسلوب الإخباري الجاف`;
}

// ============================================
// HELPER
// ============================================
function safeParseJSON(text) {
  if (!text) return null;
  
  try {
    return JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
}




