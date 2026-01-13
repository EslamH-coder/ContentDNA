/**
 * DNA UPDATER
 * Processes new video data and updates the Living DNA
 */

// ============================================
// UPDATE DNA FROM NEW VIDEO
// ============================================
export async function updateDNAFromVideo(currentDNA, videoData, llmClient = null) {
  /**
   * videoData structure:
   * {
   *   title: string,
   *   hook: string (first 15s transcript),
   *   topic: string,
   *   views: number,
   *   retention_30s: number,
   *   avg_viewed_pct: number,
   *   ctr: number,
   *   duration_minutes: number,
   *   publish_date: string,
   *   chapters: array,
   *   traffic_sources: object
   * }
   */
  
  const updatedDNA = JSON.parse(JSON.stringify(currentDNA)); // Deep copy
  
  // 1. Update topic performance
  updatedDNA.topics = updateTopicPerformance(updatedDNA.topics, videoData);
  
  // 2. Analyze hook and update patterns
  updatedDNA.hooks = analyzeAndUpdateHooks(updatedDNA.hooks, videoData);
  
  // 3. Update format insights
  updatedDNA.format = updateFormatInsights(updatedDNA.format, videoData);
  
  // 4. Generate new insights using LLM (if available)
  if (llmClient) {
    updatedDNA.insights = await generateNewInsights(updatedDNA, videoData, llmClient);
  }
  
  // 5. Update audience behavior patterns
  updatedDNA.audience = analyzeAudienceBehavior(updatedDNA.audience, videoData, updatedDNA.topics);
  
  // 6. Auto-update banned weak topics
  updatedDNA.banned = updateBannedList(updatedDNA.banned, updatedDNA.topics);
  
  // 7. Update metadata
  updatedDNA.metadata.last_updated = new Date().toISOString();
  updatedDNA.metadata.total_videos_analyzed += 1;
  
  return updatedDNA;
}

// ============================================
// UPDATE BANNED LIST (Auto-detect weak topics)
// ============================================
function updateBannedList(banned, topics) {
  const avgViews = calculateAvgViews(topics);
  
  // Find topics that consistently underperform
  const weakTopics = Object.entries(topics)
    .filter(([_, data]) => {
      // Topic is weak if:
      // 1. Has 3+ videos (enough data)
      // 2. Average views < 50% of overall average
      // 3. Trend is falling
      return data.videos_count >= 3 && 
             data.avg_views < avgViews * 0.5 && 
             avgViews > 0 &&
             data.trend === 'falling';
    })
    .map(([topic, _]) => topic);
  
  // Add to banned list (avoid duplicates)
  banned.weak_topics = [...new Set([...banned.weak_topics, ...weakTopics])];
  
  // Also check for ceiling topics (high retention, low views)
  const ceilingTopics = Object.entries(topics)
    .filter(([_, data]) => {
      // Ceiling topic: high retention but low views
      return data.videos_count >= 3 &&
             data.avg_retention_30s >= 75 &&
             data.avg_views < avgViews * 0.6 &&
             avgViews > 0;
    })
    .map(([topic, _]) => topic);
  
  // Add ceiling topics to banned (they're traps)
  banned.weak_topics = [...new Set([...banned.weak_topics, ...ceilingTopics])];
  
  return banned;
}

// ============================================
// UPDATE TOPIC PERFORMANCE
// ============================================
function updateTopicPerformance(topics, videoData) {
  const topic = videoData.topic;
  
  if (!topics[topic]) {
    topics[topic] = {
      videos_count: 0,
      total_views: 0,
      total_retention: 0,
      total_ctr: 0,
      videos: [],
      notes: [],
      trend: 'new'
    };
  }
  
  const t = topics[topic];
  t.videos_count += 1;
  t.total_views += videoData.views;
  t.total_retention += videoData.retention_30s;
  t.total_ctr += videoData.ctr;
  
  // Calculate averages
  t.avg_views = Math.round(t.total_views / t.videos_count);
  t.avg_retention_30s = parseFloat((t.total_retention / t.videos_count).toFixed(1));
  t.avg_ctr = parseFloat((t.total_ctr / t.videos_count).toFixed(1));
  
  // Track individual videos for analysis
  t.videos.push({
    title: videoData.title,
    views: videoData.views,
    retention: videoData.retention_30s,
    date: videoData.publish_date
  });
  
  // Keep only last 20 videos per topic
  if (t.videos.length > 20) {
    t.videos = t.videos.slice(-20);
  }
  
  // Determine trend (compare last 3 videos to previous 3)
  if (t.videos.length >= 6) {
    const recent3 = t.videos.slice(-3);
    const previous3 = t.videos.slice(-6, -3);
    
    const recentAvg = recent3.reduce((sum, v) => sum + v.views, 0) / 3;
    const previousAvg = previous3.reduce((sum, v) => sum + v.views, 0) / 3;
    
    if (recentAvg > previousAvg * 1.1) t.trend = 'rising';
    else if (recentAvg < previousAvg * 0.9) t.trend = 'falling';
    else t.trend = 'stable';
  }
  
  t.last_video_date = videoData.publish_date;
  
  return topics;
}

