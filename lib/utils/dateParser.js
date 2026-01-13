/**
 * Parse RSS publication dates and calculate freshness
 */

/**
 * Parse RSS item and extract CORRECT publication date
 */
export function parseRssItemDate(rssItem) {
  // Get publication date from RSS (different feeds use different fields)
  const pubDateRaw = rssItem.pubDate 
    || rssItem.published 
    || rssItem.date 
    || rssItem.isoDate
    || rssItem['dc:date']
    || null;
  
  let pubDate = null;
  let dateSource = 'unknown';
  
  if (pubDateRaw) {
    // Try to parse the date
    pubDate = new Date(pubDateRaw);
    dateSource = 'rss_pubDate';
    
    // Validate the date is reasonable (not in future, not too old)
    if (isNaN(pubDate.getTime())) {
      pubDate = null;
      dateSource = 'invalid';
    } else {
      // Check if date is in the future (unlikely, probably wrong)
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (pubDate > oneDayFromNow) {
        console.warn(`⚠️  Suspicious future date: ${pubDateRaw} (parsed as ${pubDate.toISOString()})`);
        pubDate = null;
        dateSource = 'future_date';
      }
    }
  }
  
  // Calculate age
  const now = new Date();
  const ageInHours = pubDate ? (now - pubDate) / (1000 * 60 * 60) : null;
  const ageInDays = ageInHours ? ageInHours / 24 : null;
  
  // Determine freshness
  let freshness = 'UNKNOWN';
  if (ageInDays !== null) {
    if (ageInDays < 0) {
      freshness = 'FUTURE';        // Negative (future date - error)
    } else if (ageInDays < 1) {
      freshness = 'BREAKING';      // < 24 hours
    } else if (ageInDays < 3) {
      freshness = 'FRESH';          // 1-3 days
    } else if (ageInDays < 7) {
      freshness = 'RECENT';         // 3-7 days
    } else if (ageInDays < 30) {
      freshness = 'STALE';          // 7-30 days
    } else {
      freshness = 'OLD';            // > 30 days
    }
  }
  
  // Determine date reliability
  // Google News RSS often shows when Google indexed it, not actual publication date
  let dateReliability = 'MEDIUM';
  if (rssItem.link && rssItem.link.includes('news.google.com')) {
    dateReliability = 'LOW';
  } else if (dateSource === 'invalid' || dateSource === 'future_date') {
    dateReliability = 'LOW';
  } else if (dateSource === 'rss_pubDate' && pubDate) {
    dateReliability = 'HIGH';
  }
  
  // Warning if old
  let dateWarning = null;
  if (ageInDays !== null && ageInDays > 7) {
    dateWarning = `⚠️ Article is ${Math.floor(ageInDays)} days old`;
  } else if (dateReliability === 'LOW') {
    dateWarning = '⚠️ Publication date may not be accurate';
  }
  
  return {
    pubDate: pubDate,                    // Actual Date object (or null)
    pubDateRaw: pubDateRaw,              // Original string from RSS
    dateSource: dateSource,               // Where we got the date
    dateReliability: dateReliability,     // HIGH, MEDIUM, or LOW
    
    // AGE FIELDS
    ageInHours: ageInHours,
    ageInDays: ageInDays,
    freshness: freshness,
    
    // WARNING
    dateWarning: dateWarning,
    
    // For hook generation: only use date if fresh and reliable
    useInHook: pubDate !== null && 
               dateReliability !== 'LOW' && 
               ageInDays !== null && 
               ageInDays < 7
  };
}

/**
 * Format date for Arabic hook (e.g., "في 27 ديسمبر 2025")
 */
export function formatDateForHook(pubDate) {
  if (!pubDate || !(pubDate instanceof Date) || isNaN(pubDate.getTime())) {
    return null;
  }
  
  const day = pubDate.getDate();
  const monthNames = {
    1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
    5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
    9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر'
  };
  const month = monthNames[pubDate.getMonth() + 1];
  const year = pubDate.getFullYear();
  
  return `في ${day} ${month} ${year}`;
}

/**
 * Format date for display
 */
export function formatDateForDisplay(pubDate, dateReliability = 'MEDIUM') {
  if (!pubDate || !(pubDate instanceof Date) || isNaN(pubDate.getTime())) {
    return {
      display: 'تاريخ غير محدد',
      showInHook: false
    };
  }
  
  // Don't show date if unreliable
  if (dateReliability === 'LOW') {
    return {
      display: 'تاريخ غير محدد',
      showInHook: false
    };
  }
  
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  
  const arabicDate = pubDate.toLocaleDateString('ar-EG', options);
  
  return {
    display: arabicDate,
    showInHook: true
  };
}

/**
 * Filter items by freshness
 */
export function filterByFreshness(items, options = {}) {
  const maxAgeDays = options.maxAgeDays || 7;
  const allowStale = options.allowStale || false;
  
  return items.filter(item => {
    // If no date, include but flag
    if (!item.pubDate || !item.dateInfo) {
      item.warnings = item.warnings || [];
      item.warnings.push('Unknown publication date');
      return true;
    }
    
    const dateInfo = item.dateInfo;
    
    // Filter old articles
    if (dateInfo.ageInDays !== null && dateInfo.ageInDays > maxAgeDays) {
      if (!allowStale) {
        console.log(`🗑️  Filtered out: "${item.title?.substring(0, 50)}..." - ${Math.floor(dateInfo.ageInDays)} days old (${dateInfo.freshness})`);
        return false;
      }
      item.warnings = item.warnings || [];
      item.warnings.push(`Article is ${Math.floor(dateInfo.ageInDays)} days old (${dateInfo.freshness})`);
    }
    
    return true;
  });
}

