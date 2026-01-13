/**
 * COMPETITOR STORE
 * Manages competitor channels, videos, and insights
 */

import fs from 'fs/promises';
import path from 'path';
import { CONTENT_TYPES } from './competitorTypes.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'competitors.json');

// ============================================
// LOAD/SAVE DATA
// ============================================
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {
    // Directory might already exist
  }
}

async function loadData() {
  await ensureDataDir();
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { channels: [], videos: [], insights: [], lastUpdated: null };
  }
}

async function saveData(data) {
  await ensureDataDir();
  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  return data;
}

// ============================================
// ADD CHANNEL
// ============================================
export async function addChannel(channel) {
  const data = await loadData();
  
  const channelId = extractChannelId(channel.url || channel.channelId);
  
  if (data.channels.some(c => c.channelId === channelId)) {
    throw new Error('Channel already exists');
  }
  
  const newChannel = {
    id: generateId(),
    channelId,
    name: channel.name || 'Unknown Channel',
    url: channel.url || `https://www.youtube.com/channel/${channelId}`,
    
    // Type classification
    type: channel.type || 'direct_competitor',
    subType: channel.subType || null,
    formatType: channel.formatType || null,
    
    // Metadata
    language: channel.language || 'ar',
    notes: channel.notes || '',
    reasonToWatch: channel.reasonToWatch || '',
    learnFrom: channel.learnFrom || [],
    
    // Status
    monitor: channel.monitor !== false,
    priority: channel.priority || 'medium',
    
    // Timestamps
    addedAt: new Date().toISOString(),
    lastFetched: null,
    lastAnalyzed: null,
    
    // Stats
    stats: {
      videoCount: 0,
      avgViews: 0,
      lastVideoDate: null
    },
    
    // Insights
    insights: []
  };
  
  data.channels.push(newChannel);
  await saveData(data);
  
  return newChannel;
}

// ============================================
// GET CHANNELS
// ============================================
export async function getChannels(filter = {}) {
  const data = await loadData();
  let channels = data.channels;
  
  if (filter.type) {
    channels = channels.filter(c => c.type === filter.type);
  }
  if (filter.monitor !== undefined) {
    channels = channels.filter(c => c.monitor === filter.monitor);
  }
  
  return channels;
}

// ============================================
// GET CHANNELS BY TYPE
// ============================================
export async function getChannelsByType(type) {
  return getChannels({ type });
}

// ============================================
// UPDATE CHANNEL
// ============================================
export async function updateChannel(id, updates) {
  const data = await loadData();
  const channel = data.channels.find(c => c.id === id);
  
  if (channel) {
    Object.assign(channel, updates);
    channel.updatedAt = new Date().toISOString();
    await saveData(data);
  }
  
  return channel;
}

// ============================================
// DELETE CHANNEL
// ============================================
export async function deleteChannel(id) {
  const data = await loadData();
  data.channels = data.channels.filter(c => c.id !== id);
  await saveData(data);
  return true;
}

// ============================================
// TOGGLE MONITOR
// ============================================
export async function toggleChannelMonitor(id) {
  const data = await loadData();
  const channel = data.channels.find(c => c.id === id);
  
  if (channel) {
    channel.monitor = !channel.monitor;
    await saveData(data);
  }
  
  return channel;
}

// ============================================
// GET ACTIVE CHANNELS
// ============================================
export async function getActiveChannels() {
  return getChannels({ monitor: true });
}

// ============================================
// ADD VIDEO
// ============================================
export async function addVideo(video) {
  const data = await loadData();
  
  const videoId = extractVideoId(video.url || video.videoId);
  
  if (data.videos.some(v => v.videoId === videoId)) {
    throw new Error('Video already exists');
  }
  
  const newVideo = {
    id: generateId(),
    videoId,
    url: video.url || `https://www.youtube.com/watch?v=${videoId}`,
    title: video.title || '',
    channelName: video.channelName || '',
    channelId: video.channelId || null,
    reason: video.reason || '',
    contentType: video.contentType || 'direct_competitor',
    learnPoints: video.learnPoints || [],
    tags: video.tags || [],
    analyzed: false,
    analysis: null,
    addedAt: new Date().toISOString()
  };
  
  data.videos.push(newVideo);
  await saveData(data);
  
  return newVideo;
}

// ============================================
// GET VIDEOS
// ============================================
export async function getVideos(filter = {}) {
  const data = await loadData();
  let videos = data.videos;
  
  if (filter.channelId) {
    videos = videos.filter(v => v.channelId === filter.channelId);
  }
  if (filter.contentType) {
    videos = videos.filter(v => v.contentType === filter.contentType);
  }
  
  return videos;
}

// ============================================
// DELETE VIDEO
// ============================================
export async function deleteVideo(id) {
  const data = await loadData();
  data.videos = data.videos.filter(v => v.id !== id);
  await saveData(data);
  return true;
}

// ============================================
// UPDATE VIDEO
// ============================================
export async function updateVideo(id, updates) {
  const data = await loadData();
  const video = data.videos.find(v => v.id === id);
  
  if (video) {
    Object.assign(video, updates);
    video.updatedAt = new Date().toISOString();
    await saveData(data);
  }
  
  return video;
}

// ============================================
// ADD INSIGHT
// ============================================
export async function addInsight(insight) {
  const data = await loadData();
  
  const newInsight = {
    id: generateId(),
    channelId: insight.channelId || null,
    videoId: insight.videoId || null,
    type: insight.type,
    title: insight.title,
    description: insight.description,
    actionable: insight.actionable || false,
    action: insight.action || null,
    status: 'new',
    addedAt: new Date().toISOString()
  };
  
  data.insights.push(newInsight);
  await saveData(data);
  
  return newInsight;
}

// ============================================
// GET INSIGHTS
// ============================================
export async function getInsights(filter = {}) {
  const data = await loadData();
  let insights = data.insights;
  
  if (filter.type) {
    insights = insights.filter(i => i.type === filter.type);
  }
  if (filter.status) {
    insights = insights.filter(i => i.status === filter.status);
  }
  if (filter.actionable !== undefined) {
    insights = insights.filter(i => i.actionable === filter.actionable);
  }
  
  return insights;
}

// ============================================
// UPDATE INSIGHT STATUS
// ============================================
export async function updateInsightStatus(id, status) {
  const data = await loadData();
  const insight = data.insights.find(i => i.id === id);
  
  if (insight) {
    insight.status = status;
    insight.updatedAt = new Date().toISOString();
    await saveData(data);
  }
  
  return insight;
}

// ============================================
// GET DASHBOARD STATS
// ============================================
export async function getDashboardStats() {
  const data = await loadData();
  
  const channelsByType = {};
  for (const type of Object.keys(CONTENT_TYPES)) {
    channelsByType[type] = data.channels.filter(c => c.type === type).length;
  }
  
  return {
    totalChannels: data.channels.length,
    activeChannels: data.channels.filter(c => c.monitor).length,
    channelsByType,
    totalVideos: data.videos.length,
    totalInsights: data.insights.length,
    newInsights: data.insights.filter(i => i.status === 'new').length,
    actionableInsights: data.insights.filter(i => i.actionable && i.status !== 'applied').length
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function extractChannelId(input) {
  if (!input) return null;
  if (input.startsWith('UC') && input.length === 24) return input;
  
  const patterns = [
    /youtube\.com\/channel\/(UC[\w-]{22})/,
    /youtube\.com\/c\/([\w-]+)/,
    /youtube\.com\/@([\w-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return input;
}

function extractVideoId(input) {
  if (!input) return null;
  if (/^[\w-]{11}$/.test(input)) return input;
  
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return input;
}




