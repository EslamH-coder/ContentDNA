import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// GET CHANNEL DNA (Updated for Organic Views)
// ============================================
export async function getChannelDNA(showId) {
  // Get show settings
  const { data: show } = await supabase
    .from('shows')
    .select('has_paid_promotion, use_organic_for_analysis')
    .eq('id', showId)
    .single();
  
  const useOrganic = show?.use_organic_for_analysis ?? true;
  
  // Get all videos with performance data
  const { data: videos } = await supabase
    .from('channel_videos')
    .select('*')
    .eq('show_id', showId);
  
  if (!videos || videos.length === 0) {
    return { topTopics: [], topElements: [], successfulHooks: [], hookPatterns: {}, stats: {}, formatStats: {}, topTopicsLong: [], topTopicsShorts: [] };
  }
  
  // Separate Long and Shorts
  const longVideos = videos.filter(v => v.format === 'Long');
  const shortsVideos = videos.filter(v => v.format === 'Shorts');

  // Calculate stats for each format
  const formatStats = {
    long: {
      count: longVideos.length,
      total_views: longVideos.reduce((sum, v) => sum + (v.views || 0), 0),
      total_views_organic: longVideos.reduce((sum, v) => sum + (v.views_organic || v.views || 0), 0),
      total_views_ads: longVideos.reduce((sum, v) => sum + (v.views_from_ads || 0), 0),
      avg_ad_percentage: longVideos.length > 0 
        ? longVideos.reduce((sum, v) => sum + (v.ad_percentage || 0), 0) / longVideos.length 
        : 0,
      overperforming: longVideos.filter(v => v.performance_hint === 'Overperforming').length
    },
    shorts: {
      count: shortsVideos.length,
      total_views: shortsVideos.reduce((sum, v) => sum + (v.views || 0), 0),
      total_views_organic: shortsVideos.reduce((sum, v) => sum + (v.views_organic || v.views || 0), 0),
      total_views_ads: shortsVideos.reduce((sum, v) => sum + (v.views_from_ads || 0), 0),
      avg_ad_percentage: shortsVideos.length > 0 
        ? shortsVideos.reduce((sum, v) => sum + (v.ad_percentage || 0), 0) / shortsVideos.length 
        : 0,
      overperforming: shortsVideos.filter(v => v.performance_hint === 'Overperforming').length
    }
  };
  
  // Calculate overall stats
  const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
  const totalOrganic = videos.reduce((sum, v) => sum + (v.views_organic || v.views || 0), 0);
  const totalAds = videos.reduce((sum, v) => sum + (v.views_from_ads || 0), 0);
  const avgAdPercentage = videos.reduce((sum, v) => sum + (v.ad_percentage || 0), 0) / videos.length;
  
  // Aggregate topic performance BY FORMAT
  const topicStats = {};
  const topicStatsLong = {};
  const topicStatsShorts = {};
  
  videos.forEach(v => {
    if (!v.topic_id) return;
    
    // Combined stats (all formats)
    if (!topicStats[v.topic_id]) {
      topicStats[v.topic_id] = { 
        count: 0, 
        views: 0, 
        views_organic: 0,
        overperforming: 0, 
        engagement: 0,
        viral_score: 0
      };
    }
    topicStats[v.topic_id].count++;
    topicStats[v.topic_id].views += v.views || 0;
    topicStats[v.topic_id].views_organic += v.views_organic || v.views || 0;
    topicStats[v.topic_id].engagement += v.engagement_rate_30d || 0;
    topicStats[v.topic_id].viral_score += v.viral_score || 0;
    if (v.performance_hint === 'Overperforming') {
      topicStats[v.topic_id].overperforming++;
    }
    
    // Format-specific stats
    const targetStats = v.format === 'Long' ? topicStatsLong : topicStatsShorts;
    
    if (!targetStats[v.topic_id]) {
      targetStats[v.topic_id] = { 
        count: 0, 
        views: 0, 
        views_organic: 0,
        views_ads: 0,
        ad_percentage_sum: 0,
        overperforming: 0, 
        engagement: 0,
        viral_score: 0
      };
    }
    
    targetStats[v.topic_id].count++;
    targetStats[v.topic_id].views += v.views || 0;
    targetStats[v.topic_id].views_organic += v.views_organic || v.views || 0;
    targetStats[v.topic_id].views_ads += v.views_from_ads || 0;
    targetStats[v.topic_id].ad_percentage_sum += v.ad_percentage || 0;
    targetStats[v.topic_id].engagement += v.engagement_rate_30d || 0;
    targetStats[v.topic_id].viral_score += v.viral_score || 0;
    
    if (v.performance_hint === 'Overperforming') {
      targetStats[v.topic_id].overperforming++;
    }
  });

  const formatTopics = (stats) => Object.entries(stats)
    .map(([topic, data]) => ({
      topic_id: topic,
      video_count: data.count,
      avg_views: Math.round(data.views / data.count),
      avg_views_organic: Math.round(data.views_organic / data.count),
      avg_views_ads: Math.round(data.views_ads / data.count),
      avg_ad_percentage: parseFloat((data.ad_percentage_sum / data.count).toFixed(1)),
      success_rate: Math.round(data.overperforming / data.count * 100),
      avg_engagement: (data.engagement / data.count).toFixed(2),
      avg_viral_score: Math.round(data.viral_score / data.count)
    }))
    .sort((a, b) => b.avg_views_organic - a.avg_views_organic);

  const topTopics = Object.entries(topicStats)
    .map(([topic, stats]) => ({
      topic_id: topic,
      video_count: stats.count,
      avg_views: Math.round(stats.views / stats.count),
      avg_views_organic: Math.round(stats.views_organic / stats.count),
      success_rate: Math.round(stats.overperforming / stats.count * 100),
      avg_engagement: (stats.engagement / stats.count).toFixed(2),
      avg_viral_score: Math.round(stats.viral_score / stats.count)
    }))
    .sort((a, b) => b.avg_views_organic - a.avg_views_organic)
    .slice(0, 15);

  const topTopicsLong = formatTopics(topicStatsLong).slice(0, 15);
  const topTopicsShorts = formatTopics(topicStatsShorts).slice(0, 15);

  // Get thumbnail elements performance (using organic views)
  const elementStats = {};
  videos.forEach(v => {
    const elements = v.thumbnail_elements || [];
    elements.forEach(elem => {
      if (!elementStats[elem]) {
        elementStats[elem] = { count: 0, views: 0, views_organic: 0, overperforming: 0 };
      }
      elementStats[elem].count++;
      elementStats[elem].views += v.views || 0;
      elementStats[elem].views_organic += v.views_organic || v.views || 0;
      if (v.performance_hint === 'Overperforming') {
        elementStats[elem].overperforming++;
      }
    });
  });

  const topElements = Object.entries(elementStats)
    .map(([elem, stats]) => ({
      element: elem,
      count: stats.count,
      avg_views: Math.round(stats.views / stats.count),
      avg_views_organic: Math.round(stats.views_organic / stats.count),
      success_rate: Math.round(stats.overperforming / stats.count * 100)
    }))
    .sort((a, b) => b.avg_views_organic - a.avg_views_organic)
    .slice(0, 10);

  // Get successful hooks (based on organic performance)
  const successfulHooks = videos
    .filter(v => v.performance_hint === 'Overperforming' && v.hook_text)
    .sort((a, b) => (b.views_organic || b.views) - (a.views_organic || a.views))
    .slice(0, 30)
    .map(v => ({
      title: v.title,
      hook_text: v.hook_text?.substring(0, 200),
      views: v.views,
      views_organic: v.views_organic,
      ad_percentage: v.ad_percentage,
      topic_id: v.topic_id
    }));

  // Analyze hook patterns
  const hookPatterns = analyzeHookPatterns(successfulHooks);

  // Overall stats
  const stats = {
    total_videos: videos.length,
    total_views: totalViews,
    total_views_organic: totalOrganic,
    total_views_ads: totalAds,
    avg_ad_percentage: parseFloat(avgAdPercentage.toFixed(1)),
    has_paid_promotion: show?.has_paid_promotion || avgAdPercentage > 10,
    overperforming: videos.filter(v => v.performance_hint === 'Overperforming').length,
    with_transcripts: videos.filter(v => v.transcript_available).length,
    with_thumbnails: videos.filter(v => v.thumbnail_analyzed).length
  };

  return {
    topTopics,           // Combined (existing)
    topTopicsLong,       // NEW: Long-form only
    topTopicsShorts,     // NEW: Shorts only
    formatStats,         // NEW: Format breakdown
    topElements,
    successfulHooks,
    hookPatterns,
    stats,
    useOrganic
  };
}

