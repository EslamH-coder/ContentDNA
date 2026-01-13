/**
 * GROWTH MONITOR
 * Detects new countries, new personas, trending topics
 */

import { PERSONAS } from './personaDefinitions.js';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'personas.json');

// ============================================
// LOAD/SAVE DATA
// ============================================
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }
}

async function loadData() {
  await ensureDataDir();
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { growthSignals: [] };
  }
}

async function saveData(data) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============================================
// ANALYZE YOUTUBE DATA FOR GROWTH SIGNALS
// ============================================
export async function analyzeYouTubeData(youtubeData) {
  const signals = [];
  
  // 1. Check for new/growing countries
  const countrySignals = analyzeCountryGrowth(youtubeData.demographics?.countries);
  signals.push(...countrySignals);
  
  // 2. Check for new audience segments
  const segmentSignals = analyzeAudienceSegments(youtubeData);
  signals.push(...segmentSignals);
  
  // 3. Check topic performance
  const topicSignals = analyzeTopicPerformance(youtubeData.videos);
  signals.push(...topicSignals);
  
  // Save signals
  const data = await loadData();
  data.growthSignals = [...(data.growthSignals || []), ...signals];
  await saveData(data);
  
  return signals;
}

// ============================================
// ANALYZE COUNTRY GROWTH
// ============================================
function analyzeCountryGrowth(countries) {
  if (!countries || !Array.isArray(countries)) return [];
  
  const signals = [];
  
  // Known persona countries
  const knownCountries = new Set();
  for (const persona of Object.values(PERSONAS)) {
    if (persona.demographics.countries) {
      persona.demographics.countries.forEach(c => {
        if (c !== 'ALL') knownCountries.add(c);
      });
    }
  }
  
  // Check for new countries with significant percentage
  for (const country of countries) {
    if (country.percentage >= 2 && !knownCountries.has(country.code)) {
      signals.push({
        type: 'NEW_COUNTRY',
        priority: country.percentage >= 5 ? 'HIGH' : 'MEDIUM',
        data: {
          country: country.code,
          name: country.name || country.code,
          percentage: country.percentage
        },
        suggestion: `جمهور جديد من ${country.name || country.code} (${country.percentage}%) - قد يحتاج persona جديد`,
        date: new Date().toISOString()
      });
    }
    
    // Check for growing countries
    if (country.growth && country.growth > 20) {
      signals.push({
        type: 'GROWING_COUNTRY',
        priority: country.growth > 50 ? 'HIGH' : 'MEDIUM',
        data: {
          country: country.code,
          name: country.name || country.code,
          growth: country.growth
        },
        suggestion: `${country.name || country.code} ينمو بنسبة ${country.growth}% - زيادة المحتوى المناسب`,
        date: new Date().toISOString()
      });
    }
  }
  
  return signals;
}

// ============================================
// ANALYZE AUDIENCE SEGMENTS
// ============================================
function analyzeAudienceSegments(youtubeData) {
  const signals = [];
  
  // Check age distribution changes
  if (youtubeData.demographics?.ageGroups) {
    for (const ageGroup of youtubeData.demographics.ageGroups) {
      if (ageGroup.growth > 30) {
        signals.push({
          type: 'GROWING_AGE_SEGMENT',
          priority: 'MEDIUM',
          data: {
            ageGroup: ageGroup.range,
            percentage: ageGroup.percentage,
            growth: ageGroup.growth
          },
          suggestion: `الفئة العمرية ${ageGroup.range} تنمو - تأكد من مناسبة المحتوى`,
          date: new Date().toISOString()
        });
      }
    }
  }
  
  // Check device changes
  if (youtubeData.demographics?.devices) {
    const tvPercentage = youtubeData.demographics.devices.tv || 0;
    if (tvPercentage > 20) {
      signals.push({
        type: 'TV_AUDIENCE_GROWING',
        priority: 'LOW',
        data: { tvPercentage },
        suggestion: `${tvPercentage}% يشاهدون على TV - تأكد من جودة الصورة`,
        date: new Date().toISOString()
      });
    }
  }
  
  return signals;
}

