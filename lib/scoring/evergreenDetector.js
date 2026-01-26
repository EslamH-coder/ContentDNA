/**
 * Evergreen Content Detector
 * 
 * Detects signals that are "evergreen" - content that generates views
 * consistently over months/years, not dependent on specific events.
 * 
 * Uses pattern matching for fast, cost-free classification.
 */

// ============================================
// EVERGREEN PATTERNS (strong indicators)
// ============================================

const EVERGREEN_PATTERNS = {
  // Explainers - "what is X", "how X works"
  explainer: {
    pattern: /\b(what is|what are|how does|how do|why does|why do|why is|explained|explaining|guide to|understanding|the economics of|how .{3,30} works|how .{3,30} work)\b/i,
    type: 'explainer_system',
    weight: 3,
  },
  
  // Frameworks & fundamentals - "101", "basics"
  framework: {
    pattern: /\b(101|basics|fundamentals|primer|introduction to|beginner.?s guide|complete guide|everything you need to know)\b/i,
    type: 'framework_model',
    weight: 3,
  },
  
  // Mechanisms & systems - "how X affects Y"
  mechanism: {
    pattern: /\b(how .{3,30} affects?|the .{3,30} system|supply chain|business model|pricing model|economic model|the mechanics of|how .{3,30} impacts?)\b/i,
    type: 'explainer_system',
    weight: 2,
  },
  
  // Behavioral economics - "why people", "psychology of"
  behavioral: {
    pattern: /\b(why people|why we|psychology of|the bias|cognitive bias|decision.?making|consumer behavior|spending habits|financial mistakes|money mistakes)\b/i,
    type: 'behavioral_economy',
    weight: 3,
  },
  
  // Personal finance - budgeting, debt, savings
  personal_finance: {
    pattern: /\b(budgeting|how to save|how to invest|debt trap|credit card trap|financial planning|retirement planning|emergency fund|compound interest)\b/i,
    type: 'personal_economy',
    weight: 2,
  },
  
  // Case studies - "rise and fall of", "story of"
  case_study: {
    pattern: /\b(case study|rise and fall of|the story of|history of|lessons from|what .{3,30} teaches us|the collapse of|the success of)\b/i,
    type: 'case_study',
    weight: 2,
  },
  
  // Historical context - "history", "origins"
  history: {
    pattern: /\b(history of|origins of|evolution of|how .{3,30} started|the birth of|timeline of)\b/i,
    type: 'history_context',
    weight: 2,
  },
  
  // Arabic evergreen patterns
  arabic_explainer: {
    pattern: /\b(ما هو|ما هي|كيف يعمل|كيف تعمل|لماذا|شرح|دليل|أساسيات|مبادئ)\b/i,
    type: 'explainer_system',
    weight: 3,
  },
  
  arabic_behavioral: {
    pattern: /\b(لماذا الناس|سلوك المستهلك|أخطاء مالية|عادات الإنفاق)\b/i,
    type: 'behavioral_economy',
    weight: 3,
  },
};

// ============================================
// NOT EVERGREEN PATTERNS (disqualifiers)
// ============================================

