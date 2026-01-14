import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';
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

    console.log('🔄 Resetting learning for show:', showId);

    // 1. Reset learning weights
    const { error: weightsError } = await supabaseAdmin
      .from('show_learning_weights')
      .delete()
      .eq('show_id', showId);

    if (weightsError) {
      console.error('❌ Error deleting learning weights:', weightsError);
      return NextResponse.json({ error: 'Failed to reset learning weights' }, { status: 500 });
    }

    // 2. Reset feedback history (this is what shows up in LearningStats)
    const { error: feedbackError } = await supabaseAdmin
      .from('recommendation_feedback')
      .delete()
      .eq('show_id', showId);

    if (feedbackError) {
      console.error('❌ Error deleting feedback history:', feedbackError);
      return NextResponse.json({ error: 'Failed to reset feedback history' }, { status: 500 });
    }

    // 3. Reset learned feedback patterns (from signalScoringService)
    const { error: patternsError } = await supabaseAdmin
      .from('signal_feedback_patterns')
      .delete()
      .eq('show_id', showId);

    if (patternsError) {
      console.error('❌ Error deleting feedback patterns:', patternsError);
      // Don't fail - patterns table might not exist yet
      console.warn('⚠️ signal_feedback_patterns table might not exist, continuing...');
    }

    console.log('✅ Learning reset complete - weights, feedback history, and patterns cleared');

    return NextResponse.json({ 
      success: true,
      message: 'Learning data has been reset'
    });

  } catch (error) {
    console.error('❌ Reset error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


