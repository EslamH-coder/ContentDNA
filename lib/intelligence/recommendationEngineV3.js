/**
 * RECOMMENDATION ENGINE V3
 * Evidence-First, Persona-Matched, No Duplicates
 */

import { dataStore } from '../data/dataStore.js';
import { collectEvidence } from './evidenceCollector.js';
import { deduplicateItems, isDuplicate } from './deduplicator.js';
import { generatePitch } from '../ai/claudePitcher.js';
import { evaluateSignal } from '../ai/signalEvaluator.js';
import { analyzeAudienceBehavior, formatBehaviorForUI } from './audienceBehavior.js';

// ============================================
// SANITIZE EVIDENCE (Remove circular refs)
// ============================================
function sanitizeEvidence(evidence) {
  if (!evidence) return evidence;
  
  const sanitized = {};
  
  // Handle both naming conventions (search/searchEvidence, etc.)
  const searchEv = evidence.search || evidence.searchEvidence;
  const audienceEv = evidence.audience || evidence.audienceEvidence;
  const competitorEv = evidence.competitor || evidence.competitorEvidence;
  const commentsEv = evidence.comments || evidence.commentEvidence;
  
  // Sanitize search evidence
  if (searchEv) {
    sanitized.search = {
      found: searchEv.found || false,
      score: searchEv.score || 0,
      totalViews: searchEv.totalViews || 0,
      summary: searchEv.summary || '',
      matchedTerms: (searchEv.matchedTerms || []).map(term => {
        // Handle both object and string formats
        if (typeof term === 'string') {
          return { term, views: 0 };
        }
        return {
          term: term.term || term,
          views: term.views || 0
        };
      })
    };
  }
  
  // Sanitize audience evidence (remove any circular refs)
  if (audienceEv) {
    sanitized.audience = {
      found: audienceEv.found || false,
      score: audienceEv.score || 0,
      summary: audienceEv.summary || '',
      matchedVideos: (audienceEv.matchedVideos || []).map(video => ({
        id: video.id,
        title: video.title,
        url: video.url || video.link,
        views: video.views,
        publishedAt: video.publishedAt || video.date
      }))
    };
  }
  
  // Sanitize competitor evidence
  if (competitorEv) {
    sanitized.competitor = {
      found: competitorEv.found || false,
      score: competitorEv.score || 0,
      summary: competitorEv.summary || '',
      recentCoverage: competitorEv.recentCoverage || false,
      matchedVideos: (competitorEv.matchedVideos || []).map(video => ({
        id: video.id,
        title: video.title,
        url: video.url || video.link,
        channel: video.channel,
        publishedAt: video.publishedAt || video.date
      })),
      channels: competitorEv.channels instanceof Set 
        ? [...competitorEv.channels] 
        : (Array.isArray(competitorEv.channels) ? competitorEv.channels : [])
    };
  }
  
  // Sanitize comment evidence
  if (commentsEv) {
    sanitized.comments = {
      found: commentsEv.found || false,
      score: commentsEv.score || 0,
      summary: commentsEv.summary || '',
      matchedRequests: (commentsEv.matchedRequests || []).map(req => ({
        text: req.text,
        extractedRequest: req.analysis?.extractedRequest,
        videoIdea: req.analysis?.videoIdea
      }))
    };
  }
  
  // Include scores (should be safe, but make a copy)
  if (evidence.scores) {
    sanitized.scores = { ...evidence.scores };
  }
  
  return sanitized;
}

