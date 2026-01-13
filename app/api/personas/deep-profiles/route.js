/**
 * API: Get Deep Persona Profiles
 */

import { NextResponse } from 'next/server';
import { getAllEnrichedPersonas, getEnrichedPersona, getPriorityTopicsForPersona, getContentSuggestionsForPersona, getContentPriorities, getGoldenRule } from '@/lib/personas/personaProfiles.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('persona_id');
    const action = searchParams.get('action') || 'all';
    
    switch (action) {
      case 'all':
        const allPersonas = getAllEnrichedPersonas();
        return NextResponse.json({
          success: true,
          personas: allPersonas,
          total: allPersonas.length
        });
        
      case 'single':
        if (!personaId) {
          return NextResponse.json(
            { success: false, error: 'persona_id is required' },
            { status: 400 }
          );
        }
        const persona = getEnrichedPersona(personaId);
        if (!persona) {
          return NextResponse.json(
            { success: false, error: 'Persona not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          persona,
          priorityTopics: getPriorityTopicsForPersona(personaId),
          suggestions: getContentSuggestionsForPersona(personaId)
        });
        
      case 'priorities':
        return NextResponse.json({
          success: true,
          priorities: getContentPriorities(),
          goldenRule: getGoldenRule()
        });
        
      case 'suggestions':
        if (!personaId) {
          return NextResponse.json(
            { success: false, error: 'persona_id is required' },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          suggestions: getContentSuggestionsForPersona(personaId)
        });
        
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Deep profiles API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}




