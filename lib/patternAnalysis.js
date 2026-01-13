/**
 * Pattern Analysis Engine
 * Analyzes a show's videos to extract winning patterns
 */

import { createClient } from '@supabase/supabase-js';
import { generateTopicFingerprint } from './topicIntelligence.js';

// Use service role key for server-side operations (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Predefined pattern templates (starting point, system learns more)
export const BASE_PATTERNS = {
  // Long Form Patterns
  hidden_truth: {
    id: 'hidden_truth',
    name: 'Hidden Truth / Contrarian',
    name_ar: 'الحقيقة المخفية',
    formula: 'Reveal unexpected negative consequence of trending topic',
    triggers: {
      keywords: ['لماذا', 'لعنة', 'خطأ', 'حقيقة', 'سر', 'لا يريدك', 'الوجه الآخر'],
      patterns: [/لماذا.*(?:فشل|خطأ|لعنة)/i, /ما لا.*(?:تعرف|يخبرك)/i]
    },
    contentType: 'long_form'
  },
  
  strategic_howto: {
    id: 'strategic_howto',
    name: 'Strategic Analysis',
    name_ar: 'التحليل الاستراتيجي',
    formula: 'How weaker party plans to defeat stronger opponent',
    triggers: {
      keywords: ['كيف', 'خطة', 'استراتيجية', 'تكتيك', 'يخطط', 'يواجه'],
      patterns: [/كيف.*(?:تخطط|يخطط|تواجه)/i, /خطة.*(?:لـ|ل)/i]
    },
    contentType: 'long_form'
  },
  
  superpower_clash: {
    id: 'superpower_clash',
    name: 'Superpower Competition',
    name_ar: 'صراع القوى العظمى',
    formula: 'Frame regional issue as US vs China/Russia competition',
    triggers: {
      keywords: ['أمريكا', 'الصين', 'روسيا', 'صراع', 'مواجهة', 'تنافس', 'vs'],
      entities: { countries: ['USA', 'China', 'Russia'] }
    },
    contentType: 'both'
  },
  
  economic_stakes: {
    id: 'economic_stakes',
    name: 'Economic Stakes',
    name_ar: 'الرهانات الاقتصادية',
    formula: 'Highlight massive economic value at stake',
    triggers: {
      keywords: ['نفط', 'مليار', 'ثروة', 'اقتصاد', 'أكبر', 'احتياطي'],
      patterns: [/أكبر.*(?:احتياط|ثروة|اقتصاد)/i]
    },
    contentType: 'both'
  },
  
  question_hook: {
    id: 'question_hook',
    name: 'Question Hook',
    name_ar: 'خطاف السؤال',
    formula: 'Pose provocative question that challenges assumptions',
    triggers: {
      keywords: ['هل', 'لماذا', 'ماذا لو', 'متى', 'كيف'],
      patterns: [/^هل/i, /^لماذا/i, /^ماذا/i]
    },
    contentType: 'both'
  },
  
  // Short Form Patterns
  shocking_stat: {
    id: 'shocking_stat',
    name: 'Shocking Statistic',
    name_ar: 'الرقم الصادم',
    formula: 'Big number + unexpected twist',
    triggers: {
      keywords: ['أكبر', 'أكثر من', 'رقم', 'مليار', 'تريليون', '%'],
      patterns: [/\d+.*(?:مليار|مليون|%)/i, /أكثر من/i]
    },
    contentType: 'short_form',
    shortFormType: 'micro'
  },
  
  bold_claim: {
    id: 'bold_claim',
    name: 'Bold Claim',
    name_ar: 'الادعاء الجريء',
    formula: 'Controversial statement + quick proof',
    triggers: {
      keywords: ['فشل', 'كذب', 'خدعة', 'حقيقة صادمة', 'لن تصدق'],
      patterns: [/فشل.*(?:قبل|في)/i]
    },
    contentType: 'short_form',
    shortFormType: 'micro'
  },
  
  quick_explainer: {
    id: 'quick_explainer',
    name: 'Quick Explainer',
    name_ar: 'الشرح السريع',
    formula: 'Complex topic explained simply',
    triggers: {
      keywords: ['ببساطة', 'باختصار', 'في دقيقة', 'شرح', 'فهم'],
      patterns: [/ببساطة/i, /في.*(?:ثانية|دقيقة)/i]
    },
    contentType: 'short_form',
    shortFormType: 'mini_explainer'
  },
  
  mini_story: {
    id: 'mini_story',
    name: 'Mini Documentary',
    name_ar: 'القصة المصغرة',
    formula: 'Complete narrative arc in 2-3 minutes',
    triggers: {
      keywords: ['قصة', 'كيف تحول', 'رحلة', 'من...إلى'],
      patterns: [/كيف تحول/i, /قصة/i]
    },
    contentType: 'short_form',
    shortFormType: 'short_story'
  }
};

