import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    // Get all pitches for this show, join with signals to get titles
    const { data: pitches, error } = await supabase
      .from('pitches')
      .select(`
        *,
        signals:signal_id (
          id,
          title,
          url,
          source
        )
      `)
      .eq('show_id', showId)
      .order('updated_at', { ascending: false });

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, pitches: [] });
      }
      throw error;
    }

    // Format pitches with signal info
    const formattedPitches = pitches.map(pitch => ({
      id: pitch.id,
      signal_id: pitch.signal_id,
      show_id: pitch.show_id,
      pitch_type: pitch.pitch_type,
      content: pitch.content,
      created_at: pitch.created_at,
      updated_at: pitch.updated_at,
      source_title: pitch.signals?.title || 'Unknown',
      source_type: 'signal',
      video_title: pitch.signals?.title || 'Unknown',
    }));

    return NextResponse.json({ 
      success: true, 
      pitches: formattedPitches 
    });

  } catch (error) {
    console.error('Error fetching pitches:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
