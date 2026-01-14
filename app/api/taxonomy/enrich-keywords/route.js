/**
 * Keyword Enrichment API
 * POST /api/taxonomy/enrich-keywords
 * 
 * Enriches topics with AI-generated keywords
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';
import { enrichTopicsWithKeywords } from '@/lib/taxonomy/keywordGenerator';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET endpoint to check current keyword counts
export async function GET(request) {
  try {
    // Verify authentication
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId') || searchParams.get('show_id');
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }
    
    const { data: topics, error } = await supabaseAdmin
      .from('topic_definitions')
      .select('topic_id, topic_name_en, keywords')
      .eq('show_id', showId)
      .eq('is_active', true)
      .order('topic_name_en');
    
    if (error) {
      console.error('Error loading topics:', error);
      return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 });
    }
    
    const stats = (topics || []).map(t => ({
      topicId: t.topic_id,
      topicName: t.topic_name_en,
      keywordCount: (t.keywords || []).length,
      needsEnrichment: (t.keywords || []).length < 10
    }));
    
    const needsEnrichment = stats.filter(s => s.needsEnrichment).length;
    
    return NextResponse.json({
      success: true,
      totalTopics: stats.length,
      needsEnrichment,
      topics: stats
    });
  } catch (error) {
    console.error('Error getting keyword stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // Verify authentication
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { showId, minKeywords } = await request.json();
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    console.log(`🔑 Enriching keywords for show ${showId}...`);
    
    const results = await enrichTopicsWithKeywords(showId, null, minKeywords || 10);
    
    const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
    const totalTopics = results.length;
    
    console.log(`✅ Keyword enrichment complete: ${totalAdded} keywords added across ${totalTopics} topics`);
    
    return NextResponse.json({
      success: true,
      message: `Added ${totalAdded} keywords across ${totalTopics} topics`,
      totalAdded,
      totalTopics,
      results
    });
  } catch (error) {
    console.error('❌ Error enriching keywords:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}
