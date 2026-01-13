import { batchAnalyzeThumbnails } from '@/lib/ai/thumbnail-analyzer';
import { generateTopicsFromTitles, batchClassifyVideos, calculatePerformanceHints } from '@/lib/ai/topic-classifier';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  console.log('=== ANALYZE API CALLED ===');
  
  const body = await request.json();
  const { showId, step } = body;
  
  console.log('ShowId:', showId);
  console.log('Step:', step);
  
  if (!showId) {
    console.log('ERROR: No showId');
    return NextResponse.json({ error: 'showId required' }, { status: 400 });
  }
  
  try {
    // Get all videos for this show
    console.log('Fetching videos for show:', showId);
    const { data: videos, error: fetchError } = await supabase
      .from('channel_videos')
      .select('*')
      .eq('show_id', showId)
      .order('publish_date', { ascending: false });
    
    if (fetchError) {
      console.error('Error fetching videos:', fetchError);
      throw fetchError;
    }
    
    if (!videos || videos.length === 0) {
      console.log('ERROR: No videos found');
      return NextResponse.json({ error: 'No videos found' }, { status: 404 });
    }
    
    console.log(`Found ${videos.length} videos`);
    
    let result = {};
    
    // Step 1: Analyze Thumbnails
    if (step === 'thumbnails' || step === 'all') {
      console.log('=== STARTING THUMBNAILS STEP ===');
      await updateStatus(showId, 'analyzing_thumbnails', 0);
      await logStep(showId, 'analyze_thumbnails', 'started', `Analyzing ${videos.length} thumbnails`);
      
      const videosToAnalyze = videos.filter(v => !v.thumbnail_analyzed && v.thumbnail_url);
      
      const thumbnailResults = await batchAnalyzeThumbnails(videosToAnalyze, async (progress, current, total) => {
        await updateStatus(showId, 'analyzing_thumbnails', progress);
      });
      
      // Update database
      for (const result of thumbnailResults) {
        if (result.success) {
          await supabase
            .from('channel_videos')
            .update({
              thumbnail_elements: result.elements,
              thumbnail_title: result.thumbnail_title,
              thumbnail_colors: result.colors,
              thumbnail_analyzed: true
            })
            .eq('show_id', showId)
            .eq('video_id', result.video_id);
        }
      }
      
      await logStep(showId, 'analyze_thumbnails', 'completed', 
        `Analyzed ${thumbnailResults.filter(r => r.success).length}/${videosToAnalyze.length} thumbnails`);
      
      result.thumbnails = { analyzed: thumbnailResults.filter(r => r.success).length };
    }
    
    // Step 2: Generate & Save Topics
    if (step === 'topics' || step === 'all') {
      console.log('=== STARTING TOPICS STEP ===');
      await updateStatus(showId, 'classifying', 0);
      await logStep(showId, 'generate_topics', 'started', 'Generating topic categories');
      
      // Check if topics already exist for this show
      console.log('Checking for existing topics...');
      const { data: existingTopics } = await supabase
        .from('topic_definitions')
        .select('*')
        .eq('show_id', showId);
      
      let topics = existingTopics || [];
      console.log(`Found ${topics.length} existing topics`);
      
      if (topics.length === 0) {
        console.log('No existing topics found, generating new topics...');
        // Generate new topics
        const titles = videos.map(v => v.title);
        console.log(`Generating topics from ${titles.length} video titles...`);
        const generatedTopics = await generateTopicsFromTitles(showId, titles);
        console.log(`Generated ${generatedTopics.length} topics`);
        
        // Save topics to database
        if (generatedTopics.length > 0) {
          console.log('Saving topics to database...');
          const topicsToInsert = generatedTopics.map(t => ({
            show_id: showId,
            topic_id: t.topic_id,
            topic_name_en: t.name_en,
            topic_name_ar: t.name_ar,
            keywords: t.keywords,
            description: t.description
          }));
          
          await supabase
            .from('topic_definitions')
            .upsert(topicsToInsert, { onConflict: 'show_id,topic_id' });
          
          topics = generatedTopics;
        }
        
        await logStep(showId, 'generate_topics', 'completed', `Generated ${topics.length} topics`);
      }
      
      result.topics = { count: topics.length, topics };
    }
    
    // Step 3: Classify Videos
    if (step === 'classify' || step === 'all') {
      console.log('=== STARTING CLASSIFY STEP ===');
      await updateStatus(showId, 'classifying', 30);
      await logStep(showId, 'classify_videos', 'started', 'Classifying videos into topics');
      
      // Get topics for this show
      console.log('Fetching topics for classification...');
      const { data: topics } = await supabase
        .from('topic_definitions')
        .select('*')
        .eq('show_id', showId);
      
      console.log('Topics count:', topics?.length);
      
      if (!topics || topics.length === 0) {
        console.error('ERROR: No topics found');
        throw new Error('No topics found. Run topic generation first.');
      }
      
      // Format topics for classifier
      const topicsForClassifier = topics.map(t => ({
        topic_id: t.topic_id,
        name_en: t.topic_name_en,
        name_ar: t.topic_name_ar
      }));
      
      const videosToClassify = videos.filter(v => !v.ai_analyzed);
      console.log(`Classifying ${videosToClassify.length} videos (${videos.length - videosToClassify.length} already analyzed)`);
      
      const classifications = await batchClassifyVideos(videosToClassify, topicsForClassifier, 
        async (progress, current, total) => {
          await updateStatus(showId, 'classifying', 30 + Math.round(progress * 0.5));
        }
      );
      
      // Update database
      for (const c of classifications) {
        await supabase
          .from('channel_videos')
          .update({
            topic_id: c.topic_id,
            topic_confidence: c.confidence,
            auto_topic_id: c.topic_id,
            entities: c.entities,
            key_numbers: c.key_numbers,
            content_archetype: c.content_archetype,
            chapters_beats: c.chapters_beats,
            ai_analyzed: true
          })
          .eq('show_id', showId)
          .eq('video_id', c.video_id);
      }
      
      await logStep(showId, 'classify_videos', 'completed', `Classified ${classifications.length} videos`);
      
      result.classified = { count: classifications.length };
    }
    
    // Step 4: Calculate Performance
    if (step === 'performance' || step === 'all') {
      console.log('=== STARTING PERFORMANCE STEP ===');
      await updateStatus(showId, 'calculating', 90);
      await logStep(showId, 'calculate_performance', 'started', 'Calculating performance metrics (using organic views)');
      
      // Refresh videos data
      console.log('Refreshing videos data for performance calculation...');
      const { data: updatedVideos } = await supabase
        .from('channel_videos')
        .select('*')
        .eq('show_id', showId);
      
      console.log(`Refreshed ${updatedVideos?.length || 0} videos`);
      
      // Check if show has significant ad traffic
      const avgAdPercentage = updatedVideos.length > 0
        ? updatedVideos.reduce((sum, v) => sum + (v.ad_percentage || 0), 0) / updatedVideos.length
        : 0;
      
      console.log(`Average ad percentage: ${avgAdPercentage.toFixed(1)}%`);
      
      // Update show flag
      await supabase
        .from('shows')
        .update({ 
          has_paid_promotion: avgAdPercentage > 10,
          use_organic_for_analysis: avgAdPercentage > 10
        })
        .eq('id', showId);
      
      console.log('Calculating performance hints (using organic views)...');
      const performanceHints = calculatePerformanceHints(updatedVideos, true);
      console.log(`Calculated performance for ${performanceHints.length} videos`);
      
      // Update database with performance hints and scores
      console.log('Updating database with performance data...');
      for (const p of performanceHints) {
        await supabase
          .from('channel_videos')
          .update({ 
            performance_hint: p.performance_hint,
            viral_score: p.viral_score,
            evergreen_score: p.evergreen_score
          })
          .eq('show_id', showId)
          .eq('video_id', p.video_id);
      }
      
      const overperforming = performanceHints.filter(p => p.performance_hint === 'Overperforming').length;
      const underperforming = performanceHints.filter(p => p.performance_hint === 'Underperforming').length;
      
      await logStep(showId, 'calculate_performance', 'completed', 
        `Calculated (organic-based): ${overperforming} overperforming, ${underperforming} underperforming. Avg ad traffic: ${avgAdPercentage.toFixed(1)}%`);
      
      result.performance = {
        total: performanceHints.length,
        overperforming,
        average: performanceHints.filter(p => p.performance_hint === 'Average').length,
        underperforming,
        avgAdPercentage: parseFloat(avgAdPercentage.toFixed(1))
      };
    }
    
    // Mark as ready
    if (step === 'all' || step === 'finalize') {
      console.log('=== FINALIZING ONBOARDING ===');
      await supabase
        .from('shows')
        .update({
          onboarding_status: 'ready',
          onboarding_progress: 100
        })
        .eq('id', showId);
      
      await logStep(showId, 'onboarding_complete', 'completed', 'Onboarding finished successfully!');
      console.log('✅ Onboarding completed successfully!');
    }
    
    console.log('=== ANALYZE API COMPLETED ===');
    console.log('Result:', JSON.stringify(result, null, 2));
    return NextResponse.json({ success: true, ...result });
    
  } catch (error) {
    console.error('Analysis error:', error);
    await updateStatus(showId, 'failed', 0, error.message);
    await logStep(showId, 'analysis_error', 'failed', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function updateStatus(showId, status, progress, error = null) {
  await supabase
    .from('shows')
    .update({ 
      onboarding_status: status, 
      onboarding_progress: progress,
      onboarding_error: error 
    })
    .eq('id', showId);
}

async function logStep(showId, step, status, message, details = null) {
  await supabase.from('onboarding_logs').insert({
    show_id: showId,
    step,
    status,
    message,
    details,
    completed_at: ['completed', 'failed'].includes(status) ? new Date().toISOString() : null
  });
}

