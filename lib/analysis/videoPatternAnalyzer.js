/**
 * VIDEO PATTERN ANALYZER
 * Finds patterns in successful vs unsuccessful videos
 */

import { loadUnifiedData } from '../data/dataImporter.js';

// ============================================
// ANALYZE VIDEO PATTERNS
// ============================================
export async function analyzeVideoPatterns() {
  const data = await loadUnifiedData();
  
  if (!data?.videos?.length) {
    return { error: 'No video data available' };
  }
  
  const videos = data.videos;
  
  // Calculate average views
  const avgViews = videos.reduce((sum, v) => sum + (v.views || 0), 0) / videos.length;
  
  // Separate top and bottom performers
  const topPerformers = videos
    .filter(v => v.views > avgViews * 1.5)
    .sort((a, b) => b.views - a.views);
  
  const bottomPerformers = videos
    .filter(v => v.views < avgViews * 0.5)
    .sort((a, b) => a.views - b.views);
  
  // Analyze patterns
  const patterns = {
    titlePatterns: analyzeTitlePatterns(topPerformers, bottomPerformers),
    lengthPatterns: analyzeLengthPatterns(topPerformers, bottomPerformers),
    topicPatterns: analyzeTopicPatterns(topPerformers, bottomPerformers),
    ctrPatterns: analyzeCTRPatterns(videos),
    retentionPatterns: analyzeRetentionPatterns(videos),
    trafficPatterns: analyzeTrafficPatterns(videos),
    publishPatterns: analyzePublishPatterns(videos)
  };
  
  return {
    avgViews: Math.round(avgViews),
    topPerformersCount: topPerformers.length,
    bottomPerformersCount: bottomPerformers.length,
    patterns,
    recommendations: generateRecommendations(patterns)
  };
}

// ============================================
// ANALYZE TITLE PATTERNS
// ============================================
function analyzeTitlePatterns(top, bottom) {
  const patterns = {
    topTitles: {
      avgLength: 0,
      startsWithQuestion: 0,
      hasNumber: 0,
      hasPowerWord: 0,
      examples: []
    },
    bottomTitles: {
      avgLength: 0,
      startsWithQuestion: 0,
      hasNumber: 0,
      hasPowerWord: 0,
      examples: []
    }
  };
  
  const powerWords = ['كيف', 'لماذا', 'هل', 'سر', 'حقيقة', 'خطير', 'صادم', 'أخيراً'];
  const questionStarters = ['هل', 'كيف', 'لماذا', 'ماذا', 'متى', 'أين', 'من'];
  
  // Analyze top performers
  for (const video of top) {
    const title = video.title || '';
    patterns.topTitles.avgLength += title.length;
    
    if (questionStarters.some(q => title.startsWith(q))) {
      patterns.topTitles.startsWithQuestion++;
    }
    
    if (/\d+/.test(title)) {
      patterns.topTitles.hasNumber++;
    }
    
    if (powerWords.some(pw => title.includes(pw))) {
      patterns.topTitles.hasPowerWord++;
    }
  }
  
  // Analyze bottom performers
  for (const video of bottom) {
    const title = video.title || '';
    patterns.bottomTitles.avgLength += title.length;
    
    if (questionStarters.some(q => title.startsWith(q))) {
      patterns.bottomTitles.startsWithQuestion++;
    }
    
    if (/\d+/.test(title)) {
      patterns.bottomTitles.hasNumber++;
    }
    
    if (powerWords.some(pw => title.includes(pw))) {
      patterns.bottomTitles.hasPowerWord++;
    }
  }
  
  // Calculate averages
  if (top.length > 0) {
    patterns.topTitles.avgLength = Math.round(patterns.topTitles.avgLength / top.length);
    patterns.topTitles.examples = top.slice(0, 5).map(v => ({ title: v.title, views: v.views }));
  }
  
  if (bottom.length > 0) {
    patterns.bottomTitles.avgLength = Math.round(patterns.bottomTitles.avgLength / bottom.length);
    patterns.bottomTitles.examples = bottom.slice(0, 5).map(v => ({ title: v.title, views: v.views }));
  }
  
  // Calculate percentages
  patterns.topTitles.startsWithQuestion = top.length > 0 
    ? Math.round((patterns.topTitles.startsWithQuestion / top.length) * 100) : 0;
  patterns.bottomTitles.startsWithQuestion = bottom.length > 0
    ? Math.round((patterns.bottomTitles.startsWithQuestion / bottom.length) * 100) : 0;
  
  return patterns;
}

