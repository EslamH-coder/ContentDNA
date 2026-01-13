import { getAuthUser } from './supabaseServer';

/**
 * Verify user has access to the requested show
 * Use this in API routes before processing requests
 * 
 * @param {string} showId - The show ID to check access for
 * @param {Request} request - The request object (optional, for Authorization header)
 */
export async function verifyShowAccess(showId, request = null) {
  if (!showId) {
    return { authorized: false, error: 'show_id is required', user: null };
  }

  // Get authenticated user (this will check Authorization header first)
  const { user, error: userError, supabase } = await getAuthUser(request);
  
  if (userError || !user || !supabase) {
    return { authorized: false, error: userError || 'Not authenticated', user: null };
  }

  // Check if user has access to this show via user_shows table
  let access, accessError;
  try {
    const result = await supabase
      .from('user_shows')
      .select('role')
      .eq('user_id', user.id)
      .eq('show_id', showId)
      .single();
    
    access = result.data;
    accessError = result.error;
  } catch (fetchError) {
    console.error('❌ Exception during verifyShowAccess query:', fetchError);
    console.error('   Error type:', fetchError?.constructor?.name);
    console.error('   Error message:', fetchError?.message);
    console.error('   Error stack:', fetchError?.stack);
    // Re-throw to be caught by outer handler
    throw fetchError;
  }

  // If table doesn't exist, allow access (backward compatibility during migration)
  if (accessError && (accessError.code === 'PGRST116' || accessError.message?.includes('relation') || accessError.message?.includes('does not exist'))) {
    console.warn('user_shows table not found, allowing access for backward compatibility');
    return { authorized: true, role: 'owner', user, error: null };
  }

  if (accessError || !access) {
    return { authorized: false, error: 'Access denied to this show', user };
  }

  return { authorized: true, role: access.role, user, error: null };
}