/**
 * Analyze a show's videos to extract winning patterns
 */
export async function analyzeShowPatterns(showId, options = {}) {
  const { 
    minVideos = 10,
    lookbackDays = 365,
    forceRefresh = false 
  } = options;
  
  console.log(`📊 Analyzing patterns for show ${showId}...`);
  
  // Get show's videos
  const { data: videos, error } = await supabase
    .from('channel_videos')
    .select('*')
    .eq('show_id', showId)
    .order('views', { ascending: false });
  
  if (error || !videos || videos.length < minVideos) {
    console.log(`Not enough videos for analysis (${videos?.length || 0})`);
    return { patterns: [], stats: { videoCount: videos?.length || 0 } };
  }
  
  // Calculate show average
  const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
  const avgViews = Math.round(totalViews / videos.length);
  
  // Separate by format
  const longFormVideos = videos.filter(v => 
    v.format === 'Long' || !v.format || (v.duration_seconds && v.duration_seconds > 180)
  );
  const shortFormVideos = videos.filter(v => 
    v.format === 'Short' || (v.duration_seconds && v.duration_seconds <= 180)
  );
  
  // Analyze patterns for each format
  const longFormPatterns = await analyzeVideoPatterns(longFormVideos, avgViews, 'long_form');
  const shortFormPatterns = await analyzeVideoPatterns(shortFormVideos, avgViews, 'short_form');
  
  const allPatterns = [...longFormPatterns, ...shortFormPatterns];
  
  // Deduplicate patterns by pattern_id (same pattern can appear in both long and short form)
  const uniquePatterns = [];
  const seenIds = new Set();
  
  for (const pattern of allPatterns) {
    if (!seenIds.has(pattern.id)) {
      seenIds.add(pattern.id);
      uniquePatterns.push(pattern);
    }
  }
  
  // Save patterns to database
  for (const pattern of uniquePatterns) {
    await savePattern(showId, pattern);
  }
  
  console.log(`📊 Found ${uniquePatterns.length} unique patterns for show (${allPatterns.length} before deduplication)`);
  
  return {
    patterns: uniquePatterns,
    stats: {
      videoCount: videos.length,
      longFormCount: longFormVideos.length,
      shortFormCount: shortFormVideos.length,
      avgViews,
      topPatterns: allPatterns.slice(0, 5).map(p => p.name)
    }
  };
}

/**
 * Analyze videos to find matching patterns
 */
