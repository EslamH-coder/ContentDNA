import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabaseServer';

export async function POST(request) {
  try {
    const { user, supabase } = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { showId } = await request.json();
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    console.log('🔍 Analyzing topic gaps for show:', showId);

    // Get videos in "other_stories" or NULL
    const { data: uncategorizedVideos } = await supabase
      .from('channel_videos')
      .select('title, views, topic_id')
      .eq('show_id', showId)
      .or('topic_id.is.null,topic_id.eq.other_stories,topic_id.eq.other_misc')
      .order('views', { ascending: false })
      .limit(100);

    if (!uncategorizedVideos?.length) {
      return NextResponse.json({ 
        success: true, 
        gaps: [],
        message: 'All videos are categorized!' 
      });
    }

    // Calculate total views lost to "other"
    const totalViews = uncategorizedVideos.reduce((sum, v) => sum + (v.views || 0), 0);

    // Extract common words from titles (keyword extraction)
    const wordFrequency = {};
    const stopWords = [
      // Arabic stop words
      'في', 'من', 'إلى', 'على', 'و', 'أن', 'هذا', 'هذه', 'التي', 'الذي',
      'ما', 'كيف', 'لماذا', 'هل', 'عن', 'مع', 'بعد', 'قبل', 'كل', 'بين',
      'أو', 'ثم', 'لا', 'لم', 'لن', 'إذا', 'حتى', 'منذ', 'عند', 'أي',
      // English stop words
      'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or',
      // Channel name parts (should be filtered)
      'المخبر', 'المُخبر', 'الاقتصادي', 'اقتصادي',
      // Punctuation
      '|', '-', '–', ':', '!', '?', '؟', '+', '"', '"'
    ];

    for (const video of uncategorizedVideos) {
      if (!video.title) continue;
      
      // Clean and split title
      const words = video.title
        .replace(/[|–\-:!?؟+"]/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.includes(w));

      for (const word of words) {
        if (!wordFrequency[word]) {
          wordFrequency[word] = { 
            count: 0, 
            totalViews: 0, 
            examples: [],
            avgViews: 0
          };
        }
        wordFrequency[word].count++;
        wordFrequency[word].totalViews += video.views || 0;
        if (wordFrequency[word].examples.length < 3) {
          wordFrequency[word].examples.push(video.title);
        }
      }
    }

    // Calculate average views per keyword
    Object.values(wordFrequency).forEach(data => {
      data.avgViews = Math.round(data.totalViews / data.count);
    });

    // Sort by total views (most impactful keywords first)
    const suggestedKeywords = Object.entries(wordFrequency)
      .filter(([word, data]) => data.count >= 2) // Appears in at least 2 videos
      .sort((a, b) => b[1].totalViews - a[1].totalViews)
      .slice(0, 25)
      .map(([word, data]) => ({
        keyword: word,
        videoCount: data.count,
        totalViews: data.totalViews,
        avgViews: data.avgViews,
        examples: data.examples,
      }));

    console.log(`✅ Found ${uncategorizedVideos.length} uncategorized videos, ${suggestedKeywords.length} keyword suggestions`);

    return NextResponse.json({
      success: true,
      uncategorizedCount: uncategorizedVideos.length,
      totalViews,
      suggestedKeywords,
      sampleVideos: uncategorizedVideos.slice(0, 15).map(v => ({
        title: v.title,
        views: v.views,
      })),
    });

  } catch (error) {
    console.error('❌ Gap analysis error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
