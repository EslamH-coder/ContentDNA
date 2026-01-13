import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET sources
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('showId');

  if (!showId) {
    return NextResponse.json({ error: 'showId required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('signal_sources')
      .select('*')
      .eq('show_id', showId)
      .order('name');

    if (error) throw error;

    return NextResponse.json({ success: true, sources: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST new source
export async function POST(request) {
  const body = await request.json();
  const { showId, name, url, enabled } = body;

  if (!showId || !name || !url) {
    return NextResponse.json({ error: 'showId, name, and url required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('signal_sources')
      .insert({
        show_id: showId,
        name,
        url,
        enabled: enabled !== false
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, source: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT update source
export async function PUT(request) {
  const body = await request.json();
  const { sourceId, name, url, enabled } = body;

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId required' }, { status: 400 });
  }

  try {
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (url !== undefined) updates.url = url;
    if (enabled !== undefined) updates.enabled = enabled;

    const { data, error } = await supabase
      .from('signal_sources')
      .update(updates)
      .eq('id', sourceId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, source: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE source
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get('sourceId');

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('signal_sources')
      .delete()
      .eq('id', sourceId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

