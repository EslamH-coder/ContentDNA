/**
 * Apply learned weights to recommendations
 * This makes recommendations smarter over time based on user feedback
 */

/**
 * Get topics that should be hidden (rejected or already seen)
 */
export async function getHiddenTopics(supabase, showId, options = {}) {
  const {
    hideRejected = true,        // Always hide rejected
    hideLikedFor = 0,           // Never hide liked (changed from 24 to 0)
    hideProducedFor = 168,      // Hide produced topics for 7 days
    hideSavedFor = 0            // Don't hide saved (user wants to see them)
  } = options;

  const hiddenTopics = {
    rejected: [],
    liked: [],
    produced: [],
    saved: []
  };

  try {
    // Get all feedback for this show
    const { data: feedbacks } = await supabase
      .from('recommendation_feedback')
      .select('topic, action, created_at')
      .eq('show_id', showId)
      .order('created_at', { ascending: false });

    if (!feedbacks) return hiddenTopics;

    const now = new Date();

    feedbacks.forEach(fb => {
      const hoursSince = (now - new Date(fb.created_at)) / (1000 * 60 * 60);
      
      // Always hide rejected
      if (fb.action === 'rejected' && hideRejected) {
        if (!hiddenTopics.rejected.includes(fb.topic)) {
          hiddenTopics.rejected.push(fb.topic);
        }
      }
      
      // Hide liked for X hours
      if (fb.action === 'liked' && hideLikedFor > 0 && hoursSince < hideLikedFor) {
        if (!hiddenTopics.liked.includes(fb.topic)) {
          hiddenTopics.liked.push(fb.topic);
        }
      }
      
      // Hide produced for X hours
      if (fb.action === 'produced' && hideProducedFor > 0 && hoursSince < hideProducedFor) {
        if (!hiddenTopics.produced.includes(fb.topic)) {
          hiddenTopics.produced.push(fb.topic);
        }
      }
    });

    console.log('🙈 Hidden topics:', {
      rejected: hiddenTopics.rejected.length,
      liked: hiddenTopics.liked.length,
      produced: hiddenTopics.produced.length
    });

    return hiddenTopics;

  } catch (error) {
    console.error('Error getting hidden topics:', error);
    return hiddenTopics;
  }
}

/**
 * Normalize topic for comparison
 */
