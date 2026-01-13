import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import Groq from 'groq-sdk';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function POST(request) {
  try {
    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { showId, limit = 10 } = await request.json();

    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    console.log(`🧠 Smart Enrich: Starting for show ${showId}`);
    // STEP 1: Get Channel DNA
    const channelDNA = await getChannelDNA(showId);
    console.log(`📊 Channel DNA loaded: ${channelDNA.topics.length} topics`);

    // STEP 2: Get unenriched signals (skip evergreen/Reddit signals - they don't need AI enrichment)
    const { data: signals, error: signalsError } = await supabaseAdmin
      .from('signals')
      .select('*')
      .eq('show_id', showId)
      .eq('is_evergreen', false)  // Skip Reddit signals
      .is('audience_insight', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (signalsError) throw signalsError;

    if (!signals || signals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No signals to enrich',
        enriched: 0
      });
    }

    console.log(`📰 Found ${signals.length} unenriched signals`);

    // STEP 3: Pre-score signals using DNA (no AI, instant)
    const scoredSignals = signals.map(signal => ({
      ...signal,
      dna_score: calculateDNAScore(signal, channelDNA)
    }));

    // Sort by DNA score and take top N
    const topSignals = scoredSignals
      .sort((a, b) => b.dna_score - a.dna_score)
      .slice(0, limit);

    console.log(`🎯 Top ${topSignals.length} signals selected for enrichment`);
    console.log(`   Scores: ${topSignals.map(s => s.dna_score).join(', ')}`);

    // STEP 4: Enrich top signals with AI (includes DNA context)
    let enrichedCount = 0;
    const results = [];

    for (const signal of topSignals) {
      try {
        const enrichment = await enrichWithDNA(signal, channelDNA);
        
        // Ensure hook_potential is a number (handle string conversion if needed)
        const hookPotential = typeof enrichment.hook_potential === 'string' 
          ? parseFloat(enrichment.hook_potential) || 5
          : (enrichment.hook_potential || 5);

        // Update signal in database
        const { error: updateError } = await supabaseAdmin
          .from('signals')
          .update({
            relevance_score: enrichment.relevance_score,
            hook_potential: String(hookPotential), // Store as string to match schema
            matched_topic: enrichment.matched_topic,
            suggested_format: enrichment.suggested_format,
            audience_insight: enrichment.audience_insight,
            audience_questions: enrichment.audience_questions,
            pitch_suggestions: enrichment.pitch_suggestions,
            trending_searches: enrichment.trending_searches,
            score: enrichment.relevance_score
          })
          .eq('id', signal.id);

        if (!updateError) {
          enrichedCount++;
          results.push({
            id: signal.id,
            title: signal.title.substring(0, 50),
            dna_score: signal.dna_score,
            relevance_score: enrichment.relevance_score,
            matched_topic: enrichment.matched_topic
          });
        }

        // Rate limit - wait between requests
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (aiError) {
        console.error(`❌ Error enriching signal ${signal.id}:`, aiError.message);
      }
    }

    console.log(`✅ Enriched ${enrichedCount} signals`);

    return NextResponse.json({
      success: true,
      message: `Enriched ${enrichedCount} of ${topSignals.length} top signals`,
      enriched: enrichedCount,
      results
    });

  } catch (error) {
    console.error('Smart enrich error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Get Channel DNA data
async function getChannelDNA(showId) {
  // Get topic definitions
  const { data: topics } = await supabaseAdmin
    .from('topic_definitions')
    .select('*')
    .eq('show_id', showId)
    .eq('is_active', true);

  // Get topic performance from videos
  const { data: performance } = await supabaseAdmin
    .from('channel_videos')
    .select('topic_id, views')
    .eq('show_id', showId)
    .not('topic_id', 'is', null);

  // Calculate avg views per topic
  const topicStats = {};
  for (const video of performance || []) {
    if (!topicStats[video.topic_id]) {
      topicStats[video.topic_id] = { total: 0, count: 0 };
    }
    topicStats[video.topic_id].total += video.views || 0;
    topicStats[video.topic_id].count++;
  }

  const topicPerformance = Object.entries(topicStats)
    .map(([topic_id, stats]) => ({
      topic_id,
      avg_views: stats.count > 0 ? Math.round(stats.total / stats.count) : 0,
      video_count: stats.count
    }))
    .sort((a, b) => b.avg_views - a.avg_views);

  // Get show info
  const { data: show } = await supabaseAdmin
    .from('shows')
    .select('name')
    .eq('id', showId)
    .single();

  return {
    showName: show?.name || 'Channel',
    topics: topics || [],
    topicPerformance,
    topTopics: topicPerformance.slice(0, 5)
  };
}

// Calculate DNA score without AI (instant)
function calculateDNAScore(signal, channelDNA) {
  const title = (signal.title || '').toLowerCase();
  const description = (signal.description || '').toLowerCase();
  const text = title + ' ' + description;

  let score = 30; // Base score
  let matchedTopic = null;
  let keywordMatches = 0;

  // Check each topic's keywords
  for (const topic of channelDNA.topics) {
    const keywords = topic.keywords || [];
    let topicMatches = 0;

    for (const keyword of keywords) {
      const kw = typeof keyword === 'string' ? keyword.toLowerCase() : String(keyword).toLowerCase();
      if (text.includes(kw)) {
        topicMatches++;
        keywordMatches++;
      }
    }

    // Also check topic names
    const topicNameAr = (topic.name_ar || '').toLowerCase();
    const topicName = (topic.name || '').toLowerCase();
    if (text.includes(topicNameAr) || text.includes(topicName)) {
      topicMatches++;
      keywordMatches++;
    }

    if (topicMatches > 0 && !matchedTopic) {
      matchedTopic = topic.topic_id;
      
      // Boost score based on topic performance
      const topicPerf = channelDNA.topicPerformance.find(t => t.topic_id === topic.topic_id);
      if (topicPerf) {
        const rank = channelDNA.topicPerformance.indexOf(topicPerf);
        if (rank === 0) score += 40; // Top performing topic
        else if (rank < 3) score += 30; // Top 3
        else if (rank < 5) score += 20; // Top 5
        else score += 10;
      } else {
        score += 15; // Topic exists but no performance data
      }
    }
  }

  // Bonus for multiple keyword matches
  score += Math.min(keywordMatches * 5, 20);

  // Cap at 100
  return Math.min(score, 100);
}

// Enrich signal with AI using DNA context
async function enrichWithDNA(signal, channelDNA) {
  // Build top topics summary
  const topTopicsSummary = channelDNA.topTopics
    .map((t, i) => {
      const topicDef = channelDNA.topics.find(td => td.topic_id === t.topic_id);
      const name = topicDef?.name_ar || topicDef?.name || t.topic_id;
      return `${i + 1}. ${name}: ${t.avg_views.toLocaleString()} avg views (${t.video_count} videos)`;
    })
    .join('\n');

  // Build topics with keywords
  const topicsWithKeywords = channelDNA.topics
    .slice(0, 10)
    .map(t => {
      const keywords = t.keywords || [];
      const keywordList = Array.isArray(keywords) 
        ? keywords.slice(0, 5).join(', ')
        : String(keywords).split(',').slice(0, 5).join(', ');
      return `- ${t.name_ar || t.name || t.topic_id} [${t.topic_id}]: ${keywordList}`;
    })
    .join('\n');

  const prompt = `You are a YouTube content strategist for "${channelDNA.showName}" - an Arabic documentary/explainer channel.

## CHANNEL DNA - What Performs Best:
${topTopicsSummary}

## CHANNEL TOPICS & KEYWORDS:
${topTopicsSummary ? topicsWithKeywords : 'No topics defined yet'}

## SIGNAL TO ANALYZE:
Title: ${signal.title}
Description: ${signal.description?.substring(0, 400) || 'No description'}
Source: ${signal.source || 'News'}

## YOUR TASK:
Analyze this signal and score it based on how well it matches THIS CHANNEL's proven success patterns.

## SCORING RULES (BE STRICT):
- 90-100: PERFECT match for top-performing topics, high viral potential
- 75-89: STRONG match, clear audience interest
- 60-74: MODERATE match, needs good angle
- 40-59: WEAK match, tangential to channel focus
- Below 40: POOR fit, doesn't match channel DNA

## RESPOND IN THIS EXACT JSON FORMAT:
{
  "relevance_score": <number 0-100 based on DNA match - BE STRICT>,
  "hook_potential": <number 0-10>,
  "matched_topic": "<exact topic_id from channel topics, or 'other_stories'>",
  "dna_match_reason": "<1 sentence in Arabic: why this matches or doesn't match channel>",
  "suggested_format": "long",
  "audience_insight": {
    "title": "<compelling reason why audience cares - in Arabic>",
    "description": "<1-2 sentences explaining personal impact on viewer - in Arabic>",
    "relevance": <number 0-100>,
    "stats": {
      "searches": <realistic monthly search estimate 1000-500000>,
      "watch_time": "<estimated like '12:30' for long-form>",
      "keyword_match": <1-5 based on topic alignment>
    }
  },
  "audience_questions": [
    "<question viewers would ask - in Arabic>",
    "<another question - in Arabic>"
  ],
  "pitch_suggestions": {
    "do": [
      "<specific actionable suggestion - in Arabic>",
      "<another suggestion - in Arabic>"
    ],
    "avoid": [
      "<what NOT to do - in Arabic>"
    ]
  },
  "trending_searches": ["<Arabic keyword>", "<Arabic keyword>", "<Arabic keyword>"]
}

IMPORTANT:
- matched_topic MUST be one of the exact topic_ids listed above, or "other_stories"
- All Arabic text should be natural and engaging
- Be STRICT with scoring - only high scores for genuine DNA matches
- Respond ONLY with valid JSON, no markdown`;

  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠️ GROQ_API_KEY not configured, returning default enrichment');
    return {
      relevance_score: 50,
      hook_potential: 5,
      matched_topic: 'other_stories',
      suggested_format: 'long',
      audience_insight: null,
      audience_questions: null,
      pitch_suggestions: null,
      trending_searches: null
    };
  }

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1000
  });

  const content = completion.choices[0]?.message?.content || '';
  
  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      // Ensure hook_potential exists
      if (parsed.hook_potential === undefined || parsed.hook_potential === null) {
        console.warn('⚠️ AI response missing hook_potential, using default 5');
        parsed.hook_potential = 5;
      }
      return parsed;
    } catch (e) {
      console.error('JSON parse error:', e);
      console.error('Content:', content.substring(0, 200));
    }
  }

  // Default response if parsing fails
  console.warn('⚠️ Failed to parse AI response, using defaults');
  return {
    relevance_score: 50,
    hook_potential: 5,
    matched_topic: 'other_stories',
    suggested_format: 'long',
    audience_insight: null,
    audience_questions: null,
    pitch_suggestions: null,
    trending_searches: null
  };
}

