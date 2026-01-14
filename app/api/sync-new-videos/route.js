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
    // 1. Get show details
    const { data: show, error: showError } = await supabase
      .from('shows')
      .select('youtube_account_id, playlist_id')
      .eq('id', showId)
      .single();

    if (showError || !show?.playlist_id) {
      return NextResponse.json({ error: 'Show or playlist not found' }, { status: 400 });
    }

    // 2. Get YouTube credentials
    const { data: ytAccount } = await supabase
      .from('youtube_accounts')
      .select('access_token, refresh_token, channel_id, token_expires_at')
      .eq('id', show.youtube_account_id)
      .single();

    if (!ytAccount) {
      return NextResponse.json({ 
        error: 'YouTube account not found. Please connect YouTube in Settings.',
        reconnectUrl: `/settings?showId=${showId}&tab=youtube`
      }, { status: 400 });
    }

    if (!ytAccount.access_token) {
      return NextResponse.json({ 
        error: 'YouTube access token missing. Please reconnect YouTube in Settings.',
        reconnectUrl: `/settings?showId=${showId}&tab=youtube`
      }, { status: 400 });
    }

    if (!ytAccount.refresh_token) {
      return NextResponse.json({ 
        error: 'YouTube refresh token missing. Please reconnect YouTube in Settings. The connection may have been revoked.',
        reconnectUrl: `/settings?showId=${showId}&tab=youtube`
      }, { status: 400 });
    }

    // 3. Setup OAuth
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: ytAccount.access_token,
      refresh_token: ytAccount.refresh_token,
    });

    // Refresh token
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      
      await supabase
        .from('youtube_accounts')
        .update({ 
          access_token: credentials.access_token,
          token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null
        })
        .eq('id', show.youtube_account_id);
      console.log('✅ YouTube access token refreshed successfully');
    } catch (refreshError) {
      console.error('❌ Token refresh failed:', refreshError);
      const errorMessage = refreshError.message || 'Unknown error';
      let userMessage = 'YouTube token expired. Please reconnect YouTube in Settings.';
      
      if (errorMessage.includes('invalid_grant') || errorMessage.includes('invalid_request')) {
        userMessage = 'YouTube connection has been revoked. Please reconnect YouTube in Settings.';
      } else if (errorMessage.includes('invalid_client')) {
        userMessage = 'YouTube API credentials are invalid. Please check your Google OAuth configuration.';
      }
      
      return NextResponse.json({ 
        error: userMessage,
        reconnectUrl: `/settings?showId=${showId}&tab=youtube`,
        technicalError: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      }, { status: 401 });
    }

    // 4. Get existing video IDs
    const { data: existingVideos } = await supabase
      .from('channel_videos')
      .select('video_id')
      .eq('show_id', showId);

    const existingIds = new Set(existingVideos?.map(v => v.video_id) || []);

    // 5. Fetch playlist items
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    let newVideos = [];
    let pageToken = null;

    do {
      const response = await youtube.playlistItems.list({
        part: 'snippet,contentDetails',
        playlistId: show.playlist_id,
        maxResults: 50,
        pageToken
      });

      const items = response.data.items || [];
      
      for (const item of items) {
        const videoId = item.contentDetails?.videoId;
        if (videoId && !existingIds.has(videoId)) {
          newVideos.push({
            video_id: videoId,
            title: item.snippet?.title,
            description: item.snippet?.description,
            thumbnail_url: item.snippet?.thumbnails?.maxres?.url || 
                          item.snippet?.thumbnails?.high?.url ||
                          item.snippet?.thumbnails?.default?.url,
            publish_date: item.contentDetails?.videoPublishedAt,
            youtube_url: `https://www.youtube.com/watch?v=${videoId}`
          });
        }
      }

      pageToken = response.data.nextPageToken;
    } while (pageToken && newVideos.length < 100);

    if (newVideos.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new videos found',
        added: 0
      });
    }

    // 6. Get video details (duration, stats)
    const videoIds = newVideos.map(v => v.video_id);
    const detailsResponse = await youtube.videos.list({
      part: 'contentDetails,statistics',
      id: videoIds.join(',')
    });

    const videoDetails = {};
    for (const item of detailsResponse.data.items || []) {
      const duration = item.contentDetails?.duration || 'PT0S';
      const seconds = parseDuration(duration);
      
      videoDetails[item.id] = {
        duration_seconds: seconds,
        format: seconds < 180 ? 'Shorts' : 'Long',
        views: parseInt(item.statistics?.viewCount || 0),
        likes: parseInt(item.statistics?.likeCount || 0),
        comments: parseInt(item.statistics?.commentCount || 0)
      };
    }

    // 7. Prepare videos for insertion
    const videosToInsert = newVideos.map(v => ({
      show_id: showId,
      video_id: v.video_id,
      title: v.title,
      description: v.description,
      thumbnail_url: v.thumbnail_url,
      publish_date: v.publish_date,
      youtube_url: v.youtube_url,
      ...videoDetails[v.video_id],
      topic_id: 'other_stories', // Default topic
      created_at: new Date().toISOString()
    }));

    // Before inserting, deduplicate by video_id
    // This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" error
    const uniqueVideosMap = new Map();
    for (const video of videosToInsert) {
      // Only keep the first occurrence of each video_id
      if (!uniqueVideosMap.has(video.video_id)) {
        uniqueVideosMap.set(video.video_id, video);
      }
    }
    const uniqueVideos = Array.from(uniqueVideosMap.values());

    console.log(`📊 Deduped: ${videosToInsert.length} -> ${uniqueVideos.length} videos`);

    // FIX: Avoid upsert to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time" error
    // Use explicit update/insert logic instead
    let videosToUpdate = [];
    let newVideosToInsert = [];
    
    if (uniqueVideos.length > 0) {
      // Step 1: Check for existing videos and handle duplicates in database
      const videoIds = uniqueVideos.map(v => v.video_id);
      const { data: existingVideosInDb, error: checkError } = await supabase
        .from('channel_videos')
        .select('id, video_id, show_id')
        .eq('show_id', showId)
        .in('video_id', videoIds);
      
      if (checkError) {
        console.error('❌ Error checking existing videos:', checkError);
        throw checkError;
      }
      
      // Step 2: Group existing videos by video_id to find duplicates
      const existingByVideoId = {};
      for (const existing of existingVideosInDb || []) {
        if (!existingByVideoId[existing.video_id]) {
          existingByVideoId[existing.video_id] = [];
        }
        existingByVideoId[existing.video_id].push(existing);
      }
      
      // Step 3: Delete duplicate rows (keep only the first one)
      for (const [videoId, duplicates] of Object.entries(existingByVideoId)) {
        if (duplicates.length > 1) {
          console.warn(`⚠️ Found ${duplicates.length} duplicate rows for video_id ${videoId}. Removing duplicates...`);
          const keepId = duplicates[0].id;
          const deleteIds = duplicates.slice(1).map(d => d.id);
          
          // Delete duplicates one by one
          for (const deleteId of deleteIds) {
            const { error: delError } = await supabase
              .from('channel_videos')
              .delete()
              .eq('id', deleteId);
            
            if (delError) {
              console.error(`Error deleting duplicate ${deleteId}:`, delError);
            }
          }
        }
      }
      
      // Step 4: Separate videos into updates and inserts
      videosToUpdate = [];
      newVideosToInsert = [];
      
      for (const video of uniqueVideos) {
        const existing = existingByVideoId[video.video_id]?.[0];
        if (existing) {
          videosToUpdate.push({ ...video, id: existing.id });
        } else {
          newVideosToInsert.push(video);
        }
      }
      
      // Step 5: Update existing videos (one by one to avoid conflicts)
      for (const video of videosToUpdate) {
        const { id, ...updateData } = video;
        const { error: updateError } = await supabase
          .from('channel_videos')
          .update(updateData)
          .eq('id', id);
        
        if (updateError) {
          console.error(`❌ Error updating video ${id}:`, updateError);
          // Continue with other videos instead of failing completely
        }
      }
      
      // Step 6: Insert new videos (batch insert is safe for new records)
      if (newVideosToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('channel_videos')
          .insert(newVideosToInsert);
        
        if (insertError) {
          console.error('❌ Error inserting videos:', insertError);
          // If insert fails due to unique constraint, try individual inserts
          if (insertError.message && (insertError.message.includes('duplicate') || insertError.message.includes('unique'))) {
            console.log('Insert failed due to constraint, trying individual inserts...');
            for (const video of newVideosToInsert) {
              const { error: singleInsertError } = await supabase
                .from('channel_videos')
                .insert(video);
              
              if (singleInsertError && !singleInsertError.message.includes('duplicate')) {
                console.error(`❌ Error inserting video ${video.video_id}:`, singleInsertError);
              }
            }
          } else {
            throw insertError;
          }
        }
      }
      
      console.log(`✅ Processed ${videosToUpdate.length} updates and ${newVideosToInsert.length} inserts`);
    }

    // 8. Update show stats
    const totalProcessed = videosToUpdate.length + newVideosToInsert.length;
    await supabase
      .from('shows')
      .update({
        total_videos_imported: (existingVideos?.length || 0) + totalProcessed,
        last_video_sync: new Date().toISOString()
      })
      .eq('id', showId);

    return NextResponse.json({
      success: true,
      message: `Processed ${totalProcessed} videos (${newVideosToInsert.length} new, ${videosToUpdate.length} updated)${videosToInsert.length > uniqueVideos.length ? ` (${videosToInsert.length - uniqueVideos.length} duplicates removed)` : ''}`,
      added: newVideosToInsert.length,
      updated: videosToUpdate.length,
      videos: uniqueVideos.map(v => ({ id: v.video_id, title: v.title }))
    });

  } catch (error) {
    console.error('Sync new videos error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper: Parse ISO 8601 duration
function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);
  
  return hours * 3600 + minutes * 60 + seconds;
}

