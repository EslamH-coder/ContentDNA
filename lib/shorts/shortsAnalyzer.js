/**
 * SHORTS SUCCESS PREDICTOR
 * Based on actual shorts data: viewed_vs_swiped, retention_3s, duration, topic
 */

// ============================================
// SHORTS BENCHMARKS (From Actual Data)
// ============================================
export const SHORTS_BENCHMARKS = {
  views: {
    average: 1766387,
    median: 363950,
    viral_threshold: 2000000,  // Above this = viral
    success_threshold: 500000  // Above this = successful
  },
  
  viewed_vs_swiped: {
    average: 65.4,
    good: 68.0,
    excellent: 73.0,  // Top performer: 73.2%
    poor: 60.0,
    insight: "KEY METRIC! Higher = more people watch vs swipe away"
  },
  
  retention_3s: {
    average: 119.6,
    good: 120,
    excellent: 125,
    warning: "High retention ≠ high views! 130% retention got only 163K views"
  },
  
  duration_seconds: {
    optimal_min: 54,
    optimal_max: 80,
    danger_zone: 120,  // Shorts > 120 sec underperform
    insight: "60-80 sec is sweet spot. 165 sec shorts get 10x fewer views"
  }
};

// ============================================
// SHORTS TOPIC PERFORMANCE
// ============================================
export const SHORTS_TOPICS = {
  // VIRAL SHORTS TOPICS
  viral: [
    {
      topic_id: "missiles_air_defense",
      avg_views: 5601208,
      viewed_pct: 65.5,
      retention_3s: 120,
      verdict: "BEST SHORTS TOPIC - Military/defense goes viral"
    },
    {
      topic_id: "big_tech_platforms",
      avg_views: 5563281,
      viewed_pct: 73.2,  // HIGHEST!
      retention_3s: 113,
      verdict: "Controversial tech stories go viral"
    },
    {
      topic_id: "arms_industry_exports",
      avg_views: 1849543,
      viewed_pct: 67.2,
      retention_3s: 125.5,
      verdict: "Military exports work for shorts"
    }
  ],
  
  // MODERATE SHORTS TOPICS
  moderate: [
    {
      topic_id: "us_china_geopolitics",
      avg_views: 1444598,
      viewed_pct: 64.0,
      retention_3s: 123.5,
      verdict: "Works but less viral than military"
    }
  ],
  
  // WEAK SHORTS TOPICS  
  weak: [
    {
      topic_id: "energy_oil_gas_lng",
      avg_views: 286663,
      viewed_pct: 61.8,
      retention_3s: 119,
      verdict: "Energy topics don't go viral as shorts"
    },
    {
      topic_id: "logistics_supply_chain",
      avg_views: 353617,
      viewed_pct: 62.4,
      retention_3s: 105,  // LOWEST!
      verdict: "Complex topics need long-form"
    },
    {
      topic_id: "sanctions_econ_war",
      avg_views: 271057,
      viewed_pct: 59.1,  // LOWEST!
      retention_3s: 127,
      verdict: "Abstract topics don't work as shorts"
    }
  ]
};

