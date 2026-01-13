/**
 * GROQ CLIENT
 * Free, fast LLM API
 * 
 * Groq Free Tier:
 * - 30 requests/minute
 * - 14,400 requests/day
 * - Models: llama-3.3-70b, mixtral-8x7b
 */

// ============================================
// CONFIGURATION
// ============================================
const GROQ_CONFIG = {
  baseUrl: 'https://api.groq.com/openai/v1',
  
  // Models (in order of preference)
  models: {
    powerful: 'llama-3.3-70b-versatile',  // Best quality
    fast: 'llama-3.1-8b-instant',          // Fastest
    balanced: 'mixtral-8x7b-32768'         // Good balance
  },
  
  // Rate limiting
  maxRequestsPerMinute: 30
};

// ============================================
// GROQ CLIENT CLASS
// ============================================
export class GroqClient {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.GROQ_API_KEY;
    
    if (!this.apiKey) {
      console.warn('⚠️ GROQ_API_KEY not set. Groq features will be disabled.');
      console.warn('   Get a free key at: https://console.groq.com');
      this.apiKey = null;
    }
    
    this.requestCount = 0;
    this.lastResetTime = Date.now();
  }
  
  // ============================================
  // RATE LIMITING
  // ============================================
  async waitForRateLimit() {
    if (!this.apiKey) {
      throw new Error('Groq API key not configured');
    }
    
    const now = Date.now();
    
    // Reset counter every minute
    if (now - this.lastResetTime > 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }
    
    // If at limit, wait
    if (this.requestCount >= GROQ_CONFIG.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - this.lastResetTime);
      console.log(`⏳ Groq rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }
    
    this.requestCount++;
  }
  
  // ============================================
  // MAIN COMPLETION METHOD
  // ============================================
  async complete({ system, prompt, temperature = 0.5, model = 'powerful' }) {
    if (!this.apiKey) {
      throw new Error('Groq API key not configured. Set GROQ_API_KEY in .env');
    }
    
    await this.waitForRateLimit();
    
    const modelId = GROQ_CONFIG.models[model] || GROQ_CONFIG.models.powerful;
    
    const messages = [];
    
    if (system) {
      messages.push({ role: 'system', content: system });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    try {
      const startTime = Date.now();
      
      const response = await fetch(`${GROQ_CONFIG.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          temperature,
          max_tokens: 2000
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(`Groq API error: ${error.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      const latency = Date.now() - startTime;
      
      return {
        content: data.choices[0].message.content,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens
        },
        model: modelId,
        provider: 'groq',
        latency
      };
      
    } catch (error) {
      console.error('Groq API error:', error);
      throw error;
    }
  }
  
  // ============================================
  // EXTRACT STORY ELEMENTS (Structured output)
  // ============================================
  async extractStoryElements(articleContent) {
    const prompt = `
اقرأ هذا المقال واستخرج العناصر التالية بصيغة JSON فقط:

المقال:
"""
${articleContent.substring(0, 6000)}
"""

استخرج:
{
  "people": [{"name": "...", "title": "...", "action": "..."}],
  "entities": [{"name": "...", "type": "country|company"}],
  "numbers": [{"value": "...", "context": "..."}],
  "conflict": {"exists": true/false, "side_a": "...", "side_b": "...", "stakes": "..."},
  "arab_impact": {"potential": "...", "countries": ["مصر", "السعودية"]},
  "main_question": "السؤال الرئيسي للجمهور العربي"
}

أجب بـ JSON فقط، بدون أي نص إضافي.
`;

    const response = await this.complete({
      prompt,
      temperature: 0.2,
      model: 'fast' // Use fast model for extraction
    });
    
    try {
      // Clean the response (remove markdown code blocks if present)
      let jsonStr = response.content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse extraction:', e);
      console.error('Raw response:', response.content.substring(0, 200));
      return null;
    }
  }
  
  // ============================================
  // FIND ANGLE
  // ============================================
  async findAngle(storyElements, context) {
    const prompt = `
بناءً على هذه العناصر، اقترح أفضل زاوية لقناة "المخبر الاقتصادي+":

العناصر:
${JSON.stringify(storyElements, null, 2)}

الجمهور:
- 94% رجال عرب
- مصر 22%، السعودية 15%
- يحبون: الصراعات، الشخصيات القوية، التأثير على العرب
- أفضل سؤال: "هل" (يعد بإجابة نعم/لا)

أجب بصيغة JSON:
{
  "angle": "الزاوية المقترحة في جملة",
  "hook_question": "سؤال الـ Hook (يبدأ بهل/كيف/لماذا)",
  "arab_connection": "كيف نربطها بالعرب",
  "main_person": "الشخص الرئيسي للتركيز عليه",
  "title_suggestion": "اقتراح عنوان",
  "confidence": 1-10
}
`;

    const response = await this.complete({
      prompt,
      temperature: 0.4,
      model: 'balanced'
    });
    
    try {
      let jsonStr = response.content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse angle:', e);
      console.error('Raw response:', response.content.substring(0, 200));
      return null;
    }
  }
  
  // ============================================
  // GENERATE CONTENT
  // ============================================
  async generateContent(angle, storyElements, systemPrompt) {
    const prompt = `
# الزاوية المحددة:
${angle.angle}

# الشخص الرئيسي:
${angle.main_person || 'غير محدد'}

# الربط بالعرب:
${angle.arab_connection}

# الأرقام المتاحة:
${storyElements.numbers?.map(n => `${n.value}: ${n.context}`).join('\n') || 'لا يوجد'}

# المطلوب:

1. عنوان (يبدأ بهل/كيف/لماذا، يذكر شخص بالاسم)
2. Hook (أول 15-20 ثانية، يبدأ مباشرة، فيه رقم أو تاريخ)

# ممنوع: هل تعلم، في بلدك، فاتورتك، الحقائق المخفية

أجب بصيغة JSON:
{
  "title": "العنوان",
  "hook": "الـ Hook",
  "patterns_used": ["Pattern1", "Pattern2"]
}
`;

    const response = await this.complete({
      system: systemPrompt,
      prompt,
      temperature: 0.5,
      model: 'powerful'
    });
    
    try {
      let jsonStr = response.content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse content:', e);
      console.error('Raw response:', response.content.substring(0, 200));
      return null;
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================
let groqInstance = null;

export function getGroqClient() {
  if (!groqInstance) {
    groqInstance = new GroqClient();
  }
  return groqInstance;
}

// ============================================
// HEALTH CHECK
// ============================================
export async function checkGroqHealth() {
  try {
    const client = getGroqClient();
    if (!client.apiKey) {
      return {
        healthy: false,
        error: 'GROQ_API_KEY not configured'
      };
    }
    
    const startTime = Date.now();
    const response = await client.complete({
      prompt: 'Say "OK" in one word.',
      temperature: 0,
      model: 'fast'
    });
    
    return {
      healthy: response.content.toLowerCase().includes('ok'),
      latency: Date.now() - startTime,
      model: response.model
    };
  } catch (e) {
    return {
      healthy: false,
      error: e.message
    };
  }
}




