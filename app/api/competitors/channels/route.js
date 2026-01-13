import { NextResponse } from 'next/server';
import {
  addChannel,
  getChannels,
  updateChannel,
  deleteChannel,
  toggleChannelMonitor,
  getDashboardStats
} from '@/lib/competitors/competitorStore.js';

/**
 * GET - Get all channels (with optional filters)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const monitor = searchParams.get('monitor');
    
    const filter = {};
    if (type) filter.type = type;
    if (monitor !== null) filter.monitor = monitor === 'true';
    
    const channels = await getChannels(filter);
    
    return NextResponse.json({
      success: true,
      channels
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Add a new channel
 */
export async function POST(request) {
  try {
    const body = await request.json();
    
    const channel = await addChannel({
      url: body.url,
      name: body.name,
      type: body.type || 'direct_competitor',
      subType: body.subType,
      formatType: body.formatType,
      language: body.language || 'ar',
      notes: body.notes,
      reasonToWatch: body.reasonToWatch,
      learnFrom: body.learnFrom || [],
      monitor: body.monitor !== false,
      priority: body.priority || 'medium'
    });
    
    return NextResponse.json({
      success: true,
      channel
    });
  } catch (error) {
    console.error('Error adding channel:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}

/**
 * PUT - Update a channel
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Channel ID is required' },
        { status: 400 }
      );
    }
    
    const channel = await updateChannel(id, updates);
    
    return NextResponse.json({
      success: true,
      channel
    });
  } catch (error) {
    console.error('Error updating channel:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}

/**
 * DELETE - Delete a channel
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Channel ID is required' },
        { status: 400 }
      );
    }
    
    await deleteChannel(id);
    
    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting channel:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}




