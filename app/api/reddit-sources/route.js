import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - List subreddits for a show
export async function GET(request) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    const { data: sources, error } = await supabaseAdmin
      .from('reddit_sources')
      .select('*')
      .eq('show_id', showId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, sources: sources || [] });

  } catch (error) {
    console.error('❌ Error fetching reddit sources:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Add a new subreddit
export async function POST(request) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { showId, subreddit, displayName, category, minScore, minComments, timeFilter } = await request.json();
    
    if (!showId || !subreddit) {
      return NextResponse.json({ error: 'showId and subreddit required' }, { status: 400 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    // Clean subreddit name (remove r/ prefix if present)
    const cleanSubreddit = subreddit.replace(/^r\//, '').toLowerCase().trim();

    // Validate subreddit exists by fetching it
    try {
      const testUrl = `https://www.reddit.com/r/${cleanSubreddit}/about.json`;
      const testResponse = await fetch(testUrl, {
        headers: { 'User-Agent': 'ContentDNA/1.0' }
      });
      
      if (!testResponse.ok) {
        return NextResponse.json({ 
          error: `Subreddit r/${cleanSubreddit} not found or is private` 
        }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json({ 
        error: `Could not verify subreddit r/${cleanSubreddit}` 
      }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('reddit_sources')
      .insert({
        show_id: showId,
        subreddit: cleanSubreddit,
        display_name: displayName || cleanSubreddit,
        category: category || 'general',
        min_score: minScore || 100,
        min_comments: minComments || 10,
        time_filter: timeFilter || 'month',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Subreddit already added' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, source: data });

  } catch (error) {
    console.error('❌ Error adding reddit source:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Remove a subreddit
export async function DELETE(request) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('id');
    
    if (!sourceId) {
      return NextResponse.json({ error: 'source id required' }, { status: 400 });
    }

    // Get the source to verify show access
    const { data: source, error: sourceError } = await supabaseAdmin
      .from('reddit_sources')
      .select('show_id')
      .eq('id', sourceId)
      .single();

    if (sourceError || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(source.show_id, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('reddit_sources')
      .delete()
      .eq('id', sourceId);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Error deleting reddit source:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Toggle active status or update
export async function PATCH(request) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id, isActive, ...updates } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'source id required' }, { status: 400 });
    }

    // Get the source to verify show access
    const { data: source, error: sourceError } = await supabaseAdmin
      .from('reddit_sources')
      .select('show_id')
      .eq('id', id)
      .single();

    if (sourceError || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(source.show_id, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied' }, { status: 403 });
    }

    const updateData = {};
    if (isActive !== undefined) {
      updateData.is_active = isActive;
    }
    if (Object.keys(updates).length > 0) {
      Object.assign(updateData, updates);
    }

    const { data, error } = await supabaseAdmin
      .from('reddit_sources')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, source: data });

  } catch (error) {
    console.error('❌ Error updating reddit source:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


