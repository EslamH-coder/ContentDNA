import { parseStory, isArabLocation } from './storyParser.js';
import { generateAngles } from './angleGenerator.js';
import { scoreAngles, selectBestAngles } from './angleScorer.js';
import { classifyItem } from './classifier.js';
import { filterWithDna } from './filter.js';
import { enrichWithDna } from './enricher.js';
import { makeDecisions } from '../decisions/decisionEngine.js';
import { validateVoice, suggestFixes } from '../voice/voiceValidator.js';
import { processNewsItemWithTemplates } from '../pipeline/templatePipeline.js';
import { processNewsWithDNA } from '../pipeline/dnaInformedPipeline.js';
import { analyzeBehaviorPatterns } from '../behavior/behaviorAnalyzer.js';
import { reframeContent } from '../behavior/behaviorReframer.js';

/**
 * Smart recommendation pipeline
 * Story-first, not template-first
 */
export async function smartRecommend(rssItem, showDna, options = {}) {
  const { recentTitles = [], topCount = 3, llmClient = null } = options;
  
  // Step 0: Analyze behavior patterns (NEW - makes ANY topic work)
  const behaviorAnalysis = analyzeBehaviorPatterns(rssItem);
  
  // Step 1: Classify (topic, entities, signals)
  const classified = classifyItem(rssItem);
  
  // Step 2: Filter against DNA (reject bad fits)
  const filterResult = filterWithDna(classified, showDna);
  
  if (!filterResult.passed) {
    return {
      status: 'REJECTED',
      item: rssItem,
      reasons: filterResult.rejections,
      score: filterResult.final_score || 0,
      behavior_analysis: behaviorAnalysis // Include behavior analysis even if rejected
    };
  }
  
  // Step 2.5: Check behavior patterns - if too weak, suggest reframing
  if (behaviorAnalysis.patterns_matched < 3) {
    const reframe = reframeContent(rssItem, behaviorAnalysis);
    // Don't reject, but flag for reframing
    rssItem._needs_reframe = true;
    rssItem._reframe_suggestions = reframe;
  }
  
  // Step 3: Enrich with DNA decisions
  const enriched = enrichWithDna(classified, filterResult, showDna);
  
  // Step 4: Parse the STORY (understand what's happening)
  const story = parseStory(rssItem);
  
  // Step 5: Generate MULTIPLE angles
  const angles = generateAngles(story);
  
  if (angles.length === 0) {
    return {
      status: 'NO_ANGLES',
      item: rssItem,
      story,
      note: 'Could not generate meaningful angles'
    };
  }
  
  // Step 5.5: Filter out angles with banned phrases (voice validation)
  const validAngles = [];
  const rejectedAngles = [];
  
  for (const angle of angles) {
    const validation = validateVoice(angle.text_ar || '');
    if (validation.valid || validation.score >= 60) {
      // Add voice score to angle for later use
      angle.voice_score = validation.score;
      angle.voice_status = validation.status;
      validAngles.push(angle);
    } else {
      rejectedAngles.push({
        angle,
        reason: 'BANNED_PHRASE',
        validation
      });
    }
  }
  
  if (validAngles.length === 0) {
    return {
      status: 'REJECTED_VOICE',
      item: rssItem,
      story,
      note: 'All angles contain banned phrases or fail voice validation',
      rejected_angles: rejectedAngles
    };
  }
  
  // Step 6: Score angles (DNA fit + diversity)
  // Use only valid angles that passed voice validation
  const scored = scoreAngles(validAngles, story, showDna, recentTitles);
  
  // Step 7: Select best diverse angles
  const best = selectBestAngles(scored, topCount);
  
  // Step 8: Use DNA-INFORMED LLM generation (LLM has Channel DNA context)
  let finalTitle = best[0]?.text_ar || rssItem.title;
  let hookScript = '';
  let titleValidation = validateVoice(finalTitle);
  let dnaResult = null;
  
  // Try DNA-informed generation if LLM is available
  if (llmClient && best.length > 0 && enriched.decisions.confidence.level !== 'LOW') {
    try {
      // Use DNA-informed pipeline: LLM has full Channel DNA context
      dnaResult = await processNewsWithDNA(rssItem, llmClient);
      
      if (dnaResult.success) {
        // Validate DNA-generated title
        const dnaValidation = validateVoice(dnaResult.title);
        
        // Use DNA title if it's better or equal to angle-based title
        if (dnaValidation.valid && dnaValidation.score >= titleValidation.score) {
          finalTitle = dnaResult.title;
          hookScript = dnaResult.hook || '';
          titleValidation = dnaValidation;
          
          if (dnaResult.used_fallback) {
            console.log(`⚠️  DNA generation used fallback: ${dnaResult.metadata.fallback_reason || 'unknown'}`);
          } else {
            console.log(`✅ DNA-informed generation: ${finalTitle.substring(0, 50)}...`);
          }
        } else {
          console.log(`⚠️  DNA title validation score (${dnaValidation.score}) lower than angle title (${titleValidation.score}), using angle`);
        }
      } else {
        console.warn(`DNA generation failed: ${dnaResult.error}, using angle-based title`);
      }
    } catch (e) {
      console.warn('DNA generation failed, using angle-based title:', e.message);
    }
  }
  
  // NEW APPROACH: Don't reject - auto-fix has already handled it
  // If there are critical issues, they've been auto-fixed or we're using fallback
  // Always return content, but include validation info for UI warnings
  const hasCriticalIssues = !titleValidation.valid && titleValidation.issues.some(i => i.severity === 'CRITICAL');
  if (hasCriticalIssues) {
    console.warn(`⚠️  Title has critical issues but showing anyway (auto-fixed or fallback used): ${finalTitle.substring(0, 50)}...`);
  }
  
  return {
    status: 'RECOMMENDED',
    priority: filterResult.priority,
    
    // The story we understood
    story: {
      actor: story.elements.actor,
      affected: story.elements.affected,
      location: story.elements.location,
      timeline: story.elements.timeline,
      numbers: story.numbers,
      entities: story.entities,
      action: story.elements.action,
      story_type: story.type?.primary || 'SHIFT',
      story_type_ar: story.type?.primaryConfig?.name_ar || 'قصة',
      story_confidence: story.type?.confidence || 0
    },
    
    // Classification
    topic: classified.classification.topic.primary_topic,
    topic_confidence: classified.classification.topic.confidence,
    
    // Filter result
    filter_score: filterResult.final_score,
    filter_reasons: filterResult.reasons,
    
    // DNA decisions
    hook_type: enriched.decisions.hook.type,
    format: enriched.decisions.format.recommended,
    triggers: enriched.decisions.triggers,
    
    // Timing and format decisions
    timing_format: makeDecisions(rssItem, story.type, classified.classification, showDna),
    
    // THE OPTIONS (not one template!)
    angle_options: best.map(a => ({
      type: a.type,
      title_ar: a.text_ar,
      title_ar_alt: a.text_ar_v2 || null,
      score: a.score,
      why: a.why,
      score_reasons: a.reasons
    })),
    
    // Recommended pick (highest scoring, DNA-informed or angle-based)
    recommended: {
      title_ar: finalTitle,
      type: best[0]?.type || 'unknown',
      score: best[0]?.score || 0,
      hook_script_ar: hookScript || '',
      thumbnail_text_ar: story.numbers[0] || story.elements.actor || '',
      // DNA generation metadata if used
      dna_generation: dnaResult ? {
        used: true,
        used_fallback: dnaResult.used_fallback,
        fallback_reason: dnaResult.metadata?.fallback_reason,
        validation_warning: dnaResult.metadata?.validation_warning
      } : null,
      
      // Quality information (NEW - from auto-fix system)
      quality: dnaResult?.quality || null,
      titleQuality: dnaResult?.titleQuality || null,
      hookQuality: dnaResult?.hookQuality || null,
      qualityWarnings: dnaResult?.warnings || []
    },
    
    // Voice validation results
    voice_validation: {
      score: titleValidation.score,
      status: titleValidation.status,
      valid: titleValidation.valid,
      issues: titleValidation.issues,
      warnings: titleValidation.warnings,
      fixes: titleValidation.valid ? [] : suggestFixes(finalTitle, titleValidation)
    },
    
    // Template generation info (for debugging)
    template_generation: templateResult ? {
      used: templateResult.success,
      title_template: templateResult.metadata?.title_template,
      hook_template: templateResult.metadata?.hook_template,
      expected_views: templateResult.metadata?.expected_views
    } : null,
    
    // Behavior analysis (NEW - makes ANY topic work)
    behavior_analysis: {
      score: behaviorAnalysis.total_score,
      patterns_matched: behaviorAnalysis.patterns_matched,
      status: behaviorAnalysis.recommendation.status,
      patterns: {
        certainty: behaviorAnalysis.pattern1_certainty,
        power: behaviorAnalysis.pattern2_power,
        conflict: behaviorAnalysis.pattern3_conflict,
        arab_stakes: behaviorAnalysis.pattern4_arab,
        mobile_first: behaviorAnalysis.pattern5_mobile,
        personality: behaviorAnalysis.pattern6_personality
      },
      reframe_suggestions: rssItem._reframe_suggestions || null
    },
    
    // Original item
    original: rssItem
  };
}

