import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { clusterSignals } from '@/lib/clustering/clusterEngine';
import { verifyShowAccess } from '@/lib/apiShowAccess';
import { loadTopics, getTopicCluster } from '@/lib/taxonomy/unifiedTaxonomyService';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    // CLUSTERS DISABLED: Temporarily disabled to focus on signal quality improvements
    // TODO: Re-enable after signals are working properly
    console.log('⚠️ Clusters API disabled - returning empty array');
    return NextResponse.json({ 
      success: true, 
      clusters: [],
      message: 'Clusters temporarily disabled - focusing on signal quality'
    });

    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');

    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    // First check if topic_clusters table exists and has data
    const { data: clusters, error } = await supabaseAdmin
      .from('topic_clusters')
      .select(`
        *,
        items:cluster_items(
          id,
          signal_id,
          recommendation_id,
          source_type,
          title,
          url,
          relevance_score,
          detected_angle,
          item_date
        )
      `)
      .eq('show_id', showId)
      .eq('is_active', true)
      .order('trend_score', { ascending: false });

    if (error) {
      // If table doesn't exist, try to generate clusters from signals (DNA-based)
      console.log('Clusters table error, generating from signals:', error);
      return await generateClustersFromSignals(showId);
    }

    // If no clusters, generate them (DNA-based)
    if (!clusters || clusters.length === 0) {
      return await generateClustersFromSignals(showId);
    }

    // Fetch DNA data for clusters (pass supabaseAdmin for database queries)
    let clustersWithDNA = await enrichClustersWithDNA(clusters, showId, supabaseAdmin);

    // Apply DNA topic learning weights (by topic_id) to cluster ranking
    const { data: learning } = await supabaseAdmin
      .from('show_learning_weights')
      .select('dna_topic_weights')
      .eq('show_id', showId)
      .maybeSingle();

    const dnaWeights = learning?.dna_topic_weights || {};

    const rankedClusters = (clustersWithDNA || []).map(cluster => {
      const topicId = cluster.topic_id || cluster.cluster_key;
      const topicData = topicId ? dnaWeights[topicId] : null;
      const weight = topicData?.weight || 1.0;
      const baseScore = cluster.trend_score || 50;

      return {
        ...cluster,
        learning_weight: weight,
        learning_stats: topicData ? {
          liked: topicData.liked || 0,
          rejected: topicData.rejected || 0,
          total: topicData.total || 0
        } : null,
        display_score: Math.round(baseScore * weight)
      };
    });

    rankedClusters.sort((a, b) => (b.display_score || 0) - (a.display_score || 0));

    return NextResponse.json({ 
      success: true, 
      clusters: rankedClusters 
    });

  } catch (error) {
    console.error('Clusters error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Generate clusters from signals based on DNA topic_definitions only
async function generateClustersFromSignals(showId) {
  try {
    // 1. Get DNA topics for this show
    const { data: dnaTopics, error: dnaError } = await supabaseAdmin
      .from('topic_definitions')
      .select('topic_id, topic_name_en, topic_name_ar, keywords')
      .eq('show_id', showId)
      .eq('is_active', true);

    if (dnaError) throw dnaError;

    const topicMap = {};
    for (const t of dnaTopics || []) {
      if (t.topic_id) {
        topicMap[t.topic_id] = t;
      }
    }

    // 2. Get active, non-rejected signals
    const { data: signals, error } = await supabaseAdmin
      .from('signals')
      .select('id, title, url, matched_topic, category, relevance_score, score, is_active, status')
      .eq('show_id', showId)
      .eq('is_visible', true)
      .neq('status', 'rejected')
      .order('relevance_score', { ascending: false });

    if (error) throw error;

    if (!signals || signals.length === 0) {
      return NextResponse.json({ 
        success: true, 
        clusters: [],
        message: 'No signals to cluster'
      });
    }

    // 3. Group signals by DNA topic (fallback to other_stories)
    const grouped = {};
    
    for (const signal of signals) {
      let topicId = (signal.matched_topic || '').toString();
      if (!topicId || !topicMap[topicId]) {
        topicId = 'other_stories';
      }
      
      if (!grouped[topicId]) {
        const def = topicMap[topicId] || {};
        const nameEn = def.topic_name_en || (topicId === 'other_stories' ? 'Other Stories' : topicId);
        const nameAr = def.topic_name_ar || nameEn;

        grouped[topicId] = {
          id: topicId,
          cluster_key: topicId,
          name: nameEn,
          emoji: getTopicEmoji(nameEn),
          signal_count: 0,
          intel_count: 0,
          trend_score: 0,
          items: [],
          suggested_format: 'long',
          topic_id: topicId
        };
      }
      
      const cluster = grouped[topicId];
      const score = signal.relevance_score || signal.score || 50;
      cluster.signal_count += 1;
      cluster.trend_score += score;
      cluster.items.push({
        id: signal.id,
        signal_id: signal.id,
        source_type: 'signal',
        title: signal.title,
        url: signal.url,
        relevance_score: score
      });
    }

    // 4. Convert to array and calculate averages
    const clusters = Object.values(grouped)
      .map(cluster => ({
        ...cluster,
        trend_score: cluster.signal_count > 0 
          ? Math.round(cluster.trend_score / cluster.signal_count) 
          : 0
      }))
      .filter(c => c.signal_count >= 1)
      .sort((a, b) => b.trend_score - a.trend_score)
      .slice(0, 20); // Top 20 clusters

    return NextResponse.json({ 
      success: true, 
      clusters,
      generated: true
    });

  } catch (error) {
    console.error('Generate clusters error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getTopicEmoji(topic) {
  const emojiMap = {
    'politics': '🏛️',
    'economy': '💰',
    'technology': '💻',
    'sports': '⚽',
    'entertainment': '🎬',
    'science': '🔬',
    'health': '🏥',
    'war': '⚔️',
    'conflict': '💥',
    'business': '📈',
    'News': '📰',
    'General': '📋'
  };
  
  // Check for Arabic topics
  if (topic.includes('سياس')) return '🏛️';
  if (topic.includes('اقتصاد')) return '💰';
  if (topic.includes('رياض')) return '⚽';
  if (topic.includes('تقن') || topic.includes('تكنولوج')) return '💻';
  if (topic.includes('حرب') || topic.includes('صراع')) return '⚔️';
  if (topic.includes('سيارات')) return '🚗';
  
  return emojiMap[topic] || '🔥';
}

// Enrich clusters with DNA data
async function enrichClustersWithDNA(clusters, showId, supabase) {
  try {
    // Use unified taxonomy service to load topics (single source of truth)
    const { loadTopics } = await import('@/lib/taxonomy/unifiedTaxonomyService');
    const dnaTopics = await loadTopics(showId, supabase);
    
    if (!dnaTopics || dnaTopics.length === 0) {
      console.log('⚠️ No DNA topics found for show:', showId);
      // Return clusters with empty DNA data
      return clusters.map(cluster => ({
        ...cluster,
        dna: {
          status: 'new',
          success_rate: 0,
          avg_views: 0
        }
      }));
    }

    console.log(`📊 Found ${dnaTopics.length} DNA topics for enrichment`);
    console.log('DNA topics:', dnaTopics.map(t => ({ topic_id: t.topic_id, topic_name_en: t.topic_name_en })));
    
    // Get cluster keywords for better matching
    const clusterIds = clusters.map(c => c.id).filter(Boolean);
    let clusterKeywordsMap = new Map();
    
    if (clusterIds.length > 0 && supabase) {
      const { data: keywords } = await supabase
        .from('cluster_keywords')
        .select('cluster_key, keyword')
        .in('cluster_key', clusters.map(c => c.cluster_key).filter(Boolean));
      
      if (keywords) {
        keywords.forEach(kw => {
          const key = kw.cluster_key;
          if (!clusterKeywordsMap.has(key)) {
            clusterKeywordsMap.set(key, []);
          }
          clusterKeywordsMap.get(key).push(kw.keyword.toLowerCase());
        });
      }
    }
    
    // Topic keywords mapping (same as in contentDNA/index.js)
    const topicKeywords = {
      'missiles_air_defense': ['صواريخ', 'دفاع جوي', 'missiles', 'defense'],
      'us_china_geopolitics': ['أمريكا', 'الصين', 'ترامب', 'china', 'usa', 'trump', 'باي', 'بايدن'],
      'yemen_red_sea_trade': ['اليمن', 'البحر الأحمر', 'الحوثي', 'yemen', 'red sea'],
      'arms_industry_exports': ['سلاح', 'تسليح', 'عسكري', 'arms', 'weapons'],
      'intelligence_ops': ['استخبارات', 'تجسس', 'cia', 'موساد'],
      'big_tech_platforms': ['فيسبوك', 'جوجل', 'تيك توك', 'meta', 'google', 'facebook'],
      'nuclear_programs': ['نووي', 'nuclear', 'ذري'],
      'currency_devaluation': ['دولار', 'عملة', 'تضخم', 'currency', 'اقتصاد']
    };
    
    // Map cluster topics to DNA topics
    return clusters.map(cluster => {
      // Try to match cluster topic to DNA topic
      const clusterTopic = cluster.cluster_name || cluster.cluster_name_ar || cluster.cluster_key || '';
      const clusterTopicLower = clusterTopic.toLowerCase().trim();
      
      // Get cluster keywords
      const clusterKeywords = clusterKeywordsMap.get(cluster.cluster_key) || [];
      const allClusterText = [clusterTopicLower, ...clusterKeywords].join(' ');
      
      console.log(`🔍 Matching cluster: "${clusterTopic}" (${cluster.cluster_key}), keywords:`, clusterKeywords);
      
      // First, try to match by topic_id directly (cluster_key should match topic_id)
      let matchingDnaTopic = dnaTopics.find(t => {
        const topicId = (t.topic_id || '').toString().toLowerCase().trim();
        const clusterKey = (cluster.cluster_key || '').toString().toLowerCase().trim();
        return topicId === clusterKey || 
               topicId === clusterTopicLower || 
               clusterTopicLower.includes(topicId) ||
               topicId.includes(clusterTopicLower);
      });
      
      // If no direct match, try keyword-based matching using topic keywords
      if (!matchingDnaTopic) {
        // Check each DNA topic's keywords against cluster text
        for (const dnaTopic of dnaTopics) {
          const topicKeywords = dnaTopic.allKeywords || dnaTopic.keywords || [];
          const hasMatch = topicKeywords.some(kw => {
            if (!kw || typeof kw !== 'string') return false;
            const kwLower = kw.toLowerCase().trim();
            return allClusterText.includes(kwLower) || clusterTopicLower.includes(kwLower);
          });
          
          if (hasMatch) {
            matchingDnaTopic = dnaTopic;
            console.log(`  ✓ Matched cluster "${clusterTopic}" to DNA topic "${dnaTopic.topic_id}" via keywords`);
            break;
          }
        }
      }

      if (matchingDnaTopic) {
        // Get performance stats from topic_definitions
        const matchCount = matchingDnaTopic.match_count || 0;
        const likedCount = matchingDnaTopic.liked_count || 0;
        const producedCount = matchingDnaTopic.produced_count || 0;
        const successRate = matchCount > 0 
          ? Math.round((likedCount + producedCount) / matchCount * 100)
          : 0;
        const avgViews = matchingDnaTopic.performance_stats?.avgViews || 0;
        
        // Determine status based on success rate
        let status = 'new';
        if (successRate >= 70) {
          status = 'strong';
        } else if (successRate >= 50) {
          status = 'moderate';
        } else if (successRate > 0) {
          status = 'weak';
        }

        console.log(`✅ Matched cluster "${clusterTopic}" (${cluster.cluster_key}) to DNA topic ${matchingDnaTopic.topic_id}:`, { status, successRate, avgViews });

        return {
          ...cluster,
          dna: {
            status,
            success_rate: successRate,
            avg_views: avgViews
          }
        };
      }

      // No DNA match found - return empty DNA data (don't use average as fallback)
      console.log(`⚠️ No DNA match for cluster "${clusterTopic}" (${cluster.cluster_key}) - checked ${dnaTopics.length} DNA topics`);
      return {
        ...cluster,
        dna: {
          status: 'new',
          success_rate: 0,
          avg_views: 0
        }
      };
    });
  } catch (error) {
    console.error('❌ Error enriching clusters with DNA:', error);
    return clusters; // Return clusters without DNA on error
  }
}

export async function POST(request) {
  try {
    // CLUSTERS DISABLED: Temporarily disabled to focus on signal quality improvements
    // TODO: Re-enable after signals are working properly
    console.log('⚠️ Clusters POST API disabled - returning empty array');
    return NextResponse.json({ 
      success: true, 
      clusters: [],
      message: 'Clusters temporarily disabled - focusing on signal quality'
    });

    // Verify user is authenticated
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { showId, show_id, force = false } = body;
    const finalShowId = showId || show_id;
    
    if (!finalShowId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    // Verify user has access to this show
      const { authorized, error: accessError } = await verifyShowAccess(finalShowId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    console.log(`🔄 Regenerating clusters for show ${finalShowId}...`);

    // Step 1: Try to use clusterEngine for keyword-based clustering (if keywords exist)
    try {
      const { clusterSignals } = await import('@/lib/clustering/clusterEngine');
      const result = await clusterSignals(finalShowId);
      console.log(`✅ Clustered ${result.clustered || 0} new signals using clusterEngine`);
    } catch (clusterError) {
      console.log('⚠️ clusterEngine not available or failed, using topic-based grouping:', clusterError.message);
    }

    // Step 2: Regenerate all clusters from signals (group by matched_topic)
    // This ensures all signals are included in clusters, not just unclustered ones
    const { data: signals, error: signalsError } = await supabaseAdmin
      .from('signals')
      .select('*')
      .eq('show_id', finalShowId)
      .eq('is_visible', true)
      .neq('status', 'rejected') // Exclude rejected signals when regenerating clusters
      .order('relevance_score', { ascending: false });

    if (signalsError) throw signalsError;

    if (!signals || signals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No signals to cluster',
        clusters: []
      });
    }

    console.log(`📊 Regenerating clusters from ${signals.length} signals...`);

    // Load DNA topics for this show
    const { data: dnaTopics, error: dnaError } = await supabaseAdmin
      .from('topic_definitions')
      .select('topic_id, topic_name_en, topic_name_ar, keywords')
      .eq('show_id', finalShowId)
      .eq('is_active', true);

    if (dnaError) throw dnaError;

    const topicMap = {};
    for (const t of dnaTopics || []) {
      if (t.topic_id) {
        topicMap[t.topic_id] = t;
      }
    }

    // Group signals by DNA topic (fallback to other_stories)
    const grouped = {};
    
    for (const signal of signals) {
      let topicId = (signal.matched_topic || '').toString();
      if (!topicId || !topicMap[topicId]) {
        topicId = 'other_stories';
      }
      
      if (!grouped[topicId]) {
        const def = topicMap[topicId] || {};
        const nameEn = def.topic_name_en || (topicId === 'other_stories' ? 'Other Stories' : topicId);
        const nameAr = def.topic_name_ar || nameEn;

        grouped[topicId] = {
          cluster_key: topicId,
          cluster_name: nameEn,
          cluster_name_ar: nameAr,
          signal_count: 0,
          intel_count: 0,
          trend_score: 0,
          items: [],
          topic_id: topicId
        };
      }
      
      const cluster = grouped[topicId];
      const score = signal.relevance_score || signal.score || 50;
      cluster.signal_count++;
      cluster.trend_score += score;
      cluster.items.push({
        signal_id: signal.id,
        source_type: 'signal',
        title: signal.title,
        url: signal.url,
        relevance_score: score
      });
    }

    // Update or create clusters in database
    const clusterUpdates = [];
    
    for (const [topic, data] of Object.entries(grouped)) {
      const clusterKey = topic;
      
      // Check if cluster exists
      const { data: existing } = await supabaseAdmin
        .from('topic_clusters')
        .select('id')
        .eq('show_id', finalShowId)
        .eq('cluster_key', clusterKey)
        .maybeSingle();

      const clusterData = {
        show_id: finalShowId,
        cluster_key: clusterKey,
        topic_id: data.topic_id,
        cluster_name: data.cluster_name,
        cluster_name_ar: data.cluster_name_ar,
        signal_count: data.signal_count,
        intel_count: data.intel_count,
        trend_score: data.signal_count > 0 ? Math.round(data.trend_score / data.signal_count) : 0,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      let clusterId;

      if (existing) {
        // Update existing cluster
        const { data: updated } = await supabaseAdmin
          .from('topic_clusters')
          .update(clusterData)
          .eq('id', existing.id)
          .select()
          .single();
        
        clusterId = existing.id;
        clusterUpdates.push(updated);
      } else {
        // Create new cluster
        const { data: newCluster } = await supabaseAdmin
          .from('topic_clusters')
          .insert(clusterData)
          .select()
          .single();

        clusterId = newCluster?.id;
        clusterUpdates.push(newCluster);
      }

      // Update cluster_items: delete old items and insert current ones
      if (clusterId && data.items.length > 0) {
        // Delete existing items for this cluster
        await supabaseAdmin
          .from('cluster_items')
          .delete()
          .eq('cluster_id', clusterId);

        // Insert current items
        const itemsToInsert = data.items.map(item => ({
          cluster_id: clusterId,
          signal_id: item.signal_id,
          source_type: item.source_type,
          title: item.title,
          url: item.url,
          relevance_score: item.relevance_score
        }));

        const { error: itemsError } = await supabaseAdmin
          .from('cluster_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error(`Error inserting items for cluster ${clusterKey}:`, itemsError);
        } else {
          console.log(`✅ Updated cluster "${clusterKey}" with ${itemsToInsert.length} items`);
        }
      }
    }

    console.log(`✅ Regenerated ${clusterUpdates.length} clusters`);

    // Fetch updated clusters with DNA enrichment
    const { data: updatedClusters } = await supabaseAdmin
      .from('topic_clusters')
      .select(`
        *,
        items:cluster_items(
          id,
          signal_id,
          recommendation_id,
          source_type,
          title,
          url,
          relevance_score,
          detected_angle,
          item_date
        )
      `)
      .eq('show_id', finalShowId)
      .eq('is_active', true)
      .order('trend_score', { ascending: false });

    const clustersWithDNA = await enrichClustersWithDNA(updatedClusters || [], finalShowId, supabaseAdmin);

    return NextResponse.json({
      success: true,
      message: `Regenerated ${clusterUpdates.length} clusters`,
      clusters: clustersWithDNA || [],
      clustersUpdated: clusterUpdates.length
    });

  } catch (error) {
    console.error('❌ Regenerate clusters error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
