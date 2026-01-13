/**
 * Decide WHEN to produce content
 * URGENT = this week, TIMELY = 1-2 weeks, EVERGREEN = backlog
 */

const URGENT_SIGNALS = {
  keywords: [
    'breaking', 'just announced', 'today', 'yesterday', 'this morning',
    'crashes', 'plunges', 'surges', 'war', 'attack', 'death', 'resigns',
    'عاجل', 'الآن', 'للتو', 'اليوم'
  ],
  story_types: ['THREAT', 'CONFLICT'],
  max_age_hours: 72  // 3 days
};

const TIMELY_SIGNALS = {
  keywords: [
    'rising', 'growing', 'trend', 'emerging', 'developing',
    'this month', 'this quarter', 'Q1', 'Q2', 'Q3', 'Q4', '2025', '2026'
  ],
  story_types: ['SHIFT', 'RACE', 'OPPORTUNITY'],
  seasonal_events: [
    'ramadan', 'eid', 'hajj', 'new year', 'earnings', 'opec meeting',
    'fed meeting', 'g20', 'cop', 'davos'
  ]
};

const EVERGREEN_SIGNALS = {
  keywords: [
    'how does', 'what is', 'why does', 'history of', 'explained',
    'guide to', 'understanding', 'deep dive',
    'إزاي', 'ليه', 'إيه هو', 'تاريخ', 'شرح', 'دليل'
  ],
  story_types: ['REVEAL', 'CONSEQUENCE'],
  content_types: ['explainer', 'analysis', 'documentary']
};

export function decideTiming(item, storyType) {
  const content = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  const publishedAt = item.pubDate || item.published_at || item.publishedAt || null;
  const ageHours = publishedAt ? (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60) : null;
  
  // ===== CHECK URGENT =====
  const hasUrgentKeyword = URGENT_SIGNALS.keywords.some(k => content.includes(k.toLowerCase()));
  const isUrgentStoryType = storyType?.primary && URGENT_SIGNALS.story_types.includes(storyType.primary);
  const isRecent = ageHours !== null && ageHours <= URGENT_SIGNALS.max_age_hours;
  
  if (hasUrgentKeyword || (isUrgentStoryType && isRecent)) {
    return {
      decision: 'URGENT',
      deadline: 'This week',
      days_until_stale: 7,
      reason: hasUrgentKeyword 
        ? 'Breaking/urgent news - time sensitive'
        : 'Recent conflict/threat story - cover quickly',
      icon: '🔴'
    };
  }
  
  // ===== CHECK EVERGREEN (before timely, so explainers don't get rushed) =====
  const hasEvergreenKeyword = EVERGREEN_SIGNALS.keywords.some(k => content.includes(k.toLowerCase()));
  const isEvergreenType = storyType?.primary && EVERGREEN_SIGNALS.story_types.includes(storyType.primary);
  
  // Strong evergreen signal: educational content
  if (hasEvergreenKeyword) {
    return {
      decision: 'EVERGREEN',
      deadline: 'Backlog',
      days_until_stale: null,
      reason: 'Educational/explainer content - always relevant',
      icon: '🟢'
    };
  }
  
  // ===== CHECK TIMELY =====
  const hasTimelyKeyword = TIMELY_SIGNALS.keywords.some(k => content.includes(k.toLowerCase()));
  const isTimelyStoryType = storyType?.primary && TIMELY_SIGNALS.story_types.includes(storyType.primary);
  const hasSeasonal = TIMELY_SIGNALS.seasonal_events.some(e => content.includes(e.toLowerCase()));
  
  if (hasTimelyKeyword || isTimelyStoryType || hasSeasonal) {
    return {
      decision: 'TIMELY',
      deadline: '1-2 weeks',
      days_until_stale: 14,
      reason: hasSeasonal 
        ? 'Seasonal/event relevance'
        : 'Developing trend - cover while relevant',
      icon: '🟡'
    };
  }
  
  // ===== DEFAULT =====
  // If no strong signal, check story type
  if (isEvergreenType) {
    return {
      decision: 'EVERGREEN',
      deadline: 'Backlog',
      days_until_stale: null,
      reason: 'No time pressure detected',
      icon: '🟢'
    };
  }
  
  // Default to TIMELY for safety
  return {
    decision: 'TIMELY',
    deadline: '1-2 weeks',
    days_until_stale: 14,
    reason: 'Default - moderate time sensitivity',
    icon: '🟡'
  };
}

