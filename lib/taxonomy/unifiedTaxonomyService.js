/**
 * Unified Taxonomy Service
 * Single source of truth for all topic/taxonomy operations
 * 
 * This service is the ONLY place where topics should be:
 * - Loaded
 * - Matched against signals
 * - Updated with learning
 * - Queried for analytics
 */

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// TOPIC LOADING
// ============================================

/**
 * Load all active topics for a show
 * This is the ONLY function that should load topics
 * 
 * @param {string} showId - Show ID
 * @param {Object} supabase - Optional Supabase client (uses admin if not provided)
 * @returns {Promise<Array>} Array of topics with merged keywords
 */
export async function loadTopics(showId, supabase = null) {
  const db = supabase || supabaseAdmin;
  
  if (!db || !showId) {
    console.warn('⚠️ loadTopics: Missing supabase or showId');
    return [];
  }

  try {
    const { data: topics, error } = await db
      .from('topic_definitions')
      .select(`
        topic_id,
        topic_name_en,
        topic_name_ar,
        keywords,
        learned_keywords,
        description,
        is_active,
        performance_stats,
        liked_count,
        rejected_count,
        produced_count,
        match_count,
        avg_score,
        last_matched_at
      `)
      .eq('show_id', showId)
      .eq('is_active', true)
      .order('match_count', { ascending: false });
    
    if (error) {
      console.error('❌ Error loading topics:', error);
      return [];
    }
    
    // Merge keywords and learned_keywords for matching
    const topicsWithMergedKeywords = (topics || []).map(topic => ({
      ...topic,
      allKeywords: [
        ...(Array.isArray(topic.keywords) ? topic.keywords : []),
        ...(Array.isArray(topic.learned_keywords) ? topic.learned_keywords : [])
      ].filter(Boolean)
    }));
    
    console.log(`📚 Loaded ${topicsWithMergedKeywords.length} topics from topic_definitions`);
    return topicsWithMergedKeywords;
  } catch (error) {
    console.error('❌ Exception loading topics:', error);
    return [];
  }
}

/**
 * Get a single topic by ID
 * 
 * @param {string} showId - Show ID
 * @param {string} topicId - Topic ID
 * @param {Object} supabase - Optional Supabase client
 * @returns {Promise<Object|null>} Topic object or null
 */
export async function getTopic(showId, topicId, supabase = null) {
  const db = supabase || supabaseAdmin;
  
  if (!db || !showId || !topicId) {
    return null;
  }

  try {
    const { data: topic, error } = await db
      .from('topic_definitions')
      .select('*')
      .eq('show_id', showId)
      .eq('topic_id', topicId)
      .single();
    
    if (error || !topic) return null;
    
    // Merge keywords
    return {
      ...topic,
      allKeywords: [
        ...(Array.isArray(topic.keywords) ? topic.keywords : []),
        ...(Array.isArray(topic.learned_keywords) ? topic.learned_keywords : [])
      ].filter(Boolean)
    };
  } catch (error) {
    console.error('❌ Error getting topic:', error);
    return null;
  }
}

// ============================================
// TOPIC MATCHING
// ============================================

/**
 * Match a signal against all topics
 * Returns array of matched topic_ids with confidence scores
 * 
 * @param {Object} signal - Signal object with title, description
 * @param {Array} topics - Array of topics from loadTopics()
 * @param {Object} aiFingerprint - Optional AI fingerprint from topicIntelligence
 * @returns {Promise<Array>} Array of match results sorted by confidence
 */
