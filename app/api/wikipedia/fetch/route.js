import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';
import { fetchWikipediaTrends, getArticleSummary, calculateWikipediaScore } from '@/lib/wikipediaFetcher';
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

    // Get DNA keywords for scoring
    const { data: dnaTopics } = await supabaseAdmin
      .from('topic_definitions')
      .select('keywords')
      .eq('show_id', showId);

    const dnaKeywords = (dnaTopics || [])
      .flatMap(t => t.keywords || [])
      .filter(Boolean);

    console.log(`🧬 Loaded ${dnaKeywords.length} DNA keywords`);

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

    // Filter new trends
    const newTrends = trends.filter(t => 
      !existingTitles.has(t.title.toLowerCase())
    );

    console.log(`📊 Found ${newTrends.length} new trends (${trends.length} total, ${existingTitles.size} existing)`);

    // Score and check DNA matches
    const scored = newTrends.map(t => {
      const titleLower = t.title.toLowerCase();
      const descLower = (t.description || '').toLowerCase();
      
      // Check DNA matches
      const dnaMatches = dnaKeywords.filter(k => {
        const keyword = k.toLowerCase();
        return titleLower.includes(keyword) || descLower.includes(keyword);
      });

      return {
        ...t,
        calculatedScore: calculateWikipediaScore(t, dnaKeywords),
        dnaMatches: dnaMatches.length,
        matchedKeywords: dnaMatches,
      };
    });

    // STRICT: Only import trends that match DNA keywords
    const topTrends = scored
      .filter(t => t.dnaMatches > 0)  // Must have at least 1 DNA match
      .sort((a, b) => b.calculatedScore - a.calculatedScore)
      .slice(0, 20);

    console.log(`📚 Filtered to ${topTrends.length} DNA-matching trends (from ${scored.length} total)`);

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
      score: Math.min(trend.calculatedScore, 100),  // Cap at 100
      relevance_score: Math.min(trend.calculatedScore, 100),  // Cap at 100
      wikipedia_views: trend.views,
      is_evergreen: true,  // Wikipedia trends are research-based, often evergreen
      is_visible: true,
      status: 'new',
      source_type: 'wikipedia',
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

