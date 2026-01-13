/**
 * DNA BUILDER
 * Builds Living DNA from imported video data
 */

import { createLivingDNA } from './livingDNA.js';

// ============================================
// MAIN BUILDER FUNCTION
// ============================================
export async function buildDNAFromVideos(videos) {
  const dna = createLivingDNA();

  for (const video of videos) {
    // Parse video data
    const parsed = parseVideoRow(video);
    
    if (!parsed) continue;

    // Update topics
    updateTopics(dna, parsed);

    // Analyze and update hooks
    updateHooks(dna, parsed);

    // Update format insights
    updateFormat(dna, parsed);

    // Track audience behavior patterns
    updateAudienceBehavior(dna, parsed);
  }

  // Calculate final averages and insights
  finalizeDNA(dna);

  // Update metadata
  dna.metadata.total_videos_analyzed = videos.filter(v => v.title).length;
  dna.metadata.last_updated = new Date().toISOString();
  dna.metadata.channel_name = 'المُخبر الاقتصادي+';

  return dna;
}

// ============================================
// PARSE VIDEO ROW FROM CSV
// ============================================
function parseVideoRow(row) {
  try {
    // Parse views (handle comma formatting)
    let views = row.views;
    if (typeof views === 'string') {
      views = parseInt(views.replace(/,/g, '')) || 0;
    }
    if (!views || views === 0) return null;

    // Parse retention (handle % sign)
    let retention30s = row['%audience retention at 30s longform'] || 
                       row['retention_30s'] || 
                       row['retention at 30s'] ||
                       row['%Audience retention at 30s Longform'];
    if (typeof retention30s === 'string') {
      retention30s = parseFloat(retention30s.replace('%', '').replace(',', '.')) || 0;
    }

    // Parse CTR
    let ctr = row['%ctr'] || row['ctr'] || row['CTR'];
    if (typeof ctr === 'string') {
      ctr = parseFloat(ctr.replace('%', '').replace(',', '.')) || 0;
    }

    // Parse avg viewed
    let avgViewed = row['average % viewed long_form'] || 
                    row['avg_viewed'] || 
                    row['Average % viewed long_form'];
    if (typeof avgViewed === 'string') {
      avgViewed = parseFloat(avgViewed.replace('%', '').replace(',', '.')) || 0;
    }

    // Parse duration
    let duration = row.duration || row['duration_minutes'] || row['duration minutes'];
    if (typeof duration === 'string') {
      // Handle formats like "25:30" or "25 min"
      if (duration.includes(':')) {
        const parts = duration.split(':');
        duration = parseInt(parts[0]) + parseInt(parts[1] || 0) / 60;
      } else {
        duration = parseFloat(duration) || 0;
      }
    }

    // Get topics (try multiple column names)
    const topics = [
      row.topic_1 || row['topic 1'] || row['Topic 1'],
      row.topic_2 || row['topic 2'] || row['Topic 2'],
      row.topic_3 || row['topic 3'] || row['Topic 3'],
      row.topic_id || row['topic id'] || row['Topic ID']
    ].filter(Boolean);

    return {
      title: row.title || row['Title'] || '',
      format: (row.format || row['Format'] || 'long_form').toLowerCase(),
      topics,
      views: views || 0,
      retention_30s: retention30s || 0,
      ctr: ctr || 0,
      avg_viewed: avgViewed || 0,
      duration: duration || 0,
      hook_text: row.hook_first_15s_text || 
                 row['hook first 15s text'] || 
                 row['Hook First 15s Text'] ||
                 row.hook_text ||
                 '',
      chapters: row['chapters/beats'] || row['chapters'] || '',
      
      // Shorts specific
      retention_3s: parseFloat((row['%retention 3 seconds #shorts'] || 
                                row['retention_3s'] || 
                                row['Retention 3 seconds #Shorts'] || 
                                '0').replace('%', '').replace(',', '.')) || 0,
      viewed_vs_swiped: parseFloat((row['% viewed vs swiped away short_form'] || 
                                    row['viewed_vs_swiped'] || 
                                    row['% Viewed vs Swiped away short_form'] || 
                                    '0').replace('%', '').replace(',', '.')) || 0
    };

  } catch (e) {
    console.error('Error parsing video row:', e, row);
    return null;
  }
}

