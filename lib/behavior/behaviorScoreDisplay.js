/**
 * BEHAVIOR SCORE DISPLAY
 * UI component helpers for showing behavior analysis
 */

export function formatBehaviorScore(analysis) {
  return {
    // Overall score (0-100)
    score: analysis.total_score,
    
    // Patterns matched (0-6)
    patterns_matched: `${analysis.patterns_matched}/6`,
    
    // Status
    status: analysis.recommendation.status,
    status_color: analysis.recommendation.color,
    
    // Individual patterns for display
    patterns: [
      {
        name: 'سؤال واضح',
        name_en: 'Certainty',
        icon: '❓',
        score: analysis.pattern1_certainty?.score || 0,
        met: (analysis.pattern1_certainty?.score || 0) >= 7
      },
      {
        name: 'كيان قوي',
        name_en: 'Power',
        icon: '💪',
        score: analysis.pattern2_power?.score || 0,
        met: (analysis.pattern2_power?.score || 0) >= 7
      },
      {
        name: 'صراع',
        name_en: 'Conflict',
        icon: '⚔️',
        score: analysis.pattern3_conflict?.score || 0,
        met: (analysis.pattern3_conflict?.score || 0) >= 7
      },
      {
        name: 'تأثير عربي',
        name_en: 'Arab Stakes',
        icon: '🌍',
        score: analysis.pattern4_arab?.score || 0,
        met: (analysis.pattern4_arab?.score || 0) >= 7
      },
      {
        name: 'عنوان واضح',
        name_en: 'Mobile First',
        icon: '📱',
        score: analysis.pattern5_mobile?.score || 0,
        met: (analysis.pattern5_mobile?.score || 0) >= 7
      },
      {
        name: 'شخص محدد',
        name_en: 'Personality',
        icon: '👤',
        score: analysis.pattern6_personality?.score || 0,
        met: (analysis.pattern6_personality?.score || 0) >= 7
      }
    ],
    
    // Action items
    action: analysis.recommendation.action,
    suggestions: collectSuggestions(analysis)
  };
}

function collectSuggestions(analysis) {
  const suggestions = [];
  
  if (analysis.pattern1_certainty?.suggestion) {
    suggestions.push({ pattern: 'Certainty', text: analysis.pattern1_certainty.suggestion });
  }
  if (analysis.pattern2_power?.suggestion) {
    suggestions.push({ pattern: 'Power', text: analysis.pattern2_power.suggestion });
  }
  if (analysis.pattern3_conflict?.suggestion) {
    suggestions.push({ pattern: 'Conflict', text: analysis.pattern3_conflict.suggestion });
  }
  if (analysis.pattern4_arab?.suggestion) {
    suggestions.push({ pattern: 'Arab Stakes', text: analysis.pattern4_arab.suggestion });
  }
  if (analysis.pattern5_mobile?.suggestion) {
    suggestions.push({ pattern: 'Mobile', text: analysis.pattern5_mobile.suggestion });
  }
  if (analysis.pattern6_personality?.suggestion) {
    suggestions.push({ pattern: 'Personality', text: analysis.pattern6_personality.suggestion });
  }
  
  return suggestions;
}




