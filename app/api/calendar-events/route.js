import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET calendar events
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('showId');
  const eventType = searchParams.get('type'); // 'fixed', 'islamic', 'sports', 'seasonal'

  if (!showId) {
    return NextResponse.json({ error: 'showId required' }, { status: 400 });
  }

  try {
    let query = supabase
      .from('calendar_events')
      .select('*')
      .eq('show_id', showId)
      .order('importance', { ascending: false });

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, events: data });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST new calendar event
export async function POST(request) {
  const body = await request.json();
  const { 
    showId, event_date, event_year, title_ar, title_en, 
    category, event_type, importance, gulf_relevance, 
    story_angles, hijri_month, hijri_day 
  } = body;

  if (!showId || !title_ar) {
    return NextResponse.json({ error: 'showId and title_ar required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        show_id: showId,
        event_date,
        event_year,
        title_ar,
        title_en,
        category,
        event_type: event_type || 'fixed',
        importance: importance || 5,
        gulf_relevance: gulf_relevance || 5,
        story_angles,
        hijri_month,
        hijri_day
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, event: data });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT update calendar event
export async function PUT(request) {
  const body = await request.json();
  const { eventId, ...updates } = body;

  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, event: data });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE calendar event
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

