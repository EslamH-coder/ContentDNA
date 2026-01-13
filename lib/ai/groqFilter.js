/**
 * GROQ FILTER - Stage 1
 * Fast filtering and basic classification
 */

import { groqComplete, GROQ_MODELS } from './clients.js';
import { PERSONAS } from '../intelligence/personas.js';

// ============================================
// FILTER NEWS BATCH
// ============================================
export async function filterNewsBatch(newsItems, channelDNA = {}) {
  if (!newsItems || newsItems.length === 0) {
    console.log(`\n🔍 Stage 1: No items to filter\n`);
    return [];
  }
  
  console.log(`\n🔍 Stage 1: Filtering ${newsItems.length} items with Groq...`);
  
  const results = [];
  
  try {
    // Process in batches of 5 for efficiency
    for (let i = 0; i < newsItems.length; i += 5) {
      const batch = newsItems.slice(i, i + 5);
      try {
        const batchResults = await Promise.all(
          batch.map(item => filterSingleNews(item, channelDNA).catch(e => {
            console.warn('Error filtering item:', e.message);
            return {
              ...(typeof item === 'object' ? item : { title: item }),
              isRelevant: false,
              relevanceScore: 0,
              primaryPersona: 'none',
              error: e.message
            };
          }))
        );
        results.push(...batchResults);
      } catch (e) {
        console.warn('Batch processing error:', e.message);
        // Add items with fallback scoring
        batch.forEach(item => {
          results.push({
            ...(typeof item === 'object' ? item : { title: item }),
            isRelevant: basicRelevanceCheck(item.title || item, item.description || ''),
            relevanceScore: 30,
            primaryPersona: 'none',
            filtered: false
          });
        });
      }
      
      // Small delay to avoid rate limits
      if (i + 5 < newsItems.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
  } catch (e) {
    console.error('Filtering failed completely:', e.message);
    // Return all items with basic scoring as fallback
    return newsItems.slice(0, 20).map(item => ({
      ...(typeof item === 'object' ? item : { title: item }),
      isRelevant: true,
      relevanceScore: 30,
      primaryPersona: 'none',
      filtered: false
    }));
  }
  
  // Sort by relevance and return top candidates
  const relevant = results
    .filter(r => r.isRelevant && (r.relevanceScore || 0) >= 40)
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  
  console.log(`   ✅ Found ${relevant.length} relevant items\n`);
  
  return relevant;
}

// ============================================
// FILTER SINGLE NEWS
// ============================================
async function filterSingleNews(newsItem, channelDNA) {
  const title = newsItem.title || newsItem;
  const description = newsItem.description || '';
  
  const prompt = `
صنّف هذا الخبر لقناة اقتصادية عربية:

العنوان: "${title}"
${description ? `الوصف: "${description.substring(0, 200)}"` : ''}

DNA القناة:
- المواضيع: اقتصاد، جيوسياسة، تقنية، أعمال
- المناطق: العالم العربي، الصين، أمريكا، أوروبا
- الأسلوب: تحليلي، تفسيري، غير إخباري

أجب بـ JSON فقط:
{
  "isRelevant": true/false,
  "relevanceScore": 0-100,
  "primaryTopic": "economy|geopolitics|tech|business|other",
  "primaryPersona": "geopolitics|investor|tech_future|egyptian_business|gulf_oil|curious_learner|employee|student_entrepreneur|none",
  "reason": "سبب قصير",
  "skip_reason": "إذا غير مناسب، لماذا؟"
}`;

  const result = await groqComplete(prompt, {
    model: GROQ_MODELS.FAST,
    temperature: 0.2,
    jsonMode: true,
    maxTokens: 300
  });

  if (result.success && result.parsed) {
    return {
      ...(typeof newsItem === 'object' ? newsItem : { title: newsItem }),
      ...result.parsed,
      filtered: true
    };
  }

  // Fallback: basic keyword matching
  return {
    ...(typeof newsItem === 'object' ? newsItem : { title: newsItem }),
    isRelevant: basicRelevanceCheck(title, description),
    relevanceScore: 30,
    primaryPersona: 'none',
    filtered: false
  };
}

// ============================================
// BASIC RELEVANCE CHECK (Fallback)
// ============================================
function basicRelevanceCheck(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  
  const relevantKeywords = [
    'اقتصاد', 'economy', 'دولار', 'dollar', 'ذهب', 'gold',
    'الصين', 'china', 'أمريكا', 'america', 'ترامب', 'trump',
    'نفط', 'oil', 'استثمار', 'invest', 'بورصة', 'stock',
    'مصر', 'egypt', 'السعودية', 'saudi', 'تضخم', 'inflation'
  ];
  
  return relevantKeywords.some(kw => text.includes(kw));
}

// ============================================
// SMART COMMENT FILTER
// ============================================
export async function filterComments(comments) {
  console.log(`\n💬 Filtering ${comments.length} comments...`);
  
  const candidates = comments.filter(c => {
    const text = (c.text || '').toString();
    if (text.length < 15) return false;
    
    // Must have request/question indicators
    const indicators = [
      'ممكن', 'ياريت', 'يا ريت', 'نريد', 'اريد', 'أريد',
      'اتمنى', 'أتمنى', 'حلقة عن', 'فيديو عن', 'موضوع عن',
      'كيف', 'ليه', 'ليش', 'هل', '؟', '?', 'سؤال', 'اقتراح'
    ];
    
    return indicators.some(ind => text.includes(ind));
  });
  
  console.log(`   Pre-filtered: ${comments.length} → ${candidates.length}`);
  
  if (candidates.length === 0) return [];
  
  // Batch analyze with Groq
  const analyzed = [];
  
  for (const comment of candidates.slice(0, 30)) {
    const result = await analyzeComment(comment);
    if (result.isRealRequest) {
      analyzed.push(result);
    }
  }
  
  console.log(`   ✅ Found ${analyzed.length} real requests\n`);
  
  return analyzed;
}

// ============================================
// ANALYZE SINGLE COMMENT
// ============================================
async function analyzeComment(comment) {
  const text = (comment.text || '').toString().substring(0, 300);
  
  const prompt = `
حلل هذا التعليق على قناة يوتيوب اقتصادية:

"${text}"

هل هذا:
1. طلب حقيقي لفيديو/موضوع جديد؟
2. مجرد شكر/مدح/دعاء؟
3. سؤال يحتاج إجابة؟
4. شكوى؟

إذا كان طلب حقيقي، استخرج فكرة الفيديو بوضوح.

أجب بـ JSON:
{
  "isRealRequest": true/false,
  "type": "video_request|question|praise|complaint|other",
  "extractedIdea": "فكرة الفيديو المستخرجة (أو null)",
  "targetPersona": "persona_id (أو null)",
  "confidence": 0.0-1.0
}`;

  const result = await groqComplete(prompt, {
    model: GROQ_MODELS.FAST,
    temperature: 0.2,
    jsonMode: true,
    maxTokens: 300
  });

  if (result.success && result.parsed) {
    return {
      ...comment,
      ...result.parsed
    };
  }

  return {
    ...comment,
    isRealRequest: false
  };
}

