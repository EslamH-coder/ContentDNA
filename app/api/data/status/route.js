/**
 * DATA STATUS API
 */

import { NextResponse } from 'next/server';
import { loadUnifiedData } from '@/lib/data/dataImporter.js';

// GET /api/data/status
export async function GET(request) {
  try {
    const data = await loadUnifiedData();
    
    const status = {
      hasData: !!data,
      lastImported: data?.importedAt,
      available: {
        videos: data?.videos?.length || 0,
        comments: data?.comments?.length || 0,
        otherChannels: data?.audience?.otherChannels?.length || 0,
        otherVideos: data?.audience?.otherVideos?.length || 0,
        demographics: !!data?.audience?.demographics,
        searchTerms: data?.searchTerms?.terms?.length || 0,
        competitors: data?.competitors?.length || 0
      },
      missing: []
    };
    
    // Check what's missing
    if (!status.available.otherChannels) status.missing.push('audience_other_channels.json');
    if (!status.available.otherVideos) status.missing.push('audience_other_videos.json');
    if (!status.available.comments) status.missing.push('comments.json');
    if (!status.available.videos) status.missing.push('video_performance.json/csv');
    
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Data status API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}




