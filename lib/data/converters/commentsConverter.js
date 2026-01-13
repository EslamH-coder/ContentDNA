/**
 * COMMENTS CONVERTER
 * Converts TheYouTubeTool comments export
 */

import fs from 'fs/promises';
import path from 'path';
import { parseCSV } from './csvParser.js';
import { filterUsefulComments } from '../../commentFilter.js';

export async function convertComments(inputPaths, outputPath) {
  console.log('💬 Converting comments...');
  
  let allComments = [];
  
  for (const inputPath of inputPaths) {
    try {
      const content = await fs.readFile(inputPath, 'utf-8');
      const rows = parseCSV(content);
      allComments.push(...rows);
      console.log(`   ✅ Loaded ${rows.length} comments from ${path.basename(inputPath)}`);
    } catch (e) {
      console.log(`   ⚠️ Skipped ${inputPath}: ${e.message}`);
    }
  }
  
  // Convert all comments first
  const allConvertedComments = allComments.map((row, index) => {
    const text = cleanComment(row['Comment'] || row['comment'] || row['Text'] || row['text'] || '');
    const analysis = analyzeComment(text);
    
    return {
      id: `comment_${index}`,
      author: (row['Author'] || row['author'] || '').replace('@', ''),
      text,
      likes: parseInt(row['Likes'] || row['likes'] || row['Like Count'] || row['like_count'] || 0) || 0,
      replies: parseInt(row['Replies'] || row['replies'] || row['Reply Count'] || row['reply_count'] || 0) || 0,
      date: row['Date'] || row['date'] || row['Published'] || row['published'] || '',
      videoId: row['Video ID'] || row['Video id'] || row['video_id'] || '',
      videoTitle: row['Video Title'] || row['Video title'] || row['video_title'] || '',
      
      type: analysis.type,
      sentiment: analysis.sentiment,
      topic: analysis.topic,
      question: analysis.question,
      request: analysis.request,
      isActionable: analysis.isActionable
    };
  });
  
  // Filter out appreciation/spam comments
  const comments = filterUsefulComments(allConvertedComments);
  console.log(`   📊 Filtered ${allConvertedComments.length} → ${comments.length} useful comments`);
  
  comments.sort((a, b) => b.likes - a.likes);
  
  const questions = comments.filter(c => c.type === 'question');
  const requests = comments.filter(c => c.type === 'request');
  
  const insights = {
    topQuestions: questions.slice(0, 20).map(q => ({
      question: q.question,
      author: q.author,
      likes: q.likes,
      topic: q.topic
    })),
    topRequests: requests.slice(0, 20).map(r => ({
      request: r.request,
      author: r.author,
      likes: r.likes,
      topic: r.topic
    })),
    videoIdeas: [...questions, ...requests]
      .filter(c => c.isActionable)
      .slice(0, 15)
      .map(c => ({
        idea: c.question || c.request,
        type: c.type,
        likes: c.likes,
        topic: c.topic
      })),
    stats: {
      total: comments.length,
      questions: questions.length,
      requests: requests.length,
      positive: comments.filter(c => c.sentiment === 'positive').length
    }
  };
  
  const output = { comments, insights, meta: { total: comments.length, convertedAt: new Date().toISOString() } };
  
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`   ✅ Converted ${comments.length} total comments`);
  return output;
}

function cleanComment(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function analyzeComment(text) {
  if (!text) return { type: 'other', sentiment: 'neutral', isActionable: false };
  
  const lower = text.toLowerCase();
  let type = 'other';
  let question = null;
  let request = null;
  
  // Question detection
  if (text.includes('؟') || text.includes('?') ||
      lower.includes('هل ') || lower.includes('كيف ') ||
      lower.includes('لماذا ') || lower.includes('ليه ') ||
      lower.includes('ازاي ') || lower.includes('ما هو') ||
      lower.includes('متى ') || lower.includes('أين ') ||
      lower.includes('من ')) {
    type = 'question';
    question = extractQuestion(text);
  }
  // Request detection
  else if (lower.includes('ممكن') || lower.includes('ياريت') ||
           lower.includes('يا ريت') || lower.includes('نريد') ||
           lower.includes('اتمنى') || lower.includes('حلقة عن') ||
           lower.includes('تتكلم عن') || lower.includes('تتحدث عن') ||
           lower.includes('فيديو عن') || lower.includes('موضوع عن')) {
    type = 'request';
    request = extractRequest(text);
  }
  // Praise
  else if (lower.includes('ممتاز') || lower.includes('رائع') ||
           lower.includes('مبدع') || lower.includes('شكر') ||
           text.includes('❤') || text.includes('👍') ||
           lower.includes('احسن') || lower.includes('أفضل')) {
    type = 'praise';
  }
  
  // Sentiment
  let sentiment = 'neutral';
  if (text.includes('❤') || lower.includes('شكر') || lower.includes('رائع') ||
      lower.includes('ممتاز') || lower.includes('مبدع')) {
    sentiment = 'positive';
  } else if (lower.includes('سيء') || lower.includes('مش عاجب') ||
             lower.includes('مش حلو') || lower.includes('مش عجب')) {
    sentiment = 'negative';
  }
  
  // Topic
  const topic = detectTopic(lower);
  
  return {
    type,
    sentiment,
    topic,
    question,
    request,
    isActionable: type === 'question' || type === 'request'
  };
}

function extractQuestion(text) {
  const sentences = text.split(/[.!،]/);
  for (const s of sentences) {
    if (s.includes('؟') || s.includes('?')) {
      return s.trim().substring(0, 200);
    }
  }
  return text.substring(0, 200);
}

function extractRequest(text) {
  const patterns = [
    /ممكن (.+)/,
    /يا ?ريت (.+)/,
    /نريد (.+)/,
    /اتمنى (.+)/,
    /حلقة عن (.+)/,
    /تتكلم عن (.+)/,
    /فيديو عن (.+)/,
    /موضوع عن (.+)/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].substring(0, 150);
  }
  return text.substring(0, 150);
}

function detectTopic(text) {
  const topics = {
    'islamic_economy': ['اسلامي', 'الربا', 'زكاة', 'حلال', 'حرام'],
    'egypt': ['مصر', 'مصري', 'الجنيه', 'السيسي'],
    'gold': ['ذهب', 'gold'],
    'real_estate': ['عقار', 'عقارات', 'شقة', 'أرض'],
    'investment': ['استثمار', 'ادخار', 'توفير'],
    'syria': ['سوريا', 'سوري'],
    'china': ['الصين', 'صين'],
    'germany': ['المانيا', 'ألمانيا', 'germany'],
    'saudi': ['السعودية', 'سعودي'],
    'dollar': ['دولار', 'الدولار'],
    'economy': ['اقتصاد', 'economic']
  };
  
  for (const [topic, keywords] of Object.entries(topics)) {
    if (keywords.some(k => text.includes(k))) return topic;
  }
  return 'general';
}