// ============================================
// ANALYZE AND UPDATE HOOKS
// ============================================
function analyzeAndUpdateHooks(hooks, videoData) {
  // Detect which pattern was used
  const hookText = videoData.hook || '';
  let patternUsed = detectHookPattern(hookText);
  
  if (!hooks.patterns[patternUsed]) {
    hooks.patterns[patternUsed] = {
      usage_count: 0,
      total_retention: 0,
      total_views: 0,
      examples: [],
      notes: []
    };
  }
  
  const p = hooks.patterns[patternUsed];
  p.usage_count += 1;
  p.total_retention += videoData.retention_30s;
  p.total_views += videoData.views;
  p.avg_retention_30s = parseFloat((p.total_retention / p.usage_count).toFixed(1));
  p.avg_views = Math.round(p.total_views / p.usage_count);
  
  // Track best example
  if (!p.best_example || videoData.views > p.best_example.views) {
    p.best_example = {
      title: videoData.title,
      hook: hookText.substring(0, 200),
      views: videoData.views,
      retention: videoData.retention_30s
    };
  }
  
  // Extract effective phrases if high performance
  if (videoData.retention_30s >= 75) {
    const phrases = extractPhrases(hookText);
    hooks.effective_phrases = [...new Set([...hooks.effective_phrases, ...phrases])].slice(0, 50);
  }
  
  // Track failed phrases if low performance
  if (videoData.retention_30s < 70) {
    const phrases = extractPhrases(hookText);
    hooks.failed_phrases = [...new Set([...hooks.failed_phrases, ...phrases])].slice(0, 30);
  }
  
  return hooks;
}

function detectHookPattern(hookText) {
  if (!hookText) return 'other';
  
  if (/^في\s+\d{1,2}\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)/.test(hookText)) {
    return 'date_entity_action';
  }
  if (/^هل\s+.+\?.*الإجابة/.test(hookText)) {
    return 'question_answer';
  }
  if (/^\d+\s*(مليون|مليار|تريليون|%)/.test(hookText)) {
    return 'number_impact';
  }
  if (/^(جهاز|منتج|شركة)\s+.+اللي/.test(hookText)) {
    return 'product_number';
  }
  return 'other';
}

function extractPhrases(text) {
  if (!text) return [];
  
  // Extract 3-5 word phrases
  const words = text.split(/\s+/).filter(w => w.length > 2);
  const phrases = [];
  
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = words.slice(i, i + 3).join(' ');
    if (phrase.length > 10 && phrase.length < 50) {
      phrases.push(phrase);
    }
  }
  
  return phrases.slice(0, 10); // Limit to 10 phrases
}

// ============================================
// UPDATE FORMAT INSIGHTS
// ============================================
function updateFormatInsights(format, videoData) {
  const duration = videoData.duration_minutes;
  const views = videoData.views;
  
  // Track duration vs views correlation
  if (!format.duration_performance) {
    format.duration_performance = [];
  }
  
  format.duration_performance.push({
    duration,
    views,
    retention: videoData.retention_30s
  });
  
  // Keep only last 50 entries
  if (format.duration_performance.length > 50) {
    format.duration_performance = format.duration_performance.slice(-50);
  }
  
  // Recalculate optimal duration based on top performers
  const sorted = [...format.duration_performance].sort((a, b) => b.views - a.views);
  const top5 = sorted.slice(0, 5);
  
  if (top5.length >= 3) {
    const avgDuration = top5.reduce((sum, v) => sum + v.duration, 0) / top5.length;
    format.optimal_duration.long_form = {
      min: Math.floor(avgDuration - 3),
      max: Math.ceil(avgDuration + 3),
      unit: 'minutes',
      based_on: `Top ${top5.length} videos`
    };
  }
  
  return format;
}

