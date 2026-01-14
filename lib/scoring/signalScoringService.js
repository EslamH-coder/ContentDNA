/**
 * Unified Signal Scoring Service
 * 
 * Single source of truth for all signal scoring logic.
 * Used by both Ideas page and Studio page.
 * 
 * Features:
 * - AI fingerprint generation (with timeout)
 * - Multi-signal scoring (competitors, DNA, saturation)
 * - Learned pattern adjustments (from user feedback)
 * - Behavior pattern matching
 * - DNA topics loaded from topic_definitions (single source of truth)
 */

import { generateTopicFingerprint } from '@/lib/topicIntelligence';
import { calculateIdeaScore } from './multiSignalScoring';
import { getShowPatterns, scoreSignalByPatterns } from '@/lib/behaviorPatterns';
import { getLearnedAdjustments, applyLearnedAdjustments } from '@/lib/learning/signalEffectiveness';

const FINGERPRINT_TIMEOUT = 2000; // 2 seconds

/**
 * Load DNA topics directly from topic_definitions table
 * This is the single source of truth for channel DNA
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} showId - Show ID
 * @returns {Promise<Array>} Array of DNA topics
 */
export async function loadDnaTopics(supabase, showId) {
  if (!supabase || !showId) {
    console.warn('⚠️ loadDnaTopics: Missing supabase or showId');
    return [];
  }

  try {
    const { data: topics, error } = await supabase
      .from('topic_definitions')
      .select('topic_id, topic_name_en, topic_name_ar, keywords, description, is_active')
      .eq('show_id', showId)
      .eq('is_active', true)
      .order('topic_name_en');
    
    if (error) {
      console.error('❌ Error loading DNA topics from topic_definitions:', error);
      console.error('   Error code:', error.code);
      console.error('   Error message:', error.message);
      // Don't throw - return empty array so route can continue with fallback
      return [];
    }
    
    const validTopics = (topics || []).filter(topic => {
      // Ensure topic has required fields
      const hasTopicId = topic.topic_id && typeof topic.topic_id === 'string';
      const hasKeywords = Array.isArray(topic.keywords) && topic.keywords.length > 0;
      
      if (!hasTopicId || !hasKeywords) {
        console.warn(`⚠️ Invalid topic definition:`, {
          topic_id: topic.topic_id,
          has_keywords: hasKeywords,
          keywords_count: topic.keywords?.length || 0
        });
        return false;
      }
      
      return true;
    });
    
    console.log(`📚 Loaded ${validTopics.length} DNA topics from topic_definitions (${(topics || []).length - validTopics.length} invalid filtered out)`);
    return validTopics;
  } catch (error) {
    console.error('❌ Exception loading DNA topics:', error);
    return [];
  }
}

/**
 * Learn a new keyword for a topic
 * Adds to topic_definitions.keywords array
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} showId - Show ID
 * @param {string} topicId - Topic ID (e.g., 'iran_oil_sanctions')
 * @param {string} newKeyword - New keyword to add
 * @returns {Promise<void>}
 */
export async function learnKeywordForTopic(supabase, showId, topicId, newKeyword) {
  if (!supabase || !showId || !topicId || !newKeyword) {
    console.warn('⚠️ learnKeywordForTopic: Missing required parameters');
    return;
  }

  try {
    // Get current topic
    const { data: topic, error: fetchError } = await supabase
      .from('topic_definitions')
      .select('keywords, topic_name_en')
      .eq('show_id', showId)
      .eq('topic_id', topicId)
      .eq('is_active', true)
      .single();
    
    if (fetchError || !topic) {
      console.log(`   ⚠️ Topic ${topicId} not found or inactive, cannot learn keyword`);
      return;
    }
    
    // Check if keyword already exists
    const keywords = Array.isArray(topic.keywords) ? [...topic.keywords] : [];
    const normalizedNew = (newKeyword || '').toLowerCase().trim();
    const exists = keywords.some(k => {
      if (typeof k === 'string' && k) {
        return k.toLowerCase().trim() === normalizedNew;
      }
      return false;
    });
    
    if (exists) {
      console.log(`   ℹ️ Keyword "${newKeyword}" already in topic "${topic.topic_name_en || topicId}"`);
      return;
    }
    
    // Add new keyword
    keywords.push(newKeyword);
    
    const { error: updateError } = await supabase
      .from('topic_definitions')
      .update({ 
        keywords,
        updated_at: new Date().toISOString()
      })
      .eq('show_id', showId)
      .eq('topic_id', topicId);
    
    if (updateError) {
      console.error('❌ Error learning keyword:', updateError);
    } else {
      console.log(`   📚 Learned: Added "${newKeyword}" to topic "${topic.topic_name_en || topicId}" (${topicId})`);
    }
  } catch (error) {
    console.error('❌ Exception in learnKeywordForTopic:', error);
  }
}

