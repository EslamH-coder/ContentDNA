/**
 * SOURCE AGGREGATOR
 * Combines all sources, deduplicates, and scores
 */

import { fetchAllRSS, fetchTier1Only } from './rssFetcher.js';
import { fetchAllGoogleNews, fetchHighPriorityNews } from './googleNewsFetcher.js';
import { SOURCE_QUALITY } from './sourceConfig.js';

// ============================================
// FETCH ALL SOURCES
// ============================================
export async function fetchAllSources() {
  console.log('\n📰 FETCHING ALL SOURCES\n');
  
  const startTime = Date.now();
  
  // Fetch in parallel
  const [rssResult, googleItems] = await Promise.all([
    fetchAllRSS().catch(() => ({ items: [], errors: [] })),
    fetchAllGoogleNews().catch(() => [])
  ]);
  
  // Combine all items
  let allItems = [
    ...rssResult.items,
    ...googleItems
  ];
  
  // Deduplicate
  allItems = deduplicateItems(allItems);
  
  // Apply source quality multiplier
  allItems = applyQualityScore(allItems);
  
  // Sort by adjusted quality
  allItems.sort((a, b) => (b.adjustedQuality || 0) - (a.adjustedQuality || 0));
  
  const duration = Date.now() - startTime;
  
  console.log(`\n✅ AGGREGATION COMPLETE`);
  console.log(`   Total items: ${allItems.length}`);
  console.log(`   Duration: ${duration}ms`);
  
  return {
    items: allItems,
    stats: {
      total: allItems.length,
      fromRSS: rssResult.items.length,
      fromGoogleNews: googleItems.length,
      duration: `${duration}ms`
    }
  };
}

// ============================================
// FETCH FAST (High priority only)
// ============================================
export async function fetchFast() {
  console.log('\n⚡ FAST FETCH (High priority only)\n');
  
  const [rssItems, googleItems] = await Promise.all([
    fetchTier1Only().catch(() => []),
    fetchHighPriorityNews().catch(() => [])
  ]);
  
  let allItems = [...rssItems, ...googleItems];
  allItems = deduplicateItems(allItems);
  allItems = applyQualityScore(allItems);
  allItems.sort((a, b) => (b.adjustedQuality || 0) - (a.adjustedQuality || 0));
  
  console.log(`   ✅ Fast fetch: ${allItems.length} items`);
  
  return allItems;
}

// ============================================
// DEDUPLICATE ITEMS
// ============================================
function deduplicateItems(items) {
  const seen = new Map();
  
  for (const item of items) {
    // Create a simple hash from title
    const hash = item.title?.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '').substring(0, 50);
    
    if (!hash) continue;
    
    if (!seen.has(hash)) {
      seen.set(hash, item);
    } else {
      // Keep the one with higher quality source
      const existing = seen.get(hash);
      if ((item.source?.quality || 0) > (existing.source?.quality || 0)) {
        seen.set(hash, item);
      }
    }
  }
  
  return Array.from(seen.values());
}

// ============================================
// APPLY QUALITY SCORE
// ============================================
function applyQualityScore(items) {
  return items.map(item => {
    const baseQuality = item.source?.quality || 5;
    const multiplier = SOURCE_QUALITY[item.source?.name] || SOURCE_QUALITY.default;
    
    const adjustedQuality = baseQuality * multiplier;
    
    return {
      ...item,
      adjustedQuality: Math.round(adjustedQuality * 10) / 10
    };
  });
}

// ============================================
// GET ITEMS BY TOPIC
// ============================================
export function filterByTopic(items, topic) {
  const topicKeywords = {
    'trump': ['trump', 'ترامب', 'ترمب'],
    'china': ['china', 'الصين', 'chinese', 'beijing'],
    'oil': ['oil', 'نفط', 'opec', 'crude', 'petroleum'],
    'economy': ['economy', 'اقتصاد', 'gdp', 'growth', 'inflation'],
    'arab': ['saudi', 'السعودية', 'egypt', 'مصر', 'uae', 'gulf', 'الخليج']
  };
  
  const keywords = topicKeywords[topic.toLowerCase()] || [topic.toLowerCase()];
  
  return items.filter(item => {
    const text = `${item.title} ${item.description}`.toLowerCase();
    return keywords.some(kw => text.includes(kw));
  });
}