const NOT_EVERGREEN_PATTERNS = {
  // Breaking news indicators
  breaking: {
    pattern: /\b(today|tonight|this morning|this week|this month|just announced|breaking|live|latest|update:|now:)\b/i,
    reason: 'breaking_news',
    weight: 3,
  },
  
  // Market movements - specific price changes
  market_move: {
    pattern: /\b(hits record|hits \$|reaches \$|rises to|falls to|surges|plunges|crashes|soars|tumbles|spikes|drops to|climbs to|down \d+%|up \d+%)\b/i,
    reason: 'market_movement',
    weight: 3,
  },
  
  // Announcements and events
  event: {
    pattern: /\b(announces|announced|reveals|revealed|signs deal|signed deal|reports|reported|launches|launched|unveils|unveiled|confirms|confirmed)\b/i,
    reason: 'announcement',
    weight: 2,
  },
  
  // Specific dated content
  dated: {
    pattern: /\b(Q[1-4] 20\d{2}|Q[1-4] earnings|january 20|february 20|march 20|april 20|may 20|june 20|july 20|august 20|september 20|october 20|november 20|december 20|in 202[4-9]|fiscal 202)\b/i,
    reason: 'dated_content',
    weight: 3,
  },
  
  // Earnings and financial reports
  earnings: {
    pattern: /\b(earnings call|quarterly results|quarterly earnings|annual report|fiscal year|revenue report|profit report)\b/i,
    reason: 'earnings_report',
    weight: 3,
  },
  
  // Meetings and summits
  meetings: {
    pattern: /\b(summit|meeting|conference|davos 202|G7 202|G20 202|COP\d+|OPEC meeting|Fed meeting)\b/i,
    reason: 'event_coverage',
    weight: 2,
  },
  
  // Arabic not-evergreen patterns
  arabic_breaking: {
    pattern: /\b(اليوم|هذا الأسبوع|عاجل|الآن|آخر الأخبار|تحديث)\b/i,
    reason: 'breaking_news_ar',
    weight: 3,
  },
  
  arabic_market: {
    pattern: /\b(يرتفع إلى|ينخفض إلى|يصل إلى|يسجل رقم|انهيار)\b/i,
    reason: 'market_movement_ar',
    weight: 3,
  },
};

// ============================================
// EVERGREEN TOPIC KEYWORDS (boost confidence)
// ============================================

const EVERGREEN_TOPIC_KEYWORDS = [
  // Macro & markets mechanisms
  'inflation', 'deflation', 'recession', 'interest rates', 'monetary policy',
  'fiscal policy', 'central bank', 'quantitative easing', 'bond yields',
  
  // Currency & payments
  'swift', 'dollar dominance', 'forex', 'currency reserves', 'exchange rate',
  'capital controls', 'currency devaluation',
  
  // Energy economics
  'opec', 'oil pricing', 'energy markets', 'petrodollar', 'oil embargo',
  'energy transition', 'renewable economics',
  
  // Trade & geopolitics
  'trade war', 'tariffs', 'sanctions', 'supply chain', 'globalization',
  'protectionism', 'free trade',
  
  // Tech & business
  'platform monopoly', 'antitrust', 'network effects', 'disruption',
  'business model', 'startup economics',
  
  // Behavioral
  'loss aversion', 'fomo', 'anchoring', 'sunk cost', 'herd behavior',
  'overconfidence', 'mental accounting',
];

// ============================================
// MAIN DETECTION FUNCTION
// ============================================

/**
 * Detect if a signal is evergreen content
 * 
 * @param {string} title - Signal title
 * @param {string} description - Signal description (optional)
 * @returns {object} { isEvergreen, confidence, type, reason, triggers }
 */
