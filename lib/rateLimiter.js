import { createServerSupabaseClient } from './supabaseServer';

// Daily limits per user
const LIMITS = {
  pitch: 20,      // AI pitch generation
  refresh: 10,    // Signal refresh with enrichment
  sync: 5,        // Competitor video sync
  reddit: 1,      // Reddit fetch (1 per day - free but we don't want spam)
};

/**
 * Check if user has quota remaining for an action
 * @param {string} userId - User ID
 * @param {string} action - 'pitch' | 'refresh' | 'sync'
 * @returns {object} { allowed: boolean, remaining: number, limit: number }
 */
export async function checkQuota(userId, action) {
  if (!userId || !action) {
    return { allowed: false, remaining: 0, limit: 0, error: 'Missing userId or action' };
  }

  const limit = LIMITS[action];
  if (!limit) {
    return { allowed: true, remaining: 999, limit: 999 }; // Unknown action, allow
  }

  const supabase = createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  // Get or create today's usage record
  let { data: usage, error } = await supabase
    .from('usage_quotas')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (error && error.code === 'PGRST116') {
    // No record for today, create one
    const { data: newUsage, error: insertError } = await supabase
      .from('usage_quotas')
      .insert({ user_id: userId, date: today })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Rate limiter - Failed to create usage record:', insertError);
      return { allowed: true, remaining: limit, limit }; // Allow on error
    }
    usage = newUsage;
  }

  const countField = `${action}_count`;
  const currentCount = usage?.[countField] || 0;
  const remaining = Math.max(0, limit - currentCount);

  console.log(`📊 Rate limit check: ${action} - ${currentCount}/${limit} used, ${remaining} remaining`);

  return {
    allowed: currentCount < limit,
    remaining,
    limit,
    used: currentCount,
  };
}

/**
 * Increment usage counter for an action
 * @param {string} userId - User ID
 * @param {string} action - 'pitch' | 'refresh' | 'sync'
 * @param {number} tokensUsed - Optional tokens used (for AI calls)
 */
