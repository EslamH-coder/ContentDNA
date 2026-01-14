import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';
import { fetchWikipediaTrends, getArticleSummary } from '@/lib/wikipediaFetcher';
import { scoreEvergreenSignals } from '@/lib/scoring/evergreenScoring';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { showId, language = 'en' } = await request.json();
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    console.log('📚 Starting Wikipedia trends fetch for show:', showId, 'language:', language);

    // DNA topics will be loaded by scoreEvergreenSignals
    console.log(`🧬 Will load DNA topics for scoring...`);

    // Fetch trends
    const trends = await fetchWikipediaTrends(language);
    
    if (trends.length === 0) {
      return NextResponse.json({ 
        error: 'No trends available',
        message: 'Wikipedia trends may not be available for this date yet'
      }, { status: 404 });
    }

    // Get existing to avoid duplicates
    const { data: existing } = await supabaseAdmin
      .from('signals')
      .select('title')
      .eq('show_id', showId)
      .eq('source_type', 'wikipedia');

    const existingTitles = new Set((existing || []).map(s => s.title.toLowerCase()));

    // Filter new trends and prepare for scoring
    const newTrends = trends
      .filter(t => !existingTitles.has(t.title.toLowerCase()))
      .map(t => ({
        ...t,
        source: 'Wikipedia Trends',
        source_type: 'wikipedia',
        views: t.views,
        rank: t.rank
      }));

    console.log(`📊 Found ${newTrends.length} new trends (${trends.length} total, ${existingTitles.size} existing)`);

    // Score using DNA-based evergreen scoring (same as RSS)
    const scored = await scoreEvergreenSignals(newTrends, showId);

    // Filter: Only import trends that match DNA (have matched_topics)
    const dnaMatchedTrends = scored.filter(t => t.matched_topics && t.matched_topics.length > 0);
    
    // Sort by DNA-based score
    dnaMatchedTrends.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // Take top 20 by DNA score
    const topTrends = dnaMatchedTrends.slice(0, 20);

    console.log(`📚 Filtered to ${topTrends.length} DNA-matching trends (from ${scored.length} total, ${dnaMatchedTrends.length} with DNA matches)`);

    // If no DNA matches, return message
    if (topTrends.length === 0) {
      return NextResponse.json({ 
        success: true,
        fetched: trends.length,
        imported: 0,
        message: 'No trending topics matched your channel DNA. Try updating your DNA keywords.',
        language,
      });
    }

    // Get summaries for top trends (limit to 10 to avoid rate limits)
    const trendsWithSummary = await Promise.all(
      topTrends.slice(0, 10).map(async (trend) => {
        try {
          const summary = await getArticleSummary(trend.titleRaw, language);
          return {
            ...trend,
            description: summary?.extract?.substring(0, 300) || `Trending on Wikipedia with ${trend.views.toLocaleString()} views`,
          };
        } catch (error) {
          console.error(`Error fetching summary for ${trend.title}:`, error);
          return {
            ...trend,
            description: `Trending on Wikipedia with ${trend.views.toLocaleString()} views`,
          };
        }
      })
    );

    // Add remaining without summary
    const remaining = topTrends.slice(10).map(t => ({
      ...t,
      description: `Trending on Wikipedia with ${t.views.toLocaleString()} views`,
    }));

    const allTrends = [...trendsWithSummary, ...remaining];

    // Insert as signals
    const signalsToInsert = allTrends.map(trend => ({
      show_id: showId,
      title: trend.title,
      description: trend.description,
      url: trend.url,
      source: 'Wikipedia Trends',
      category: 'trends',
      score: trend.score || 0,  // DNA-based score from evergreenScoring
      relevance_score: trend.score || 0,  // Same as score
      wikipedia_views: trend.views,
      is_evergreen: true,  // Wikipedia trends are research-based, often evergreen
      is_visible: true,
      status: 'new',
      source_type: 'wikipedia',
      // Store scoring breakdown in raw_data (metadata column doesn't exist)
      raw_data: {
        ...(trend.raw_data || {}),
        evergreen_scoring: {
          dna_score: trend.dna_score,
          quality_score: trend.quality_score,
          engagement_score: trend.engagement_score,
          freshness_score: trend.freshness_score,
          combined_score: trend.combined_score,
          matched_topics: trend.matched_topics || [],
          matched_topic_names: trend.matched_topic_names || [],
          dna_reasons: trend.dna_reasons || []
        }
      }
    }));

    if (signalsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('signals')
        .insert(signalsToInsert);

      if (insertError) {
        console.error('❌ Insert error:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    console.log(`✅ Imported ${signalsToInsert.length} Wikipedia trends`);

    return NextResponse.json({
      success: true,
      fetched: trends.length,
      imported: signalsToInsert.length,
      language,
    });

  } catch (error) {
    console.error('❌ Wikipedia fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

