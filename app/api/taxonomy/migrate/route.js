/**
 * Migration API Route
 * Migrates legacy show_dna.topics to topic_definitions
 * 
 * POST /api/taxonomy/migrate
 * Body: { showId: string }
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';
import { migrateFromShowDna } from '@/lib/taxonomy/unifiedTaxonomyService';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { showId } = await request.json();
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    console.log('🔄 Starting migration from show_dna.topics to topic_definitions for show:', showId);

    // Run migration
    await migrateFromShowDna(showId, supabaseAdmin);

    return NextResponse.json({ 
      success: true,
      message: 'Migration completed successfully'
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
