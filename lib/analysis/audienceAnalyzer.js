/**
 * AUDIENCE ANALYZER
 * Analyzes "Other channels" and "Other videos" to understand audience
 */

import { loadUnifiedData } from '../data/dataImporter.js';

// ============================================
// ANALYZE OTHER CHANNELS → DISCOVER PERSONAS
// ============================================
export async function analyzeOtherChannels() {
  const data = await loadUnifiedData();
  
  if (!data?.audience?.otherChannels?.length) {
    return { error: 'No "other channels" data available' };
  }
  
  const channels = data.audience.otherChannels;
  
  // Categorize channels
  const categories = {
    news_arabic: [],
    news_english: [],
    geopolitics: [],
    business_finance: [],
    tech: [],
    science_education: [],
    entertainment: [],
    podcasts: [],
    lifestyle: [],
    other: []
  };
  
  // Keywords for categorization
  const categoryKeywords = {
    news_arabic: ['الجزيرة', 'العربية', 'العربي', 'الحدث', 'سكاي نيوز'],
    news_english: ['cnn', 'bbc', 'reuters', 'al jazeera english'],
    geopolitics: ['visualpolitik', 'caspian', 'foreign', 'geopolitics'],
    business_finance: ['cnbc', 'bloomberg', 'business', 'finance', 'اقتصاد', 'بيزنس'],
    tech: ['tech', 'تقني', 'mkbhd', 'linus', 'digital'],
    science_education: ['kurzgesagt', 'veritasium', 'الدحيح', 'ted', 'علم', 'science'],
    entertainment: ['مقالب', 'ترفيه', 'comedy', 'gaming'],
    podcasts: ['podcast', 'بودكاست', 'joe rogan', 'lex fridman'],
    lifestyle: ['lifestyle', 'حياة', 'vlog']
  };
  
  // Categorize each channel
  for (const channel of channels) {
    const name = (channel.channelName || channel.name || '').toLowerCase();
    let categorized = false;
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => name.includes(kw))) {
        categories[category].push(channel);
        categorized = true;
        break;
      }
    }
    
    if (!categorized) {
      categories.other.push(channel);
    }
  }
  
  // Derive persona insights
  const personaInsights = derivePersonasFromChannels(categories);
  
  return {
    categories,
    personaInsights,
    summary: {
      totalChannels: channels.length,
      topCategories: Object.entries(categories)
        .map(([cat, chs]) => ({ category: cat, count: chs.length }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    }
  };
}

// ============================================
// DERIVE PERSONAS FROM CHANNEL CATEGORIES
// ============================================
function derivePersonasFromChannels(categories) {
  const insights = [];
  
  // If they watch business/finance channels
  if (categories.business_finance.length > 0) {
    insights.push({
      persona: 'investor',
      confidence: categories.business_finance.length > 2 ? 'HIGH' : 'MEDIUM',
      evidence: `يشاهدون ${categories.business_finance.length} قنوات مالية`,
      channels: categories.business_finance.map(c => c.channelName || c.name),
      recommendation: 'زيادة محتوى الاستثمار والذهب والدولار'
    });
  }
  
  // If they watch geopolitics channels
  if (categories.geopolitics.length > 0) {
    insights.push({
      persona: 'geopolitics',
      confidence: 'HIGH',
      evidence: `يشاهدون ${categories.geopolitics.length} قنوات جيوسياسية`,
      channels: categories.geopolitics.map(c => c.channelName),
      recommendation: 'الاستمرار في محتوى الصراعات والقوى الكبرى'
    });
  }
  
  // If they watch science/education
  if (categories.science_education.length > 0) {
    insights.push({
      persona: 'curious_learner',
      confidence: categories.science_education.length > 2 ? 'HIGH' : 'MEDIUM',
      evidence: `يشاهدون ${categories.science_education.length} قنوات تعليمية`,
      channels: categories.science_education.map(c => c.channelName),
      recommendation: 'تبسيط المواضيع المعقدة - أسلوب الدحيح/Kurzgesagt'
    });
  }
  
  // If they watch tech channels
  if (categories.tech.length > 0) {
    insights.push({
      persona: 'tech_follower',
      confidence: categories.tech.length > 2 ? 'HIGH' : 'MEDIUM',
      evidence: `يشاهدون ${categories.tech.length} قنوات تقنية`,
      channels: categories.tech.map(c => c.channelName),
      recommendation: 'زيادة محتوى AI وشركات التقنية'
    });
  }
  
  // If they watch podcasts
  if (categories.podcasts.length > 0) {
    insights.push({
      persona: 'deep_listener',
      confidence: 'MEDIUM',
      evidence: `يشاهدون ${categories.podcasts.length} بودكاست`,
      channels: categories.podcasts.map(c => c.channelName),
      recommendation: 'تجربة محتوى أطول أو نقاشات معمقة'
    });
  }
  
  return insights;
}

// ============================================
// ANALYZE OTHER VIDEOS → TOPIC OPPORTUNITIES
// ============================================
export async function analyzeOtherVideos() {
  const data = await loadUnifiedData();
  
  if (!data?.audience?.otherVideos?.length) {
    return { error: 'No "other videos" data available' };
  }
  
  const videos = data.audience.otherVideos;
  
  // Extract topics
  const topicCounts = {};
  const videosByTopic = {};
  
  for (const video of videos) {
    const topics = extractTopicsFromTitle(video.videoTitle || video.title || '');
    
    for (const topic of topics) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      if (!videosByTopic[topic]) videosByTopic[topic] = [];
      videosByTopic[topic].push(video);
    }
  }
  
  // Sort by count
  const sortedTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({
      topic,
      count,
      percentage: ((count / videos.length) * 100).toFixed(1),
      examples: videosByTopic[topic].slice(0, 3).map(v => v.videoTitle || v.title)
    }));
  
  // Find topics we should cover
  const opportunities = findTopicOpportunities(sortedTopics, data.videos);
  
  return {
    topTopics: sortedTopics.slice(0, 20),
    opportunities,
    summary: {
      totalVideos: videos.length,
      uniqueTopics: Object.keys(topicCounts).length
    }
  };
}

