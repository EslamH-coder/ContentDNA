import { getPlaylists } from '@/lib/youtube/api';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  
  if (!accountId) {
    return NextResponse.json({ error: 'accountId required' }, { status: 400 });
  }
  
  try {
    const { data: account } = await supabase
      .from('youtube_accounts')
      .select('*')
      .eq('id', accountId)
      .single();
    
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    
    const tokens = { access_token: account.access_token, refresh_token: account.refresh_token };
    const playlists = await getPlaylists(tokens, account.channel_id);
    
    return NextResponse.json({
      success: true,
      channel: {
        id: account.channel_id,
        title: account.channel_title,
        thumbnail: account.channel_thumbnail,
        videoCount: account.video_count
      },
      playlists: playlists.map(p => ({
        id: p.id,
        title: p.snippet.title,
        description: p.snippet.description?.substring(0, 200),
        thumbnail: p.snippet.thumbnails?.medium?.url,
        videoCount: p.contentDetails.itemCount
      }))
    });
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



