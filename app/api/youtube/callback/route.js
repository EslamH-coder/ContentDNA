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
    
    // FIX: Avoid upsert to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time" error
    // This error occurs when there are duplicate channel_id entries. Use explicit update/insert instead.
    const accountData = {
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
    };
    
    // Step 1: Check for existing account(s) with this channel_id
    const { data: existingAccounts, error: checkError } = await supabase
      .from('youtube_accounts')
      .select('id, channel_id')
      .eq('channel_id', channelInfo.id);
    
    if (checkError) {
      console.error('Error checking existing accounts:', checkError);
      throw checkError;
    }
    
    let finalAccount;
    
    // Step 2: Handle duplicates - delete all but the first one
    if (existingAccounts && existingAccounts.length > 1) {
      console.warn(`⚠️ Found ${existingAccounts.length} duplicate accounts for channel_id ${channelInfo.id}. Removing duplicates...`);
      const keepId = existingAccounts[0].id;
      const deleteIds = existingAccounts.slice(1).map(a => a.id);
      
      // Delete duplicates one by one to avoid any batch issues
      for (const deleteId of deleteIds) {
        const { error: deleteError } = await supabase
          .from('youtube_accounts')
          .delete()
          .eq('id', deleteId);
        
        if (deleteError) {
          console.error(`Error deleting duplicate account ${deleteId}:`, deleteError);
        }
      }
      
      console.log(`✅ Removed ${deleteIds.length} duplicate account(s), keeping account ${keepId}`);
    }
    
    // Step 3: Update existing account or insert new one (avoid upsert to prevent conflicts)
    if (existingAccounts && existingAccounts.length > 0) {
      // Double-check: ensure we only have one account after cleanup
      const { data: recheckAccounts, error: recheckError } = await supabase
        .from('youtube_accounts')
        .select('id')
        .eq('channel_id', channelInfo.id);
      
      if (recheckError) {
        console.error('Error rechecking accounts:', recheckError);
        throw recheckError;
      }
      
      // If duplicates still exist, delete them again (one by one)
      if (recheckAccounts && recheckAccounts.length > 1) {
        console.warn(`⚠️ Still found ${recheckAccounts.length} accounts after cleanup. Removing remaining duplicates...`);
        const keepId = recheckAccounts[0].id;
        for (let i = 1; i < recheckAccounts.length; i++) {
          const { error: delError } = await supabase
            .from('youtube_accounts')
            .delete()
            .eq('id', recheckAccounts[i].id);
          
          if (delError) {
            console.error(`Error deleting duplicate ${recheckAccounts[i].id}:`, delError);
          }
        }
      }
      
      // Update the first (or only) existing account by ID (guaranteed unique)
      const existingId = existingAccounts[0].id;
      console.log(`Updating existing YouTube account ${existingId}...`);
      
      const { data: updatedAccount, error: updateError } = await supabase
        .from('youtube_accounts')
        .update(accountData)
        .eq('id', existingId) // Use ID (primary key) to ensure only one row is updated
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating account:', updateError);
        // If update fails with conflict error, try to re-fetch and update again
        if (updateError.message && updateError.message.includes('ON CONFLICT')) {
          console.log('Update conflict detected, re-fetching account and retrying...');
          const { data: retryAccount, error: retryError } = await supabase
            .from('youtube_accounts')
            .select('id')
            .eq('channel_id', channelInfo.id)
            .limit(1)
            .single();
          
          if (retryAccount && !retryError) {
            const { data: retryUpdated, error: retryUpdateError } = await supabase
              .from('youtube_accounts')
              .update(accountData)
              .eq('id', retryAccount.id)
              .select()
              .single();
            
            if (retryUpdateError) {
              throw retryUpdateError;
            }
            
            finalAccount = retryUpdated;
            console.log('✅ Account updated after retry:', finalAccount.id);
          } else {
            throw updateError;
          }
        } else {
          throw updateError;
        }
      } else {
        finalAccount = updatedAccount;
        console.log('✅ Account updated:', finalAccount.id);
      }
    } else {
      // Insert new account
      console.log('Inserting new YouTube account...');
      
      const { data: insertedAccount, error: insertError } = await supabase
        .from('youtube_accounts')
        .insert(accountData)
        .select()
        .single();
      
      if (insertError) {
        console.error('Error inserting account:', insertError);
        // If insert fails due to unique constraint (duplicate channel_id), try to find and update instead
        if (insertError.message && (insertError.message.includes('duplicate') || insertError.message.includes('unique') || insertError.message.includes('violates unique constraint'))) {
          console.log('Insert failed due to unique constraint, trying to find and update existing account...');
          const { data: foundAccount, error: findError } = await supabase
            .from('youtube_accounts')
            .select('id')
            .eq('channel_id', channelInfo.id)
            .limit(1)
            .maybeSingle();
          
          if (foundAccount && !findError) {
            console.log(`Found existing account ${foundAccount.id}, updating instead...`);
            const { data: updatedAccount, error: updateError } = await supabase
              .from('youtube_accounts')
              .update(accountData)
              .eq('id', foundAccount.id) // Use ID to ensure only one row is updated
              .select()
              .single();
            
            if (updateError) {
              console.error('Update after insert conflict also failed:', updateError);
              throw updateError;
            }
            
            finalAccount = updatedAccount;
            console.log('✅ Account updated after insert conflict:', finalAccount.id);
          } else {
            throw insertError;
          }
        } else {
          throw insertError;
        }
      } else {
        finalAccount = insertedAccount;
        console.log('✅ Account inserted:', finalAccount.id);
      }
    }
    
    if (!finalAccount) {
      throw new Error('Failed to save or retrieve YouTube account');
    }
    
    // If we have a showId in state, link it
    if (state && state !== 'null' && state !== '') {
      const { error: linkError } = await supabase
        .from('shows')
        .update({ 
          youtube_account_id: finalAccount.id, 
          onboarding_status: 'connecting' 
        })
        .eq('id', state);
      
      if (linkError) {
        console.error('Error linking show to YouTube account:', linkError);
        // Don't throw - account is saved, just linking failed
      } else {
        console.log(`✅ Linked show ${state} to YouTube account ${finalAccount.id}`);
      }
    }
    
    const redirectUrl = `/onboarding?success=true&channelId=${channelInfo.id}&accountId=${finalAccount.id}${state ? `&showId=${state}` : ''}`;
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

