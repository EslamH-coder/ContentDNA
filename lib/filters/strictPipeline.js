import { 
  gate1_TopicDnaMatch, 
  gate2_StoryTypeClarity, 
  gate3_ArabRelevance,
  gate4_Specificity,
  gate5_HookPotential,
  gate6_Uniqueness
} from './qualityGates.js';
import { classifyItem } from '../recommendation/classifier.js';
import { detectStoryType } from '../recommendation/storyTypes.js';
import { parseStory } from '../recommendation/storyParser.js';
import { makeDecisions, sortByPriority } from '../decisions/decisionEngine.js';

/**
 * STRICT FILTERING PIPELINE
 * 344 items → 5-10 strong ideas
 */
export async function strictFilter(rssItems, showDna, options = {}) {
  const {
    maxResults = 10,
    minScore = 75
  } = options;
  
  const results = {
    passed: [],
    rejected: {
      gate1: [],
      gate2: [],
      gate3: [],
      gate4: [],
      gate5: [],
      score: []
    },
    stats: {
      total: rssItems.length,
      after_gate1: 0,
      after_gate2: 0,
      after_gate3: 0,
      after_gate4: 0,
      after_gate5: 0,
      after_gate6: 0,
      final: 0
    }
  };
  
  for (const item of rssItems) {
    // Pre-process
    const classification = classifyItem(item);
    const content = `${item.title || ''} ${item.description || ''}`;
    const storyType = detectStoryType(content);
    const extracted = parseStory(item); // This gives us numbers, entities, etc.
    
    const gates = {};
    let totalScore = 50; // Base score
    
    // ===== GATE 1: Topic DNA =====
    gates.gate1 = gate1_TopicDnaMatch(item, classification.classification, showDna);
    if (!gates.gate1.pass) {
      results.rejected.gate1.push({ 
        title: item.title || 'Untitled', 
        reason: gates.gate1.reason 
      });
      // Log first few rejections for debugging
      if (results.rejected.gate1.length <= 3) {
        console.log(`  ❌ Gate 1 REJECT: "${(item.title || 'Untitled').substring(0, 50)}..." - ${gates.gate1.reason}`);
      }
      continue;
    }
    results.stats.after_gate1++;
    totalScore += gates.gate1.score_bonus || 0;
    
    // ===== GATE 2: Story Type =====
    gates.gate2 = gate2_StoryTypeClarity(storyType);
    if (!gates.gate2.pass) {
      results.rejected.gate2.push({ 
        title: item.title || 'Untitled', 
        reason: gates.gate2.reason 
      });
      if (results.rejected.gate2.length <= 3) {
        console.log(`  ❌ Gate 2 REJECT: "${(item.title || 'Untitled').substring(0, 50)}..." - ${gates.gate2.reason}`);
      }
      continue;
    }
    results.stats.after_gate2++;
    
    // ===== GATE 3: Arab Relevance =====
    gates.gate3 = gate3_ArabRelevance(item, extracted);
    if (!gates.gate3.pass) {
      results.rejected.gate3.push({ 
        title: item.title || 'Untitled', 
        reason: gates.gate3.reason 
      });
      if (results.rejected.gate3.length <= 3) {
        console.log(`  ❌ Gate 3 REJECT: "${(item.title || 'Untitled').substring(0, 50)}..." - ${gates.gate3.reason}`);
      }
      continue;
    }
    results.stats.after_gate3++;
    totalScore += gates.gate3.score_bonus || 0;
    
    // ===== GATE 4: Specificity =====
    gates.gate4 = gate4_Specificity(item, extracted);
    if (!gates.gate4.pass) {
      results.rejected.gate4.push({ 
        title: item.title || 'Untitled', 
        reason: gates.gate4.reason 
      });
      if (results.rejected.gate4.length <= 3) {
        console.log(`  ❌ Gate 4 REJECT: "${(item.title || 'Untitled').substring(0, 50)}..." - ${gates.gate4.reason} (score: ${gates.gate4.score || 0})`);
      }
      continue;
    }
    results.stats.after_gate4++;
    totalScore += Math.min(gates.gate4.specificity_score / 2, 20);
    
    // ===== GATE 5: Hook Potential =====
    gates.gate5 = gate5_HookPotential(item, storyType, showDna);
    if (!gates.gate5.pass) {
      results.rejected.gate5.push({ 
        title: item.title || 'Untitled', 
        reason: gates.gate5.reason 
      });
      if (results.rejected.gate5.length <= 3) {
        console.log(`  ❌ Gate 5 REJECT: "${(item.title || 'Untitled').substring(0, 50)}..." - ${gates.gate5.reason}`);
      }
      continue;
    }
    results.stats.after_gate5++;
    totalScore += 10;
    
    // ===== PASSED ALL GATES =====
    // Add timing and format decisions
    const decisions = makeDecisions(item, storyType, classification.classification, showDna);
    
    results.passed.push({
      item,
      classification: classification.classification,
      storyType,
      extracted,
      gates,
      decisions,  // Add timing + format decisions
      total_score: Math.min(100, totalScore)
    });
  }
  
  // ===== GATE 6: Uniqueness =====
  let unique = gate6_Uniqueness(results.passed);
  results.stats.after_gate6 = unique.length;
  
  // ===== FINAL: Score filter + limit =====
  const beforeScoreFilter = unique.length;
  unique = unique
    .filter(r => r.total_score >= minScore)
    .sort((a, b) => {
      // First sort by priority (action order)
      const priorityA = a.decisions?.action?.order || 99;
      const priorityB = b.decisions?.action?.order || 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      // Then by score
      return b.total_score - a.total_score;
    })
    .slice(0, maxResults);
  
  // Track score rejects
  const scoreRejects = results.passed.filter(r => r.total_score < minScore);
  results.rejected.score = scoreRejects.map(r => ({
    title: r.item.title || 'Untitled',
    reason: `Score ${r.total_score.toFixed(0)} < ${minScore}`
  }));
  
  // Log score rejects
  if (scoreRejects.length > 0 && scoreRejects.length <= 5) {
    console.log(`  ❌ Score REJECT: ${scoreRejects.length} items below ${minScore}`);
    scoreRejects.slice(0, 3).forEach(r => {
      console.log(`     "${(r.item.title || 'Untitled').substring(0, 50)}..." - Score: ${r.total_score.toFixed(0)}`);
    });
  }
  
  results.stats.final = unique.length;
  results.passed = unique;
  
  // Log summary
  console.log(`\n📊 Strict Gates Summary:`);
  console.log(`   Input: ${results.stats.total} items`);
  console.log(`   Gate 1 (Topic): ${results.stats.after_gate1} passed, ${results.rejected.gate1.length} rejected`);
  console.log(`   Gate 2 (Story): ${results.stats.after_gate2} passed, ${results.rejected.gate2.length} rejected`);
  console.log(`   Gate 3 (Arab): ${results.stats.after_gate3} passed, ${results.rejected.gate3.length} rejected`);
  console.log(`   Gate 4 (Specificity): ${results.stats.after_gate4} passed, ${results.rejected.gate4.length} rejected`);
  console.log(`   Gate 5 (Hook): ${results.stats.after_gate5} passed, ${results.rejected.gate5.length} rejected`);
  console.log(`   Gate 6 (Uniqueness): ${results.stats.after_gate6} passed`);
  console.log(`   Score >= ${minScore}: ${results.stats.final} passed, ${scoreRejects.length} rejected`);
  console.log(`   FINAL: ${results.stats.final} items passed all gates`);
  
  return results;
}

