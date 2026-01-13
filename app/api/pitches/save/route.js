import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';

export async function POST(request) {
  try {
    const { user, supabase } = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { signalId, showId, content, pitchType } = await request.json();
    
    if (!signalId || !content) {
      return NextResponse.json({ error: 'signalId and content required' }, { status: 400 });
    }

    // Upsert pitch (update if exists, insert if not)
    const { data, error } = await supabase
      .from('pitches')
      .upsert({
        signal_id: signalId,
        show_id: showId,
        content,
        pitch_type: pitchType || 'news',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'signal_id',
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Pitch saved for signal:', signalId);

    return NextResponse.json({ success: true, pitch: data });

  } catch (error) {
    console.error('❌ Save pitch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
