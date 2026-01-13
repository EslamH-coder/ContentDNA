import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET all ideas
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('showId');

  if (!showId) {
    return NextResponse.json({ error: 'showId required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('idea_bank')
      .select('*')
      .eq('show_id', showId)
      .order('priority', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, ideas: data });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST new idea
export async function POST(request) {
  const body = await request.json();
  const { showId, title, description, priority, source, suggested_topic_id } = body;

  if (!showId || !title) {
    return NextResponse.json({ error: 'showId and title required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('idea_bank')
      .insert({
        show_id: showId,
        title,
        description,
        priority: priority || 5,
        source: source || 'team',
        suggested_topic_id,
        status: 'new'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, idea: data });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT update idea status
export async function PUT(request) {
  const body = await request.json();
  const { ideaId, status, priority, notes } = body;

  if (!ideaId) {
    return NextResponse.json({ error: 'ideaId required' }, { status: 400 });
  }

  try {
    const updates = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabase
      .from('idea_bank')
      .update(updates)
      .eq('id', ideaId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, idea: data });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE idea
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const ideaId = searchParams.get('ideaId');

  if (!ideaId) {
    return NextResponse.json({ error: 'ideaId required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('idea_bank')
      .delete()
      .eq('id', ideaId);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

