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

    // Reset learning weights
    const { error: weightsError } = await supabaseAdmin
      .from('show_learning_weights')
      .delete()
      .eq('show_id', showId);

    if (weightsError) {
      console.error('❌ Error deleting learning weights:', weightsError);
      return NextResponse.json({ error: 'Failed to reset learning weights' }, { status: 500 });
    }

    // Optionally reset feedback history (uncomment if you want to reset feedback too)
    // const { error: feedbackError } = await supabaseAdmin
    //   .from('signal_feedback')
    //   .delete()
    //   .eq('show_id', showId);

    // if (feedbackError) {
    //   console.error('❌ Error deleting feedback:', feedbackError);
    //   return NextResponse.json({ error: 'Failed to reset feedback history' }, { status: 500 });
    // }

    console.log('✅ Learning reset complete');

    return NextResponse.json({ 
      success: true,
      message: 'Learning data has been reset'
    });

  } catch (error) {
    console.error('❌ Reset error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


