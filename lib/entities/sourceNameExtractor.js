import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cache for source names
const sourceNameCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Auto-extract all source names that should be excluded from keyword matching
 * Extracts from: competitors, RSS feeds, RSS items, subreddits
 * @param {string} showId - The show ID to extract source names for
 * @returns {Promise<string[]>} Array of excluded source names (lowercase)
 */
export async function getExcludedSourceNames(showId) {
  if (!showId) {
    console.warn('⚠️ No showId provided to getExcludedSourceNames');
    return [];
  }

  // Check cache
  const cached = sourceNameCache.get(showId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`📦 Using cached source names for show ${showId} (${cached.data.length} names)`);
    return cached.data;
  }
  
  console.log(`🔍 Auto-extracting source names for show ${showId}`);
  
  const sourceNames = new Set();
  
  // 1. Get competitor channel names
  try {
    const { data: competitors, error } = await supabase
      .from('competitors')
      .select('name, channel_title, youtube_handle')
      .eq('show_id', showId);
    
    if (error) {
      console.warn('Error fetching competitors for source names:', error);
    } else {
      for (const comp of competitors || []) {
        if (comp.name) {
          const name = comp.name.toLowerCase().trim();
          if (name.length > 0) sourceNames.add(name);
        }
        if (comp.channel_title) {
          const title = comp.channel_title.toLowerCase().trim();
          if (title.length > 0) sourceNames.add(title);
        }
        if (comp.youtube_handle) {
          // Remove @ from handle
          const handle = comp.youtube_handle.replace('@', '').toLowerCase().trim();
          if (handle.length > 0) sourceNames.add(handle);
        }
      }
      console.log(`   📊 Found ${competitors?.length || 0} competitors`);
    }
  } catch (e) {
    console.warn('Error processing competitors:', e);
  }
  
  // 2. Get RSS feed names and domains (from signal_sources table)
  try {
    const { data: feeds, error } = await supabase
      .from('signal_sources')
      .select('name, url')
      .eq('show_id', showId);
    
    if (error) {
      console.warn('Error fetching RSS feeds for source names:', error);
    } else {
      // Common section/category words that should NOT be extracted as source names
      const COMMON_SECTION_WORDS = ['اقتصاد', 'economy', 'الاقتصاد', 'economic', 'news', 'أخبار', 'sports', 'رياضة', 'politics', 'سياسة'];
      
      for (const feed of feeds || []) {
        if (feed.name) {
          const name = feed.name.toLowerCase().trim();
          // FIXED: Don't extract common section words from feed names
          // If feed name is like "العربية - اقتصاد", extract "العربية" but not "اقتصاد"
          if (name.length > 0) {
            // Check if name contains a dash (indicates section name like "العربية - اقتصاد")
            if (name.includes(' - ') || name.includes('-')) {
              // Extract only the part BEFORE the dash (the actual source name)
              const dashIndex = name.includes(' - ') ? name.indexOf(' - ') : name.indexOf('-');
              const sourcePart = name.substring(0, dashIndex).trim();
              // Only add if it's not a common section word and has minimum length
              if (sourcePart.length > 2 && !COMMON_SECTION_WORDS.some(cw => sourcePart === cw.toLowerCase())) {
                sourceNames.add(sourcePart);
              }
              // DON'T add the part after the dash (the section name like "اقتصاد")
            } else {
              // No dash, add the whole name if it's not a common word
              if (!COMMON_SECTION_WORDS.some(cw => name === cw.toLowerCase())) {
                sourceNames.add(name);
              }
            }
          }
        }
        
        // Extract domain from URL
        if (feed.url) {
          try {
            const url = new URL(feed.url);
            const domain = url.hostname.replace('www.', '').toLowerCase();
            sourceNames.add(domain);
            
            // Also add domain without TLD (e.g., "bloomberg" from "bloomberg.com")
            const domainParts = domain.split('.');
            if (domainParts.length > 1) {
              const domainName = domainParts[0];
              if (domainName.length > 2) {
                sourceNames.add(domainName);
              }
            }
          } catch (e) {
            // Invalid URL, skip
          }
        }
      }
      console.log(`   📡 Found ${feeds?.length || 0} RSS feeds`);
    }
  } catch (e) {
    console.warn('Error processing RSS feeds:', e);
  }
  
  // 3. Get unique sources from RSS items (if table exists)
  try {
    const { data: rssSources, error } = await supabase
      .from('rss_items')
      .select('source')
      .eq('show_id', showId)
      .not('source', 'is', null)
      .limit(1000); // Limit to avoid huge queries
    
    if (error) {
      // Table might not exist, skip
      console.log('   ℹ️  rss_items table not available or error:', error.message);
    } else {
      // Common section/category words that should NOT be extracted as source names
      const COMMON_SECTION_WORDS = ['اقتصاد', 'economy', 'الاقتصاد', 'economic', 'news', 'أخبار', 'sports', 'رياضة', 'politics', 'سياسة'];
      
      // Get unique sources
      const uniqueSources = [...new Set(rssSources?.map(r => r.source).filter(Boolean) || [])];
      for (const source of uniqueSources) {
        if (source) {
          const normalized = source.toLowerCase().trim();
          if (normalized.length > 0) {
            // FIXED: Don't add common section words as source names
            if (!COMMON_SECTION_WORDS.some(cw => normalized === cw.toLowerCase())) {
              sourceNames.add(normalized);
              
              // Handle subreddit format "r/worldnews" -> add "worldnews"
              if (normalized.startsWith('r/')) {
                const subredditName = normalized.substring(2).trim();
                if (subredditName.length > 0 && !COMMON_SECTION_WORDS.some(cw => subredditName === cw.toLowerCase())) {
                  sourceNames.add(subredditName);
                }
              }
            }
          }
        }
      }
      console.log(`   📰 Found ${uniqueSources.length} unique RSS sources`);
    }
  } catch (e) {
    // Table might not exist, skip
    console.log('   ℹ️  rss_items table not available');
  }
  
  // 4. Get subreddits (if separate table exists)
  try {
    const { data: subreddits, error } = await supabase
      .from('subreddits')
      .select('name, display_name')
      .eq('show_id', showId);
    
    if (error) {
      // Table might not exist, skip
      console.log('   ℹ️  subreddits table not available');
    } else {
      for (const sub of subreddits || []) {
        if (sub.name) {
          const name = sub.name.toLowerCase().trim();
          if (name.length > 0) sourceNames.add(name);
        }
        if (sub.display_name) {
          const displayName = sub.display_name.toLowerCase().trim();
          if (displayName.length > 0) sourceNames.add(displayName);
        }
      }
      console.log(`   🔴 Found ${subreddits?.length || 0} subreddits`);
    }
  } catch (e) {
    // Table might not exist, skip
    console.log('   ℹ️  subreddits table not available');
  }
  
  // 5. Add common variations (but exclude common words)
  // Common words that are sections/categories, not source names
  const COMMON_SECTION_WORDS = ['اقتصاد', 'economy', 'الاقتصاد', 'economic', 'news', 'أخبار', 'sports', 'رياضة', 'politics', 'سياسة'];
  
  const variations = new Set();
  for (const name of sourceNames) {
    // Skip common section words (they're categories, not source names)
    const lowerName = name.toLowerCase();
    if (COMMON_SECTION_WORDS.some(cw => lowerName === cw.toLowerCase())) {
      continue; // Don't add variations for common words
    }
    
    // Add without common prefixes/suffixes
    let cleaned = name
      .replace(/^al[- ]?/i, '')  // "al jazeera" -> "jazeera"
      .replace(/^el[- ]?/i, '')  // "el pais" -> "pais"
      .replace(/[- ]?(net|news|direct|online|arabic|english)$/i, '')  // "bloomberg direct" -> "bloomberg"
      .trim();
    
    // Don't add variation if it's a common word
    const lowerCleaned = cleaned.toLowerCase();
    if (cleaned.length > 2 && cleaned !== name && !COMMON_SECTION_WORDS.some(cw => lowerCleaned === cw.toLowerCase())) {
      variations.add(cleaned);
    }
    
    // Add Arabic article variations (but skip if it's a common word)
    if (name.startsWith('ال')) {
      const withoutAl = name.substring(2).trim();
      if (withoutAl.length > 0 && !COMMON_SECTION_WORDS.some(cw => withoutAl.toLowerCase() === cw.toLowerCase())) {
        variations.add(withoutAl); // "الجزيرة" -> "جزيرة"
      }
    }
    
    // Add without "news" suffix (but skip if result is a common word)
    if (name.endsWith('news')) {
      const withoutNews = name.replace(/news$/i, '').trim();
      if (withoutNews.length > 0 && !COMMON_SECTION_WORDS.some(cw => withoutNews.toLowerCase() === cw.toLowerCase())) {
        variations.add(withoutNews);
      }
    }
  }
  
  // Merge variations
  for (const v of variations) {
    sourceNames.add(v);
  }
  
  // 6. Add global source names (major news orgs that appear everywhere)
  const globalSources = [
    'reuters', 'رويترز',
    'ap', 'associated press',
    'afp', 'agence france presse',
    'bbc', 'cnn', 'fox', 'msnbc',
    'nyt', 'new york times', 'نيويورك تايمز',
    'wsj', 'wall street journal',
    'ft', 'financial times',
    'economist', 'the economist',
    'guardian', 'washington post',
    'twitter', 'x', 'facebook', 'instagram', 'tiktok', 'youtube',
    'reddit', 'telegram', 'whatsapp',
  ];
  
  for (const gs of globalSources) {
    sourceNames.add(gs);
  }
  
  const result = Array.from(sourceNames).sort();
  
  // Cache
  sourceNameCache.set(showId, {
    data: result,
    timestamp: Date.now()
  });
  
  console.log(`✅ Extracted ${result.length} source names to exclude`);
  
  return result;
}