// ============================================
// ANALYZE LENGTH PATTERNS
// ============================================
function analyzeLengthPatterns(top, bottom) {
  const topLengths = top.map(v => v.details?.length || v.duration || 0).filter(l => l > 0);
  const bottomLengths = bottom.map(v => v.details?.length || v.duration || 0).filter(l => l > 0);
  
  return {
    topPerformers: {
      avgLength: topLengths.length > 0 
        ? Math.round(topLengths.reduce((a, b) => a + b, 0) / topLengths.length / 60) + ' دقيقة'
        : 'N/A',
      minLength: topLengths.length > 0 ? Math.round(Math.min(...topLengths) / 60) : 'N/A',
      maxLength: topLengths.length > 0 ? Math.round(Math.max(...topLengths) / 60) : 'N/A'
    },
    bottomPerformers: {
      avgLength: bottomLengths.length > 0
        ? Math.round(bottomLengths.reduce((a, b) => a + b, 0) / bottomLengths.length / 60) + ' دقيقة'
        : 'N/A',
      minLength: bottomLengths.length > 0 ? Math.round(Math.min(...bottomLengths) / 60) : 'N/A',
      maxLength: bottomLengths.length > 0 ? Math.round(Math.max(...bottomLengths) / 60) : 'N/A'
    },
    recommendation: 'Based on analysis...'
  };
}

