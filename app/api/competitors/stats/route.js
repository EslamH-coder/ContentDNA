import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/competitors/competitorStore.js';

/**
 * GET - Get dashboard statistics
 */
export async function GET(request) {
  try {
    const stats = await getDashboardStats();
    
    return NextResponse.json({
      success: true,
      ...stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}