/**
 * Score a single signal with all intelligence
 * 
 * @param {Object} signal - Signal object from database
 * @param {Object} context - Scoring context
 * @param {string} context.showId - Show ID
 * @param {Array} context.dnaTopics - DNA topics for matching
 * @param {Array} context.competitorVideos - Competitor videos for breakout detection
 * @param {Array} context.userVideos - User's own videos for saturation check
 * @param {Object} context.learningWeights - Learned weights (optional, will fetch if not provided)
 * @param {Object} context.behaviorPatterns - Behavior patterns (optional, will fetch if not provided)
 * @param {Object} context.supabase - Supabase client (optional, for learning)
 * @param {Array} context.excludedNames - Names to exclude from keyword matching
 * @returns {Promise<Object>} Scoring result with score, signals, and metadata
 */
export async function scoreSignal(signal, context) {
  const {
    showId,
    dnaTopics, // Can be provided, or will load from topic_definitions if supabase provided
    competitorVideos = [],
    userVideos = [],
    learningWeights,
    behaviorPatterns,
    supabase,
    excludedNames = [],
    sourceUrl,
    sourceTitle,
    sourceCount = 1
  } = context;

  // ===========================================
  // STEP 0: Load DNA topics from topic_definitions if not provided
  // ===========================================
  let dnaTopicsToUse = dnaTopics;
  if (!dnaTopicsToUse || dnaTopicsToUse.length === 0) {
    if (supabase && showId) {
      dnaTopicsToUse = await loadDnaTopics(supabase, showId);
    } else {
      console.warn('⚠️ No DNA topics provided and cannot load from topic_definitions (missing supabase or showId)');
      dnaTopicsToUse = [];
    }
  }

  // ===========================================
  // STEP 1: Generate AI fingerprint (with timeout)
  // ===========================================
  let aiFingerprint = null;
  try {
    const aiFingerprintPromise = generateTopicFingerprint({
      title: signal.title || '',
      description: signal.description || signal.raw_data?.description || '',
      id: signal.id,
      type: 'signal'
    }, {
      skipEmbedding: true, // Skip embedding for performance
      skipCache: false // Use cache to avoid redundant AI calls
    });

    const aiTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('timeout')), FINGERPRINT_TIMEOUT)
    );

    aiFingerprint = await Promise.race([aiFingerprintPromise, aiTimeoutPromise]);
    
    if (aiFingerprint?.entities) {
      console.log(`   🤖 AI extracted for "${signal.title?.substring(0, 40)}...":`, {
        topics: aiFingerprint.entities.topics?.slice(0, 3) || [],
        countries: aiFingerprint.entities.countries?.slice(0, 3) || [],
        organizations: aiFingerprint.entities.organizations?.slice(0, 2) || [],
        extractionMethod: aiFingerprint.extractionMethod || 'unknown'
      });
    }
  } catch (e) {
    if (e.message !== 'timeout') {
      console.warn(`   ⚠️ AI fingerprint generation failed for "${signal.title?.substring(0, 40)}...":`, e.message);
    } else {
      console.log(`   ⚠️ AI fingerprint timeout for "${signal.title?.substring(0, 30)}..."`);
    }
    aiFingerprint = null;
  }

  // ===========================================
  // STEP 2: Normalize competitor videos
  // ===========================================
  const normalizedCompetitorVideos = (competitorVideos || []).map(video => ({
    ...video,
    views: video.views || video.view_count || video.viewCount || 0,
    published_at: video.published_at || video.publish_date || video.publishedAt || video.created_at,
    publish_date: video.publish_date || video.published_at,
    title: video.title || '',
    description: video.description || '',
    competitor_id: video.competitor_id || video.competitors?.id,
    video_id: video.youtube_video_id || video.video_id || video.id,
    youtube_video_id: video.youtube_video_id || video.video_id || video.id,
    competitors: video.competitors || {},
  }));

  // ===========================================
  // STEP 3: Calculate base score with multi-signal scoring
  // ===========================================
  const scoringResult = await calculateIdeaScore(signal, {
    competitorVideos: normalizedCompetitorVideos,
    userVideos: userVideos || [],
    dnaTopics: dnaTopicsToUse, // Use topics loaded from topic_definitions
    signalTitle: signal.title || '',
    signalDescription: signal.description || signal.raw_data?.description || '',
    signalPublishedAt: signal.published_at || signal.created_at,
    signalTopicId: signal.topic_id,
    sourceUrl: sourceUrl || signal.url || signal.source_url || signal.raw_data?.url || signal.raw_data?.link || null,
    sourceTitle: sourceTitle || signal.source || signal.source_name || signal.raw_data?.sourceName || null,
    sourceCount: sourceCount,
    aiFingerprint: aiFingerprint, // Pass AI fingerprint for smarter DNA matching
  }, excludedNames);

  let finalScore = scoringResult?.score || 0;
  const adjustments = [];

  // ===========================================
  // STEP 4: Apply behavior pattern matching
  // ===========================================
  let patternMatches = [];
  let behaviorPatternsToUse = behaviorPatterns;
  
  if (!behaviorPatternsToUse && showId) {
    try {
      behaviorPatternsToUse = await getShowPatterns(showId);
    } catch (e) {
      console.warn('⚠️ Could not load behavior patterns:', e.message);
    }
  }

  if (behaviorPatternsToUse && Object.keys(behaviorPatternsToUse).length > 0) {
    try {
      // Get learned pattern weights if available
      let patternLearnedWeights = {};
      if (learningWeights?.pattern_weights) {
        patternLearnedWeights = learningWeights.pattern_weights;
      } else if (supabase && showId) {
        try {
          const learned = await getLearnedAdjustments(showId);
          patternLearnedWeights = learned.patternWeights || {};
        } catch (e) {
          // Ignore if can't load
        }
      }

      const patternScore = await scoreSignalByPatterns(
        signal,
        behaviorPatternsToUse,
        patternLearnedWeights
      );

      if (patternScore.matches && patternScore.matches.length > 0) {
        patternMatches = patternScore.matches.map(match => ({
          patternId: match.patternId,
          patternName: match.patternName,
          patternNameAr: match.patternNameAr,
          evidence: match.evidence,
          boost: match.boost,
          source: match.source,
          confidence: match.confidence,
          isLearned: match.isLearned
        }));

        // Apply pattern boost to score
        const patternBoost = patternMatches.reduce((sum, m) => sum + (m.boost || 0), 0);
        if (patternBoost !== 0) {
          finalScore += patternBoost;
          adjustments.push({
            type: 'behavior_pattern',
            value: patternBoost,
            details: patternMatches.map(m => m.patternName).join(', ')
          });
        }
      }
    } catch (patternError) {
      console.warn('⚠️ Error calculating pattern matches (non-fatal):', patternError.message);
    }
  }

  // ===========================================
  // STEP 5: Apply learned adjustments (from user feedback)
  // ===========================================
  let learnedAdjustment = 0;
  let learnedWeightsToUse = learningWeights;

  if (!learnedWeightsToUse && supabase && showId) {
    try {
      learnedWeightsToUse = await getLearnedAdjustments(showId);
    } catch (e) {
      console.warn('⚠️ Could not load learned adjustments:', e.message);
    }
  }

  if (learnedWeightsToUse) {
    try {
      const adjustedScore = await applyLearnedAdjustments(
        finalScore,
        {
          ...signal,
          multi_signal_scoring: scoringResult
        },
        learnedWeightsToUse
      );

      learnedAdjustment = adjustedScore - finalScore;
      if (learnedAdjustment !== 0) {
        finalScore = adjustedScore;
        adjustments.push({
          type: 'learned_adjustment',
          value: learnedAdjustment,
          details: 'User feedback patterns'
        });
      }
    } catch (e) {
      console.warn('⚠️ Error applying learned adjustments:', e.message);
    }
  }

  // ===========================================
  // STEP 6: Apply learned feedback patterns (new system)
  // ===========================================
  if (supabase && showId) {
    try {
      const feedbackAdjustment = await applyLearnedFeedbackPatterns(
        supabase,
        showId,
        signal,
        aiFingerprint
      );

      if (feedbackAdjustment.adjustment !== 0) {
        finalScore += feedbackAdjustment.adjustment;
        adjustments.push({
          type: 'feedback_pattern',
          value: feedbackAdjustment.adjustment,
          details: feedbackAdjustment.reasons.map(r => r.matched_on).join(', ')
        });
      }
    } catch (e) {
      console.warn('⚠️ Error applying feedback patterns:', e.message);
    }
  }

  // Clamp score between 0 and 100
  finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));

  return {
    ...scoringResult,
    score: finalScore,
    aiFingerprint,
    patternMatches,
    adjustments,
    learnedAdjustment,
    scoringMethod: 'unified_v1'
  };
}