// ============================================
// ANALYZE HOOK PATTERNS
// ============================================
export function analyzeHookPatterns(hooks) {
  const patterns = {
    withNumbers: { count: 0, avgViews: 0, examples: [] },
    withQuestion: { count: 0, avgViews: 0, examples: [] },
    withScenario: { count: 0, avgViews: 0, examples: [] },
    withPerson: { count: 0, avgViews: 0, examples: [] },
    withShock: { count: 0, avgViews: 0, examples: [] }
  };

  hooks?.forEach(h => {
    const hook = h.hook_text?.toLowerCase() || '';
    
    // Numbers pattern
    if (/\d+\s*(مليون|مليار|دولار|سنة|يوم)/i.test(hook)) {
      patterns.withNumbers.count++;
      patterns.withNumbers.avgViews += h.views || 0;
      if (patterns.withNumbers.examples.length < 3) {
        patterns.withNumbers.examples.push(h.hook_text?.substring(0, 100) || '');
      }
    }
    
    // Question pattern
    if (/^(هل|ليه|كيف|ايه|ازاي|لماذا)/i.test(hook) || hook.includes('?')) {
      patterns.withQuestion.count++;
      patterns.withQuestion.avgViews += h.views || 0;
      if (patterns.withQuestion.examples.length < 3) {
        patterns.withQuestion.examples.push(h.hook_text?.substring(0, 100) || '');
      }
    }
    
    // Scenario pattern (لو، ماذا لو)
    if (/^(لو|ماذا لو|تخيل)/i.test(hook)) {
      patterns.withScenario.count++;
      patterns.withScenario.avgViews += h.views || 0;
      if (patterns.withScenario.examples.length < 3) {
        patterns.withScenario.examples.push(h.hook_text?.substring(0, 100) || '');
      }
    }
    
    // Person/name pattern
    if (/(ترامب|بايدن|ماسك|شي جين|بوتين|نتنياهو)/i.test(hook)) {
      patterns.withPerson.count++;
      patterns.withPerson.avgViews += h.views || 0;
      if (patterns.withPerson.examples.length < 3) {
        patterns.withPerson.examples.push(h.hook_text?.substring(0, 100) || '');
      }
    }
    
    // Shock pattern
    if (/(مافيش|مش قادر|صدم|خطير|سر|لن تصدق)/i.test(hook)) {
      patterns.withShock.count++;
      patterns.withShock.avgViews += h.views || 0;
      if (patterns.withShock.examples.length < 3) {
        patterns.withShock.examples.push(h.hook_text?.substring(0, 100) || '');
      }
    }
  });

  // Calculate averages
  Object.keys(patterns).forEach(key => {
    if (patterns[key].count > 0) {
      patterns[key].avgViews = Math.round(patterns[key].avgViews / patterns[key].count);
    }
  });

  return patterns;
}

