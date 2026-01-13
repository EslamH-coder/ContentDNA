/**
 * COMMENT ANALYZER
 * Extracts questions, requests, and insights from comments
 */

import { loadUnifiedData } from '../data/dataImporter.js';
import { getGroqClient } from '../llm/groqClient.js';
import { filterUsefulComments } from '../commentFilter.js';

// ============================================
// ANALYZE ALL COMMENTS
// ============================================
export async function analyzeComments() {
  const data = await loadUnifiedData();
  
  if (!data?.comments?.length) {
    return { error: 'No comments data available' };
  }
  
  const allComments = data.comments;
  
  // Filter out appreciation/spam comments before analysis
  const usefulComments = filterUsefulComments(allComments);
  
  console.log(`💬 Filtered ${allComments.length} comments → ${usefulComments.length} useful comments`);
  
  let groq;
  try {
    groq = getGroqClient();
  } catch (e) {
    console.warn('⚠️ Groq not available, using simple analysis');
    return analyzeCommentsSimple(usefulComments);
  }
  
  console.log(`💬 Analyzing ${usefulComments.length} useful comments...`);
  
  // Batch analyze for efficiency
  const batchSize = 50;
  const allAnalyzed = [];
  
  for (let i = 0; i < usefulComments.length; i += batchSize) {
    const batch = usefulComments.slice(i, i + batchSize);
    const analyzed = await analyzeBatch(batch, groq);
    allAnalyzed.push(...analyzed);
    
    console.log(`   Processed ${Math.min(i + batchSize, usefulComments.length)}/${usefulComments.length}`);
  }
  
  // Extract insights
  const insights = extractInsights(allAnalyzed);
  
  // Save insights to unified data
  const unifiedData = await loadUnifiedData();
  if (unifiedData) {
    unifiedData.commentInsights = insights;
    await saveUnifiedData(unifiedData);
  }
  
  return {
    analyzed: allAnalyzed,
    insights,
    summary: {
      total: allComments.length,
      filtered: usefulComments.length,
      skipped: allComments.length - usefulComments.length,
      questions: allAnalyzed.filter(c => c.analysis?.type === 'question').length,
      requests: allAnalyzed.filter(c => c.analysis?.type === 'request').length,
      complaints: allAnalyzed.filter(c => c.analysis?.type === 'complaint').length,
      praise: allAnalyzed.filter(c => c.analysis?.type === 'praise').length
    }
  };
}

// ============================================
// SIMPLE ANALYSIS (No LLM)
// ============================================
function analyzeCommentsSimple(comments) {
  // Comments are already filtered by filterUsefulComments before this function
  const insights = {
    topQuestions: [],
    topRequests: [],
    videoIdeas: [],
    frequentTopics: {},
    sentiment: { positive: 0, negative: 0, neutral: 0 }
  };
  
  const questionWords = ['؟', '?', 'هل', 'كيف', 'لماذا', 'ماذا', 'متى', 'أين', 'من'];
  const requestWords = ['أريد', 'أرجو', 'أتمنى', 'please', 'can you', 'could you'];
  
  for (const comment of comments) {
    const text = (comment.text || comment.content || comment.snippet?.textDisplay || '').toLowerCase();
    
    // Simple question detection
    if (questionWords.some(q => text.includes(q))) {
      const commentText = comment.text || comment.content || comment.snippet?.textDisplay || '';
      insights.topQuestions.push({
        question: commentText.substring(0, 100),
        originalComment: commentText.substring(0, 100),
        likes: comment.likes || 0
      });
    }
    
    // Simple request detection
    if (requestWords.some(r => text.includes(r))) {
      const commentText = comment.text || comment.content || comment.snippet?.textDisplay || '';
      insights.topRequests.push({
        request: commentText.substring(0, 100),
        originalComment: commentText.substring(0, 100),
        likes: comment.likes || 0
      });
    }
  }
  
  // Sort by likes
  insights.topQuestions.sort((a, b) => b.likes - a.likes);
  insights.topRequests.sort((a, b) => b.likes - a.likes);
  
  return {
    analyzed: comments.map(c => ({ ...c, analysis: null })),
    insights,
    summary: {
      total: comments.length,
      questions: insights.topQuestions.length,
      requests: insights.topRequests.length,
      complaints: 0,
      praise: 0
    }
  };
}

