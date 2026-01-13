/**
 * SIGNAL EFFECTIVENESS LEARNING SYSTEM
 * Analyzes user feedback to determine which signals work best for each user
 * NOW USES TOPIC INTELLIGENCE for category-based learning
 */

import { createClient } from '@supabase/supabase-js';
import { generateTopicFingerprint } from '../topicIntelligence.js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Get learned adjustments based on user feedback history
 * @param {string} showId - Show ID
 * @param {number} days - Number of days to look back (default: 90)
 * @returns {Object} Learned adjustments with topic scores and signal effectiveness
 */
export async function getLearnedAdjustments(showId, days = 90) {
  try {
    // Read learned weights from database (preferred - written by feedback route)
    const { data: learningData } = await supabaseAdmin
      .from('show_learning_weights')
      .select('topic_weights, category_weights, pattern_weights')
      .eq('show_id', showId)
      .maybeSingle();
    
    const topicWeights = learningData?.topic_weights || {};
    const categoryWeights = learningData?.category_weights || {};
    const patternWeights = learningData?.pattern_weights || {};
    
    // Also calculate from feedback for backward compatibility
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const { data: feedbacks } = await supabaseAdmin
      .from('recommendation_feedback')
      .select('*')
      .eq('show_id', showId)
      .gte('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: false });

    // Calculate signal effectiveness from feedback (still useful)
    const signalEffectiveness = feedbacks && feedbacks.length > 0 
      ? calculateSignalEffectiveness(feedbacks)
      : {};

    const adjustments = {
      topicWeights, // From database (written by feedback route)
      categoryWeights, // From database (written by feedback route)
      patternWeights, // From database (written by feedback route)
      signalEffectiveness,
      feedbackCount: feedbacks?.length || 0,
      lastUpdated: new Date().toISOString(),
    };

    console.log('✅ Learned adjustments loaded:', {
      categories: Object.keys(categoryWeights).length,
      topics: Object.keys(topicWeights).length,
      patterns: Object.keys(patternWeights).length,
      signals: Object.keys(signalEffectiveness).length,
    });

    return adjustments;

  } catch (error) {
    console.error('❌ Error in getLearnedAdjustments:', error);
    return getDefaultAdjustments();
  }
}

/**
 * Calculate topic preference scores from feedback
 */
function calculateTopicScores(feedbacks) {
  const topicScores = {};
  
  for (const feedback of feedbacks) {
    const ideaData = feedback.evidence_summary?.idea_data || {};
    const topic = ideaData.topic || feedback.topic || '';
    
    if (!topic) continue;
    
    if (!topicScores[topic]) {
      topicScores[topic] = { positive: 0, negative: 0, total: 0 };
    }
    
    const action = feedback.action;
    
    // Positive signals
    if (action === 'liked' || action === 'generate_pitch' || action === 'saved') {
      topicScores[topic].positive += 1;
      topicScores[topic].total += 1;
    }
    // Negative signals
    else if (action === 'rejected' || action === 'ignored') {
      topicScores[topic].negative += 1;
      topicScores[topic].total += 1;
    }
    // Implicit positive (weaker signal)
    else if (action === 'card_expanded' || action === 'hovered_5s' || action === 'clicked_source') {
      topicScores[topic].positive += 0.3; // Weaker positive signal
      topicScores[topic].total += 0.3;
    }
  }
  
  // Convert to normalized scores (-1 to +1)
  const normalized = {};
  for (const [topic, scores] of Object.entries(topicScores)) {
    if (scores.total === 0) continue;
    
    const ratio = scores.positive / (scores.positive + scores.negative + 1);
    // Normalize to -1 to +1 scale
    normalized[topic] = (ratio - 0.5) * 2;
  }
  
  return normalized;
}

/**
 * Calculate signal type effectiveness
 */
function calculateSignalEffectiveness(feedbacks) {
  const signalStats = {};
  
  for (const feedback of feedbacks) {
    const ideaData = feedback.evidence_summary?.idea_data || {};
    const signals = ideaData.signals || [];
    const action = feedback.action;
    
    for (const signalType of signals) {
      if (!signalStats[signalType]) {
        signalStats[signalType] = { positive: 0, negative: 0, total: 0 };
      }
      
      // Positive signals
      if (action === 'liked' || action === 'generate_pitch' || action === 'saved') {
        signalStats[signalType].positive += 1;
        signalStats[signalType].total += 1;
      }
      // Negative signals
      else if (action === 'rejected' || action === 'ignored') {
        signalStats[signalType].negative += 1;
        signalStats[signalType].total += 1;
      }
    }
  }
  
  // Calculate effectiveness ratio for each signal type
  const effectiveness = {};
  for (const [signalType, stats] of Object.entries(signalStats)) {
    if (stats.total === 0) continue;
    
    const ratio = stats.positive / (stats.positive + stats.negative + 1);
    effectiveness[signalType] = {
      ratio, // 0 to 1 (higher = more effective)
      positive: stats.positive,
      negative: stats.negative,
      total: stats.total,
    };
  }
  
  return effectiveness;
}

/**
 * Calculate format preferences (long form vs short form)
 */
function calculateFormatPreferences(feedbacks) {
  const formatStats = {
    long_form: { positive: 0, negative: 0 },
    short_form: { positive: 0, negative: 0 },
  };
  
  for (const feedback of feedbacks) {
    const action = feedback.action;
    const format = feedback.evidence_summary?.format || '';
    
    if (action === 'generate_pitch') {
      const isPositive = feedback.evidence_summary?.idea_data?.score >= 50;
      
      if (format === 'news' || format === 'long') {
        if (isPositive) formatStats.long_form.positive += 1;
        else formatStats.long_form.negative += 1;
      } else if (format === 'short') {
        if (isPositive) formatStats.short_form.positive += 1;
        else formatStats.short_form.negative += 1;
      }
    }
  }
  
  return formatStats;
}

/**
 * Apply learned adjustments to a base score
 * NOW USES TOPIC INTELLIGENCE for category-based learning
 * @param {number} baseScore - Base score from multi-signal scoring
 * @param {Object} idea - Idea/signal object
 * @param {Object} learned - Learned adjustments from getLearnedAdjustments
 * @returns {Promise<number>} Adjusted score
 */
export async function applyLearnedAdjustments(baseScore, idea, learned) {
  if (!learned) {
    return baseScore;
  }

  let adjustedScore = baseScore;
  const adjustments = [];

  // Generate fingerprint for the idea (for category/entity-based learning)
  try {
    const fingerprint = await generateTopicFingerprint({
      title: idea.title || idea.topic || '',
      description: idea.description || '',
      id: idea.id,
      type: 'signal',
      skipEmbedding: true, // Skip embedding for learning (not needed)
      skipCache: false // Use cache for performance
    });
    
    // === APPLY CATEGORY WEIGHT ===
    const category = fingerprint.topicCategory;
    const categoryWeights = learned.categoryWeights || {};
    if (category && category !== 'general' && categoryWeights[category]) {
      const catWeight = categoryWeights[category];
      const catBoost = Math.round((catWeight.weight - 1) * 20); // Convert weight (1.0-2.0) to points (-20 to +20)
      
      if (catBoost !== 0) {
        adjustedScore += catBoost;
        adjustments.push({
          type: 'category',
          category,
          boost: catBoost,
          detail: catBoost > 0 
            ? `You liked ${catWeight.liked} similar "${category}" stories`
            : `You rejected ${catWeight.rejected} similar "${category}" stories`
        });
      }
    }
    
    // === APPLY ENTITY WEIGHTS ===
    const topicWeights = learned.topicWeights || {};
    
    // Apply country weights
    for (const country of fingerprint.entities.countries) {
      const key = `country_${country.toLowerCase()}`;
      if (topicWeights[key]) {
        const weight = topicWeights[key];
        const boost = Math.round((weight.weight - 1) * 15);
        if (boost !== 0) {
          adjustedScore += boost;
          adjustments.push({
            type: 'country',
            entity: country,
            boost,
            detail: `${country}: ${weight.liked} liked, ${weight.rejected} rejected`
          });
        }
      }
    }
    
    // Apply topic weights
    for (const topicEntity of fingerprint.entities.topics) {
      const key = `topic_${topicEntity.toLowerCase()}`;
      if (topicWeights[key]) {
        const weight = topicWeights[key];
        const boost = Math.round((weight.weight - 1) * 15);
        if (boost !== 0) {
          adjustedScore += boost;
          adjustments.push({
            type: 'topic',
            entity: topicEntity,
            boost,
            detail: `${topicEntity}: ${weight.liked} liked, ${weight.rejected} rejected`
          });
        }
      }
    }
    
    // Apply person weights (lower weight)
    for (const person of fingerprint.entities.people) {
      const key = `person_${person.toLowerCase()}`;
      if (topicWeights[key]) {
        const weight = topicWeights[key];
        const boost = Math.round((weight.weight - 1) * 10); // Lower weight for people
        if (boost !== 0) {
          adjustedScore += boost;
          adjustments.push({
            type: 'person',
            entity: person,
            boost,
            detail: `${person}: ${weight.liked} liked, ${weight.rejected} rejected`
          });
        }
      }
    }
    
  } catch (fingerprintError) {
    console.warn('Could not generate fingerprint for learning:', fingerprintError);
    // Continue without fingerprint-based learning
  }

  // Adjust based on signal effectiveness
  const signalEffectiveness = learned.signalEffectiveness || {};
  const scoring = idea.multi_signal_scoring || {};
  const signals = scoring.signals || [];
  
  for (const signal of signals) {
    const effectiveness = signalEffectiveness[signal.type];
    if (effectiveness && effectiveness.total >= 3) { // Need at least 3 data points
      const ratio = effectiveness.ratio;
      
      if (ratio > 0.7) {
        // Signal works well for this user (+5 points)
        adjustedScore += 5;
        adjustments.push({
          type: 'signal',
          signalType: signal.type,
          boost: 5,
          detail: `Signal type works well`
        });
      } else if (ratio < 0.3) {
        // Signal doesn't work well for this user (-5 points)
        adjustedScore -= 5;
        adjustments.push({
          type: 'signal',
          signalType: signal.type,
          boost: -5,
          detail: `Signal type doesn't work well`
        });
      }
    }
  }

  // Cap score between 0 and 100
  adjustedScore = Math.max(0, Math.min(100, Math.round(adjustedScore)));

  if (adjustments.length > 0) {
    const adjustmentSummary = adjustments.map(a => 
      typeof a === 'string' ? a : `${a.type}: ${a.boost > 0 ? '+' : ''}${a.boost}`
    ).join(', ');
    console.log(`📈 Learned adjustments applied: ${adjustmentSummary} (${baseScore} → ${adjustedScore})`);
  }

  return adjustedScore;
}

/**
 * Get default adjustments (no learning yet)
 */
function getDefaultAdjustments() {
  return {
    topicWeights: {},
    categoryWeights: {},
    patternWeights: {},
    signalEffectiveness: {},
    formatPreferences: {},
    feedbackCount: 0,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get signal effectiveness summary for display
 */
export async function getSignalEffectivenessSummary(showId, days = 90) {
  const adjustments = await getLearnedAdjustments(showId, days);
  
  const summary = {
    totalFeedback: adjustments.feedbackCount,
    topSignals: [],
    topCategories: [],
    formatPreferences: {},
  };
  
  // Get top 5 most effective signals
  const signalEntries = Object.entries(adjustments.signalEffectiveness)
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);
  
  summary.topSignals = signalEntries;
  
  // Get top 5 most preferred categories (from category_weights)
  const categoryEntries = Object.entries(adjustments.categoryWeights || {})
    .map(([category, data]) => ({ 
      category, 
      score: (data.weight - 1) * 20, // Convert weight to score
      liked: data.liked,
      rejected: data.rejected
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  
  summary.topCategories = categoryEntries;
  
  return summary;
}