// ============================================
// ANALYZE TOPIC PATTERNS
// ============================================
function analyzeTopicPatterns(top, bottom) {
  const topTopics = {};
  const bottomTopics = {};
  
  const extractTopics = (title) => {
    const topics = [];
    const lower = (title || '').toLowerCase();
    
    const topicMap = {
      'trump': ['trump', 'ترامب', 'ترمب'],
      'china': ['china', 'الصين'],
      'russia': ['russia', 'روسيا'],
      'oil': ['oil', 'نفط', 'النفط'],
      'dollar': ['dollar', 'دولار'],
      'egypt': ['egypt', 'مصر'],
      'saudi': ['saudi', 'السعودية'],
      'war': ['war', 'حرب'],
      'economy': ['economy', 'اقتصاد']
    };
    
    for (const [topic, keywords] of Object.entries(topicMap)) {
      if (keywords.some(k => lower.includes(k))) {
        topics.push(topic);
      }
    }
    
    return topics;
  };
  
  for (const video of top) {
    const topics = extractTopics(video.title);
    topics.forEach(t => topTopics[t] = (topTopics[t] || 0) + 1);
  }
  
  for (const video of bottom) {
    const topics = extractTopics(video.title);
    topics.forEach(t => bottomTopics[t] = (bottomTopics[t] || 0) + 1);
  }
  
  return {
    winningTopics: Object.entries(topTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    losingTopics: Object.entries(bottomTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  };
}

// ============================================
// ANALYZE CTR PATTERNS
// ============================================
function analyzeCTRPatterns(videos) {
  const withCTR = videos.filter(v => v.ctr);
  
  if (withCTR.length === 0) return { available: false };
  
  const avgCTR = withCTR.reduce((sum, v) => sum + v.ctr, 0) / withCTR.length;
  
  const highCTR = withCTR.filter(v => v.ctr > avgCTR * 1.2);
  const lowCTR = withCTR.filter(v => v.ctr < avgCTR * 0.8);
  
  return {
    available: true,
    avgCTR: avgCTR.toFixed(2) + '%',
    highCTRExamples: highCTR.slice(0, 5).map(v => ({
      title: v.title,
      ctr: v.ctr?.toFixed(2) + '%'
    })),
    lowCTRExamples: lowCTR.slice(0, 5).map(v => ({
      title: v.title,
      ctr: v.ctr?.toFixed(2) + '%'
    }))
  };
}

// ============================================
// ANALYZE RETENTION PATTERNS
// ============================================
function analyzeRetentionPatterns(videos) {
  const withRetention = videos.filter(v => v.avgPercentageViewed || v.avgViewDuration);
  
  if (withRetention.length === 0) return { available: false };
  
  // Use avgPercentageViewed if available, otherwise estimate from avgViewDuration
  const retentionValues = withRetention.map(v => {
    if (v.avgPercentageViewed) return v.avgPercentageViewed;
    // Estimate retention from duration (rough calculation)
    const duration = v.duration || v.details?.length || 600; // Default 10 min
    const avgView = v.avgViewDuration || 0;
    return duration > 0 ? (avgView / duration) * 100 : 0;
  }).filter(r => r > 0);
  
  if (retentionValues.length === 0) return { available: false };
  
  const avgRetention = retentionValues.reduce((a, b) => a + b, 0) / retentionValues.length;
  
  return {
    available: true,
    avgRetention: avgRetention.toFixed(1) + '%',
    bestRetention: withRetention
      .map(v => ({
        video: v,
        retention: v.avgPercentageViewed || ((v.avgViewDuration || 0) / (v.duration || 600)) * 100
      }))
      .sort((a, b) => b.retention - a.retention)
      .slice(0, 5)
      .map(item => ({
        title: item.video.title,
        retention: item.retention.toFixed(1) + '%'
      })),
    worstRetention: withRetention
      .map(v => ({
        video: v,
        retention: v.avgPercentageViewed || ((v.avgViewDuration || 0) / (v.duration || 600)) * 100
      }))
      .sort((a, b) => a.retention - b.retention)
      .slice(0, 5)
      .map(item => ({
        title: item.video.title,
        retention: item.retention.toFixed(1) + '%'
      }))
  };
}

// ============================================
// ANALYZE TRAFFIC PATTERNS
// ============================================
function analyzeTrafficPatterns(videos) {
  const withTraffic = videos.filter(v => v.trafficSources);
  
  if (withTraffic.length === 0) return { available: false };
  
  const avgTraffic = {
    browse: 0,
    suggested: 0,
    search: 0,
    external: 0
  };
  
  for (const video of withTraffic) {
    avgTraffic.browse += video.trafficSources.browse || 0;
    avgTraffic.suggested += video.trafficSources.suggested || 0;
    avgTraffic.search += video.trafficSources.search || 0;
    avgTraffic.external += video.trafficSources.external || 0;
  }
  
  const count = withTraffic.length;
  
  return {
    available: true,
    avgSources: {
      browse: (avgTraffic.browse / count).toFixed(1) + '%',
      suggested: (avgTraffic.suggested / count).toFixed(1) + '%',
      search: (avgTraffic.search / count).toFixed(1) + '%',
      external: (avgTraffic.external / count).toFixed(1) + '%'
    },
    insight: avgTraffic.browse / count > 50 
      ? 'معظم المشاهدات من Browse - الجمهور يكتشفك من الصفحة الرئيسية'
      : avgTraffic.suggested / count > 30
      ? 'نسبة جيدة من Suggested - الفيديوهات تُقترح مع فيديوهات أخرى'
      : 'توزيع متنوع للمصادر'
  };
}

// ============================================
// ANALYZE PUBLISH PATTERNS
// ============================================
function analyzePublishPatterns(videos) {
  const withDate = videos.filter(v => v.publishDate || v.uploadDate);
  
  if (withDate.length === 0) return { available: false };
  
  const dayPerformance = {};
  const hourPerformance = {};
  
  for (const video of withDate) {
    const date = new Date(video.publishDate || video.uploadDate);
    if (isNaN(date.getTime())) continue;
    
    const day = date.toLocaleDateString('en-US', { weekday: 'long' });
    const hour = date.getHours();
    
    if (!dayPerformance[day]) {
      dayPerformance[day] = { count: 0, totalViews: 0 };
    }
    dayPerformance[day].count++;
    dayPerformance[day].totalViews += video.views || 0;
    
    if (!hourPerformance[hour]) {
      hourPerformance[hour] = { count: 0, totalViews: 0 };
    }
    hourPerformance[hour].count++;
    hourPerformance[hour].totalViews += video.views || 0;
  }
  
  // Calculate avg views per day
  const dayAvgs = Object.entries(dayPerformance)
    .map(([day, data]) => ({
      day,
      avgViews: Math.round(data.totalViews / data.count),
      count: data.count
    }))
    .sort((a, b) => b.avgViews - a.avgViews);
  
  return {
    available: true,
    bestDays: dayAvgs.slice(0, 3),
    worstDays: dayAvgs.slice(-2),
    recommendation: `أفضل يوم للنشر: ${dayAvgs[0]?.day || 'N/A'}`
  };
}

// ============================================
// GENERATE RECOMMENDATIONS
// ============================================
function generateRecommendations(patterns) {
  const recommendations = [];
  
  // Title recommendations
  if (patterns.titlePatterns?.topTitles?.startsWithQuestion > 60) {
    recommendations.push({
      type: 'title',
      priority: 'HIGH',
      recommendation: 'العناوين التي تبدأ بسؤال (هل، كيف، لماذا) تحقق نتائج أفضل',
      evidence: `${patterns.titlePatterns.topTitles.startsWithQuestion}% من الفيديوهات الناجحة تبدأ بسؤال`
    });
  }
  
  // Topic recommendations
  if (patterns.topicPatterns?.winningTopics?.length > 0) {
    recommendations.push({
      type: 'topic',
      priority: 'HIGH',
      recommendation: `المواضيع الأكثر نجاحاً: ${patterns.topicPatterns.winningTopics.slice(0, 3).map(t => t[0]).join(', ')}`,
      evidence: 'بناءً على تحليل أعلى الفيديوهات أداءً'
    });
  }
  
  // Traffic recommendations
  if (patterns.trafficPatterns?.available) {
    recommendations.push({
      type: 'traffic',
      priority: 'MEDIUM',
      recommendation: patterns.trafficPatterns.insight,
      evidence: `Browse: ${patterns.trafficPatterns.avgSources?.browse}, Suggested: ${patterns.trafficPatterns.avgSources?.suggested}`
    });
  }
  
  // Publish time recommendations
  if (patterns.publishPatterns?.bestDays?.length > 0) {
    recommendations.push({
      type: 'publish_time',
      priority: 'MEDIUM',
      recommendation: `أفضل أيام النشر: ${patterns.publishPatterns.bestDays.map(d => d.day).join(', ')}`,
      evidence: `متوسط المشاهدات في ${patterns.publishPatterns.bestDays[0]?.day}: ${patterns.publishPatterns.bestDays[0]?.avgViews}`
    });
  }
  
  return recommendations;
}




