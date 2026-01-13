/**
 * Content Filter - Universal system to filter irrelevant content
 * Works for any show based on their skip patterns
 */

/**
 * Check if content should be skipped based on show's skip patterns
 * @param {string} title - Content title
 * @param {string} competitorId - Competitor ID
 * @param {Array} skipPatterns - Array of {pattern_type, pattern_value}
 * @returns {boolean} - true if should be skipped
 */
export function shouldSkipContent(title, competitorId, skipPatterns = []) {
  if (!skipPatterns?.length) return false;
  
  const titleLower = (title || '').toLowerCase();
  
  for (const pattern of skipPatterns) {
    switch (pattern.pattern_type) {
      case 'title_contains':
        if (titleLower.includes(pattern.pattern_value.toLowerCase())) {
          return true;
        }
        break;
      case 'competitor':
        if (competitorId === pattern.pattern_value) {
          return true;
        }
        break;
    }
  }
  
  return false;
}

/**
 * Filter competitor videos for relevance
 * @param {Array} videos - Competitor videos
 * @param {Array} skipPatterns - Show's skip patterns
 * @returns {Array} - Filtered videos
 */
export function filterRelevantVideos(videos, skipPatterns = []) {
  return videos.filter(video => {
    // Skip if no detected topic
    if (!video.detected_topic) return false;
    
    // Skip if topic is "other" variants
    if (video.detected_topic.includes('other')) return false;
    
    // Skip if matches skip patterns
    if (shouldSkipContent(video.title, video.competitor_id, skipPatterns)) {
      return false;
    }
    
    return true;
  });
}

/**
 * Check if a competitor video is valid for evidence
 */
export function isValidForEvidence(video, skipPatterns = []) {
  // Must have a real topic
  if (!video.detected_topic) return false;
  
  // Skip "other" topics
  if (video.detected_topic.includes('other')) return false;
  
  // Check skip patterns
  if (shouldSkipContent(video.title, video.competitor_id, skipPatterns)) {
    return false;
  }
  
  return true;
}


