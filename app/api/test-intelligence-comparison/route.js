/**
 * TEST API: Compare Intelligence System vs Multi-Signal Scoring
 * Fetches signals from DB and runs them through both systems for comparison
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';
import { generateRecommendations } from '@/lib/intelligence/recommendationEngineV3.js';
import { calculateIdeaScore } from '@/lib/scoring/multiSignalScoring';
import { getShowPatterns, scoreSignalByPatterns } from '@/lib/behaviorPatterns';
import { getLearnedAdjustments } from '@/lib/learning/signalEffectiveness';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
}

const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key'
);

export async function GET(request) {
  try {
    // Verify authentication
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId') || searchParams.get('show_id');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!showId) {
      return NextResponse.json({ error: 'showId is required' }, { status: 400 });
    }

    // Verify access
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied' }, { status: 403 });
    }

    console.log(`\n🔬 TEST: Comparing Intelligence System vs Multi-Signal Scoring`);
    console.log(`   Show ID: ${showId}`);
    console.log(`   Limit: ${limit} signals\n`);

    // 1. Fetch signals from database
    const { data: signals, error: signalsError } = await supabaseAdmin
      .from('signals')
      .select('*')
      .eq('show_id', showId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (signalsError) {
      throw signalsError;
    }

    if (!signals || signals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No signals found',
        comparison: [],
        stats: {
          totalSignals: 0,
          intelligenceResults: 0,
          multiSignalResults: 0
        }
      });
    }

    console.log(`📊 Found ${signals.length} signals to test\n`);

    // 2. Fetch context data for multi-signal scoring
    const { data: dnaTopics } = await supabaseAdmin
      .from('topic_definitions')
      .select('topic_id, topic_name_en, topic_name_ar, keywords_en, keywords_ar')
      .eq('show_id', showId)
      .eq('is_active', true);

    const { data: competitorVideos } = await supabaseAdmin
      .from('competitor_videos')
      .select('*, competitors(name, type)')
      .eq('show_id', showId)
      .gte('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('views', { ascending: false })
      .limit(200);

    const { data: userVideos } = await supabaseAdmin
      .from('channel_videos')
      .select('title, views, publish_date, topic_id, format')
      .eq('show_id', showId)
      .eq('format', 'Long')
      .gt('views', 0)
      .order('publish_date', { ascending: false })
      .limit(100);

    // 3. Get behavior patterns and learned weights
    const behaviorPatterns = await getShowPatterns(showId, false);
    const learnedWeights = await getLearnedAdjustments(showId, 90);

    // 4. Convert signals to RSS items format for intelligence system
    const rssItems = signals.map(signal => ({
      title: signal.title,
      description: signal.description || '',
      link: signal.url || signal.source_url || '',
      source: signal.source || 'Unknown',
      pubDate: signal.published_at || signal.created_at
    }));

    // 5. Run Intelligence System
    console.log('🤖 Running Intelligence System...');
    let intelligenceResults = [];
    try {
      const intelResult = await generateRecommendations({
        rssItems: rssItems.slice(0, 20), // Limit to 20 for performance
        manualTrends: [],
        limit: 20
      });
      intelligenceResults = intelResult.recommendations || [];
      console.log(`   ✅ Intelligence System: ${intelligenceResults.length} recommendations\n`);
    } catch (intelError) {
      console.error('   ❌ Intelligence System error:', intelError.message);
      intelligenceResults = [];
    }

    // 6. Run Multi-Signal Scoring System
    console.log('📊 Running Multi-Signal Scoring System...');
    const multiSignalResults = [];

    for (const signal of signals) {
      try {
        const scoring = await calculateIdeaScore(signal, {
          competitorVideos: competitorVideos || [],
          userVideos: userVideos || [],
          dnaTopics: dnaTopics || [],
          signalTitle: signal.title,
          signalDescription: signal.description || '',
          signalPublishedAt: signal.published_at || signal.created_at,
          signalTopicId: signal.topic_id,
          sourceUrl: signal.url || signal.source_url,
          sourceTitle: signal.source
        });

        // Add pattern matching
        let patternMatches = [];
        let patternBoost = 0;
        if (Object.keys(behaviorPatterns).length > 0) {
          try {
            const patternResult = await scoreSignalByPatterns(
              signal,
              behaviorPatterns,
              learnedWeights.patternWeights || {}
            );
            patternBoost = patternResult.totalBoost || 0;
            patternMatches = patternResult.matches || [];
          } catch (patternError) {
            console.warn(`   ⚠️ Pattern matching failed:`, patternError.message);
          }
        }

        multiSignalResults.push({
          signalId: signal.id,
          title: signal.title,
          score: scoring.score,
          dbScore: signal.score,
          scoringSignals: scoring.signals || [],
          competitorBreakdown: scoring.competitorBreakdown || {},
          dnaMatch: scoring.signals?.find(s => s.type === 'dna_match')?.data?.topics || [],
          patternMatches: patternMatches,
          patternBoost: patternBoost,
          strategicLabel: scoring.strategicLabel || null
        });
      } catch (scoreError) {
        console.warn(`   ⚠️ Scoring failed for "${signal.title?.substring(0, 40)}...":`, scoreError.message);
        multiSignalResults.push({
          signalId: signal.id,
          title: signal.title,
          error: scoreError.message
        });
      }
    }

    console.log(`   ✅ Multi-Signal Scoring: ${multiSignalResults.length} results\n`);

    // 7. Create comparison mapping
    const comparison = signals.map(signal => {
      const intelMatch = intelligenceResults.find(r => 
        r.topic?.toLowerCase().includes(signal.title?.toLowerCase().substring(0, 30)) ||
        signal.title?.toLowerCase().includes(r.topic?.toLowerCase().substring(0, 30))
      );

      const multiSignalMatch = multiSignalResults.find(r => r.signalId === signal.id);

      return {
        signal: {
          id: signal.id,
          title: signal.title,
          source: signal.source,
          publishedAt: signal.published_at || signal.created_at,
          dbScore: signal.score
        },
        intelligence: intelMatch ? {
          topic: intelMatch.topic,
          score: typeof intelMatch.score === 'object' ? (intelMatch.score.total || 0) : (intelMatch.score || 0),
          scoreBreakdown: typeof intelMatch.score === 'object' ? intelMatch.score.breakdown : null,
          recommendation: intelMatch.recommendation || intelMatch.recommendationLevel,
          evidenceStrength: intelMatch.evidenceStrength,
          evidence: intelMatch.evidence || {}
        } : null,
        multiSignal: multiSignalMatch ? {
          score: multiSignalMatch.score,
          scoringSignals: multiSignalMatch.scoringSignals,
          competitorBreakdown: multiSignalMatch.competitorBreakdown,
          dnaMatch: multiSignalMatch.dnaMatch,
          patternMatches: multiSignalMatch.patternMatches,
          patternBoost: multiSignalMatch.patternBoost,
          strategicLabel: multiSignalMatch.strategicLabel
        } : null
      };
    });

    return NextResponse.json({
      success: true,
      comparison,
      stats: {
        totalSignals: signals.length,
        intelligenceResults: intelligenceResults.length,
        multiSignalResults: multiSignalResults.length,
        matchedByIntelligence: comparison.filter(c => c.intelligence !== null).length,
        matchedByMultiSignal: comparison.filter(c => c.multiSignal !== null).length
      },
      intelligenceSystem: {
        totalRecommendations: intelligenceResults.length,
        highlyRecommended: intelligenceResults.filter(r => r.recommendation === 'HIGHLY_RECOMMENDED').length,
        recommended: intelligenceResults.filter(r => r.recommendation === 'RECOMMENDED').length,
        consider: intelligenceResults.filter(r => r.recommendation === 'CONSIDER').length
      },
      multiSignalSystem: {
        avgScore: multiSignalResults.filter(r => r.score).length > 0
          ? multiSignalResults.filter(r => r.score).reduce((sum, r) => sum + r.score, 0) / multiSignalResults.filter(r => r.score).length
          : 0,
        highScore: multiSignalResults.filter(r => r.score >= 70).length,
        mediumScore: multiSignalResults.filter(r => r.score >= 50 && r.score < 70).length,
        lowScore: multiSignalResults.filter(r => r.score < 50).length
      }
    });

  } catch (error) {
    console.error('❌ Test comparison error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
