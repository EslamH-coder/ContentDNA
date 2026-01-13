export function enrichWithDna(classifiedItem, filterResult, showDna) {
  const topicId = classifiedItem.classification.topic.primary_topic;
  const dnaTopic = showDna.topics?.find(t => t.topicId === topicId || t.topic_id === topicId);
  
  const decisions = {};
  
  // DECISION 1: Hook Type
  const hookSignal = filterResult.flags.hook_signal;
  const hookMap = {
    'threat': 'Threat Claim',
    'reveal': 'Reveal',
    'fact_anchor': 'Fact Anchor'
  };
  
  const hookType = hookMap[hookSignal] || 'Threat Claim'; // Default to best performer
  
  // Find hook pattern from DNA (hook_patterns array from API)
  const hookData = showDna.hook_patterns?.find(h => 
    h.pattern?.includes(hookType) || 
    h.hook_type === hookType ||
    h.pattern?.toLowerCase().includes('threat')
  ) || {
    hook_type: hookType,
    avgViews: 5600000,
    pattern: hookType,
    template: '[رقم] في خطر... [السبب]!'
  };
  
  decisions.hook = {
    type: hookData.hook_type || hookType,
    template: hookData.template || `[${hookType} template]`,
    avg_views: hookData.avgViews || hookData.avg_views || 5600000,
    why: hookSignal ? `Content has ${hookSignal} signal` : 'Best performer in DNA'
  };
  
  // DECISION 2: Format
  const complexTopics = ['us_china_geopolitics', 'missiles_air_defense', 'arms_industry_exports', 'logistics_supply_chain'];
  const isComplex = complexTopics.includes(topicId);
  
  decisions.format = {
    recommended: isComplex ? 'long_form' : 'both',
    why: isComplex ? 'Complex topic needs depth' : 'Works for both formats',
    long_duration: '25-30 min',
    short_duration: '30-45 sec'
  };
  
  // DECISION 3: Triggers
  const triggers = [];
  
  if (classifiedItem.classification.has_numbers) {
    triggers.push({
      trigger: 'specificity',
      instruction: `Use: ${classifiedItem.classification.entities.numbers.slice(0, 2).join(', ')}`
    });
  }
  
  if (filterResult.flags.hook_signal === 'threat' || classifiedItem.classification.signals.is_threat) {
    triggers.push({
      trigger: 'loss_framing',
      instruction: 'Frame as threat/loss, not opportunity'
    });
  }
  
  if (classifiedItem.classification.has_arab_region) {
    triggers.push({
      trigger: 'regional_relevance',
      instruction: `Emphasize: ${classifiedItem.classification.entities.regions.join(', ')}`
    });
  } else {
    triggers.push({
      trigger: 'regional_relevance',
      instruction: 'ADD Arab angle: impact on Gulf jobs, Egypt prices, Saudi investments',
      needs_creation: true
    });
  }
  
  decisions.triggers = triggers;
  
  // DECISION 4: Confidence
  let confidence = filterResult.final_score;
  if (dnaTopic) {
    const successRate = dnaTopic.successRate || dnaTopic.success_rate || 0;
    if (successRate >= 70) confidence += 10;
    if (successRate < 50) confidence -= 15;
  }
  if (classifiedItem.classification.has_arab_region) confidence += 5;
  
  decisions.confidence = {
    score: Math.min(100, Math.max(0, confidence)),
    level: confidence >= 70 ? 'HIGH' : confidence >= 45 ? 'MEDIUM' : 'LOW'
  };
  
  // DECISION 5: Reference
  if (dnaTopic) {
    decisions.reference = {
      topic_success_rate: dnaTopic.successRate || dnaTopic.success_rate || 0,
      topic_avg_views: dnaTopic.avgViews || dnaTopic.avg_views || 0,
      topic_status: filterResult.flags.topic_status || 'unknown'
    };
  }
  
  return {
    ...classifiedItem,
    filter: filterResult,
    decisions
  };
}