/**
 * Score multiple signals (batch processing)
 * 
 * @param {Array} signals - Array of signal objects
 * @param {Object} context - Scoring context (same as scoreSignal)
 * @returns {Promise<Array>} Array of scored signals
 */
export async function scoreSignals(signals, context) {
  const results = [];
  
  for (const signal of signals) {
    try {
      const result = await scoreSignal(signal, context);
      results.push({
        ...signal,
        ...result
      });
    } catch (error) {
      console.error(`Error scoring signal "${signal.title?.substring(0, 40)}...":`, error);
      // Include signal with error state
      results.push({
        ...signal,
        score: 0,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Apply learned feedback patterns from user feedback
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} showId - Show ID
 * @param {Object} signal - Signal object
 * @param {Object} aiFingerprint - AI fingerprint (optional)
 * @returns {Promise<Object>} Adjustment object with adjustment value and reasons
 */
async function applyLearnedFeedbackPatterns(supabase, showId, signal, aiFingerprint) {
  if (!supabase || !showId || !signal) {
    return { adjustment: 0, reasons: [] };
  }

  try {
    // Get learned patterns from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: patterns, error } = await supabase
      .from('signal_feedback_patterns')
      .select('*')
      .eq('show_id', showId)
      .gte('updated_at', thirtyDaysAgo)
      .order('match_count', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('⚠️ Error loading feedback patterns:', error.message);
      return { adjustment: 0, reasons: [] };
    }

    if (!patterns?.length) {
      return { adjustment: 0, reasons: [] };
    }

    // Extract entities from AI fingerprint or signal
    let entities = {};
    if (aiFingerprint?.entities) {
      entities = aiFingerprint.entities;
    } else {
      // Fallback to basic extraction
      entities = extractBasicEntities(signal.title || '');
    }

    const signalCountries = (entities.countries || []).map(c => (c || '').toLowerCase()).filter(Boolean);
    const signalTopics = (entities.topics || []).map(t => (t || '').toLowerCase()).filter(Boolean);
    const titlePatterns = extractTitlePatterns(signal.title || '');
    
    let adjustment = 0;
    const reasons = [];

    for (const pattern of patterns) {
      let matched = false;
      let matchedOn = null;

      // Check country match
      if (pattern.countries?.length > 0) {
        const patternCountries = (pattern.countries || []).map(c => (c || '').toLowerCase()).filter(Boolean);
        const countryMatch = patternCountries.some(c => 
          signalCountries.some(sc => sc === c || sc.includes(c) || c.includes(sc))
        );
        if (countryMatch) {
          matched = true;
          matchedOn = patternCountries.find(c => signalCountries.some(sc => sc === c || sc.includes(c) || c.includes(sc)));
        }
      }

      // Check topic match
      if (!matched && pattern.topics?.length > 0) {
        const patternTopics = (pattern.topics || []).map(t => (t || '').toLowerCase()).filter(Boolean);
        const topicMatch = patternTopics.some(t =>
          signalTopics.some(st => st.includes(t) || t.includes(st))
        );
        if (topicMatch) {
          matched = true;
          matchedOn = patternTopics.find(t => signalTopics.some(st => st.includes(t) || t.includes(st)));
        }
      }

      // Check title pattern match
      if (!matched && pattern.title_patterns?.length > 0) {
        const patternTitlePatterns = (pattern.title_patterns || []).map(p => p.toLowerCase());
        const titleLower = (signal.title || '').toLowerCase();
        const titleMatch = patternTitlePatterns.some(p => titleLower.includes(p));
        if (titleMatch) {
          matched = true;
          matchedOn = patternTitlePatterns.find(p => titleLower.includes(p));
        }
      }

      if (matched) {
        const patternAdjustment = pattern.pattern_type === 'positive' 
          ? (pattern.score_boost || 10)
          : (pattern.score_penalty || -15);
        
        adjustment += patternAdjustment;
        reasons.push({
          pattern_type: pattern.pattern_type,
          matched_on: matchedOn || 'unknown',
          adjustment: patternAdjustment,
          pattern_id: pattern.id
        });
      }
    }

    if (adjustment !== 0) {
      console.log(`   📚 Learned feedback adjustment: ${adjustment > 0 ? '+' : ''}${adjustment} (${reasons.length} patterns)`);
    }

    return { adjustment, reasons };
  } catch (error) {
    console.error('Error applying learned feedback patterns:', error);
    return { adjustment: 0, reasons: [] };
  }
}

/**
 * Learn from user feedback (like/reject)
 * - Stores pattern for boost/penalty
 * - AUTO-ADDS new keywords to matching DNA topics (when liked)
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} showId - Show ID
 * @param {Object} signal - Signal object
 * @param {string} feedbackType - 'like' or 'reject'
 * @returns {Promise<void>}
 */
export async function learnFromFeedback(supabase, showId, signal, feedbackType) {
  if (!supabase || !showId || !signal) {
    console.warn('⚠️ learnFromFeedback: Missing required parameters');
    return;
  }

  if (feedbackType !== 'like' && feedbackType !== 'reject') {
    console.warn(`⚠️ learnFromFeedback: Invalid feedbackType "${feedbackType}", must be 'like' or 'reject'`);
    return;
  }

  try {
    // Generate fingerprint for the signal
    let entities = {};
    try {
      const fingerprint = await generateTopicFingerprint({
        title: signal.title || '',
        description: signal.description || ''
      }, {
        skipEmbedding: true,
        skipCache: false
      });
      entities = fingerprint?.entities || {};
    } catch (e) {
      // Use basic extraction if AI fails
      entities = extractBasicEntities(signal.title || '');
    }

    const countries = (entities.countries || []).map(c => (c || '').toLowerCase()).filter(Boolean);
    const topics = (entities.topics || []).map(t => (t || '').toLowerCase()).filter(Boolean);
    const people = (entities.people || []).map(p => (p || '').toLowerCase()).filter(Boolean);
    const organizations = (entities.organizations || []).map(o => (o || '').toLowerCase()).filter(Boolean);
    const titlePatterns = extractTitlePatterns(signal.title || '');

    // === PART 1: Store feedback pattern (existing) ===
    // Create pattern key for upsert (composite key)
    const patternKey = `${showId}-${countries.sort().join(',')}-${topics.sort().join(',')}-${titlePatterns.sort().join(',')}`;
    const patternKeyHash = Buffer.from(patternKey).toString('base64').substring(0, 64); // Limit to 64 chars for text primary key

    // Upsert the pattern
    const { error } = await supabase
      .from('signal_feedback_patterns')
      .upsert({
        id: patternKeyHash,
        show_id: showId,
        pattern_type: feedbackType === 'like' ? 'positive' : 'negative',
        countries: countries,
        topics: topics,
        title_patterns: titlePatterns,
        source: signal.source || signal.source_name || null,
        score_boost: feedbackType === 'like' ? 10 : 0,
        score_penalty: feedbackType === 'reject' ? -15 : 0,
        match_count: 1,
        last_signal_title: signal.title || '',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('❌ Error saving feedback pattern:', error);
    } else {
      console.log(`📚 Learned ${feedbackType} pattern: countries=[${countries.join(', ')}], topics=[${topics.join(', ')}], patterns=[${titlePatterns.join(', ')}]`);
    }

    // === PART 2: AUTO-LEARN NEW KEYWORDS (only for likes) ===
    if (feedbackType === 'like') {
      await autoLearnKeywords(supabase, showId, signal, {
        countries,
        topics,
        people,
        organizations
      });
    }

  } catch (error) {
    console.error('❌ Error in learnFromFeedback:', error);
  }
}

/**
 * Auto-learn new keywords from liked signals
 * 
 * Logic:
 * 1. Find which DNA topic this signal matched (if any)
 * 2. Extract all meaningful words from signal title
 * 3. Add new words to that topic's keywords
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} showId - Show ID
 * @param {Object} signal - Signal object
 * @param {Object} entities - Extracted entities
 * @returns {Promise<void>}
 */
async function autoLearnKeywords(supabase, showId, signal, entities) {
  const { countries, topics, people, organizations } = entities;
  
  if (!countries || countries.length === 0) {
    // Need at least a country to match a topic
    return;
  }

  try {
    // Load DNA topics
    const { data: dnaTopics, error: loadError } = await supabase
      .from('topic_definitions')
      .select('topic_id, topic_name_en, topic_name_ar, keywords')
      .eq('show_id', showId)
      .eq('is_active', true);

    if (loadError || !dnaTopics?.length) {
      console.warn('⚠️ Could not load DNA topics for auto-learning:', loadError?.message);
      return;
    }

    // Find matching DNA topic based on countries
    for (const country of countries) {
      if (!country) continue; // Skip undefined/null countries
      const countryLower = country.toLowerCase();
      
      // Find DNA topic that contains this country
      const matchingTopic = dnaTopics.find(t => {
        const nameMatch = 
          t.topic_name_en?.toLowerCase().includes(countryLower) ||
          t.topic_name_ar?.toLowerCase().includes(countryLower);
        const keywordMatch = (t.keywords || []).some(k => {
          const kLower = String(k).toLowerCase();
          return kLower === countryLower || kLower.includes(countryLower) || countryLower.includes(kLower);
        });
        return nameMatch || keywordMatch;
      });

      if (matchingTopic) {
        // Extract new keywords from signal title
        const newKeywords = extractNewKeywords(signal.title || '', matchingTopic.keywords || []);
        
        if (newKeywords.length > 0) {
          // Add new keywords to this topic (avoid duplicates)
          const existingLower = (matchingTopic.keywords || []).map(k => String(k || '').toLowerCase()).filter(Boolean);
          const uniqueNew = newKeywords.filter(k => k && !existingLower.includes(k.toLowerCase()));
          
          if (uniqueNew.length > 0) {
            const updatedKeywords = [...(matchingTopic.keywords || []), ...uniqueNew];
            
            const { error: updateError } = await supabase
              .from('topic_definitions')
              .update({ 
                keywords: updatedKeywords,
                updated_at: new Date().toISOString()
              })
              .eq('show_id', showId)
              .eq('topic_id', matchingTopic.topic_id);

            if (updateError) {
              console.error('❌ Error updating topic keywords:', updateError);
            } else {
              console.log(`📚 Auto-learned: Added [${uniqueNew.join(', ')}] to topic "${matchingTopic.topic_id}" (${matchingTopic.topic_name_en || matchingTopic.topic_id})`);
            }
          }
        }
      }
    }

    // Also learn from people (e.g., "ayatollah", "Khamenei" → Iran topic)
    for (const person of people || []) {
      if (!person) continue; // Skip undefined/null people
      await learnPersonToTopic(supabase, showId, dnaTopics, person, countries);
    }

    // Learn from organizations (e.g., "IRGC" → Iran topic)
    for (const org of organizations || []) {
      if (!org) continue; // Skip undefined/null organizations
      await learnOrganizationToTopic(supabase, showId, dnaTopics, org, countries);
    }

  } catch (error) {
    console.error('❌ Error in autoLearnKeywords:', error);
  }
}

/**
 * Extract meaningful new keywords from title
 * Filters out common words, short words, etc.
 * 
 * @param {string} title - Signal title
 * @param {Array} existingKeywords - Existing keywords for the topic
 * @returns {Array<string>} Array of new keywords to add
 */
function extractNewKeywords(title, existingKeywords) {
  if (!title) return [];
  
  const existingLower = new Set((existingKeywords || []).map(k => String(k).toLowerCase()));
  
  // Common words to skip
  const stopWords = new Set([
    // English stop words
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'between',
    'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
    'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also',
    'now', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
    'says', 'said', 'new', 'first', 'last', 'long', 'great', 'little', 'own',
    'other', 'old', 'right', 'big', 'high', 'different', 'small', 'large',
    'next', 'early', 'young', 'important', 'public', 'bad', 'same', 'able',
    'why', 'what', 'when', 'where', 'who', 'which', 'whose', 'whom',
    'this', 'that', 'these', 'those', 'he', 'she', 'it', 'they', 'we', 'you',
    'him', 'her', 'his', 'hers', 'its', 'their', 'theirs', 'our', 'ours',
    'about', 'against', 'among', 'around', 'because', 'before', 'behind',
    'below', 'beneath', 'beside', 'besides', 'between', 'beyond', 'during',
    'except', 'inside', 'outside', 'since', 'throughout', 'toward', 'towards',
    'under', 'underneath', 'until', 'upon', 'within', 'without',
    // Arabic stop words
    'في', 'من', 'إلى', 'على', 'عن', 'مع', 'هذا', 'هذه', 'التي', 'الذي',
    'ان', 'أن', 'إن', 'كان', 'قد', 'ما', 'لا', 'بين', 'حيث', 'بعد', 'قبل',
    'هو', 'هي', 'هم', 'هن', 'نحن', 'أنا', 'أنت', 'أنتم', 'أنتن',
    'كان', 'كانت', 'كانوا', 'يكون', 'تكون', 'لن', 'لم',
    'أو', 'و', 'ف', 'ب', 'ل', 'ك', 'ثم', 'أي', 'كل', 'بعض', 'غير',
    'يقول', 'قال', 'قالت', 'يعلن', 'أعلن', 'أعلنت',
    // Common generic words
    'will', 'could', 'would', 'might', 'should', 'must', 'can',
    'news', 'report', 'reports', 'reported', 'reporting',
    'says', 'said', 'saying', 'tell', 'tells', 'told',
    'show', 'shows', 'showed', 'showing',
    'make', 'makes', 'made', 'making',
    'take', 'takes', 'took', 'taking',
    'get', 'gets', 'got', 'getting',
    'go', 'goes', 'went', 'going',
    'come', 'comes', 'came', 'coming',
    'see', 'sees', 'saw', 'seeing',
    'know', 'knows', 'knew', 'knowing',
    'think', 'thinks', 'thought', 'thinking',
    'look', 'looks', 'looked', 'looking',
    'want', 'wants', 'wanted', 'wanting',
    'give', 'gives', 'gave', 'giving',
    'use', 'uses', 'used', 'using',
    'find', 'finds', 'found', 'finding',
    'work', 'works', 'worked', 'working',
    'call', 'calls', 'called', 'calling',
    'try', 'tries', 'tried', 'trying',
    'ask', 'asks', 'asked', 'asking',
    'need', 'needs', 'needed', 'needing',
    'feel', 'feels', 'felt', 'feeling',
    'become', 'becomes', 'became', 'becoming',
    'leave', 'leaves', 'left', 'leaving',
    'put', 'puts', 'putting',
    'mean', 'means', 'meant', 'meaning',
    'keep', 'keeps', 'kept', 'keeping',
    'let', 'lets', 'letting',
    'begin', 'begins', 'began', 'beginning',
    'seem', 'seems', 'seemed', 'seeming',
    'help', 'helps', 'helped', 'helping',
    'talk', 'talks', 'talked', 'talking',
    'turn', 'turns', 'turned', 'turning',
    'start', 'starts', 'started', 'starting',
    'show', 'shows', 'showed', 'showing',
    'hear', 'hears', 'heard', 'hearing',
    'play', 'plays', 'played', 'playing',
    'run', 'runs', 'ran', 'running',
    'move', 'moves', 'moved', 'moving',
    'like', 'likes', 'liked', 'liking',
    'live', 'lives', 'lived', 'living',
    'believe', 'believes', 'believed', 'believing',
    'bring', 'brings', 'brought', 'bringing',
    'happen', 'happens', 'happened', 'happening',
    'write', 'writes', 'wrote', 'writing',
    'sit', 'sits', 'sat', 'sitting',
    'stand', 'stands', 'stood', 'standing',
    'lose', 'loses', 'lost', 'losing',
    'pay', 'pays', 'paid', 'paying',
    'meet', 'meets', 'met', 'meeting',
    'include', 'includes', 'included', 'including',
    'continue', 'continues', 'continued', 'continuing',
    'set', 'sets', 'setting',
    'learn', 'learns', 'learned', 'learning',
    'change', 'changes', 'changed', 'changing',
    'lead', 'leads', 'led', 'leading',
    'understand', 'understands', 'understood', 'understanding',
    'watch', 'watches', 'watched', 'watching',
    'follow', 'follows', 'followed', 'following',
    'stop', 'stops', 'stopped', 'stopping',
    'create', 'creates', 'created', 'creating',
    'speak', 'speaks', 'spoke', 'speaking',
    'read', 'reads', 'read', 'reading',
    'allow', 'allows', 'allowed', 'allowing',
    'add', 'adds', 'added', 'adding',
    'spend', 'spends', 'spent', 'spending',
    'grow', 'grows', 'grew', 'growing',
    'open', 'opens', 'opened', 'opening',
    'walk', 'walks', 'walked', 'walking',
    'win', 'wins', 'won', 'winning',
    'offer', 'offers', 'offered', 'offering',
    'remember', 'remembers', 'remembered', 'remembering',
    'love', 'loves', 'loved', 'loving',
    'consider', 'considers', 'considered', 'considering',
    'appear', 'appears', 'appeared', 'appearing',
    'buy', 'buys', 'bought', 'buying',
    'wait', 'waits', 'waited', 'waiting',
    'serve', 'serves', 'served', 'serving',
    'die', 'dies', 'died', 'dying',
    'send', 'sends', 'sent', 'sending',
    'build', 'builds', 'built', 'building',
    'stay', 'stays', 'stayed', 'staying',
    'fall', 'falls', 'fell', 'falling',
    'cut', 'cuts', 'cutting',
    'reach', 'reaches', 'reached', 'reaching',
    'kill', 'kills', 'killed', 'killing',
    'raise', 'raises', 'raised', 'raising',
    'pass', 'passes', 'passed', 'passing',
    'sell', 'sells', 'sold', 'selling',
    'decide', 'decides', 'decided', 'deciding',
    'return', 'returns', 'returned', 'returning',
    'explain', 'explains', 'explained', 'explaining',
    'develop', 'develops', 'developed', 'developing',
    'carry', 'carries', 'carried', 'carrying',
    'break', 'breaks', 'broke', 'breaking',
    'receive', 'receives', 'received', 'receiving',
    'agree', 'agrees', 'agreed', 'agreeing',
    'support', 'supports', 'supported', 'supporting',
    'hit', 'hits', 'hitting',
    'produce', 'produces', 'produced', 'producing',
    'eat', 'eats', 'ate', 'eating',
    'cover', 'covers', 'covered', 'covering',
    'catch', 'catches', 'caught', 'catching',
    'draw', 'draws', 'drew', 'drawing',
    'choose', 'chooses', 'chose', 'choosing',
  ]);

  // Extract words from title (handle both English and Arabic)
  const words = title
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ') // Keep letters, numbers, and Arabic characters
    .split(/\s+/)
    .filter(word => {
      if (!word || word.length < 4) return false;
      const wordLower = (word || '').toLowerCase().trim();
      return (
        word.length >= 4 && // At least 4 characters
        !stopWords.has(wordLower) && // Not a stop word
        !existingLower.has(wordLower) && // Not already in keywords
        !/^\d+$/.test(word) // Not just numbers
      );
    })
    .map(word => (word || '').trim())
    .filter(word => word && word.length >= 4); // Final length check

  // Return unique, meaningful words (max 3 per signal to prevent pollution)
  const unique = [...new Set(words.map(w => (w || '').toLowerCase()).filter(Boolean))];
  return unique.slice(0, 3);
}

/**
 * Learn person names associated with topics
 * e.g., "ayatollah" or "Khamenei" → Iran topic
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} showId - Show ID
 * @param {Array} dnaTopics - DNA topics
 * @param {string} person - Person name
 * @param {Array} countries - Associated countries
 * @returns {Promise<void>}
 */
async function learnPersonToTopic(supabase, showId, dnaTopics, person, countries) {
  if (!person || person.length < 4) return; // Skip short names
  
  try {
    // Find topic based on associated countries
    for (const country of countries || []) {
      if (!country) continue; // Skip undefined/null countries
      const countryLower = country.toLowerCase();
      
      const matchingTopic = dnaTopics.find(t => {
        const nameMatch = 
          t.topic_name_en?.toLowerCase().includes(countryLower) ||
          t.topic_name_ar?.toLowerCase().includes(countryLower);
        const keywordMatch = (t.keywords || []).some(k => {
          const kLower = String(k).toLowerCase();
          return kLower === countryLower || kLower.includes(countryLower) || countryLower.includes(kLower);
        });
        return nameMatch || keywordMatch;
      });

      if (matchingTopic) {
        if (!person) return; // Skip if person is undefined
        const personLower = person.toLowerCase();
        const existingLower = (matchingTopic.keywords || []).map(k => String(k || '').toLowerCase()).filter(Boolean);
        
        if (!existingLower.includes(personLower)) {
          const updatedKeywords = [...(matchingTopic.keywords || []), person];
          
          const { error } = await supabase
            .from('topic_definitions')
            .update({ 
              keywords: updatedKeywords,
              updated_at: new Date().toISOString()
            })
            .eq('show_id', showId)
            .eq('topic_id', matchingTopic.topic_id);

          if (error) {
            console.error('❌ Error learning person to topic:', error);
          } else {
            console.log(`📚 Auto-learned: Added person "${person}" to topic "${matchingTopic.topic_id}" (${matchingTopic.topic_name_en || matchingTopic.topic_id})`);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in learnPersonToTopic:', error);
  }
}

/**
 * Learn organization names associated with topics
 * e.g., "IRGC" → Iran topic
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} showId - Show ID
 * @param {Array} dnaTopics - DNA topics
 * @param {string} organization - Organization name
 * @param {Array} countries - Associated countries
 * @returns {Promise<void>}
 */
async function learnOrganizationToTopic(supabase, showId, dnaTopics, organization, countries) {
  if (!organization || organization.length < 3) return; // Skip short names
  
  try {
    // Find topic based on associated countries
    for (const country of countries || []) {
      if (!country) continue; // Skip undefined/null countries
      const countryLower = country.toLowerCase();
      
      const matchingTopic = dnaTopics.find(t => {
        const nameMatch = 
          t.topic_name_en?.toLowerCase().includes(countryLower) ||
          t.topic_name_ar?.toLowerCase().includes(countryLower);
        const keywordMatch = (t.keywords || []).some(k => {
          const kLower = String(k).toLowerCase();
          return kLower === countryLower || kLower.includes(countryLower) || countryLower.includes(kLower);
        });
        return nameMatch || keywordMatch;
      });

      if (matchingTopic) {
        if (!organization) return; // Skip if organization is undefined
        const orgLower = organization.toLowerCase();
        const existingLower = (matchingTopic.keywords || []).map(k => String(k || '').toLowerCase()).filter(Boolean);
        
        if (!existingLower.includes(orgLower)) {
          const updatedKeywords = [...(matchingTopic.keywords || []), organization];
          
          const { error } = await supabase
            .from('topic_definitions')
            .update({ 
              keywords: updatedKeywords,
              updated_at: new Date().toISOString()
            })
            .eq('show_id', showId)
            .eq('topic_id', matchingTopic.topic_id);

          if (error) {
            console.error('❌ Error learning organization to topic:', error);
          } else {
            console.log(`📚 Auto-learned: Added organization "${organization}" to topic "${matchingTopic.topic_id}" (${matchingTopic.topic_name_en || matchingTopic.topic_id})`);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in learnOrganizationToTopic:', error);
  }
}

/**
 * Extract title patterns (for learning what to reject)
 * 
 * @param {string} title - Signal title
 * @returns {Array<string>} Array of detected patterns
 */
function extractTitlePatterns(title) {
  if (!title) return [];
  
  const patterns = [];
  const titleLower = (title || '').toLowerCase();

  // Common patterns to detect
  const patternChecks = [
    { pattern: 'signs agreement', match: /signs?\s+agreement/i },
    { pattern: 'announces partnership', match: /announces?\s+partnership/i },
    { pattern: 'launches new', match: /launches?\s+new/i },
    { pattern: 'quarterly results', match: /quarterly\s+(results|earnings|report)/i },
    { pattern: 'stock rises', match: /stock\s+(rises?|gains?|up)/i },
    { pattern: 'stock falls', match: /stock\s+(falls?|drops?|down)/i },
    { pattern: 'explainer', match: /^explainer:/i },
    { pattern: 'found news', match: /تم العثور/i },
    { pattern: 'signs agreement ar', match: /يوقع اتفاقي/i },
    { pattern: 'routine diplomatic', match: /يوقع\s+(اتفاقيات?|مذكرة)/i },
  ];

  for (const { pattern, match } of patternChecks) {
    if (match.test(title)) {
      patterns.push(pattern);
    }
  }

  return patterns;
}

/**
 * Basic entity extraction (fallback when AI fails)
 * 
 * @param {string} title - Signal title
 * @returns {Object} Entities object with countries and topics arrays
 */
function extractBasicEntities(title) {
  if (!title) return { countries: [], topics: [] };
  
  const titleLower = (title || '').toLowerCase();
  const countries = [];
  const topics = [];

  // Common country detection
  const countryPatterns = {
    'iran': ['iran', 'iranian', 'tehran', 'إيران', 'ايران', 'persia', 'persian'],
    'china': ['china', 'chinese', 'beijing', 'الصين'],
    'usa': ['us ', 'u.s.', 'america', 'american', 'united states', 'أمريكا', 'امريكا'],
    'russia': ['russia', 'russian', 'moscow', 'روسيا'],
    'saudi arabia': ['saudi', 'riyadh', 'السعودية'],
    'egypt': ['egypt', 'egyptian', 'cairo', 'مصر'],
    'israel': ['israel', 'israeli', 'إسرائيل'],
    'venezuela': ['venezuela', 'venezuelan', 'فنزويلا'],
    'ukraine': ['ukraine', 'ukrainian', 'أوكرانيا'],
    'uae': ['uae', 'emirates', 'united arab emirates', 'الإمارات'],
  };

  for (const [country, patterns] of Object.entries(countryPatterns)) {
    if (patterns.some(p => titleLower.includes(p))) {
      countries.push(country);
    }
  }

  return { countries, topics };
}