/**
 * Check if a keyword is a source name
 * @param {string} keyword - The keyword to check
 * @param {string} showId - The show ID
 * @returns {Promise<boolean>} True if keyword is a source name
 */
export async function isSourceName(keyword, showId) {
  if (!keyword || !showId) return false;
  
  const sourceNames = await getExcludedSourceNames(showId);
  const lower = keyword.toLowerCase().trim();
  
  return sourceNames.some(source => {
    // Exact match
    if (lower === source) return true;
    // Keyword contains source name (for compound names)
    if (lower.length > 3 && source.length > 3 && lower.includes(source)) return true;
    // Source name contains keyword (for partial matches)
    if (lower.length > 3 && source.length > 3 && source.includes(lower)) return true;
    return false;
  });
}

/**
 * Filter out source names from keywords
 * @param {string[]} keywords - Array of keywords to filter
 * @param {string} showId - The show ID
 * @returns {Promise<{filtered: string[], removed: string[]}>} Filtered keywords and removed source names
 */
export async function filterOutSourceNames(keywords, showId) {
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return { filtered: [], removed: [] };
  }
  
  if (!showId) {
    console.warn('⚠️ No showId provided to filterOutSourceNames, skipping filter');
    return { filtered: keywords, removed: [] };
  }

  const sourceNames = await getExcludedSourceNames(showId);
  
  const filtered = [];
  const removed = [];
  
  for (const keyword of keywords) {
    if (!keyword || typeof keyword !== 'string') continue;
    
    const lower = keyword.toLowerCase().trim();
    if (lower.length === 0) continue;
    
    const isSource = sourceNames.some(source => {
      // Exact match
      if (lower === source) return true;
      // Keyword contains source name (for compound names like "al arabiya news")
      if (lower.length > 3 && source.length > 3 && lower.includes(source)) return true;
      // Source name contains keyword (for partial matches)
      if (lower.length > 3 && source.length > 3 && source.includes(lower)) return true;
      return false;
    });
    
    if (isSource) {
      removed.push(keyword);
    } else {
      filtered.push(keyword);
    }
  }
  
  if (removed.length > 0) {
    console.log(`🚫 Filtered out source names: ${removed.join(', ')}`);
  }
  
  return { filtered, removed };
}

/**
 * Clear cache (call when sources are updated)
 * @param {string} showId - Optional show ID to clear, or undefined to clear all
 */
export function clearSourceNameCache(showId) {
  if (showId) {
    sourceNameCache.delete(showId);
    console.log(`🗑️  Cleared source name cache for show ${showId}`);
  } else {
    sourceNameCache.clear();
    console.log('🗑️  Cleared all source name caches');
  }
}
