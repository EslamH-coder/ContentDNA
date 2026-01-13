/**
 * PERSONA API ROUTES
 */

import { NextResponse } from 'next/server';
import { 
  matchNewsToPersona, 
  matchBatchToPersonas,
  getServingStatus,
  getPersonaSuggestions,
  trackPersonaServing
} from '@/lib/personas/personaEngine.js';

import {
  getCompetitorPitches,
  getPitchesForPersona,
  generateWeeklyPitchReport,
  getAdjacentInspiration
} from '@/lib/personas/competitorPitching.js';

import {
  analyzeYouTubeData,
  suggestNewPersona,
  getGrowthSignals
} from '@/lib/personas/growthMonitor.js';

import { PERSONAS } from '@/lib/personas/personaDefinitions.js';

// GET /api/personas
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';
  
  try {
    switch (action) {
      case 'list':
        return NextResponse.json({ success: true, personas: PERSONAS });
        
      case 'serving-status':
        const status = await getServingStatus();
        return NextResponse.json(status);
        
      case 'suggestions':
        const suggestions = await getPersonaSuggestions();
        return NextResponse.json({ success: true, suggestions });
        
      case 'pitches':
        const personaId = searchParams.get('persona_id');
        const pitches = personaId 
          ? await getPitchesForPersona(personaId)
          : await getCompetitorPitches();
        return NextResponse.json({ success: true, pitches });
        
      case 'pitch-report':
        const report = await generateWeeklyPitchReport();
        return NextResponse.json(report);
        
      case 'adjacent-inspiration':
        const inspiration = await getAdjacentInspiration();
        return NextResponse.json({ success: true, inspiration });
        
      case 'growth-signals':
        const signals = await getGrowthSignals();
        return NextResponse.json({ success: true, signals });
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Persona API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/personas
export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case 'match':
        const { newsItem } = body;
        const match = matchNewsToPersona(newsItem);
        return NextResponse.json({ success: true, match });
        
      case 'match-batch':
        const { newsItems } = body;
        const results = matchBatchToPersonas(newsItems);
        return NextResponse.json({ success: true, ...results });
        
      case 'track-serving':
        const { personaId, topic, published } = body;
        const entry = await trackPersonaServing(personaId, topic, published);
        return NextResponse.json({ success: true, entry });
        
      case 'analyze-youtube':
        const { youtubeData } = body;
        const signals = await analyzeYouTubeData(youtubeData);
        const newPersonaSuggestions = suggestNewPersona(signals);
        return NextResponse.json({ 
          success: true, 
          signals,
          newPersonaSuggestions
        });
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Persona API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

