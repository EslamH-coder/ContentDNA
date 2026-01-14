import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    // CLUSTERS DISABLED: Temporarily disabled to focus on signal quality improvements
    return NextResponse.json({ 
      success: false, 
      error: 'Clusters temporarily disabled - focusing on signal quality'
    }, { status: 503 });

    const { showId, clusterName, signalIds } = await request.json();
    
    if (!showId || !clusterName || !signalIds || signalIds.length === 0) {
      return NextResponse.json({ 
        error: 'showId, clusterName, and signalIds are required' 
      }, { status: 400 });
    }

    // Generate cluster key from name
    const clusterKey = `manual_${clusterName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}_${Date.now()}`;

    // 1. Create the cluster
    const { data: newCluster, error: clusterError } = await supabase
      .from('topic_clusters')
      .insert({
        show_id: showId,
        cluster_key: clusterKey,
        cluster_name: clusterName,
        cluster_name_ar: clusterName, // Can be updated later
        is_auto_created: false, // Manual creation
        is_active: true
      })
      .select()
      .single();

    if (clusterError) {
      console.error('❌ Error creating cluster:', clusterError);
      return NextResponse.json({ 
        error: 'Failed to create cluster: ' + clusterError.message 
      }, { status: 500 });
    }

    // 2. Get signal details
    const { data: signals } = await supabase
      .from('signals')
      .select('id, title, url, created_at')
      .in('id', signalIds)
      .eq('show_id', showId);

    if (!signals || signals.length === 0) {
      // Delete the cluster if no signals found
      await supabase
        .from('topic_clusters')
        .delete()
        .eq('id', newCluster.id);
      
      return NextResponse.json({ 
        error: 'No signals found with provided IDs' 
      }, { status: 400 });
    }

    // 3. Extract keywords from signal titles
    const keywords = new Set();
    signals.forEach(s => {
      const words = s.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      words.forEach(w => keywords.add(w));
    });

    // 4. Add keywords to cluster_keywords
    if (keywords.size > 0) {
      const keywordInserts = Array.from(keywords).slice(0, 10).map(kw => ({
        show_id: showId,
        cluster_key: clusterKey,
        keyword: kw,
        language: /[\u0600-\u06FF]/.test(kw) ? 'ar' : 'en',
        weight: 1.0
      }));

      await supabase
        .from('cluster_keywords')
        .upsert(keywordInserts, { onConflict: 'show_id,cluster_key,keyword' });
    }

    // 5. Move signals from uncategorized to new cluster
    const itemInserts = signals.map(s => ({
      cluster_id: newCluster.id,
      signal_id: s.id,
      source_type: 'signal',
      title: s.title,
      url: s.url,
      relevance_score: 1.0,
      item_date: s.created_at
    }));

    const { error: itemsError } = await supabase
      .from('cluster_items')
      .upsert(itemInserts, { onConflict: 'signal_id,cluster_id' });

    if (itemsError) {
      console.error('❌ Error moving signals to cluster:', itemsError);
      return NextResponse.json({ 
        error: 'Failed to move signals: ' + itemsError.message 
      }, { status: 500 });
    }

    // 6. Remove signals from uncategorized cluster
    const { data: uncatCluster } = await supabase
      .from('topic_clusters')
      .select('id')
      .eq('show_id', showId)
      .eq('cluster_key', 'uncategorized')
      .maybeSingle();

    if (uncatCluster) {
      await supabase
        .from('cluster_items')
        .delete()
        .eq('cluster_id', uncatCluster.id)
        .in('signal_id', signalIds);
    }

    // 7. Update cluster statistics
    const { count: signalCount } = await supabase
      .from('cluster_items')
      .select('id', { count: 'exact', head: true })
      .eq('cluster_id', newCluster.id)
      .eq('source_type', 'signal');

    await supabase
      .from('topic_clusters')
      .update({
        signal_count: signalCount || 0,
        trend_score: Math.min(100, (signalCount || 0) * 15),
        is_trending: (signalCount || 0) >= 3,
        suggested_format: (signalCount || 0) >= 5 ? 'long' : (signalCount || 0) >= 3 ? 'medium' : 'short',
        updated_at: new Date().toISOString()
      })
      .eq('id', newCluster.id);

    console.log(`✅ Created cluster "${clusterName}" with ${signals.length} signals`);

    return NextResponse.json({
      success: true,
      cluster: newCluster,
      signals_moved: signals.length
    });

  } catch (error) {
    console.error('❌ Error creating cluster:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create cluster' 
    }, { status: 500 });
  }
}



