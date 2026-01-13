import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('showId');

  if (!showId) {
    return NextResponse.json({ error: 'showId required' }, { status: 400 });
  }

  try {
    // Get today's date info
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = String(today.getDate()).padStart(2, '0');
    
    // Build array of upcoming 14 days in MM-DD format
    const upcomingDates = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      upcomingDates.push(`${mm}-${dd}`);
    }

    // 1. Get upcoming anniversaries (fixed date events in next 14 days)
    let anniversaries = [];
    try {
      const { data } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('show_id', showId)
        .eq('event_type', 'fixed')
        .in('event_date', upcomingDates)
        .order('importance', { ascending: false });
      anniversaries = data || [];
    } catch (err) {
      console.log('calendar_events table not found or error:', err.message);
    }

    // 2. Get Islamic events
    let islamicEvents = [];
    try {
      const { data } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('show_id', showId)
        .eq('event_type', 'islamic')
        .order('importance', { ascending: false });
      islamicEvents = data || [];
    } catch (err) {
      console.log('Error fetching islamic events:', err.message);
    }

    // 3. Get Sports events
    let sportsEvents = [];
    try {
      const { data } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('show_id', showId)
        .eq('event_type', 'sports')
        .order('importance', { ascending: false });
      sportsEvents = data || [];
    } catch (err) {
      console.log('Error fetching sports events:', err.message);
    }

    // 4. Get Seasonal events
    let seasonalEvents = [];
    try {
      const { data } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('show_id', showId)
        .eq('event_type', 'seasonal')
        .order('importance', { ascending: false });
      seasonalEvents = data || [];
    } catch (err) {
      console.log('Error fetching seasonal events:', err.message);
    }

    // 5. Get latest news signals
    let newsSignals = [];
    try {
      const { data } = await supabase
        .from('signals')
        .select('*')
        .eq('show_id', showId)
        .order('created_at', { ascending: false })
        .limit(30);
      newsSignals = data || [];
    } catch (err) {
      console.log('Error fetching signals:', err.message);
    }

    // 6. Get idea bank
    let ideaBank = [];
    try {
      const { data } = await supabase
        .from('idea_bank')
        .select('*')
        .eq('show_id', showId)
        .in('status', ['new', 'researching', 'approved'])
        .order('priority', { ascending: false });
      ideaBank = data || [];
    } catch (err) {
      console.log('idea_bank table not found or error:', err.message);
    }

    // Process story_angles from JSONB to array
    const processEvents = (events) => {
      return (events || []).map(e => ({
        ...e,
        story_angles: Array.isArray(e.story_angles) ? e.story_angles : 
                      typeof e.story_angles === 'string' ? JSON.parse(e.story_angles) : []
      }));
    };

    return NextResponse.json({
      success: true,
      data: {
        anniversaries: processEvents(anniversaries),
        islamicEvents: processEvents(islamicEvents),
        sportsEvents: processEvents(sportsEvents),
        seasonalEvents: processEvents(seasonalEvents),
        newsSignals: newsSignals || [],
        ideaBank: ideaBank || []
      }
    });

  } catch (error) {
    console.error('Story ideas error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

