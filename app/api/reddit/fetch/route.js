import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';
import { checkQuota, incrementUsage } from '@/lib/rateLimiter';
import { fetchSubreddit, isSimilarTitle } from '@/lib/redditFetcher';
import { scoreEvergreenSignals } from '@/lib/scoring/evergreenScoring';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { user, error: authError } = await getAuthUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { showId } = await request.json();
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    // Verify user has access to this show
    const { authorized, error: accessError } = await verifyShowAccess(showId, request);
    
    if (!authorized) {
      return NextResponse.json({ error: accessError || 'Access denied to this show' }, { status: 403 });
    }

    // Check rate limit (1 per day)
    const quota = await checkQuota(user.id, 'reddit');
    if (!quota.allowed) {
      console.log(`🚫 Rate limit exceeded for user ${user.email}: reddit`);
      return NextResponse.json({ 
        error: 'Daily limit reached',
        message: 'You can fetch Reddit ideas once per day. Try again tomorrow!',
        remaining: 0,
        limit: quota.limit
      }, { status: 429 });
    }

    console.log('🔴 Starting Reddit fetch for show:', showId);

    // Get active Reddit sources for this show
    const { data: sources, error: sourcesError } = await supabaseAdmin
      .from('reddit_sources')
      .select('*')
      .eq('show_id', showId)
      .eq('is_active', true);

    if (sourcesError || !sources?.length) {
      return NextResponse.json({ 
        error: 'No Reddit sources configured',
        message: 'Add subreddits in Settings → Reddit Sources'
      }, { status: 404 });
    }

    console.log(`🔴 Found ${sources.length} Reddit sources`);

    // DNA topics will be loaded by scoreEvergreenSignals
    console.log(`🧬 Will load DNA topics for scoring...`);

    // Get existing signals to check for duplicates
    const { data: existingSignals } = await supabaseAdmin
      .from('signals')
      .select('title, reddit_url')
      .eq('show_id', showId)
      .eq('is_evergreen', true);

    const existingUrls = new Set((existingSignals || []).map(s => s.reddit_url).filter(Boolean));
    const existingTitles = (existingSignals || []).map(s => s.title);

    console.log(`📊 Found ${existingUrls.size} existing Reddit signals`);

    // Fetch from all sources
    let allPosts = [];
    
    for (const source of sources) {
      const posts = await fetchSubreddit(source.subreddit, {
        timeFilter: source.time_filter,
        minScore: source.min_score,
        minComments: source.min_comments,
      });

      // Add source info to posts
      posts.forEach(p => {
        p.category = source.category;
        p.sourceName = source.display_name || source.subreddit;
      });

      allPosts.push(...posts);
      
      // Rate limit: wait 1 second between requests
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`🔴 Total posts fetched: ${allPosts.length}`);

    // Deduplicate
    const uniquePosts = [];
    
    for (const post of allPosts) {
      // Skip if URL already exists
      if (existingUrls.has(post.redditUrl)) {
        continue;
      }

      // Skip if title too similar to existing
      const isSimilar = existingTitles.some(t => isSimilarTitle(post.title, t));
      if (isSimilar) {
        continue;
      }

      // Skip if similar to another post in this batch
      const isDuplicate = uniquePosts.some(p => isSimilarTitle(post.title, p.title));
      if (isDuplicate) {
        continue;
      }

      // Prepare post for scoring (ensure all fields are present)
      // Note: post.score is Reddit upvotes from API, preserve it before scoring overwrites it
      const postForScoring = {
        ...post,
        source: `r/${post.subreddit}`,
        source_type: 'reddit',
        upvotes: post.score,  // Reddit API uses 'score' for upvotes - preserve as upvotes
        redditUpvotes: post.score,  // Also store separately to be safe
        comments: post.comments,
        isQuestion: post.isQuestion,
        createdAt: post.createdAt
      };
      
      uniquePosts.push(postForScoring);
    }

    console.log(`✅ Unique new posts: ${uniquePosts.length}`);

    // Score using DNA-based evergreen scoring (same as RSS)
    // This will set post.score to DNA-based score, but upvotes/redditUpvotes are preserved
    const scoredPosts = await scoreEvergreenSignals(uniquePosts, showId);

    // Sort by DNA-based score (not old upvote-based score)
    scoredPosts.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Take top 30 by DNA score
    const topPosts = scoredPosts.slice(0, 30);

    // Insert as signals (with is_evergreen = true, skip AI enrichment)
    const signalsToInsert = topPosts.map(post => {
      // After evergreenScoring, post.score is the DNA-based score
      // post.redditUpvotes or post.upvotes is the original Reddit upvote count (preserved)
      const redditUpvotes = post.redditUpvotes || post.upvotes || 0;
      const dnaScore = post.score || 0; // DNA-based score
      
      return {
        show_id: showId,
        title: post.title,
        description: post.description || `Top discussion from r/${post.subreddit} • ${redditUpvotes.toLocaleString()} upvotes • ${post.comments || 0} comments`,
        url: post.redditUrl,
        reddit_url: post.redditUrl,
        source: `r/${post.subreddit}`,
        category: post.category,
        score: dnaScore,  // DNA-based score from evergreenScoring
        relevance_score: dnaScore,  // Same as score
        reddit_score: redditUpvotes,  // Keep original Reddit upvote score
      reddit_comments: post.comments || 0,
      upvote_ratio: post.upvoteRatio,
      is_evergreen: true,  // Mark as evergreen (skip AI enrichment)
      is_visible: true,
      status: 'new',
      source_type: 'reddit',
      // Store scoring breakdown in raw_data (metadata column doesn't exist)
      raw_data: {
        ...(post.raw_data || {}),
        evergreen_scoring: {
          dna_score: post.dna_score,
          quality_score: post.quality_score,
          engagement_score: post.engagement_score,
          freshness_score: post.freshness_score,
          combined_score: post.combined_score,
          matched_topics: post.matched_topics || [],
          matched_topic_names: post.matched_topic_names || [],
          dna_reasons: post.dna_reasons || []
        }
      }
    };
    });

    if (signalsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('signals')
        .insert(signalsToInsert);

      if (insertError) {
        console.error('❌ Error inserting Reddit signals:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // Increment usage (only after successful insert)
    await incrementUsage(user.id, 'reddit');

    console.log(`✅ Inserted ${signalsToInsert.length} Reddit signals`);

    return NextResponse.json({
      success: true,
      fetched: allPosts.length,
      unique: uniquePosts.length,
      imported: signalsToInsert.length,
      sources: sources.map(s => s.subreddit),
      quota: {
        remaining: quota.remaining - 1,
        limit: quota.limit,
        used: quota.used + 1
      }
    });

  } catch (error) {
    console.error('❌ Reddit fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