// ============================================
// MAIN: GENERATE RECOMMENDATIONS
// ============================================
export async function generateRecommendations(inputs = {}) {
  const startTime = Date.now();
  
  console.log('\n' + '═'.repeat(60));
  console.log('🎯 360° CONTENT INTELLIGENCE V3');
  console.log('   Evidence-First • Persona-Matched • No Duplicates');
  console.log('═'.repeat(60));

  // Load all data
  try {
    await dataStore.load();
    dataStore.resetDeduplication();
  } catch (error) {
    console.error('❌ Failed to load data store:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    // Re-throw with more context
    throw new Error(`Failed to load data store: ${error.message}. This may be due to missing data files or file system issues.`);
  }

  const {
    rssItems = [],
    manualTrends = [],
    limit = 20
  } = inputs;

  const allCandidates = [];
  const processedTopics = [];

  // ============================================
  // PHASE 1: COLLECT ALL CANDIDATES
  // ============================================
  console.log('\n📡 Phase 1: Collecting candidates...');

  // 1.1 RSS Items (deduplicated)
  const uniqueRss = deduplicateItems(rssItems, 'title');
  console.log(`   RSS: ${rssItems.length} → ${uniqueRss.length} unique`);
  
  for (const item of uniqueRss.slice(0, 30)) {
    const title = item.title || item;
    if (!isDuplicate(title, processedTopics)) {
      allCandidates.push({
        topic: title,
        description: item.description || '',
        source: 'RSS',
        sourceUrl: item.link || item.url,
        sourceName: item.source || 'News',
        originalItem: item
      });
      processedTopics.push(title);
    }
  }

  // 1.2 Manual Trends (deduplicated)
  const uniqueTrends = deduplicateItems(manualTrends, 'topic');
  console.log(`   Manual Trends: ${manualTrends.length} → ${uniqueTrends.length} unique`);
  
  for (const trend of uniqueTrends) {
    const topic = trend.topic || trend.note || trend.url;
    if (!isDuplicate(topic, processedTopics)) {
      allCandidates.push({
        topic,
        description: trend.note || '',
        source: 'MANUAL',
        sourceUrl: trend.url,
        sourceName: trend.type || 'Manual',
        originalItem: trend
      });
      processedTopics.push(topic);
    }
  }

  // 1.3 High-demand search terms (proactive suggestions)
  const data = await dataStore.load();
  const topSearchTerms = (data.searchTerms || [])
    .filter(t => t.views > 1000)
    .slice(0, 10);
  
  for (const term of topSearchTerms) {
    if (!isDuplicate(term.term, processedTopics)) {
      allCandidates.push({
        topic: term.term,
        description: `${term.views} بحث`,
        source: 'SEARCH_DEMAND',
        sourceUrl: null,
        sourceName: 'Search Terms',
        originalItem: term
      });
      processedTopics.push(term.term);
    }
  }

  console.log(`   Total candidates: ${allCandidates.length}`);

  // ============================================
  // PHASE 2: COLLECT EVIDENCE FOR EACH
  // ============================================
  console.log('\n🔍 Phase 2: Collecting evidence...');

  const withEvidence = [];
  
  for (let i = 0; i < allCandidates.length; i++) {
    const candidate = allCandidates[i];
    
    try {
      // Collect evidence
      const evidence = await collectEvidence(candidate.topic, candidate.description);
      
      // Only keep if has evidence OR is manual trend
      if (evidence.hasEvidence || candidate.source === 'MANUAL') {
        // Use evidence total score, but ensure it's at least 1 if evidence exists
        let finalScore = candidate.source === 'MANUAL' 
          ? Math.min(100, evidence.scores.total + 15) // Bonus for manual
          : evidence.scores.total;
        
        // If we have evidence but score is 0, give minimum score based on evidence strength
        if (finalScore === 0 && evidence.hasEvidence) {
          if (evidence.evidenceStrength === 'STRONG') finalScore = 60;
          else if (evidence.evidenceStrength === 'MODERATE') finalScore = 40;
          else if (evidence.evidenceStrength === 'WEAK') finalScore = 20;
        }
        
        withEvidence.push({
          ...candidate,
          evidence,
          score: finalScore
        });
      }
    } catch (e) {
      console.warn(`   Error processing candidate "${candidate.topic}":`, e.message);
    }
    
    // Progress
    if ((i + 1) % 10 === 0) {
      console.log(`   Processed ${i + 1}/${allCandidates.length}`);
    }
  }

  console.log(`   With evidence: ${withEvidence.length}`);

  // ============================================
  // PHASE 3: RANK AND SELECT TOP
  // ============================================
  console.log('\n📊 Phase 3: Ranking...');

  // Sort by score
  withEvidence.sort((a, b) => b.score - a.score);

  // Select top candidates
  const topCandidates = withEvidence.slice(0, limit);

  // ============================================
  // PHASE 4: EVALUATE + GENERATE PITCHES (Two-Step)
  // ============================================
  console.log('\n✍️ Phase 4: Evaluate + Generate pitches (Top 10)...');

  const recommendations = [];
  const skipped = [];

  for (const candidate of topCandidates.slice(0, 10)) {
    try {
      // STEP 1: EVALUATE - Is this signal worth covering?
      console.log(`\n   📰 Evaluating: "${(candidate.topic || '').substring(0, 40)}..."`);
      
      let evaluation = { decision: 'PROCEED', confidence: 5, reason: 'Default pass', relevance_type: 'global_trend', suggested_angle: null };
      try {
        evaluation = await evaluateSignal({
          title: candidate.topic || candidate.originalItem?.title || '',
          description: candidate.description || candidate.originalItem?.description || '',
          source: candidate.sourceName || candidate.source || candidate.originalItem?.source || 'RSS',
          pubDate: candidate.originalItem?.pubDate || candidate.originalItem?.date || ''
        });
        console.log(`      → ${evaluation.decision} (${evaluation.confidence}/10): ${evaluation.reason}`);
      } catch (e) {
        console.warn('      ⚠️ Evaluation failed, proceeding anyway:', e.message);
      }
      
      // If SKIP, add to skipped list and continue
      if (evaluation.decision === 'SKIP') {
        skipped.push({
          topic: candidate.topic,
          reason: evaluation.reason,
          confidence: evaluation.confidence
        });
        continue; // Skip to next candidate
      }
      
      // STEP 1.5: ANALYZE AUDIENCE BEHAVIOR (understand WHY they care)
      console.log(`   🧠 Analyzing audience behavior...`);
      let behaviorAnalysis = null;
      let behaviorUI = null;
      try {
        behaviorAnalysis = analyzeAudienceBehavior({
          title: candidate.topic,
          description: candidate.description || candidate.originalItem?.description || '',
          topic: candidate.topic
        });
        behaviorUI = formatBehaviorForUI(behaviorAnalysis);
        if (behaviorUI) {
          console.log(`      → Primary interest: ${behaviorUI.primaryInterest?.name} (${behaviorUI.relevanceScore}% relevance)`);
        }
      } catch (e) {
        console.warn('      ⚠️ Behavior analysis failed:', e.message);
      }
      
      // STEP 2: GENERATE PITCH (only if evaluation passed)
      let pitchResult = { success: false, pitch: null };
      try {
        pitchResult = await generatePitch(
          candidate.topic,
          candidate.evidence,
          {
            format: candidate.score >= 70 ? 'long' : 'short',
            // Pass behavior insights to pitch generator if available
            behaviorInsights: behaviorUI?.pitchSuggestions || []
          }
        );
      } catch (e) {
        console.warn('      ⚠️ Pitch generation failed:', e.message);
      }

      recommendations.push({
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        
        // Topic info
        topic: candidate.topic,
        source: candidate.source,
        sourceUrl: candidate.sourceUrl,
        sourceName: candidate.sourceName,
        
        // Scoring
        score: {
          total: candidate.score,
          breakdown: {
            search: candidate.evidence.scores.search,
            audience: candidate.evidence.scores.audience,
            competitor: candidate.evidence.scores.competitor,
            comments: candidate.evidence.scores.comments,
            persona: candidate.evidence.scores.persona
          }
        },
        recommendationLevel: candidate.evidence.recommendationLevel,
        evidenceStrength: candidate.evidence.evidenceStrength,
        recommendation: candidate.evidence.recommendationLevel, // Also add as 'recommendation' for compatibility
        
        // Evaluation result
        evaluation: {
          decision: evaluation.decision,
          confidence: evaluation.confidence,
          reason: evaluation.reason,
          relevanceType: evaluation.relevance_type,
          suggestedAngle: evaluation.suggested_angle
        },
        
        // Audience Behavior Analysis
        behavior: behaviorUI,
        behaviorUI: behaviorUI, // Also add as behaviorUI for UI components
        behaviorAnalysis: behaviorAnalysis ? {
          primaryCluster: behaviorAnalysis.primaryCluster?.clusterName,
          relevanceScore: behaviorAnalysis.overallRelevance,
          matchedClusters: behaviorAnalysis.matchedClusters.length
        } : null,
        
        // Evidence details (sanitized to remove circular refs)
        evidence: sanitizeEvidence({
          search: candidate.evidence.searchEvidence || candidate.evidence.search,
          audience: candidate.evidence.audienceEvidence || candidate.evidence.audience,
          competitor: candidate.evidence.competitorEvidence || candidate.evidence.competitor,
          comments: candidate.evidence.commentEvidence || candidate.evidence.comments,
          scores: candidate.evidence.scores
        }),
        
        // Persona
        persona: candidate.evidence.personaMatch?.primaryPersona || null,
        secondaryPersonas: candidate.evidence.personaMatch?.secondaryPersonas || [],
        
        // Pitch
        pitch: pitchResult.success ? pitchResult.pitch : null,
        
        // Format suggestion
        suggestedFormat: candidate.score >= 70 ? 'long' : 'short',
        
        // Timestamp
        generatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error(`   Error processing candidate "${candidate.topic}":`, e.message);
    }
  }
  
  // Log skipped items
  if (skipped.length > 0) {
    console.log(`\n   ❌ Skipped ${skipped.length} items:`);
    skipped.forEach(s => console.log(`      - "${(s.topic || '').substring(0, 40)}..." → ${s.reason}`));
  }

  // Add remaining without full pitches (but still include behavior analysis)
  for (const candidate of topCandidates.slice(10)) {
    // Analyze behavior for remaining items too
    let behaviorAnalysis = null;
    let behaviorUI = null;
    try {
      behaviorAnalysis = analyzeAudienceBehavior({
        title: candidate.topic,
        description: candidate.description || candidate.originalItem?.description || '',
        topic: candidate.topic
      });
      behaviorUI = formatBehaviorForUI(behaviorAnalysis);
    } catch (e) {
      console.warn(`   ⚠️ Behavior analysis failed for "${candidate.topic}":`, e.message);
    }
    
    recommendations.push({
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topic: candidate.topic,
      source: candidate.source,
      sourceUrl: candidate.sourceUrl,
      score: candidate.score,
      recommendationLevel: candidate.evidence.recommendationLevel,
      evidenceStrength: candidate.evidence.evidenceStrength,
      // Audience Behavior Analysis
      behavior: behaviorUI,
      behaviorUI: behaviorUI,
      behaviorAnalysis: behaviorAnalysis ? {
        primaryCluster: behaviorAnalysis.primaryCluster?.clusterName,
        relevanceScore: behaviorAnalysis.overallRelevance,
        matchedClusters: behaviorAnalysis.matchedClusters.length
      } : null,
      // Evidence details (sanitized to remove circular refs)
      evidence: sanitizeEvidence({
        search: candidate.evidence.searchEvidence,
        audience: candidate.evidence.audienceEvidence,
        competitor: candidate.evidence.competitorEvidence,
        comments: candidate.evidence.commentEvidence,
        scores: candidate.evidence.scores
      }),
      persona: candidate.evidence.personaMatch?.primaryPersona || null,
      pitch: null, // No pitch for lower-ranked items
      suggestedFormat: 'short',
      generatedAt: new Date().toISOString()
    });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Generated ${recommendations.length} recommendations in ${elapsed}s`);
  if (skipped.length > 0) {
    console.log(`   ❌ Skipped ${skipped.length} items during evaluation`);
  }

  return {
    recommendations,
    skipped: skipped.length > 0 ? skipped : undefined,
    summary: generateSummary(recommendations),
    stats: {
      totalCandidates: allCandidates.length,
      withEvidence: withEvidence.length,
      final: recommendations.length,
      skipped: skipped.length,
      processingTime: elapsed
    }
  };
}

// ============================================
// GENERATE SUMMARY
// ============================================
function generateSummary(recommendations) {
  const byLevel = {
    HIGHLY_RECOMMENDED: [],
    RECOMMENDED: [],
    CONSIDER: [],
    SKIP: []
  };

  const byPersona = {};

  for (const rec of recommendations) {
    byLevel[rec.recommendationLevel]?.push(rec);
    
    if (rec.persona) {
      const pId = rec.persona.id;
      if (!byPersona[pId]) byPersona[pId] = [];
      byPersona[pId].push(rec);
    }
  }

  return {
    byLevel,
    byPersona,
    topPick: recommendations[0] || null,
    stats: {
      highlyRecommended: byLevel.HIGHLY_RECOMMENDED.length,
      recommended: byLevel.RECOMMENDED.length,
      consider: byLevel.CONSIDER.length
    }
  };
}

