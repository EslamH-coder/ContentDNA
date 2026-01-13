/**
 * HYBRID RECOMMENDATION ENGINE V3
 * Groq for filtering + Claude for pitching
 */

import { filterNewsBatch } from '../ai/groqFilter.js';
import { generatePitch, generateQuickPitch } from '../ai/claudePitcher.js';
import { getPersonaStatus, getUnderservedPersonas } from '../personas/personaTracker.js';
import { scoreWithData } from './dataScorer.js';

// ============================================
// MAIN: GENERATE RECOMMENDATIONS
// ============================================
export async function generateRecommendations(rssItems = [], options = {}) {
  const startTime = Date.now();
  
  console.log('\n' + '═'.repeat(60));
  console.log('🎯 HYBRID INTELLIGENCE V3');
  console.log('═'.repeat(60));
  
  try {
    // Get persona status
    const personaStatus = await getPersonaStatus().catch(e => {
      console.warn('Failed to get persona status:', e.message);
      return { totalServed: 0, totalTarget: 14, personas: {} };
    });
    const underserved = await getUnderservedPersonas().catch(e => {
      console.warn('Failed to get underserved personas:', e.message);
      return [];
    });
    
    console.log(`\n📊 Persona Status: ${personaStatus.totalServed}/${personaStatus.totalTarget} this week`);
    
    // ============================================
    // STAGE 1: GROQ FILTERING (Fast & Cheap)
    // ============================================
    console.log('\n🔍 STAGE 1: Groq Filtering...');
    
    let filtered = [];
    if (rssItems && rssItems.length > 0) {
      try {
        filtered = await filterNewsBatch(rssItems.slice(0, 50));
        
        // If filtering returned nothing, use fallback
        if (filtered.length === 0) {
          console.log('   No items passed filter, using fallback mode');
          filtered = rssItems.slice(0, 20).map(item => ({
            ...(typeof item === 'object' ? item : { title: item }),
            isRelevant: true,
            relevanceScore: 50,
            primaryPersona: 'none'
          }));
        }
      } catch (e) {
        console.error('Groq filtering failed:', e.message);
        // Fallback: use all items with basic scoring
        filtered = rssItems.slice(0, 20).map(item => ({
          ...(typeof item === 'object' ? item : { title: item }),
          isRelevant: true,
          relevanceScore: 50,
          primaryPersona: 'none'
        }));
      }
    } else {
      console.log('   No RSS items provided, using manual trends only');
      // Try to get manual trends as fallback
      try {
        const { getPendingTrends } = await import('../intelligence/manualTrendInput.js');
        const trends = await getPendingTrends();
        filtered = trends.slice(0, 10).map(trend => ({
          title: trend.topic || trend.note || trend.url,
          isRelevant: true,
          relevanceScore: 60,
          primaryPersona: trend.persona || 'none',
          source: { type: 'MANUAL', subType: trend.type }
        }));
      } catch (e) {
        console.warn('Could not load manual trends:', e.message);
      }
    }
  
    // ============================================
    // STAGE 2: DATA SCORING
    // ============================================
    console.log('\n📊 STAGE 2: Data Scoring...');
    
    const scored = [];
    for (const item of filtered) {
      try {
        const dataScore = await scoreWithData(item.title || item).catch(e => {
          console.warn('Data scoring failed for item:', e.message);
          return { score: 0, evidence: [] };
        });
        scored.push({
          ...item,
          dataScore: dataScore.score || 0,
          dataEvidence: dataScore.evidence || [],
          totalScore: (item.relevanceScore || 50) * 0.4 + (dataScore.score || 0) * 0.6
        });
      } catch (e) {
        console.warn('Error scoring item:', e.message);
        scored.push({
          ...item,
          dataScore: 0,
          dataEvidence: [],
          totalScore: item.relevanceScore || 50
        });
      }
    }
    
    // Sort by total score
    scored.sort((a, b) => b.totalScore - a.totalScore);
    
    // ============================================
    // STAGE 3: CLAUDE PITCHING (Quality)
    // ============================================
    console.log('\n✍️ STAGE 3: Claude Pitching (Top 10)...');
    
    const topCandidates = scored.slice(0, Math.min(10, scored.length));
    const recommendations = [];
    
    for (const candidate of topCandidates) {
      try {
        // Check if this persona is underserved (boost priority)
        const personaPriority = underserved.find(p => p.id === candidate.primaryPersona);
        const priorityBoost = personaPriority ? 10 : 0;
        
        // Generate pitch with Claude (with error handling)
        let pitchResult = { success: false, pitch: null };
        try {
          pitchResult = await generatePitch(candidate.title || candidate, {
            persona: candidate.primaryPersona !== 'none' ? candidate.primaryPersona : null,
            evidence: candidate.dataEvidence?.map(e => e.summary) || [],
            format: candidate.totalScore > 70 ? 'long' : 'short'
          });
        } catch (e) {
          console.warn('Claude pitch generation failed:', e.message);
        }
        
        recommendations.push({
          id: candidate.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          
          // Original data
          topic: candidate.title || candidate,
          title: candidate.title || candidate,
          originalUrl: candidate.link || candidate.url,
          source: candidate.source || { type: 'RSS' },
          
          // Scoring
          score: Math.min(100, candidate.totalScore + priorityBoost),
          relevanceScore: candidate.relevanceScore || 50,
          dataScore: candidate.dataScore || 0,
          
          // Persona
          primaryPersona: candidate.primaryPersona !== 'none' ? candidate.primaryPersona : null,
          personaPriority: personaPriority?.priority || 'NORMAL',
          
          // Evidence
          evidence: candidate.dataEvidence || [],
          
          // AI-generated pitch (from Claude!)
          pitch: pitchResult.success ? pitchResult.pitch : null,
          
          // Recommendation
          recommendation: getRecommendationLevel(candidate.totalScore + priorityBoost),
          urgency: candidate.urgency || 'this_week'
        });
      } catch (e) {
        console.error('Error processing candidate:', e.message);
      }
    }
  
    // Sort by final score
    recommendations.sort((a, b) => b.score - a.score);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Generated ${recommendations.length} recommendations in ${elapsed}s`);
    
    return {
      recommendations,
      personaStatus,
      underserved,
      stats: {
        processed: rssItems.length || 0,
        filtered: filtered.length,
        recommended: recommendations.length,
        processingTime: elapsed
      }
    };
  } catch (error) {
    console.error('Engine error:', error);
    return {
      recommendations: [],
      personaStatus: { totalServed: 0, totalTarget: 14, personas: {} },
      underserved: [],
      stats: {
        processed: 0,
        filtered: 0,
        recommended: 0,
        processingTime: '0',
        error: error.message
      },
      error: error.message
    };
  }
}

// ============================================
// QUICK PITCH FOR SINGLE ITEM
// ============================================
export async function pitchSingleItem(item) {
  const dataScore = await scoreWithData(item.title || item);
  
  const pitchResult = await generatePitch(item.title || item, {
    persona: item.primaryPersona || dataScore.topPersona,
    evidence: dataScore.evidence?.map(e => e.summary) || []
  });
  
  return {
    item,
    dataScore,
    pitch: pitchResult.success ? pitchResult.pitch : null,
    error: pitchResult.error
  };
}

// ============================================
// HELPERS
// ============================================
function getRecommendationLevel(score) {
  if (score >= 70) return 'HIGHLY_RECOMMENDED';
  if (score >= 50) return 'RECOMMENDED';
  if (score >= 30) return 'CONSIDER';
  return 'SKIP';
}

