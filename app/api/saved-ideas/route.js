import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET saved ideas (from recommendation_feedback where action = 'saved')
export async function GET(request) {
  try {
    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');

    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('recommendation_feedback')
      .select('*')
      .eq('show_id', showId)
      .eq('action', 'saved')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform to match expected format
    const ideas = (data || []).map(item => ({
      id: item.id,
      show_id: item.show_id,
      title: item.topic,
      pitch: null,
      format: item.topic_type === 'short' ? 'short' : 'long',
      source_type: item.topic_type || 'signal',
      source_id: item.recommendation_id,
      status: 'saved',
      url: item.evidence_summary?.url,
      score: item.original_score,
      created_at: item.created_at,
      updated_at: item.acted_at
    }));

    return NextResponse.json({ success: true, ideas });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Remove from saved (delete feedback entry and update signal status)
export async function DELETE(request) {
  try {
    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ideaId = searchParams.get('ideaId');

    if (!ideaId) {
      return NextResponse.json({ error: 'ideaId required' }, { status: 400 });
    }

    // First get the feedback entry to find the signal ID
    const { data: feedback, error: fetchError } = await supabaseAdmin
      .from('recommendation_feedback')
      .select('recommendation_id')
      .eq('id', ideaId)
      .single();

    if (fetchError) throw fetchError;

    // Delete the feedback entry
    const { error: deleteError } = await supabaseAdmin
      .from('recommendation_feedback')
      .delete()
      .eq('id', ideaId);

    if (deleteError) throw deleteError;

    // Also update signal status back to 'new' if recommendation_id is a signal ID
    if (feedback?.recommendation_id) {
      try {
        const signalId = typeof feedback.recommendation_id === 'string' 
          ? parseInt(feedback.recommendation_id, 10) 
          : feedback.recommendation_id;
        
        if (!isNaN(signalId)) {
          await supabaseAdmin
            .from('signals')
            .update({ 
              status: 'new',
              updated_at: new Date().toISOString()
            })
            .eq('id', signalId);
        }
      } catch (signalUpdateError) {
        console.error('⚠️ Could not update signal status:', signalUpdateError);
        // Don't fail the request if signal update fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update saved idea status
export async function PUT(request) {
  try {
    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { ideaId, status, action } = body;

    if (!ideaId) {
      return NextResponse.json({ error: 'ideaId required' }, { status: 400 });
    }

    const updates = {};
    if (status) updates.action = status;
    if (action) updates.action = action;

    const { error } = await supabaseAdmin
      .from('recommendation_feedback')
      .update(updates)
      .eq('id', ideaId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