/**
 * Get filter summary for UI
 */
export function getFilterSummary(results) {
  return {
    input: results.stats.total,
    output: results.stats.final,
    
    funnel: [
      { 
        gate: 'Topic DNA Match', 
        passed: results.stats.after_gate1, 
        rejected: results.stats.total - results.stats.after_gate1 
      },
      { 
        gate: 'Story Clarity', 
        passed: results.stats.after_gate2, 
        rejected: results.stats.after_gate1 - results.stats.after_gate2 
      },
      { 
        gate: 'Arab Relevance', 
        passed: results.stats.after_gate3, 
        rejected: results.stats.after_gate2 - results.stats.after_gate3 
      },
      { 
        gate: 'Specificity', 
        passed: results.stats.after_gate4, 
        rejected: results.stats.after_gate3 - results.stats.after_gate4 
      },
      { 
        gate: 'Hook Potential', 
        passed: results.stats.after_gate5, 
        rejected: results.stats.after_gate4 - results.stats.after_gate5 
      },
      { 
        gate: 'Uniqueness', 
        passed: results.stats.after_gate6, 
        rejected: results.stats.after_gate5 - results.stats.after_gate6 
      },
      { 
        gate: 'Score >= 75', 
        passed: results.stats.final, 
        rejected: results.stats.after_gate6 - results.stats.final 
      }
    ],
    
    message: `${results.stats.total} items → ${results.stats.final} strong ideas`
  };
}