// ============================================
// ANALYZE BATCH OF COMMENTS
// ============================================
async function analyzeBatch(comments, groq) {
  const prompt = `
حلل هذه التعليقات من قناة يوتيوب واستخرج:
1. نوع التعليق: question (سؤال), request (طلب), complaint (شكوى), praise (مدح), neutral
2. الموضوع الذي يتحدث عنه
3. إذا كان سؤالاً: ما السؤال بالضبط؟
4. إذا كان طلباً: ماذا يريدون؟
5. هل يمكن أن نصنع فيديو بناءً عليه؟

التعليقات:
${comments.map((c, i) => `[${i}] ${(c.text || '').substring(0, 200)}`).join('\n')}

أجب بـ JSON array:
[
  {
    "index": 0,
    "type": "question|request|complaint|praise|neutral",
    "topic": "الموضوع",
    "extractedQuestion": "السؤال إن وجد",
    "extractedRequest": "الطلب إن وجد",
    "videoIdea": "فكرة فيديو مقترحة أو null",
    "sentiment": "positive|negative|neutral"
  }
]
`;

  try {
    const response = await groq.complete({
      prompt,
      temperature: 0.2,
      model: 'fast'
    });
    
    let jsonStr = response.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const analysis = JSON.parse(jsonStr);
    
    // Merge analysis with original comments
    return comments.map((comment, i) => ({
      ...comment,
      analysis: analysis.find(a => a.index === i) || null
    }));
  } catch (e) {
    console.error('Batch analysis failed:', e.message);
    return comments.map(c => ({ ...c, analysis: null }));
  }
}

// ============================================
// EXTRACT INSIGHTS FROM ANALYZED COMMENTS
// ============================================
function extractInsights(analyzedComments) {
  const insights = {
    topQuestions: [],
    topRequests: [],
    videoIdeas: [],
    frequentTopics: {},
    sentiment: { positive: 0, negative: 0, neutral: 0 }
  };
  
  for (const comment of analyzedComments) {
    if (!comment.analysis) continue;
    
    const { type, topic, extractedQuestion, extractedRequest, videoIdea, sentiment } = comment.analysis;
    
    // Count sentiment
    if (sentiment) {
      insights.sentiment[sentiment] = (insights.sentiment[sentiment] || 0) + 1;
    }
    
    // Count topics
    if (topic) {
      insights.frequentTopics[topic] = (insights.frequentTopics[topic] || 0) + 1;
    }
    
    // Collect questions
    if (type === 'question' && extractedQuestion) {
      insights.topQuestions.push({
        question: extractedQuestion,
        originalComment: comment.text?.substring(0, 100),
        likes: comment.likes || 0
      });
    }
    
    // Collect requests
    if (type === 'request' && extractedRequest) {
      insights.topRequests.push({
        request: extractedRequest,
        originalComment: comment.text?.substring(0, 100),
        likes: comment.likes || 0
      });
    }
    
    // Collect video ideas
    if (videoIdea) {
      insights.videoIdeas.push({
        idea: videoIdea,
        fromComment: comment.text?.substring(0, 100),
        likes: comment.likes || 0
      });
    }
  }
  
  // Sort by likes
  insights.topQuestions.sort((a, b) => b.likes - a.likes);
  insights.topRequests.sort((a, b) => b.likes - a.likes);
  insights.videoIdeas.sort((a, b) => b.likes - a.likes);
  
  // Convert frequentTopics to sorted array
  insights.frequentTopics = Object.entries(insights.frequentTopics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([topic, count]) => ({ topic, count }));
  
  return insights;
}

// ============================================
// GET TOP QUESTIONS (Quick access)
// ============================================
export async function getTopQuestions(limit = 10) {
  const data = await loadUnifiedData();
  
  if (data?.commentInsights?.topQuestions) {
    return data.commentInsights.topQuestions.slice(0, limit);
  }
  
  // If not pre-analyzed, analyze now
  const analysis = await analyzeComments();
  return analysis.insights.topQuestions.slice(0, limit);
}

// ============================================
// GET VIDEO IDEAS FROM COMMENTS
// ============================================
export async function getVideoIdeasFromComments(limit = 10) {
  const data = await loadUnifiedData();
  
  if (data?.commentInsights?.videoIdeas) {
    return data.commentInsights.videoIdeas.slice(0, limit);
  }
  
  const analysis = await analyzeComments();
  return analysis.insights.videoIdeas.slice(0, limit);
}

// ============================================
// SAVE UNIFIED DATA
// ============================================
async function saveUnifiedData(data) {
  const fs = await import('fs/promises');
  const path = await import('path');
  const file = path.join(process.cwd(), 'data', 'unified_data.json');
  
  try {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save unified data:', e);
  }
}




