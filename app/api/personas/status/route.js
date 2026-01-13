/**
 * PERSONA STATUS API
 * Returns current week's persona serving status
 */

import { NextResponse } from 'next/server';
import { getPersonaStatus, getUnderservedPersonas } from '@/lib/personas/personaTracker.js';

export async function GET() {
  try {
    const status = await getPersonaStatus();
    const underserved = await getUnderservedPersonas();
    
    return NextResponse.json({
      success: true,
      ...status,
      underserved,
      alerts: generateAlerts(underserved)
    });
    
  } catch (error) {
    console.error('Persona status error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

function generateAlerts(underserved) {
  const alerts = [];
  
  for (const persona of underserved) {
    if (persona.percentage === 0) {
      alerts.push({
        level: 'critical',
        message: `⚠️ ${persona.id} لم يتم خدمته هذا الأسبوع!`
      });
    } else if (persona.percentage < 50) {
      alerts.push({
        level: 'warning',
        message: `${persona.id} يحتاج ${persona.remaining} فيديوهات إضافية`
      });
    }
  }
  
  return alerts;
}




