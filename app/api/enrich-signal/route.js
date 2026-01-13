import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function POST(request) {
  const { signalId, showId } = await request.json();

  if (!signalId) {
    return NextResponse.json({ error: 'signalId required' }, { status: 400 });
  }

  try {
    // Get the signal
    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .select('*')
      .eq('id', signalId)
      .single();

    if (signalError || !signal) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    }

    // Allow manual enrichment of evergreen signals (user explicitly requested it)
    const targetShowId = showId || signal.show_id;

    // Get Channel DNA
    const channelDNA = await getChannelDNA(targetShowId);

    // Enrich with DNA context
    const enrichment = await enrichWithDNA(signal, channelDNA);

    // Ensure hook_potential is a number (handle string conversion if needed)
    const hookPotential = typeof enrichment.hook_potential === 'string' 
      ? parseFloat(enrichment.hook_potential) || 5
      : (enrichment.hook_potential || 5);

    // Update signal
    const { data: updated, error: updateError } = await supabase
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
      .eq('id', signalId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      signal: updated
    });

  } catch (error) {
    console.error('Enrich signal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Get Channel DNA data
async function getChannelDNA(showId) {
  const { data: topics } = await supabase
    .from('topic_definitions')
    .select('*')
    .eq('show_id', showId)
    .eq('is_active', true);

  const { data: performance } = await supabase
    .from('channel_videos')
    .select('topic_id, views')
    .eq('show_id', showId)
    .not('topic_id', 'is', null);

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

  const { data: show } = await supabase
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

// Enrich signal with AI using DNA context
async function enrichWithDNA(signal, channelDNA) {
  const topTopicsSummary = channelDNA.topTopics
    .map((t, i) => {
      const topicDef = channelDNA.topics.find(td => td.topic_id === t.topic_id);
      const name = topicDef?.name_ar || topicDef?.name || t.topic_id;
      return `${i + 1}. ${name}: ${t.avg_views.toLocaleString()} avg views`;
    })
    .join('\n');

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
${topTopicsSummary || 'No performance data yet'}

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

IMPORTANT: Respond ONLY with valid JSON`;

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
