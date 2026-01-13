import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import {
  addVideo,
  getVideos,
  updateVideo,
  deleteVideo
} from '@/lib/competitors/competitorStore.js';

/**
 * GET - Get all videos (with optional filters)
 */
export async function GET(request) {
  try {
    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');
    const channelId = searchParams.get('channelId');
    const contentType = searchParams.get('contentType');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // If showId is provided, fetch from database
    if (showId) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      let query = supabaseAdmin
        .from('competitor_videos')
        .select(`
          *,
          competitors (
            id,
            name,
            channel_name,
            youtube_channel_id
          )
        `)
        .eq('show_id', showId)
        .order('published_at', { ascending: false })
        .limit(limit);
      
      if (channelId) {
        query = query.eq('competitor_id', channelId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching competitor videos:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      // Flatten the response
      const videos = (data || []).map(video => ({
        ...video,
        channel_name: video.competitors?.channel_name || video.competitors?.name || 'Unknown',
      }));
      
      return NextResponse.json({ success: true, videos });
    }
    
    // Fallback to old store-based system
    const filter = {};
    if (channelId) filter.channelId = channelId;
    if (contentType) filter.contentType = contentType;
    
    const videos = await getVideos(filter);
    
    return NextResponse.json({
      success: true,
      videos
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Add a new video
 */
export async function POST(request) {
  try {
    const body = await request.json();
    
    const video = await addVideo({
      url: body.url,
      title: body.title,
      channelName: body.channelName,
      channelId: body.channelId,
      reason: body.reason,
      contentType: body.contentType || 'direct_competitor',
      learnPoints: body.learnPoints || [],
      tags: body.tags || []
    });
    
    return NextResponse.json({
      success: true,
      video
    });
  } catch (error) {
    console.error('Error adding video:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}

/**
 * PUT - Update a video
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Video ID is required' },
        { status: 400 }
      );
    }
    
    const video = await updateVideo(id, updates);
    
    return NextResponse.json({
      success: true,
      video
    });
  } catch (error) {
    console.error('Error updating video:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}

/**
 * DELETE - Delete a video
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Video ID is required' },
        { status: 400 }
      );
    }
    
    await deleteVideo(id);
    
    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting video:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}




