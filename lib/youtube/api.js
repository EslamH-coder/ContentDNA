import { google } from 'googleapis';
import { oauth2Client, setCredentials } from './auth';

function getYouTubeClient(tokens) {
  setCredentials(tokens);
  return google.youtube({ version: 'v3', auth: oauth2Client });
}

function getAnalyticsClient(tokens) {
  setCredentials(tokens);
  return google.youtubeAnalytics({ version: 'v2', auth: oauth2Client });
}

// Get channel info
export async function getChannelInfo(tokens) {
  const youtube = getYouTubeClient(tokens);
  const response = await youtube.channels.list({
    part: 'snippet,statistics,contentDetails',
    mine: true
  });
  return response.data.items?.[0];
}

// Get all playlists
export async function getPlaylists(tokens, channelId) {
  const youtube = getYouTubeClient(tokens);
  const playlists = [];
  let nextPageToken = null;
  
  do {
    const response = await youtube.playlists.list({
      part: 'snippet,contentDetails',
      channelId,
      maxResults: 50,
      pageToken: nextPageToken
    });
    playlists.push(...(response.data.items || []));
    nextPageToken = response.data.nextPageToken;
  } while (nextPageToken);
  
  return playlists;
}

// Get videos from playlist
export async function getPlaylistVideos(tokens, playlistId, maxVideos = 500) {
  const youtube = getYouTubeClient(tokens);
  const videos = [];
  let nextPageToken = null;
  
  do {
    const response = await youtube.playlistItems.list({
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: 50,
      pageToken: nextPageToken
    });
    videos.push(...(response.data.items || []));
    nextPageToken = response.data.nextPageToken;
  } while (nextPageToken && videos.length < maxVideos);
  
  return videos;
}

// Get all channel videos (uploads playlist)
export async function getChannelVideos(tokens, channelId, maxVideos = 500) {
  const youtube = getYouTubeClient(tokens);
  const channelResponse = await youtube.channels.list({
    part: 'contentDetails',
    id: channelId
  });
  
  const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error('Could not find uploads playlist');
  
  return getPlaylistVideos(tokens, uploadsPlaylistId, maxVideos);
}

// Get detailed video info
export async function getVideoDetails(tokens, videoIds) {
  const youtube = getYouTubeClient(tokens);
  const details = [];
  
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const response = await youtube.videos.list({
      part: 'snippet,statistics,contentDetails',
      id: batch.join(',')
    });
    details.push(...(response.data.items || []));
  }
  
  return details;
}

// Get analytics for a video including traffic sources
export async function getVideoAnalytics(tokens, channelId, videoId, publishDate) {
  const analytics = getAnalyticsClient(tokens);
  
  const publishDateObj = new Date(publishDate);
  const day7 = new Date(publishDateObj.getTime() + 7 * 24 * 60 * 60 * 1000);
  const day30 = new Date(publishDateObj.getTime() + 30 * 24 * 60 * 60 * 1000);
  const today = new Date();
  
  const formatDate = (d) => d.toISOString().split('T')[0];
  const endDate7 = day7 < today ? day7 : today;
  const endDate30 = day30 < today ? day30 : today;
  
  try {
    // Get basic metrics for 7 days
    const response7 = await analytics.reports.query({
      ids: `channel==${channelId}`,
      startDate: formatDate(publishDateObj),
      endDate: formatDate(endDate7),
      metrics: 'views,likes,comments,shares,estimatedMinutesWatched,averageViewDuration,subscribersGained',
      filters: `video==${videoId}`
    });
    
    // Get basic metrics for 30 days
    const response30 = await analytics.reports.query({
      ids: `channel==${channelId}`,
      startDate: formatDate(publishDateObj),
      endDate: formatDate(endDate30),
      metrics: 'views,likes,comments,shares,estimatedMinutesWatched,averageViewDuration,subscribersGained',
      filters: `video==${videoId}`
    });
    
    // Get traffic sources for 7 days
    const trafficResponse7 = await analytics.reports.query({
      ids: `channel==${channelId}`,
      startDate: formatDate(publishDateObj),
      endDate: formatDate(endDate7),
      metrics: 'views',
      dimensions: 'insightTrafficSourceType',
      filters: `video==${videoId}`
    });
    
    // Get traffic sources for 30 days
    const trafficResponse30 = await analytics.reports.query({
      ids: `channel==${channelId}`,
      startDate: formatDate(publishDateObj),
      endDate: formatDate(endDate30),
      metrics: 'views',
      dimensions: 'insightTrafficSourceType',
      filters: `video==${videoId}`
    });
    
    // Parse basic metrics
    const parseMetrics = (response) => {
      const row = response.data.rows?.[0] || [];
      const headers = response.data.columnHeaders?.map(h => h.name) || [];
      const result = {};
      headers.forEach((h, i) => result[h] = row[i] || 0);
      return result;
    };
    
    // Parse traffic sources
    const parseTraffic = (response) => {
      const rows = response.data.rows || [];
      const traffic = {
        total: 0,
        ads: 0,
        organic: 0,
        browse: 0,
        search: 0,
        suggested: 0,
        external: 0,
        shorts: 0,
        other: 0
      };
      
      rows.forEach(row => {
        const source = row[0]; // Traffic source type
        const views = row[1] || 0; // Views
        
        traffic.total += views;
        
        // Categorize traffic sources
        // ADVERTISING = paid ads
        if (source === 'ADVERTISING') {
          traffic.ads += views;
        }
        // Everything else is organic
        else {
          traffic.organic += views;
          
          if (source === 'BROWSE' || source === 'BROWSE_FEATURES') {
            traffic.browse += views;
          } else if (source === 'SEARCH' || source === 'YT_SEARCH') {
            traffic.search += views;
          } else if (source === 'SUGGESTED' || source === 'RELATED_VIDEO') {
            traffic.suggested += views;
          } else if (source === 'EXT_URL' || source === 'EXTERNAL') {
            traffic.external += views;
          } else if (source === 'SHORTS' || source === 'YT_SHORTS') {
            traffic.shorts += views;
          } else {
            traffic.other += views;
          }
        }
      });
      
      return traffic;
    };
    
    const metrics7 = parseMetrics(response7);
    const metrics30 = parseMetrics(response30);
    const traffic7 = parseTraffic(trafficResponse7);
    const traffic30 = parseTraffic(trafficResponse30);
    
    return {
      day7: {
        ...metrics7,
        views_total: traffic7.total || metrics7.views || 0,
        views_ads: traffic7.ads,
        views_organic: traffic7.organic,
        traffic_browse: traffic7.browse,
        traffic_search: traffic7.search,
        traffic_suggested: traffic7.suggested,
        traffic_external: traffic7.external,
        traffic_shorts: traffic7.shorts
      },
      day30: {
        ...metrics30,
        views_total: traffic30.total || metrics30.views || 0,
        views_ads: traffic30.ads,
        views_organic: traffic30.organic,
        traffic_browse: traffic30.browse,
        traffic_search: traffic30.search,
        traffic_suggested: traffic30.suggested,
        traffic_external: traffic30.external,
        traffic_shorts: traffic30.shorts
      }
    };
  } catch (error) {
    console.error(`Analytics error for ${videoId}:`, error.message);
    return null;
  }
}

// Parse ISO 8601 duration
export function parseDuration(duration) {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || 0) * 3600 + parseInt(match[2] || 0) * 60 + parseInt(match[3] || 0);
}

// Extract URLs from description
export function extractUrlsFromDescription(description) {
  if (!description) return [];
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
  const matches = description.match(urlRegex) || [];
  return [...new Set(matches)];
}

