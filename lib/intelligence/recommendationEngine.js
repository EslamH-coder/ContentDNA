/**
 * RECOMMENDATION ENGINE V2
 * 360° Content Intelligence with Groq AI
 */

import { scoreWithEvidence } from './evidenceScorer.js';
import { extractVideoIdeas, filterRealRequests } from './smartCommentAnalyzer.js';
import { getPendingTrends } from './manualTrendInput.js';
import { PERSONAS } from './personas.js';
import fs from 'fs/promises';
import path from 'path';

// ============================================
// MAIN: GENERATE ALL RECOMMENDATIONS
// ============================================
export async function generateRecommendations(rssItems = []) {
  console.log('\n' + '═'.repeat(60));
  console.log('🎯 360° CONTENT INTELLIGENCE V2 (with Groq AI)');
  console.log('═'.repeat(60));
  
  const startTime = Date.now();
  const allRecommendations = [];

  // ============================================
  // SOURCE 1: RSS NEWS
  // ============================================
  console.log('\n📡 SOURCE 1: RSS News...');
  if (rssItems && rssItems.length > 0) {
    for (const item of rssItems.slice(0, 20)) { // Limit to save tokens
      try {
        const scored = await scoreWithEvidence(item.title || item, {
          sourceType: 'RSS',
          useAI: true,
          generatePitchText: false // Generate pitch only for top items
        });
        scored.originalItem = item;
        scored.source = { type: 'RSS', url: item.link || item.url };
        allRecommendations.push(scored);
      } catch (e) {
        console.error('Error scoring RSS item:', e.message);
      }
    }
    console.log(`   Processed ${Math.min(rssItems.length, 20)} RSS items`);
  } else {
    console.log('   No RSS items provided');
  }

  // ============================================
  // SOURCE 2: MANUAL TRENDS
  // ============================================
  console.log('\n👀 SOURCE 2: Manual Trends...');
  try {
    const manualTrends = await getPendingTrends();
    for (const trend of manualTrends) {
      const topic = trend.topic || trend.note || trend.url;
      const scored = await scoreWithEvidence(topic, {
        sourceType: 'MANUAL',
        useAI: true,
        generatePitchText: true
      });
      scored.originalItem = trend;
      scored.source = { type: 'MANUAL', subType: trend.type, url: trend.url };
      // Bonus for manual
      scored.totalScore = Math.min(100, scored.totalScore + 10);
      allRecommendations.push(scored);
    }
  } catch (e) {
    console.log('   ⚠️ Could not load manual trends:', e.message);
  }

  // ============================================
  // SOURCE 3: MARKET INTELLIGENCE
  // ============================================
  console.log('\n🎯 SOURCE 3: Market Intelligence...');
  try {
    const { generateMarketSuggestions } = await import('./marketIntelligence.js');
    const marketSuggestions = await generateMarketSuggestions();
    for (const suggestion of marketSuggestions.slice(0, 10)) {
      const scored = await scoreWithEvidence(suggestion.topic, {
        sourceType: 'MARKET',
        useAI: true,
        generatePitchText: false
      });
      scored.originalItem = suggestion;
      scored.source = { type: 'MARKET', subType: suggestion.type };
      scored.marketEvidence = suggestion.evidence;
      allRecommendations.push(scored);
    }
  } catch (e) {
    console.log('   ⚠️ Could not generate market suggestions:', e.message);
  }

  // ============================================
  // SOURCE 4: COMMENT VIDEO IDEAS
  // ============================================
  console.log('\n💬 SOURCE 4: Audience Requests...');
  try {
    const commentsPath = path.join(process.cwd(), 'data/processed/comments.json');
    const commentsData = JSON.parse(await fs.readFile(commentsPath, 'utf-8'));
    
    // Filter and extract video ideas
    const filtered = await filterRealRequests(commentsData.comments?.slice(0, 50) || []);
    const videoIdeas = await extractVideoIdeas(filtered.actionable);
    
    // Save filtered comments
    const smartCommentsPath = path.join(process.cwd(), 'data/processed/smart_comments.json');
    await fs.writeFile(
      smartCommentsPath,
      JSON.stringify(filtered, null, 2)
    );
    
    // Add top video ideas
    for (const idea of videoIdeas.slice(0, 5)) {
      const scored = await scoreWithEvidence(idea.idea, {
        sourceType: 'AUDIENCE_REQUEST',
        useAI: true,
        generatePitchText: true
      });
      scored.originalItem = idea;
      scored.source = { type: 'COMMENT', author: idea.author };
      // Bonus for direct audience request
      scored.totalScore = Math.min(100, scored.totalScore + 15);
      allRecommendations.push(scored);
    }
  } catch (e) {
    console.log('   ⚠️ Could not process comments:', e.message);
  }

  // ============================================
  // SORT & FINALIZE
  // ============================================
  allRecommendations.sort((a, b) => b.totalScore - a.totalScore);

  // Generate pitches for top 5 only
  console.log('\n✍️ Generating pitches for top recommendations...');
  for (const rec of allRecommendations.slice(0, 5)) {
    if (!rec.pitch && rec.primaryPersona) {
      const { generatePitch } = await import('./topicAnalyzer.js');
      const pitchResult = await generatePitch(
        rec.topic,
        rec.primaryPersona.id,
        rec.evidence.map(e => e.summary)
      );
      if (pitchResult.success) {
        rec.pitch = pitchResult.pitch;
      }
    }
  }

  // Generate report
  const report = generateReport(allRecommendations);
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Completed in ${elapsed}s`);

  return {
    recommendations: allRecommendations,
    report,
    summary: {
      total: allRecommendations.length,
      highlyRecommended: allRecommendations.filter(r => r.recommendation === 'HIGHLY_RECOMMENDED').length,
      recommended: allRecommendations.filter(r => r.recommendation === 'RECOMMENDED').length,
      byPersona: groupByPersona(allRecommendations),
      processingTime: elapsed
    }
  };
}

// ============================================
// GENERATE FORMATTED REPORT
// ============================================
function generateReport(recommendations) {
  let report = '';
  
  report += '\n╔' + '═'.repeat(68) + '╗\n';
  report += '║  🎯 360° CONTENT RECOMMENDATIONS (AI-Powered)                      ║\n';
  report += '║  Generated: ' + new Date().toLocaleString('ar-EG').padEnd(54) + '║\n';
  report += '╚' + '═'.repeat(68) + '╝\n\n';

  // HIGHLY RECOMMENDED
  const highlyRec = recommendations.filter(r => r.recommendation === 'HIGHLY_RECOMMENDED');
  if (highlyRec.length > 0) {
    report += '🔥 HIGHLY RECOMMENDED\n';
    report += '─'.repeat(60) + '\n\n';
    
    for (const rec of highlyRec.slice(0, 5)) {
      report += formatRecommendation(rec);
    }
  }

  // RECOMMENDED
  const recommended = recommendations.filter(r => r.recommendation === 'RECOMMENDED');
  if (recommended.length > 0) {
    report += '\n✅ RECOMMENDED\n';
    report += '─'.repeat(60) + '\n\n';
    
    for (const rec of recommended.slice(0, 5)) {
      report += formatRecommendationCompact(rec);
    }
  }

  // BY PERSONA
  report += '\n\n👥 TOP PICKS BY PERSONA\n';
  report += '─'.repeat(60) + '\n\n';
  
  const byPersona = groupByPersona(recommendations.filter(r => r.recommendation !== 'SKIP'));
  
  for (const [personaId, items] of Object.entries(byPersona)) {
    const persona = PERSONAS[personaId];
    if (persona && items.length > 0) {
      report += `${persona.name}\n`;
      items.slice(0, 3).forEach(item => {
        report += `   • [${item.totalScore}] ${item.topic.substring(0, 45)}...\n`;
      });
      report += '\n';
    }
  }

  return report;
}

// ============================================
// FORMAT RECOMMENDATION
// ============================================
function formatRecommendation(rec) {
  let out = '';
  
  out += `┌${'─'.repeat(58)}┐\n`;
  out += `│ 📰 ${rec.topic.substring(0, 52).padEnd(52)} │\n`;
  out += `├${'─'.repeat(58)}┤\n`;
  out += `│ 📊 Score: ${rec.totalScore}/100  •  ${rec.recommendation.padEnd(18)}  •  ${rec.urgency.padEnd(10)} │\n`;
  
  if (rec.primaryPersona) {
    out += `│ 👤 ${rec.primaryPersona.name}`.padEnd(59) + '│\n';
    if (rec.primaryPersona.reason) {
      out += `│    ${rec.primaryPersona.reason.substring(0, 52)}`.padEnd(59) + '│\n';
    }
  }
  
  out += `├${'─'.repeat(58)}┤\n`;
  out += `│ 📋 EVIDENCE:`.padEnd(59) + '│\n';
  
  for (const ev of rec.evidence) {
    out += `│   ${ev.type} ${ev.summary} (+${ev.points})`.padEnd(59) + '│\n';
  }
  
  if (rec.suggestedAngle) {
    out += `├${'─'.repeat(58)}┤\n`;
    out += `│ 💡 ${rec.suggestedAngle.substring(0, 52)}`.padEnd(59) + '│\n';
  }
  
  if (rec.pitch) {
    out += `├${'─'.repeat(58)}┤\n`;
    out += `│ ✍️ PITCH:`.padEnd(59) + '│\n';
    const pitchLines = rec.pitch.split('\n').slice(0, 6);
    for (const line of pitchLines) {
      out += `│ ${line.substring(0, 55)}`.padEnd(59) + '│\n';
    }
  }
  
  out += `└${'─'.repeat(58)}┘\n\n`;
  
  return out;
}

function formatRecommendationCompact(rec) {
  let out = '';
  out += `• [${rec.totalScore}] ${rec.topic.substring(0, 50)}...\n`;
  out += `  ${rec.primaryPersona?.name || 'General'} | ${rec.source.type}`;
  if (rec.evidence[0]) out += ` | ${rec.evidence[0].summary}`;
  out += '\n\n';
  return out;
}

// ============================================
// GROUP BY PERSONA
// ============================================
function groupByPersona(recommendations) {
  const grouped = {};
  
  for (const rec of recommendations) {
    const personaId = rec.primaryPersona?.id || 'unknown';
    if (!grouped[personaId]) grouped[personaId] = [];
    grouped[personaId].push(rec);
  }
  
  return grouped;
}

