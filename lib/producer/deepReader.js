/**
 * DEEP READER
 * Fetches and analyzes FULL article content
 * Not just the title - the producer reads everything
 */

import { getProducerContext } from './contextLoader.js';

// ============================================
// FETCH FULL ARTICLE
// ============================================
export async function fetchFullArticle(url) {
  try {
    // Try to fetch article content
    // First, try using the URL directly
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // Simple extraction (can be enhanced with proper HTML parsing)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract text content (remove scripts, styles, etc.)
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit content length
    content = content.substring(0, 8000);
    
    return {
      success: true,
      title: title || 'Untitled',
      content: content,
      url: url,
      date: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to fetch article:', error.message);
    return {
      success: false,
      error: error.message,
      url: url
    };
  }
}

// ============================================
// EXTRACT STORY ELEMENTS
// ============================================
export async function extractStoryElements(articleContent, llmClient) {
  if (!llmClient || !llmClient.messages || !llmClient.messages.create) {
    // Fallback: simple extraction without LLM
    return extractStoryElementsSimple(articleContent);
  }
  
  const ctx = getProducerContext();
  
  const prompt = `
اقرأ هذا المقال واستخرج العناصر التالية بدقة:

المقال:
"""
${articleContent.substring(0, 8000)}
"""

استخرج بالعربي:

1. الشخصيات الرئيسية (People):
   - من هم الأشخاص المذكورين؟
   - ما مناصبهم/ألقابهم؟
   - ما أفعالهم في الخبر؟

2. الكيانات (Entities):
   - دول
   - شركات
   - مؤسسات

3. الأرقام والإحصائيات:
   - أي أرقام مذكورة؟
   - نسب مئوية؟
   - مبالغ مالية؟
   - تواريخ محددة؟

4. الصراع/التوتر (Conflict):
   - هل هناك طرفان متصارعان؟
   - ما هو موضوع الخلاف؟
   - ما هي المخاطر/العواقب؟

5. التأثير على المنطقة العربية:
   - هل يذكر المقال تأثيراً على العرب؟
   - إذا لم يذكر، ما التأثير المحتمل على مصر/السعودية/الخليج؟

6. السؤال الرئيسي:
   - ما السؤال الذي يطرحه هذا الخبر؟
   - ما السؤال الذي سيكون في ذهن الجمهور العربي؟

أجب بصيغة JSON فقط:
{
  "people": [
    {"name": "...", "title": "...", "action": "..."}
  ],
  "entities": [
    {"name": "...", "type": "country|company|institution"}
  ],
  "numbers": [
    {"value": "...", "context": "..."}
  ],
  "conflict": {
    "exists": true/false,
    "side_a": "...",
    "side_b": "...",
    "stakes": "..."
  },
  "arab_impact": {
    "mentioned": true/false,
    "potential_impact": "...",
    "affected_countries": ["مصر", "السعودية"]
  },
  "main_question": "...",
  "audience_question": "..."
}
`;

  try {
    const response = await llmClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.2,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    
    const responseText = response.content[0].text.trim();
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse story elements:', e);
    return extractStoryElementsSimple(articleContent);
  }
}

// ============================================
// SIMPLE EXTRACTION (FALLBACK)
// ============================================
function extractStoryElementsSimple(content) {
  const text = content.toLowerCase();
  
  // Extract people (simple patterns)
  const people = [];
  const peoplePatterns = [
    /(?:president|رئيس|مدير|ceo|ملك|أمير)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    /([A-Z][a-z]+\s+(?:Trump|Biden|Putin|Xi|Musk|Powell))/g
  ];
  
  // Extract numbers
  const numbers = [];
  const numberPatterns = [
    /\$?(\d+(?:\.\d+)?)\s*(?:billion|million|trillion|مليار|مليون|تريليون)/gi,
    /(\d+(?:\.\d+)?)%/g
  ];
  
  // Extract entities
  const entities = [];
  const entityPatterns = [
    /(?:United States|USA|أمريكا|America)/gi,
    /(?:China|الصين)/gi,
    /(?:Russia|روسيا)/gi,
    /(?:Saudi Arabia|السعودية)/gi,
    /(?:Egypt|مصر)/gi
  ];
  
  return {
    people: people.slice(0, 5),
    entities: entities.slice(0, 5),
    numbers: numbers.slice(0, 5),
    conflict: {
      exists: /(?:vs|against|ضد|صراع|حرب|conflict)/i.test(content),
      side_a: null,
      side_b: null,
      stakes: null
    },
    arab_impact: {
      mentioned: /(?:مصر|السعودية|الخليج|العرب|arab)/i.test(content),
      potential_impact: null,
      affected_countries: []
    },
    main_question: null,
    audience_question: null
  };
}

// ============================================
// BUILD STORY PROFILE
// ============================================
export function buildStoryProfile(articleData, extractedElements) {
  const ctx = getProducerContext();
  
  // Calculate behavior pattern scores
  const patternScores = {
    certainty: 0,
    power: 0,
    conflict: 0,
    arab_stakes: 0,
    mobile_first: 0,
    personality: 0
  };
  
  // Pattern 1: Certainty - Is there a clear question?
  if (extractedElements?.audience_question) {
    patternScores.certainty = 8;
    if (extractedElements.audience_question.startsWith('هل')) {
      patternScores.certainty = 10;
    }
  }
  
  // Pattern 2: Power - Is there a powerful person?
  if (extractedElements?.people?.length > 0) {
    const powerPeople = ['president', 'ceo', 'رئيس', 'مدير', 'ملك', 'أمير'];
    const hasPowerPerson = extractedElements.people.some(p => 
      powerPeople.some(pp => (p.title || '').toLowerCase().includes(pp))
    );
    patternScores.power = hasPowerPerson ? 10 : 5;
  }
  
  // Pattern 3: Conflict
  if (extractedElements?.conflict?.exists) {
    patternScores.conflict = 10;
  }
  
  // Pattern 4: Arab Stakes
  if (extractedElements?.arab_impact?.mentioned) {
    patternScores.arab_stakes = 10;
  } else if (extractedElements?.arab_impact?.potential_impact) {
    patternScores.arab_stakes = 7;
  }
  
  // Pattern 6: Personality
  if (extractedElements?.people?.length > 0) {
    patternScores.personality = 10;
  }
  
  // Calculate total potential
  const totalScore = Object.values(patternScores).reduce((a, b) => a + b, 0);
  const maxScore = 60;
  const potential = Math.round((totalScore / maxScore) * 100);
  
  return {
    article: articleData,
    elements: extractedElements,
    patternScores,
    potential,
    
    // Producer insights
    insights: {
      best_person: extractedElements?.people?.[0] || null,
      best_conflict: extractedElements?.conflict || null,
      best_number: extractedElements?.numbers?.[0] || null,
      arab_angle: extractedElements?.arab_impact?.potential_impact || null,
      suggested_question: extractedElements?.audience_question || null
    }
  };
}