// ============================================
// UPDATE TOPICS
// ============================================
function updateTopics(dna, video) {
  for (const topic of video.topics) {
    if (!topic) continue;

    // Normalize topic name
    const topicKey = topic.toLowerCase().trim().replace(/\s+/g, '_');

    if (!dna.topics[topicKey]) {
      dna.topics[topicKey] = {
        videos_count: 0,
        total_views: 0,
        total_retention: 0,
        total_ctr: 0,
        total_avg_viewed: 0,
        videos: [],
        avg_views: 0,
        avg_retention_30s: 0,
        avg_ctr: 0,
        avg_viewed: 0,
        trend: 'new'
      };
    }

    const t = dna.topics[topicKey];
    t.videos_count += 1;
    t.total_views += video.views;
    t.total_retention += video.retention_30s || 0;
    t.total_ctr += video.ctr || 0;
    t.total_avg_viewed += video.avg_viewed || 0;

    t.videos.push({
      title: video.title,
      views: video.views,
      retention: video.retention_30s,
      ctr: video.ctr
    });

    // Keep only last 20 videos per topic
    if (t.videos.length > 20) {
      t.videos = t.videos.slice(-20);
    }

    t.last_video_date = new Date().toISOString();
  }
}

// ============================================
// UPDATE HOOKS
// ============================================
function updateHooks(dna, video) {
  const hookText = video.hook_text;
  if (!hookText || hookText.trim().length < 10) return;

  // Detect pattern
  const pattern = detectHookPattern(hookText);

  if (!dna.hooks.patterns[pattern]) {
    dna.hooks.patterns[pattern] = {
      usage_count: 0,
      total_retention: 0,
      total_views: 0,
      avg_retention_30s: 0,
      avg_views: 0,
      examples: [],
      best_example: null
    };
  }

  const p = dna.hooks.patterns[pattern];
  p.usage_count += 1;
  p.total_retention += video.retention_30s || 0;
  p.total_views += video.views;

  // Store example
  p.examples.push({
    title: video.title,
    hook: hookText.substring(0, 200),
    views: video.views,
    retention: video.retention_30s
  });

  // Keep only last 10 examples per pattern
  if (p.examples.length > 10) {
    p.examples = p.examples.slice(-10);
  }

  // Track best example
  if (!p.best_example || video.views > p.best_example.views) {
    p.best_example = {
      title: video.title,
      hook: hookText.substring(0, 200),
      views: video.views,
      retention: video.retention_30s
    };
  }

  // Extract effective phrases from high performers
  if (video.retention_30s >= 75 && video.views > 1000000) {
    const phrases = extractPowerPhrases(hookText);
    dna.hooks.effective_phrases.push(...phrases);
  }

  // Track failed phrases if low performance
  if (video.retention_30s < 70 && video.views < 500000) {
    const phrases = extractPowerPhrases(hookText);
    dna.hooks.failed_phrases.push(...phrases);
  }
}

