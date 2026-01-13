/**
 * STRICT QUALITY GATES
 * Every item must pass ALL gates or get rejected
 */

// ========================================
// GATE 1: Topic DNA Match
// ========================================
export function gate1_TopicDnaMatch(item, classification, showDna) {
  const topicId = classification?.topic?.primary_topic;
  const confidence = classification?.topic?.confidence || 0;
  
  // REJECT: No topic match
  if (!topicId) {
    return { 
      pass: false, 
      gate: 'GATE1_TOPIC',
      reason: 'No topic match - does not fit channel DNA' 
    };
  }
  
  // REJECT: Low confidence (lowered threshold for testing)
  if (confidence < 0.15) {  // Lowered to 0.15 (15%) for testing
    return { 
      pass: false, 
      gate: 'GATE1_TOPIC',
      reason: `Low confidence: ${(confidence * 100).toFixed(0)}% < 15%` 
    };
  }
  
  // Check DNA topics (from showDna structure)
  // showDna.topics is array of { topicId, successRate, status }
  const dnaTopic = showDna?.topics?.find(t => t.topicId === topicId || t.topic_id === topicId);
  
  // REJECT: Losing topic (if we have DNA data)
  if (dnaTopic && dnaTopic.status === 'losing') {
    const successRate = dnaTopic.successRate || dnaTopic.success_rate || 0;
    return { 
      pass: false, 
      gate: 'GATE1_TOPIC',
      reason: `Losing topic: ${topicId} (${(successRate * 100).toFixed(0)}% success)` 
    };
  }
  
  // PASS
  return {
    pass: true,
    topic: topicId,
    confidence,
    dna_status: dnaTopic?.status || 'new',
    score_bonus: dnaTopic?.status === 'winning' ? 20 : (dnaTopic?.status === 'neutral' ? 5 : 0)
  };
}

// ========================================
// GATE 2: Story Type Clarity
// ========================================
export function gate2_StoryTypeClarity(storyType) {
  // REJECT: No clear story type
  if (!storyType?.primary || storyType.confidence < 0.25) {
    return { 
      pass: false, 
      gate: 'GATE2_STORY',
      reason: 'Unclear story - no clear narrative angle' 
    };
  }
  
  // PASS
  return {
    pass: true,
    story_type: storyType.primary,
    confidence: storyType.confidence
  };
}

// ========================================
// GATE 3: Arab Relevance (STRICT)
// ========================================
export function gate3_ArabRelevance(item, extracted) {
  const content = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  
  // CHECK 1: Direct Arab region mention
  const arabKeywords = [
    'saudi', 'uae', 'emirates', 'dubai', 'qatar', 'egypt', 'gulf', 'gcc', 
    'mena', 'middle east', 'arab', 'riyadh', 'abu dhabi', 'doha', 'cairo',
    'kuwait', 'bahrain', 'oman', 'jordan', 'morocco', 'tunisia', 'algeria',
    'السعودية', 'الإمارات', 'دبي', 'قطر', 'مصر', 'الخليج', 'العرب', 'الرياض', 'القاهرة'
  ];
  
  const arabMatch = arabKeywords.find(kw => content.includes(kw));
  if (arabMatch) {
    return { 
      pass: true, 
      type: 'DIRECT_MENTION',
      match: arabMatch,
      score_bonus: 25 
    };
  }
  
  // CHECK 2: Global topics that ALWAYS affect Arabs
  const globalMustCover = [
    { keywords: ['oil price', 'opec', 'crude oil', 'petroleum', 'brent'], reason: 'Oil affects Gulf economies' },
    { keywords: ['dollar', 'fed rate', 'federal reserve', 'interest rate', 'usd'], reason: 'USD affects all Arab currencies' },
    { keywords: ['gold price', 'gold', 'bullion'], reason: 'Gold is major Arab investment' },
    { keywords: ['china trade', 'us china', 'trade war', 'tariff', 'beijing'], reason: 'Global trade affects Arab economies' },
    { keywords: ['iran', 'israel', 'turkey', 'syria'], reason: 'Regional geopolitics' }
  ];
  
  for (const global of globalMustCover) {
    if (global.keywords.some(kw => content.includes(kw))) {
      return { 
        pass: true, 
        type: 'GLOBAL_IMPACT',
        reason: global.reason,
        score_bonus: 15 
      };
    }
  }
  
  // CHECK 3: Major tech/business that Arabs follow
  const majorEntities = ['tesla', 'apple', 'google', 'microsoft', 'amazon', 'nvidia', 'openai', 'musk', 'meta', 'spacex'];
  const hasEntity = majorEntities.some(e => content.includes(e));
  
  if (hasEntity && extracted?.numbers?.length > 0) {
    // Major entity + numbers = probably significant
    return { 
      pass: true, 
      type: 'MAJOR_ENTITY',
      score_bonus: 10 
    };
  }
  
  // REJECT: No Arab relevance
  return { 
    pass: false, 
    gate: 'GATE3_RELEVANCE',
    reason: 'No Arab relevance - pure local/foreign news without regional impact' 
  };
}

