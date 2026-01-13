/**
 * MASTER DATA CONVERTER
 * Run this to convert all your data files
 * 
 * Usage: node scripts/masterConverter.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { convertChannels } from '../lib/data/converters/channelsConverter.js';
import { convertVideos } from '../lib/data/converters/videosConverter.js';
import { convertSearchTerms } from '../lib/data/converters/searchConverter.js';
import { convertComments } from '../lib/data/converters/commentsConverter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// ============================================
// CONFIGURATION - Update paths if needed
// ============================================
const CONFIG = {
  inputDir: path.join(rootDir, 'src', 'data', 'raw'),
  outputDir: path.join(rootDir, 'data', 'processed'),
  
  files: {
    channels: 'kibreet also watch channel.csv',
    videos: 'kibreet audiene watch videos.csv',
    searchTerms: 'Table data-Search.csv',
    comments: [
      '2025-12-29 - Comments - Video - Downloaded by TheYouTubeTool.com .csv',
      '2025-12-29 - Comments - Video - Downloaded by TheYouTubeTool.com  (1).csv',
      '2025-12-29 - Comments - Video - Downloaded by TheYouTubeTool.com  (2).csv'
    ]
  }
};

// ============================================
// MAIN FUNCTION
// ============================================
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 MASTER DATA CONVERTER');
  console.log('='.repeat(60) + '\n');
  
  await fs.mkdir(CONFIG.outputDir, { recursive: true });
  
  const results = {};
  
  // 1. Channels
  try {
    const inputPath = path.join(CONFIG.inputDir, CONFIG.files.channels);
    const outputPath = path.join(CONFIG.outputDir, 'channels.json');
    results.channels = await convertChannels(inputPath, outputPath);
  } catch (e) {
    console.error('❌ Channels failed:', e.message);
    console.error('   Make sure kibreet_also_watch_channel.csv is in data/raw/');
  }
  
  // 2. Videos
  try {
    const inputPath = path.join(CONFIG.inputDir, CONFIG.files.videos);
    const outputPath = path.join(CONFIG.outputDir, 'audience_videos.json');
    results.videos = await convertVideos(inputPath, outputPath);
  } catch (e) {
    console.error('❌ Videos failed:', e.message);
    console.error('   Make sure kibreet_audiene_watch_videos.csv is in data/raw/');
  }
  
  // 3. Search Terms
  try {
    const inputPath = path.join(CONFIG.inputDir, CONFIG.files.searchTerms);
    const outputPath = path.join(CONFIG.outputDir, 'search_terms.json');
    results.searchTerms = await convertSearchTerms(inputPath, outputPath);
  } catch (e) {
    console.error('❌ Search terms failed:', e.message);
    console.error('   Make sure Table_data.csv is in data/raw/');
  }
  
  // 4. Comments
  try {
    const commentPaths = CONFIG.files.comments.map(f => path.join(CONFIG.inputDir, f));
    const outputPath = path.join(CONFIG.outputDir, 'comments.json');
    results.comments = await convertComments(commentPaths, outputPath);
  } catch (e) {
    console.error('❌ Comments failed:', e.message);
    console.error('   Make sure comment CSV files are in data/raw/');
  }
  
  // 5. Generate Unified Insights
  console.log('\n🧠 Generating unified insights...');
  const insights = generateUnifiedInsights(results);
  await fs.writeFile(path.join(CONFIG.outputDir, 'unified_insights.json'), JSON.stringify(insights, null, 2));
  console.log('   ✅ Saved unified_insights.json');
  
  // 6. Generate Persona Report
  console.log('👥 Generating persona report...');
  const personaReport = generatePersonaReport(results);
  await fs.writeFile(path.join(CONFIG.outputDir, 'persona_report.json'), JSON.stringify(personaReport, null, 2));
  console.log('   ✅ Saved persona_report.json');
  
  // 7. Update unified data for data importer
  console.log('💾 Updating unified data...');
  await updateUnifiedData(results);
  console.log('   ✅ Updated data/unified_data.json');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ CONVERSION COMPLETE!');
  console.log('='.repeat(60));
  console.log(`\nOutput files in: ${CONFIG.outputDir}/`);
  console.log('   - channels.json');
  console.log('   - audience_videos.json');
  console.log('   - search_terms.json');
  console.log('   - comments.json');
  console.log('   - unified_insights.json');
  console.log('   - persona_report.json');
  console.log('   - data/unified_data.json (updated)');
  
  return results;
}

// ============================================
// UNIFIED INSIGHTS
// ============================================
function generateUnifiedInsights(results) {
  const opportunities = [];
  
  // From search
  const searchOpps = results.searchTerms?.insights?.topOpportunities || [];
  searchOpps.slice(0, 5).forEach(opp => {
    opportunities.push({
      type: 'SEARCH',
      priority: opp.views > 2000 ? 'HIGH' : 'MEDIUM',
      title: `"${opp.term}" - ${opp.views} views`,
      action: `اصنع فيديو عن "${opp.term}"`
    });
  });
  
  // From comments
  const commentIdeas = results.comments?.insights?.videoIdeas || [];
  commentIdeas.slice(0, 5).forEach(idea => {
    opportunities.push({
      type: 'AUDIENCE_REQUEST',
      priority: idea.likes > 3 ? 'HIGH' : 'MEDIUM',
      title: idea.idea,
      action: `الجمهور يطلب هذا`
    });
  });
  
  // From videos (topic opportunities)
  const videoOpps = results.videos?.insights?.opportunities || [];
  videoOpps.slice(0, 3).forEach(opp => {
    opportunities.push({
      type: 'AUDIENCE_WATCHES',
      priority: opp.audienceInterest > 10 ? 'HIGH' : 'MEDIUM',
      title: opp.recommendation,
      action: `جمهورك يشاهد ${opp.audienceInterest} فيديو عن "${opp.topic}"`
    });
  });
  
  return {
    generatedAt: new Date().toISOString(),
    audienceProfile: {
      topChannels: results.channels?.insights?.directCompetitors?.slice(0, 10) || [],
      topSearches: results.searchTerms?.insights?.topSearches?.slice(0, 15) || []
    },
    audienceVoice: {
      topQuestions: results.comments?.insights?.topQuestions?.slice(0, 10) || [],
      topRequests: results.comments?.insights?.topRequests?.slice(0, 10) || []
    },
    opportunities: opportunities.sort((a, b) => (b.priority === 'HIGH' ? 1 : 0) - (a.priority === 'HIGH' ? 1 : 0))
  };
}

// ============================================
// PERSONA REPORT
// ============================================
function generatePersonaReport(results) {
  const personas = {
    geopolitics: { name: '🌍 المحلل الجيوسياسي', strength: 0, signals: [] },
    investor: { name: '📊 المستثمر الفردي', strength: 0, signals: [] },
    tech_future: { name: '💻 متابع التقنية', strength: 0, signals: [] },
    egyptian_business: { name: '🇪🇬 رجل الأعمال المصري', strength: 0, signals: [] },
    gulf_oil: { name: '🛢️ متابع النفط الخليجي', strength: 0, signals: [] },
    curious_learner: { name: '🎓 المتعلم الفضولي', strength: 0, signals: [] }
  };
  
  // From channels
  (results.channels?.channels || []).slice(0, 50).forEach(ch => {
    (ch.personas || []).forEach(p => {
      if (personas[p]) {
        personas[p].strength += ch.relevanceScore / 10;
        if (personas[p].signals.length < 3) {
          personas[p].signals.push(`يشاهدون: ${ch.name}`);
        }
      }
    });
  });
  
  // From search
  (results.searchTerms?.terms || []).slice(0, 100).forEach(term => {
    (term.personas || []).forEach(p => {
      if (personas[p]) {
        personas[p].strength += term.views / 500;
        if (personas[p].signals.length < 5) {
          personas[p].signals.push(`يبحثون: ${term.term}`);
        }
      }
    });
  });
  
  // From videos
  (results.videos?.videos || []).slice(0, 100).forEach(video => {
    (video.personas || []).forEach(p => {
      if (personas[p]) {
        personas[p].strength += video.relevanceScore / 20;
        if (personas[p].signals.length < 7) {
          personas[p].signals.push(`يشاهدون: ${video.title?.substring(0, 40)}...`);
        }
      }
    });
  });
  
  const sorted = Object.entries(personas)
    .map(([id, data]) => ({ id, ...data, strength: Math.round(data.strength) }))
    .sort((a, b) => b.strength - a.strength);
  
  return {
    generatedAt: new Date().toISOString(),
    personas: sorted,
    topPersonas: sorted.slice(0, 3).map(p => p.name)
  };
}

// ============================================
// UPDATE UNIFIED DATA
// ============================================
async function updateUnifiedData(results) {
  const unifiedPath = path.join(rootDir, 'data', 'unified_data.json');
  
  // Load existing or create new
  let unifiedData;
  try {
    const existing = await fs.readFile(unifiedPath, 'utf-8');
    unifiedData = JSON.parse(existing);
  } catch (e) {
    unifiedData = {};
  }
  
  // Update with converted data
  unifiedData.audience = {
    otherChannels: results.channels?.channels || [],
    otherVideos: results.videos?.videos || [],
    demographics: unifiedData.audience?.demographics || null,
    watchTimes: unifiedData.audience?.watchTimes || null
  };
  
  unifiedData.videos = results.videos?.videos || [];
  unifiedData.searchTerms = {
    terms: results.searchTerms?.terms || []
  };
  unifiedData.comments = results.comments?.comments || [];
  unifiedData.competitors = results.channels?.channels?.filter(c => c.isDirectCompetitor) || [];
  
  // Add insights
  unifiedData.commentInsights = results.comments?.insights || null;
  unifiedData.videoPatterns = {
    winningTopics: results.videos?.insights?.topicDistribution?.slice(0, 10).map(t => t.topic) || []
  };
  
  unifiedData.importedAt = new Date().toISOString();
  unifiedData.lastUpdated = new Date().toISOString();
  
  await fs.mkdir(path.dirname(unifiedPath), { recursive: true });
  await fs.writeFile(unifiedPath, JSON.stringify(unifiedData, null, 2));
}

// ============================================
// LOAD FUNCTIONS (for other modules)
// ============================================
export async function loadUnifiedInsights() {
  try {
    const content = await fs.readFile(path.join(CONFIG.outputDir, 'unified_insights.json'), 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

export async function loadPersonaReport() {
  try {
    const content = await fs.readFile(path.join(CONFIG.outputDir, 'persona_report.json'), 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

