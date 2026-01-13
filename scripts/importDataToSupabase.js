/**
 * Import JSON data from /data/processed/ to Supabase
 * Run with: node scripts/importDataToSupabase.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase config - use environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SHOW_ID = '00000000-0000-0000-0000-000000000004';
const DATA_PATH = path.join(__dirname, '../data/processed');

// Load JSON file
function loadJson(filename) {
  try {
    const filePath = path.join(DATA_PATH, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filename}`);
      return null;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(data);
    // Handle different JSON structures
    if (parsed.terms) return parsed.terms;
    if (parsed.videos) return parsed.videos;
    if (parsed.comments) return parsed.comments;
    if (parsed.all) return parsed.all;
    return parsed;
  } catch (error) {
    console.error(`❌ Error loading ${filename}:`, error.message);
    return null;
  }
}

// Import Search Terms
async function importSearchTerms() {
  console.log('\n📊 Importing search terms...');
  
  const data = loadJson('search_terms.json');
  if (!data || !Array.isArray(data)) {
    console.error('   No data found or invalid format');
    return 0;
  }
  
  console.log(`   Found ${data.length} search terms`);
  
  // Transform to match table schema
  const records = data
    .filter(item => item.term) // Only items with term
    .map(item => ({
      show_id: SHOW_ID,
      term: item.term,
      views: item.views || 0,
      watch_time_hours: item.watchTimeHours || 0,
      avg_view_duration: item.avgViewDuration || null,
      topic: item.topic || null,
      intent: item.intent || null,
      personas: item.personas || [],
      is_branded: item.isBranded || false,
      is_opportunity: item.isOpportunity || false
    }));
  
  console.log(`   Prepared ${records.length} records for import`);
  
  // Insert in batches of 500
  const batchSize = 500;
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from('search_terms')
      .insert(batch);
    
    if (error) {
      console.error(`   ❌ Error at batch ${i}:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
      process.stdout.write(`\r   Inserted ${inserted}/${records.length}`);
    }
  }
  
  console.log(`\n✅ Search terms: ${inserted} imported${errors > 0 ? `, ${errors} errors` : ''}`);
  return inserted;
}

// Import Audience Videos
async function importAudienceVideos() {
  console.log('\n📊 Importing audience videos...');
  
  const data = loadJson('audience_videos.json');
  if (!data || !Array.isArray(data)) {
    console.error('   No data found or invalid format');
    return 0;
  }
  
  console.log(`   Found ${data.length} videos`);
  
  // Transform to match table schema
  const records = data
    .filter(item => item.id && item.title) // Only items with id and title
    .map(item => ({
      show_id: SHOW_ID,
      video_id: item.id,
      title: item.title,
      url: item.url || null,
      platform: item.platform || 'youtube',
      upload_date: item.uploadDate ? new Date(item.uploadDate).toISOString() : null,
      duration: item.duration || 0,
      creator_id: item.creator?.id || null,
      creator_name: item.creator?.name || null,
      views: item.views || 0,
      engagements: item.engagements || 0,
      relevance_score: item.relevanceScore || 0,
      audience_overlap: item.audienceOverlap || 0,
      is_short: item.isShort || false,
      category: item.category || null,
      topic: item.topic || null,
      personas: item.personas || [],
      is_relevant: item.isRelevant || false
    }));
  
  console.log(`   Prepared ${records.length} records for import`);
  
  // Insert in batches
  const batchSize = 500;
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from('audience_videos')
      .insert(batch);
    
    if (error) {
      console.error(`   ❌ Error at batch ${i}:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
      process.stdout.write(`\r   Inserted ${inserted}/${records.length}`);
    }
  }
  
  console.log(`\n✅ Audience videos: ${inserted} imported${errors > 0 ? `, ${errors} errors` : ''}`);
  return inserted;
}

// Import Comments
async function importComments() {
  console.log('\n📊 Importing comments...');
  
  const data = loadJson('comments.json');
  if (!data || !Array.isArray(data)) {
    console.error('   No data found or invalid format');
    return 0;
  }
  
  console.log(`   Found ${data.length} comments`);
  
  // Transform to match table schema
  const records = data
    .filter(item => item.id && item.text) // Only items with id and text
    .map(item => {
      // Parse date string (MM/DD/YYYY) to Date
      let commentDate = null;
      if (item.date) {
        try {
          const [month, day, year] = item.date.split('/');
          commentDate = new Date(year, month - 1, day).toISOString().split('T')[0];
        } catch (e) {
          // Invalid date, leave as null
        }
      }
      
      return {
        show_id: SHOW_ID,
        comment_id: item.id,
        author: item.author || null,
        text: item.text,
        likes: item.likes || 0,
        replies: item.replies || 0,
        comment_date: commentDate,
        video_id: item.videoId || null,
        video_title: item.videoTitle || null,
        type: item.type || null,
        sentiment: item.sentiment || null,
        topic: item.topic || null,
        question: item.question || null,
        request: item.request || null,
        is_actionable: item.isActionable || false
      };
    });
  
  console.log(`   Prepared ${records.length} records for import`);
  
  // Insert in batches
  const batchSize = 500;
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from('audience_comments')
      .insert(batch);
    
    if (error) {
      console.error(`   ❌ Error at batch ${i}:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
      process.stdout.write(`\r   Inserted ${inserted}/${records.length}`);
    }
  }
  
  console.log(`\n✅ Comments: ${inserted} imported${errors > 0 ? `, ${errors} errors` : ''}`);
  return inserted;
}

// Main function
async function main() {
  console.log('🚀 Starting data import to Supabase...');
  console.log(`📁 Data path: ${DATA_PATH}`);
  console.log(`🎯 Show ID: ${SHOW_ID}\n`);
  
  try {
    const results = {
      search_terms: await importSearchTerms(),
      audience_videos: await importAudienceVideos(),
      comments: await importComments()
    };
    
    console.log('\n========================================');
    console.log('📊 IMPORT COMPLETE');
    console.log('========================================');
    console.log(`Search Terms: ${results.search_terms}`);
    console.log(`Audience Videos: ${results.audience_videos}`);
    console.log(`Comments: ${results.comments}`);
    console.log('========================================\n');
    
    // Verify counts
    console.log('🔍 Verifying import...');
    const { data: searchCount } = await supabase
      .from('search_terms')
      .select('id', { count: 'exact', head: true })
      .eq('show_id', SHOW_ID);
    
    const { data: videoCount } = await supabase
      .from('audience_videos')
      .select('id', { count: 'exact', head: true })
      .eq('show_id', SHOW_ID);
    
    const { data: commentCount } = await supabase
      .from('audience_comments')
      .select('id', { count: 'exact', head: true })
      .eq('show_id', SHOW_ID);
    
    console.log(`✅ Verified in database:`);
    console.log(`   Search Terms: ${searchCount?.length || 0}`);
    console.log(`   Audience Videos: ${videoCount?.length || 0}`);
    console.log(`   Comments: ${commentCount?.length || 0}`);
    
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);

