import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  extractKeywords,
  expandKeywordsWithTranslations,
  normalizeArabicText,
  KEYWORD_TRANSLATIONS,
  calculateIdeaScore
} from '@/lib/scoring/multiSignalScoring';
import {
  calculateMatchScore,
  hasValidKeywordMatch,
  filterValuableKeywords
} from '@/lib/scoring/keywordWeights';
import { generateTopicFingerprint } from '@/lib/topicIntelligence';
import { getShowPatterns, scoreSignalByPatterns } from '@/lib/behaviorPatterns';
import { getLearnedAdjustments } from '@/lib/learning/signalEffectiveness';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');
    
    if (!showId) {
      return NextResponse.json({ error: 'showId required' }, { status: 400 });
    }

    console.log('📊 Fetching signals for show:', showId);

  // 1. Fetch signals (last 14 days)
  // NOTE: We don't filter by DB score here because Reddit signals have fake score=100
  // We'll calculate REAL scores and filter by those instead
  const { data: signals, error: signalsError } = await supabase
    .from('signals')
    .select('*')
    .eq('show_id', showId)
    .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false }) // Order by recency, not fake score
    .limit(100); // Get more signals since we'll filter by real score

  if (signalsError) {
    console.error('❌ Signals error:', signalsError);
    return NextResponse.json({ error: signalsError.message }, { status: 500 });
  }

  console.log(`✅ Found ${signals?.length || 0} signals`);
  
  // Log source breakdown
  const sourceBreakdown = {};
  signals?.forEach(s => {
    const source = s.source || s.source_name || s.raw_data?.sourceName || 'Unknown';
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
  });
  console.log('📰 Sources:', sourceBreakdown);

  // 2. Fetch DNA topics for this show
  const { data: dnaData } = await supabase
    .from('show_dna')
    .select('topics')
    .eq('show_id', showId)
    .single();

  let dnaTopics = [];
  if (dnaData?.topics) {
    if (Array.isArray(dnaData.topics)) {
      dnaTopics = dnaData.topics;
    } else if (typeof dnaData.topics === 'object') {
      // Convert object to array
      dnaTopics = Object.keys(dnaData.topics);
    }
  }
  console.log('🧬 DNA Topics:', dnaTopics);

  // 3. Fetch recent competitor videos (last 7 days)
  // Join with competitors table to get name and show_id
  // NOTE: competitors table uses "name" column, not "channel_name"
  const { data: competitorVideosRaw, error: compError } = await supabase
    .from('competitor_videos')
    .select(`
      id,
      title,
      youtube_video_id,
      views,
      published_at,
      competitor_id,
      competitors!competitor_id (
        id,
        name,
        type,
        show_id
      )
    `)
    .gte('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('views', { ascending: false })
    .limit(100);

  if (compError) {
    console.error('⚠️ Competitor videos error:', compError);
    console.error('   Error details:', JSON.stringify(compError, null, 2));
  }

  // Filter by show_id from the joined competitors table
  const competitorVideos = (competitorVideosRaw || []).filter(
    cv => cv.competitors && cv.competitors.show_id === showId
  );

  console.log(`🎬 Found ${competitorVideos.length} competitor videos for show ${showId} (from ${competitorVideosRaw?.length || 0} total)`);

  // 3.5. Normalize competitor videos (same as /app/api/signals/route.js)
  // IMPORTANT: This must be defined before calculateIdeaScore is called
  const normalizedCompetitorVideos = (competitorVideos || []).map(video => ({
    ...video,
    views: video.views || video.view_count || video.viewCount || 0,
    published_at: video.published_at || video.publish_date || video.publishedAt || video.created_at,
    publish_date: video.publish_date || video.published_at,
    title: video.title || '',
    description: video.description || '',
    competitor_id: video.competitor_id || video.competitors?.id,
    video_id: video.youtube_video_id || video.video_id || video.id,
    youtube_video_id: video.youtube_video_id || video.video_id || video.id,
    competitors: video.competitors || {},
  }));

  // 3.6. Fetch user videos for saturation check (same as /app/api/signals/route.js)
  console.log('📹 Fetching user videos for saturation check...');
  let userVideos = [];
  try {
    // Try channel_videos table first (preferred)
    const { data: channelVideos, error: channelVideosError } = await supabase
      .from('channel_videos')
      .select('*')
      .eq('show_id', showId)
      .order('publish_date', { ascending: false })
      .limit(200);

    if (!channelVideosError && channelVideos && channelVideos.length > 0) {
      userVideos = channelVideos;
      console.log(`✅ Found ${userVideos.length} user videos in channel_videos table`);
    } else {
      // Fallback to videos table
      const { data: videosTable, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('show_id', showId)
        .order('published_at', { ascending: false })
        .limit(200);

      if (!videosError && videosTable && videosTable.length > 0) {
        userVideos = videosTable.map(v => ({
          ...v,
          description: v.description || '',
          publish_date: v.published_at || v.publish_date,
        }));
        console.log(`✅ Found ${userVideos.length} user videos in videos table (fallback)`);
      }
    }
  } catch (err) {
    console.warn('⚠️ Error fetching user videos (non-fatal):', err.message);
  }

  // Normalize user videos (same as /app/api/signals/route.js)
  const normalizedUserVideos = (userVideos || []).map(video => {
    const actualTitle = video.title_ar || video.title_en || video.title || '';
    const normalizedDate = video.publish_date || video.published_at || video.publishedAt || video.created_at || video.upload_date;
    
    return {
      ...video,
      title: actualTitle,
      published_at: normalizedDate,
      publish_date: normalizedDate,
      description: video.description || video.desc || '',
      topic_id: video.topic_id || video.topic || null,
      video_id: video.video_id || video.id,
      youtube_url: video.youtube_url || (video.video_id ? `https://www.youtube.com/watch?v=${video.video_id}` : null),
    };
  });

  console.log(`📹 Normalized user videos: ${normalizedUserVideos.length} videos`);

  // 3.7. Get excluded names (channel/source names to filter out)
  let excludedNames = [];
  try {
    const { getExcludedNames } = await import('@/lib/entities/channelEntities');
    excludedNames = await getExcludedNames(showId);
    console.log(`🚫 Loaded ${excludedNames.length} excluded names (channel/source names)`);
  } catch (err) {
    console.warn('⚠️ Error fetching excluded names (non-fatal):', err.message);
  }

  // 3.8. Get behavior patterns and learned weights
  let showPatterns = {};
  let learnedWeights = {};
  try {
    console.log('🧠 Loading behavior patterns and learned weights...');
    [showPatterns, learnedWeights] = await Promise.all([
      getShowPatterns(showId, false), // Use cache if available
      getLearnedAdjustments(showId, 90) // Last 90 days of feedback
    ]);
    console.log(`✅ Loaded ${Object.keys(showPatterns).length} patterns and ${Object.keys(learnedWeights.patternWeights || {}).length} learned pattern weights`);
  } catch (err) {
    console.warn('⚠️ Error loading patterns/learning (non-fatal):', err.message);
  }

  // 4. ENSURE SOURCE DIVERSITY - Round-robin selection
  // Group by source
  const bySource = {};
  signals.forEach(s => {
    const source = s.source || s.source_name || s.raw_data?.sourceName || 'Unknown';
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push(s);
  });

  console.log('📊 Signals by source:', Object.entries(bySource).map(([src, arr]) => `${src}: ${arr.length}`).join(', '));

  // Take max 2 from each source, round-robin style
  const diverseSignals = [];
  const maxPerSource = 2;
  let added = true;
  let round = 0;

  while (added && diverseSignals.length < 20) {
    added = false;
    for (const source of Object.keys(bySource)) {
      if (bySource[source][round]) {
        diverseSignals.push(bySource[source][round]);
        added = true;
      }
    }
    round++;
    if (round >= maxPerSource) break;
  }

  // If we still need more signals, fill from remaining (sorted by score)
  if (diverseSignals.length < 20) {
    const usedIds = new Set(diverseSignals.map(s => s.id));
    const remaining = signals
      .filter(s => !usedIds.has(s.id))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 20 - diverseSignals.length);
    diverseSignals.push(...remaining);
  }

  console.log('📰 Diverse signals:', diverseSignals.map(s => (s.source || s.source_name || s.raw_data?.sourceName || 'Unknown')).join(', '));
  console.log(`✅ Selected ${diverseSignals.length} diverse signals from ${Object.keys(bySource).length} sources`);

  // 5. Process signals into tiers (using diverseSignals instead of signals)
  // IMPORTANT: Calculate REAL scores using multi-signal scoring instead of fake DB scores
  // Reddit signals have score=100 in DB (fake), but real score should be based on:
  // - Competitor breakout: +30
  // - Multiple competitors: +20
  // - DNA match: +20
  // - Recency: +15
  // - Not covered recently: +15
  const now = Date.now();
  
  // Calculate real scores for all signals (in parallel for performance)
  const processedSignals = await Promise.all(diverseSignals.map(async (signal) => {
    const hoursOld = (now - new Date(signal.created_at).getTime()) / (1000 * 60 * 60);
    
    // ============================================
    // STEP 1: Generate AI Topic Fingerprint (NON-BLOCKING)
    // ============================================
    // This extracts entities (people, countries, organizations, topics) using AI
    // when regex isn't enough. This improves DNA matching and keyword extraction.
    // IMPORTANT: Make this non-blocking with timeout so it doesn't slow down scoring
    let aiFingerprint = null;
    let aiEntities = { people: [], countries: [], organizations: [], topics: [] };
    let aiExtractedKeywords = [];
    
    // Generate AI fingerprint with timeout (don't block scoring if AI is slow)
    const aiFingerprintPromise = generateTopicFingerprint({
      title: signal.title || '',
      description: signal.description || signal.raw_data?.description || '',
      id: signal.id,
      type: 'signal'
    }, {
      skipEmbedding: true, // Skip embedding for performance
      skipCache: false // Use cache to avoid redundant AI calls
    }).then(fp => {
      if (fp && fp.entities) {
        aiEntities = fp.entities;
        // Combine AI-extracted topics, countries, organizations as additional keywords
        aiExtractedKeywords = [
          ...(aiEntities.topics || []),
          ...(aiEntities.countries || []),
          ...(aiEntities.organizations || []).slice(0, 3) // Limit orgs to avoid noise
        ].map(e => e.toLowerCase());
        
        console.log(`   🤖 AI extracted for "${signal.title?.substring(0, 40)}...":`, {
          topics: aiEntities.topics?.slice(0, 3) || [],
          countries: aiEntities.countries?.slice(0, 3) || [],
          organizations: aiEntities.organizations?.slice(0, 2) || [],
          extractionMethod: fp.extractionMethod || 'unknown'
        });
        return fp;
      }
      return null;
    }).catch(err => {
      console.warn(`   ⚠️ AI fingerprint generation failed for "${signal.title?.substring(0, 40)}...":`, err.message);
      return null;
    });
    
    // Add timeout: if AI takes more than 2 seconds, skip it (don't block scoring)
    const aiTimeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 2000));
    aiFingerprint = await Promise.race([aiFingerprintPromise, aiTimeoutPromise]);
    
    // ============================================
    // STEP 2: Calculate REAL score using multi-signal scoring system
    // ============================================
    // This replaces the fake score=100 from Reddit signals
    let realScore = 0;
    let scoringSignals = [];
    let strategicLabel = null;
    let competitorBreakdown = {};
    let competitorBreakout = null;
    let lastCoveredVideo = null;
    let daysSinceLastPost = null;
    let competitorEvidenceFromScoring = []; // Competitor matches from calculateIdeaScore
    
    try {
      // Use same pattern as /app/api/signals/route.js for proper scoring
      // Ensure normalizedCompetitorVideos is defined (should be defined at line 111)
      if (typeof normalizedCompetitorVideos === 'undefined') {
        console.error('❌ CRITICAL: normalizedCompetitorVideos is not defined! Using competitorVideos as fallback.');
      }
      const scoringResult = await calculateIdeaScore(signal, {
        competitorVideos: normalizedCompetitorVideos || competitorVideos || [], // Use normalized videos, fallback to raw if needed
        userVideos: normalizedUserVideos, // Include user videos for saturation check
        dnaTopics: dnaTopics,
        signalTitle: signal.title || '',
        signalDescription: signal.description || signal.raw_data?.description || '',
        signalPublishedAt: signal.created_at || signal.published_at,
        signalTopicId: signal.topic_id,
        sourceUrl: signal.url || signal.source_url || signal.raw_data?.url || signal.raw_data?.link || null,
        sourceTitle: signal.source || signal.source_name || signal.raw_data?.sourceName || null,
        sourceCount: 1,
      }, excludedNames); // Pass excluded names to filter out channel/source names
      
      realScore = scoringResult?.score ?? 0; // Use nullish coalescing to catch 0 scores
      scoringSignals = scoringResult?.signals || [];
      strategicLabel = scoringResult?.strategicLabel || null;
      competitorBreakdown = scoringResult?.competitorBreakdown || {};
      
      // DEBUG: Log score details to help diagnose 57/50 issue
      if (realScore === 57 || realScore === 50) {
        console.log(`   🔍 DEBUG Score ${realScore} for "${signal.title?.substring(0, 40)}...":`, {
          score: realScore,
          signalCount: scoringResult?.signalCount || 0,
          signals: scoringSignals.map(s => ({ type: s.type, weight: s.weight })),
          competitorBreakdown: competitorBreakdown,
          hasDnaMatch: scoringSignals.some(s => s.type === 'dna_match'),
          hasCompetitorBreakout: !!competitorBreakout,
          hasCompetitorVolume: scoringSignals.some(s => s.type?.includes('competitor_volume'))
        });
      }
      
      // Extract competitor breakout info from signals
      const breakoutSignal = scoringSignals.find(s => 
        s.type === 'competitor_breakout_trendsetter' || 
        s.type === 'competitor_breakout_direct' || 
        s.type === 'competitor_breakout_indirect'
      );
      competitorBreakout = breakoutSignal?.data || null;
      
      // Extract competitor evidence from signals (better matching from calculateIdeaScore)
      // Look for competitor volume signals which contain evidence.competitors array
      const competitorVolumeSignals = scoringSignals.filter(s => 
        s.type === 'competitor_volume_direct' || 
        s.type === 'competitor_volume_mixed' || 
        s.type === 'competitor_volume_indirect' ||
        s.type === 'trendsetter_volume'
      );
      // Combine all competitor evidence from different signals
      competitorEvidenceFromScoring = competitorVolumeSignals
        .flatMap(s => s.evidence?.competitors || [])
        .filter((comp, index, self) => 
          // Deduplicate by videoUrl
          index === self.findIndex(c => c.videoUrl === comp.videoUrl)
        );
      
      // Find last covered video from freshness or saturated signal
      // These signals come from findDaysSinceLastPost() which has better matching
      const lastPostSignal = scoringSignals.find(s => 
        s.type === 'freshness' || 
        s.type === 'fresh_topic' || 
        s.type === 'saturated'
      );
      
      if (lastPostSignal) {
        // Extract days from signal data or text
        if (lastPostSignal.data?.daysSinceLastPost) {
          daysSinceLastPost = lastPostSignal.data.daysSinceLastPost;
        } else {
          const daysMatch = lastPostSignal.text?.match(/(\d+)\s*days?\s*ago/i);
          if (daysMatch) {
            daysSinceLastPost = parseInt(daysMatch[1]);
          } else if (lastPostSignal.text?.includes("haven't covered") || lastPostSignal.text?.includes("haven't covered")) {
            daysSinceLastPost = 999;
          }
        }
        
        // Get the actual video from evidence (this comes from findDaysSinceLastPost)
        // Evidence structure in signal: { matchedVideo (title), videoUrl, matchedKeywords, daysAgo, matchType }
        if (lastPostSignal.evidence) {
          const evidence = lastPostSignal.evidence;
          if (evidence.matchedVideo || evidence.videoUrl) {
            lastCoveredVideo = {
              title: evidence.matchedVideo || '',
              url: evidence.videoUrl || null,
              daysAgo: daysSinceLastPost || evidence.daysAgo || null
            };
          }
        }
      }
      
      // ALWAYS log score calculation for debugging (not just when DB=100)
      const sourceName = signal.source || signal.source_name || signal.raw_data?.sourceName || 'Unknown';
      
      // If DB score is 100 but real score is different, highlight it
      if (signal.score === 100 && realScore !== 100) {
        console.log(`   ✅ FIXED: "${signal.title?.substring(0, 40)}..." [${sourceName}] DB: ${signal.score} → Real: ${realScore} (${scoringSignals.length} signals)`);
        if (realScore < 20) {
          console.log(`      🚫 Will be FILTERED OUT (real score ${realScore} < 20)`);
        }
      } else if (signal.score === 100 && realScore === 100) {
        console.log(`   ⚠️ WARNING: "${signal.title?.substring(0, 40)}..." [${sourceName}] Still 100! Check if calculateIdeaScore is working correctly`);
      } else {
        // Normal logging for non-100 DB scores
        console.log(`   📊 Score: "${signal.title?.substring(0, 40)}..." [${sourceName}] DB: ${signal.score} → Real: ${realScore} (${scoringSignals.length} signals)`);
      }
      
      // DEBUG: Log detailed score breakdown for 57/50 issue
      if (realScore === 57 || realScore === 50) {
        console.log(`   🔍 DEBUG Score ${realScore}:`, {
          scoringResultKeys: Object.keys(scoringResult || {}),
          signalCount: scoringResult?.signalCount,
          isValid: scoringResult?.isValid,
          signalsBreakdown: scoringSignals.map(s => `${s.type}(${s.weight || 'N/A'})`).join(', '),
          competitorBreakdown: competitorBreakdown,
          hasDnaMatch: scoringSignals.some(s => s.type === 'dna_match'),
          hasBreakout: !!competitorBreakout
        });
      }
      
      // If real score is 0 or very low, log why
      if (realScore < 20 && scoringSignals.length === 0) {
        console.log(`      ⚠️ Low score (${realScore}): No signals found (no competitor breakout, DNA match, etc.)`);
      }
    } catch (err) {
      console.error(`   ❌ Error calculating score for "${signal.title?.substring(0, 40)}...":`, err.message);
      console.error(`      Stack:`, err.stack?.substring(0, 200));
      // Fallback to DB score if calculation fails, but log it
      realScore = signal.score || 0;
      console.log(`      ⚠️ Using DB score as fallback: ${realScore}`);
    }
    
    // Determine tier using REAL score (not fake DB score)
    let tier = 'evergreen';
    if (realScore >= 90 && hoursOld < 48) {
      tier = 'post_today';
    } else if (realScore >= 70 || hoursOld < 168) {
      tier = 'this_week';
    }

    // Find matching competitor videos using smart bilingual keyword matching
    // ENHANCED: Now uses AI-extracted entities + rule-based keywords
    // Uses the SAME system as findCompetitorBreakout() in multiSignalScoring.js:
    // 1. Extract keywords with translations (extractKeywords)
    // 2. Add AI-extracted entities (topics, countries, organizations) as additional keywords
    // 3. Match keywords between signal and video
    // 4. Validate match using calculateMatchScore (filters out generic words)
    // This ensures only MEANINGFUL matches (not "says", "about", etc.)
    let signalKeywords = [];
    try {
      // Start with rule-based keyword extraction
      signalKeywords = extractKeywords(signal.title || '');
      
      // ENHANCED: Add AI-extracted entities as additional keywords
      // This improves matching, especially for cross-language scenarios
      if (aiExtractedKeywords && aiExtractedKeywords.length > 0) {
        // Merge AI keywords with rule-based keywords (deduplicate)
        const existingKeywords = new Set(signalKeywords.map(k => normalizeArabicText(k).toLowerCase()));
        const newAiKeywords = aiExtractedKeywords.filter(k => {
          const normalized = normalizeArabicText(k).toLowerCase();
          return !existingKeywords.has(normalized) && k.length > 2; // Filter out very short keywords
        });
        signalKeywords = [...signalKeywords, ...newAiKeywords];
        console.log(`   ✅ Enhanced keywords: ${signalKeywords.length} total (${newAiKeywords.length} from AI)`);
      }
    } catch (err) {
      console.error(`   ⚠️ Error extracting keywords for "${signal.title?.substring(0, 40)}...":`, err.message);
      signalKeywords = [];
    }
    
    // Use competitor evidence from calculateIdeaScore (better matching system)
    // This comes from countCompetitorMatches() which uses the same smart matching
    // The evidence structure: { name, type, videoTitle, videoUrl, matchedKeywords }
    let matchingCompetitors = [];
    
    if (competitorEvidenceFromScoring && competitorEvidenceFromScoring.length > 0) {
      // Use the better matching from calculateIdeaScore
      matchingCompetitors = competitorEvidenceFromScoring.slice(0, 3).map(comp => ({
        channel: comp.name || 'Competitor',
        type: comp.type || 'indirect',
        typeLabel: comp.type === 'direct' ? 'Direct' : 
                   comp.type === 'trendsetter' ? 'Trendsetter' : 
                   'Indirect',
        title: comp.videoTitle || '',
        videoUrl: comp.videoUrl || null,
        views: 0, // Not available in evidence
        matchedKeywords: comp.matchedKeywords || []
      })).filter(c => c.videoUrl); // Only include if we have a video URL
      
      console.log(`   ✅ Using ${matchingCompetitors.length} competitors from scoring evidence for "${signal.title?.substring(0, 40)}..."`);
    } else {
      // Fallback to manual matching if scoring didn't provide evidence
      console.log(`   ⚠️ No competitors from scoring evidence, using fallback matching for "${signal.title?.substring(0, 40)}..."`);
      const fallbackMatches = (competitorVideos || [])
        .map(cv => {
          try {
            const videoTitle = cv.title || '';
            const videoDescription = (cv.description || '').substring(0, 200);
            const titleKeywords = extractKeywords(videoTitle);
            const descKeywords = extractKeywords(videoDescription);
            const videoKeywords = [...new Set([...titleKeywords, ...descKeywords])];
            const matchingKeywords = signalKeywords.filter(sk => {
              const normalizedSk = normalizeArabicText(sk).toLowerCase();
              return videoKeywords.some(vk => {
                const normalizedVk = normalizeArabicText(vk).toLowerCase();
                return normalizedVk.includes(normalizedSk) || normalizedSk.includes(normalizedVk);
              });
            });
            const matchResult = calculateMatchScore(matchingKeywords, []);
            return { video: cv, matchResult, matchingKeywords, isValid: matchResult.isValidMatch };
          } catch (err) {
            return { video: cv, matchResult: { isValidMatch: false, score: 0 }, matchingKeywords: [], isValid: false };
          }
        })
        .filter(result => result.isValid)
        .sort((a, b) => (b.matchResult.score || 0) - (a.matchResult.score || 0))
        .slice(0, 3)
        .map(result => {
          const cv = result.video;
          const competitorType = cv.competitors?.type || 'indirect';
          return {
            channel: cv.competitors?.name || 'Competitor',
            type: competitorType,
            typeLabel: competitorType === 'direct' ? 'Direct' : competitorType === 'trendsetter' ? 'Trendsetter' : 'Indirect',
            title: cv.title,
            videoUrl: cv.youtube_video_id ? `https://youtube.com/watch?v=${cv.youtube_video_id}` : null,
            views: cv.views || 0,
            matchedKeywords: result.matchingKeywords.slice(0, 5)
          };
        })
        .filter(c => c.videoUrl);
      
      matchingCompetitors = fallbackMatches;
    }
    
    // Log competitor matches
    if (matchingCompetitors.length > 0) {
      console.log(`   🔗 Found ${matchingCompetitors.length} competitor matches for "${signal.title?.substring(0, 40)}..."`);
      matchingCompetitors.forEach((comp, i) => {
        console.log(`      ${i + 1}. ${comp.typeLabel}: ${comp.channel} - "${comp.title?.substring(0, 40)}..."`);
      });
    }

    // ============================================
    // STEP 3: Enhanced DNA Matching with AI
    // ============================================
    // ENHANCED: Now uses AI-extracted topics/entities for better DNA matching
    // 1. Check if AI-extracted topics match DNA topics
    // 2. Check if signal title/description includes DNA topic keywords (fallback)
    // 3. Use AI-extracted entities (countries, organizations) to match DNA topics
    let dnaMatch = null;
    
    // Method 1: Check AI-extracted topics against DNA topics
    if (aiEntities.topics && aiEntities.topics.length > 0 && dnaTopics.length > 0) {
      for (const aiTopic of aiEntities.topics) {
        const aiTopicLower = aiTopic.toLowerCase();
        // Check if AI topic matches any DNA topic (by topic_id, name, or keywords)
        const matchingDnaTopic = dnaTopics.find(dnaTopic => {
          if (typeof dnaTopic === 'string') {
            return dnaTopic.toLowerCase() === aiTopicLower;
          }
          // Check topic_id
          const topicId = dnaTopic.topic_id || dnaTopic.topicId || dnaTopic.id || dnaTopic.topic;
          if (topicId && String(topicId).toLowerCase() === aiTopicLower) {
            return true;
          }
          // Check name (prefer English names)
          const topicName = dnaTopic.topic_name_en || dnaTopic.name || dnaTopic.topic_name || dnaTopic.label_en || dnaTopic.label_ar || '';
          if (topicName && topicName.toLowerCase().includes(aiTopicLower)) {
            return true;
          }
          // Check keywords
          const keywords = Array.isArray(dnaTopic.keywords) ? dnaTopic.keywords : [];
          if (keywords.some(k => normalizeArabicText(String(k)).toLowerCase().includes(aiTopicLower))) {
            return true;
          }
          return false;
        });
        
        if (matchingDnaTopic) {
          const topicId = typeof matchingDnaTopic === 'string' 
            ? matchingDnaTopic 
            : (matchingDnaTopic.topic_id || matchingDnaTopic.topicId || matchingDnaTopic.id || matchingDnaTopic.topic);
          // Get English name for display
          const topicName = typeof matchingDnaTopic === 'object'
            ? (matchingDnaTopic.topic_name_en || matchingDnaTopic.name || matchingDnaTopic.topic_name || topicId)
            : topicId;
          dnaMatch = { topicId, topicName };
          console.log(`   ✅ DNA match (AI topic): "${aiTopic}" → DNA topic "${topicName}" (${topicId})`);
          break;
        }
      }
    }
    
    // Method 2: Check AI-extracted countries/organizations that might match DNA topics
    if (!dnaMatch && (aiEntities.countries?.length > 0 || aiEntities.organizations?.length > 0)) {
      const allEntities = [...(aiEntities.countries || []), ...(aiEntities.organizations || [])];
      for (const entity of allEntities) {
        const entityLower = entity.toLowerCase();
        // Check if entity appears in DNA topic keywords
        const matchingDnaTopic = dnaTopics.find(dnaTopic => {
          if (typeof dnaTopic === 'string') return false;
          const keywords = Array.isArray(dnaTopic.keywords) ? dnaTopic.keywords : [];
          return keywords.some(k => {
            const kLower = normalizeArabicText(String(k)).toLowerCase();
            return kLower.includes(entityLower) || entityLower.includes(kLower);
          });
        });
        
        if (matchingDnaTopic) {
          const topicId = matchingDnaTopic.topic_id || matchingDnaTopic.topicId || matchingDnaTopic.id || matchingDnaTopic.topic;
          const topicName = matchingDnaTopic.topic_name_en || matchingDnaTopic.name || matchingDnaTopic.topic_name || topicId;
          dnaMatch = { topicId, topicName };
          console.log(`   ✅ DNA match (AI entity): "${entity}" → DNA topic "${topicName}" (${topicId})`);
          break;
        }
      }
    }
    
    // Method 3: Fallback to rule-based matching (original method)
    if (!dnaMatch) {
      const foundTopic = dnaTopics.find(topic => {
        const topicId = typeof topic === 'string' ? topic : (topic.topic_id || topic.topicId || topic.id || topic.topic);
        const topicStr = typeof topic === 'string' ? topic : (topic.topic_name_en || topic.name || topic.topic_name || String(topicId) || '');
        const topicLower = topicStr.toLowerCase();
        return signal.title.toLowerCase().includes(topicLower) ||
               signal.description?.toLowerCase().includes(topicLower);
      });
      
      if (foundTopic) {
        const topicId = typeof foundTopic === 'string' ? foundTopic : (foundTopic.topic_id || foundTopic.topicId || foundTopic.id || foundTopic.topic);
        const topicName = typeof foundTopic === 'object'
          ? (foundTopic.topic_name_en || foundTopic.name || foundTopic.topic_name || topicId)
          : topicId;
        dnaMatch = { topicId, topicName };
      }
    }

    // ============================================
    // STEP 4: Pattern Matching & Learning
    // ============================================
    // Score signal against learned behavior patterns and audience interests
    let patternMatches = [];
    let patternBoost = 0;
    try {
      const patternResult = await scoreSignalByPatterns(
        signal,
        showPatterns,
        learnedWeights.patternWeights || {}
      );
      
      patternBoost = patternResult.totalBoost || 0;
      patternMatches = (patternResult.matches || []).map(match => ({
        patternId: match.patternId,
        patternName: match.patternName,
        patternNameAr: match.patternNameAr,
        source: match.source,
        boost: match.boost,
        evidence: match.evidence,
        confidence: match.confidence,
        isLearned: match.isLearned, // Whether user liked this pattern before
        likedCount: learnedWeights.patternWeights?.[match.patternId]?.liked || 0, // "you liked this pattern X times"
        avgViews: showPatterns[match.patternId]?.avgViews || null,
        multiplier: showPatterns[match.patternId]?.multiplier || null
      }));
      
      if (patternMatches.length > 0) {
        console.log(`   🎯 Pattern matches: ${patternMatches.length} patterns (${patternBoost} boost)`);
      }
    } catch (err) {
      console.warn(`   ⚠️ Pattern matching failed for "${signal.title?.substring(0, 40)}...":`, err.message);
    }

    return {
      id: signal.id,
      title: signal.title,
      description: signal.description,
      source: signal.source || signal.source_name || signal.raw_data?.sourceName || 'Unknown',
      sourceUrl: signal.url || signal.source_url || signal.raw_data?.url || null,
      score: realScore, // Use REAL score, not fake DB score
      dbScore: signal.score, // Keep DB score for reference/debugging
      createdAt: signal.created_at,
      tier,
      hoursOld: Math.round(hoursOld),
      competitors: matchingCompetitors,
      dnaMatch: (typeof dnaMatch === 'object' && dnaMatch !== null) ? dnaMatch.topicName : (dnaMatch || null), // Return English name for display
      dnaMatchId: (typeof dnaMatch === 'object' && dnaMatch !== null) ? dnaMatch.topicId : (dnaMatch || null), // Keep ID for reference
      hasEvidence: matchingCompetitors.length > 0 || !!dnaMatch,
      scoringSignals: scoringSignals, // What contributed to the score
      strategicLabel: strategicLabel, // Strategic label (TREND FORMING, etc.)
      competitorBreakout: competitorBreakout, // Breakout video details
      competitorBreakdown: competitorBreakdown, // Counts by type
      lastCoveredVideo: lastCoveredVideo, // Last video on this topic (from findDaysSinceLastPost)
      daysSinceLastPost: daysSinceLastPost, // Days since last post
      matchedKeywords: signalKeywords.slice(0, 10), // Keywords extracted from signal (rule-based + AI)
      aiEntities: aiEntities, // AI-extracted entities (people, countries, organizations, topics)
      aiExtractionMethod: aiFingerprint?.extractionMethod || null, // 'ai', 'regex', 'cached', or null
      patternMatches: patternMatches, // Pattern matches (Resource Control, Audience Interest, etc.)
      patternBoost: patternBoost // Total boost from pattern matching
    };
  }));

  // 6. FILTER OUT LOW-QUALITY SIGNALS
  // Only include signals with real score >= 20 (minimum quality threshold)
  // This excludes Reddit signals with fake score=100 but real score=0-19
  const MIN_REAL_SCORE = 20;
  const qualitySignals = processedSignals.filter(s => {
    const realScore = s.score || 0;
    if (realScore < MIN_REAL_SCORE) {
      console.log(`   🚫 Filtered out: "${s.title?.substring(0, 40)}..." (real score: ${realScore} < ${MIN_REAL_SCORE})`);
      return false;
    }
    return true;
  });
  
  console.log(`📊 Quality filter: ${processedSignals.length} signals → ${qualitySignals.length} with real score >= ${MIN_REAL_SCORE}`);

  // 7. Group by tier with limits (sort by real score within each tier)
  const postToday = qualitySignals
    .filter(s => s.tier === 'post_today')
    .sort((a, b) => (b.score || 0) - (a.score || 0)) // Sort by real score
    .slice(0, 5);
  const thisWeek = qualitySignals
    .filter(s => s.tier === 'this_week')
    .sort((a, b) => (b.score || 0) - (a.score || 0)) // Sort by real score
    .slice(0, 7);
  const evergreen = qualitySignals
    .filter(s => s.tier === 'evergreen')
    .sort((a, b) => (b.score || 0) - (a.score || 0)) // Sort by real score
    .slice(0, 5);

  console.log('📤 Final counts:', {
    postToday: postToday.length,
    thisWeek: thisWeek.length,
    evergreen: evergreen.length
  });

  // Log final source distribution
  const finalSourceBreakdown = {};
  [...postToday, ...thisWeek, ...evergreen].forEach(s => {
    const source = s.source || 'Unknown';
    finalSourceBreakdown[source] = (finalSourceBreakdown[source] || 0) + 1;
  });
  console.log('📤 Final source distribution:', finalSourceBreakdown);

    return NextResponse.json({
      success: true,
      data: {
        postToday,
        thisWeek,
        evergreen
      },
      meta: {
        totalSignals: signals.length,
        diverseSignalsCount: diverseSignals.length,
        sources: sourceBreakdown,
        finalSourceDistribution: finalSourceBreakdown,
        dnaTopics,
        competitorVideosCount: competitorVideos?.length || 0
      }
    });
  } catch (error) {
    console.error('❌ Error in /api/studio/signals:', error);
    console.error('   Stack:', error.stack);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
}
