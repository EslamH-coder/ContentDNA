/**
 * COMPETITOR VIDEOS DIAGNOSTIC TOOL
 * 
 * Investigates why competitor videos might be empty
 * Run this to diagnose competitor video loading issues
 */

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Run full diagnostic for a show
 */
export async function diagnoseCompetitorVideos(showId) {
  console.log('\n🔍 ===== COMPETITOR VIDEOS DIAGNOSTIC =====');
  console.log(`Show ID: ${showId}\n`);

  const results = {
    showId,
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // ============================================
  // CHECK 1: Are competitors configured for this show?
  // ============================================
  console.log('📋 CHECK 1: Competitors configured for show...');
  
  // First, check if is_active column exists
  let hasIsActiveColumn = false;
  try {
    const { data: columnCheck } = await supabaseAdmin
      .from('competitors')
      .select('is_active')
      .limit(1);
    hasIsActiveColumn = columnCheck !== null; // If query succeeds, column exists
  } catch (e) {
    // Column doesn't exist or other error
    hasIsActiveColumn = false;
  }
  
  // Select columns (conditionally include is_active)
  const selectColumns = hasIsActiveColumn 
    ? 'id, name, type, youtube_channel_id, show_id, is_active'
    : 'id, name, type, youtube_channel_id, show_id';
  
  const { data: showCompetitors, error: competitorsError } = await supabaseAdmin
    .from('competitors')
    .select(selectColumns)
    .eq('show_id', showId);

  if (competitorsError) {
    results.checks.competitorsConfigured = {
      status: 'ERROR',
      error: competitorsError.message,
      count: 0,
      hint: 'Check if competitors table exists and has correct structure'
    };
    console.log(`   ❌ ERROR: ${competitorsError.message}`);
  } else {
    // Filter by is_active only if column exists
    const activeCompetitors = hasIsActiveColumn
      ? showCompetitors?.filter(c => c.is_active !== false) || []
      : showCompetitors || []; // If no is_active column, use all competitors
    
    results.checks.competitorsConfigured = {
      status: activeCompetitors.length > 0 ? 'PASS' : 'FAIL',
      count: activeCompetitors.length,
      total: showCompetitors?.length || 0,
      hasIsActiveColumn,
      competitors: activeCompetitors.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        youtube_channel_id: c.youtube_channel_id,
        is_active: c.is_active // May be undefined if column doesn't exist
      }))
    };
    
    if (activeCompetitors.length === 0) {
      console.log(`   ❌ FAIL: No competitors configured for this show`);
      if (showCompetitors?.length > 0 && hasIsActiveColumn) {
        console.log(`   Total competitors (including inactive): ${showCompetitors.length}`);
      }
    } else {
      console.log(`   ✅ PASS: ${activeCompetitors.length} competitor(s) configured`);
      if (!hasIsActiveColumn) {
        console.log(`   ℹ️ Note: is_active column not found, showing all competitors`);
      }
      activeCompetitors.forEach(c => {
        console.log(`      - ${c.name} (${c.type}) - ID: ${c.id}, YouTube: ${c.youtube_channel_id || 'N/A'}`);
      });
    }
  }

  // ============================================
  // CHECK 2: Do competitor videos exist in database?
  // ============================================
  console.log('\n📋 CHECK 2: Competitor videos in database...');
  const competitorIds = showCompetitors?.map(c => c.id) || [];
  
  // Declare allVideos at function scope so it's available for CHECK 4
  let allVideos = null;
  
  if (competitorIds.length === 0) {
    results.checks.videosInDatabase = {
      status: 'SKIP',
      reason: 'No competitors configured',
      count: 0
    };
    console.log(`   ⏭️ SKIP: No competitors to check`);
  } else {
    // Check ALL videos (no date filter)
    const { data: videosData, error: allVideosError } = await supabaseAdmin
      .from('competitor_videos')
      .select('id, title, published_at, views, competitor_id')
      .in('competitor_id', competitorIds);
    
    allVideos = videosData; // Assign to outer scope variable

    if (allVideosError) {
      results.checks.videosInDatabase = {
        status: 'ERROR',
        error: allVideosError.message,
        count: 0
      };
      console.log(`   ❌ ERROR: ${allVideosError.message}`);
      allVideos = null; // Ensure it's null on error
    } else {
      const totalVideos = allVideos?.length || 0;
      results.checks.videosInDatabase = {
        status: totalVideos > 0 ? 'PASS' : 'FAIL',
        count: totalVideos,
        byCompetitor: {}
      };

      // Group by competitor
      for (const competitorId of competitorIds) {
        const competitor = showCompetitors?.find(c => c.id === competitorId);
        const videosForCompetitor = allVideos?.filter(v => v.competitor_id === competitorId) || [];
        results.checks.videosInDatabase.byCompetitor[competitorId] = {
          name: competitor?.name || 'Unknown',
          count: videosForCompetitor.length,
          latestVideo: videosForCompetitor.length > 0
            ? {
                title: videosForCompetitor[0].title,
                published_at: videosForCompetitor[0].published_at
              }
            : null
        };
      }

      if (totalVideos === 0) {
        console.log(`   ❌ FAIL: No competitor videos found in database`);
        console.log(`   Checked ${competitorIds.length} competitor(s)`);
      } else {
        console.log(`   ✅ PASS: ${totalVideos} total competitor video(s) found`);
        Object.entries(results.checks.videosInDatabase.byCompetitor).forEach(([id, data]) => {
          console.log(`      - ${data.name}: ${data.count} video(s)`);
          if (data.latestVideo) {
            console.log(`        Latest: "${data.latestVideo.title?.substring(0, 50)}..." (${data.latestVideo.published_at})`);
          }
        });
      }
    }
  }

  // ============================================
  // CHECK 3: Are there videos in the last 7 days?
  // ============================================
  console.log('\n📋 CHECK 3: Videos in last 7 days...');
  if (competitorIds.length === 0) {
    results.checks.videosLast7Days = {
      status: 'SKIP',
      reason: 'No competitors configured',
      count: 0
    };
    console.log(`   ⏭️ SKIP: No competitors to check`);
  } else {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentVideos, error: recentError } = await supabaseAdmin
      .from('competitor_videos')
      .select('id, title, published_at, views, competitor_id, competitors!inner(id, name, type)')
      .in('competitor_id', competitorIds)
      .gte('published_at', sevenDaysAgo)
      .order('views', { ascending: false })
      .limit(200);

    if (recentError) {
      results.checks.videosLast7Days = {
        status: 'ERROR',
        error: recentError.message,
        count: 0
      };
      console.log(`   ❌ ERROR: ${recentError.message}`);
    } else {
      const recentCount = recentVideos?.length || 0;
      results.checks.videosLast7Days = {
        status: recentCount > 0 ? 'PASS' : 'FAIL',
        count: recentCount,
        cutoffDate: sevenDaysAgo,
        sampleVideos: recentVideos?.slice(0, 5).map(v => ({
          title: v.title,
          published_at: v.published_at,
          views: v.views,
          competitor: v.competitors?.name || 'Unknown'
        })) || []
      };

      if (recentCount === 0) {
        console.log(`   ❌ FAIL: No videos in last 7 days (since ${sevenDaysAgo})`);
        console.log(`   This is the query used in /api/signals/route.js`);
      } else {
        console.log(`   ✅ PASS: ${recentCount} video(s) in last 7 days`);
        console.log(`   Sample videos:`);
        recentVideos?.slice(0, 3).forEach(v => {
          console.log(`      - "${v.title?.substring(0, 50)}..." (${v.competitors?.name || 'Unknown'}, ${v.published_at})`);
        });
      }
    }
  }

  // ============================================
  // CHECK 4: Check published_at field format
  // ============================================
  console.log('\n📋 CHECK 4: Checking published_at field format...');
  if (competitorIds.length === 0 || !allVideos || allVideos.length === 0) {
    results.checks.publishedAtFormat = {
      status: 'SKIP',
      reason: 'No videos to check'
    };
    console.log(`   ⏭️ SKIP: No videos to check`);
  } else {
    const sampleVideos = allVideos.slice(0, 5);
    const dateFormats = sampleVideos.map(v => ({
      id: v.id,
      published_at: v.published_at,
      type: typeof v.published_at,
      isDate: v.published_at instanceof Date,
      isString: typeof v.published_at === 'string',
      canParse: v.published_at ? !isNaN(new Date(v.published_at).getTime()) : false
    }));

    results.checks.publishedAtFormat = {
      status: 'INFO',
      samples: dateFormats
    };

    console.log(`   Sample published_at values:`);
    dateFormats.forEach(f => {
      console.log(`      - Video ${f.id}: "${f.published_at}" (${f.type}, parseable: ${f.canParse})`);
    });

    // Check if dates are in the future (data issue)
    const futureDates = allVideos.filter(v => {
      if (!v.published_at) return false;
      const date = new Date(v.published_at);
      return date > new Date();
    });

    if (futureDates.length > 0) {
      results.checks.publishedAtFormat.hasFutureDates = true;
      results.checks.publishedAtFormat.futureDatesCount = futureDates.length;
      console.log(`   ⚠️ WARNING: ${futureDates.length} video(s) have future dates (data quality issue)`);
    }
  }

  // ============================================
  // CHECK 5: Check if join with competitors table works
  // ============================================
  console.log('\n📋 CHECK 5: Testing join with competitors table...');
  if (competitorIds.length === 0) {
    results.checks.joinTest = {
      status: 'SKIP',
      reason: 'No competitors configured'
    };
    console.log(`   ⏭️ SKIP: No competitors to check`);
  } else {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: joinedVideos, error: joinError } = await supabaseAdmin
      .from('competitor_videos')
      .select(`
        *,
        competitors!inner (
          id,
          name,
          youtube_channel_id,
          show_id,
          type
        )
      `)
      .in('competitor_id', competitorIds)
      .gte('published_at', sevenDaysAgo)
      .limit(10);

    if (joinError) {
      results.checks.joinTest = {
        status: 'ERROR',
        error: joinError.message,
        hint: joinError.message.includes('foreign key') 
          ? 'Foreign key relationship might be broken'
          : 'Check table relationships in Supabase'
      };
      console.log(`   ❌ ERROR: ${joinError.message}`);
    } else {
      const joinedCount = joinedVideos?.length || 0;
      results.checks.joinTest = {
        status: joinedCount > 0 ? 'PASS' : 'FAIL',
        count: joinedCount,
        sample: joinedVideos?.slice(0, 2).map(v => ({
          videoTitle: v.title,
          competitorName: v.competitors?.name,
          competitorType: v.competitors?.type
        })) || []
      };

      if (joinedCount === 0) {
        console.log(`   ❌ FAIL: Join query returned 0 results`);
        console.log(`   This is the exact query used in /api/signals/route.js`);
      } else {
        console.log(`   ✅ PASS: Join query works, returned ${joinedCount} result(s)`);
        joinedVideos?.slice(0, 2).forEach(v => {
          console.log(`      - "${v.title?.substring(0, 40)}..." → ${v.competitors?.name} (${v.competitors?.type})`);
        });
      }
    }
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n📊 ===== DIAGNOSTIC SUMMARY =====');
  
  const issues = [];
  if (results.checks.competitorsConfigured?.status === 'FAIL') {
    issues.push('❌ No competitors configured for this show');
  }
  if (results.checks.videosInDatabase?.status === 'FAIL') {
    issues.push('❌ No competitor videos in database (competitors exist but no videos)');
  }
  if (results.checks.videosLast7Days?.status === 'FAIL') {
    issues.push('❌ No videos in last 7 days (videos exist but too old)');
  }
  if (results.checks.joinTest?.status === 'ERROR') {
    issues.push(`❌ Join query failed: ${results.checks.joinTest.error}`);
  }

  if (issues.length === 0) {
    console.log('✅ All checks passed! Competitor videos should be loading correctly.');
    console.log(`   Found ${results.checks.videosLast7Days?.count || 0} videos in last 7 days`);
  } else {
    console.log('⚠️ Issues found:');
    issues.forEach(issue => console.log(`   ${issue}`));
    console.log('\n💡 RECOMMENDATIONS:');
    if (results.checks.competitorsConfigured?.status === 'FAIL') {
      console.log('   1. Add competitors in the Competitors page (/competitors)');
    }
    if (results.checks.videosInDatabase?.status === 'FAIL') {
      console.log('   2. Check if competitor video sync job is running');
      console.log('   3. Verify YouTube channel IDs are correct in competitors table');
    }
    if (results.checks.videosLast7Days?.status === 'FAIL' && results.checks.videosInDatabase?.count > 0) {
      console.log('   4. Videos exist but are older than 7 days');
      console.log('   5. Consider increasing the time window or checking sync frequency');
    }
    if (results.checks.joinTest?.status === 'ERROR') {
      console.log('   6. Check foreign key relationship between competitor_videos and competitors tables');
    }
  }

  console.log('=====================================\n');

  return results;
}
