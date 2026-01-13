/**
 * RSS FETCHER
 * Fetches from all configured RSS sources
 */

import { SOURCE_CONFIG, SOURCE_QUALITY } from './sourceConfig.js';

// Dynamic import for rss-parser (CommonJS module)
let Parser;
async function getParser() {
  if (!Parser) {
    const rssParser = await import('rss-parser');
    Parser = rssParser.default || rssParser;
  }
  return Parser;
}

// ============================================
// FETCH ALL RSS FEEDS
// ============================================
export async function fetchAllRSS() {
  const allItems = [];
  const errors = [];
  
  const allFeeds = [
    ...SOURCE_CONFIG.rss.tier1,
    ...SOURCE_CONFIG.rss.tier2,
    ...SOURCE_CONFIG.rss.tier3
  ];
  
  console.log(`📡 Fetching ${allFeeds.length} RSS feeds...`);
  
  const parser = await getParser();
  const parserInstance = new parser({
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)'
    }
  });
  
  // Fetch in parallel with concurrency limit
  const results = await Promise.allSettled(
    allFeeds.map(feed => fetchSingleFeed(feed, parserInstance))
  );
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const feed = allFeeds[i];
    
    if (result.status === 'fulfilled' && result.value) {
      allItems.push(...result.value);
    } else {
      errors.push({
        feed: feed.name,
        error: result.reason?.message || 'Unknown error'
      });
    }
  }
  
  console.log(`   ✅ Fetched ${allItems.length} items from RSS`);
  if (errors.length > 0) {
    console.log(`   ⚠️ ${errors.length} feeds failed`);
  }
  
  return { items: allItems, errors };
}

// ============================================
// FETCH SINGLE FEED
// ============================================
async function fetchSingleFeed(feedConfig, parser) {
  try {
    // Encode URL to handle Arabic characters and special characters
    const encodedUrl = encodeURI(feedConfig.url);
    const feed = await parser.parseURL(encodedUrl);
    
    return feed.items.map(item => ({
      // Standard fields
      title: item.title,
      description: item.contentSnippet || item.content || item.description || '',
      link: item.link,
      pubDate: item.pubDate || item.isoDate,
      
      // Source metadata
      source: {
        name: feedConfig.name,
        category: feedConfig.category,
        quality: feedConfig.quality,
        qualityMultiplier: SOURCE_QUALITY[feedConfig.name] || SOURCE_QUALITY.default
      },
      
      // For tracking
      fetchedAt: new Date().toISOString(),
      sourceType: 'rss'
    }));
    
  } catch (error) {
    console.error(`   ❌ Failed to fetch ${feedConfig.name}: ${error.message}`);
    throw error;
  }
}

// ============================================
// FETCH BY CATEGORY
// ============================================
export async function fetchRSSByCategory(category) {
  const allFeeds = [
    ...SOURCE_CONFIG.rss.tier1,
    ...SOURCE_CONFIG.rss.tier2,
    ...SOURCE_CONFIG.rss.tier3
  ];
  
  const categoryFeeds = allFeeds.filter(f => f.category === category);
  
  const parser = await getParser();
  const parserInstance = new parser({
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)'
    }
  });
  
  const items = [];
  for (const feed of categoryFeeds) {
    try {
      const feedItems = await fetchSingleFeed(feed, parserInstance);
      items.push(...feedItems);
    } catch (e) {
      // Continue on error
    }
  }
  
  return items;
}

// ============================================
// FETCH TIER 1 ONLY (High quality)
// ============================================
export async function fetchTier1Only() {
  const parser = await getParser();
  const parserInstance = new parser({
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)'
    }
  });
  
  const items = [];
  
  for (const feed of SOURCE_CONFIG.rss.tier1) {
    try {
      const feedItems = await fetchSingleFeed(feed, parserInstance);
      items.push(...feedItems);
    } catch (e) {
      // Continue on error
    }
  }
  
  return items;
}


