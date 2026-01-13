import { NextResponse } from 'next/server';
import { loadDNA } from '@/lib/dna/dnaStorage.js';
import { generateDNAPrompt } from '@/lib/dna/dnaToPrompt.js';

/**
 * API Endpoint: Get current DNA as LLM prompt
 * GET /api/dna/prompt
 */
export async function GET() {
  try {
    const dna = await loadDNA();
    const prompt = generateDNAPrompt(dna);
    
    return NextResponse.json({
      success: true,
      prompt,
      metadata: dna.metadata
    });
  } catch (error) {
    console.error('Error generating DNA prompt:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate DNA prompt' },
      { status: 500 }
    );
  }
}




