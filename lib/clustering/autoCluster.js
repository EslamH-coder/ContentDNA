import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// INSERT CLUSTER ITEMS (with title-based duplicate check)
// ============================================
async function insertClusterItems(items, supabase) {
  if (!items || items.length === 0) return 0;

  // Get existing titles in each cluster
  const clusterIds = [...new Set(items.map(i => i.cluster_id))];
  
  const { data: existingItems } = await supabase
    .from('cluster_items')
    .select('cluster_id, title')
    .in('cluster_id', clusterIds);

  // Create set of existing cluster-title combinations
  const existingSet = new Set(
    existingItems?.map(i => `${i.cluster_id}::${i.title.toLowerCase().trim()}`) || []
  );

  // Filter out items that already exist (by title)
  const newItems = items.filter(item => {
    const key = `${item.cluster_id}::${item.title.toLowerCase().trim()}`;
    return !existingSet.has(key);
  });

  const duplicatesSkipped = items.length - newItems.length;
  console.log(`📝 Inserting ${newItems.length} new items (${duplicatesSkipped} duplicates skipped by title)`);

  if (newItems.length > 0) {
    const { error } = await supabase
      .from('cluster_items')
      .insert(newItems);
    
    if (error) {
      console.error('❌ Error inserting cluster items:', error);
      return 0;
    }
  }

  return newItems.length;
}

