import { ENHANCED_DNA } from '../dna/enhancedDna.js';

/**
 * RETENTION-BASED QUALITY GATES
 * Not just topic match - uses actual performance metrics
 */

// ============================================
// GATE: Ceiling Detection
// ============================================
export function gate_CeilingDetection(topicId) {
  if (!topicId) {
    return { pass: true, has_ceiling: false, reason: 'No topic ID provided' };
  }
  
  const topic = ENHANCED_DNA.topics.find(t => t.topic_id === topicId);
  
  if (!topic) {
    return { pass: true, has_ceiling: false, reason: `Topic "${topicId}" not in enhanced DNA - no ceiling data` };
  }
  
  if (topic.has_ceiling) {
    return {
      pass: false,
      has_ceiling: true,
      gate: 'CEILING_DETECTION',
      reason: topic.ceiling_reason,
      metrics: topic.metrics,
      insight: topic.insight,
      recommendation: 'SKIP or SHORT only. Topic cannot go viral despite good metrics.'
    };
  }
  
  return {
    pass: true,
    has_ceiling: false,
    viral_potential: topic.viral_potential
  };
}

// ============================================
// GATE: Viral Potential
// ============================================
export function gate_ViralPotential(topicId) {
  const topic = ENHANCED_DNA.topics.find(t => t.topic_id === topicId);
  
  if (!topic) {
    return { pass: true, potential: 'UNKNOWN', reason: 'New topic' };
  }
  
  // Check metrics vs benchmarks
  const benchmarks = ENHANCED_DNA.retention_benchmarks.long_form;
  const metrics = topic.metrics;
  
  // High retention + high CTR but low views = CEILING TRAP
  if (metrics.retention_30s >= benchmarks.hook_retention_30s.good &&
      metrics.ctr >= benchmarks.ctr.good &&
      metrics.views_avg < 800000) {
    return {
      pass: false,
      potential: 'CEILING',
      gate: 'VIRAL_POTENTIAL',
      reason: 'TRAP: Good metrics but low views = ceiling topic',
      recommendation: 'Topic has limited audience. Skip for long-form.'
    };
  }
  
  // Good views = has viral potential
  if (metrics.views_avg >= 1500000) {
    return {
      pass: true,
      potential: 'HIGH',
      reason: 'Topic has proven viral potential'
    };
  }
  
  if (metrics.views_avg >= 800000) {
    return {
      pass: true,
      potential: 'MEDIUM',
      reason: 'Topic has moderate reach'
    };
  }
  
  return {
    pass: true,
    potential: 'LOW',
    reason: 'Topic has limited reach - test with short first'
  };
}

// ============================================
// GATE: Predicted Retention
// ============================================
export function gate_PredictedRetention(item, hookPattern) {
  const benchmarks = ENHANCED_DNA.retention_benchmarks.long_form;
  
  // Find matching hook pattern
  const pattern = ENHANCED_DNA.hook_patterns.find(p => p.pattern_id === hookPattern);
  
  if (!pattern) {
    return {
      pass: true,
      predicted_retention: benchmarks.hook_retention_30s.average,
      confidence: 'LOW',
      reason: 'No matching hook pattern - using average'
    };
  }
  
  // Use hook pattern's actual retention
  const predictedRetention = pattern.metrics.retention_30s;
  
  if (predictedRetention >= benchmarks.hook_retention_30s.excellent) {
    return {
      pass: true,
      predicted_retention: predictedRetention,
      confidence: 'HIGH',
      reason: `Hook pattern "${pattern.name}" has excellent retention`
    };
  }
  
  if (predictedRetention >= benchmarks.hook_retention_30s.good) {
    return {
      pass: true,
      predicted_retention: predictedRetention,
      confidence: 'MEDIUM',
      reason: `Hook pattern "${pattern.name}" has good retention`
    };
  }
  
  return {
    pass: true,
    predicted_retention: predictedRetention,
    confidence: 'LOW',
    reason: `Hook pattern "${pattern.name}" has average retention`
  };
}

// ============================================
// COMBINED RETENTION GATE
// ============================================
export function applyRetentionGates(item, classification) {
  const topicId = classification?.topic?.primary_topic;
  
  const results = {
    passed: true,
    gates: {},
    warnings: [],
    recommendation: null
  };
  
  // Gate 1: Ceiling Detection
  const ceilingResult = gate_CeilingDetection(topicId);
  results.gates.ceiling = ceilingResult;
  
  if (!ceilingResult.pass) {
    results.passed = false;
    results.recommendation = ceilingResult.recommendation;
    return results;
  }
  
  // Gate 2: Viral Potential
  const viralResult = gate_ViralPotential(topicId);
  results.gates.viral = viralResult;
  
  if (!viralResult.pass) {
    results.passed = false;
    results.recommendation = viralResult.recommendation;
    return results;
  }
  
  // Add warnings for medium/low potential
  if (viralResult.potential === 'MEDIUM') {
    results.warnings.push('Medium viral potential - consider SHORT first');
  }
  if (viralResult.potential === 'LOW') {
    results.warnings.push('Low viral potential - definitely test with SHORT');
  }
  
  return results;
}

