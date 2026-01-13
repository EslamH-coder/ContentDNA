/**
 * DATA SCHEMAS
 * Structure for all imported data
 */

// ============================================
// AUDIENCE DATA SCHEMA
// ============================================
export const AudienceDataSchema = {
  // From "Other channels your audience watches"
  otherChannels: [
    {
      channelName: String,
      channelId: String,      // If available
      rank: Number,           // 1, 2, 3...
      category: String,       // We'll categorize: news, entertainment, education, etc.
      language: String,       // ar, en, etc.
      relevanceToUs: String,  // direct_competitor, adjacent, inspiration
      whatWeCanLearn: String  // Notes
    }
  ],
  
  // From "Other videos your audience watches"
  otherVideos: [
    {
      videoTitle: String,
      channelName: String,
      topic: String,          // Extracted topic
      views: Number,          // If visible
      recency: String,        // recent, old
      whyRelevant: String     // Why our audience watched this
    }
  ],
  
  // Demographics
  demographics: {
    countries: [
      { code: String, name: String, percentage: Number, trend: String }
    ],
    ageGroups: [
      { range: String, percentage: Number, trend: String }
    ],
    gender: {
      male: Number,
      female: Number
    },
    devices: {
      mobile: Number,
      desktop: Number,
      tablet: Number,
      tv: Number
    }
  },
  
  // When they watch
  watchTimes: {
    bestDays: [String],       // ['Friday', 'Saturday']
    bestHours: [Number],      // [20, 21, 22]
    timezone: String          // 'Africa/Cairo'
  }
};

// ============================================
// VIDEO PERFORMANCE SCHEMA
// ============================================
export const VideoPerformanceSchema = {
  videoId: String,
  title: String,
  publishDate: Date,
  
  // Core metrics
  views: Number,
  watchTimeHours: Number,
  avgViewDuration: Number,      // seconds
  avgPercentageViewed: Number,  // 0-100
  
  // Engagement
  ctr: Number,                  // Click-through rate %
  impressions: Number,
  likes: Number,
  comments: Number,
  subscribersGained: Number,
  
  // Traffic sources
  trafficSources: {
    browse: Number,             // %
    suggested: Number,
    search: Number,
    external: Number,
    direct: Number,
    other: Number
  },
  
  // Video details
  details: {
    length: Number,             // seconds
    description: String,
    tags: [String],
    thumbnailUrl: String,
    category: String
  },
  
  // Calculated fields
  calculated: {
    viewsPerDay: Number,
    engagementRate: Number,     // (likes + comments) / views
    retentionQuality: String,   // 'excellent', 'good', 'average', 'poor'
    performanceVsAverage: Number // % above/below channel average
  },
  
  // Extracted insights
  insights: {
    mainTopic: String,
    personas: [String],         // Which personas this serves
    titlePattern: String,       // 'question', 'how', 'why', etc.
    hasNumber: Boolean,
    hasPowerWord: Boolean
  }
};

// ============================================
// SEARCH TERMS SCHEMA
// ============================================
export const SearchTermsSchema = {
  terms: [
    {
      term: String,
      views: Number,
      ctr: Number,
      impressions: Number,
      
      // Analysis
      intent: String,           // 'informational', 'navigational', 'transactional'
      topic: String,
      persona: String,          // Which persona searches this
      language: String
    }
  ]
};

// ============================================
// COMMENTS SCHEMA
// ============================================
export const CommentsSchema = {
  comments: [
    {
      id: String,
      videoId: String,
      text: String,
      likes: Number,
      date: Date,
      isReply: Boolean,
      
      // Analysis (filled by AI)
      analysis: {
        type: String,           // 'question', 'request', 'praise', 'complaint', 'suggestion'
        sentiment: String,      // 'positive', 'negative', 'neutral'
        topic: String,
        actionable: Boolean,
        extractedQuestion: String,  // If it's a question
        suggestedContent: String    // If they're requesting something
      }
    }
  ]
};

// ============================================
// COMPETITOR DATA SCHEMA
// ============================================
export const CompetitorDataSchema = {
  channels: [
    {
      channelId: String,
      channelName: String,
      url: String,
      type: String,             // 'direct', 'adjacent', 'inspiration'
      subType: String,          // 'news', 'podcast', 'explainer', etc.
      
      // Their content
      recentVideos: [
        {
          title: String,
          publishDate: Date,
          views: Number,        // If visible
          topic: String,
          angle: String
        }
      ],
      
      // Patterns we noticed
      patterns: {
        uploadFrequency: String,  // 'daily', '3x_week', 'weekly'
        avgTitleLength: Number,
        commonTopics: [String],
        titlePatterns: [String],
        thumbnailStyle: String
      },
      
      // What we learn from them
      learnings: [String],
      
      // Which of our personas overlap with their audience
      personaOverlap: [String]
    }
  ]
};




