import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's show
    const { data: userShow, error } = await supabase
      .from('user_shows')
      .select(`
        show_id,
        role,
        shows (
          id,
          name,
          description,
          target_audience,
          content_style,
          language,
          tone
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (error || !userShow) {
      return NextResponse.json({ error: 'No show found for user' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      show: {
        id: userShow.show_id,
        ...userShow.shows,
      },
      role: userShow.role,
    });

  } catch (error) {
    console.error('Error fetching current show:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
