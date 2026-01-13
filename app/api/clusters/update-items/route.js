import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { clusterId, signalIds, action } = await request.json();
    
    if (!clusterId || !signalIds || !Array.isArray(signalIds) || !action) {
      return NextResponse.json({ 
        error: 'clusterId, signalIds (array), and action (add/remove) are required' 
      }, { status: 400 });
    }

    if (action === 'add') {
      // Get signal details
      const { data: signals } = await supabase
        .from('signals')
        .select('id, title, url, created_at')
        .in('id', signalIds);

      if (!signals || signals.length === 0) {
        return NextResponse.json({ 
          error: 'No signals found with provided IDs' 
        }, { status: 400 });
      }

      // Get cluster to get show_id
      const { data: cluster } = await supabase
        .from('topic_clusters')
        .select('show_id')
        .eq('id', clusterId)
        .single();

      if (!cluster) {
        return NextResponse.json({ 
          error: 'Cluster not found' 
        }, { status: 404 });
      }

      // Add signals to cluster
      const itemInserts = signals.map(s => ({
        cluster_id: clusterId,
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
        console.error('❌ Error adding signals to cluster:', itemsError);
        return NextResponse.json({ 
          error: 'Failed to add signals: ' + itemsError.message 
        }, { status: 500 });
      }

      // Update cluster statistics
      const { count: signalCount } = await supabase
        .from('cluster_items')
        .select('id', { count: 'exact', head: true })
        .eq('cluster_id', clusterId)
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
        .eq('id', clusterId);

      console.log(`✅ Added ${signals.length} signals to cluster ${clusterId}`);

      return NextResponse.json({
        success: true,
        signals_added: signals.length
      });

    } else if (action === 'remove') {
      // Filter out null/undefined signal IDs
      const validSignalIds = signalIds.filter(id => id != null && id !== 'null' && id !== 'undefined' && String(id).trim() !== '');
      
      if (validSignalIds.length === 0) {
        return NextResponse.json({ 
          error: 'No valid signal IDs provided' 
        }, { status: 400 });
      }
      
      // Remove signals from cluster - try both signal_id and recommendation_id
      // Use separate queries for each field since Supabase .or() can be tricky
      const { error: deleteError1 } = await supabase
        .from('cluster_items')
        .delete()
        .eq('cluster_id', clusterId)
        .in('signal_id', validSignalIds);
      
      const { error: deleteError2 } = await supabase
        .from('cluster_items')
        .delete()
        .eq('cluster_id', clusterId)
        .in('recommendation_id', validSignalIds);

      if (deleteError1 && deleteError2) {
        console.error('❌ Error removing signals from cluster:', deleteError1, deleteError2);
        return NextResponse.json({ 
          error: 'Failed to remove signals: ' + (deleteError1.message || deleteError2.message)
        }, { status: 500 });
      }

      // Update cluster statistics
      const { count: signalCount } = await supabase
        .from('cluster_items')
        .select('id', { count: 'exact', head: true })
        .eq('cluster_id', clusterId)
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
        .eq('id', clusterId);

      console.log(`✅ Removed ${signalIds.length} signals from cluster ${clusterId}`);

      return NextResponse.json({
        success: true,
        signals_removed: signalIds.length
      });

    } else {
      return NextResponse.json({ 
        error: 'Invalid action. Use "add" or "remove"' 
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error updating cluster items:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to update cluster items' 
    }, { status: 500 });
  }
}