// ============================================
// SCORE A TOPIC (Using Organic Views)
// ============================================
export async function scoreTopic(showId, topicText) {
  const dna = await getChannelDNA(showId);
  
  let score = 50; // Base score
  const reasons = [];
  
  // Check if matches top topics (now using organic performance)
  const topicLower = topicText.toLowerCase();
  
  // Topic keywords mapping
  const topicKeywords = {
    'missiles_air_defense': ['صواريخ', 'دفاع جوي', 'missiles', 'defense'],
    'us_china_geopolitics': ['أمريكا', 'الصين', 'ترامب', 'china', 'usa', 'trump'],
    'yemen_red_sea_trade': ['اليمن', 'البحر الأحمر', 'الحوثي', 'yemen', 'red sea'],
    'arms_industry_exports': ['سلاح', 'تسليح', 'عسكري', 'arms', 'weapons'],
    'intelligence_ops': ['استخبارات', 'تجسس', 'cia', 'موساد'],
    'big_tech_platforms': ['فيسبوك', 'جوجل', 'تيك توك', 'meta', 'google'],
    'nuclear_programs': ['نووي', 'nuclear', 'ذري'],
    'currency_devaluation': ['دولار', 'عملة', 'تضخم', 'currency']
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => topicLower.includes(kw))) {
      const topicData = dna.topTopics.find(t => t.topic_id === topic);
      if (topicData) {
        score += topicData.success_rate * 0.3;
        reasons.push(`✅ Matches successful topic: ${topic} (${topicData.success_rate}% success, ${topicData.avg_views_organic.toLocaleString()} avg organic views)`);
      }
    }
  }

  // Check for winning elements mentioned
  const winningElements = ['حرب', 'صراع', 'أزمة', 'سر', 'خطير', 'مليار', 'ترامب'];
  winningElements.forEach(elem => {
    if (topicLower.includes(elem)) {
      score += 5;
      reasons.push(`✅ Contains engaging element: "${elem}"`);
    }
  });

  // Add note about organic analysis if channel uses paid promotion
  if (dna.stats?.has_paid_promotion) {
    reasons.push(`📊 Analysis based on organic views (channel has ${dna.stats.avg_ad_percentage}% ad traffic)`);
  }

  // Cap score at 100
  score = Math.min(100, Math.round(score));

  return {
    score,
    rating: score >= 80 ? '🔥 Excellent' : score >= 60 ? '👍 Good' : score >= 40 ? '🤔 Average' : '⚠️ Low',
    reasons,
    suggestions: generateSuggestions(topicText, dna),
    organicBased: dna.stats?.has_paid_promotion || false
  };
}

