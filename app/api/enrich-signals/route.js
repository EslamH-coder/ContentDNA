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
  try {
    const body = await request.json();
    const { showId, limit = 20 } = body;

    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ 
        error: 'GROQ_API_KEY not configured' 
      }, { status: 500 });
    }

    // Get unenriched signals (those without audience_insight)
    const { data: signals, error } = await supabase
      .from('signals')
      .select('*')
      .eq('show_id', showId)
      .is('audience_insight', null)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    if (!signals || signals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unenriched signals found',
        enriched: 0
      });
    }

    // Get show's topics for relevance matching
    const { data: topics } = await supabase
      .from('topic_definitions')
      .select('id, topic_id, name, keywords')
      .eq('show_id', showId);

    // Enrich signals with AI
    const enrichedSignals = await enrichSignalsWithAI(signals, topics);

    // Update signals in database
    let updatedCount = 0;
    for (const signal of enrichedSignals) {
      const { error: updateError } = await supabase
        .from('signals')
        .update({
          relevance_score: signal.relevance_score,
          hook_potential: signal.hook_potential,
          matched_topic: signal.matched_topic,
          suggested_format: signal.suggested_format,
          audience_insight: signal.audience_insight,
          audience_questions: signal.audience_questions,
          pitch_suggestions: signal.pitch_suggestions,
          trending_searches: signal.trending_searches,
          score: signal.relevance_score || signal.score
        })
        .eq('id', signal.id);

      if (!updateError) {
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Enriched ${updatedCount} signals with AI insights`,
      enriched: updatedCount
    });

  } catch (error) {
    console.error('Enrich signals error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// AI Enrichment Function
async function enrichSignalsWithAI(signals, topics) {
  const enriched = [];
  
  // Process in batches of 5 to avoid rate limits
  for (let i = 0; i < signals.length; i += 5) {
    const batch = signals.slice(i, i + 5);
    
    const enrichmentPromises = batch.map(async (signal) => {
      try {
        const prompt = `Analyze this news signal for an Arabic YouTube documentary channel.

Title: ${signal.title}
Description: ${signal.description?.substring(0, 500) || 'No description'}

Available topics: ${topics?.map(t => t.name || t.topic_id).join(', ') || 'General'}

Respond in JSON format:
{
  "relevance_score": 0-100,
  "hook_potential": 0-10,
  "matched_topic": "topic name or 'other'",
  "suggested_format": "long" or "short",
  "audience_insight": {
    "title": "عنوان قصير بالعربية - لماذا يهتم الجمهور",
    "description": "شرح قصير لماذا هذا الموضوع مهم للمشاهد العربي",
    "relevance": 0-100,
    "stats": {
      "searches": estimated monthly searches (number),
      "watch_time": "estimated avg watch time like 8:30",
      "keyword_match": number of matching keywords 1-5
    }
  },
  "audience_questions": [
    "سؤال 1 بالعربية؟",
    "سؤال 2 بالعربية؟"
  ],
  "pitch_suggestions": {
    "do": [
      "اقتراح 1 بالعربية",
      "اقتراح 2 بالعربية"
    ],
    "avoid": [
      "تجنب هذا بالعربية"
    ]
  },
  "trending_searches": ["كلمة 1", "كلمة 2", "كلمة 3"]
}

IMPORTANT: Respond ONLY with valid JSON.`;

        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 800
        });

        const content = completion.choices[0]?.message?.content || '';
        
        // Parse JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const enrichment = JSON.parse(jsonMatch[0]);
          
          return {
            ...signal,
            relevance_score: enrichment.relevance_score || signal.relevance_score || 50,
            hook_potential: String(enrichment.hook_potential || signal.hook_potential || 5),
            matched_topic: enrichment.matched_topic || signal.matched_topic || 'other',
            suggested_format: enrichment.suggested_format || signal.suggested_format || 'long',
            audience_insight: enrichment.audience_insight || null,
            audience_questions: enrichment.audience_questions || null,
            pitch_suggestions: enrichment.pitch_suggestions || null,
            trending_searches: enrichment.trending_searches || null,
            score: enrichment.relevance_score || signal.score || 50
          };
        }
        
        return signal;
      } catch (aiError) {
        console.error('AI enrichment error for signal:', signal.title, aiError);
        return signal;
      }
    });

    const batchResults = await Promise.all(enrichmentPromises);
    enriched.push(...batchResults);
    
    // Small delay between batches to avoid rate limits
    if (i + 5 < signals.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return enriched;
}