async function analyzeVideoPatterns(videos, showAvgViews, contentType) {
  const patternMatches = {};
  
  // Initialize pattern tracking
  for (const [patternId, pattern] of Object.entries(BASE_PATTERNS)) {
    if (pattern.contentType === contentType || pattern.contentType === 'both') {
      patternMatches[patternId] = {
        ...pattern,
        matchedVideos: [],
        totalViews: 0
      };
    }
  }
  
  // Match each video to patterns
  for (const video of videos) {
    const title = video.title || '';
    const matchedPatterns = [];
    
    for (const [patternId, pattern] of Object.entries(patternMatches)) {
      if (matchesPattern(title, pattern.triggers)) {
        patternMatches[patternId].matchedVideos.push(video);
        patternMatches[patternId].totalViews += video.views || 0;
        matchedPatterns.push(patternId);
      }
    }
    
    // Update video with matched patterns (optional)
    if (matchedPatterns.length > 0) {
      video.matchedPatterns = matchedPatterns;
      video.primaryPattern = matchedPatterns[0];
    }
  }
  
  // Calculate pattern statistics
  const analyzedPatterns = [];
  
  for (const [patternId, data] of Object.entries(patternMatches)) {
    if (data.matchedVideos.length >= 2) { // Minimum 2 videos to count
      const avgPatternViews = Math.round(data.totalViews / data.matchedVideos.length);
      const successRate = avgPatternViews / showAvgViews;
      
      analyzedPatterns.push({
        id: patternId,
        name: data.name,
        name_ar: data.name_ar,
        formula: data.formula,
        contentType: data.contentType,
        shortFormType: data.shortFormType,
        triggers: data.triggers,
        videoCount: data.matchedVideos.length,
        totalViews: data.totalViews,
        avgViews: avgPatternViews,
        successRate: Math.round(successRate * 100) / 100,
        confidence: calculateConfidence(data.matchedVideos.length, successRate),
        exampleVideos: data.matchedVideos.slice(0, 3).map(v => ({
          id: v.id,
          title: v.title,
          views: v.views
        }))
      });
    }
  }
  
  // Sort by success rate * confidence
  return analyzedPatterns.sort((a, b) => 
    (b.successRate * b.confidence) - (a.successRate * a.confidence)
  );
}

/**
 * Check if title matches pattern triggers
 */
function matchesPattern(title, triggers) {
  if (!title || !triggers) return false;
  
  const titleLower = title.toLowerCase();
  
  // Check keywords
  if (triggers.keywords) {
    for (const keyword of triggers.keywords) {
      if (titleLower.includes(keyword.toLowerCase())) {
        return true;
      }
    }
  }
  
  // Check regex patterns
  if (triggers.patterns) {
    for (const pattern of triggers.patterns) {
      if (pattern.test(title)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Calculate confidence based on sample size and success rate
 */
function calculateConfidence(videoCount, successRate) {
  // More videos = higher confidence
  const sampleConfidence = Math.min(videoCount / 10, 1); // Max at 10 videos
  
  // Success rate affects confidence
  const performanceConfidence = successRate > 1 ? Math.min(successRate - 0.5, 1) : successRate;
  
  return Math.round((sampleConfidence * 0.6 + performanceConfidence * 0.4) * 100) / 100;
}

/**
 * Save pattern to database
 */
async function savePattern(showId, pattern) {
  try {
    await supabase
      .from('show_winning_patterns')
      .upsert({
        show_id: showId,
        pattern_id: pattern.id,
        pattern_name: pattern.name,
        pattern_name_ar: pattern.name_ar,
        formula: pattern.formula,
        content_type: pattern.contentType,
        short_form_subtype: pattern.shortFormType,
        trigger_keywords: pattern.triggers?.keywords || [],
        trigger_entities: pattern.triggers?.entities || {},
        video_count: pattern.videoCount,
        total_views: pattern.totalViews,
        avg_views: pattern.avgViews,
        success_rate: pattern.successRate,
        confidence: pattern.confidence,
        example_video_ids: pattern.exampleVideos?.map(v => v.id) || [],
        example_titles: pattern.exampleVideos?.map(v => v.title) || [],
        updated_at: new Date().toISOString(),
        last_analyzed_at: new Date().toISOString()
      }, { onConflict: 'show_id,pattern_id' });
  } catch (error) {
    console.error('Error saving pattern:', error);
  }
}

/**
 * Get patterns for a show
 */
export async function getShowWinningPatterns(showId, contentType = null) {
  let query = supabase
    .from('show_winning_patterns')
    .select('*')
    .eq('show_id', showId)
    .order('success_rate', { ascending: false });
  
  if (contentType) {
    query = query.or(`content_type.eq.${contentType},content_type.eq.both`);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error getting patterns:', error);
    return [];
  }
  
  return data || [];
}
