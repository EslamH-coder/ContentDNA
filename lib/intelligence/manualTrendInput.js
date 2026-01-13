/**
 * MANUAL TREND INPUT
 * Store and manage manually spotted trends
 */

import fs from 'fs/promises';
import path from 'path';

const TRENDS_FILE = path.join(process.cwd(), 'data/manual_trends.json');

// ============================================
// LOAD TRENDS
// ============================================
async function loadTrends() {
  try {
    const content = await fs.readFile(TRENDS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

// ============================================
// SAVE TRENDS
// ============================================
async function saveTrends(trends) {
  // Ensure directory exists
  const dir = path.dirname(TRENDS_FILE);
  await fs.mkdir(dir, { recursive: true });
  
  await fs.writeFile(TRENDS_FILE, JSON.stringify(trends, null, 2));
}

// ============================================
// ADD MANUAL TREND
// ============================================
export async function addManualTrend(trend) {
  const trends = await loadTrends();
  
  const newTrend = {
    id: `trend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: trend.type || 'manual',
    topic: trend.topic || '',
    description: trend.description || '',
    url: trend.url || '',
    note: trend.note || '',
    persona: trend.persona || null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  trends.push(newTrend);
  await saveTrends(trends);
  
  return newTrend;
}

// ============================================
// ADD TWITTER TREND
// ============================================
export async function addTwitterTrend(url, note = '') {
  return addManualTrend({
    type: 'twitter',
    url,
    note,
    topic: `Twitter Trend: ${url}`
  });
}

// ============================================
// ADD TIKTOK TREND
// ============================================
export async function addTikTokTrend(url, note = '') {
  return addManualTrend({
    type: 'tiktok',
    url,
    note,
    topic: `TikTok Trend: ${url}`
  });
}

// ============================================
// ADD TOPIC IDEA
// ============================================
export async function addTopicIdea(topic, description = '', persona = null) {
  return addManualTrend({
    type: 'idea',
    topic,
    description,
    persona
  });
}

// ============================================
// ADD ANY URL
// ============================================
export async function addAnyUrl(url, note = '') {
  return addManualTrend({
    type: 'url',
    url,
    note,
    topic: `URL: ${url}`
  });
}

// ============================================
// GET PENDING TRENDS
// ============================================
export async function getPendingTrends() {
  const trends = await loadTrends();
  return trends.filter(t => t.status === 'pending');
}

// ============================================
// GET ALL TRENDS
// ============================================
export async function getAllManualTrends() {
  return loadTrends();
}

// ============================================
// UPDATE TREND STATUS
// ============================================
export async function updateTrendStatus(trendId, status) {
  const trends = await loadTrends();
  const trend = trends.find(t => t.id === trendId);
  
  if (trend) {
    trend.status = status;
    trend.updatedAt = new Date().toISOString();
    await saveTrends(trends);
    return trend;
  }
  
  return null;
}




