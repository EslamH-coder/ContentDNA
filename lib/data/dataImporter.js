/**
 * DATA IMPORTER
 * Import and validate all data sources
 */

import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'imported');
const PROCESSED_DIR = path.join(process.cwd(), 'data', 'processed');
const UNIFIED_DATA_FILE = path.join(process.cwd(), 'data', 'unified_data.json');

// ============================================
// IMPORT ALL DATA
// ============================================
export async function importAllData() {
  console.log('📥 Importing all data sources...\n');
  
  const data = {
    audience: await importAudienceData(),
    videos: await importVideoPerformance(),
    searchTerms: await importSearchTerms(),
    comments: await importComments(),
    competitors: await importCompetitorData(),
    importedAt: new Date().toISOString()
  };
  
  // Validate
  const validation = validateAllData(data);
  if (!validation.valid) {
    console.warn('⚠️ Data validation issues:', validation.issues);
  }
  
  // Save unified data
  await saveUnifiedData(data);
  
  console.log('\n✅ All data imported and unified');
  return data;
}

// ============================================
// IMPORT AUDIENCE DATA
// ============================================
async function importAudienceData() {
  console.log('👥 Importing audience data...');
  
  const audience = {
    otherChannels: [],
    otherVideos: [],
    demographics: null,
    watchTimes: null
  };
  
  // Try to load from processed data first (converted CSV)
  try {
    const channelsFile = await fs.readFile(
      path.join(PROCESSED_DIR, 'channels.json'), 'utf-8'
    );
    const channelsData = JSON.parse(channelsFile);
    audience.otherChannels = channelsData.channels || [];
    console.log(`   ✅ Loaded ${audience.otherChannels.length} other channels from processed data`);
  } catch (e) {
    // Fallback to imported data
    try {
      const otherChannelsFile = await fs.readFile(
        path.join(DATA_DIR, 'audience_other_channels.json'), 'utf-8'
      );
      audience.otherChannels = JSON.parse(otherChannelsFile);
      console.log(`   ✅ Loaded ${audience.otherChannels.length} other channels from imported data`);
    } catch (e2) {
      console.log('   ⚠️ No channels data found');
    }
  }
  
  try {
    const videosFile = await fs.readFile(
      path.join(PROCESSED_DIR, 'audience_videos.json'), 'utf-8'
    );
    const videosData = JSON.parse(videosFile);
    audience.otherVideos = videosData.videos || [];
    console.log(`   ✅ Loaded ${audience.otherVideos.length} other videos from processed data`);
  } catch (e) {
    // Fallback to imported data
    try {
      const otherVideosFile = await fs.readFile(
        path.join(DATA_DIR, 'audience_other_videos.json'), 'utf-8'
      );
      audience.otherVideos = JSON.parse(otherVideosFile);
      console.log(`   ✅ Loaded ${audience.otherVideos.length} other videos from imported data`);
    } catch (e2) {
      console.log('   ⚠️ No videos data found');
    }
  }
  
  try {
    const demographicsFile = await fs.readFile(
      path.join(DATA_DIR, 'audience_demographics.json'), 'utf-8'
    );
    audience.demographics = JSON.parse(demographicsFile);
    console.log('   ✅ Loaded demographics');
  } catch (e) {
    console.log('   ⚠️ audience_demographics.json not found');
  }
  
  try {
    const watchTimesFile = await fs.readFile(
      path.join(DATA_DIR, 'audience_watch_times.json'), 'utf-8'
    );
    audience.watchTimes = JSON.parse(watchTimesFile);
    console.log('   ✅ Loaded watch times');
  } catch (e) {
    console.log('   ⚠️ audience_watch_times.json not found');
  }
  
  return audience;
}

// ============================================
// IMPORT VIDEO PERFORMANCE
// ============================================
async function importVideoPerformance() {
  console.log('📊 Importing video performance...');
  
  try {
    // Try JSON first
    const jsonFile = await fs.readFile(
      path.join(DATA_DIR, 'video_performance.json'), 'utf-8'
    );
    const videos = JSON.parse(jsonFile);
    console.log(`   ✅ Loaded ${videos.length} videos`);
    return videos;
  } catch (e) {
    // Try CSV
    try {
      const csvFile = await fs.readFile(
        path.join(DATA_DIR, 'video_performance.csv'), 'utf-8'
      );
      const videos = parseCSV(csvFile);
      console.log(`   ✅ Loaded ${videos.length} videos from CSV`);
      return videos;
    } catch (e2) {
      console.log('   ⚠️ video_performance not found');
      return [];
    }
  }
}

