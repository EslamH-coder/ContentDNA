/**
 * SIGNAL PROCESSING API
 * V4.1: Fast filter + pitch generation
 */

import { NextResponse } from 'next/server';
import { processSignal, processAllSignals } from '@/lib/ai/processSignals.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { signal, signals, format = 'long' } = body;
    
    // Single signal
    if (signal) {
      const result = await processSignal(signal, { format });
      return NextResponse.json(result);
    }
    
    // Multiple signals
    if (signals && Array.isArray(signals)) {
      const results = await processAllSignals(signals, { format });
      return NextResponse.json(results);
    }
    
    return NextResponse.json(
      { error: 'Provide signal or signals array' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Signal processing error:', error);
    console.error('Stack:', error.stack);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}




