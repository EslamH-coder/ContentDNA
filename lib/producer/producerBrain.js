/**
 * PRODUCER BRAIN
 * Thinks like a show producer to find the best angle
 */

import { getProducerContext, generateProducerSystemPrompt } from './contextLoader.js';

// ============================================
// FIND THE ANGLE
// ============================================
export async function findBestAngle(storyProfile, llmClient) {
  if (!llmClient || !llmClient.messages || !llmClient.messages.create) {
    // Fallback: simple angle generation
    return generateSimpleAngle(storyProfile);
  }
  
  const ctx = getProducerContext();
  const systemPrompt = generateProducerSystemPrompt();
  
  const prompt = `
# معلومات القصة:

العنوان الأصلي: ${storyProfile.article.title}

## العناصر المستخرجة:

الشخصيات:
${storyProfile.elements?.people?.map(p => `- ${p.name} (${p.title}): ${p.action}`).join('\n') || 'لا يوجد'}

الصراع:
${storyProfile.elements?.conflict?.exists 
  ? `${storyProfile.elements.conflict.side_a} vs ${storyProfile.elements.conflict.side_b}\nالمخاطر: ${storyProfile.elements.conflict.stakes}`
  : 'لا يوجد صراع واضح'}

الأرقام:
${storyProfile.elements?.numbers?.map(n => `- ${n.value}: ${n.context}`).join('\n') || 'لا يوجد'}

التأثير على العرب:
${storyProfile.elements?.arab_impact?.potential_impact || 'غير واضح'}

السؤال في ذهن الجمهور:
${storyProfile.elements?.audience_question || 'غير محدد'}

## نقاط القوة الحالية:
- Certainty: ${storyProfile.patternScores.certainty}/10
- Power: ${storyProfile.patternScores.power}/10
- Conflict: ${storyProfile.patternScores.conflict}/10
- Arab Stakes: ${storyProfile.patternScores.arab_stakes}/10
- Personality: ${storyProfile.patternScores.personality}/10

## المطلوب:

بناءً على كل هذا، فكر كمنتج للمخبر الاقتصادي+:

1. ما أفضل زاوية لهذه القصة؟ (The Angle)
2. كيف نجعلها تهم الجمهور العربي؟ (Arab Stakes)
3. ما السؤال الذي سيجذب المشاهد؟ (The Hook Question)
4. من الشخص الذي يجب أن نركز عليه؟ (The Face)

أجب بصيغة JSON فقط:
{
  "angle": {
    "summary": "وصف الزاوية في جملة",
    "why_it_works": "لماذا هذه الزاوية ستنجح مع جمهورنا"
  },
  "arab_connection": {
    "impact": "كيف يؤثر على العرب",
    "countries_to_mention": ["مصر", "السعودية"]
  },
  "hook_question": {
    "question": "السؤال الرئيسي",
    "type": "هل/كيف/لماذا"
  },
  "main_person": {
    "name": "...",
    "title_arabic": "...",
    "why_focus_on_them": "..."
  },
  "suggested_title": "عنوان مقترح",
  "suggested_hook": "Hook مقترح (أول 20 ثانية)",
  "confidence": 7
}
`;

  try {
    const response = await llmClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.4,
      messages: [
        { role: 'user', content: `${systemPrompt}\n\n${prompt}` }
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
    console.error('Failed to parse angle:', e);
    return generateSimpleAngle(storyProfile);
  }
}

// ============================================
// SIMPLE ANGLE GENERATION (FALLBACK)
// ============================================
function generateSimpleAngle(storyProfile) {
  const person = storyProfile.insights.best_person;
  const conflict = storyProfile.insights.best_conflict;
  
  return {
    angle: {
      summary: conflict ? `${conflict.side_a} vs ${conflict.side_b}` : 'قصة اقتصادية مهمة',
      why_it_works: 'Contains key story elements'
    },
    arab_connection: {
      impact: storyProfile.insights.arab_angle || 'تأثير على الاقتصاد العالمي',
      countries_to_mention: ['مصر', 'السعودية']
    },
    hook_question: {
      question: storyProfile.insights.suggested_question || 'ماذا يعني هذا للعرب؟',
      type: 'هل'
    },
    main_person: person ? {
      name: person.name,
      title_arabic: person.title || '',
      why_focus_on_them: 'شخص مؤثر في القصة'
    } : null,
    suggested_title: person ? `هل ${person.name} ${person.action}؟` : 'قصة اقتصادية مهمة',
    suggested_hook: 'Hook يحتاج إلى تحليل أعمق',
    confidence: 5
  };
}

// ============================================
// SCORE POTENTIAL BEFORE GENERATION
// ============================================
export function scorePotential(storyProfile, angle) {
  let score = storyProfile.potential;
  
  // Boost if we found a good angle
  if (angle?.confidence >= 7) {
    score += 10;
  }
  
  // Boost for Arab connection
  if (angle?.arab_connection?.countries_to_mention?.length > 0) {
    score += 10;
  }
  
  // Boost for هل question
  if (angle?.hook_question?.type === 'هل') {
    score += 5;
  }
  
  // Cap at 100
  score = Math.min(100, score);
  
  return {
    score,
    recommendation: score >= 70 ? 'PRODUCE' : score >= 50 ? 'CONSIDER' : 'SKIP',
    reasons: generateReasons(storyProfile, angle, score)
  };
}

function generateReasons(storyProfile, angle, score) {
  const reasons = [];
  
  if (storyProfile.patternScores.power >= 7) {
    reasons.push('✅ شخص قوي/مؤثر في القصة');
  }
  if (storyProfile.patternScores.conflict >= 7) {
    reasons.push('✅ صراع واضح');
  }
  if (storyProfile.patternScores.arab_stakes >= 7) {
    reasons.push('✅ تأثير واضح على العرب');
  }
  if (angle?.hook_question?.type === 'هل') {
    reasons.push('✅ سؤال "هل" قوي');
  }
  
  if (storyProfile.patternScores.arab_stakes < 5) {
    reasons.push('⚠️ التأثير على العرب غير واضح');
  }
  if (storyProfile.patternScores.conflict < 5) {
    reasons.push('⚠️ لا يوجد صراع واضح');
  }
  
  return reasons;
}




