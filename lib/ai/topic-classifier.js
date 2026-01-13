import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Generate topics from video titles
export async function generateTopicsFromTitles(showId, titles) {
  const titlesText = titles.slice(0, 100).map((t, i) => `${i + 1}. ${t}`).join('\n');
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Analyze these YouTube video titles and suggest 10-15 topic categories that best organize this content.

VIDEO TITLES:
${titlesText}

Return a JSON array with this structure:
[
  {
    "topic_id": "snake_case_id",
    "name_en": "English Name",
    "name_ar": "Arabic Name",
    "keywords": ["keyword1", "keyword2", "كلمة1", "كلمة2"],
    "description": "Brief description of what this topic covers"
  }
]

Guidelines:
- Create specific, meaningful categories (not too broad)
- Include both English and Arabic keywords
- topic_id should be lowercase with underscores
- Ensure topics cover at least 80% of the videos
- Add an "other_misc" category for outliers

Return ONLY valid JSON array, no markdown or explanation.`
    }]
  });

  const content = response.content[0]?.text || '[]';
  
  try {
    const cleanJson = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch {
    console.error('Failed to parse topics:', content);
    return [];
  }
}

// Classify a single video into topics
export async function classifyVideo(video, topics) {
  const topicsList = topics.map(t => `- ${t.topic_id}: ${t.name_en} (${t.name_ar})`).join('\n');
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Classify this YouTube video into one of the topics below.

VIDEO:
Title: ${video.title}
Description: ${(video.description || '').substring(0, 500)}
${video.hook_text ? `Hook: ${video.hook_text}` : ''}

AVAILABLE TOPICS:
${topicsList}

Also extract:
1. entities: Key people, companies, countries mentioned (as JSON array)
2. key_numbers: Any significant numbers/statistics mentioned
3. content_archetype: One of [explainer, news_reaction, analysis, comparison, prediction, story, tutorial, opinion]
4. chapters_beats: Suggested narrative structure (e.g., "Hook → Context → Analysis → Conclusion")

Return JSON:
{
  "topic_id": "chosen_topic_id",
  "confidence": 0.0-1.0,
  "entities": ["entity1", "entity2"],
  "key_numbers": "e.g., $50 billion, 30%",
  "content_archetype": "archetype",
  "chapters_beats": "narrative structure"
}

Return ONLY valid JSON.`
    }]
  });

  const content = response.content[0]?.text || '{}';
  
  try {
    const cleanJson = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch {
    return {
      topic_id: 'other_misc',
      confidence: 0.5,
      entities: [],
      key_numbers: '',
      content_archetype: 'analysis',
      chapters_beats: ''
    };
  }
}

// Batch classify videos
export async function batchClassifyVideos(videos, topics, onProgress) {
  const results = [];
  
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const classification = await classifyVideo(video, topics);
    
    results.push({
      video_id: video.video_id,
      ...classification
    });
    
    if (onProgress) {
      onProgress(Math.round((i + 1) / videos.length * 100), i + 1, videos.length);
    }
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 200));
  }
  
  return results;
}

// Calculate performance hints based on ORGANIC views (not total)
export function calculatePerformanceHints(videos, useOrganic = true) {
  // Separate Long and Shorts for fair comparison
  const longVideos = videos.filter(v => v.format === 'Long');
  const shortsVideos = videos.filter(v => v.format === 'Shorts');
  
  // Calculate averages for Long format (using organic)
  const longAvg7Organic = longVideos.length > 0 
    ? longVideos.reduce((sum, v) => sum + (v.views_7_days_organic || 0), 0) / longVideos.length 
    : 0;
  const longAvg30Organic = longVideos.length > 0 
    ? longVideos.reduce((sum, v) => sum + (v.views_30_days_organic || 0), 0) / longVideos.length 
    : 0;
  const longAvgOrganic = longVideos.length > 0 
    ? longVideos.reduce((sum, v) => sum + (v.views_organic || 0), 0) / longVideos.length 
    : 0;
  
  // Calculate averages for Shorts format
  const shortsAvg7Organic = shortsVideos.length > 0 
    ? shortsVideos.reduce((sum, v) => sum + (v.views_7_days_organic || v.views_7_days || 0), 0) / shortsVideos.length 
    : 0;
  const shortsAvg30Organic = shortsVideos.length > 0 
    ? shortsVideos.reduce((sum, v) => sum + (v.views_30_days_organic || v.views_30_days || 0), 0) / shortsVideos.length 
    : 0;
  const shortsAvgOrganic = shortsVideos.length > 0 
    ? shortsVideos.reduce((sum, v) => sum + (v.views_organic || v.views || 0), 0) / shortsVideos.length 
    : 0;
  
  console.log('Performance calculation stats:');
  console.log(`Long videos: ${longVideos.length}, Avg 7D Organic: ${Math.round(longAvg7Organic)}, Avg 30D Organic: ${Math.round(longAvg30Organic)}`);
  console.log(`Shorts videos: ${shortsVideos.length}, Avg 7D Organic: ${Math.round(shortsAvg7Organic)}, Avg 30D Organic: ${Math.round(shortsAvg30Organic)}`);
  
  return videos.map(video => {
    let hint = 'Average';
    
    // Select the right averages based on format
    const isLong = video.format === 'Long';
    const avg7 = isLong ? longAvg7Organic : shortsAvg7Organic;
    const avg30 = isLong ? longAvg30Organic : shortsAvg30Organic;
    const avgTotal = isLong ? longAvgOrganic : shortsAvgOrganic;
    
    // Get video's organic views
    const video7Organic = video.views_7_days_organic || video.views_7_days || 0;
    const video30Organic = video.views_30_days_organic || video.views_30_days || 0;
    const videoTotalOrganic = video.views_organic || video.views || 0;
    
    // Calculate performance based on organic views
    // Priority: 7-day → 30-day → total
    if (video7Organic > 0 && avg7 > 0) {
      if (video7Organic > avg7 * 1.3) hint = 'Overperforming';
      else if (video7Organic < avg7 * 0.7) hint = 'Underperforming';
    }
    else if (video30Organic > 0 && avg30 > 0) {
      if (video30Organic > avg30 * 1.3) hint = 'Overperforming';
      else if (video30Organic < avg30 * 0.7) hint = 'Underperforming';
    }
    else if (videoTotalOrganic > 0 && avgTotal > 0) {
      if (videoTotalOrganic > avgTotal * 1.3) hint = 'Overperforming';
      else if (videoTotalOrganic < avgTotal * 0.7) hint = 'Underperforming';
    }
    
    // Calculate viral score (how fast it got views organically)
    const viralScore = video30Organic > 0 
      ? Math.min(100, Math.round((video7Organic / video30Organic) * 100))
      : 0;
    
    // Calculate evergreen score (organic views keep coming after 30 days)
    const evergreenScore = video.views_organic > 0 && video30Organic > 0
      ? Math.min(100, Math.round(((video.views_organic - video30Organic) / video.views_organic) * 100))
      : 0;
    
    return {
      video_id: video.video_id,
      performance_hint: hint,
      viral_score: viralScore,
      evergreen_score: evergreenScore,
      // Debug info
      _debug: {
        format: video.format,
        views_7d_organic: video7Organic,
        views_30d_organic: video30Organic,
        views_total_organic: videoTotalOrganic,
        ad_percentage: video.ad_percentage || 0,
        avg_7d_used: Math.round(avg7),
        avg_30d_used: Math.round(avg30)
      }
    };
  });
}

