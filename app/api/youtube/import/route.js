import { getPlaylistVideos, getChannelVideos, getVideoDetails, getVideoAnalytics, parseDuration, extractUrlsFromDescription } from '@/lib/youtube/api';
import { getBatchTranscripts } from '@/lib/youtube/transcript';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  const { showId, accountId, playlistId, maxVideos = 200 } = await request.json();
  
  if (!showId || !accountId) {
    return NextResponse.json({ error: 'showId and accountId required' }, { status: 400 });
  }
  
  try {
    // Update status
    await updateStatus(showId, 'fetching_videos', 0);
    await logStep(showId, 'import_start', 'started', 'Starting video import');
    
    // Get account
    const { data: account } = await supabase
      .from('youtube_accounts')
      .select('*')
      .eq('id', accountId)
      .single();
    
    if (!account) {
      throw new Error('Account not found');
    }
    
    const tokens = { access_token: account.access_token, refresh_token: account.refresh_token };
    
    // Fetch videos
    let videos;
    if (playlistId) {
      videos = await getPlaylistVideos(tokens, playlistId, maxVideos);
    } else {
      videos = await getChannelVideos(tokens, account.channel_id, maxVideos);
    }
    
    const videoIds = videos.map(v => v.contentDetails?.videoId || v.snippet?.resourceId?.videoId).filter(Boolean);
    await logStep(showId, 'fetch_videos', 'completed', `Found ${videoIds.length} videos`);
    
    // Get detailed info
    await updateStatus(showId, 'fetching_videos', 20);
    const details = await getVideoDetails(tokens, videoIds);
    
    // Get analytics
    await updateStatus(showId, 'fetching_analytics', 30);
    await logStep(showId, 'fetch_analytics', 'started', 'Fetching video analytics');
    
    const analyticsMap = {};
    for (let i = 0; i < details.length; i++) {
      const video = details[i];
      const analytics = await getVideoAnalytics(tokens, account.channel_id, video.id, video.snippet.publishedAt);
      analyticsMap[video.id] = analytics;
      
      if (i % 10 === 0) {
        await updateStatus(showId, 'fetching_analytics', 30 + Math.round((i / details.length) * 20));
      }
      await new Promise(r => setTimeout(r, 100)); // Rate limit
    }
    
    await logStep(showId, 'fetch_analytics', 'completed', `Fetched analytics for ${Object.keys(analyticsMap).filter(k => analyticsMap[k]).length} videos`);
    
    // Get transcripts
    await updateStatus(showId, 'fetching_transcripts', 50);
    await logStep(showId, 'fetch_transcripts', 'started', 'Fetching video transcripts');
    
    const transcripts = await getBatchTranscripts(videoIds, async (progress) => {
      await updateStatus(showId, 'fetching_transcripts', 50 + Math.round(progress * 0.3));
    });
    
    const transcriptMap = {};
    transcripts.forEach(t => { transcriptMap[t.videoId] = t; });
    
    const transcriptsFound = transcripts.filter(t => t.available).length;
    await logStep(showId, 'fetch_transcripts', 'completed', `Found transcripts for ${transcriptsFound}/${videoIds.length} videos`);
    
    // Build video records
    await updateStatus(showId, 'calculating', 80);
    
    const videosToInsert = details.map(video => {
      const analytics = analyticsMap[video.id];
      const transcript = transcriptMap[video.id];
      const durationSec = parseDuration(video.contentDetails?.duration);
      const isShort = durationSec <= 182 || video.snippet?.title?.includes('#shorts');
      
      // Calculate organic views and ad percentage
      const views7Total = analytics?.day7?.views_total || analytics?.day7?.views || 0;
      const views7Ads = analytics?.day7?.views_ads || 0;
      const views7Organic = analytics?.day7?.views_organic || (views7Total - views7Ads);
      
      const views30Total = analytics?.day30?.views_total || analytics?.day30?.views || 0;
      const views30Ads = analytics?.day30?.views_ads || 0;
      const views30Organic = analytics?.day30?.views_organic || (views30Total - views30Ads);
      
      const totalViews = parseInt(video.statistics?.viewCount || 0);
      const adPercentage = views30Total > 0 ? (views30Ads / views30Total * 100) : 0;
      
      // Estimate total organic (extrapolate from 30-day ratio)
      const organicRatio = views30Total > 0 ? (views30Organic / views30Total) : 1;
      const viewsOrganic = Math.round(totalViews * organicRatio);
      const viewsFromAds = totalViews - viewsOrganic;
      
      return {
        show_id: showId,
        video_id: video.id,
        youtube_url: `https://www.youtube.com/watch?v=${video.id}`,
        title: video.snippet.title,
        description: video.snippet.description,
        description_urls: extractUrlsFromDescription(video.snippet.description),
        format: isShort ? 'Shorts' : 'Long',
        duration_seconds: durationSec,
        thumbnail_url: video.snippet.thumbnails?.maxres?.url || video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
        publish_date: video.snippet.publishedAt,
        
        // Total views
        views: totalViews,
        likes: parseInt(video.statistics?.likeCount || 0),
        comments: parseInt(video.statistics?.commentCount || 0),
        
        // Organic vs Ads breakdown
        views_organic: viewsOrganic,
        views_from_ads: viewsFromAds,
        ad_percentage: parseFloat(adPercentage.toFixed(2)),
        
        // 7-day metrics
        views_7_days: views7Total,
        views_7_days_organic: views7Organic,
        views_7_days_ads: views7Ads,
        
        // 30-day metrics
        views_30_days: views30Total,
        views_30_days_organic: views30Organic,
        views_30_days_ads: views30Ads,
        
        // Engagement (based on organic to be more accurate)
        engagement_rate_7d: calculateEngagementRate({ ...analytics?.day7, views: views7Organic }),
        engagement_rate_30d: calculateEngagementRate({ ...analytics?.day30, views: views30Organic }),
        engagements_7_days: (analytics?.day7?.likes || 0) + (analytics?.day7?.comments || 0) + (analytics?.day7?.shares || 0),
        engagements_30_days: (analytics?.day30?.likes || 0) + (analytics?.day30?.comments || 0) + (analytics?.day30?.shares || 0),
        
        // Other metrics
        shares: analytics?.day30?.shares || 0,
        subscribers_gained: analytics?.day30?.subscribersGained || 0,
        watch_time_minutes: analytics?.day30?.estimatedMinutesWatched || 0,
        
        // Traffic breakdown
        traffic_browse: views30Total > 0 ? parseFloat(((analytics?.day30?.traffic_browse || 0) / views30Total * 100).toFixed(1)) : 0,
        traffic_search: views30Total > 0 ? parseFloat(((analytics?.day30?.traffic_search || 0) / views30Total * 100).toFixed(1)) : 0,
        traffic_suggested: views30Total > 0 ? parseFloat(((analytics?.day30?.traffic_suggested || 0) / views30Total * 100).toFixed(1)) : 0,
        traffic_shorts_feed: views30Total > 0 ? parseFloat(((analytics?.day30?.traffic_shorts || 0) / views30Total * 100).toFixed(1)) : 0,
        traffic_external: views30Total > 0 ? parseFloat(((analytics?.day30?.traffic_external || 0) / views30Total * 100).toFixed(1)) : 0,
        traffic_ads: parseFloat(adPercentage.toFixed(1)),
        
        // Transcript
        transcript_text: transcript?.fullText,
        hook_text: transcript?.hook,
        transcript_language: transcript?.language,
        transcript_available: transcript?.available || false,
        
        analytics_fetched: !!analytics
      };
    });
    
    // Insert to database
    const { error: insertError } = await supabase
      .from('channel_videos')
      .upsert(videosToInsert, { onConflict: 'show_id,video_id' });
    
    if (insertError) throw insertError;
    
    // Update show
    await supabase
      .from('shows')
      .update({
        playlist_id: playlistId,
        total_videos_imported: videosToInsert.length,
        last_video_sync: new Date().toISOString(),
        onboarding_status: 'analyzing_thumbnails',
        onboarding_progress: 85
      })
      .eq('id', showId);
    
    await logStep(showId, 'import_complete', 'completed', `Imported ${videosToInsert.length} videos`, {
      total: videosToInsert.length,
      withAnalytics: Object.values(analyticsMap).filter(Boolean).length,
      withTranscripts: transcriptsFound
    });
    
    return NextResponse.json({
      success: true,
      imported: videosToInsert.length,
      withAnalytics: Object.values(analyticsMap).filter(Boolean).length,
      withTranscripts: transcriptsFound
    });
    
  } catch (error) {
    console.error('Import error:', error);
    await updateStatus(showId, 'failed', 0, error.message);
    await logStep(showId, 'import_error', 'failed', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function calculateEngagementRate(metrics) {
  if (!metrics) return 0;
  const views = metrics.views || metrics.views_organic || 0;
  if (views === 0) return 0;
  const engagements = (metrics.likes || 0) + (metrics.comments || 0) + (metrics.shares || 0);
  return parseFloat(((engagements / views) * 100).toFixed(2));
}

async function updateStatus(showId, status, progress, error = null) {
  await supabase
    .from('shows')
    .update({ onboarding_status: status, onboarding_progress: progress, onboarding_error: error })
    .eq('id', showId);
}

async function logStep(showId, step, status, message, details = null) {
  await supabase.from('onboarding_logs').insert({
    show_id: showId,
    step,
    status,
    message,
    details,
    completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null
  });
}