export function detectEvergreen(title, description = '') {
  if (!title) {
    return {
      isEvergreen: false,
      confidence: 0,
      type: null,
      reason: 'No title provided',
      triggers: [],
    };
  }

  const text = `${title} ${description || ''}`.toLowerCase();
  const titleLower = title.toLowerCase();
  
  // ============================================
  // Step 1: Check for NOT EVERGREEN patterns first
  // These are strong disqualifiers
  // ============================================
  
  const notEvergreenMatches = [];
  
  for (const [name, config] of Object.entries(NOT_EVERGREEN_PATTERNS)) {
    const match = text.match(config.pattern);
    if (match) {
      notEvergreenMatches.push({
        name,
        match: match[0],
        reason: config.reason,
        weight: config.weight,
      });
    }
  }
  
  // Strong not-evergreen signal in TITLE = definitely not evergreen
  for (const [name, config] of Object.entries(NOT_EVERGREEN_PATTERNS)) {
    if (config.pattern.test(titleLower) && config.weight >= 3) {
      return {
        isEvergreen: false,
        confidence: 90,
        type: null,
        reason: `Title contains time-sensitive indicator: "${notEvergreenMatches[0]?.match || name}"`,
        triggers: notEvergreenMatches.map(m => m.match),
        disqualifiers: notEvergreenMatches,
      };
    }
  }
  
  // ============================================
  // Step 2: Check for EVERGREEN patterns
  // ============================================
  
  const evergreenMatches = [];
  let primaryType = null;
  let totalWeight = 0;
  
  for (const [name, config] of Object.entries(EVERGREEN_PATTERNS)) {
    const match = text.match(config.pattern);
    if (match) {
      evergreenMatches.push({
        name,
        match: match[0],
        type: config.type,
        weight: config.weight,
        inTitle: titleLower.includes(match[0].toLowerCase()),
      });
      
      // Title matches are stronger
      const effectiveWeight = titleLower.includes(match[0].toLowerCase()) 
        ? config.weight * 1.5 
        : config.weight;
      
      totalWeight += effectiveWeight;
      
      // Set primary type from first strong match
      if (!primaryType && config.weight >= 2) {
        primaryType = config.type;
      }
    }
  }
  
  // ============================================
  // Step 3: Check for evergreen topic keywords
  // ============================================
  
  const topicMatches = EVERGREEN_TOPIC_KEYWORDS.filter(kw => 
    text.includes(kw.toLowerCase())
  );
  
  // Topic keywords add to weight
  totalWeight += topicMatches.length * 0.5;
  
  // ============================================
  // Step 4: Calculate final decision
  // ============================================
  
  // If we have not-evergreen signals, they reduce confidence
  const notEvergreenWeight = notEvergreenMatches.reduce((sum, m) => sum + m.weight, 0);
  const netWeight = totalWeight - notEvergreenWeight;
  
  // Decision thresholds
  const isEvergreen = netWeight >= 2 && evergreenMatches.length >= 1;
  
  // Confidence calculation
  let confidence = 0;
  if (isEvergreen) {
    confidence = Math.min(100, 50 + (netWeight * 10));
    
    // Boost confidence if title has evergreen pattern
    if (evergreenMatches.some(m => m.inTitle)) {
      confidence = Math.min(100, confidence + 15);
    }
    
    // Reduce confidence if there are also not-evergreen signals
    if (notEvergreenMatches.length > 0) {
      confidence = Math.max(50, confidence - 20);
    }
  } else if (evergreenMatches.length > 0) {
    // Some evergreen signals but not enough
    confidence = 30 + (totalWeight * 5);
  }
  
  // ============================================
  // Step 5: Build response
  // ============================================
  
  if (isEvergreen) {
    return {
      isEvergreen: true,
      confidence: Math.round(confidence),
      type: primaryType,
      reason: `Matches evergreen pattern: ${evergreenMatches[0]?.match || 'system/explainer content'}`,
      triggers: evergreenMatches.map(m => m.match),
      topicKeywords: topicMatches.slice(0, 5),
      debug: {
        evergreenMatches,
        notEvergreenMatches,
        totalWeight,
        netWeight,
      },
    };
  }
  
  return {
    isEvergreen: false,
    confidence: Math.round(confidence),
    type: null,
    reason: notEvergreenMatches.length > 0 
      ? `Contains time-sensitive content: ${notEvergreenMatches[0]?.match}`
      : 'No clear evergreen indicators',
    triggers: [],
    disqualifiers: notEvergreenMatches.map(m => m.match),
    debug: {
      evergreenMatches,
      notEvergreenMatches,
      totalWeight,
      netWeight,
    },
  };
}

// ============================================
// EVERGREEN TYPE LABELS (for UI)
// ============================================

export const EVERGREEN_TYPE_LABELS = {
  explainer_system: {
    label: 'Explainer',
    labelAr: 'شرح',
    icon: '📚',
    description: 'Explains how a system or concept works',
  },
  framework_model: {
    label: 'Framework',
    labelAr: 'إطار',
    icon: '🧠',
    description: 'Mental model or foundational concept',
  },
  behavioral_economy: {
    label: 'Behavioral',
    labelAr: 'سلوكي',
    icon: '🎯',
    description: 'Psychology, biases, and decision-making',
  },
  personal_economy: {
    label: 'Personal Finance',
    labelAr: 'مالية شخصية',
    icon: '💰',
    description: 'Budgeting, saving, debt management',
  },
  case_study: {
    label: 'Case Study',
    labelAr: 'دراسة حالة',
    icon: '📊',
    description: 'Company or country case analysis',
  },
  history_context: {
    label: 'History',
    labelAr: 'تاريخ',
    icon: '📜',
    description: 'Historical context with lasting value',
  },
};

export default {
  detectEvergreen,
  EVERGREEN_TYPE_LABELS,
};