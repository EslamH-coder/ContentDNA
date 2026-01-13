import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/supabaseServer';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Fetch competitors for a show
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
      return NextResponse.json({ error: 'showId is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('competitors')
      .select('*')
      .eq('show_id', showId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching competitors:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, competitors: data || [] });
  } catch (error) {
    console.error('Error in GET /api/competitors:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create a new competitor
export async function POST(request) {
  try {
    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { showId, name, youtube_channel_id, type, notes, tracking_enabled } = body;

    if (!showId || !name) {
      return NextResponse.json({ 
        error: 'showId and name are required' 
      }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('competitors')
      .insert({
        show_id: showId,
        name,
        youtube_channel_id: youtube_channel_id || null,
        type: type || 'direct',
        notes: notes || null,
        tracking_enabled: tracking_enabled !== undefined ? tracking_enabled : true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating competitor:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, competitor: data });
  } catch (error) {
    console.error('Error in POST /api/competitors:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update an existing competitor
export async function PUT(request) {
  try {
    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { competitorId, name, youtube_channel_id, type, notes, tracking_enabled } = body;

    if (!competitorId) {
      return NextResponse.json({ 
        error: 'competitorId is required' 
      }, { status: 400 });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (youtube_channel_id !== undefined) updateData.youtube_channel_id = youtube_channel_id;
    if (type !== undefined) updateData.type = type;
    if (notes !== undefined) updateData.notes = notes;
    if (tracking_enabled !== undefined) updateData.tracking_enabled = tracking_enabled;

    const { data, error } = await supabaseAdmin
      .from('competitors')
      .update(updateData)
      .eq('id', competitorId)
      .select()
      .single();

    if (error) {
      console.error('Error updating competitor:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, competitor: data });
  } catch (error) {
    console.error('Error in PUT /api/competitors:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete a competitor
export async function DELETE(request) {
  try {
    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const competitorId = searchParams.get('competitorId');

    if (!competitorId) {
      return NextResponse.json({ 
        error: 'competitorId is required' 
      }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('competitors')
      .delete()
      .eq('id', competitorId);

    if (error) {
      console.error('Error deleting competitor:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/competitors:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

