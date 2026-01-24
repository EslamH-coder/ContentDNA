/**
 * Backfill Script: Generate Embeddings for Competitor Videos
 * 
 * This script pre-computes embeddings for all competitor videos
 * to speed up semantic similarity comparisons.
 * 
 * Usage:
 *   node scripts/backfill-competitor-embeddings.mjs
 *   
 * Options:
 *   --limit=100     Process only N videos
 *   --show=UUID     Process only videos for a specific show
 *   --force         Re-generate embeddings even if they exist
 *   --dry-run       Don't save to database, just show what would be done
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Configuration
const CONFIG = {
  EMBEDDING_MODEL: 'text-embedding-3-small',
  BATCH_SIZE: 50,           // Videos per batch
  RATE_LIMIT_DELAY: 100,    // ms between API calls
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,        // ms
};

// Initialize clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL is not set in .env.local');
  process.exit(1);
}

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Parse command line arguments
function parseArgs() {
  const args = {
    limit: null,
    showId: null,
    force: false,
    dryRun: false,
  };
  
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--limit=')) {
      args.limit = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--show=')) {
      args.showId = arg.split('=')[1];
    } else if (arg === '--force') {
      args.force = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  }
  
  return args;
}

// Generate embedding for text
async function generateEmbedding(text, retries = 0) {
  if (!text || text.trim().length === 0) {
    return null;
  }
  
  try {
    const response = await openai.embeddings.create({
      model: CONFIG.EMBEDDING_MODEL,
      input: text.substring(0, 8000), // Limit input length
    });
    
    return response.data[0].embedding;
  } catch (error) {
    if (retries < CONFIG.MAX_RETRIES) {
      console.warn(`   ⚠️ Retry ${retries + 1}/${CONFIG.MAX_RETRIES} for: "${text.substring(0, 30)}..."`);
      await sleep(CONFIG.RETRY_DELAY * (retries + 1));
      return generateEmbedding(text, retries + 1);
    }
    console.error(`   ❌ Failed to generate embedding: ${error.message}`);
    return null;
  }
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch videos that need embeddings
async function fetchVideosNeedingEmbeddings(args) {
  let query = supabase
    .from('competitor_videos')
    .select('id, title, competitor_id, title_embedding')
    .not('title', 'is', null)
    .order('created_at', { ascending: false });
  
  // Filter by show if specified
  if (args.showId) {
    // First get competitor IDs for this show
    const { data: competitors } = await supabase
      .from('competitors')
      .select('id')
      .eq('show_id', args.showId);
    
    if (competitors && competitors.length > 0) {
      const competitorIds = competitors.map(c => c.id);
      query = query.in('competitor_id', competitorIds);
    }
  }
  
  // Only get videos without embeddings (unless --force)
  if (!args.force) {
    query = query.is('title_embedding', null);
  }
  
  // Apply limit
  if (args.limit) {
    query = query.limit(args.limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch videos: ${error.message}`);
  }
  
  return data || [];
}

// Update video with embedding
async function updateVideoEmbedding(videoId, embedding, dryRun = false) {
  if (dryRun) {
    console.log(`   📝 [DRY RUN] Would update video ${videoId}`);
    return true;
  }
  
  const { error } = await supabase
    .from('competitor_videos')
    .update({ title_embedding: embedding })
    .eq('id', videoId);
  
  if (error) {
    console.error(`   ❌ Failed to update video ${videoId}: ${error.message}`);
    return false;
  }
  
  return true;
}

// Process videos in batches
async function processVideos(videos, args) {
  const total = videos.length;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  
  console.log(`\n📊 Processing ${total} videos...\n`);
  
  for (let i = 0; i < videos.length; i += CONFIG.BATCH_SIZE) {
    const batch = videos.slice(i, i + CONFIG.BATCH_SIZE);
    const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(total / CONFIG.BATCH_SIZE);
    
    console.log(`\n🔄 Batch ${batchNum}/${totalBatches} (${batch.length} videos)`);
    
    for (const video of batch) {
      processed++;
      const progress = `[${processed}/${total}]`;
      
      // Skip if already has embedding (and not --force)
      if (video.title_embedding && !args.force) {
        console.log(`${progress} ⏭️ Skip (has embedding): "${video.title?.substring(0, 40)}..."`);
        skipped++;
        continue;
      }
      
      // Generate embedding
      const embedding = await generateEmbedding(video.title);
      
      if (!embedding) {
        console.log(`${progress} ❌ Failed: "${video.title?.substring(0, 40)}..."`);
        failed++;
        continue;
      }
      
      // Save to database
      const success = await updateVideoEmbedding(video.id, embedding, args.dryRun);
      
      if (success) {
        console.log(`${progress} ✅ Done: "${video.title?.substring(0, 40)}..."`);
        succeeded++;
      } else {
        failed++;
      }
      
      // Rate limiting
      await sleep(CONFIG.RATE_LIMIT_DELAY);
    }
  }
  
  return { total, processed, succeeded, failed, skipped };
}

// Main function
async function main() {
  console.log('🚀 Competitor Video Embedding Backfill Script');
  console.log('='.repeat(50));
  
  const args = parseArgs();
  
  console.log('\n📋 Configuration:');
  console.log(`   Model: ${CONFIG.EMBEDDING_MODEL}`);
  console.log(`   Batch size: ${CONFIG.BATCH_SIZE}`);
  console.log(`   Limit: ${args.limit || 'none'}`);
  console.log(`   Show ID: ${args.showId || 'all'}`);
  console.log(`   Force regenerate: ${args.force}`);
  console.log(`   Dry run: ${args.dryRun}`);
  
  try {
    // Fetch videos
    console.log('\n🔍 Fetching videos...');
    const videos = await fetchVideosNeedingEmbeddings(args);
    
    if (videos.length === 0) {
      console.log('\n✅ No videos need embeddings. All done!');
      return;
    }
    
    console.log(`   Found ${videos.length} videos needing embeddings`);
    
    // Process videos
    const stats = await processVideos(videos, args);
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SUMMARY');
    console.log('='.repeat(50));
    console.log(`   Total videos: ${stats.total}`);
    console.log(`   Succeeded: ${stats.succeeded}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Skipped: ${stats.skipped}`);
    console.log('='.repeat(50));
    
    if (args.dryRun) {
      console.log('\n⚠️ This was a dry run. No changes were saved.');
    }
    
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run
main();
