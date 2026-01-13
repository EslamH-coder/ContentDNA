import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';

export async function GET(request, { params }) {
  try {
    const { user, supabase } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { showId } = params;

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    const { data: show, error } = await supabase
      .from('shows')
      .select('*')
      .eq('id', showId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Show not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, show });
  } catch (error) {
    console.error('Error fetching show:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { user, supabase } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { showId } = params;
    const updates = await request.json();

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    // Only allow updating specific fields
    const allowedFields = ['name', 'description', 'target_audience', 'content_style', 'language', 'tone'];
    const safeUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        safeUpdates[field] = updates[field];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: shows, error } = await supabase
      .from('shows')
      .update(safeUpdates)
      .eq('id', showId)
      .select();

    if (error) {
      console.error('Supabase update error:', error);
      throw error;
    }

    if (!shows || shows.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }

    const show = shows[0];
    console.log(`✅ Updated show profile for ${showId}`);

    return NextResponse.json({ success: true, show });
  } catch (error) {
    console.error('Error updating show:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

