/**
 * SMART COMMENT ANALYZER
 * Uses Groq to filter real requests from praise/spam
 */

import { completeJSON, MODELS } from './groqClient.js';
import { PERSONAS } from './personas.js';

// ============================================
// ANALYZE SINGLE COMMENT
// ============================================
export async function analyzeComment(comment) {
  const personaList = Object.entries(PERSONAS)
    .map(([id, p]) => `- ${id}: ${p.description}`)
    .join('\n');

  const prompt = `
أنت محلل تعليقات لقناة يوتيوب اقتصادية عربية.

حلل هذا التعليق وحدد:
1. هل يحتوي على طلب حقيقي لمحتوى جديد؟
2. ما هو الطلب بالضبط (إن وجد)؟
3. أي شريحة من الجمهور يمثلها؟

التعليق:
"${comment.text || comment}"

الشرائح المتاحة:
${personaList}

أجب بـ JSON فقط:
{
  "hasRealRequest": true/false,
  "requestType": "video_idea" | "question" | "feedback" | "praise" | "complaint" | "other",
  "extractedRequest": "الطلب المستخرج بصيغة واضحة (أو null)",
  "videoIdea": "فكرة فيديو مقترحة بناءً على الطلب (أو null)",
  "persona": "persona_id أو null",
  "confidence": 0.0-1.0,
  "reason": "سبب التصنيف"
}
`;

  const result = await completeJSON(prompt, {
    model: MODELS.FAST, // رخيص وسريع
    temperature: 0.2,
    maxTokens: 300
  });

  if (result.success && result.parsed) {
    return {
      ...(typeof comment === 'object' ? comment : { text: comment }),
      analysis: result.parsed,
      isActionable: result.parsed.hasRealRequest && result.parsed.confidence > 0.6
    };
  }

  // Fallback if AI fails
  return {
    ...(typeof comment === 'object' ? comment : { text: comment }),
    analysis: null,
    isActionable: false
  };
}

// ============================================
// BATCH ANALYZE COMMENTS
// ============================================
export async function analyzeCommentsBatch(comments, batchSize = 5) {
  console.log(`\n💬 Analyzing ${comments.length} comments with AI...`);
  
  const results = [];
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = comments.slice(i, i + batchSize);
    
    const batchPromises = batch.map(c => analyzeComment(c));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults);
    
    // Progress
    console.log(`   Processed ${Math.min(i + batchSize, comments.length)}/${comments.length}`);
    
    // Small delay between batches
    if (i + batchSize < comments.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  
  // Filter actionable only
  const actionable = results.filter(r => r.isActionable);
  
  console.log(`   ✅ Found ${actionable.length} actionable requests\n`);
  
  return {
    all: results,
    actionable,
    stats: {
      total: results.length,
      actionable: actionable.length,
      videoIdeas: actionable.filter(r => r.analysis?.videoIdea).length,
      byPersona: groupByPersona(actionable)
    }
  };
}

// ============================================
// EXTRACT VIDEO IDEAS
// ============================================
export async function extractVideoIdeas(comments) {
  const analyzed = await analyzeCommentsBatch(comments);
  
  const ideas = analyzed.actionable
    .filter(c => c.analysis?.videoIdea)
    .map(c => ({
      idea: c.analysis.videoIdea,
      originalComment: (c.text || '').substring(0, 100),
      persona: c.analysis.persona,
      personaName: PERSONAS[c.analysis.persona]?.name || 'General',
      confidence: c.analysis.confidence,
      likes: c.likes || 0,
      author: c.author
    }))
    .sort((a, b) => {
      // Sort by confidence * likes
      const scoreA = a.confidence * (1 + a.likes);
      const scoreB = b.confidence * (1 + b.likes);
      return scoreB - scoreA;
    });
  
  return ideas;
}

// ============================================
// FILTER REAL REQUESTS ONLY
// ============================================
export async function filterRealRequests(comments) {
  // Pre-filter obvious non-requests
  const candidates = comments.filter(c => {
    const text = (c.text || '').toString();
    
    // Skip very short comments
    if (text.length < 20) return false;
    
    // Skip pure emoji comments
    if (/^[\s\u{1F300}-\u{1F9FF}]+$/u.test(text)) return false;
    
    // Keep if has request indicators
    const requestIndicators = [
      'ممكن', 'ياريت', 'يا ريت', 'نريد', 'اريد', 'أريد',
      'اتمنى', 'أتمنى', 'حلقة عن', 'فيديو عن', 'موضوع عن',
      'تتكلم عن', 'تتحدث عن', 'سؤال', 'كيف', 'ليه', 'ليش',
      'هل يمكن', 'لو سمحت', 'طلب', 'اقتراح', 'نحتاج'
    ];
    
    const hasIndicator = requestIndicators.some(ind => text.includes(ind));
    
    // Also keep questions
    const hasQuestion = text.includes('؟') || text.includes('?');
    
    return hasIndicator || hasQuestion;
  });
  
  console.log(`   Pre-filtered: ${comments.length} → ${candidates.length} candidates`);
  
  // AI analyze candidates only (saves tokens!)
  return analyzeCommentsBatch(candidates);
}

// ============================================
// HELPERS
// ============================================
function groupByPersona(comments) {
  const grouped = {};
  
  for (const c of comments) {
    const persona = c.analysis?.persona || 'unknown';
    if (!grouped[persona]) grouped[persona] = [];
    grouped[persona].push(c);
  }
  
  return grouped;
}




