import { createClient } from '@supabase/supabase-js';
import { generateTopicFingerprint, compareTopics } from '../topicIntelligence';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// MAIN CLUSTERING FUNCTION
// ============================================
export async function clusterSignals(showId) {
  console.log('🔄 Starting clustering for show:', showId);
  
  // 1. Get all keywords for this show
  const { data: keywords } = await supabase
    .from('cluster_keywords')
    .select('cluster_key, keyword, language, weight')
    .eq('show_id', showId);
  
  if (!keywords || keywords.length === 0) {
    console.log('⚠️ No cluster keywords found for show:', showId);
    return { clustered: 0 };
  }
  
  // 2. Get unclustered signals (last 7 days)
  const { data: signals } = await supabase
    .from('signals')
    .select('id, title, description, url, created_at')
    .eq('show_id', showId)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  
  // 3. Get already clustered signal IDs
  const { data: existingItems } = await supabase
    .from('cluster_items')
    .select('signal_id')
    .not('signal_id', 'is', null);
  
  const clusteredIds = new Set(existingItems?.map(i => i.signal_id).filter(Boolean) || []);
  const unclusteredSignals = signals?.filter(s => !clusteredIds.has(s.id)) || [];
  
  console.log(`📊 Found ${unclusteredSignals.length} unclustered signals`);
  
  if (unclusteredSignals.length === 0) {
    return { clustered: 0 };
  }
  
  // 4. Get clusters for Topic Intelligence matching
  const { data: clusters } = await supabase
    .from('topic_clusters')
    .select('id, cluster_key, cluster_name, cluster_name_ar')
    .eq('show_id', showId);
  
  // 5. Match each signal to clusters using Topic Intelligence
  const matches = [];
  const matchedSignalIds = new Set();
  
  for (const signal of unclusteredSignals) {
    // Use Topic Intelligence for matching
    const matchedClusters = await findMatchingClusters(signal, keywords, clusters || []);
    
    // Detect angle for each match
    const detectedAngle = detectAngle(signal.title);
    
    for (const match of matchedClusters) {
      matches.push({
        signal_id: signal.id,
        cluster_key: match.cluster_key,
        relevance_score: match.score,
        title: signal.title,
        item_date: signal.created_at,
        source_type: 'signal',
        detected_angle: detectedAngle.type
      });
      matchedSignalIds.add(signal.id);
    }
  }
  
  // 6. Insert matches into cluster_items
  if (matches.length > 0) {
    // Cluster IDs already fetched above, create map
    const clusterMap = new Map(clusters?.map(c => [c.cluster_key, c.id]) || []);
    
    const itemsToInsert = matches
      .filter(m => clusterMap.has(m.cluster_key))
      .map(m => {
        const signal = unclusteredSignals.find(s => s.id === m.signal_id);
        return {
          cluster_id: clusterMap.get(m.cluster_key),
          signal_id: m.signal_id,
          source_type: 'signal',
          title: m.title,
          relevance_score: m.relevance_score,
          item_date: m.item_date,
          detected_angle: m.detected_angle,
          url: signal?.url || null
        };
      });
    
    if (itemsToInsert.length > 0) {
      const { error } = await supabase
        .from('cluster_items')
        .upsert(itemsToInsert, { onConflict: 'signal_id,cluster_id' });
      
      if (error) {
        console.error('❌ Error inserting cluster items:', error);
      } else {
        console.log(`✅ Clustered ${itemsToInsert.length} signals`);
      }
    }
  }
  
  // 7. Auto-discover new clusters for unmatched signals
  const unmatchedSignals = unclusteredSignals.filter(s => !matchedSignalIds.has(s.id));
  const stillUnclustered = await autoDiscoverClusters(showId, unmatchedSignals, keywords);
  
  // 8. Add truly unmatched signals to "Uncategorized" cluster
  if (stillUnclustered.length > 0) {
    // Get or create "Uncategorized" cluster
    let { data: uncatCluster } = await supabase
      .from('topic_clusters')
      .select('id')
      .eq('show_id', showId)
      .eq('cluster_key', 'uncategorized')
      .maybeSingle();
    
    if (!uncatCluster) {
      const { data } = await supabase
        .from('topic_clusters')
        .insert({
          show_id: showId,
          cluster_key: 'uncategorized',
          cluster_name: 'Uncategorized',
          cluster_name_ar: 'غير مصنف',
          is_auto_created: true
        })
        .select()
        .single();
      uncatCluster = data;
    }
    
    // Add uncategorized signals
    if (uncatCluster) {
      const uncatItems = stillUnclustered.map(s => {
        const detectedAngle = detectAngle(s.title);
        return {
          cluster_id: uncatCluster.id,
          signal_id: s.id,
          source_type: 'signal',
          title: s.title,
          relevance_score: 0.5,
          item_date: s.created_at,
          detected_angle: detectedAngle.type,
          url: s.url || null
        };
      });
      
      const { error } = await supabase
        .from('cluster_items')
        .upsert(uncatItems, { onConflict: 'signal_id,cluster_id' });
      
      if (error) {
        console.error('❌ Error inserting uncategorized items:', error);
      } else {
        console.log(`📦 ${stillUnclustered.length} signals added to Uncategorized`);
      }
    }
  }
  
  // 9. Update cluster statistics
  await updateClusterStats(showId);
  
  return { clustered: matches.length + stillUnclustered.length };
}

