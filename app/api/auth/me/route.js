import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';

export async function GET(request) {
  try {
    const { user } = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
      }
    });

  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
