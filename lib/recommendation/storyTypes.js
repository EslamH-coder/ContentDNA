/**
 * Story types and their signals
 * This is HOW we understand what kind of story we're dealing with
 */
export const STORY_TYPES = {
  THREAT: {
    id: 'THREAT',
    name_ar: 'تهديد',
    signals: {
      keywords: ['risk', 'danger', 'lose', 'lost', 'crisis', 'warning', 'collapse', 'crash', 'fail', 'threat', 'fear', 'خطر', 'أزمة', 'انهيار', 'خسارة', 'تهديد', 'كارثة'],
      verbs: ['threatens', 'risks', 'endangers', 'collapses', 'crashes', 'fails', 'loses']
    },
    audience_feeling: 'fear',
    angle_direction: 'what to watch out for',
    title_energy: 'warning'
  },
  
  OPPORTUNITY: {
    id: 'OPPORTUNITY',
    name_ar: 'فرصة',
    signals: {
      keywords: ['invest', 'investment', 'launch', 'expand', 'grow', 'growth', 'bet', 'fund', 'raise', 'opportunity', 'potential', 'billion', 'million', 'deal', 'partnership', 'استثمار', 'فرصة', 'نمو', 'توسع', 'شراكة'],
      verbs: ['invests', 'launches', 'expands', 'funds', 'raises', 'bets on', 'partners', 'acquires']
    },
    audience_feeling: 'excitement',
    angle_direction: 'what is possible / why this matters',
    title_energy: 'curiosity'
  },
  
  SHIFT: {
    id: 'SHIFT',
    name_ar: 'تحول',
    signals: {
      keywords: ['change', 'shift', 'pivot', 'new era', 'transform', 'transition', 'move', 'evolution', 'new', 'after', 'post', 'تغيير', 'تحول', 'انتقال', 'جديد', 'بعد'],
      verbs: ['changes', 'shifts', 'transforms', 'pivots', 'transitions', 'moves', 'evolves']
    },
    audience_feeling: 'curiosity',
    angle_direction: 'what is changing / why now',
    title_energy: 'insight'
  },
  
  RACE: {
    id: 'RACE',
    name_ar: 'سباق',
    signals: {
      keywords: ['compete', 'competition', 'first', 'lead', 'leader', 'ahead', 'behind', 'race', 'winner', 'entry', 'join', 'enter', 'سباق', 'منافسة', 'الأول', 'قيادة', 'دخول'],
      verbs: ['competes', 'leads', 'races', 'enters', 'joins', 'leads', 'trails']
    },
    audience_feeling: 'FOMO',
    angle_direction: 'who is winning / where do we stand',
    title_energy: 'competition'
  },
  
  REVEAL: {
    id: 'REVEAL',
    name_ar: 'كشف',
    signals: {
      keywords: ['secret', 'hidden', 'truth', 'exposed', 'discovered', 'revealed', 'leaked', 'inside', 'behind', 'سر', 'خفي', 'كشف', 'الحقيقة', 'تسريب'],
      verbs: ['reveals', 'exposes', 'discovers', 'uncovers', 'leaks', 'shows']
    },
    audience_feeling: 'curiosity',
    angle_direction: 'what you did not know',
    title_energy: 'intrigue'
  },
  
  CONFLICT: {
    id: 'CONFLICT',
    name_ar: 'صراع',
    signals: {
      keywords: ['vs', 'versus', 'battle', 'fight', 'war', 'clash', 'dispute', 'tension', 'against', 'oppose', 'حرب', 'صراع', 'معركة', 'توتر', 'ضد', 'مواجهة'],
      verbs: ['battles', 'fights', 'clashes', 'opposes', 'attacks', 'confronts']
    },
    audience_feeling: 'drama',
    angle_direction: 'who will win / what are the stakes',
    title_energy: 'tension'
  },
  
  MILESTONE: {
    id: 'MILESTONE',
    name_ar: 'إنجاز',
    signals: {
      keywords: ['record', 'biggest', 'first ever', 'historic', 'unprecedented', 'largest', 'highest', 'lowest', 'breakthrough', 'قياسي', 'أكبر', 'تاريخي', 'الأول', 'إنجاز'],
      verbs: ['breaks', 'sets', 'achieves', 'reaches', 'hits', 'makes history']
    },
    audience_feeling: 'awe',
    angle_direction: 'why this matters / what it means',
    title_energy: 'significance'
  },
  
  CONSEQUENCE: {
    id: 'CONSEQUENCE',
    name_ar: 'نتيجة',
    signals: {
      keywords: ['because', 'result', 'led to', 'caused', 'after', 'following', 'due to', 'impact', 'effect', 'outcome', 'نتيجة', 'بسبب', 'أدى إلى', 'تأثير', 'بعد'],
      verbs: ['results in', 'causes', 'leads to', 'impacts', 'affects', 'triggers']
    },
    audience_feeling: 'understanding',
    angle_direction: 'connect the dots / cause and effect',
    title_energy: 'explanation'
  }
};

/**
 * Detect story type from content
 */
export function detectStoryType(content) {
  if (!content || typeof content !== 'string') {
    return {
      primary: 'SHIFT',
      secondary: null,
      confidence: 0.3,
      isDefault: true
    };
  }
  
  const contentLower = content.toLowerCase();
  const scores = {};
  
  for (const [typeId, typeConfig] of Object.entries(STORY_TYPES)) {
    let score = 0;
    
    // Check keywords (10 points each)
    for (const keyword of typeConfig.signals.keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        score += 10;
      }
    }
    
    // Check verbs (15 points each - stronger signal)
    for (const verb of typeConfig.signals.verbs) {
      if (contentLower.includes(verb.toLowerCase())) {
        score += 15;
      }
    }
    
    scores[typeId] = score;
  }
  
  // Sort by score
  const sorted = Object.entries(scores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);
  
  // Default to SHIFT if nothing detected
  if (sorted.length === 0) {
    return {
      primary: 'SHIFT',
      secondary: null,
      confidence: 0.3,
      isDefault: true,
      primaryConfig: STORY_TYPES.SHIFT
    };
  }
  
  const primary = sorted[0];
  const secondary = sorted[1] || null;
  
  return {
    primary: primary[0],
    primaryScore: primary[1],
    primaryConfig: STORY_TYPES[primary[0]],
    secondary: secondary ? secondary[0] : null,
    secondaryScore: secondary ? secondary[1] : 0,
    confidence: Math.min(primary[1] / 40, 1),
    allScores: scores,
    isDefault: false
  };
}