function detectHookPattern(hookText) {
  if (!hookText) return 'other';
  
  // Pattern 1: Date + Entity (في + تاريخ)
  if (/^في\s+\d{1,2}\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)/i.test(hookText)) {
    return 'date_entity_action';
  }

  // Pattern 2: Question + Answer (هل + الإجابة)
  if (/^هل\s+.+\?/.test(hookText) && /الإجابة|الاجابة|الجواب/.test(hookText)) {
    return 'question_immediate_answer';
  }

  // Pattern 3: Question only
  if (/^هل\s+/.test(hookText)) {
    return 'question_hook';
  }

  // Pattern 4: Product/Thing + Number (شيء + اللي + رقم)
  if (/اللي.+(\d+|مليون|مليار|تريليون)/.test(hookText)) {
    return 'product_number';
  }

  // Pattern 5: Big number start
  if (/^\d+\s*(مليون|مليار|تريليون|%)/.test(hookText)) {
    return 'number_lead';
  }

  // Pattern 6: How/Why start
  if (/^(كيف|لماذا|ليه|ازاي)/.test(hookText)) {
    return 'how_why_question';
  }

  return 'other';
}

function extractPowerPhrases(hookText) {
  const phrases = [];
  
  // Extract first sentence
  const firstSentence = hookText.split(/[.،؟!]/)[0];
  if (firstSentence && firstSentence.length > 10 && firstSentence.length < 100) {
    phrases.push(firstSentence.trim());
  }

  // Extract date patterns
  const dateMatch = hookText.match(/في\s+\d{1,2}\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+\d{4}/);
  if (dateMatch) {
    phrases.push(dateMatch[0]);
  }

  return phrases;
}

// ============================================
// UPDATE FORMAT
// ============================================
function updateFormat(dna, video) {
  if (video.format === 'long_form' && video.duration > 0) {
    if (!dna.format.duration_performance) {
      dna.format.duration_performance = [];
    }
    
    dna.format.duration_performance.push({
      duration: video.duration,
      views: video.views,
      retention: video.retention_30s
    });
  }
}

// ============================================
// UPDATE AUDIENCE BEHAVIOR
// ============================================
function updateAudienceBehavior(dna, video) {
  // High CTR = Click Trigger
  if (video.ctr > 6) {
    dna.audience.click_triggers.push({
      title: video.title,
      ctr: video.ctr,
      views: video.views,
      date: new Date().toISOString()
    });
  }

  // High Retention = Stay Trigger
  if (video.retention_30s > 75) {
    dna.audience.retention_triggers.push({
      title: video.title,
      hook: video.hook_text?.substring(0, 100) || '',
      retention: video.retention_30s,
      views: video.views,
      date: new Date().toISOString()
    });
  }

  // High Views = Share Trigger
  if (video.views > 2000000) {
    dna.audience.share_triggers.push({
      title: video.title,
      views: video.views,
      topics: video.topics,
      date: new Date().toISOString()
    });
  }

  // TRAP: High retention but low views (topic ceiling)
  const avgViews = calculateAvgViews(dna.topics);
  if (video.retention_30s > 74 && video.views < avgViews * 0.5 && avgViews > 0) {
    dna.audience.traps.push({
      title: video.title,
      retention: video.retention_30s,
      views: video.views,
      topics: video.topics,
      warning: 'High retention but low views - topic may have ceiling',
      date: new Date().toISOString()
    });
  }

  // Keep only last 20 of each
  dna.audience.click_triggers = dna.audience.click_triggers.slice(-20);
  dna.audience.retention_triggers = dna.audience.retention_triggers.slice(-20);
  dna.audience.share_triggers = dna.audience.share_triggers.slice(-20);
  dna.audience.traps = dna.audience.traps.slice(-10);
}

function calculateAvgViews(topics) {
  const allVideos = Object.values(topics).flatMap(t => t.videos || []);
  if (allVideos.length === 0) return 0;
  return Math.round(allVideos.reduce((sum, v) => sum + v.views, 0) / allVideos.length);
}