export async function incrementUsage(userId, action, tokensUsed = 0) {
  console.log('📊 incrementUsage called with:', { userId, action, tokensUsed });
  
  if (!userId || !action) {
    console.error('📊 incrementUsage - Missing userId or action', { userId: !!userId, action });
    return;
  }

  const supabase = createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  const countField = `${action}_count`;

  console.log(`📊 Looking for record: user=${userId}, date=${today}, field=${countField}`);

  // Get existing record
  const { data: existing, error: fetchError } = await supabase
    .from('usage_quotas')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  console.log('📊 Existing record:', existing ? JSON.stringify(existing, null, 2) : 'null');
  console.log('📊 Fetch error:', fetchError ? {
    message: fetchError.message,
    code: fetchError.code,
    details: fetchError.details,
    hint: fetchError.hint
  } : 'none');

  if (existing) {
    // Update existing record
    const currentCount = existing[countField] || 0;
    const newCount = currentCount + 1;
    const currentTokens = existing.tokens_used || 0;
    const newTokens = currentTokens + tokensUsed;
    
    console.log(`📊 Updating existing record:`);
    console.log(`   - ${countField}: ${currentCount} → ${newCount}`);
    console.log(`   - tokens_used: ${currentTokens} → ${newTokens}`);
    console.log(`   - Record ID: ${existing.id}`);
    
    const updateData = {
      [countField]: newCount,
      tokens_used: newTokens,
      updated_at: new Date().toISOString()
    };
    
    console.log('📊 Update data:', JSON.stringify(updateData, null, 2));
    
    const { data: updated, error: updateError } = await supabase
      .from('usage_quotas')
      .update(updateData)
      .eq('id', existing.id)
      .select();

    console.log('📊 Update result:', updated ? JSON.stringify(updated, null, 2) : 'null');
    console.log('📊 Update error:', updateError ? {
      message: updateError.message,
      code: updateError.code,
      details: updateError.details,
      hint: updateError.hint
    } : 'none');
    
    if (updateError) {
      console.error('❌ Failed to update usage:', updateError);
      // Try RPC as fallback
      console.log('📊 Attempting RPC fallback...');
      await tryRpcIncrement(supabase, userId, today, countField, tokensUsed);
    } else {
      console.log(`✅ Successfully updated ${countField} to ${newCount} for user ${userId}`);
      if (updated && updated.length > 0) {
        console.log(`✅ Verified: Record now has ${countField} = ${updated[0][countField]}`);
      } else {
        console.warn('⚠️ Update succeeded but no data returned. Verifying with separate query...');
        // Verify with a separate query
        const { data: verified, error: verifyError } = await supabase
          .from('usage_quotas')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .single();
        
        if (verifyError) {
          console.error('❌ Verification query failed:', verifyError);
        } else {
          console.log(`📊 Verification: Current ${countField} = ${verified[countField] || 0}`);
          if (verified[countField] !== newCount) {
            console.error(`❌ MISMATCH: Expected ${countField} = ${newCount}, but database has ${verified[countField]}`);
          } else {
            console.log(`✅ Verification passed: ${countField} = ${newCount}`);
          }
        }
      }
    }
  } else {
    // Insert new record
    console.log('📊 No existing record found, inserting new one');
    
    const insertData = {
      user_id: userId,
      date: today,
      [countField]: 1,
      tokens_used: tokensUsed,
    };
    
    console.log('📊 Insert data:', JSON.stringify(insertData, null, 2));
    
    const { data: inserted, error: insertError } = await supabase
      .from('usage_quotas')
      .insert(insertData)
      .select();

    console.log('📊 Insert result:', inserted ? JSON.stringify(inserted, null, 2) : 'null');
    console.log('📊 Insert error:', insertError ? {
      message: insertError.message,
      code: insertError.code,
      details: insertError.details,
      hint: insertError.hint
    } : 'none');
    
    if (insertError) {
      console.error('❌ Failed to insert usage:', insertError);
      // Try RPC as fallback
      console.log('📊 Attempting RPC fallback...');
      await tryRpcIncrement(supabase, userId, today, countField, tokensUsed);
    } else {
      console.log(`✅ Successfully created new usage record with ${countField} = 1 for user ${userId}`);
      if (inserted && inserted.length > 0) {
        console.log(`✅ Verified: New record has ${countField} = ${inserted[0][countField]}`);
      } else {
        console.warn('⚠️ Insert succeeded but no data returned. Verifying with separate query...');
        // Verify with a separate query
        const { data: verified, error: verifyError } = await supabase
          .from('usage_quotas')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .single();
        
        if (verifyError) {
          console.error('❌ Verification query failed:', verifyError);
        } else {
          console.log(`📊 Verification: Current ${countField} = ${verified[countField] || 0}`);
          if (verified[countField] !== 1) {
            console.error(`❌ MISMATCH: Expected ${countField} = 1, but database has ${verified[countField]}`);
          } else {
            console.log(`✅ Verification passed: ${countField} = 1`);
          }
        }
      }
    }
  }
  
  console.log('📊 incrementUsage function completed');
}

/**
 * Fallback: Try RPC function for atomic increment
 */
async function tryRpcIncrement(supabase, userId, today, countField, tokensUsed) {
  try {
    console.log('📊 Trying RPC increment_usage as fallback...');
    const { error: rpcError } = await supabase.rpc('increment_usage', {
      p_user_id: userId,
      p_date: today,
      p_field: countField,
      p_tokens: tokensUsed,
    });

    if (rpcError) {
      console.error('📊 RPC increment_usage also failed:', rpcError);
    } else {
      console.log('✅ RPC increment_usage succeeded');
    }
  } catch (rpcErr) {
    console.error('📊 RPC call exception:', rpcErr);
  }
}

/**
 * Get user's current usage for today
 */
export async function getUsage(userId) {
  const supabase = createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: usage } = await supabase
    .from('usage_quotas')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  return {
    pitch: { used: usage?.pitch_count || 0, limit: LIMITS.pitch },
    refresh: { used: usage?.refresh_count || 0, limit: LIMITS.refresh },
    sync: { used: usage?.sync_count || 0, limit: LIMITS.sync },
    reddit: { used: usage?.reddit_count || 0, limit: LIMITS.reddit },
    tokens: usage?.tokens_used || 0,
  };
}

