/**
 * VIDEOS CONVERTER
 * Converts kibreet_audiene_watch_videos.csv (Tubular Labs format)
 */

import fs from 'fs/promises';
import path from 'path';
import { parseCSV } from './csvParser.js';

export async function convertVideos(inputPath, outputPath) {
  console.log('🎬 Converting videos data...');
  
  const content = await fs.readFile(inputPath, 'utf-8');
  const rows = parseCSV(content);
  
  const videos = rows.map(row => {
    const analysis = analyzeTitle(row['Title'] || row['title'] || '');
    
    return {
      id: row['ID'] || row['id'] || '',
      title: row['Title'] || row['title'] || '',
      url: row['URL'] || row['url'] || '',
      platform: row['Platform'] || row['platform'] || 'youtube',
      uploadDate: row['Upload Date'] || row['Upload date'] || row['upload_date'] || '',
      duration: parseInt(row['Duration'] || row['duration'] || 0) || 0,
      
      creator: {
        id: row['Creator ID'] || row['Creator id'] || row['creator_id'] || '',
        name: row['Creator Name'] || row['Creator name'] || row['creator_name'] || ''
      },
      
      views: parseInt(row['Views'] || row['views'] || 0) || 0,
      engagements: parseInt(row['Engagements'] || row['engagements'] || 0) || 0,
      
      relevanceScore: parseFloat(row['Relevance Score'] || row['Relevance score'] || row['relevance_score'] || 0) || 0,
      audienceOverlap: parseFloat(row['Audience Overlap'] || row['Audience overlap'] || row['audience_overlap'] || 0) || 0,
      
      isShort: (row['Shorts Format'] || row['Shorts format'] || row['shorts_format'] || '').includes('shorts'),
      category: row['YouTube Category'] || row['YouTube category'] || row['category'] || '',
      
      topic: analysis.topic,
      personas: analysis.personas,
      isRelevant: analysis.isRelevant
    };
  });
  
  videos.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  const insights = {
    topicDistribution: countTopics(videos),
    topCreators: getTopCreators(videos),
    relevantVideos: videos.filter(v => v.isRelevant && v.relevanceScore > 5).slice(0, 20).map(v => ({
      title: v.title,
      creator: v.creator.name,
      topic: v.topic,
      relevance: v.relevanceScore.toFixed(2)
    })),
    opportunities: findOpportunities(videos)
  };
  
  const output = { videos, insights, meta: { total: videos.length, convertedAt: new Date().toISOString() } };
  
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`   ✅ Converted ${videos.length} videos`);
  return output;
}

function analyzeTitle(title) {
  if (!title) return { topic: 'other', personas: [], isRelevant: false };
  
  const lower = title.toLowerCase();
  let topic = 'other';
  
  const topicKeywords = {
    'politics': ['بوتين', 'putin', 'ترامب', 'trump', 'سياس', 'رئيس', 'president'],
    'history': ['تاريخ', 'history', 'سقوط', 'حضارة', 'empire'],
    'science': ['علم', 'science', 'فيزياء', 'فضاء', 'space'],
    'economy': ['اقتصاد', 'economy', 'مال', 'دولار', 'dollar'],
    'tech': ['تقني', 'tech', 'ai', 'ذكاء اصطناعي', 'artificial intelligence'],
    'entertainment': ['مقلب', 'ضحك', 'تحدي', 'comedy'],
    'food': ['طبخ', 'أكل', 'food', 'وصفة', 'recipe']
  };
  
  for (const [t, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(k => lower.includes(k))) {
      topic = t;
      break;
    }
  }
  
  const personas = [];
  const topicPersonaMap = {
    'politics': ['geopolitics'],
    'history': ['geopolitics', 'curious_learner'],
    'science': ['curious_learner', 'tech_future'],
    'economy': ['investor', 'egyptian_business'],
    'tech': ['tech_future']
  };
  
  if (topicPersonaMap[topic]) personas.push(...topicPersonaMap[topic]);
  
  const isRelevant = ['politics', 'history', 'economy', 'tech', 'science'].includes(topic);
  
  return { topic, personas: [...new Set(personas)], isRelevant };
}

function countTopics(videos) {
  const counts = {};
  videos.forEach(v => {
    counts[v.topic] = (counts[v.topic] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);
}

function getTopCreators(videos) {
  const creators = {};
  videos.forEach(v => {
    if (v.creator.name) {
      if (!creators[v.creator.name]) creators[v.creator.name] = { count: 0, views: 0 };
      creators[v.creator.name].count++;
      creators[v.creator.name].views += v.views;
    }
  });
  return Object.entries(creators)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([name, data]) => ({ name, count: data.count, avgViews: Math.round(data.views / data.count) }));
}

function findOpportunities(videos) {
  const topicCounts = {};
  videos.forEach(v => {
    if (v.topic !== 'other' && v.topic !== 'entertainment') {
      topicCounts[v.topic] = (topicCounts[v.topic] || 0) + 1;
    }
  });
  
  return Object.entries(topicCounts)
    .filter(([_, count]) => count >= 5)
    .map(([topic, count]) => ({
      topic,
      audienceInterest: count,
      recommendation: `جمهورك يشاهد ${count} فيديو عن "${topic}" - فرصة!`
    }))
    .sort((a, b) => b.audienceInterest - a.audienceInterest);
}