// ============================================
// FINALIZE DNA (Calculate averages, generate insights)
// ============================================
function finalizeDNA(dna) {
  // Calculate topic averages
  for (const topic of Object.keys(dna.topics)) {
    const t = dna.topics[topic];
    if (t.videos_count > 0) {
      t.avg_views = Math.round(t.total_views / t.videos_count);
      t.avg_retention_30s = parseFloat((t.total_retention / t.videos_count).toFixed(1));
      t.avg_ctr = parseFloat((t.total_ctr / t.videos_count).toFixed(1));
      t.avg_viewed = parseFloat((t.total_avg_viewed / t.videos_count).toFixed(1));
    }
  }

  // Calculate hook pattern averages
  for (const pattern of Object.keys(dna.hooks.patterns)) {
    const p = dna.hooks.patterns[pattern];
    if (p.usage_count > 0) {
      p.avg_retention_30s = parseFloat((p.total_retention / p.usage_count).toFixed(1));
      p.avg_views = Math.round(p.total_views / p.usage_count);
    }
    
    // Sort examples by views
    p.examples.sort((a, b) => b.views - a.views);
    // Keep top 3
    p.examples = p.examples.slice(0, 3);
  }

  // Remove duplicate effective phrases
  dna.hooks.effective_phrases = [...new Set(dna.hooks.effective_phrases)].slice(0, 20);
  dna.hooks.failed_phrases = [...new Set(dna.hooks.failed_phrases)].slice(0, 20);

  // Calculate optimal duration from top performers
  if (dna.format.duration_performance && dna.format.duration_performance.length >= 3) {
    const sorted = [...dna.format.duration_performance].sort((a, b) => b.views - a.views);
    const top5 = sorted.slice(0, 5);
    const avgDuration = top5.reduce((sum, v) => sum + v.duration, 0) / top5.length;
    
    dna.format.optimal_duration.long_form = {
      min: Math.floor(avgDuration - 3),
      max: Math.ceil(avgDuration + 3),
      unit: 'minutes',
      based_on: `Top ${top5.length} videos`
    };
  }

  // Generate insights
  generateInsights(dna);

  // Identify weak topics
  const avgViews = Object.values(dna.topics).reduce((sum, t) => sum + t.avg_views, 0) / Math.max(Object.keys(dna.topics).length, 1);
  for (const [topic, data] of Object.entries(dna.topics)) {
    if (data.avg_views < avgViews * 0.5 && data.videos_count >= 2 && avgViews > 0) {
      if (!dna.banned.weak_topics.includes(topic)) {
        dna.banned.weak_topics.push(topic);
      }
    }
  }
}

function generateInsights(dna) {
  // Best topic
  const topicsSorted = Object.entries(dna.topics).sort((a, b) => b[1].avg_views - a[1].avg_views);
  if (topicsSorted.length > 0) {
    dna.insights.key_learnings.push(
      `أفضل موضوع: ${topicsSorted[0][0]} (${topicsSorted[0][1].avg_views.toLocaleString()} مشاهدة متوسط)`
    );
  }

  // Best hook pattern
  const hooksSorted = Object.entries(dna.hooks.patterns).sort(
    (a, b) => parseFloat(b[1].avg_retention_30s || 0) - parseFloat(a[1].avg_retention_30s || 0)
  );
  if (hooksSorted.length > 0) {
    dna.insights.key_learnings.push(
      `أفضل نمط Hook: ${hooksSorted[0][0]} (${hooksSorted[0][1].avg_retention_30s}% retention)`
    );
  }

  // Traps warning
  if (dna.audience.traps.length > 0) {
    dna.insights.warnings.push(
      `⚠️ ${dna.audience.traps.length} فيديو(هات) عندها retention عالي لكن مشاهدات منخفضة - الموضوع قد يكون له سقف`
    );
  }

  // Viral triggers
  if (dna.audience.share_triggers.length > 0) {
    const viralTopics = dna.audience.share_triggers.flatMap(v => v.topics || []);
    const topicCounts = {};
    viralTopics.forEach(t => topicCounts[t] = (topicCounts[t] || 0) + 1);
    const mostViral = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostViral) {
      dna.insights.recommendations.push(
        `المواضيع الأكثر انتشاراً: ${mostViral[0]}`
      );
    }
  }
}