// ========================================
// GATE 4: Specificity (Numbers + Entities)
// ========================================
export function gate4_Specificity(item, extracted) {
  const factors = [];
  let score = 0;
  
  // Numbers (strong signal)
  if (extracted?.numbers?.length > 0) {
    const significantNumbers = extracted.numbers.filter(n => {
      // Filter out small numbers like dates
      const numericValue = parseFloat(n.replace(/[^0-9.]/g, ''));
      return numericValue >= 100 || /billion|million|trillion|%/i.test(n);
    });
    
    if (significantNumbers.length > 0) {
      score += 35;
      factors.push(`Numbers: ${significantNumbers.slice(0, 2).join(', ')}`);
    }
  }
  
  // Major entities
  if (extracted?.entities?.length > 0) {
    score += 20;
    factors.push(`Entities: ${extracted.entities.slice(0, 2).join(', ')}`);
  }
  
  // Timeline/Date
  const content = `${item.title || ''} ${item.description || ''}`;
  if (/202[4-9]|next year|this quarter|by \d{4}|Q[1-4]|within \d+/i.test(content)) {
    score += 10;
    factors.push('Has timeline');
  }
  
  // REJECT: Too vague (lowered for testing)
  if (score < 10) {  // Lowered to 10 for testing
    return { 
      pass: false, 
      gate: 'GATE4_SPECIFICITY',
      reason: 'Too vague - needs numbers or major entities',
      score 
    };
  }
  
  return {
    pass: true,
    specificity_score: score,
    factors
  };
}

// ========================================
// GATE 5: Hook Potential (DNA-based)
// ========================================
export function gate5_HookPotential(item, storyType, showDna) {
  const content = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  
  // High-performing hooks from DNA (success_rate >= 0.5 or avgViews > threshold)
  const hookPatterns = showDna?.hook_patterns || [];
  const highPerformingHooks = hookPatterns
    .filter(h => {
      const successRate = h.success_rate || h.successRate || 0;
      const avgViews = h.avgViews || h.avg_views || 0;
      return successRate >= 0.5 || avgViews > 30000;
    })
    .map(h => h.hook_type || h.pattern || h.type);
  
  // If no DNA hooks, use defaults
  const defaultHooks = ['Threat Claim', 'Reveal', 'Fact Anchor', 'Stakes'];
  const availableHooks = highPerformingHooks.length > 0 ? highPerformingHooks : defaultHooks;
  
  // Map story types to hooks
  const storyToHook = {
    'THREAT': 'Threat Claim',
    'OPPORTUNITY': 'Fact Anchor',
    'REVEAL': 'Reveal',
    'CONFLICT': 'Stakes',
    'RACE': 'Stakes',
    'MILESTONE': 'Fact Anchor',
    'SHIFT': 'Reveal',
    'CONSEQUENCE': 'Stakes'
  };
  
  const suggestedHook = storyToHook[storyType?.primary] || 'Fact Anchor';
  
  // Check if suggested hook is high-performing
  if (availableHooks.includes(suggestedHook) || availableHooks.length === 0) {
    const hookData = hookPatterns.find(h => (h.hook_type || h.pattern || h.type) === suggestedHook);
    return {
      pass: true,
      hook: suggestedHook,
      avg_views: hookData?.avgViews || hookData?.avg_views || 0,
      success_rate: hookData?.success_rate || hookData?.successRate || 0.5
    };
  }
  
  // Try to find ANY high-performing hook that matches
  // Check content for hook signals
  const hookSignals = {
    'Threat Claim': /threat|risk|danger|crisis|lose|collapse|fail|خطر|تهديد/i.test(content),
    'Reveal': /secret|hidden|truth|reveal|expose|discover|behind|سر|كشف/i.test(content),
    'Fact Anchor': /\d+.*(?:billion|million|%)|\$\d+|record|first ever|قياسي/i.test(content),
    'Stakes': /will change|impact|affect|future|at stake|تأثير|مستقبل/i.test(content)
  };
  
  for (const hook of availableHooks) {
    if (hookSignals[hook]) {
      const hookData = hookPatterns.find(h => (h.hook_type || h.pattern || h.type) === hook);
      return {
        pass: true,
        hook,
        avg_views: hookData?.avgViews || hookData?.avg_views || 0,
        success_rate: hookData?.success_rate || hookData?.successRate || 0.5,
        matched_by: 'content_signal'
      };
    }
  }
  
  // If no DNA data, be lenient but still check for hook signals
  if (hookPatterns.length === 0) {
    // No DNA hooks available, check if content has any hook signals
    const hasAnyHook = Object.values(hookSignals).some(signal => signal);
    if (hasAnyHook) {
      return {
        pass: true,
        hook: 'Unknown',
        avg_views: 0,
        success_rate: 0.3,
        matched_by: 'content_signal_no_dna'
      };
    }
  }
  
  // REJECT: No high-performing hook match
  return { 
    pass: false, 
    gate: 'GATE5_HOOK',
    reason: 'No strong hook - does not match high-performing hook patterns' 
  };
}

// ========================================
// GATE 6: Uniqueness (One per topic)
// ========================================
export function gate6_Uniqueness(passedItems) {
  const topicBest = new Map();
  
  for (const item of passedItems) {
    const topic = item.gates?.gate1?.topic || 'unknown';
    
    if (!topicBest.has(topic)) {
      topicBest.set(topic, item);
    } else {
      const existing = topicBest.get(topic);
      const existingScore = existing.total_score || 0;
      const itemScore = item.total_score || 0;
      
      if (itemScore > existingScore) {
        topicBest.set(topic, item);
      }
    }
  }
  
  return Array.from(topicBest.values());
}

