/**
 * COMPETITOR VIDEOS DIAGNOSTIC API
 * 
 * GET /api/diagnostics/competitors?showId=xxx
 * 
 * Returns detailed diagnostic information about why competitor videos might be empty
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';
import { diagnoseCompetitorVideos } from '@/lib/diagnostics/competitorDiagnostics';

export async function GET(request) {
  try {
    // Verify authentication
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get showId from query params
    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');

    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    // Verify user has access to this show
    const hasAccess = await verifyShowAccess(showId, user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Run diagnostic
    console.log(`\n🔍 Running competitor videos diagnostic for show: ${showId}`);
    const results = await diagnoseCompetitorVideos(showId);

    return NextResponse.json({
      success: true,
      diagnostic: results
    });

  } catch (error) {
    console.error('Error running competitor diagnostic:', error);
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