function normalizeTopicForComparison(topic) {
  return topic
    .replace(/[-–—]/g, ' ')
    .replace(/[؟?!.,:;]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Calculate similarity between two strings (0-1)
 */
function similarityScore(str1, str2) {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;
  
  // Simple word overlap similarity
  const words1 = new Set(str1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(str2.split(' ').filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let matches = 0;
  words1.forEach(word => {
    if (words2.has(word)) matches++;
  });
  
  return matches / Math.max(words1.size, words2.size);
}

/**
 * Filter out hidden topics from recommendations
 */
export function filterHiddenTopics(recommendations, hiddenTopics) {
  const allHidden = [
    ...hiddenTopics.rejected,
    ...hiddenTopics.liked,
    ...hiddenTopics.produced,
    ...hiddenTopics.saved
  ];

  if (allHidden.length === 0) return recommendations;

  const filtered = recommendations.filter(rec => {
    // Check exact match
    if (allHidden.includes(rec.topic)) {
      console.log(`🚫 Hiding (exact match): "${rec.topic.substring(0, 40)}..."`);
      return false;
    }
    
    // Check partial match (for similar topics)
    const isHidden = allHidden.some(hidden => {
      // Normalize both strings
      const normalizedHidden = normalizeTopicForComparison(hidden);
      const normalizedTopic = normalizeTopicForComparison(rec.topic);
      
      // Check if 80% similar
      return similarityScore(normalizedHidden, normalizedTopic) > 0.8;
    });
    
    if (isHidden) {
      console.log(`🚫 Hiding (similar match): "${rec.topic.substring(0, 40)}..."`);
      return false;
    }
    
    return true;
  });

  console.log(`📋 Filtered: ${recommendations.length} → ${filtered.length} recommendations`);
  
  return filtered;
}

/**
 * Check if a topic has a specific angle (not just a broad subject)
 * Returns: { hasAngle: boolean, angleType: string, confidence: number }
 */
export function analyzeTopicAngle(topic) {
  if (!topic) return { hasAngle: false, angleType: 'none', confidence: 0 };

  const result = {
    hasAngle: false,
    angleType: 'none',
    confidence: 0,
    details: []
  };

  // 1. Question format = specific angle
  if (/[؟?]/.test(topic)) {
    result.hasAngle = true;
    result.angleType = 'question';
    result.confidence += 0.4;
    result.details.push('question_format');
  }

  // 2. Question words = specific angle
  const questionWords = ['كيف', 'لماذا', 'ماذا', 'متى', 'أين', 'هل', 'ما هو', 'ما هي'];
  if (questionWords.some(w => topic.includes(w))) {
    result.hasAngle = true;
    result.angleType = 'inquiry';
    result.confidence += 0.3;
    result.details.push('question_word');
  }

  // 3. Relationship/comparison words = specific angle
  const relationWords = ['و', 'بين', 'مع', 'ضد', 'على', 'في', 'تأثير', 'مستقبل', 'أزمة', 'حرب', 'صراع'];
  const relationCount = relationWords.filter(w => topic.includes(w)).length;
  if (relationCount >= 1) {
    result.hasAngle = true;
    result.angleType = 'relationship';
    result.confidence += Math.min(0.3, relationCount * 0.1);
    result.details.push(`relation_words: ${relationCount}`);
  }

  // 4. Action/event words = specific angle
  const actionWords = ['يعلن', 'يكشف', 'يحذر', 'يهدد', 'يفرض', 'ترتفع', 'تنخفض', 'تتراجع', 'استحواذ', 'صفقة', 'تحت حكم', 'في عهد', 'خلال فترة'];
  if (actionWords.some(w => topic.includes(w))) {
    result.hasAngle = true;
    result.angleType = 'event';
    result.confidence += 0.3;
    result.details.push('action_word');
  }

  // 5. Specific context words = specific angle
  const contextWords = ['2024', '2025', '2026', 'الجديد', 'الأخير', 'القادم', 'حصري', 'عاجل'];
  if (contextWords.some(w => topic.includes(w))) {
    result.hasAngle = true;
    result.angleType = 'timely';
    result.confidence += 0.2;
    result.details.push('context_word');
  }

  // 6. Length check - longer topics usually have more context
  if (topic.length > 35) {
    result.confidence += 0.2;
    result.details.push('detailed_length');
  } else if (topic.length < 20) {
    result.confidence -= 0.3;
    result.details.push('too_short');
  }

  // 7. Multiple entities = comparison/relationship angle
  const entities = ['الصين', 'أمريكا', 'روسيا', 'مصر', 'السعودية', 'الإمارات', 'إيران', 'تركيا', 
                    'ترامب', 'بوتين', 'ماسك', 'بايدن',
                    'تسلا', 'ميتا', 'جوجل', 'أبل', 'أمازون', 'إنفيديا'];
  const entityCount = entities.filter(e => topic.includes(e)).length;
  if (entityCount >= 2) {
    result.hasAngle = true;
    result.angleType = 'comparison';
    result.confidence += 0.3;
    result.details.push(`multi_entity: ${entityCount}`);
  }

  // 8. Single entity with no context = BAD (broad topic)
  if (entityCount === 1 && topic.split(' ').length <= 2) {
    result.hasAngle = false;
    result.angleType = 'broad_entity';
    result.confidence = 0;
    result.details.push('single_entity_no_context');
  }

  // Cap confidence at 1.0
  result.confidence = Math.min(1.0, Math.max(0, result.confidence));
  
  // Final decision
  result.hasAngle = result.confidence >= 0.3;

  return result;
}

export async function applyLearningWeights(supabase, showId, recommendations) {
  console.log('🧠 Applying learning weights to', recommendations.length, 'recommendations');
  
  // ============================================
  // STEP 0: Get liked recommendations - these should NEVER be hidden
  // ============================================
  const { data: likedFeedback } = await supabase
    .from('recommendation_feedback')
    .select('topic')
    .eq('show_id', showId)
    .eq('action', 'liked');

  const likedTopics = new Set(
    (likedFeedback || []).map(f => f.topic?.toLowerCase().trim()).filter(Boolean)
  );

  console.log(`💚 Found ${likedTopics.size} liked recommendations (protected)`);

  // Helper: Check if recommendation was liked
  function wasRecommendationLiked(topic) {
    const normalizedTopic = topic?.toLowerCase().trim() || '';
    if (!normalizedTopic) return false;
    
    // Exact match
    if (likedTopics.has(normalizedTopic)) return true;
    
    // Partial match (for truncated topics)
    for (const liked of likedTopics) {
      if (liked && normalizedTopic && (
        normalizedTopic.includes(liked.substring(0, 40)) || 
        liked.includes(normalizedTopic.substring(0, 40))
      )) {
        return true;
      }
    }
    
    return false;
  }

  // Mark liked recommendations as protected BEFORE filtering
  let processedRecommendations = recommendations.map(rec => {
    if (wasRecommendationLiked(rec.topic)) {
      console.log(`💚 PROTECTED (liked): ${rec.topic.substring(0, 50)}...`);
      return {
        ...rec,
        score: Math.max(100, rec.score || 50), // Boost to 100
        is_protected: true,
        protection_reason: 'user_liked'
      };
    }
    return rec;
  });
  
  // STEP 1: Get hidden topics and filter them out (but keep protected ones)
  const hiddenTopics = await getHiddenTopics(supabase, showId, {
    hideRejected: true,
    hideLikedFor: 0,       // Never hide liked (changed from 24)
    hideProducedFor: 168,  // Hide produced for 7 days
    hideSavedFor: 0        // Don't hide saved
  });
  
  // Filter hidden topics but always keep protected recommendations
  const filteredRecommendations = processedRecommendations.filter(rec => {
    // Always include protected recommendations
    if (rec.is_protected) {
      return true;
    }
    
    // Check if should be hidden
    const allHidden = [
      ...hiddenTopics.rejected,
      ...hiddenTopics.produced,
      ...hiddenTopics.saved
    ];
    
    if (allHidden.length === 0) return true;
    
    // Check exact match
    if (allHidden.includes(rec.topic)) {
      console.log(`🚫 Hiding (exact match): "${rec.topic.substring(0, 40)}..."`);
      return false;
    }
    
    // Check partial match
    const normalizedTopic = normalizeTopicForComparison(rec.topic);
    const isHidden = allHidden.some(hidden => {
      const normalizedHidden = normalizeTopicForComparison(hidden);
      return similarityScore(normalizedHidden, normalizedTopic) > 0.8;
    });
    
    if (isHidden) {
      console.log(`🚫 Hiding (similar match): "${rec.topic.substring(0, 40)}..."`);
      return false;
    }
    
    return true;
  });
  
  if (filteredRecommendations.length === 0) {
    console.log('⚠️ All recommendations were filtered out!');
    return [];
  }

  // STEP 2: Get learned weights
  const { data: weights, error } = await supabase
    .from('show_learning_weights')
    .select('*')
    .eq('show_id', showId)
    .single();

  if (error || !weights || weights.total_feedback_count < 3) {
    console.log('⚠️ Not enough learning data, returning filtered recommendations');
    return filteredRecommendations;
  }

  console.log('📊 Learned weights:', {
    topics: Object.keys(weights.topic_weights || {}).length,
    rejectionPatterns: weights.rejection_patterns,
    formatWeights: weights.format_weights,
    feedbackCount: weights.total_feedback_count
  });

  const topicWeights = weights.topic_weights || {};
  const formatWeights = weights.format_weights || {};
  const evidenceWeights = weights.evidence_weights || {};
  const rejectionPatterns = weights.rejection_patterns || {};

  // STEP 3: Apply weights to remaining recommendations
  const adjustedRecommendations = filteredRecommendations.map(rec => {
    let adjustedScore = rec.score;
    const adjustments = [];
    
    // Analyze angle first
    const angleAnalysis = analyzeTopicAngle(rec.topic);

    // 1. APPLY TOPIC WEIGHTS
    const topicBoost = calculateTopicBoost(rec.topic, topicWeights);
    if (topicBoost !== 1.0) {
      adjustedScore *= topicBoost;
      adjustments.push(`topic: ${topicBoost.toFixed(2)}x`);
    }

    // 2. APPLY FORMAT WEIGHTS (specific vs broad)
    const formatBoost = calculateFormatBoost(rec, formatWeights, angleAnalysis);
    if (formatBoost !== 1.0) {
      adjustedScore *= formatBoost;
      adjustments.push(`format: ${formatBoost.toFixed(2)}x`);
    }

    // 3. APPLY EVIDENCE WEIGHTS
    const evidenceBoost = calculateEvidenceBoost(rec.evidence, evidenceWeights);
    if (evidenceBoost !== 1.0) {
      adjustedScore *= evidenceBoost;
      adjustments.push(`evidence: ${evidenceBoost.toFixed(2)}x`);
    }

    // 4. APPLY REJECTION PATTERN PENALTIES
    const rejectionPenalty = calculateRejectionPenalty(rec, rejectionPatterns, formatWeights, angleAnalysis);
    if (rejectionPenalty !== 1.0) {
      adjustedScore *= rejectionPenalty;
      adjustments.push(`rejection_pattern: ${rejectionPenalty.toFixed(2)}x`);
    }

    // Clamp score between 1 and 100
    adjustedScore = Math.max(1, Math.min(100, Math.round(adjustedScore)));

    const hasChanges = adjustedScore !== rec.score;

    if (hasChanges) {
      console.log(`📈 "${rec.topic.substring(0, 40)}..." : ${rec.score} → ${adjustedScore} (${adjustments.join(', ')})`);
    }

    return {
      ...rec,
      original_score: rec.score,
      score: adjustedScore,
      learning_applied: hasChanges,
      learning_adjustments: adjustments,
      angle_analysis: {
        has_angle: angleAnalysis.hasAngle,
        type: angleAnalysis.angleType,
        confidence: angleAnalysis.confidence
      }
    };
  });

  // Sort by new score
  adjustedRecommendations.sort((a, b) => b.score - a.score);

  // Update levels based on new scores
  return adjustedRecommendations.map(rec => ({
    ...rec,
    level: getLevel(rec.score)
  }));
}

/**
 * Calculate boost based on topic keywords
 */
function calculateTopicBoost(topic, topicWeights) {
  if (!topic || Object.keys(topicWeights).length === 0) return 1.0;

  const coreTopics = [
    'الذكاء الاصطناعي', 'الصين', 'أمريكا', 'ترامب', 'النفط', 'الذهب',
    'الدولار', 'مصر', 'السعودية', 'الإمارات', 'الاستثمار', 'العملات',
    'التضخم', 'البنوك', 'الأسهم', 'العقارات', 'التكنولوجيا', 'تسلا',
    'ماسك', 'بوتين', 'روسيا', 'الحرب', 'التجارة', 'ميتا', 'أوبك'
  ];

  let totalBoost = 1.0;
  let matchCount = 0;

  for (const coreTopic of coreTopics) {
    if (topic.includes(coreTopic) && topicWeights[coreTopic]) {
      totalBoost *= topicWeights[coreTopic];
      matchCount++;
    }
  }

  // Average the boost if multiple topics matched
  if (matchCount > 1) {
    totalBoost = Math.pow(totalBoost, 1 / matchCount);
  }

  return totalBoost;
}

/**
 * Calculate boost based on topic format (specific vs broad)
 */
function calculateFormatBoost(rec, formatWeights, angleAnalysis = null) {
  if (!formatWeights || Object.keys(formatWeights).length === 0) return 1.0;

  const topic = rec.topic || '';
  
  // Use provided angle analysis or calculate it
  if (!angleAnalysis) {
    angleAnalysis = analyzeTopicAngle(topic);
  }
  
  let boost = 1.0;

  // Strong boost for specific angles
  if (angleAnalysis.hasAngle && angleAnalysis.confidence >= 0.5) {
    boost *= (formatWeights.specific_angle || 1.5);
  } 
  // Moderate boost for somewhat specific
  else if (angleAnalysis.hasAngle && angleAnalysis.confidence >= 0.3) {
    boost *= Math.sqrt(formatWeights.specific_angle || 1.2);
  }
  // Heavy penalty for broad topics
  else if (!angleAnalysis.hasAngle || angleAnalysis.angleType === 'broad_entity') {
    boost *= (formatWeights.broad_topic || 0.3);
  }

  // Question format bonus
  if (angleAnalysis.angleType === 'question' && formatWeights.question_format) {
    boost *= formatWeights.question_format;
  }

  console.log(`🔍 Angle analysis for "${topic.substring(0, 30)}...": `, {
    hasAngle: angleAnalysis.hasAngle,
    type: angleAnalysis.angleType,
    confidence: angleAnalysis.confidence.toFixed(2),
    boost: boost.toFixed(2)
  });

  return boost;
}

/**
 * Calculate boost based on evidence strength
 */
function calculateEvidenceBoost(evidence, evidenceWeights) {
  if (!evidence || !evidenceWeights) return 1.0;

  let boost = 1.0;

  // Reward topics with search volume
  if (evidence.search_terms?.length > 0 || evidence.total_search_volume > 0) {
    boost *= (evidenceWeights.search_volume || 1.0);
  }

  // Reward topics with competitor proof
  if (evidence.competitor_videos?.length > 0) {
    boost *= (evidenceWeights.competitor_proof || 1.0);
  }

  // Reward topics with audience interest
  if (evidence.audience_comments?.length > 0) {
    boost *= (evidenceWeights.audience_comments || 1.0);
  }

  return boost;
}

/**
 * Calculate penalty based on rejection patterns
 */
function calculateRejectionPenalty(rec, rejectionPatterns, formatWeights, angleAnalysis = null) {
  if (!rejectionPatterns) return 1.0;

  const topic = rec.topic || '';
  
  // Use provided angle analysis or calculate it
  if (!angleAnalysis) {
    angleAnalysis = analyzeTopicAngle(topic);
  }
  
  let penalty = 1.0;

  // If user often rejects for "angle_too_broad" and this topic lacks angle
  if (rejectionPatterns.angle_too_broad >= 2) {
    if (!angleAnalysis.hasAngle) {
      penalty *= 0.5; // Heavy penalty
    } else if (angleAnalysis.confidence < 0.4) {
      penalty *= 0.7; // Moderate penalty
    }
  }

  // If user needs strong evidence and this has weak evidence
  if (rejectionPatterns.needs_strong_evidence >= 1) {
    const hasWeakEvidence = 
      (!rec.evidence?.search_terms || rec.evidence.search_terms.length === 0) &&
      (!rec.evidence?.competitor_videos || rec.evidence.competitor_videos.length === 0);
    
    if (hasWeakEvidence) {
      penalty *= 0.7;
    }
  }

  return penalty;
}

/**
 * Get recommendation level based on score
 */
function getLevel(score) {
  if (score >= 80) return 'highly_recommended';
  if (score >= 50) return 'recommended';
  return 'consider';
}

/**
 * Get learning stats for display
 */
export async function getLearningStats(supabase, showId) {
  const { data: weights } = await supabase
    .from('show_learning_weights')
    .select('*')
    .eq('show_id', showId)
    .single();

  if (!weights) {
    return {
      hasLearning: false,
      feedbackCount: 0,
      topTopics: [],
      avoidedTopics: [],
      preferences: {}
    };
  }

  const topicWeights = weights.topic_weights || {};
  
  // Sort topics by weight
  const sortedTopics = Object.entries(topicWeights)
    .sort(([,a], [,b]) => b - a);

  const topTopics = sortedTopics
    .filter(([,weight]) => weight > 1.0)
    .slice(0, 5)
    .map(([topic, weight]) => ({ topic, weight: weight.toFixed(2) }));

  const avoidedTopics = sortedTopics
    .filter(([,weight]) => weight < 1.0)
    .slice(-5)
    .map(([topic, weight]) => ({ topic, weight: weight.toFixed(2) }));

  return {
    hasLearning: weights.total_feedback_count >= 3,
    feedbackCount: weights.total_feedback_count,
    topTopics,
    avoidedTopics,
    preferences: {
      prefersSpecificAngles: (weights.format_weights?.specific_angle || 1) > 1.2,
      needsStrongEvidence: (weights.rejection_patterns?.needs_strong_evidence || 0) >= 1,
      avoidsBroadTopics: (weights.format_weights?.broad_topic || 1) < 0.5
    },
    weights: {
      format: weights.format_weights,
      evidence: weights.evidence_weights,
      rejectionPatterns: weights.rejection_patterns
    }
  };
}

