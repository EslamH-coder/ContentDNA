/**
 * ON-DEMAND PITCH GENERATION API
 * Generates pitch (title, hook, angle, points) only when user clicks button
 * This is the ONLY place Claude is called for pitch generation
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { generatePitch } from '@/lib/ai/claudePitcher.js';

const db = supabaseAdmin || supabase;

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { type = 'long' } = body; // 'long' or 'short'

    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    // Fetch signal from database
    const { data: signal, error: fetchError } = await db
      .from('signals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !signal) {
      return NextResponse.json(
        { error: 'Signal not found' },
        { status: 404 }
      );
    }

    // Build evidence from signal data
    const evidence = {
      hasEvidence: true,
      searchEvidence: signal.raw_data?.searchEvidence || null,
      competitorEvidence: signal.raw_data?.competitorEvidence || null,
      audienceEvidence: signal.raw_data?.audienceEvidence || null,
      behaviorAnalysis: signal.raw_data?.recommendation?.behavior_analysis || signal.raw_data?.behavior_analysis || null,
      personaMatch: signal.raw_data?.personaMatch || null
    };

    // Generate pitch using Claude
    const pitchResult = await generatePitch(
      signal.title,  // Use original RSS title
      evidence,
      { format: type }
    );

    if (!pitchResult.success) {
      return NextResponse.json(
        { error: pitchResult.error || 'Failed to generate pitch' },
        { status: 500 }
      );
    }

    // Optionally save pitch to signal (update raw_data)
    const updatedRawData = {
      ...signal.raw_data,
      recommendation: {
        ...signal.raw_data?.recommendation,
        pitch: pitchResult.pitch,
        pitch_generated: true,
        pitch_type: type,
        pitch_generated_at: new Date().toISOString()
      }
    };

    // Update signal with generated pitch
    const { error: updateError } = await db
      .from('signals')
      .update({
        raw_data: updatedRawData
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error saving pitch to signal:', updateError);
      // Don't fail - pitch was generated, just couldn't save it
    }

    return NextResponse.json({
      success: true,
      pitch: pitchResult.pitch,
      signalId: id,
      type: type
    });

  } catch (error) {
    console.error('Error generating pitch:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate pitch' },
      { status: 500 }
    );
  }
}




