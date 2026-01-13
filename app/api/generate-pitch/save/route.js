import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { pitchId } = await request.json();

    if (!pitchId) {
      return NextResponse.json({ 
        success: false, 
        error: 'pitchId is required' 
      }, { status: 400 });
    }

    // Update the pitch to mark it as saved
    const { data: updatedPitch, error } = await supabase
      .from('generated_pitches')
      .update({
        is_saved: true,
        saved_at: new Date().toISOString()
      })
      .eq('id', pitchId)
      .select()
      .single();

    if (error) {
      console.error('Error saving pitch:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      pitch: updatedPitch,
      message: 'Pitch saved successfully'
    });

  } catch (error) {
    console.error('Error in save pitch route:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to save pitch' 
    }, { status: 500 });
  }
}
