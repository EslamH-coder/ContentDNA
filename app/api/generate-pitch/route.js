import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { checkQuota, incrementUsage } from '@/lib/rateLimiter';
import { buildSystemPrompt, buildUserPrompt, buildShortFormPrompt } from '@/lib/pitchTemplates';

export async function POST(request) {
  try {
    const { user, supabase } = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { signalId, showId, pitchType = 'auto', forceRegenerate = false } = body;
    
    if (!signalId || !showId) {
      return NextResponse.json({ error: 'signalId and showId required' }, { status: 400 });
    }

    // Check for existing pitch (unless force regenerate)
    if (!forceRegenerate) {
      try {
        const { data: existingPitch, error: fetchError } = await supabase
          .from('pitches')
          .select('*')
          .eq('signal_id', signalId)
          .maybeSingle();

        // If table doesn't exist, fetchError will be set - that's okay, we'll create it
        if (!fetchError && existingPitch) {
          console.log('📄 Returning cached pitch');
          return NextResponse.json({
            success: true,
            pitch: existingPitch.content,
            pitchType: existingPitch.pitch_type,
            cached: true,
            createdAt: existingPitch.created_at,
          });
        }
      } catch (error) {
        // Table might not exist yet - that's okay, continue to generate
        console.log('ℹ️ Pitches table check:', error.message);
      }
    }

    // Check rate limit
    const quota = await checkQuota(user.id, 'pitch');
    if (!quota.allowed) {
      return NextResponse.json({ 
        error: 'Daily limit reached',
        message: `Daily pitch limit (${quota.limit}) reached.`,
      }, { status: 429 });
    }

    console.log('✨ Generating new pitch...');

    // Get signal from database
    const { data: signal, error: signalError } = await supabase
      .from('signals')
      .select('*')
      .eq('id', signalId)
      .single();

    if (signalError || !signal) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    }

    // Get show profile
    const { data: show } = await supabase
      .from('shows')
      .select('*')
      .eq('id', showId)
      .single();

    const outputLanguage = show?.language || 'ar';
    console.log(`📺 Show: ${show?.name || 'Unknown'}, Output Language: ${outputLanguage}`);

    // Get channel DNA (topic definitions)
    const { data: topics } = await supabase
      .from('topic_definitions')
      .select('topic_name_en, topic_name_ar')
      .eq('show_id', showId)
      .limit(10);

    // Get top performing videos to learn style
    let topVideos = [];
    const { data: videos } = await supabase
      .from('channel_videos')
      .select('title, views')
      .eq('show_id', showId)
      .not('title', 'is', null)
      .order('views', { ascending: false })
      .limit(10);
    
    topVideos = videos || [];

    console.log(`📊 Learning from ${topVideos.length} top videos`);

    // Auto-detect pitch type based on signal
    let selectedType = pitchType;
    if (pitchType === 'auto') {
      selectedType = signal.is_evergreen ? 'analysis' : 'news';
      console.log(`🎯 Auto-selected: ${selectedType}`);
    }

    // Build prompts (English for AI, output in channel's language)
    let systemPrompt;
    if (selectedType === 'short') {
      systemPrompt = buildShortFormPrompt(show, outputLanguage);
    } else {
      systemPrompt = buildSystemPrompt(show, selectedType, outputLanguage);
    }
    const userPrompt = buildUserPrompt(signal, topics, topVideos, show);

    console.log('🤖 Calling AI (English prompt → ' + outputLanguage + ' output)...');

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not configured');
      return NextResponse.json({ 
        error: 'OpenAI API key not configured' 
      }, { status: 500 });
    }

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
              max_tokens: selectedType === 'short' ? 500 : 1200,
              temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }
      console.error('❌ OpenAI API error:', errorData);
      throw new Error(errorData.error?.message || 'AI service error');
    }

    const aiResponse = await response.json();
    const pitch = aiResponse.choices?.[0]?.message?.content;

    if (!pitch) {
      console.error('❌ No pitch content in AI response:', aiResponse);
      throw new Error('Failed to generate pitch content');
    }

    const tokensUsed = aiResponse.usage?.total_tokens || 0;

    // Save pitch to database (gracefully handle if table doesn't exist)
    try {
      // First try to update existing pitch, then insert if not found
      const { data: existingPitch } = await supabase
        .from('pitches')
        .select('id')
        .eq('signal_id', signalId)
        .maybeSingle();

      if (existingPitch) {
        // Update existing pitch
        const { error: updateError } = await supabase
          .from('pitches')
          .update({
            pitch_type: selectedType,
            content: pitch,
            tokens_used: tokensUsed,
            updated_at: new Date().toISOString(),
          })
          .eq('signal_id', signalId);

        if (updateError) {
          console.error('⚠️ Failed to update pitch:', updateError);
        } else {
          console.log('💾 Pitch updated in database');
        }
      } else {
        // Insert new pitch
        const { error: insertError } = await supabase
          .from('pitches')
          .insert({
            signal_id: signalId,
            show_id: showId,
            pitch_type: selectedType,
            content: pitch,
            tokens_used: tokensUsed,
          });

        if (insertError) {
          console.error('⚠️ Failed to save pitch (table may not exist):', insertError.message);
          console.log('💡 Run SQL migration to create pitches table');
        } else {
          console.log('💾 Pitch saved to database');
        }
      }
    } catch (error) {
      console.error('⚠️ Error saving pitch:', error.message);
      // Continue - pitch is still returned to user
    }

    // Increment usage
    await incrementUsage(user.id, 'pitch', tokensUsed);

    console.log(`✅ Pitch generated and saved (${selectedType}, ${tokensUsed} tokens)`);

    return NextResponse.json({
      success: true,
      pitch,
      pitchType: selectedType,
      cached: false,
      tokensUsed,
    });

  } catch (error) {
    console.error('❌ Pitch generation error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({ 
      error: error.message || 'Failed to generate pitch',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// GET - Retrieve saved pitches
export async function GET(request) {
  try {
    // Verify user is authenticated
    const { user, error: authError, supabase } = await getAuthUser(request);
    
    if (authError || !user || !supabase) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');
    const status = searchParams.get('status'); // 'saved', 'all', etc.
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }
    
    let query = supabase
      .from('generated_pitches')
      .select('*')
      .eq('show_id', showId)
      .order('created_at', { ascending: false });
    
    if (status === 'saved') {
      query = query.eq('is_saved', true);
    }
    
    const { data: pitches, error } = await query.limit(50);
    
    if (error) {
      console.error('Error fetching pitches:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, pitches });
  } catch (error) {
    console.error('Error in GET /api/generate-pitch:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

