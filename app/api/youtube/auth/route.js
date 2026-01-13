import { getAuthUrl } from '@/lib/youtube/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('showId') || '';
  const authUrl = getAuthUrl(showId);
  return NextResponse.json({ authUrl });
}



