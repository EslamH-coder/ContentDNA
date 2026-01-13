/**
 * GOOGLE NEWS FETCHER
 * Fetches targeted news using custom search queries
 */

import { SOURCE_CONFIG } from './sourceConfig.js';

// Dynamic import for rss-parser
let Parser;
async function getParser() {
  if (!Parser) {
    const rssParser = await import('rss-parser');
    Parser = rssParser.default || rssParser;
  }
  return Parser;
}

// ============================================
// BUILD GOOGLE NEWS RSS URL
// ============================================
function buildGoogleNewsURL(query, options = {}) {
  const { 
    language = 'en',
    region = 'US',
    period = '1d'  // 1d, 7d, 1m
  } = options;
  
  const encodedQuery = encodeURIComponent(query);
  
  // Google News RSS format
  return `https://news.google.com/rss/search?q=${encodedQuery}+when:${period}&hl=${language}&gl=${region}&ceid=${region}:${language}`;
}

// ============================================
// FETCH GOOGLE NEWS BY QUERY
// ============================================
export async function fetchGoogleNews(queryConfig) {
  try {
    const parser = await getParser();
    const parserInstance = new parser();
    
    const url = buildGoogleNewsURL(queryConfig.query);
    // Encode the full URL to handle any remaining unescaped characters
    const encodedUrl = encodeURI(url);
    const feed = await parserInstance.parseURL(encodedUrl);
    
    return feed.items.slice(0, 10).map(item => ({
      title: cleanGoogleTitle(item.title),
      description: item.contentSnippet || '',
      link: item.link,
      pubDate: item.pubDate || item.isoDate,
      
      source: {
        name: 'Google News',
        query: queryConfig.name,
        category: queryConfig.category || 'general',
        quality: 8,
        qualityMultiplier: 1.0,
        expectedScore: queryConfig.expectedScore
      },
      
      fetchedAt: new Date().toISOString(),
      sourceType: 'google_news'
    }));
    
  } catch (error) {
    console.error(`   ❌ Failed to fetch Google News for "${queryConfig.name}": ${error.message}`);
    return [];
  }
}

// Clean Google News title (remove source suffix)
function cleanGoogleTitle(title) {
  // Remove " - Source Name" from end
  return title.replace(/\s*-\s*[^-]+$/, '').trim();
}

// ============================================
// FETCH ALL GOOGLE NEWS QUERIES
// ============================================
export async function fetchAllGoogleNews() {
  const allItems = [];
  
  const allQueries = [
    ...SOURCE_CONFIG.googleNews.powerPlayers,
    ...SOURCE_CONFIG.googleNews.conflicts,
    ...SOURCE_CONFIG.googleNews.economy,
    ...SOURCE_CONFIG.googleNews.arabRegion,
    ...SOURCE_CONFIG.googleNews.tech
  ];
  
  console.log(`🔍 Fetching ${allQueries.length} Google News queries...`);
  
  for (const queryConfig of allQueries) {
    const items = await fetchGoogleNews(queryConfig);
    allItems.push(...items);
    
    // Small delay to avoid rate limiting
    await sleep(200);
  }
  
  console.log(`   ✅ Fetched ${allItems.length} items from Google News`);
  
  return allItems;
}

// ============================================
// FETCH HIGH-PRIORITY ONLY
// (Power players + Arab region)
// ============================================
export async function fetchHighPriorityNews() {
  const items = [];
  
  const highPriorityQueries = [
    ...SOURCE_CONFIG.googleNews.powerPlayers,
    ...SOURCE_CONFIG.googleNews.arabRegion
  ];
  
  console.log(`⚡ Fetching ${highPriorityQueries.length} high-priority queries...`);
  
  for (const queryConfig of highPriorityQueries) {
    const queryItems = await fetchGoogleNews(queryConfig);
    items.push(...queryItems);
    await sleep(200);
  }
  
  console.log(`   ✅ Fetched ${items.length} high-priority items`);
  
  return items;
}

// ============================================
// FETCH BY CATEGORY
// ============================================
export async function fetchGoogleNewsByCategory(category) {
  const categoryQueries = SOURCE_CONFIG.googleNews[category];
  
  if (!categoryQueries) {
    console.warn(`Category "${category}" not found`);
    return [];
  }
  
  const items = [];
  for (const queryConfig of categoryQueries) {
    const queryItems = await fetchGoogleNews(queryConfig);
    items.push(...queryItems);
    await sleep(200);
  }
  
  return items;
}

// ============================================
// CUSTOM QUERY
// ============================================
export async function searchGoogleNews(query, options = {}) {
  const queryConfig = {
    name: `Custom: ${query}`,
    query: query,
    expectedScore: 60,
    ...options
  };
  
  return fetchGoogleNews(queryConfig);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


