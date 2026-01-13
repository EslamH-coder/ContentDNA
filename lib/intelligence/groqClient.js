/**
 * GROQ CLIENT
 * Fast & cheap AI for content intelligence
 */

// ============================================
// GROQ CONFIGURATION
// ============================================
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

// Models (cheapest to most capable)
export const MODELS = {
  FAST: 'llama-3.1-8b-instant',      // $0.05/1M - للفلترة السريعة
  SMART: 'llama-3.3-70b-versatile',   // $0.59/1M - للتحليل العميق
  BALANCED: 'llama-3.1-70b-versatile' // $0.59/1M - بديل
};

// ============================================
// MAIN COMPLETION FUNCTION
// ============================================
export async function complete(prompt, options = {}) {
  const {
    model = MODELS.FAST,
    temperature = 0.3,
    maxTokens = 500,
    jsonMode = false
  } = options;
  
  if (!GROQ_API_KEY) {
    console.warn('⚠️ GROQ_API_KEY not set, skipping AI analysis');
    return {
      success: false,
      error: 'GROQ_API_KEY not configured',
      content: null
    };
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
      usage: data.usage,
      model
    };
  } catch (error) {
    console.error('Groq error:', error.message);
    return {
      success: false,
      error: error.message,
      content: null
    };
  }
}

// ============================================
// STRUCTURED COMPLETION (JSON)
// ============================================
export async function completeJSON(prompt, options = {}) {
  const result = await complete(prompt, { ...options, jsonMode: true });
  
  if (result.success && result.content) {
    try {
      result.parsed = JSON.parse(result.content);
    } catch (e) {
      // Try to extract JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result.parsed = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          result.parsed = null;
        }
      } else {
        result.parsed = null;
      }
    }
  }
  
  return result;
}




