import { NextResponse } from 'next/server';
import { toggleChannelMonitor } from '@/lib/competitors/competitorStore.js';

/**
 * POST - Toggle channel monitor status
 */
export async function POST(request, { params }) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Channel ID is required' },
        { status: 400 }
      );
    }
    
    const channel = await toggleChannelMonitor(id);
    
    return NextResponse.json({
      success: true,
      channel
    });
  } catch (error) {
    console.error('Error toggling channel monitor:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}




