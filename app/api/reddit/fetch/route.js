import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';
import { verifyShowAccess } from '@/lib/apiShowAccess';
import { checkQuota, incrementUsage } from '@/lib/rateLimiter';
import { fetchSubreddit, calculateRedditScore, isSimilarTitle } from '@/lib/redditFetcher';
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

    // Get DNA keywords for scoring
    const { data: dnaTopics } = await supabaseAdmin
      .from('topic_definitions')
      .select('keywords')
      .eq('show_id', showId);

    const dnaKeywords = (dnaTopics || [])
      .flatMap(t => t.keywords || [])
      .filter(Boolean);

    console.log(`🧬 Loaded ${dnaKeywords.length} DNA keywords`);

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

      // Calculate score
      post.calculatedScore = calculateRedditScore(post, dnaKeywords);
      uniquePosts.push(post);
    }

    console.log(`✅ Unique new posts: ${uniquePosts.length}`);

    // Sort by score
    uniquePosts.sort((a, b) => b.calculatedScore - a.calculatedScore);

    // Take top 30
    const topPosts = uniquePosts.slice(0, 30);

    // Insert as signals (with is_evergreen = true, skip AI enrichment)
    const signalsToInsert = topPosts.map(post => ({
      show_id: showId,
      title: post.title,
      description: post.description || `Top discussion from r/${post.subreddit} • ${post.score.toLocaleString()} upvotes • ${post.comments} comments`,
      url: post.redditUrl,
      reddit_url: post.redditUrl,
      source: `r/${post.subreddit}`,
      category: post.category,
      score: Math.min(post.calculatedScore, 100),  // Cap at 100 for database constraint
      relevance_score: Math.min(post.calculatedScore, 100),  // Cap at 100 for database constraint
      reddit_score: post.score,  // Keep original Reddit score (upvotes) - no constraint
      reddit_comments: post.comments,
      upvote_ratio: post.upvoteRatio,
      is_evergreen: true,  // Mark as evergreen (skip AI enrichment)
      is_visible: true,
      status: 'new',
      source_type: 'reddit',
    }));

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

