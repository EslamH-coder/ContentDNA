import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function PUT(request) {
  try {
    const body = await request.json();
    const { signalId, status } = body;

    console.log('Update signal status request:', { signalId, status, signalIdType: typeof signalId });

    if (!signalId || !status) {
      return NextResponse.json(
        { error: 'signalId and status are required' }, 
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['new', 'liked', 'rejected', 'saved', 'produced', 'reviewed', 'approved'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}` }, 
        { status: 400 }
      );
    }

    // Convert signalId to number if it's a string (since id is BIGSERIAL)
    const idToUse = typeof signalId === 'string' && !isNaN(signalId) 
      ? parseInt(signalId, 10) 
      : signalId;

    console.log('Updating signal with ID:', idToUse);

    const { data, error } = await supabase
      .from('signals')
      .update({ 
        status
      })
      .eq('id', idToUse)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Signal not found' }, 
        { status: 404 }
      );
    }

    console.log('Signal updated successfully:', data.id);

    return NextResponse.json({ 
      success: true, 
      signal: data 
    });

  } catch (error) {
    console.error('Update signal status error:', error);
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    );
  }
}