// ============================================
// EXTRACT TOPICS FROM TITLE
// ============================================
function extractTopicsFromTitle(title) {
  if (!title) return [];
  
  const lower = title.toLowerCase();
  const topics = [];
  
  const topicKeywords = {
    'trump': ['trump', 'ترامب', 'ترمب'],
    'china': ['china', 'الصين', 'صين', 'chinese'],
    'russia': ['russia', 'روسيا', 'putin', 'بوتين'],
    'usa': ['america', 'أمريكا', 'usa', 'u.s.', 'united states'],
    'iran': ['iran', 'إيران', 'ايران'],
    'israel': ['israel', 'إسرائيل', 'اسرائيل'],
    'oil': ['oil', 'نفط', 'النفط', 'opec', 'أوبك'],
    'dollar': ['dollar', 'دولار', 'الدولار'],
    'gold': ['gold', 'ذهب', 'الذهب'],
    'economy': ['economy', 'اقتصاد', 'economic'],
    'war': ['war', 'حرب', 'conflict', 'صراع'],
    'ai': ['ai', 'الذكاء الاصطناعي', 'artificial intelligence', 'chatgpt'],
    'crypto': ['bitcoin', 'crypto', 'بيتكوين'],
    'egypt': ['egypt', 'مصر', 'مصري'],
    'saudi': ['saudi', 'السعودية', 'سعودي'],
    'ukraine': ['ukraine', 'أوكرانيا'],
    'europe': ['europe', 'أوروبا', 'eu']
  };
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      topics.push(topic);
    }
  }
  
  return topics;
}

// ============================================
// FIND TOPIC OPPORTUNITIES
// ============================================
function findTopicOpportunities(audienceTopics, ourVideos) {
  const ourTopics = new Set();
  
  // Get topics we've covered
  for (const video of ourVideos || []) {
    const topics = extractTopicsFromTitle(video.title || '');
    topics.forEach(t => ourTopics.add(t));
  }
  
  // Find gaps
  const opportunities = [];
  
  for (const topic of audienceTopics) {
    // High audience interest but we haven't covered much
    if (topic.count >= 3 && !ourTopics.has(topic.topic)) {
      opportunities.push({
        topic: topic.topic,
        audienceInterest: topic.count,
        status: 'NOT_COVERED',
        recommendation: `جمهورك يشاهد ${topic.count} فيديوهات عن "${topic.topic}" - فرصة!`
      });
    }
  }
  
  return opportunities;
}

