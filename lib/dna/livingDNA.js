/**
 * LIVING DNA SYSTEM
 * Channel DNA that updates from every video's performance
 */

// ============================================
// DNA STRUCTURE
// ============================================
export function createLivingDNA() {
  return {
    // Metadata
    metadata: {
      channel_name: 'المُخبر الاقتصادي+',
      last_updated: null,
      total_videos_analyzed: 0,
      version: 1
    },
    
    // Topic Performance Tracking
    topics: {
      // Example structure:
      // 'us_china_trade': {
      //   videos_count: 5,
      //   avg_views: 1500000,
      //   avg_retention_30s: 74,
      //   avg_ctr: 5.2,
      //   trend: 'stable', // rising, falling, stable
      //   notes: ['Works best with conflict angle', 'Needs Arab connection'],
      //   last_video_date: '2025-12-01'
      // }
    },
    
    // Hook Patterns Performance
    hooks: {
      patterns: {
        // 'date_entity_action': {
        //   usage_count: 10,
        //   avg_retention_30s: 76,
        //   avg_views: 2500000,
        //   best_example: { title: '...', hook: '...', views: 2851313 },
        //   notes: ['Most reliable pattern', 'Works for breaking news']
        // }
      },
      
      // Phrases that worked
      effective_phrases: [],
      
      // Phrases that failed
      failed_phrases: []
    },
    
    // Style Observations
    style: {
      // Language patterns
      dialect: 'egyptian_simplified',
      
      // Effective words/phrases
      power_words: [],
      
      // Words to avoid
      weak_words: [],
      
      // Tone observations
      tone_notes: []
    },
    
    // Format Performance
    format: {
      // Duration analysis
      optimal_duration: {
        long_form: { min: 20, max: 27, unit: 'minutes' },
        shorts: { min: 60, max: 80, unit: 'seconds' }
      },
      
      // Structure patterns
      successful_structures: [],
      
      // Beat patterns
      beat_patterns: []
    },
    
    // Audience Behavior Insights
    audience: {
      // Behavior patterns discovered
      behaviors: [],
      
      // What makes them click (CTR insights)
      click_triggers: [],
      
      // What makes them stay (Retention insights)
      retention_triggers: [],
      
      // What makes them share (Viral insights)
      share_triggers: [],
      
      // Traps to avoid
      traps: [],
      
      // Audience profile (from analytics)
      profile: {
        demographics: {
          gender: { male: 94.43, female: 5.56 },
          top_countries: ['EG', 'SA', 'MA', 'DZ'],
          device: { mobile: 68.9, primary: 'mobile' }
        },
        content_preferences: {
          best_question: 'هل', // 1.03M avg views
          best_entity: 'ترمب', // 1.29M avg views
          winning_topics: ['ترمب', 'الصين', 'أمريكا', 'روسيا', 'إيران']
        },
        discovery: {
          browse: 46.3,
          suggested: 37.8,
          search: 2.5,
          primary: 'browse_suggested'
        }
      }
    },
    
    // Latest Insights (LLM-generated notes)
    insights: {
      // Recent observations
      recent: [],
      
      // Key learnings
      key_learnings: [],
      
      // Warnings
      warnings: [],
      
      // Experiments to try
      experiments: []
    },
    
    // Banned Content (Auto-updated)
    banned: {
      phrases: [
        'هل تعلم أن',
        'ما لا تعرفه',
        'الحقائق المخفية',
        'السر الذي',
        'في بلدك',
        'فاتورتك الشهرية',
        'أسعارك'
      ],
      
      // Topics that consistently underperform
      weak_topics: [],
      
      // Patterns that failed
      failed_patterns: []
    }
  };
}

