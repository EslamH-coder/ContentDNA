/**
 * SEARCH TERMS CONVERTER
 * Converts Table_data.csv (YouTube Studio format)
 */

import fs from 'fs/promises';
import path from 'path';
import { parseCSV } from './csvParser.js';

export async function convertSearchTerms(inputPath, outputPath) {
  console.log('🔍 Converting search terms...');
  
  const content = await fs.readFile(inputPath, 'utf-8');
  const rows = parseCSV(content);
  
  // Filter only YT_SEARCH entries
  const searchRows = rows.filter(row => {
    const source = row['Traffic source'] || row['Traffic Source'] || row['traffic_source'] || '';
    return source.startsWith('YT_SEARCH.') || source.toLowerCase().includes('search');
  });
  
  const terms = searchRows.map(row => {
    const source = row['Traffic source'] || row['Traffic Source'] || row['traffic_source'] || '';
    const term = row['Source title'] || row['Source Title'] || row['source_title'] || source.replace('YT_SEARCH.', '');
    const analysis = analyzeTerm(term);
    
    return {
      term,
      views: parseInt(row['Views'] || row['views'] || 0) || 0,
      watchTimeHours: parseFloat(row['Watch time (hours)'] || row['Watch Time (hours)'] || row['watch_time_hours'] || 0) || 0,
      avgViewDuration: row['Average view duration'] || row['Average View Duration'] || row['avg_view_duration'] || '',
      
      topic: analysis.topic,
      intent: analysis.intent,
      personas: analysis.personas,
      isBranded: analysis.isBranded,
      isOpportunity: !analysis.isBranded && parseInt(row['Views'] || row['views'] || 0) > 500
    };
  });
  
  terms.sort((a, b) => b.views - a.views);
  
  const insights = {
    viewsByTopic: aggregateByTopic(terms),
    topOpportunities: terms.filter(t => t.isOpportunity).slice(0, 20).map(t => ({
      term: t.term,
      views: t.views,
      topic: t.topic,
      personas: t.personas
    })),
    brandedRatio: {
      branded: terms.filter(t => t.isBranded).length,
      nonBranded: terms.filter(t => !t.isBranded).length,
      brandedViews: terms.filter(t => t.isBranded).reduce((a, b) => a + b.views, 0),
      nonBrandedViews: terms.filter(t => !t.isBranded).reduce((a, b) => a + b.views, 0)
    },
    topSearches: terms.slice(0, 30).map(t => ({
      term: t.term,
      views: t.views,
      topic: t.topic,
      isBranded: t.isBranded
    }))
  };
  
  const output = { terms, insights, meta: { total: terms.length, convertedAt: new Date().toISOString() } };
  
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`   ✅ Converted ${terms.length} search terms`);
  return output;
}

function analyzeTerm(term) {
  if (!term) return { topic: 'other', intent: 'informational', isBranded: false, personas: [] };
  
  const lower = term.toLowerCase();
  
  // Branded check
  const brandTerms = ['المخبر', 'mokhbir', 'كبريت', 'aj+', 'اشرف ابراهيم', 'mokhber', 'kibreet'];
  const isBranded = brandTerms.some(b => lower.includes(b));
  
  // Intent
  let intent = 'informational';
  if (lower.includes('كيف') || lower.includes('how')) intent = 'how_to';
  if (lower.includes('لماذا') || lower.includes('why')) intent = 'why';
  if (lower.includes('مباشر') || lower.includes('live')) intent = 'live';
  
  // Topic detection
  const topicMap = {
    'channel': ['المخبر', 'mokhbir', 'كبريت', 'الدحيح', 'الجزيرة'],
    'china': ['الصين', 'china', 'صين', 'chinese'],
    'usa': ['امريكا', 'أمريكا', 'ترامب', 'trump', 'ترمب', 'biden', 'بايدن'],
    'russia': ['روسيا', 'russia', 'بوتين', 'putin'],
    'iran': ['ايران', 'إيران', 'iran'],
    'gold': ['الذهب', 'ذهب', 'gold'],
    'dollar': ['الدولار', 'دولار', 'dollar'],
    'economy': ['اقتصاد', 'economy', 'تضخم', 'inflation'],
    'war': ['حرب', 'war', 'صراع', 'conflict'],
    'ukraine': ['اوكرانيا', 'أوكرانيا', 'ukraine'],
    'greenland': ['غرينلاند', 'جرينلاند', 'greenland'],
    'ai': ['ذكاء اصطناعي', 'ai', 'deepseek', 'ديب سيك', 'chatgpt'],
    'gaza': ['غزة', 'غزه', 'فلسطين', 'تهجير'],
    'syria': ['سوريا', 'syria'],
    'saudi': ['السعودية', 'سعودي', 'saudi']
  };
  
  let topic = 'other';
  for (const [t, keywords] of Object.entries(topicMap)) {
    if (keywords.some(k => lower.includes(k))) {
      topic = t;
      break;
    }
  }
  
  // Persona mapping
  const personaMap = {
    'china': ['geopolitics', 'tech_future'],
    'usa': ['geopolitics'],
    'russia': ['geopolitics'],
    'iran': ['geopolitics', 'gulf_oil'],
    'gold': ['investor'],
    'dollar': ['investor', 'egyptian_business'],
    'economy': ['investor', 'egyptian_business'],
    'war': ['geopolitics'],
    'ukraine': ['geopolitics'],
    'greenland': ['geopolitics'],
    'ai': ['tech_future'],
    'saudi': ['gulf_oil']
  };
  
  const personas = personaMap[topic] || [];
  
  return { topic, intent, isBranded, personas };
}

function aggregateByTopic(terms) {
  const views = {};
  terms.forEach(t => {
    views[t.topic] = (views[t.topic] || 0) + t.views;
  });
  return Object.entries(views)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, v]) => ({ topic, views: v }));
}




