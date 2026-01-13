import { ENHANCED_DNA } from '../dna/enhancedDna.js';
import { applyRetentionGates, gate_CeilingDetection } from '../gates/retentionGates.js';
import { findBestHookPattern } from '../hooks/hookMatcher.js';
import { generateBrief, generateShortBrief } from '../briefs/beatGenerator.js';
import { classifyItem } from '../recommendation/classifier.js';
import { detectStoryType } from '../recommendation/storyTypes.js';

/**
 * ENHANCED RECOMMENDATION PIPELINE
 * Integrates: Retention gates, Hook patterns, Beat structure, Ceiling detection
 */
export async function enhancedRecommend(rssItem, options = {}) {
  const result = {
    status: null,
    item: rssItem,
    analysis: {},
    decisions: {},
    brief: null,
    warnings: [],
    rejection_reason: null
  };
  
  // ============================================
  // STEP 1: Basic Classification
  // ============================================
  const classification = classifyItem(rssItem);
  const storyType = detectStoryType(`${rssItem.title || ''} ${rssItem.description || ''}`);
  const topicId = classification.classification?.topic?.primary_topic;
  
  result.analysis.classification = classification.classification;
  result.analysis.storyType = storyType;
  
  // ============================================
  // STEP 2: CEILING DETECTION (Critical!)
  // ============================================
  const ceilingCheck = gate_CeilingDetection(topicId);
  
  if (ceilingCheck.has_ceiling) {
    result.status = 'CEILING_TOPIC';
    result.rejection_reason = ceilingCheck.reason;
    result.decisions = {
      recommendation: 'SKIP or SHORT only',
      reason: ceilingCheck.insight,
      metrics: ceilingCheck.metrics
    };
    
    // Generate short brief only for ceiling topics
    if (options.includeShortBrief) {
      result.brief = generateShortBrief(rssItem, {
        extracted: {
          numbers: classification.classification?.numbers || []
        },
        storyType
      });
    }
    
    return result;
  }
  
  // ============================================
  // STEP 3: RETENTION GATES
  // ============================================
  const retentionGates = applyRetentionGates(rssItem, classification.classification);
  result.analysis.retentionGates = retentionGates;
  
  if (!retentionGates.passed) {
    result.status = 'REJECTED_RETENTION';
    result.rejection_reason = retentionGates.recommendation;
    return result;
  }
  
  if (retentionGates.warnings.length > 0) {
    result.warnings.push(...retentionGates.warnings);
  }
  
  // ============================================
  // STEP 4: HOOK PATTERN MATCHING
  // ============================================
  const hookAnalysis = findBestHookPattern(rssItem);
  result.analysis.hook = hookAnalysis;
  
  if (!hookAnalysis.best_pattern) {
    result.warnings.push('No strong hook pattern match - angle may need restructuring');
  }
  
  // ============================================
  // STEP 5: FORMAT DECISION (with retention data)
  // ============================================
  const topic = ENHANCED_DNA.topics.find(t => t.topic_id === topicId);
  
  let formatDecision;
  if (topic?.format_recommendation) {
    formatDecision = topic.format_recommendation;
  } else if (retentionGates.gates.viral?.potential === 'HIGH') {
    formatDecision = 'LONG';
  } else if (retentionGates.gates.viral?.potential === 'MEDIUM') {
    formatDecision = 'BOTH';
  } else {
    formatDecision = 'SHORT_FIRST';
  }
  
  result.decisions.format = {
    decision: formatDecision,
    reason: topic?.insight || 'Based on viral potential analysis'
  };
  
  // ============================================
  // STEP 6: GENERATE BRIEF (with beats)
  // ============================================
  if (formatDecision === 'LONG' || formatDecision === 'BOTH') {
    result.brief = generateBrief(rssItem, {
      hookPattern: hookAnalysis.best_pattern,
      storyType,
      extracted: {
        date: hookAnalysis.elements_extracted?.dates_found?.[0],
        entity: hookAnalysis.elements_extracted?.entities_found?.[0],
        numbers: hookAnalysis.elements_extracted?.numbers_found,
        entities: hookAnalysis.elements_extracted?.entities_found,
        regions: classification.classification?.entities?.regions
      },
      topic: topicId
    });
  }
  
  if (formatDecision === 'SHORT_FIRST' || formatDecision === 'BOTH') {
    result.shortBrief = generateShortBrief(rssItem, {
      extracted: {
        numbers: hookAnalysis.elements_extracted?.numbers_found
      },
      storyType
    });
  }
  
  // ============================================
  // STEP 7: FINAL RECOMMENDATION
  // ============================================
  result.status = 'RECOMMENDED';
  result.decisions.hook = {
    pattern: hookAnalysis.best_pattern?.name || 'Custom',
    expected_retention: hookAnalysis.best_pattern?.expected_retention || 74,
    template: hookAnalysis.hook_template
  };
  
  result.summary = {
    topic: topicId,
    topic_status: topic?.status || 'new',
    viral_potential: retentionGates.gates.viral?.potential || 'UNKNOWN',
    format: formatDecision,
    hook_pattern: hookAnalysis.best_pattern?.name || 'Custom',
    expected_retention: hookAnalysis.best_pattern?.expected_retention || 74,
    warnings: result.warnings
  };
  
  return result;
}

/**
 * Process batch with enhanced pipeline
 */
export async function enhancedRecommendBatch(rssItems, options = {}) {
  const results = {
    recommended: [],
    ceiling: [],
    rejected: [],
    stats: {
      total: rssItems.length,
      recommended: 0,
      ceiling: 0,
      rejected: 0
    }
  };
  
  for (const item of rssItems) {
    const result = await enhancedRecommend(item, options);
    
    switch (result.status) {
      case 'RECOMMENDED':
        results.recommended.push(result);
        results.stats.recommended++;
        break;
      case 'CEILING_TOPIC':
        results.ceiling.push(result);
        results.stats.ceiling++;
        break;
      default:
        results.rejected.push(result);
        results.stats.rejected++;
    }
  }
  
  // Sort recommended by viral potential
  const potentialOrder = { HIGH: 0, MEDIUM: 1, LOW: 2, UNKNOWN: 3 };
  results.recommended.sort((a, b) => 
    potentialOrder[a.summary.viral_potential] - potentialOrder[b.summary.viral_potential]
  );
  
  return results;
}

