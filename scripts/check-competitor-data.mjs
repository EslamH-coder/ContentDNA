/**
 * COMPETITOR DATA DIAGNOSTIC SCRIPT
 * 
 * Checks the status of competitor data for a show
 * 
 * Usage: node scripts/check-competitor-data.mjs <show_id>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
function loadEnv() {
  const envFiles = [join(__dirname, '../.env.local'), join(__dirname, '../.env')];
  for (const envFile of envFiles) {
    try {
      const content = readFileSync(envFile, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^#=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      });
    } catch (e) {
      // File doesn't exist, continue
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCompetitorData(showId) {
  console.log('\n🔍 COMPETITOR DATA DIAGNOSTIC\n');
  console.log('='.repeat(60));
  console.log(`Show ID: ${showId}`);
  console.log('='.repeat(60));

  try {
    // 1. Check competitor_videos count (via competitors join)
    console.log('\n📊 Step 1: Checking competitor_videos table...');
    // Get competitor IDs first
    const { data: compIds } = await supabase
      .from('competitors')
      .select('id')
      .eq('show_id', showId);
    
    const competitorIds = compIds?.map(c => c.id) || [];
    
    const { count: videoCount, error: videoError } = await supabase
      .from('competitor_videos')
      .select('*', { count: 'exact', head: true })
      .in('competitor_id', competitorIds);

    if (videoError) {
      console.error('❌ Error:', videoError);
    } else {
      console.log(`   Total competitor videos: ${videoCount || 0}`);
    }

    // 2. Check competitors configured
    console.log('\n👥 Step 2: Checking competitors table...');
    const { data: competitors, error: compError } = await supabase
      .from('competitors')
      .select('*')
      .eq('show_id', showId)
      .order('created_at', { ascending: false });

    if (compError) {
      console.error('❌ Error:', compError);
    } else {
      console.log(`   Total competitors: ${competitors?.length || 0}`);
      
      if (competitors && competitors.length > 0) {
        console.log('\n   Competitor Details:');
        competitors.forEach((comp, idx) => {
          console.log(`\n   ${idx + 1}. ${comp.name || 'Unnamed'}`);
          console.log(`      ID: ${comp.id}`);
          console.log(`      Channel ID: ${comp.youtube_channel_id || '❌ NOT SET'}`);
          console.log(`      Tracking: ${comp.tracking_enabled ? '✅ Enabled' : '❌ Disabled'}`);
          console.log(`      Type: ${comp.type || 'direct'}`);
          console.log(`      Last Checked: ${comp.last_checked || 'Never'}`);
          console.log(`      Created: ${comp.created_at || 'Unknown'}`);
        });
      } else {
        console.log('   ⚠️  No competitors configured!');
      }
    }

    // 3. Check competitor_videos for this show (via competitors join)
    console.log('\n📹 Step 3: Checking competitor_videos for this show...');
    const { data: videos, error: videosError } = await supabase
      .from('competitor_videos')
      .select(`
        *,
        competitors!inner (
          id,
          name,
          show_id
        )
      `)
      .eq('competitors.show_id', showId)
      .order('published_at', { ascending: false })
      .limit(10);

    if (videosError) {
      console.error('❌ Error:', videosError);
    } else {
      console.log(`   Recent videos: ${videos?.length || 0}`);
      
      if (videos && videos.length > 0) {
        console.log('\n   Recent Videos:');
        videos.slice(0, 5).forEach((video, idx) => {
          console.log(`\n   ${idx + 1}. ${video.title?.substring(0, 50) || 'Untitled'}...`);
          console.log(`      Competitor: ${video.competitors?.name || 'Unknown'}`);
          console.log(`      Views: ${video.views || 0}`);
          console.log(`      Published: ${video.published_at || 'Unknown'}`);
        });
      } else {
        console.log('   ⚠️  No competitor videos found!');
      }
    }

    // 4. Summary and recommendations
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY & RECOMMENDATIONS');
    console.log('='.repeat(60));

    const hasCompetitors = competitors && competitors.length > 0;
    const hasVideos = videos && videos.length > 0;
    const enabledCompetitors = competitors?.filter(c => c.tracking_enabled && c.youtube_channel_id) || [];

    console.log(`\n✅ Competitors configured: ${hasCompetitors ? 'Yes' : 'No'} (${competitors?.length || 0})`);
    console.log(`✅ Competitor videos: ${hasVideos ? 'Yes' : 'No'} (${videoCount || 0})`);
    console.log(`✅ Ready to sync: ${enabledCompetitors.length} competitors`);

    if (!hasCompetitors) {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('   1. Add competitors via UI: /studio/competitors');
      console.log('   2. Or via API: POST /api/competitors');
      console.log('   3. Make sure to set youtube_channel_id and enable tracking');
    } else if (!hasVideos) {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('   1. Trigger sync for each competitor:');
      enabledCompetitors.forEach(comp => {
        console.log(`      - ${comp.name}: POST /api/competitors/sync with { competitorId: "${comp.id}" }`);
      });
      console.log('   2. Or use UI: /studio/competitors → Click "Sync" button');
    } else if (enabledCompetitors.length === 0) {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('   1. Enable tracking for competitors:');
      competitors.forEach(comp => {
        if (!comp.tracking_enabled || !comp.youtube_channel_id) {
          console.log(`      - ${comp.name}: Enable tracking and set YouTube channel ID`);
        }
      });
    } else {
      console.log('\n✅ All good! Competitor data is available.');
      console.log(`   ${videoCount || 0} videos from ${enabledCompetitors.length} competitors`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ DIAGNOSTIC COMPLETE');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
  }
}

const showId = process.argv[2] || process.env.TEST_SHOW_ID || 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56';

if (!showId) {
  console.error('❌ Please provide a show_id:');
  console.error('   node scripts/check-competitor-data.mjs <show_id>');
  process.exit(1);
}

checkCompetitorData(showId);
