/**
 * Re-score Evergreen Signals Endpoint
 * Re-scores existing Reddit and Wikipedia signals using DNA-based scoring
 * 
 * This fixes signals that were scored with old flat scoring (Reddit: 98-100, Wikipedia: 68)
 * and re-scores them using proper DNA matching (target: 55-75 range)
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';
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

    const { showId } = await request.json();
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    console.log(`📊 Starting re-scoring for show: ${showId}`);

    // Get all evergreen signals (Reddit and Wikipedia)
    const { data: signals, error: fetchError } = await supabaseAdmin
      .from('signals')
      .select('*')
      .eq('show_id', showId)
      .in('source_type', ['reddit', 'wikipedia']);

    if (fetchError) {
      console.error('❌ Error fetching signals:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!signals || signals.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No evergreen signals found to re-score',
        rescored: 0,
        avgScore: 0
      });
    }

    console.log(`📊 Found ${signals.length} evergreen signals to re-score`);

    // Re-score with DNA-based scoring
    const rescored = await scoreEvergreenSignals(signals, showId);

    // Calculate stats before update
    const avgScoreBefore = signals.reduce((sum, s) => sum + (s.score || 0), 0) / signals.length;
    const avgScoreAfter = rescored.reduce((sum, s) => sum + (s.score || 0), 0) / rescored.length;
    const avgDnaScore = rescored.reduce((sum, s) => sum + (s.dna_score || 0), 0) / rescored.length;
    const dnaMatched = rescored.filter(s => s.matched_topics && s.matched_topics.length > 0).length;

    console.log(`📊 Re-scoring stats:`);
    console.log(`   Before: avg score = ${avgScoreBefore.toFixed(1)}`);
    console.log(`   After: avg score = ${avgScoreAfter.toFixed(1)}`);
    console.log(`   DNA matched: ${dnaMatched}/${signals.length}`);

    // Update database with new scores
    let updated = 0;
    let errors = 0;

    for (const signal of rescored) {
      try {
        const updateData = {
          score: signal.score || 0,
          relevance_score: signal.score || 0,
          // Store scoring breakdown in raw_data (metadata column doesn't exist)
          raw_data: {
            ...(signal.raw_data || {}),
            evergreen_scoring: {
              dna_score: signal.dna_score,
              quality_score: signal.quality_score,
              engagement_score: signal.engagement_score,
              freshness_score: signal.freshness_score,
              combined_score: signal.combined_score,
              matched_topics: signal.matched_topics || [],
              matched_topic_names: signal.matched_topic_names || [],
              dna_reasons: signal.dna_reasons || []
            }
          }
        };

        const { error: updateError } = await supabaseAdmin
          .from('signals')
          .update(updateData)
          .eq('id', signal.id);

        if (updateError) {
          console.error(`❌ Error updating signal ${signal.id}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`❌ Exception updating signal ${signal.id}:`, err);
        errors++;
      }
    }

    console.log(`✅ Re-scoring complete: ${updated} updated, ${errors} errors`);

    return NextResponse.json({
      success: true,
      rescored: updated,
      errors,
      stats: {
        avgScoreBefore: Math.round(avgScoreBefore * 10) / 10,
        avgScoreAfter: Math.round(avgScoreAfter * 10) / 10,
        avgDnaScore: Math.round(avgDnaScore * 10) / 10,
        dnaMatched: `${dnaMatched}/${signals.length}`,
        dnaMatchRate: Math.round((dnaMatched / signals.length) * 100)
      },
      message: `Re-scored ${updated} evergreen signals. Avg score: ${avgScoreBefore.toFixed(1)} → ${avgScoreAfter.toFixed(1)}`
    });

  } catch (error) {
    console.error('❌ Re-scoring error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
