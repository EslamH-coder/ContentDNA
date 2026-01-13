import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  
  console.log('=== YouTube OAuth Callback ===');
  console.log('Code:', code ? 'received' : 'missing');
  console.log('State:', state);
  console.log('Error:', error);
  
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(`/onboarding?error=${error}`);
  }
  
  if (!code) {
    console.error('No code received');
    return NextResponse.redirect('/onboarding?error=no_code');
  }
  
  try {
    // Dynamic imports to catch missing packages
    const { google } = await import('googleapis');
    const { createClient } = await import('@supabase/supabase-js');
    
    console.log('Creating OAuth client...');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    console.log('Getting tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Tokens received:', tokens ? 'yes' : 'no');
    
    oauth2Client.setCredentials(tokens);
    
    console.log('Getting channel info...');
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const channelResponse = await youtube.channels.list({
      part: 'snippet,statistics,contentDetails',
      mine: true
    });
    
    const channelInfo = channelResponse.data.items?.[0];
    console.log('Channel:', channelInfo?.snippet?.title);
    
    if (!channelInfo) {
      throw new Error('No channel found for this account');
    }
    
    console.log('Saving to database...');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: account, error: dbError } = await supabase
      .from('youtube_accounts')
      .upsert({
        channel_id: channelInfo.id,
        channel_title: channelInfo.snippet.title,
        channel_thumbnail: channelInfo.snippet.thumbnails?.default?.url,
        channel_description: channelInfo.snippet.description?.substring(0, 500),
        subscriber_count: parseInt(channelInfo.statistics?.subscriberCount || 0),
        video_count: parseInt(channelInfo.statistics?.videoCount || 0),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        scopes: tokens.scope?.split(' ') || [],
        connected_at: new Date().toISOString(),
        status: 'active'
      }, { onConflict: 'channel_id' })
      .select()
      .single();
    
    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }
    
    console.log('Account saved:', account.id);
    
    // If we have a showId in state, link it
    if (state && state !== 'null' && state !== '') {
      await supabase
        .from('shows')
        .update({ 
          youtube_account_id: account.id, 
          onboarding_status: 'connecting' 
        })
        .eq('id', state);
    }
    
    const redirectUrl = `/onboarding?success=true&channelId=${channelInfo.id}&accountId=${account.id}${state ? `&showId=${state}` : ''}`;
    console.log('Redirecting to:', redirectUrl);
    
    return NextResponse.redirect(new URL(redirectUrl, request.url));
    
  } catch (err) {
    console.error('=== Callback Error ===');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    
    return NextResponse.redirect(
      new URL(`/onboarding?error=${encodeURIComponent(err.message)}`, request.url)
    );
  }
}