// ============================================
// IMPORT SEARCH TERMS
// ============================================
async function importSearchTerms() {
  console.log('🔍 Importing search terms...');
  
  // Try processed data first
  try {
    const file = await fs.readFile(
      path.join(PROCESSED_DIR, 'search_terms.json'), 'utf-8'
    );
    const searchData = JSON.parse(file);
    const terms = searchData.terms || [];
    console.log(`   ✅ Loaded ${terms.length} search terms from processed data`);
    return terms;
  } catch (e) {
    // Fallback to CSV
    try {
      const file = await fs.readFile(
        path.join(DATA_DIR, 'search_terms.csv'), 'utf-8'
      );
      const terms = parseCSV(file);
      console.log(`   ✅ Loaded ${terms.length} search terms from CSV`);
      return terms;
    } catch (e2) {
      console.log('   ⚠️ search_terms not found');
      return [];
    }
  }
}

// ============================================
// IMPORT COMMENTS
// ============================================
async function importComments() {
  console.log('💬 Importing comments...');
  
  // Try processed data first
  try {
    const file = await fs.readFile(
      path.join(PROCESSED_DIR, 'comments.json'), 'utf-8'
    );
    const commentsData = JSON.parse(file);
    const comments = commentsData.comments || [];
    console.log(`   ✅ Loaded ${comments.length} comments from processed data`);
    return comments;
  } catch (e) {
    // Fallback to imported data
    try {
      const file = await fs.readFile(
        path.join(DATA_DIR, 'comments.json'), 'utf-8'
      );
      const comments = JSON.parse(file);
      console.log(`   ✅ Loaded ${comments.length} comments from imported data`);
      return comments;
    } catch (e2) {
      console.log('   ⚠️ comments.json not found');
      return [];
    }
  }
}

// ============================================
// IMPORT COMPETITOR DATA
// ============================================
async function importCompetitorData() {
  console.log('📺 Importing competitor data...');
  
  try {
    const file = await fs.readFile(
      path.join(DATA_DIR, 'competitors.json'), 'utf-8'
    );
    const competitors = JSON.parse(file);
    console.log(`   ✅ Loaded ${competitors.length} competitors`);
    return competitors;
  } catch (e) {
    console.log('   ⚠️ competitors.json not found');
    return [];
  }
}

// ============================================
// CSV PARSER
// ============================================
function parseCSV(csvString) {
  const lines = csvString.trim().split('\n');
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = values[i] || '';
    });
    return obj;
  });
}

// ============================================
// VALIDATE ALL DATA
// ============================================
function validateAllData(data) {
  const issues = [];
  
  if (!data.audience.otherChannels?.length) {
    issues.push('Missing: Other channels your audience watches');
  }
  
  if (!data.audience.otherVideos?.length) {
    issues.push('Missing: Other videos your audience watches');
  }
  
  if (!data.videos?.length) {
    issues.push('Missing: Video performance data');
  }
  
  if (!data.comments?.length) {
    issues.push('Missing: Comments data');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

// ============================================
// SAVE UNIFIED DATA
// ============================================
async function saveUnifiedData(data) {
  try {
    await fs.mkdir(path.dirname(UNIFIED_DATA_FILE), { recursive: true });
    await fs.writeFile(UNIFIED_DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`   💾 Saved unified data to ${UNIFIED_DATA_FILE}`);
  } catch (e) {
    console.error('   ❌ Failed to save unified data:', e.message);
  }
}

// ============================================
// LOAD UNIFIED DATA
// ============================================
export async function loadUnifiedData() {
  try {
    const file = await fs.readFile(UNIFIED_DATA_FILE, 'utf-8');
    const data = JSON.parse(file);
    
    // Also load insights from processed data if available
    try {
      const insightsFile = await fs.readFile(
        path.join(PROCESSED_DIR, 'unified_insights.json'), 'utf-8'
      );
      const insights = JSON.parse(insightsFile);
      data.unifiedInsights = insights;
    } catch (e) {
      // Insights not available, that's okay
    }
    
    try {
      const personaFile = await fs.readFile(
        path.join(PROCESSED_DIR, 'persona_report.json'), 'utf-8'
      );
      const personaReport = JSON.parse(personaFile);
      data.personaReport = personaReport;
    } catch (e) {
      // Persona report not available, that's okay
    }
    
    return data;
  } catch (e) {
    return null;
  }
}