/**
 * Process batch with diversity tracking
 * Now includes strict quality gates for filtering
 */
export async function smartRecommendBatch(rssItems, showDna, llmClient = null, options = {}) {
  const { useStrictGates = true, maxResults = 10, minScore = 75 } = options;
  
  // Map to store pre-computed decisions from strict gates
  let itemDecisionsMap = null;
  
  // Apply strict quality gates first (if enabled)
  // Always apply if enabled, regardless of item count (for quality)
  if (useStrictGates) {
    const { strictFilter, getFilterSummary } = await import('../filters/strictPipeline.js');
    const filtered = await strictFilter(rssItems, showDna, { maxResults, minScore });
    
    console.log('\n🎯 STRICT QUALITY GATES APPLIED:');
    const summary = getFilterSummary(filtered);
    console.log(`   ${summary.message}`);
    summary.funnel.forEach(f => {
      console.log(`   ${f.gate}: ${f.passed} passed, ${f.rejected} rejected`);
    });
    
    // Store decisions from strict gates before extracting items
    itemDecisionsMap = new Map();
    filtered.passed.forEach(passedItem => {
      // Use URL or title as key to match items
      const key = passedItem.item.url || passedItem.item.link || passedItem.item.title;
      if (key && passedItem.decisions) {
        itemDecisionsMap.set(key, passedItem.decisions);
      }
    });
    
    rssItems = filtered.passed.map(r => r.item);
    
    if (rssItems.length === 0) {
      return {
        recommended: [],
        rejected: [],
        stats: { total: filtered.stats.total, high: 0, medium: 0, low: 0, rejected: filtered.stats.total },
        filter_summary: summary
      };
    }
  }
  
  const results = {
    recommended: [],
    rejected: [],
    stats: { total: rssItems.length, high: 0, medium: 0, low: 0, rejected: 0 }
  };
  
  const recentTitles = []; // Track for diversity
  
  for (const item of rssItems) {
    const result = await smartRecommend(item, showDna, { 
      recentTitles, 
      topCount: 3,
      llmClient 
    });
    
    // If we have pre-computed decisions from strict gates, use them
    if (itemDecisionsMap && result.status === 'RECOMMENDED') {
      const key = item.url || item.link || item.title;
      const precomputedDecisions = itemDecisionsMap.get(key);
      if (precomputedDecisions) {
        result.timing_format = precomputedDecisions;
      }
    }
    
    if (result.status === 'REJECTED') {
      results.rejected.push(result);
      results.stats.rejected++;
    } else if (result.status === 'RECOMMENDED') {
      results.recommended.push(result);
      
      // Track this title for diversity in next items
      if (result.recommended?.title_ar) {
        recentTitles.push(result.recommended.title_ar);
        // Keep only last 10
        if (recentTitles.length > 10) recentTitles.shift();
      }
      
      if (result.priority === 'HIGH') results.stats.high++;
      else if (result.priority === 'MEDIUM') results.stats.medium++;
      else results.stats.low++;
    }
  }
  
  // Sort by score
  results.recommended.sort((a, b) => (b.recommended?.score || 0) - (a.recommended?.score || 0));
  
  // Limit to maxResults if strict gates were used
  if (useStrictGates && results.recommended.length > maxResults) {
    results.recommended = results.recommended.slice(0, maxResults);
  }
  
  return results;
}

