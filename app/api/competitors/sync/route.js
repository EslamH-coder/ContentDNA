import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/supabaseServer';
import { checkQuota, incrementUsage } from '@/lib/rateLimiter';
import { detectTopic } from '@/lib/topicDetector';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Calculate median of an array of numbers
 */
function calculateMedian(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate and update median_views_20 for a competitor
 * Uses last 20 videos by published_at to calculate median views
 */
async function updateMedianViews(competitorId) {
  try {
    // Fetch last 20 videos ordered by published_at
    const { data: recentVideos, error: fetchError } = await supabaseAdmin
      .from('competitor_videos')
      .select('views')
      .eq('competitor_id', competitorId)
      .gt('views', 0)
      .order('published_at', { ascending: false })
      .limit(20);

    if (fetchError) {
      console.error('❌ Error fetching videos for median calculation:', fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!recentVideos || recentVideos.length === 0) {
      console.log('⚠️ No videos with views found for median calculation');
      return { success: true, medianViews: null };
    }

    // Calculate median
    const viewCounts = recentVideos.map(v => v.views);
    const medianViews = Math.round(calculateMedian(viewCounts));

    console.log(`📊 Median calculation: ${recentVideos.length} videos, median = ${medianViews}`);

    // Update competitor record
    const { error: updateError } = await supabaseAdmin
      .from('competitors')
      .update({ median_views_20: medianViews })
      .eq('id', competitorId);

    if (updateError) {
      console.error('❌ Error updating median_views_20:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true, medianViews };

  } catch (error) {
    console.error('❌ Error in updateMedianViews:', error);
    return { success: false, error: error.message };
  }
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export async function POST(request) {
  try {
    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check rate limit
    const quota = await checkQuota(user.id, 'sync');
    if (!quota.allowed) {
      console.log(`🚫 Rate limit exceeded for user ${user.email}: sync`);
      return NextResponse.json({ 
        error: 'Daily limit reached',
        message: `You've used all ${quota.limit} competitor syncs for today. Try again tomorrow.`,
        remaining: 0,
        limit: quota.limit
      }, { status: 429 });
    }

    const { competitorId } = await request.json();

    console.log('🔄 Starting competitor sync for ID:', competitorId);

    if (!YOUTUBE_API_KEY) {
      console.error('❌ YOUTUBE_API_KEY not set');
      return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
    }

    // Check API key
    console.log('🔑 API Key exists:', !!YOUTUBE_API_KEY);
    if (YOUTUBE_API_KEY) {
      console.log('🔑 API Key (first 10 chars):', YOUTUBE_API_KEY.substring(0, 10) + '...');
    }

    if (!competitorId) {
      return NextResponse.json({ error: 'Competitor ID required' }, { status: 400 });
    }

    // Get competitor details
    console.log('📋 Fetching competitor from database...');
    const { data: competitor, error: compError } = await supabaseAdmin
      .from('competitors')
      .select('*')
      .eq('id', competitorId)
      .single();

    if (compError || !competitor) {
      console.error('❌ Error fetching competitor:', compError);
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
    }

    console.log('✅ Competitor found:', {
      id: competitor.id,
      name: competitor.name,
      channelId: competitor.youtube_channel_id,
      trackingEnabled: competitor.tracking_enabled
    });

    if (!competitor.youtube_channel_id) {
      console.error('❌ No YouTube channel ID/URL configured');
      return NextResponse.json({ error: 'No YouTube channel ID/URL set for this competitor' }, { status: 400 });
    }

    if (!competitor.tracking_enabled) {
      console.error('❌ Tracking is disabled for this competitor');
      return NextResponse.json({ error: 'Tracking is disabled for this competitor' }, { status: 400 });
    }

    console.log(`🔄 Syncing videos for: ${competitor.name}`);
    console.log(`📺 YouTube input: ${competitor.youtube_channel_id}`);

    // Resolve channel URL/handle to ID if needed
    let channelId = await resolveChannelId(competitor.youtube_channel_id);
    
    if (!channelId) {
      console.error('❌ Could not resolve YouTube channel ID');
      return NextResponse.json({ error: 'Could not resolve YouTube channel ID' }, { status: 400 });
    }

    console.log(`📺 Resolved channel ID: ${channelId}`);

    // Update the competitor with resolved channel ID if it was a URL
    if (channelId !== competitor.youtube_channel_id) {
      console.log('📝 Updating competitor with resolved channel ID...');
      const { error: updateError } = await supabaseAdmin
        .from('competitors')
        .update({ youtube_channel_id: channelId })
        .eq('id', competitorId);

      if (updateError) {
        console.error('⚠️ Error updating competitor channel ID:', updateError);
      } else {
        console.log(`✅ Updated competitor with resolved channel ID`);
      }
    }

    // Fetch videos from YouTube API
    const videos = await fetchYouTubeVideos(channelId);
    
    if (!videos || videos.length === 0) {
      console.warn('⚠️ No videos found');
      // Update last_checked even if no videos
      await supabaseAdmin
        .from('competitors')
        .update({ last_checked: new Date().toISOString() })
        .eq('id', competitorId);

      return NextResponse.json({ 
        success: true, 
        message: 'No videos found',
        videosAdded: 0 
      });
    }

    console.log(`📺 Found ${videos.length} videos`);

    // Save videos to database
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const video of videos) {
      try {
        // Check if video already exists
        const { data: existing } = await supabaseAdmin
          .from('competitor_videos')
          .select('id')
          .eq('competitor_id', competitorId)
          .eq('youtube_video_id', video.id)
          .maybeSingle();

        // Detect topic using DNA keywords (now with description)
        const { topicId, confidence, matchedKeywords } = await detectTopic(
          video.title,
          video.description || '',
          competitor.show_id
        );
        
        if (topicId && topicId !== 'other_stories') {
          console.log(`🏷️ Video "${video.title.substring(0, 40)}..." → Topic: ${topicId} (${confidence}% confidence)`);
        }

        if (existing) {
          // Update existing video
          const { error: updateError } = await supabaseAdmin
            .from('competitor_videos')
            .update({
              title: video.title,
              description: video.description || null,
              published_at: video.publishedAt,
              views: video.views || 0,
              likes: video.likes || 0,
              comments: video.commentCount || 0,
              duration_seconds: parseDuration(video.duration),
              detected_topic: topicId,  // Now assigned!
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error('❌ Error updating video:', video.id, updateError);
            errorCount++;
          } else {
            updatedCount++;
          }
        } else {
          // Insert new video
          const { error: insertError } = await supabaseAdmin
            .from('competitor_videos')
            .insert({
              competitor_id: competitorId,
              youtube_video_id: video.id,
              title: video.title,
              description: video.description || null,
              published_at: video.publishedAt,
              views: video.views || 0,
              likes: video.likes || 0,
              comments: video.commentCount || 0,
              duration_seconds: parseDuration(video.duration),
              detected_topic: topicId,  // Now assigned!
              relevance_score: 0,
              performance_ratio: 0,
              is_success: false,
              is_failure: false
            });

          if (insertError) {
            console.error('❌ Error inserting video:', video.id, insertError);
            errorCount++;
          } else {
            addedCount++;
          }
        }
      } catch (err) {
        console.error('❌ Error processing video:', video.id, err);
        errorCount++;
      }
    }

    console.log(`💾 Database results: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors`);

    // Calculate and update median_views_20 for this competitor
    console.log('📊 Calculating median_views_20...');
    const medianResult = await updateMedianViews(competitorId);
    if (medianResult.success && medianResult.medianViews) {
      console.log(`✅ Updated median_views_20: ${medianResult.medianViews.toLocaleString()} views`);
    }

    // Update last_checked timestamp
    await supabaseAdmin
      .from('competitors')
      .update({ last_checked: new Date().toISOString() })
      .eq('id', competitorId);

    console.log('✅ Sync completed successfully');

    // IMPORTANT: Increment usage BEFORE returning success
    console.log('📊 Incrementing usage for user:', user.id, 'action: sync');
    try {
      await incrementUsage(user.id, 'sync');
      console.log('✅ Usage incremented successfully');
    } catch (usageError) {
      console.error('⚠️ Failed to increment usage (non-fatal):', usageError);
      // Don't fail the request if usage increment fails
    }

    return NextResponse.json({
        success: true,
        message: `Synced ${addedCount} new videos`,
        videosAdded: addedCount,
        videosUpdated: updatedCount,
        videosSkipped: skippedCount,
        videosErrors: errorCount,
        totalFound: videos.length,
        medianViews20: medianResult.success ? medianResult.medianViews : null,
        quota: {
          remaining: quota.remaining - 1,
          limit: quota.limit
        }
      });

  } catch (error) {
    console.error('❌ Error syncing competitor:', error);
    console.error('❌ Error stack:', error.stack);
    return NextResponse.json({ 
      error: error.message || 'Failed to sync competitor',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * Resolve YouTube channel URL/handle to channel ID
 * Supports:
 * - Channel ID directly (UC...)
 * - Full URL: https://www.youtube.com/channel/UC...
 * - Handle URL: https://www.youtube.com/@username
 * - Custom URL: https://www.youtube.com/c/customname
 * - User URL: https://www.youtube.com/user/username
 * - Just handle: @username
 */
async function resolveChannelId(input) {
  if (!input) {
    console.error('❌ Empty input for channel resolution');
    return null;
  }
  
  const trimmed = input.trim();
  console.log(`🔍 Resolving channel input: ${trimmed}`);
  
  // Already a channel ID (starts with UC and is 24 chars)
  if (trimmed.startsWith('UC') && trimmed.length === 24) {
    console.log('✅ Input is already a channel ID');
    return trimmed;
  }
  
  // Extract from full channel URL: youtube.com/channel/UC...
  const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
  if (channelMatch) {
    console.log('✅ Extracted channel ID from URL');
    return channelMatch[1];
  }
  
  // Handle URL: youtube.com/@username or just @username
  let handle = null;
  
  const handleMatch = trimmed.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
  if (handleMatch) {
    handle = handleMatch[1];
  } else if (trimmed.startsWith('@')) {
    handle = trimmed.substring(1);
  }
  
  // Custom URL: youtube.com/c/customname
  const customMatch = trimmed.match(/youtube\.com\/c\/([a-zA-Z0-9_-]+)/);
  if (customMatch) {
    handle = customMatch[1];
  }
  
  // User URL: youtube.com/user/username
  const userMatch = trimmed.match(/youtube\.com\/user\/([a-zA-Z0-9_-]+)/);
  if (userMatch) {
    handle = userMatch[1];
  }
  
  // If we have a handle, resolve it via YouTube API
  if (handle) {
    console.log(`🔍 Resolving handle: @${handle}`);
    
    try {
      // Try forHandle parameter first (newer method for @handles)
      const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${YOUTUBE_API_KEY}`;
      console.log('📺 Calling YouTube API with forHandle...');
      const handleResponse = await fetch(handleUrl);
      const handleData = await handleResponse.json();
      
      console.log('📺 Handle API response:', JSON.stringify({
        itemsCount: handleData.items?.length || 0,
        error: handleData.error || null
      }, null, 2));
      
      if (handleData.items && handleData.items.length > 0) {
        const resolvedId = handleData.items[0].id;
        console.log(`✅ Resolved handle @${handle} to channel ID: ${resolvedId}`);
        return resolvedId;
      }
      
      // Fallback: try forUsername (older method for custom URLs)
      console.log('📺 Trying forUsername as fallback...');
      const userUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${handle}&key=${YOUTUBE_API_KEY}`;
      const userResponse = await fetch(userUrl);
      const userData = await userResponse.json();
      
      console.log('📺 Username API response:', JSON.stringify({
        itemsCount: userData.items?.length || 0,
        error: userData.error || null
      }, null, 2));
      
      if (userData.items && userData.items.length > 0) {
        const resolvedId = userData.items[0].id;
        console.log(`✅ Resolved username ${handle} to channel ID: ${resolvedId}`);
        return resolvedId;
      }
      
      console.error(`❌ Could not resolve handle: @${handle}`);
      if (handleData.error) {
        console.error('YouTube API error:', JSON.stringify(handleData.error, null, 2));
      }
    } catch (error) {
      console.error(`❌ Error resolving handle @${handle}:`, error);
    }
  }
  
  // If nothing worked, maybe it's already a channel ID without UC prefix?
  // Or invalid input
  console.error(`❌ Could not parse channel input: ${trimmed}`);
  return null;
}

/**
 * Fetch videos from YouTube Data API
 */
async function fetchYouTubeVideos(channelId, maxResults = 50) {
  try {
    console.log(`📺 Fetching videos for channel: ${channelId}`);
    
    // Step 1: Get upload playlist ID from channel
    console.log('📺 Step 1: Fetching channel details...');
    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`;
    const channelResponse = await fetch(channelUrl);
    const channelData = await channelResponse.json();

    console.log('📺 Channel API response:', JSON.stringify({
      itemsCount: channelData.items?.length || 0,
      error: channelData.error || null
    }, null, 2));

    if (channelData.error) {
      console.error('❌ YouTube API error:', JSON.stringify(channelData.error, null, 2));
      return [];
    }

    if (!channelData.items || channelData.items.length === 0) {
      console.error('❌ Channel not found:', channelId);
      return [];
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      console.error('❌ No uploads playlist found for channel');
      return [];
    }

    console.log(`✅ Uploads playlist: ${uploadsPlaylistId}`);

    // Step 2: Get videos from uploads playlist
    console.log('📺 Step 2: Fetching video IDs from playlist...');
    const videoIds = [];
    let nextPageToken = null;
    let pageCount = 0;

    while (videoIds.length < maxResults && pageCount < 5) {
      pageCount++;
      const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
      playlistUrl.searchParams.set('part', 'snippet');
      playlistUrl.searchParams.set('playlistId', uploadsPlaylistId);
      playlistUrl.searchParams.set('maxResults', '50');
      playlistUrl.searchParams.set('key', YOUTUBE_API_KEY);
      if (nextPageToken) {
        playlistUrl.searchParams.set('pageToken', nextPageToken);
      }

      const playlistResponse = await fetch(playlistUrl.toString());
      const playlistData = await playlistResponse.json();

      console.log(`📺 Playlist API response (page ${pageCount}):`, JSON.stringify({
        itemsCount: playlistData.items?.length || 0,
        nextPageToken: playlistData.nextPageToken ? 'yes' : 'no',
        error: playlistData.error || null
      }, null, 2));

      if (playlistData.error) {
        console.error('❌ Playlist API error:', JSON.stringify(playlistData.error, null, 2));
        break;
      }

      if (!playlistData.items || playlistData.items.length === 0) {
        break;
      }

      for (const item of playlistData.items) {
        const videoId = item.snippet?.resourceId?.videoId;
        if (videoId && !videoIds.includes(videoId)) {
          videoIds.push(videoId);
        }
        if (videoIds.length >= maxResults) break;
      }

      nextPageToken = playlistData.nextPageToken;
      if (!nextPageToken) break;
    }

    console.log(`✅ Found ${videoIds.length} video IDs`);

    if (videoIds.length === 0) {
      return [];
    }

    // Step 3: Get video details (views, likes, duration)
    console.log('📺 Step 3: Fetching video details...');
    const videos = [];
    const batchSize = 50;

    for (let i = 0; i < videoIds.length; i += batchSize) {
      const batch = videoIds.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      console.log(`📺 Fetching batch ${batchNum} (${batch.length} videos)...`);

      const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${batch.join(',')}&key=${YOUTUBE_API_KEY}`;
      const videosResponse = await fetch(videosUrl);
      const videosData = await videosResponse.json();

      console.log(`📺 Videos API response (batch ${batchNum}):`, JSON.stringify({
        itemsCount: videosData.items?.length || 0,
        error: videosData.error || null
      }, null, 2));

      if (videosData.error) {
        console.error(`❌ Videos API error (batch ${batchNum}):`, JSON.stringify(videosData.error, null, 2));
        continue;
      }

      if (!videosData.items) {
        continue;
      }

      // Map to our format
      for (const video of videosData.items) {
        // Extract description and truncate to 500 chars
        const fullDescription = video.snippet?.description || '';
        const description = fullDescription.substring(0, 500);
        
        videos.push({
          id: video.id,
          title: video.snippet?.title || '',
          description: description,
          publishedAt: video.snippet?.publishedAt || null,
          views: parseInt(video.statistics?.viewCount || '0'),
          likes: parseInt(video.statistics?.likeCount || '0'),
          commentCount: parseInt(video.statistics?.commentCount || '0'),
          duration: video.contentDetails?.duration || 'PT0S',
        });
      }
    }

    console.log(`✅ Processed ${videos.length} videos`);
    return videos;

  } catch (error) {
    console.error('❌ YouTube API error:', error);
    console.error('❌ Error stack:', error.stack);
    return [];
  }
}

/**
 * Parse ISO 8601 duration to seconds
 */
function parseDuration(duration) {
  if (!duration) return 0;
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');

  return hours * 3600 + minutes * 60 + seconds;
}
