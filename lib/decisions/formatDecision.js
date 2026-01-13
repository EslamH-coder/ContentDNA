/**
 * Decide format: LONG (25-30min), SHORT (30-45sec), or BOTH
 * Based on DNA topic performance + content characteristics
 */

// Topics that ALWAYS need depth (complex geopolitics)
const COMPLEX_TOPICS = [
  'us_china_geopolitics',
  'missiles_air_defense',
  'arms_industry_exports',
  'logistics_supply_chain',
  'war_costs_economics'
];

// Topics good for shorts (single facts, quick reactions)
const SHORT_FRIENDLY_TOPICS = [
  'gold_commodities',
  'energy_oil_gas_lng',
  'currency_devaluation'
];

export function decideFormat(item, storyType, classification, showDna) {
  const topicId = classification?.topic?.primary_topic;
  const topicConfidence = classification?.topic?.confidence || 0;
  const dnaTopic = showDna?.topics?.find(t => (t.topicId === topicId || t.topic_id === topicId));
  const content = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  
  // Extract characteristics
  const entityCount = classification?.entities?.length || 0;
  const hasNumbers = (classification?.numbers?.length || 0) > 0;
  
  // ===== RULE 1: Losing topic = SHORT only or SKIP =====
  if (dnaTopic && (dnaTopic.status === 'losing' || (dnaTopic.successRate || dnaTopic.success_rate || 0) < 30)) {
    const successRate = (dnaTopic.successRate || dnaTopic.success_rate || 0);
    return {
      decision: 'SHORT_OR_SKIP',
      duration: '30-45 sec MAX',
      reason: `Losing topic: ${topicId} has ${successRate.toFixed(0)}% success rate. Don't invest long-form effort.`,
      recommendation: 'Test with short first. If no traction, skip.',
      icon: '⚠️',
      investment_level: 'LOW'
    };
  }
  
  // ===== RULE 2: Complex topic = LONG always =====
  if (COMPLEX_TOPICS.includes(topicId)) {
    return {
      decision: 'LONG',
      duration: '25-30 min',
      reason: `Complex geopolitical topic (${topicId}) requires depth and context`,
      recommendation: 'Full deep-dive with historical context',
      icon: '📺',
      investment_level: 'HIGH'
    };
  }
  
  // ===== RULE 3: Winning topic + High confidence = LONG or BOTH =====
  if (dnaTopic && (dnaTopic.status === 'winning' || (dnaTopic.successRate || dnaTopic.success_rate || 0) >= 50) && topicConfidence >= 0.5) {
    // Check if it also has viral potential for BOTH
    const hasViralElement = hasNumbers && entityCount > 0;
    const isUrgentNews = /breaking|announces|launches|crashes|surges|plunges/.test(content);
    
    if (hasViralElement && isUrgentNews) {
      const successRate = (dnaTopic.successRate || dnaTopic.success_rate || 0);
      return {
        decision: 'BOTH',
        duration: 'Long: 25-30 min + 2-3 Shorts: 30-45 sec',
        reason: `Winning topic (${successRate.toFixed(0)}% success) + viral elements + urgent`,
        recommendation: 'Full video + extract 2-3 shorts from key moments',
        shorts_ideas: [
          'The key number/stat',
          'The most surprising fact',
          'The Arab audience angle'
        ],
        icon: '🔄',
        investment_level: 'MAXIMUM'
      };
    }
    
    const successRate = (dnaTopic.successRate || dnaTopic.success_rate || 0);
    return {
      decision: 'LONG',
      duration: '25-30 min',
      reason: `Winning topic (${successRate.toFixed(0)}% success) - worth full investment`,
      recommendation: 'Deep-dive with full context',
      icon: '📺',
      investment_level: 'HIGH'
    };
  }
  
  // ===== RULE 4: Neutral/New topic = SHORT to test =====
  if (!dnaTopic || dnaTopic.status === 'neutral' || ((dnaTopic.successRate || dnaTopic.success_rate || 0) >= 30 && (dnaTopic.successRate || dnaTopic.success_rate || 0) < 50)) {
    const successRate = dnaTopic ? (dnaTopic.successRate || dnaTopic.success_rate || 0) : null;
    return {
      decision: 'SHORT',
      duration: '30-45 sec',
      reason: dnaTopic 
        ? `Neutral topic (${successRate.toFixed(0)}% success) - test audience interest first`
        : 'New topic not in DNA - test before investing',
      recommendation: 'Create short to gauge interest. If >1M views, consider long-form.',
      success_threshold: '1M views = proceed to long-form',
      icon: '📱',
      investment_level: 'LOW'
    };
  }
  
  // ===== RULE 5: Single fact/stat = SHORT =====
  const isSingleFact = storyType?.primary === 'MILESTONE' || 
                       (hasNumbers && entityCount <= 1);
  if (isSingleFact) {
    return {
      decision: 'SHORT',
      duration: '30-45 sec',
      reason: 'Single fact/milestone - perfect for short format',
      recommendation: 'Quick, punchy short with the key number',
      icon: '📱',
      investment_level: 'LOW'
    };
  }
  
  // ===== DEFAULT: Based on story type =====
  const longFormStoryTypes = ['CONFLICT', 'SHIFT', 'CONSEQUENCE', 'REVEAL'];
  if (storyType?.primary && longFormStoryTypes.includes(storyType.primary)) {
    return {
      decision: 'LONG',
      duration: '25-30 min',
      reason: `${storyType.primary} story type typically needs depth`,
      recommendation: 'Standard long-form treatment',
      icon: '📺',
      investment_level: 'MEDIUM'
    };
  }
  
  // Final default
  return {
    decision: 'SHORT',
    duration: '30-45 sec',
    reason: 'Default to short - lower risk',
    recommendation: 'Test with short first',
    icon: '📱',
    investment_level: 'LOW'
  };
}

