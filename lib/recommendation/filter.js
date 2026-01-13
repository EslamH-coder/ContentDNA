export function filterWithDna(classifiedItem, showDna) {
  const { classification } = classifiedItem;
  const topicId = classification.topic.primary_topic;
  
  const result = {
    passed: true,
    score: 0,
    reasons: [],
    rejections: [],
    flags: {}
  };
  
  // GATE 1: Topic Match
  if (!topicId) {
    result.rejections.push('NO_TOPIC_MATCH');
    result.passed = false;
    return result;
  }
  
  if (classification.topic.confidence < 0.25) {
    result.rejections.push(`LOW_CONFIDENCE: ${(classification.topic.confidence * 100).toFixed(0)}%`);
    result.passed = false;
    return result;
  }
  
  result.score += classification.topic.confidence * 20;
  result.reasons.push(`Topic: ${topicId} (${(classification.topic.confidence * 100).toFixed(0)}%)`);
  
  // GATE 2: DNA Topic Status
  // showDna.topics is an array from the DNA recalculation API
  const dnaTopic = showDna.topics?.find(t => t.topicId === topicId || t.topic_id === topicId);
  
  if (dnaTopic) {
    // Determine status from success rate
    const successRate = dnaTopic.successRate || dnaTopic.success_rate || 0;
    const avgViews = dnaTopic.avgViews || dnaTopic.avg_views || 0;
    
    if (successRate >= 70) {
      result.score += 25;
      result.reasons.push(`WINNING: ${successRate.toFixed(0)}% success, ${avgViews.toLocaleString()} avg`);
      result.flags.topic_status = 'winning';
    } else if (successRate >= 50) {
      result.score += 10;
      result.reasons.push('NEUTRAL: Mixed results');
      result.flags.topic_status = 'neutral';
    } else {
      result.score -= 10;
      result.reasons.push(`LOSING: ${successRate.toFixed(0)}% success - experiment only`);
      result.flags.topic_status = 'losing';
      result.flags.experiment_only = true;
    }
  } else {
    result.score += 5;
    result.reasons.push('NEW_TOPIC: Not in DNA');
    result.flags.new_topic = true;
    result.flags.topic_status = 'new';
  }
  
  // GATE 3: Regional Relevance
  if (classification.has_arab_region) {
    result.score += 20;
    result.reasons.push(`REGIONAL: ${classification.entities.regions.slice(0, 2).join(', ')}`);
  } else {
    result.flags.needs_regional_angle = true;
    result.reasons.push('NO_REGIONAL: Needs Arab angle');
  }
  
  // GATE 4: Numbers
  if (classification.has_numbers) {
    result.score += 15;
    result.reasons.push(`NUMBERS: ${classification.entities.numbers.slice(0, 2).join(', ')}`);
  } else {
    result.score -= 5;
    result.reasons.push('NO_NUMBERS: Weak specificity');
  }
  
  // GATE 5: Hook Signal
  if (classification.signals.is_threat) {
    result.score += 15;
    result.flags.hook_signal = 'threat';
    result.reasons.push('THREAT_SIGNAL: Threat Claim hook (5.6M avg)');
  } else if (classification.signals.is_reveal) {
    result.score += 12;
    result.flags.hook_signal = 'reveal';
    result.reasons.push('REVEAL_SIGNAL: Reveal hook (5.5M avg)');
  } else if (classification.signals.is_milestone) {
    result.score += 8;
    result.flags.hook_signal = 'fact_anchor';
    result.reasons.push('MILESTONE_SIGNAL: Fact Anchor hook');
  }
  
  // GATE 6: Major Entity
  if (classification.has_major_entity) {
    result.score += 10;
    result.reasons.push(`ENTITY: ${[...classification.entities.companies, ...classification.entities.people].slice(0, 2).join(', ')}`);
  }
  
  // Final score and decision
  result.final_score = Math.min(100, Math.max(0, result.score));
  
  if (result.final_score < 25) {
    result.passed = false;
    result.rejections.push(`LOW_SCORE: ${result.final_score}`);
  }
  
  // Priority assignment
  if (result.final_score >= 70) {
    result.priority = 'HIGH';
    result.action = 'PRODUCE';
  } else if (result.final_score >= 45) {
    result.priority = 'MEDIUM';
    result.action = result.flags.experiment_only ? 'EXPERIMENT' : 'CONSIDER';
  } else if (result.final_score >= 25) {
    result.priority = 'LOW';
    result.action = 'BACKLOG';
  }
  
  return result;
}

