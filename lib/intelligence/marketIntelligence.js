/**
 * MARKET INTELLIGENCE
 * Generate topic suggestions from audience data
 */

import fs from 'fs/promises';
import path from 'path';

// ============================================
// GENERATE MARKET SUGGESTIONS
// ============================================
export async function generateMarketSuggestions() {
  const suggestions = [];
  const basePath = process.cwd();
  
  try {
    // From audience channels
    const channelsPath = path.join(basePath, 'data/processed/channels.json');
    const channelsData = JSON.parse(await fs.readFile(channelsPath, 'utf-8'));
    
    if (channelsData?.channels) {
      for (const channel of channelsData.channels.slice(0, 5)) {
        if (channel.topics && channel.topics.length > 0) {
          suggestions.push({
            type: 'AUDIENCE_CHANNEL',
            topic: channel.topics[0],
            evidence: `Audience watches: ${channel.name}`,
            source: channel.name
          });
        }
      }
    }
  } catch (e) {
    // File doesn't exist - that's okay
  }
  
  try {
    // From search terms
    const searchPath = path.join(basePath, 'data/processed/search_terms.json');
    const searchData = JSON.parse(await fs.readFile(searchPath, 'utf-8'));
    
    if (searchData?.terms) {
      for (const term of searchData.terms.slice(0, 5)) {
        if (term.views > 100) {
          suggestions.push({
            type: 'SEARCH_TERM',
            topic: term.term,
            evidence: `${term.views} searches`,
            source: 'YouTube Search'
          });
        }
      }
    }
  } catch (e) {
    // File doesn't exist - that's okay
  }
  
  try {
    // From audience videos
    const videosPath = path.join(basePath, 'data/processed/audience_videos.json');
    const videosData = JSON.parse(await fs.readFile(videosPath, 'utf-8'));
    
    if (videosData?.videos) {
      for (const video of videosData.videos.slice(0, 5)) {
        if (video.title) {
          suggestions.push({
            type: 'AUDIENCE_VIDEO',
            topic: video.title.substring(0, 50),
            evidence: `Audience watches this`,
            source: video.channel || 'Unknown'
          });
        }
      }
    }
  } catch (e) {
    // File doesn't exist - that's okay
  }
  
  return suggestions;
}

// ============================================
// ADD COMPETITOR VIDEO
// ============================================
export async function addCompetitorVideo(video) {
  // This would store competitor videos for analysis
  // For now, just return the video
  return video;
}

// ============================================
// GET RECENT COMPETITOR TOPICS
// ============================================
export async function getRecentCompetitorTopics() {
  // This would analyze competitor videos and extract topics
  // For now, return empty array
  return [];
}




