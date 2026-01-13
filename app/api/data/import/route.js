/**
 * DATA IMPORT API
 */

import { NextResponse } from 'next/server';
import { importAllData } from '@/lib/data/dataImporter.js';

// POST /api/data/import
export async function POST(request) {
  try {
    const data = await importAllData();
    return NextResponse.json({ 
      success: true, 
      message: 'Data imported successfully',
      stats: {
        videos: data.videos?.length || 0,
        comments: data.comments?.length || 0,
        otherChannels: data.audience?.otherChannels?.length || 0,
        otherVideos: data.audience?.otherVideos?.length || 0
      }
    });
  } catch (error) {
    console.error('Data import API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}




