/**
 * Centralized English labels for the system
 * Content (topics, titles, comments) remains in original language
 */

export const RECOMMENDATION_TYPES = {
  CURRENT_EVENT: 'current_event',
  PROVEN_INTEREST: 'proven_interest',
  AUDIENCE_REQUEST: 'audience_request',
  MANUAL_TREND: 'manual_trend'
};

export const CONTENT_FORMATS = {
  LONG_FORM: 'long_form',
  SHORT_FORM: 'short_form',
  PODCAST: 'podcast',
  LIVE: 'live'
};

export const RECOMMENDATION_LEVELS = {
  HIGHLY_RECOMMENDED: 'highly_recommended',
  RECOMMENDED: 'recommended',
  CONSIDER: 'consider',
  LOW_PRIORITY: 'low_priority'
};

export const FEEDBACK_ACTIONS = {
  LIKED: 'liked',
  REJECTED: 'rejected',
  SAVED: 'saved',
  PRODUCED: 'produced',
  SKIPPED: 'skipped'
};

export const REJECTION_REASONS = {
  NOT_RELEVANT: 'not_relevant',
  ALREADY_COVERED: 'already_covered',
  ANGLE_TOO_BROAD: 'angle_too_broad',
  WEAK_EVIDENCE: 'weak_evidence',
  BAD_TIMING: 'bad_timing',
  LOW_INTEREST: 'low_interest',
  OTHER: 'other'
};

export const EVIDENCE_TYPES = {
  SEARCH_VOLUME: 'search_volume',
  COMPETITOR_PROOF: 'competitor_proof',
  AUDIENCE_COMMENTS: 'audience_comments',
  RSS_SIGNALS: 'rss_signals',
  MANUAL_TRENDS: 'manual_trends'
};

export const PERFORMANCE_TIERS = {
  VIRAL: 'viral',
  ABOVE_AVERAGE: 'above_average',
  AVERAGE: 'average',
  BELOW_AVERAGE: 'below_average',
  UNDERPERFORM: 'underperform'
};

export const TIMELINESS = {
  BREAKING: 'breaking',
  RECENT: 'recent',
  EVERGREEN: 'evergreen'
};

// UI Labels (English)
export const UI_LABELS = {
  // Feedback buttons
  LIKE: 'Like',
  REJECT: 'Reject',
  SAVE: 'Save',
  MARK_PRODUCED: 'Mark as Produced',
  
  // Rejection reasons
  REASON_NOT_RELEVANT: 'Not relevant to channel',
  REASON_ALREADY_COVERED: 'Already covered',
  REASON_ANGLE_BROAD: 'Angle too broad',
  REASON_WEAK_EVIDENCE: 'Weak evidence',
  REASON_BAD_TIMING: 'Bad timing',
  REASON_LOW_INTEREST: 'Low expected interest',
  
  // Stats
  LEARNING_STATS: 'Learning Stats',
  LAST_30_DAYS: 'Last 30 Days',
  ACCEPTANCE_RATE: 'Acceptance Rate',
  PRODUCTION_RATE: 'Production Rate',
  PREFERRED_TOPICS: 'Preferred Topics',
  AVOIDED_TOPICS: 'Avoided Topics',
  
  // Recommendations
  CURRENT_EVENT: 'Current Event',
  PROVEN_INTEREST: 'Proven Interest',
  AUDIENCE_REQUEST: 'Audience Request',
  SCORE: 'Score',
  EVIDENCE: 'Evidence',
  
  // Formats
  LONG_FORM: 'Long-form Video',
  SHORT_FORM: 'Short-form Video',
  PODCAST: 'Podcast',
  
  // General
  CANCEL: 'Cancel',
  SUBMIT: 'Submit',
  LOADING: 'Loading...',
  ERROR: 'Error',
  SUCCESS: 'Success'
};

// Format labels
export const FORMAT_LABELS = {
  [CONTENT_FORMATS.LONG_FORM]: 'Long-form Video',
  [CONTENT_FORMATS.SHORT_FORM]: 'Short-form Video',
  [CONTENT_FORMATS.PODCAST]: 'Podcast',
  [CONTENT_FORMATS.LIVE]: 'Live Stream'
};

// Type labels
export const TYPE_LABELS = {
  [RECOMMENDATION_TYPES.CURRENT_EVENT]: 'Current Event',
  [RECOMMENDATION_TYPES.PROVEN_INTEREST]: 'Proven Interest',
  [RECOMMENDATION_TYPES.AUDIENCE_REQUEST]: 'Audience Request',
  [RECOMMENDATION_TYPES.MANUAL_TREND]: 'Manual Trend'
};

// Level labels
export const LEVEL_LABELS = {
  [RECOMMENDATION_LEVELS.HIGHLY_RECOMMENDED]: 'Highly Recommended',
  [RECOMMENDATION_LEVELS.RECOMMENDED]: 'Recommended',
  [RECOMMENDATION_LEVELS.CONSIDER]: 'Consider',
  [RECOMMENDATION_LEVELS.LOW_PRIORITY]: 'Low Priority'
};




