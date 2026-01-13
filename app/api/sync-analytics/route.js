import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  const { showId } = await request.json();

  if (!showId) {
    return NextResponse.json({ error: 'showId required' }, { status: 400 });
  }

  try {
    // 1. Get show's youtube_account_id
    const { data: show, error: showError } = await supabase
      .from('shows')
      .select('youtube_account_id')
      .eq('id', showId)
      .single();

    if (showError || !show?.youtube_account_id) {
      return NextResponse.json({ 
        error: 'No YouTube account linked to this show.' 
      }, { status: 400 });
    }

    // 2. Get YouTube credentials from youtube_accounts table
    const { data: ytAccount, error: ytError } = await supabase
      .from('youtube_accounts')
      .select('channel_id, access_token, refresh_token')
      .eq('id', show.youtube_account_id)
      .single();

    if (ytError || !ytAccount?.access_token) {
      return NextResponse.json({ 
        error: 'YouTube credentials not found. Please reconnect YouTube.' 
      }, { status: 400 });
    }

    // 3. Setup OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: ytAccount.access_token,
      refresh_token: ytAccount.refresh_token,
    });

    // Refresh token if needed
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      
      // Save new access token
      if (credentials.access_token !== ytAccount.access_token) {
        await supabase
          .from('youtube_accounts')
          .update({ 
            access_token: credentials.access_token,
            token_expires_at: new Date(credentials.expiry_date).toISOString()
          })
          .eq('id', show.youtube_account_id);
      }
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      return NextResponse.json({ 
        error: 'YouTube token expired. Please reconnect YouTube in Settings.' 
      }, { status: 401 });
    }

    // 4. Get videos that need updating (90+ days old for evergreen analysis)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    const { data: videos, error: videosError } = await supabase
      .from('channel_videos')
      .select('id, video_id, title, publish_date')
      .eq('show_id', showId)
      .lt('publish_date', ninetyDaysAgo.toISOString())
      .order('views_organic', { ascending: false, nullsFirst: false })
      .limit(50); // Limit to top 50 to save API quota

    if (videosError) throw videosError;

    if (!videos || videos.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No videos older than 90 days to sync',
        updated: 0 
      });
    }

    // 5. Setup YouTube Analytics API
    const youtubeAnalytics = google.youtubeAnalytics({
      version: 'v2',
      auth: oauth2Client
    });

    // 6. Calculate date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date(endDate - 7 * 24 * 60 * 60 * 1000);
    
    const formatDate = (d) => d.toISOString().split('T')[0];

    // 7. Fetch analytics for each video
    const results = {
      updated: 0,
      failed: 0,
      errors: []
    };

    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (video) => {
        try {
          const response = await youtubeAnalytics.reports.query({
            ids: `channel==${ytAccount.channel_id}`,
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            metrics: 'views',
            filters: `video==${video.video_id}`,
            dimensions: 'video'
          });

          const views = response.data.rows?.[0]?.[1] || 0;

          // Update database
          await supabase
            .from('channel_videos')
            .update({
              views_last_7_days_current: views,
              views_last_7_days_updated_at: new Date().toISOString()
            })
            .eq('id', video.id);

          results.updated++;
        } catch (err) {
          results.failed++;
          results.errors.push({ videoId: video.video_id, error: err.message });
        }
      }));

      // Small delay between batches to avoid rate limits
      if (i + batchSize < videos.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced analytics for ${results.updated} videos`,
      ...results
    });

  } catch (error) {
    console.error('Sync analytics error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET endpoint to check sync status
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('showId');

  if (!showId) {
    return NextResponse.json({ error: 'showId required' }, { status: 400 });
  }

  try {
    // Get count of videos with fresh analytics
    const { data, error } = await supabase
      .from('channel_videos')
      .select('id, views_last_7_days_current, views_last_7_days_updated_at')
      .eq('show_id', showId)
      .not('views_last_7_days_updated_at', 'is', null);

    if (error) throw error;

    const lastSync = data?.length > 0 
      ? data.sort((a, b) => new Date(b.views_last_7_days_updated_at) - new Date(a.views_last_7_days_updated_at))[0]
      : null;

    return NextResponse.json({
      success: true,
      syncedVideos: data?.length || 0,
      lastSyncAt: lastSync?.views_last_7_days_updated_at || null
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

