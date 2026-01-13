import { getChannelEntities, matchesChannelEntities } from '../entities/channelEntities';

/**
 * Filter RSS items to only include those relevant to channel
 * Returns filtered items with match metadata
 */
export async function filterRSSByChannelEntities(rssItems, showId) {
  if (!rssItems || !Array.isArray(rssItems) || rssItems.length === 0) {
    return [];
  }

  const channelEntities = await getChannelEntities(showId);
  
  if (!channelEntities.entities.length) {
    console.warn(`⚠️ No entities found for show ${showId}, skipping RSS filter`);
    return rssItems; // No filter if no entities
  }
  
  console.log(`🔍 Filtering ${rssItems.length} RSS items against ${channelEntities.entities.length} channel entities`);
  
  const filteredItems = [];
  const skippedItems = [];
  
  for (const item of rssItems) {
    // Check title and description
    const textToCheck = `${item.title || ''} ${item.description || ''} ${item.content || ''}`.trim();
    
    if (!textToCheck) {
      skippedItems.push(item.title || 'No title');
      continue;
    }
    
    const matchResult = matchesChannelEntities(textToCheck, channelEntities);
    
    if (matchResult.matches) {
      filteredItems.push({
        ...item,
        _entityMatch: {
          matchedEntities: matchResult.matchedEntities,
          matchScore: matchResult.matchScore
        }
      });
    } else {
      skippedItems.push(item.title || 'No title');
    }
  }
  
  console.log(`✅ Kept ${filteredItems.length}/${rssItems.length} items (${skippedItems.length} filtered out)`);
  
  // Log some skipped items for debugging
  if (skippedItems.length > 0 && skippedItems.length <= 10) {
    console.log(`⏭️ Skipped items:`, skippedItems);
  } else if (skippedItems.length > 10) {
    console.log(`⏭️ Skipped items (first 10):`, skippedItems.slice(0, 10));
  }
  
  return filteredItems;
}

/**
 * Score RSS items by entity relevance
 * Higher score = more relevant to channel
 */
export async function scoreRSSByRelevance(rssItems, showId) {
  if (!rssItems || !Array.isArray(rssItems)) {
    return [];
  }

  const channelEntities = await getChannelEntities(showId);
  
  return rssItems.map(item => {
    const textToCheck = `${item.title || ''} ${item.description || ''}`.trim();
    const matchResult = matchesChannelEntities(textToCheck, channelEntities);
    
    return {
      ...item,
      relevanceScore: matchResult.matchScore,
      matchedEntities: matchResult.matchedEntities,
      _entityMatch: {
        matchedEntities: matchResult.matchedEntities,
        matchScore: matchResult.matchScore
      }
    };
  }).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
}

/**
 * Check if a single RSS item is relevant to channel
 */
export async function isRSSItemRelevant(item, showId) {
  if (!item) return false;
  
  const channelEntities = await getChannelEntities(showId);
  const textToCheck = `${item.title || ''} ${item.description || ''}`.trim();
  const matchResult = matchesChannelEntities(textToCheck, channelEntities);
  
  return matchResult.matches;
}
