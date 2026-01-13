/**
 * APPROVE SIGNAL API
 * Records approval and updates persona tracking
 */

import { NextResponse } from 'next/server';
import { recordApproval } from '@/lib/personas/personaTracker.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { signalId, personaId, topicTitle } = await request.json();
    
    console.log('📝 Approve request:', { signalId, personaId, topicTitle });
    
    if (!signalId || !personaId) {
      return NextResponse.json(
        { success: false, error: 'signalId and personaId are required' },
        { status: 400 }
      );
    }
    
    // 1. Update signal status in database (optional - might already be updated)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { error: dbError } = await supabase
          .from('signals')
          .update({ 
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_persona: personaId
          })
          .eq('id', signalId);
        
        if (dbError) {
          console.error('Database update error:', dbError);
          // Continue even if DB update fails
        } else {
          console.log('✅ Database updated');
        }
      } catch (dbErr) {
        console.warn('Database update failed (continuing anyway):', dbErr.message);
      }
    } else {
      console.warn('Supabase not configured, skipping database update');
    }
    
    // 2. Record in persona tracking (THIS IS THE KEY!)
    try {
      const trackingResult = await recordApproval(signalId, personaId, topicTitle || 'Unknown');
      
      if (!trackingResult) {
        console.warn('Persona tracking returned false');
        return NextResponse.json({
          success: false,
          error: 'Failed to record approval in persona tracker'
        }, { status: 500 });
      }
      
      console.log('✅ Persona tracking successful');
    } catch (trackError) {
      console.error('Persona tracking error:', trackError);
      console.error('Stack:', trackError.stack);
      return NextResponse.json({
        success: false,
        error: 'Persona tracking failed: ' + trackError.message
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true,
      message: `Approved for ${personaId}`
    });
    
  } catch (error) {
    console.error('Approval error:', error);
    console.error('Stack:', error.stack);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