// ============================================
// TOPIC INTELLIGENCE-BASED MATCHING
// ============================================
/**
 * Find matching clusters for a signal using Topic Intelligence
 * Replaces keyword-based matching with semantic + entity matching
 */
async function findMatchingClustersWithTopicIntelligence(signal, keywords, clusters) {
  const clusterScores = new Map();
  
  try {
    // Generate fingerprint for the signal
    const signalFingerprint = await generateTopicFingerprint({
      title: signal.title,
      description: signal.description || '',
      id: signal.id,
      type: 'signal',
      skipEmbedding: true // Skip embedding for speed in clustering
    });
    
    // Group keywords by cluster_key for efficiency
    const keywordsByCluster = new Map();
    for (const kw of keywords) {
      if (!keywordsByCluster.has(kw.cluster_key)) {
        keywordsByCluster.set(kw.cluster_key, []);
      }
      keywordsByCluster.get(kw.cluster_key).push(kw);
    }
    
    // Compare signal against each cluster using Topic Intelligence
    for (const [clusterKey, clusterKeywords] of keywordsByCluster.entries()) {
      // Find representative cluster from database
      const cluster = clusters?.find(c => c.cluster_key === clusterKey);
      if (!cluster) continue;
      
      // Use cluster name/description as comparison target (if available)
      // Otherwise, use keywords as proxy
      const clusterText = cluster.cluster_name || cluster.cluster_name_ar || 
                         clusterKeywords.map(kw => kw.keyword).join(' ');
      
      if (!clusterText) continue;
      
      // Compare signal fingerprint against cluster
      const comparison = await compareTopics(
        { title: signal.title, description: signal.description || '', fingerprint: signalFingerprint },
        { title: clusterText, description: clusterText },
        { requireSameStory: false } // Use related matching for clustering
      );
      
      // Calculate score based on comparison result
      let score = 0;
      if (comparison.relationship === 'same_story' || comparison.relationship === 'related') {
        score = comparison.confidence * 10; // Scale 0-1 to 0-10
      } else if (comparison.entityOverlap && comparison.entityOverlap.score > 0.3) {
        // Good entity overlap even if not same story
        score = comparison.entityOverlap.score * 5;
      }
      
      // Also check keyword overlap as fallback (for backward compatibility)
      const text = `${signal.title} ${signal.description || ''}`.toLowerCase();
      let keywordScore = 0;
      for (const kw of clusterKeywords) {
        if (text.includes(kw.keyword.toLowerCase())) {
          keywordScore += (kw.weight || 1.0);
        }
      }
      
      // Combine Topic Intelligence score (70%) with keyword score (30%)
      const combinedScore = (score * 0.7) + (Math.min(keywordScore, 10) * 0.3);
      
      if (combinedScore >= 1.0) {
        clusterScores.set(clusterKey, combinedScore);
      }
    }
  } catch (error) {
    console.error('Error in Topic Intelligence clustering:', error);
    // Fallback to keyword matching
    return findMatchingClustersLegacy(`${signal.title} ${signal.description || ''}`, keywords);
  }
  
  // Return clusters with score > 1.0
  return Array.from(clusterScores.entries())
    .filter(([_, score]) => score >= 1.0)
    .map(([cluster_key, score]) => ({ cluster_key, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Legacy keyword-based matching (kept for backward compatibility)
 * @deprecated Use findMatchingClustersWithTopicIntelligence instead
 */
function findMatchingClustersLegacy(text, keywords) {
  const clusterScores = new Map();
  
  for (const kw of keywords) {
    if (text.includes(kw.keyword.toLowerCase())) {
      const current = clusterScores.get(kw.cluster_key) || 0;
      clusterScores.set(kw.cluster_key, current + (kw.weight || 1.0));
    }
  }
  
  // Return clusters with score > 1.0
  return Array.from(clusterScores.entries())
    .filter(([_, score]) => score >= 1.0)
    .map(([cluster_key, score]) => ({ cluster_key, score }))
    .sort((a, b) => b.score - a.score);
}

// Default function (uses Topic Intelligence, falls back to legacy if needed)
async function findMatchingClusters(signal, keywords, clusters = null) {
  // Use Topic Intelligence if clusters are available, otherwise fallback to legacy
  if (clusters && clusters.length > 0) {
    return await findMatchingClustersWithTopicIntelligence(signal, keywords, clusters);
  } else {
    // Legacy keyword matching for backward compatibility
    const text = typeof signal === 'string' ? signal : `${signal.title} ${signal.description || ''}`;
    return findMatchingClustersLegacy(text.toLowerCase(), keywords);
  }
}

// ============================================
// UPDATE CLUSTER STATISTICS
// ============================================
async function updateClusterStats(showId) {
  const { data: clusters } = await supabase
    .from('topic_clusters')
    .select('id, cluster_key')
    .eq('show_id', showId);
  
  for (const cluster of clusters || []) {
    // Count signals
    const { count: signalCount } = await supabase
      .from('cluster_items')
      .select('*', { count: 'exact', head: true })
      .eq('cluster_id', cluster.id)
      .eq('source_type', 'signal');
    
    // Count intel
    const { count: intelCount } = await supabase
      .from('cluster_items')
      .select('*', { count: 'exact', head: true })
      .eq('cluster_id', cluster.id)
      .eq('source_type', 'intel');
    
    // Get latest signal date
    const { data: latestItem } = await supabase
      .from('cluster_items')
      .select('item_date')
      .eq('cluster_id', cluster.id)
      .order('item_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // Calculate trend score based on count and recency
    const totalCount = (signalCount || 0) + (intelCount || 0);
    const trendScore = Math.min(100, totalCount * 15);
    const isTrending = totalCount >= 3;
    
    // Determine suggested format
    let suggestedFormat = 'short';
    if (totalCount >= 5) suggestedFormat = 'long';
    else if (totalCount >= 3) suggestedFormat = 'medium';
    
    // Update cluster
    await supabase
      .from('topic_clusters')
      .update({
        signal_count: signalCount || 0,
        intel_count: intelCount || 0,
        trend_score: trendScore,
        is_trending: isTrending,
        suggested_format: suggestedFormat,
        last_signal_at: latestItem?.item_date || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', cluster.id);
  }
  
  console.log('📊 Updated cluster statistics');
}

// ============================================
// GET CLUSTERS WITH ITEMS (for UI)
// ============================================
export async function getClustersWithItems(showId) {
  const { data: clusters } = await supabase
    .from('topic_clusters')
    .select(`
      *,
      items:cluster_items(
        id,
        signal_id,
        recommendation_id,
        source_type,
        title,
        relevance_score,
        detected_angle,
        item_date,
        url
      )
    `)
    .eq('show_id', showId)
    .eq('is_active', true)
    .order('trend_score', { ascending: false });
  
  return clusters || [];
}

// ============================================
// DETECT ANGLE FOR ITEM
// ============================================
export function detectAngle(title) {
  const lower = title?.toLowerCase() || '';
  
  const angles = [
    { type: 'personal_story', pattern: /(shrimper|carmaker|lawyer|farmer|how .+ survived)/i, label: 'قصة شخصية' },
    { type: 'numbers', pattern: /\d+\s*(million|billion|trillion|مليار|مليون)/i, label: 'أرقام' },
    { type: 'question', pattern: /^(why|how|what|will|هل|كيف|لماذا)/i, label: 'سؤال' },
    { type: 'prediction', pattern: /(will|could|2026|2027|future|مستقبل)/i, label: 'توقعات' },
    { type: 'comparison', pattern: /(vs|versus|compared|مقارنة|ضد)/i, label: 'مقارنة' },
    { type: 'analysis', pattern: /(impact|effect|analysis|تأثير|تحليل)/i, label: 'تحليل' },
    { type: 'breaking', pattern: /(breaking|just|now|عاجل)/i, label: 'عاجل' }
  ];
  
  for (const angle of angles) {
    if (angle.pattern.test(lower)) {
      return { type: angle.type, label: angle.label };
    }
  }
  
  return { type: 'news', label: 'خبر' };
}

// ============================================
// AUTO-DISCOVER NEW CLUSTERS
// ============================================
async function autoDiscoverClusters(showId, unclusteredSignals, existingKeywords) {
  if (unclusteredSignals.length === 0) {
    return [];
  }
  
  const newClusters = new Map();
  
  for (const signal of unclusteredSignals) {
    const text = `${signal.title} ${signal.description || ''}`.toLowerCase();
    
    // Check if matches any existing keyword
    const hasMatch = existingKeywords.some(kw => 
      text.includes(kw.keyword.toLowerCase())
    );
    
    if (!hasMatch) {
      // Extract potential cluster key from title
      const clusterKey = extractClusterKey(signal.title);
      
      if (clusterKey) {
        if (!newClusters.has(clusterKey.key)) {
          newClusters.set(clusterKey.key, {
            key: clusterKey.key,
            name: clusterKey.name,
            name_ar: clusterKey.name_ar,
            signals: [],
            keywords: clusterKey.keywords
          });
        }
        newClusters.get(clusterKey.key).signals.push(signal);
      }
    }
  }
  
  // Create new clusters if they have 2+ signals (indicates real trend)
  const createdClusters = [];
  for (const [key, cluster] of newClusters) {
    if (cluster.signals.length >= 2) {
      console.log(`🆕 Auto-creating cluster: ${cluster.name} (${cluster.signals.length} signals)`);
      
      // Insert new cluster
      const { data: newCluster, error: clusterError } = await supabase
        .from('topic_clusters')
        .insert({
          show_id: showId,
          cluster_key: key,
          cluster_name: cluster.name,
          cluster_name_ar: cluster.name_ar || cluster.name,
          keywords_en: JSON.stringify(cluster.keywords),
          is_auto_created: true
        })
        .select()
        .single();
      
      if (clusterError) {
        console.error(`❌ Error creating cluster ${key}:`, clusterError);
        continue;
      }
      
      // Insert keywords for future matching
      if (newCluster && cluster.keywords.length > 0) {
        const keywordInserts = cluster.keywords.map(kw => ({
          show_id: showId,
          cluster_key: key,
          keyword: kw,
          language: detectLanguage(kw),
          weight: 1.0
        }));
        
        const { error: kwError } = await supabase
          .from('cluster_keywords')
          .upsert(keywordInserts, { onConflict: 'show_id,cluster_key,keyword' });
        
        if (kwError) {
          console.error(`❌ Error inserting keywords for ${key}:`, kwError);
        }
      }
      
      // Add signals to the new cluster
      if (newCluster) {
        const clusterItems = cluster.signals.map(s => {
          const detectedAngle = detectAngle(s.title);
          return {
            cluster_id: newCluster.id,
            signal_id: s.id,
            source_type: 'signal',
            title: s.title,
            relevance_score: 1.0,
            item_date: s.created_at,
            detected_angle: detectedAngle.type
          };
        });
        
        const { error: itemsError } = await supabase
          .from('cluster_items')
          .upsert(clusterItems, { onConflict: 'signal_id,cluster_id' });
        
        if (itemsError) {
          console.error(`❌ Error inserting items for cluster ${key}:`, itemsError);
        } else {
          createdClusters.push(key);
        }
      }
    }
  }
  
  // Return signals that still have no cluster (truly uncategorized)
  const stillUnclustered = unclusteredSignals.filter(s => {
    const text = `${s.title} ${s.description || ''}`.toLowerCase();
    const matchedExisting = existingKeywords.some(kw => text.includes(kw.keyword.toLowerCase()));
    const matchedNew = Array.from(newClusters.values()).some(c => 
      c.signals.some(sig => sig.id === s.id)
    );
    return !matchedExisting && !matchedNew;
  });
  
  return stillUnclustered;
}

// ============================================
// EXTRACT CLUSTER KEY FROM TITLE
// ============================================
function extractClusterKey(title) {
  const lower = title.toLowerCase();
  
  // Common patterns to extract topics
  const patterns = [
    // Economy patterns
    { pattern: /(\w+)\s+economy/i, type: 'economy', nameFn: (m) => `${m} Economy` },
    { pattern: /اقتصاد\s+(\w+)/i, type: 'economy_ar', nameFn: (m) => `اقتصاد ${m}` },
    
    // Company patterns
    { pattern: /(apple|google|meta|amazon|microsoft|nvidia|tesla|openai)/i, type: 'company', nameFn: (m) => m.charAt(0).toUpperCase() + m.slice(1) },
    
    // Country patterns
    { pattern: /(india|japan|korea|brazil|mexico|europe|germany|france|uk|britain)/i, type: 'country', nameFn: (m) => m.charAt(0).toUpperCase() + m.slice(1) },
    
    // Topic patterns
    { pattern: /(immigration|inflation|interest rate|cryptocurrency|bitcoin|ai|artificial intelligence)/i, type: 'topic', nameFn: (m) => m.charAt(0).toUpperCase() + m.slice(1) },
    { pattern: /(هجرة|تضخم|فائدة|عملات رقمية|ذكاء اصطناعي)/i, type: 'topic_ar', nameFn: (m) => m }
  ];
  
  for (const { pattern, type, nameFn } of patterns) {
    const match = title.match(pattern);
    if (match) {
      const extracted = match[1] || match[0];
      const normalized = extracted.toLowerCase().replace(/\s+/g, '_');
      return {
        key: `auto_${type}_${normalized}`,
        name: nameFn(extracted),
        name_ar: type.includes('_ar') ? nameFn(extracted) : null,
        keywords: [extracted.toLowerCase()]
      };
    }
  }
  
  return null;
}

// ============================================
// DETECT LANGUAGE
// ============================================
function detectLanguage(text) {
  const arabicPattern = /[\u0600-\u06FF]/;
  return arabicPattern.test(text) ? 'ar' : 'en';
}