export async function matchSignalToTopics(signal, topics, aiFingerprint = null) {
  if (!signal || !topics || topics.length === 0) {
    return [];
  }

  const matches = [];
  const title = (signal.title || '').toLowerCase();
  const description = (signal.description || '').toLowerCase();
  const fullText = `${title} ${description}`;
  
  for (const topic of topics) {
    const matchResult = {
      topicId: topic.topic_id,
      topicName: topic.topic_name_en || topic.topic_id,
      confidence: 0,
      matchedBy: [],
      matchedKeywords: []
    };
    
    // Method 1: AI Fingerprint matching (highest confidence)
    if (aiFingerprint) {
      const aiMatch = matchByAiFingerprint(topic, aiFingerprint);
      if (aiMatch.matched) {
        matchResult.confidence += aiMatch.confidence;
        matchResult.matchedBy.push(...aiMatch.matchedBy);
      }
    }
    
    // Method 2: Keyword matching
    const keywordMatch = matchByKeywords(topic, fullText);
    if (keywordMatch.matched) {
      matchResult.confidence += keywordMatch.confidence;
      matchResult.matchedKeywords = keywordMatch.keywords;
      matchResult.matchedBy.push({ type: 'keywords', keywords: keywordMatch.keywords });
    }
    
    // Only include if confidence > 0
    if (matchResult.confidence > 0) {
      matches.push(matchResult);
    }
  }
  
  // Sort by confidence (highest first)
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Match by AI fingerprint entities
 */
function matchByAiFingerprint(topic, fingerprint) {
  const result = { matched: false, confidence: 0, matchedBy: [] };
  const topicKeywords = (topic.allKeywords || []).map(k => (k || '').toLowerCase());
  
  // Generic terms that shouldn't match alone
  const GENERIC_TERMS = new Set([
    'war', 'economy', 'economics', 'economic', 'government', 'politics', 'political',
    'business', 'trade', 'market', 'markets', 'finance', 'financial', 'money',
    'news', 'report', 'analysis', 'update', 'crisis', 'conflict', 'issue',
    'policy', 'industry', 'sector', 'growth', 'decline', 'rise', 'fall',
    'president', 'leader', 'official', 'minister', 'company', 'country',
    'jobs', 'employment', 'unemployment', 'job',
    'حرب', 'اقتصاد', 'سياسة', 'تجارة', 'سوق', 'أزمة', 'حكومة', 'رئيس',
    'شركة', 'دولة', 'وزير', 'مال', 'نمو', 'تراجع', 'ارتفاع', 'انخفاض'
  ]);
  
  // Check countries
  for (const country of (fingerprint.entities?.countries || fingerprint.countries || [])) {
    if (!country || typeof country !== 'string') continue;
    const countryLower = country.toLowerCase();
    if (GENERIC_TERMS.has(countryLower)) continue;
    
    if (topicKeywords.some(k => k && (k.includes(countryLower) || countryLower.includes(k)))) {
      result.matched = true;
      result.confidence += 30;
      result.matchedBy.push({ type: 'ai_country', value: country });
    }
  }
  
  // Check topics
  for (const t of (fingerprint.entities?.topics || fingerprint.topics || [])) {
    if (!t || typeof t !== 'string') continue;
    const topicLower = t.toLowerCase();
    if (GENERIC_TERMS.has(topicLower)) continue;
    
    if (topicKeywords.some(k => k && (k.includes(topicLower) || topicLower.includes(k)))) {
      result.matched = true;
      result.confidence += 25;
      result.matchedBy.push({ type: 'ai_topic', value: t });
    }
  }
  
  // Check people
  for (const person of (fingerprint.entities?.people || fingerprint.people || [])) {
    if (!person || typeof person !== 'string') continue;
    const personLower = person.toLowerCase();
    if (topicKeywords.some(k => k && (k.includes(personLower) || personLower.includes(k)))) {
      result.matched = true;
      result.confidence += 20;
      result.matchedBy.push({ type: 'ai_person', value: person });
    }
  }
  
  // Check organizations
  for (const org of (fingerprint.entities?.organizations || fingerprint.organizations || [])) {
    if (!org || typeof org !== 'string') continue;
    const orgLower = org.toLowerCase();
    if (topicKeywords.some(k => k && (k.includes(orgLower) || orgLower.includes(k)))) {
      result.matched = true;
      result.confidence += 20;
      result.matchedBy.push({ type: 'ai_org', value: org });
    }
  }
  
  return result;
}

/**
 * Match by keywords
 */
function matchByKeywords(topic, text) {
  const result = { matched: false, confidence: 0, keywords: [] };
  
  if (!text || !topic.allKeywords || topic.allKeywords.length === 0) {
    return result;
  }
  
  for (const keyword of topic.allKeywords) {
    if (!keyword || typeof keyword !== 'string' || keyword.length < 3) continue;
    
    const keywordLower = keyword.toLowerCase();
    if (text.includes(keywordLower)) {
      result.matched = true;
      result.confidence += 15;
      result.keywords.push(keyword);
    }
  }
  
  // Require at least 2 keywords for high confidence
  if (result.keywords.length >= 2) {
    result.confidence += 10;
  }
  
  return result;
}

// ============================================
// LEARNING UPDATES
// ============================================

/**
 * Update topic stats when a signal is matched
 * 
 * @param {string} showId - Show ID
 * @param {string} topicId - Topic ID
 * @param {Object} supabase - Optional Supabase client
 */
export async function recordTopicMatch(showId, topicId, supabase = null) {
  const db = supabase || supabaseAdmin;
  
  if (!db || !showId || !topicId) {
    return;
  }

  try {
    // Try SQL function first (if it exists)
    try {
      const { error: rpcError } = await db.rpc('increment_topic_match_count', {
        p_show_id: showId,
        p_topic_id: topicId
      });
      
      if (!rpcError) {
        return; // Success
      }
    } catch (rpcError) {
      // Function might not exist, fall through to direct update
    }
    
    // Fallback: Get current count and increment
    const { data: topic } = await db
      .from('topic_definitions')
      .select('match_count')
      .eq('show_id', showId)
      .eq('topic_id', topicId)
      .single();
    
    const currentCount = topic?.match_count || 0;
    
    await db
      .from('topic_definitions')
      .update({
        match_count: currentCount + 1,
        last_matched_at: new Date().toISOString()
      })
      .eq('show_id', showId)
      .eq('topic_id', topicId);
  } catch (error) {
    console.error('❌ Error recording topic match:', error);
  }
}

/**
 * Learn from user feedback
 * Updates topic stats and optionally learns new keywords
 * 
 * @param {string} showId - Show ID
 * @param {string} topicId - Topic ID
 * @param {string} action - 'liked', 'rejected', 'produced'
 * @param {Object} signal - Signal object
 * @param {Object} supabase - Optional Supabase client
 */
export async function learnFromFeedback(showId, topicId, action, signal = null, supabase = null) {
  const db = supabase || supabaseAdmin;
  
  if (!db || !showId || !topicId || !action) {
    console.warn(`⚠️ learnFromFeedback: Missing required parameters (showId=${!!showId}, topicId=${!!topicId}, action=${action})`);
    return { success: false, error: 'Missing parameters' };
  }

  console.log(`📚 Learning from feedback: action=${action}, topicId=${topicId}, showId=${showId.substring(0, 8)}...`);

  try {
    // Get current counts
    const { data: topic } = await db
      .from('topic_definitions')
      .select('liked_count, rejected_count, produced_count, topic_name_en')
      .eq('show_id', showId)
      .eq('topic_id', topicId)
      .single();
    
    if (!topic) {
      console.warn(`⚠️ Topic ${topicId} not found for learning`);
      return { success: false, error: 'Topic not found' };
    }
    
    const topicName = topic.topic_name_en || topicId;
    
    // Update counts
    const updates = {
      last_matched_at: new Date().toISOString()
    };
    
    if (action === 'liked') {
      updates.liked_count = (topic.liked_count || 0) + 1;
    } else if (action === 'rejected') {
      updates.rejected_count = (topic.rejected_count || 0) + 1;
    } else if (action === 'produced') {
      updates.produced_count = (topic.produced_count || 0) + 1;
    }
    
    const { error: updateError } = await db
      .from('topic_definitions')
      .update(updates)
      .eq('show_id', showId)
      .eq('topic_id', topicId);
    
    if (updateError) {
      console.error(`❌ Error updating topic stats:`, updateError);
      return { success: false, error: updateError.message };
    }
    
    // Learn keywords from signal content (for liked and produced actions)
    let learnedKeywords = [];
    if ((action === 'liked' || action === 'produced') && signal) {
      const newKeywords = extractPotentialKeywords(signal);
      if (newKeywords.length > 0) {
        console.log(`📚 Extracted ${newKeywords.length} potential keywords from signal:`, newKeywords);
        const learnResult = await learnKeywords(showId, topicId, newKeywords, db);
        learnedKeywords = newKeywords;
        if (learnResult && learnResult.added > 0) {
          console.log(`   ✅ Added ${learnResult.added} new keywords to topic "${topicName}"`);
        }
      } else {
        console.log(`   ℹ️ No keywords extracted from signal (title: "${signal.title?.substring(0, 50)}...")`);
      }
    } else if (action === 'rejected' && signal) {
      // For rejected signals, we could learn negative patterns (future enhancement)
      console.log(`   ℹ️ Rejected signal - not learning keywords (future: learn negative patterns)`);
    }
    
    const result = {
      success: true,
      action,
      topicId,
      topicName,
      learnedKeywords: learnedKeywords.length,
      keywords: learnedKeywords
    };
    
    console.log(`✅ Learning complete: ${action} for topic "${topicName}" (${topicId})`);
    if (learnedKeywords.length > 0) {
      console.log(`   📚 Learned keywords: ${learnedKeywords.join(', ')}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error learning from feedback:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Learn new keywords for a topic
 * 
 * @param {string} showId - Show ID
 * @param {string} topicId - Topic ID
 * @param {Array<string>} keywords - Keywords to learn
 * @param {Object} supabase - Optional Supabase client
 */
export async function learnKeywords(showId, topicId, keywords, supabase = null) {
  const db = supabase || supabaseAdmin;
  
  if (!db || !showId || !topicId || !keywords || keywords.length === 0) {
    return { added: 0, total: 0, skipped: 0 };
  }

  try {
    // Get current topic
    const { data: topic, error: fetchError } = await db
      .from('topic_definitions')
      .select('learned_keywords, keyword_sources, topic_name_en')
      .eq('show_id', showId)
      .eq('topic_id', topicId)
      .single();
    
    if (fetchError || !topic) {
      console.warn(`⚠️ Topic ${topicId} not found for keyword learning`);
      return { added: 0, total: 0, skipped: keywords.length };
    }
    
    const currentLearned = Array.isArray(topic.learned_keywords) ? topic.learned_keywords : [];
    const sources = topic.keyword_sources || {};
    
    // Add new keywords (avoid duplicates)
    const newLearned = [...currentLearned];
    let added = 0;
    let skipped = 0;
    
    for (const keyword of keywords) {
      if (!keyword || typeof keyword !== 'string' || keyword.length < 4) {
        skipped++;
        continue;
      }
      
      const keywordLower = keyword.toLowerCase().trim();
      const exists = newLearned.some(k => (k || '').toLowerCase() === keywordLower);
      
      if (!exists) {
        newLearned.push(keyword);
        sources[keyword] = 'learned';
        added++;
      } else {
        skipped++;
      }
    }
    
    // Limit to 50 learned keywords (keep most recent)
    const limitedLearned = newLearned.slice(-50);
    const limitedSources = {};
    limitedLearned.forEach(kw => {
      if (sources[kw]) {
        limitedSources[kw] = sources[kw];
      }
    });
    
    await db
      .from('topic_definitions')
      .update({
        learned_keywords: limitedLearned,
        keyword_sources: limitedSources,
        updated_at: new Date().toISOString()
      })
      .eq('show_id', showId)
      .eq('topic_id', topicId);
    
    console.log(`📚 Learned ${added} new keywords for topic "${topic.topic_name_en || topicId}" (${skipped} skipped: duplicates or too short)`);
    
    return {
      added,
      total: limitedLearned.length,
      skipped,
      keywords: limitedLearned.slice(currentLearned.length) // Return only newly added
    };
  } catch (error) {
    console.error('❌ Error learning keywords:', error);
    return { added: 0, total: 0, skipped: keywords.length, error: error.message };
  }
}

/**
 * Extract potential keywords from a signal
 */
function extractPotentialKeywords(signal) {
  if (!signal) return [];
  
  const title = signal.title || '';
  const description = signal.description || '';
  
  // Simple extraction - can be enhanced with NLP
  const words = `${title} ${description}`
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .split(/\s+/)
    .filter(w => w && w.length >= 4);
  
  // Stop words
  const stopWords = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'been',
    'will', 'about', 'more', 'after', 'could', 'would', 'their', 'which',
    'من', 'في', 'على', 'إلى', 'عن', 'مع', 'هذا', 'هذه', 'التي', 'الذي',
    'said', 'says', 'according', 'report', 'news', 'update', 'breaking'
  ]);
  
  // Count word frequency
  const wordCount = {};
  for (const word of words) {
    if (!stopWords.has(word)) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  }
  
  // Return top 3 most frequent words
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Get topic performance stats
 * 
 * @param {string} showId - Show ID
 * @param {Object} supabase - Optional Supabase client
 * @returns {Promise<Array>} Array of topic stats
 */
export async function getTopicStats(showId, supabase = null) {
  const db = supabase || supabaseAdmin;
  
  if (!db || !showId) {
    return [];
  }

  try {
    const { data: topics, error } = await db
      .from('topic_definitions')
      .select(`
        topic_id,
        topic_name_en,
        topic_name_ar,
        liked_count,
        rejected_count,
        produced_count,
        match_count,
        avg_score,
        performance_stats,
        last_matched_at
      `)
      .eq('show_id', showId)
      .eq('is_active', true)
      .order('match_count', { ascending: false });
    
    if (error) {
      console.error('❌ Error getting topic stats:', error);
      return [];
    }
    
    return (topics || []).map(topic => ({
      ...topic,
      successRate: topic.match_count > 0 
        ? Math.round((topic.liked_count + topic.produced_count) / topic.match_count * 100)
        : 0,
      rejectionRate: topic.match_count > 0
        ? Math.round(topic.rejected_count / topic.match_count * 100)
        : 0
    }));
  } catch (error) {
    console.error('❌ Error getting topic stats:', error);
    return [];
  }
}

/**
 * Update performance stats from produced content
 * 
 * @param {string} showId - Show ID
 * @param {string} topicId - Topic ID
 * @param {Object} videoStats - Video statistics
 * @param {Object} supabase - Optional Supabase client
 */
export async function updatePerformanceStats(showId, topicId, videoStats, supabase = null) {
  const db = supabase || supabaseAdmin;
  
  if (!db || !showId || !topicId || !videoStats) {
    return;
  }

  try {
    // Get current stats
    const { data: topic } = await db
      .from('topic_definitions')
      .select('performance_stats')
      .eq('show_id', showId)
      .eq('topic_id', topicId)
      .single();
    
    const currentStats = topic?.performance_stats || {
      totalViews: 0,
      totalEngagement: 0,
      videoCount: 0
    };
    
    // Update stats
    const updatedStats = {
      totalViews: currentStats.totalViews + (videoStats.views || 0),
      totalEngagement: currentStats.totalEngagement + (videoStats.engagement || 0),
      videoCount: currentStats.videoCount + 1,
      avgViews: Math.round((currentStats.totalViews + (videoStats.views || 0)) / (currentStats.videoCount + 1)),
      lastUpdated: new Date().toISOString()
    };
    
    await db
      .from('topic_definitions')
      .update({ performance_stats: updatedStats })
      .eq('show_id', showId)
      .eq('topic_id', topicId);
  } catch (error) {
    console.error('❌ Error updating performance stats:', error);
  }
}

// ============================================
// CLUSTER INTEGRATION
// ============================================

/**
 * Get or create cluster for a topic
 * Clusters are now linked to topic_definitions
 * 
 * @param {string} showId - Show ID
 * @param {string} topicId - Topic ID
 * @param {Object} supabase - Optional Supabase client
 * @returns {Promise<Object|null>} Cluster object or null
 */
export async function getTopicCluster(showId, topicId, supabase = null) {
  const db = supabase || supabaseAdmin;
  
  if (!db || !showId || !topicId) {
    return null;
  }

  try {
    // Check if cluster exists for this topic
    const { data: existing } = await db
      .from('topic_clusters')
      .select('*')
      .eq('show_id', showId)
      .eq('cluster_key', topicId)
      .maybeSingle();
    
    if (existing) return existing;
    
    // Create cluster from topic
    const topic = await getTopic(showId, topicId, db);
    if (!topic) return null;
    
    const { data: newCluster, error } = await db
      .from('topic_clusters')
      .insert({
        show_id: showId,
        cluster_key: topicId,
        cluster_name: topic.topic_name_en,
        cluster_name_ar: topic.topic_name_ar
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating cluster:', error);
      return null;
    }
    
    return newCluster;
  } catch (error) {
    console.error('❌ Error getting topic cluster:', error);
    return null;
  }
}

// ============================================
// MIGRATION HELPERS
// ============================================

/**
 * Migrate show_dna.topics to topic_definitions
 * Run once to migrate legacy data
 * 
 * @param {string} showId - Show ID
 * @param {Object} supabase - Optional Supabase client
 */
export async function migrateFromShowDna(showId, supabase = null) {
  const db = supabase || supabaseAdmin;
  
  if (!db || !showId) {
    return;
  }

  try {
    // Get legacy topics from show_dna
    const { data: showDna } = await db
      .from('show_dna')
      .select('topics')
      .eq('show_id', showId)
      .maybeSingle();
    
    if (!showDna?.topics || !Array.isArray(showDna.topics)) {
      console.log('No legacy topics to migrate');
      return;
    }
    
    // Check existing topics
    const { data: existing } = await db
      .from('topic_definitions')
      .select('topic_id')
      .eq('show_id', showId);
    
    const existingIds = new Set(existing?.map(t => t.topic_id).filter(Boolean) || []);
    
    // Migrate each topic
    let migrated = 0;
    for (const topic of showDna.topics) {
      const topicId = topic.id || topic.topic_id;
      if (!topicId || existingIds.has(topicId)) {
        continue;
      }
      
      const { error } = await db
        .from('topic_definitions')
        .insert({
          show_id: showId,
          topic_id: topicId,
          topic_name_en: topic.name || topic.topic_name_en || topicId,
          topic_name_ar: topic.name_ar || topic.topic_name_ar,
          keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
          description: topic.description,
          is_active: true
        });
      
      if (error) {
        console.error(`Error migrating topic ${topicId}:`, error);
      } else {
        migrated++;
        console.log(`✅ Migrated topic: ${topicId}`);
      }
    }
    
    console.log(`Migration complete: ${migrated} topics migrated`);
  } catch (error) {
    console.error('❌ Error migrating from show_dna:', error);
  }
}
