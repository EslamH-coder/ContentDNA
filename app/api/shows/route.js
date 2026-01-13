import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { name, youtube_account_id, playlist_id, playlist_title } = await request.json();
    
    const { data: show, error } = await supabaseAdmin
      .from('shows')
      .insert({
        name,
        youtube_account_id,
        playlist_id,
        playlist_title,
        onboarding_status: 'connecting'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Link the show to the user who created it
    const { error: linkError } = await supabaseAdmin
      .from('user_shows')
      .insert({
        user_id: user.id,
        show_id: show.id,
        role: 'owner'
      });
    
    // If user_shows table doesn't exist, just log a warning
    if (linkError && !linkError.message?.includes('does not exist') && !linkError.code === 'PGRST116') {
      console.warn('Could not link show to user:', linkError);
    }
    
    return NextResponse.json({ success: true, show });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    // Verify user is authenticated using server-side helper
    // Pass the request object so it can check headers/cookies
    const { user, error: authError, supabase } = await getAuthUser(request);
    
    if (authError || !user) {
      console.log('❌ /api/shows - Not authenticated:', authError?.message || 'No user');
      console.log('💡 Tip: Session may be in localStorage. Client should send session token in request.');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('✅ /api/shows - User authenticated:', user.email);

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');
    
    // If showId provided, return single show (with access verification)
    if (showId) {
      // Verify user has access to this show
      const { authorized, error: accessError } = await verifyShowAccess(showId, request);
      
      if (!authorized) {
        return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
      }
      
      const { data: show, error } = await supabaseAdmin
        .from('shows')
        .select('*, youtube_accounts(*)')
        .eq('id', showId)
        .single();
      
      if (error) throw error;
      
      return NextResponse.json({ success: true, show });
    }
    
    // Otherwise return only shows the user has access to
    // Join with user_shows table to filter by user
    // Use the authenticated supabase client (with user context) if available, otherwise use admin
    const clientToUse = supabase || supabaseAdmin;
    
    const { data: userShows, error: userShowsError } = await clientToUse
      .from('user_shows')
      .select(`
        role,
        show:shows (
          *,
          youtube_accounts(*)
        )
      `)
      .eq('user_id', user.id);
    
    // If user_shows table doesn't exist, fall back to all shows (backward compatibility)
    if (userShowsError && (userShowsError.message?.includes('does not exist') || userShowsError.code === 'PGRST116')) {
      console.warn('user_shows table not found, returning all shows for backward compatibility');
      const { data: shows, error } = await supabaseAdmin
        .from('shows')
        .select('*, youtube_accounts(*)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return NextResponse.json({ success: true, shows });
    }
    
    if (userShowsError) throw userShowsError;
    
    // Flatten the response
    const shows = (userShows || [])
      .filter(us => us.show) // Filter out any null shows
      .map(us => ({
        ...us.show,
        role: us.role
      }))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    
    console.log(`✅ /api/shows - Found ${shows.length} shows for user`);
    
    return NextResponse.json({ success: true, shows });
  } catch (error) {
    console.error('Error in GET /api/shows:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

