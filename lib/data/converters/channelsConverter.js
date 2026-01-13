/**
 * CHANNELS CONVERTER
 * Converts kibreet_also_watch_channel.csv (Tubular Labs format)
 */

import fs from 'fs/promises';
import path from 'path';
import { parseCSV } from './csvParser.js';

export async function convertChannels(inputPath, outputPath) {
  console.log('📺 Converting channels data...');
  
  const content = await fs.readFile(inputPath, 'utf-8');
  const rows = parseCSV(content);
  
  const channels = rows.map(row => {
    const category = categorizeChannel(row);
    
    return {
      id: row['ID'] || row['id'] || '',
      name: row['Name'] || row['name'] || row['Channel Name'] || '',
      url: row['YouTube URL'] || row['url'] || row['YouTube url'] || '',
      country: row['Country'] || row['country'] || '',
      
      // Metrics
      relevanceScore: parseFloat(row['Relevance Score'] || row['Relevance score'] || row['relevance_score'] || 0) || 0,
      audienceOverlap: parseFloat(row['Audience Overlap'] || row['Audience overlap'] || row['audience_overlap'] || 0) || 0,
      affinity: parseFloat(row['Affinity'] || row['affinity'] || 0) || 0,
      
      // Content
      industry: row['Industry'] || row['industry'] || '',
      contentGenre: row['Content Genre'] || row['Content genre'] || row['content_genre'] || '',
      themes: (row['Themes'] || row['themes'] || '').split(',').map(t => t.trim()).filter(Boolean),
      
      // YouTube
      subscribers: parseInt(row['YouTube Subscribers'] || row['YouTube subscribers'] || row['subscribers'] || 0) || 0,
      totalViews: parseInt(row['YouTube All-Time Views'] || row['YouTube All-time Views'] || row['all_time_views'] || 0) || 0,
      monthlyViews: parseInt(row['Nov-2025 Views'] || row['Nov-2025 views'] || row['monthly_views'] || 0) || 0,
      
      // Our analysis
      category: category.type,
      relevanceToUs: category.relevance,
      personas: mapToPersonas(row, category),
      isDirectCompetitor: category.relevance === 'direct_competitor'
    };
  });
  
  channels.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  const insights = {
    categoryDistribution: countBy(channels, 'category'),
    countryDistribution: countBy(channels, 'country').slice(0, 10),
    directCompetitors: channels.filter(c => c.isDirectCompetitor).slice(0, 15).map(c => ({
      name: c.name,
      country: c.country,
      overlap: (c.audienceOverlap * 100).toFixed(1) + '%',
      themes: c.themes.slice(0, 3)
    })),
    topByOverlap: channels.sort((a, b) => b.audienceOverlap - a.audienceOverlap).slice(0, 10).map(c => ({
      name: c.name,
      overlap: (c.audienceOverlap * 100).toFixed(1) + '%'
    }))
  };
  
  const output = { channels, insights, meta: { total: channels.length, convertedAt: new Date().toISOString() } };
  
  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`   ✅ Converted ${channels.length} channels`);
  return output;
}

function categorizeChannel(row) {
  const name = (row['Name'] || row['name'] || '').toLowerCase();
  const genre = (row['Content Genre'] || row['Content genre'] || row['content_genre'] || '').toLowerCase();
  const industry = (row['Industry'] || row['industry'] || '').toLowerCase();
  const themes = (row['Themes'] || row['themes'] || '').toLowerCase();
  
  if (genre.includes('news') || industry.includes('broadcast')) {
    return { type: 'news', relevance: 'direct_competitor' };
  }
  if (themes.includes('politics') || themes.includes('society')) {
    return { type: 'politics', relevance: 'direct_competitor' };
  }
  if (themes.includes('business') || themes.includes('finance')) {
    return { type: 'business', relevance: 'direct_competitor' };
  }
  if (genre.includes('education') || themes.includes('knowledge')) {
    return { type: 'education', relevance: 'adjacent' };
  }
  if (genre.includes('entertainment')) {
    return { type: 'entertainment', relevance: 'audience_overlap' };
  }
  return { type: 'other', relevance: 'audience_overlap' };
}

function mapToPersonas(row, category) {
  const personas = [];
  const themes = (row['Themes'] || row['themes'] || '').toLowerCase();
  const country = row['Country'] || row['country'] || '';
  
  if (themes.includes('politics') || themes.includes('military')) personas.push('geopolitics');
  if (themes.includes('business') || themes.includes('finance')) personas.push('investor');
  if (themes.includes('technology')) personas.push('tech_future');
  if (themes.includes('knowledge')) personas.push('curious_learner');
  if (country === 'EG') personas.push('egyptian_business');
  if (['SA', 'AE', 'KW', 'QA', 'BH', 'OM'].includes(country)) personas.push('gulf_oil');
  if (['MA', 'DZ', 'TN'].includes(country)) personas.push('maghreb');
  
  return [...new Set(personas)];
}

function countBy(arr, key) {
  const counts = {};
  arr.forEach(item => {
    const val = item[key] || 'unknown';
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([val, count]) => ({ [key]: val, count }))
    .sort((a, b) => b.count - a.count);
}