// ============================================
// ANALYZE TOPIC PERFORMANCE
// ============================================
function analyzeTopicPerformance(videos) {
  if (!videos || !Array.isArray(videos)) return [];
  
  const signals = [];
  const topicPerformance = {};
  
  // Group videos by topic
  for (const video of videos) {
    const topics = extractTopics(video.title || '');
    for (const topic of topics) {
      if (!topicPerformance[topic]) {
        topicPerformance[topic] = { videos: 0, totalViews: 0, avgViews: 0 };
      }
      topicPerformance[topic].videos++;
      topicPerformance[topic].totalViews += video.views || 0;
    }
  }
  
  // Calculate averages
  for (const topic of Object.keys(topicPerformance)) {
    topicPerformance[topic].avgViews = 
      topicPerformance[topic].totalViews / topicPerformance[topic].videos;
  }
  
  // Find overperforming topics
  const topicCount = Object.keys(topicPerformance).length;
  if (topicCount === 0) return signals;
  
  const overallAvg = Object.values(topicPerformance)
    .reduce((a, b) => a + b.avgViews, 0) / topicCount;
  
  for (const [topic, stats] of Object.entries(topicPerformance)) {
    if (stats.avgViews > overallAvg * 1.5 && stats.videos >= 2) {
      signals.push({
        type: 'OVERPERFORMING_TOPIC',
        priority: 'HIGH',
        data: {
          topic,
          avgViews: Math.round(stats.avgViews),
          overallAvg: Math.round(overallAvg),
          videoCount: stats.videos
        },
        suggestion: `"${topic}" يتفوق بـ ${Math.round((stats.avgViews / overallAvg - 1) * 100)}% - أنتج المزيد!`,
        date: new Date().toISOString()
      });
    }
    
    // Find underperforming topics
    if (stats.avgViews < overallAvg * 0.5 && stats.videos >= 3) {
      signals.push({
        type: 'UNDERPERFORMING_TOPIC',
        priority: 'MEDIUM',
        data: {
          topic,
          avgViews: Math.round(stats.avgViews),
          overallAvg: Math.round(overallAvg)
        },
        suggestion: `"${topic}" يتراجع - قد يحتاج زاوية جديدة أو تقليل`,
        date: new Date().toISOString()
      });
    }
  }
  
  return signals;
}

function extractTopics(title) {
  const topics = [];
  const lower = title.toLowerCase();
  
  const topicMap = {
    'trump': ['trump', 'ترامب', 'ترمب'],
    'china': ['china', 'الصين'],
    'russia': ['russia', 'روسيا'],
    'oil': ['oil', 'نفط', 'النفط', 'أوبك'],
    'dollar': ['dollar', 'دولار', 'الدولار'],
    'egypt': ['egypt', 'مصر', 'الجنيه'],
    'saudi': ['saudi', 'السعودية', 'سعودي'],
    'ai': ['ai', 'الذكاء الاصطناعي'],
    'gold': ['gold', 'الذهب'],
    'fed': ['fed', 'الفيدرالي', 'فائدة']
  };
  
  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(k => lower.includes(k))) {
      topics.push(topic);
    }
  }
  
  return topics;
}

// ============================================
// SUGGEST NEW PERSONA
// ============================================
export function suggestNewPersona(signals) {
  const countrySignals = signals.filter(s => s.type === 'NEW_COUNTRY' && s.priority === 'HIGH');
  
  const suggestions = [];
  
  for (const signal of countrySignals) {
    suggestions.push({
      type: 'NEW_PERSONA_SUGGESTION',
      name: `مشاهد ${signal.data.name}`,
      reason: `${signal.data.percentage}% من الجمهور - يستحق persona مخصص`,
      suggestedInterests: [
        `أخبار ${signal.data.name}`,
        `علاقات ${signal.data.name} مع القوى الكبرى`,
        `اقتصاد ${signal.data.name}`
      ],
      action: 'CREATE_PERSONA'
    });
  }
  
  return suggestions;
}

// ============================================
// GET GROWTH SIGNALS
// ============================================
export async function getGrowthSignals() {
  const data = await loadData();
  return data.growthSignals || [];
}