// ============================================
// GENERATE SUGGESTIONS
// ============================================
function generateSuggestions(topicText, dna) {
  const suggestions = [];
  
  // Thumbnail suggestions based on top elements
  suggestions.push({
    type: 'thumbnail',
    title: 'عناصر الثمبنيل المقترحة',
    items: dna.topElements.slice(0, 5).map(e => e.element)
  });

  // Hook pattern suggestions
  const bestPattern = Object.entries(dna.hookPatterns)
    .filter(([_, p]) => p.count > 0)
    .sort((a, b) => b[1].avgViews - a[1].avgViews)[0];
  
  if (bestPattern) {
    suggestions.push({
      type: 'hook',
      title: 'نمط الـ Hook المقترح',
      pattern: bestPattern[0],
      example: bestPattern[1].examples[0]
    });
  }

  return suggestions;
}

// ============================================
// GENERATE SMART HOOK
// ============================================
export async function generateSmartHook(showId, topic, style = 'auto') {
  const dna = await getChannelDNA(showId);
  
  // Find similar successful hooks
  const similarHooks = dna.successfulHooks?.filter(h => {
    const hookLower = (h.hook_text || '').toLowerCase();
    const topicLower = topic.toLowerCase();
    // Check for keyword overlap
    const topicWords = topicLower.split(/\s+/).filter(w => w.length > 3);
    return topicWords.some(w => hookLower.includes(w));
  }).slice(0, 5) || [];

  // Get best performing pattern
  const patterns = dna.hookPatterns;
  const bestPatterns = Object.entries(patterns)
    .filter(([_, p]) => p.count > 0)
    .sort((a, b) => b[1].avgViews - a[1].avgViews);

  return {
    similarSuccessfulHooks: similarHooks.map(h => ({
      hook: h.hook_text?.substring(0, 150),
      views: h.views,
      topic: h.topic_id
    })),
    recommendedPatterns: bestPatterns.slice(0, 3).map(([name, data]) => ({
      pattern: name,
      avgViews: data.avgViews,
      example: data.examples[0]
    })),
    tips: [
      '💡 ابدأ برقم كبير يلفت الانتباه',
      '💡 استخدم سيناريو "لو حصل كذا..."',
      '💡 اذكر شخصية معروفة في أول 5 ثواني',
      '💡 اطرح سؤال يثير الفضول'
    ]
  };
}

// ============================================
// GET THUMBNAIL ADVICE
// ============================================
export async function getThumbnailAdvice(showId, topic) {
  const dna = await getChannelDNA(showId);
  
  // Find which elements work best for this type of topic
  const topicLower = topic.toLowerCase();
  
  let recommendedElements = [];
  
  // Military/geopolitical topics
  if (/(حرب|عسكر|صاروخ|سلاح|جيش)/i.test(topicLower)) {
    recommendedElements = ['خريطة', 'علم', 'سهم', 'أسلحة', 'وجه'];
  }
  // Economic topics
  else if (/(اقتصاد|دولار|مال|شركة|أسهم)/i.test(topicLower)) {
    recommendedElements = ['مخطط', 'دولار', 'نقود', 'شعار', 'سهم'];
  }
  // Tech topics
  else if (/(تقنية|فيسبوك|جوجل|ذكاء|تطبيق)/i.test(topicLower)) {
    recommendedElements = ['شعار', 'وجه', 'شخصية', 'نص'];
  }
  // Default
  else {
    recommendedElements = dna.topElements.slice(0, 5).map(e => e.element);
  }

  return {
    recommendedElements,
    topPerformingCombos: [
      { elements: ['خريطة', 'علم', 'سهم'], avgViews: '1.1M+' },
      { elements: ['وجه', 'شعار', 'مخطط'], avgViews: '960K+' },
      { elements: ['سفينة', 'خريطة'], avgViews: '1.35M+' }
    ],
    tips: [
      '🖼️ استخدم وجه شخصية معروفة',
      '🖼️ أضف خريطة للمواضيع الجيوسياسية',
      '🖼️ استخدم سهم يشير للعنصر المهم',
      '🖼️ اجعل العنوان على الثمبنيل قصير (3-5 كلمات)'
    ],
    colorAdvice: 'استخدم ألوان متباينة - الأحمر والأصفر يجذبان الانتباه'
  };
}