// ============================================
// PREDICT SHORTS SUCCESS
// ============================================
export function predictShortsSuccess(item, topic, duration_seconds) {
  const result = {
    predicted_success: null,
    score: 0,
    factors: [],
    warnings: [],
    recommendations: []
  };
  
  // Factor 1: Topic (most important!)
  const viralTopic = SHORTS_TOPICS.viral.find(t => t.topic_id === topic);
  const moderateTopic = SHORTS_TOPICS.moderate.find(t => t.topic_id === topic);
  const weakTopic = SHORTS_TOPICS.weak.find(t => t.topic_id === topic);
  
  if (viralTopic) {
    result.score += 40;
    result.factors.push({
      factor: 'TOPIC',
      impact: '+40',
      reason: `${topic} is a VIRAL shorts topic (avg ${viralTopic.avg_views.toLocaleString()} views)`
    });
  } else if (moderateTopic) {
    result.score += 20;
    result.factors.push({
      factor: 'TOPIC',
      impact: '+20',
      reason: `${topic} is a moderate shorts topic`
    });
  } else if (weakTopic) {
    result.score -= 20;
    result.factors.push({
      factor: 'TOPIC',
      impact: '-20',
      reason: `${topic} is WEAK for shorts (avg ${weakTopic.avg_views.toLocaleString()} views)`
    });
    result.warnings.push('Topic historically underperforms as shorts');
  } else {
    result.factors.push({
      factor: 'TOPIC',
      impact: '0',
      reason: 'New topic - no shorts data'
    });
  }
  
  // Factor 2: Duration
  if (duration_seconds >= SHORTS_BENCHMARKS.duration_seconds.optimal_min &&
      duration_seconds <= SHORTS_BENCHMARKS.duration_seconds.optimal_max) {
    result.score += 20;
    result.factors.push({
      factor: 'DURATION',
      impact: '+20',
      reason: `${duration_seconds}s is in optimal range (60-80s)`
    });
  } else if (duration_seconds > SHORTS_BENCHMARKS.duration_seconds.danger_zone) {
    result.score -= 30;
    result.factors.push({
      factor: 'DURATION',
      impact: '-30',
      reason: `${duration_seconds}s is TOO LONG. Shorts >120s get 10x fewer views!`
    });
    result.warnings.push(`CRITICAL: Shorten to under 80 seconds`);
  } else if (duration_seconds > SHORTS_BENCHMARKS.duration_seconds.optimal_max) {
    result.score -= 10;
    result.factors.push({
      factor: 'DURATION',
      impact: '-10',
      reason: `${duration_seconds}s is slightly long. Target 60-80s.`
    });
  }
  
  // Factor 3: Content signals (military, controversy, big numbers)
  const content = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  
  if (/missile|صاروخ|قبة|دفاع|عسكري|جيش|سلاح/.test(content)) {
    result.score += 15;
    result.factors.push({
      factor: 'CONTENT',
      impact: '+15',
      reason: 'Military/defense content = high viral potential'
    });
  }
  
  if (/controversial|scandal|احتلال|فضيحة|سر|كشف/.test(content)) {
    result.score += 10;
    result.factors.push({
      factor: 'CONTENT',
      impact: '+10',
      reason: 'Controversial angle = higher shares'
    });
  }
  
  // Factor 4: Predicted viewed_vs_swiped
  const topicData = viralTopic || moderateTopic || weakTopic;
  const predictedViewed = topicData?.viewed_pct || SHORTS_BENCHMARKS.viewed_vs_swiped.average;
  
  if (predictedViewed >= SHORTS_BENCHMARKS.viewed_vs_swiped.excellent) {
    result.score += 15;
  } else if (predictedViewed >= SHORTS_BENCHMARKS.viewed_vs_swiped.good) {
    result.score += 10;
  } else if (predictedViewed < SHORTS_BENCHMARKS.viewed_vs_swiped.poor) {
    result.score -= 10;
  }
  
  result.predicted_viewed_pct = predictedViewed;
  
  // Final verdict
  if (result.score >= 50) {
    result.predicted_success = 'HIGH';
    result.predicted_views = '1M+';
    result.recommendations.push('GO! This has viral potential');
  } else if (result.score >= 20) {
    result.predicted_success = 'MEDIUM';
    result.predicted_views = '300K-1M';
    result.recommendations.push('Worth trying, but optimize based on warnings');
  } else {
    result.predicted_success = 'LOW';
    result.predicted_views = '<300K';
    result.recommendations.push('Consider: Is this worth producing as a short?');
  }
  
  return result;
}

// ============================================
// SHORTS QUALITY GATES
// ============================================
export function applyShortsGates(item, topic, plannedDuration) {
  const gates = {
    passed: true,
    gates: {},
    verdict: null
  };
  
  // Gate 1: Duration
  gates.gates.duration = {
    value: plannedDuration,
    threshold: SHORTS_BENCHMARKS.duration_seconds.danger_zone,
    passed: plannedDuration <= SHORTS_BENCHMARKS.duration_seconds.danger_zone,
    message: plannedDuration > 120 
      ? `FAIL: ${plannedDuration}s is too long. Max 120s, ideal 60-80s.`
      : `PASS: ${plannedDuration}s is acceptable`
  };
  
  if (!gates.gates.duration.passed) {
    gates.passed = false;
  }
  
  // Gate 2: Topic suitability
  const weakTopic = SHORTS_TOPICS.weak.find(t => t.topic_id === topic);
  gates.gates.topic = {
    topic: topic,
    passed: !weakTopic,
    message: weakTopic
      ? `WARNING: ${topic} averages only ${weakTopic.avg_views.toLocaleString()} views as shorts`
      : `OK: Topic suitable for shorts`
  };
  
  // Gate 3: Viewed vs Swiped prediction
  const topicData = [...SHORTS_TOPICS.viral, ...SHORTS_TOPICS.moderate, ...SHORTS_TOPICS.weak]
    .find(t => t.topic_id === topic);
  const predictedViewed = topicData?.viewed_pct || SHORTS_BENCHMARKS.viewed_vs_swiped.average;
  
  gates.gates.viewed_prediction = {
    predicted: predictedViewed,
    threshold: SHORTS_BENCHMARKS.viewed_vs_swiped.poor,
    passed: predictedViewed >= SHORTS_BENCHMARKS.viewed_vs_swiped.poor,
    message: `Predicted viewed %: ${predictedViewed}% (avg: ${SHORTS_BENCHMARKS.viewed_vs_swiped.average}%)`
  };
  
  // Final verdict
  if (gates.passed) {
    const viralTopic = SHORTS_TOPICS.viral.find(t => t.topic_id === topic);
    if (viralTopic && plannedDuration <= 80) {
      gates.verdict = 'STRONG GO - Viral topic + optimal duration';
    } else {
      gates.verdict = 'GO - Meets minimum requirements';
    }
  } else {
    gates.verdict = 'NEEDS CHANGES - See gate failures';
  }
  
  return gates;
}