// ============================================
// MAIN AUTO-CLUSTERING FUNCTION
// ============================================
export async function autoClusterSignals(showId) {
  console.log('🔄 Starting auto-clustering for show:', showId);
  
  const results = {
    processed: 0,
    clustered: 0,
    newClusters: 0,
    uncategorized: 0
  };

  try {
    // 1. Get keywords for matching
    const { data: keywords } = await supabase
      .from('cluster_keywords')
      .select('cluster_key, keyword, language, weight')
      .eq('show_id', showId);

    // 2. Get all clusters
    const { data: clusters } = await supabase
      .from('topic_clusters')
      .select('id, cluster_key')
      .eq('show_id', showId);

    const clusterMap = new Map(clusters?.map(c => [c.cluster_key, c.id]) || []);

    // 3. Get unclustered signals (pending status or not in cluster_items)
    const { data: signals } = await supabase
      .from('signals')
      .select('id, title, description, url, created_at')
      .eq('show_id', showId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    // 4. Get already clustered signal IDs
    const { data: existingItems } = await supabase
      .from('cluster_items')
      .select('signal_id');

    const clusteredIds = new Set(existingItems?.map(i => i.signal_id).filter(Boolean) || []);
    const unclusteredSignals = signals?.filter(s => !clusteredIds.has(s.id)) || [];

    console.log(`📊 Found ${unclusteredSignals.length} unclustered signals`);
    results.processed = unclusteredSignals.length;

    if (unclusteredSignals.length === 0) {
      return results;
    }

    // 5. Process each signal
    const itemsToInsert = [];
    const signalsForAutoDiscovery = [];

    for (const signal of unclusteredSignals) {
      const text = `${signal.title} ${signal.description || ''}`.toLowerCase();
      const matches = findMatchingClusters(text, keywords);

      if (matches.length > 0) {
        // Signal matches existing clusters
        for (const match of matches) {
          const clusterId = clusterMap.get(match.cluster_key);
          if (clusterId) {
            itemsToInsert.push({
              cluster_id: clusterId,
              signal_id: signal.id,
              source_type: 'signal',
              title: signal.title,
              url: signal.url,
              relevance_score: match.score,
              item_date: signal.created_at
            });
          }
        }
      } else {
        // No match - candidate for auto-discovery
        signalsForAutoDiscovery.push(signal);
      }
    }

    // 6. Insert matched items (with title-based duplicate check)
    if (itemsToInsert.length > 0) {
      const insertedCount = await insertClusterItems(itemsToInsert, supabase);
      results.clustered = insertedCount;
    }

    // 7. Auto-discover new clusters from unmatched signals
    const newClusters = await autoDiscoverClusters(showId, signalsForAutoDiscovery, clusterMap);
    results.newClusters = newClusters.created;
    results.uncategorized = newClusters.uncategorized;

    // 8. Update cluster statistics
    await updateClusterStats(showId);

    console.log('✅ Auto-clustering complete:', results);
    return results;

  } catch (error) {
    console.error('❌ Auto-clustering error:', error);
    throw error;
  }
}

// ============================================
// FIND MATCHING CLUSTERS
// ============================================
function findMatchingClusters(text, keywords) {
  const clusterScores = new Map();

  for (const kw of keywords || []) {
    const keyword = kw.keyword.toLowerCase();
    if (text.includes(keyword)) {
      const current = clusterScores.get(kw.cluster_key) || 0;
      clusterScores.set(kw.cluster_key, current + (kw.weight || 1));
    }
  }

  return Array.from(clusterScores.entries())
    .filter(([_, score]) => score >= 1.0)
    .map(([cluster_key, score]) => ({ cluster_key, score }))
    .sort((a, b) => b.score - a.score);
}

// ============================================
// AUTO-DISCOVER NEW CLUSTERS
// ============================================
async function autoDiscoverClusters(showId, signals, existingClusterMap) {
  const results = { created: 0, uncategorized: 0 };
  
  if (signals.length === 0) return results;

  console.log(`🔍 Analyzing ${signals.length} signals for new clusters...`);

  // Group signals by potential topics
  const topicGroups = new Map();

  for (const signal of signals) {
    const topics = extractTopics(signal.title);
    
    for (const topic of topics) {
      if (!topicGroups.has(topic.key)) {
        topicGroups.set(topic.key, {
          key: topic.key,
          name: topic.name,
          name_ar: topic.name_ar,
          keywords: topic.keywords,
          signals: []
        });
      }
      topicGroups.get(topic.key).signals.push(signal);
    }
  }

  // Create clusters for topics with 2+ signals
  for (const [key, group] of topicGroups) {
    if (group.signals.length >= 2 && !existingClusterMap.has(key)) {
      console.log(`🆕 Creating new cluster: ${group.name} (${group.signals.length} signals)`);

      // Create the cluster
      const { data: newCluster, error: clusterError } = await supabase
        .from('topic_clusters')
        .insert({
          show_id: showId,
          cluster_key: key,
          cluster_name: group.name,
          cluster_name_ar: group.name_ar || group.name,
          keywords_en: JSON.stringify(group.keywords.filter(k => !isArabic(k))),
          keywords_ar: JSON.stringify(group.keywords.filter(k => isArabic(k))),
          is_auto_created: true
        })
        .select()
        .single();

      if (clusterError) {
        console.error('❌ Error creating cluster:', clusterError);
        continue;
      }

      // Add keywords
      const keywordInserts = group.keywords.map(kw => ({
        show_id: showId,
        cluster_key: key,
        keyword: kw.toLowerCase(),
        language: isArabic(kw) ? 'ar' : 'en',
        weight: 1.0
      }));

      const { error: kwError } = await supabase
        .from('cluster_keywords')
        .upsert(keywordInserts, { onConflict: 'show_id,cluster_key,keyword' });

      if (kwError) {
        console.error('❌ Error inserting keywords:', kwError);
      }

      // Add signals to cluster (with title-based duplicate check)
      const itemInserts = group.signals.map(s => ({
        cluster_id: newCluster.id,
        signal_id: s.id,
        source_type: 'signal',
        title: s.title,
        url: s.url,
        relevance_score: 1.0,
        item_date: s.created_at
      }));

      const insertedCount = await insertClusterItems(itemInserts, supabase);
      // Cluster was created, even if no new items were inserted
      existingClusterMap.set(key, newCluster.id);
      results.created++;
    }
  }

  // Add remaining uncategorized signals
  const stillUncategorized = signals.filter(s => {
    const topics = extractTopics(s.title);
    return topics.every(t => {
      const group = topicGroups.get(t.key);
      return !group || group.signals.length < 2;
    });
  });

  if (stillUncategorized.length > 0) {
    // Get or create uncategorized cluster
    let uncatClusterId = existingClusterMap.get('uncategorized');
    
    if (!uncatClusterId) {
      let { data: uncatCluster } = await supabase
        .from('topic_clusters')
        .select('id')
        .eq('show_id', showId)
        .eq('cluster_key', 'uncategorized')
        .maybeSingle();
      
      if (!uncatCluster) {
        const { data: newUncatCluster } = await supabase
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
        uncatCluster = newUncatCluster;
      }
      
      uncatClusterId = uncatCluster?.id;
      if (uncatClusterId) {
        existingClusterMap.set('uncategorized', uncatClusterId);
      }
    }

    if (uncatClusterId) {
      const uncatItems = stillUncategorized.map(s => ({
        cluster_id: uncatClusterId,
        signal_id: s.id,
        source_type: 'signal',
        title: s.title,
        url: s.url,
        relevance_score: 0.5,
        item_date: s.created_at
      }));

      const insertedCount = await insertClusterItems(uncatItems, supabase);
      results.uncategorized = insertedCount;
    }
  }

  return results;
}

// ============================================
// EXTRACT TOPICS FROM TITLE
// ============================================
function extractTopics(title) {
  const lower = title.toLowerCase();
  const topics = [];

  // Topic patterns
  const patterns = [
    // Companies
    { pattern: /\b(apple)\b/i, key: 'auto_apple', name: 'Apple', keywords: ['apple'] },
    { pattern: /\b(google|alphabet)\b/i, key: 'auto_google', name: 'Google', keywords: ['google', 'alphabet'] },
    { pattern: /\b(meta|facebook)\b/i, key: 'auto_meta', name: 'Meta', keywords: ['meta', 'facebook'] },
    { pattern: /\b(amazon)\b/i, key: 'auto_amazon', name: 'Amazon', keywords: ['amazon'] },
    { pattern: /\b(microsoft)\b/i, key: 'auto_microsoft', name: 'Microsoft', keywords: ['microsoft'] },
    { pattern: /\b(nvidia)\b/i, key: 'auto_nvidia', name: 'Nvidia', keywords: ['nvidia'] },
    { pattern: /\b(tesla)\b/i, key: 'auto_tesla', name: 'Tesla', keywords: ['tesla'] },
    
    // Countries/Regions
    { pattern: /\b(india|indian)\b/i, key: 'auto_india', name: 'India Economy', keywords: ['india', 'indian'] },
    { pattern: /\b(japan|japanese)\b/i, key: 'auto_japan', name: 'Japan Economy', keywords: ['japan', 'japanese'] },
    { pattern: /\b(europe|european|eu)\b/i, key: 'auto_europe', name: 'European Economy', keywords: ['europe', 'european', 'eu'] },
    { pattern: /\b(mexico|mexican)\b/i, key: 'auto_mexico', name: 'Mexico Economy', keywords: ['mexico', 'mexican'] },
    { pattern: /\b(brazil|brazilian)\b/i, key: 'auto_brazil', name: 'Brazil Economy', keywords: ['brazil', 'brazilian'] },
    
    // Topics
    { pattern: /\b(immigration|immigrant|migrants)\b/i, key: 'auto_immigration', name: 'Immigration', name_ar: 'الهجرة', keywords: ['immigration', 'immigrant', 'migrants'] },
    { pattern: /\b(inflation)\b/i, key: 'auto_inflation', name: 'Inflation', name_ar: 'التضخم', keywords: ['inflation'] },
    { pattern: /\b(interest rate|fed rate)\b/i, key: 'auto_interest_rates', name: 'Interest Rates', name_ar: 'أسعار الفائدة', keywords: ['interest rate', 'fed rate'] },
    { pattern: /\b(crypto|bitcoin|ethereum)\b/i, key: 'auto_crypto', name: 'Cryptocurrency', name_ar: 'العملات الرقمية', keywords: ['crypto', 'bitcoin', 'ethereum'] },
    { pattern: /\b(oil|petroleum|opec)\b/i, key: 'auto_oil', name: 'Oil & Energy', name_ar: 'النفط والطاقة', keywords: ['oil', 'petroleum', 'opec'] },
    
    // Arabic patterns
    { pattern: /الهجرة|المهاجرين/i, key: 'auto_immigration', name: 'Immigration', name_ar: 'الهجرة', keywords: ['الهجرة', 'المهاجرين', 'immigration'] },
    { pattern: /التضخم/i, key: 'auto_inflation', name: 'Inflation', name_ar: 'التضخم', keywords: ['التضخم', 'inflation'] },
    { pattern: /النفط|البترول|أوبك/i, key: 'auto_oil', name: 'Oil & Energy', name_ar: 'النفط والطاقة', keywords: ['النفط', 'البترول', 'أوبك', 'oil'] },
  ];

  for (const { pattern, key, name, name_ar, keywords } of patterns) {
    if (pattern.test(title)) {
      // Avoid duplicates
      if (!topics.find(t => t.key === key)) {
        topics.push({ key, name, name_ar, keywords });
      }
    }
  }

  return topics;
}

// ============================================
// UPDATE CLUSTER STATISTICS
// ============================================
async function updateClusterStats(showId) {
  const { data: clusters } = await supabase
    .from('topic_clusters')
    .select('id')
    .eq('show_id', showId);

  for (const cluster of clusters || []) {
    const { count: signalCount } = await supabase
      .from('cluster_items')
      .select('id', { count: 'exact', head: true })
      .eq('cluster_id', cluster.id)
      .eq('source_type', 'signal');

    const { count: intelCount } = await supabase
      .from('cluster_items')
      .select('id', { count: 'exact', head: true })
      .eq('cluster_id', cluster.id)
      .eq('source_type', 'intel');

    const { data: latestItem } = await supabase
      .from('cluster_items')
      .select('item_date')
      .eq('cluster_id', cluster.id)
      .order('item_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const totalCount = (signalCount || 0) + (intelCount || 0);
    const trendScore = Math.min(100, totalCount * 15);

    let suggestedFormat = 'short';
    if (totalCount >= 5) suggestedFormat = 'long';
    else if (totalCount >= 3) suggestedFormat = 'medium';

    await supabase
      .from('topic_clusters')
      .update({
        signal_count: signalCount || 0,
        intel_count: intelCount || 0,
        trend_score: trendScore,
        is_trending: totalCount >= 3,
        suggested_format: suggestedFormat,
        last_signal_at: latestItem?.item_date || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', cluster.id);
  }

  console.log('📊 Updated cluster statistics');
}

// ============================================
// HELPER: Check if text is Arabic
// ============================================
function isArabic(text) {
  return /[\u0600-\u06FF]/.test(text);
}

// ============================================
// CLUSTER INTEL RECOMMENDATIONS
// ============================================
export async function autoClusterIntel(showId) {
  console.log('🧠 Starting intel clustering for show:', showId);
  
  const results = { processed: 0, clustered: 0 };

  try {
    // 1. Get keywords
    const { data: keywords } = await supabase
      .from('cluster_keywords')
      .select('cluster_key, keyword, language, weight')
      .eq('show_id', showId);

    if (!keywords || keywords.length === 0) {
      console.log('⚠️ No cluster keywords found for show:', showId);
      return results;
    }

    // 2. Get clusters
    const { data: clusters } = await supabase
      .from('topic_clusters')
      .select('id, cluster_key')
      .eq('show_id', showId);

    const clusterMap = new Map(clusters?.map(c => [c.cluster_key, c.id]) || []);

    // 3. Get unclustered intel (last 30 days)
    const { data: intel } = await supabase
      .from('intelligence_recommendations')
      .select('id, topic, suggested_angle, created_at')
      .eq('show_id', showId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (!intel || intel.length === 0) {
      console.log('📊 No intel recommendations found');
      return results;
    }

    // 4. Get already clustered intel IDs
    const { data: existingItems } = await supabase
      .from('cluster_items')
      .select('recommendation_id')
      .not('recommendation_id', 'is', null);

    const clusteredIds = new Set(existingItems?.map(i => i.recommendation_id).filter(Boolean) || []);
    const unclusteredIntel = intel?.filter(i => !clusteredIds.has(i.id)) || [];

    console.log(`📊 Found ${unclusteredIntel.length} unclustered intel`);
    results.processed = unclusteredIntel.length;

    if (unclusteredIntel.length === 0) {
      return results;
    }

    // 5. Match each intel to clusters
    const itemsToInsert = [];

    for (const item of unclusteredIntel) {
      const text = `${item.topic} ${item.suggested_angle || ''}`.toLowerCase();
      const matches = findMatchingClusters(text, keywords);

      if (matches.length > 0) {
        for (const match of matches) {
          const clusterId = clusterMap.get(match.cluster_key);
          if (clusterId) {
            itemsToInsert.push({
              cluster_id: clusterId,
              recommendation_id: item.id,
              source_type: 'intel',
              title: item.topic,
              relevance_score: match.score,
              item_date: item.created_at
            });
          }
        }
        results.clustered++;
      }
    }

    // 6. Insert items (check for duplicates by title)
    if (itemsToInsert.length > 0) {
      const insertedCount = await insertClusterItems(itemsToInsert, supabase);
      results.clustered = insertedCount;
    }

    // 7. Update stats
    await updateClusterStats(showId);

    console.log('✅ Intel clustering complete:', results);
    return results;

  } catch (error) {
    console.error('❌ Intel clustering error:', error);
    throw error;
  }
}

// ============================================
// CLUSTER BOTH SIGNALS AND INTEL
// ============================================
export async function autoClusterAll(showId) {
  console.log('🔄 Starting full clustering (signals + intel) for show:', showId);
  
  try {
    const signalResults = await autoClusterSignals(showId);
    const intelResults = await autoClusterIntel(showId);
    
    return {
      signals: signalResults,
      intel: intelResults,
      total: {
        processed: (signalResults.processed || 0) + (intelResults.processed || 0),
        clustered: (signalResults.clustered || 0) + (intelResults.clustered || 0)
      }
    };
  } catch (error) {
    console.error('❌ Full clustering error:', error);
    throw error;
  }
}

export { updateClusterStats };

