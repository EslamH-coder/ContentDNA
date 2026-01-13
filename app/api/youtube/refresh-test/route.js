import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('showId') || '59dd9aef-bc59-4f79-b944-b8a345cf71c3';

  try {
    // 1. Get show's youtube_account_id
    const { data: show } = await supabase
      .from('shows')
      .select('youtube_account_id')
      .eq('id', showId)
      .single();

    if (!show?.youtube_account_id) {
      return NextResponse.json({ error: 'No YouTube account linked' }, { status: 400 });
    }

    // 2. Get YouTube credentials
    const { data: ytAccount } = await supabase
      .from('youtube_accounts')
      .select('*')
      .eq('id', show.youtube_account_id)
      .single();

    if (!ytAccount) {
      return NextResponse.json({ error: 'YouTube account not found' }, { status: 400 });
    }

    // 3. Check environment variables
    const envCheck = {
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
      clientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...',
    };

    // 4. Setup OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: ytAccount.refresh_token,
    });

    // 5. Try to refresh
    let refreshResult = null;
    let refreshError = null;

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      refreshResult = {
        success: true,
        newAccessToken: credentials.access_token?.substring(0, 20) + '...',
        expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null
      };

      // Save new token
      await supabase
        .from('youtube_accounts')
        .update({ 
          access_token: credentials.access_token,
          token_expires_at: new Date(credentials.expiry_date).toISOString()
        })
        .eq('id', show.youtube_account_id);

      refreshResult.saved = true;

    } catch (err) {
      refreshError = {
        message: err.message,
        code: err.code,
        details: err.response?.data || null
      };
    }

    return NextResponse.json({
      envCheck,
      ytAccount: {
        id: ytAccount.id,
        channel_id: ytAccount.channel_id,
        channel_title: ytAccount.channel_title,
        hasAccessToken: !!ytAccount.access_token,
        hasRefreshToken: !!ytAccount.refresh_token,
        refreshTokenPrefix: ytAccount.refresh_token?.substring(0, 20) + '...',
        tokenExpiresAt: ytAccount.token_expires_at,
        status: ytAccount.status
      },
      refreshResult,
      refreshError
    });

  } catch (error) {
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