// ============================================
// GENERATE NEW INSIGHTS (LLM)
// ============================================
async function generateNewInsights(dna, videoData, llmClient) {
  if (!llmClient || !llmClient.messages || !llmClient.messages.create) {
    // No LLM available, return basic insights
    return generateBasicInsights(dna, videoData);
  }

  const avgViews = calculateAvgViews(dna.topics);
  const avgRetention = calculateAvgRetention(dna.topics);
  
  const prompt = `
أنت محلل بيانات لقناة يوتيوب. بناءً على أداء الفيديو الجديد، اكتب ملاحظات وinsights.

# بيانات الفيديو الجديد:
- العنوان: ${videoData.title}
- الهوك: ${videoData.hook ? videoData.hook.substring(0, 200) : 'غير متوفر'}
- الموضوع: ${videoData.topic}
- المشاهدات: ${videoData.views.toLocaleString()}
- Retention at 30s: ${videoData.retention_30s}%
- CTR: ${videoData.ctr}%
- المدة: ${videoData.duration_minutes} دقيقة

# متوسطات القناة الحالية:
- متوسط المشاهدات: ${avgViews.toLocaleString()}
- متوسط Retention: ${avgRetention}%

# المطلوب:
اكتب JSON فقط بهذا الشكل:
{
  "performance": "above_average|below_average|average",
  "observations": ["ملاحظة 1", "ملاحظة 2"],
  "what_worked": ["نقطة 1", "نقطة 2"],
  "what_failed": ["نقطة 1"] أو [],
  "new_pattern": "نمط جديد إن وجد أو null",
  "warning": "تحذير إن وجد أو null"
}
`;

  try {
    const response = await llmClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.3,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    
    const responseText = response.content[0].text.trim();
    
    // Try to extract JSON
    let jsonText = responseText;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    const insights = JSON.parse(jsonText);
    
    // Add to recent insights
    dna.insights.recent.unshift({
      date: new Date().toISOString(),
      video_title: videoData.title,
      ...insights
    });
    
    // Keep only last 20 insights
    dna.insights.recent = dna.insights.recent.slice(0, 20);
    
    // Add warning to DNA if present
    if (insights.warning) {
      dna.insights.warnings.unshift({
        date: new Date().toISOString(),
        warning: insights.warning,
        video: videoData.title
      });
      dna.insights.warnings = dna.insights.warnings.slice(0, 10);
    }
    
    // Add new pattern if discovered
    if (insights.new_pattern) {
      dna.insights.experiments.unshift({
        date: new Date().toISOString(),
        pattern: insights.new_pattern,
        source_video: videoData.title
      });
      dna.insights.experiments = dna.insights.experiments.slice(0, 10);
    }
    
    return dna.insights;
  } catch (e) {
    console.error('Failed to generate LLM insights:', e.message);
    return generateBasicInsights(dna, videoData);
  }
}

function generateBasicInsights(dna, videoData) {
  const avgViews = calculateAvgViews(dna.topics);
  const performance = videoData.views > avgViews * 1.1 ? 'above_average' : 
                     videoData.views < avgViews * 0.9 ? 'below_average' : 'average';
  
  const observations = [];
  if (videoData.views > avgViews) {
    observations.push(`الفيديو حقق ${videoData.views.toLocaleString()} مشاهدة مقابل متوسط ${avgViews.toLocaleString()}`);
  }
  if (videoData.retention_30s >= 75) {
    observations.push(`Retention عالي: ${videoData.retention_30s}%`);
  }
  
  dna.insights.recent.unshift({
    date: new Date().toISOString(),
    video_title: videoData.title,
    performance,
    observations,
    what_worked: [],
    what_failed: [],
    new_pattern: null,
    warning: null
  });
  
  dna.insights.recent = dna.insights.recent.slice(0, 20);
  
  return dna.insights;
}

function calculateAvgViews(topics) {
  const allVideos = Object.values(topics).flatMap(t => t.videos || []);
  if (allVideos.length === 0) return 0;
  return Math.round(allVideos.reduce((sum, v) => sum + v.views, 0) / allVideos.length);
}

function calculateAvgRetention(topics) {
  const values = Object.values(topics).filter(t => t.avg_retention_30s);
  if (values.length === 0) return 0;
  return parseFloat((values.reduce((sum, t) => sum + t.avg_retention_30s, 0) / values.length).toFixed(1));
}

// ============================================
// ANALYZE AUDIENCE BEHAVIOR
// ============================================
function analyzeAudienceBehavior(audience, videoData, topics) {
  const avgViews = calculateAvgViews(topics);
  
  // CTR vs Views analysis (Click Triggers)
  if (videoData.ctr > 6) {
    audience.click_triggers.push({
      title: videoData.title,
      ctr: videoData.ctr,
      what_worked: 'High CTR - title/thumbnail compelling',
      date: videoData.publish_date
    });
    // Keep only last 20
    audience.click_triggers = audience.click_triggers.slice(-20);
  }
  
  // Retention analysis (Stay Triggers)
  if (videoData.retention_30s > 75) {
    audience.retention_triggers.push({
      hook: videoData.hook ? videoData.hook.substring(0, 100) : '',
      retention: videoData.retention_30s,
      what_worked: 'High retention - hook effective',
      date: videoData.publish_date
    });
    // Keep only last 20
    audience.retention_triggers = audience.retention_triggers.slice(-20);
  }
  
  // Views vs Retention paradox (Traps)
  if (videoData.retention_30s > 75 && videoData.views < avgViews * 0.5 && avgViews > 0) {
    audience.traps.push({
      video: videoData.title,
      observation: 'High retention but low views - topic has ceiling',
      retention: videoData.retention_30s,
      views: videoData.views,
      date: videoData.publish_date
    });
    // Keep only last 10
    audience.traps = audience.traps.slice(-10);
  }
  
  // Viral indicators
  if (videoData.views > 2000000) {
    audience.share_triggers.push({
      video: videoData.title,
      topic: videoData.topic,
      views: videoData.views,
      what_triggered_virality: 'Needs manual analysis',
      date: videoData.publish_date
    });
    // Keep only last 10
    audience.share_triggers = audience.share_triggers.slice(-10);
  }
  
  return audience;
}

