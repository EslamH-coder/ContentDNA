/**
 * Get shows that belong to the current user
 * Uses API endpoint to authenticate via cookies (server-side)
 */
export async function getUserShows() {
  try {
    // Use API endpoint which authenticates via cookies
    const response = await fetch('/api/shows', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { shows: [], error: 'Not authenticated' };
      }
      const errorData = await response.json().catch(() => ({}));
      return { shows: [], error: errorData.error || 'Failed to fetch shows' };
    }

    const data = await response.json();
    
    if (!data.success) {
      return { shows: [], error: data.error || 'Failed to fetch shows' };
    }

    // API returns shows with role already included
    return { 
      shows: data.shows || [], 
      error: null,
      userId: null // Not needed from API response
    };
  } catch (error) {
    console.error('Error fetching user shows:', error);
    return { shows: [], error: error.message || 'Network error' };
  }
}

/**
 * Check if user has access to a specific show
 * Uses API endpoint to authenticate via cookies (server-side)
 */
export async function userHasAccessToShow(showId) {
  if (!showId) return false;

  try {
    // Use API endpoint which authenticates via cookies
    const response = await fetch(`/api/shows?showId=${showId}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 200 = has access, 403 = no access, 401 = not authenticated
    if (response.ok) {
      return true;
    }
    
    if (response.status === 403) {
      return false;
    }
    
    // 401 or other errors - assume no access
    return false;
  } catch (error) {
    console.error('Error checking show access:', error);
    return false;
  }
}


