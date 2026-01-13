import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';

// GET - List skip patterns for a show
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

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    const { data: patterns, error } = await supabase
      .from('skip_patterns')
      .select('*')
      .eq('show_id', showId)
      .order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist, return empty array (backward compatibility)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ patterns: [] });
      }
      throw error;
    }

    return NextResponse.json({ success: true, patterns: patterns || [] });
  } catch (error) {
    console.error('Error fetching skip patterns:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Add a skip pattern
export async function POST(request) {
  try {
    const { user, supabase } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { showId, patternType, patternValue, reason } = await request.json();
    
    if (!showId || !patternType || !patternValue) {
      return NextResponse.json({ 
        error: 'showId, patternType, and patternValue required' 
      }, { status: 400 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('skip_patterns')
      .insert({
        show_id: showId,
        pattern_type: patternType,
        pattern_value: patternValue,
        reason: reason || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Pattern already exists' }, { status: 400 });
      }
      // If table doesn't exist, return error with helpful message
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'skip_patterns table does not exist. Please create it first.' 
        }, { status: 500 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, pattern: data });
  } catch (error) {
    console.error('Error creating skip pattern:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Remove a skip pattern
export async function DELETE(request) {
  try {
    const { user, supabase } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patternId = searchParams.get('id');
    
    if (!patternId) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    // First get the pattern to verify show access
    const { data: pattern, error: fetchError } = await supabase
      .from('skip_patterns')
      .select('show_id')
      .eq('id', patternId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Pattern not found' }, { status: 404 });
      }
      throw fetchError;
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(pattern.show_id, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied' }, { status: 403 });
    }

    const { error } = await supabase
      .from('skip_patterns')
      .delete()
      .eq('id', patternId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting skip pattern:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


