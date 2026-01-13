/**
 * CHECK COMPETITOR SCHEMA
 * 
 * Shows the actual database schema for competitor_videos and competitors tables
 * 
 * Usage: node scripts/check-competitor-schema.mjs
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

async function checkSchema() {
  console.log('\n🔍 COMPETITOR SCHEMA INSPECTION\n');
  console.log('='.repeat(60));

  try {
    // 1. Check competitor_videos columns (infer from sample data)
    console.log('\n📊 1. competitor_videos TABLE COLUMNS:');
    console.log('='.repeat(60));
    
    const { data: cvSample, error: cvError } = await supabase
      .from('competitor_videos')
      .select('*')
      .limit(1);
    
    if (cvError) {
      console.error('   ❌ Error:', cvError);
    } else if (cvSample && cvSample.length > 0) {
      console.log('\n   Columns (inferred from sample data):');
      Object.keys(cvSample[0]).forEach((key, idx) => {
        const value = cvSample[0][key];
        const type = value === null ? 'null' : 
                    Array.isArray(value) ? 'array' :
                    typeof value;
        console.log(`   ${idx + 1}. ${key}`);
        console.log(`      Type: ${type}`);
        console.log(`      Sample value: ${value === null ? 'NULL' : 
                    typeof value === 'string' && value.length > 40 ? 
                    value.substring(0, 40) + '...' : 
                    JSON.stringify(value)}`);
      });
    } else {
      console.log('   ⚠️  No data in table to infer schema');
    }

    // 2. Check competitors columns (infer from sample data)
    console.log('\n👥 2. competitors TABLE COLUMNS:');
    console.log('='.repeat(60));
    
    const { data: compSample, error: compError } = await supabase
      .from('competitors')
      .select('*')
      .limit(1);
    
    if (compError) {
      console.error('   ❌ Error:', compError);
    } else if (compSample && compSample.length > 0) {
      console.log('\n   Columns (inferred from sample data):');
      Object.keys(compSample[0]).forEach((key, idx) => {
        const value = compSample[0][key];
        const type = value === null ? 'null' : 
                    Array.isArray(value) ? 'array' :
                    typeof value;
        console.log(`   ${idx + 1}. ${key}`);
        console.log(`      Type: ${type}`);
        console.log(`      Sample value: ${value === null ? 'NULL' : 
                    typeof value === 'string' && value.length > 40 ? 
                    value.substring(0, 40) + '...' : 
                    JSON.stringify(value)}`);
      });
    } else {
      console.log('   ⚠️  No data in table to infer schema');
    }

    // 3. Show sample data
    console.log('\n📋 3. SAMPLE DATA:');
    console.log('='.repeat(60));
    
    console.log('\n   competitor_videos (first 3 rows):');
    const { data: cvSamples, error: cvSampleError } = await supabase
      .from('competitor_videos')
      .select('*')
      .limit(3);
    
    if (cvSampleError) {
      console.error('   ❌ Error:', cvSampleError);
    } else if (cvSamples && cvSamples.length > 0) {
      cvSamples.forEach((row, idx) => {
        console.log(`\n   Row ${idx + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          const displayValue = value === null ? 'NULL' : 
                              typeof value === 'string' && value.length > 50 ? 
                              value.substring(0, 50) + '...' : 
                              value;
          console.log(`      ${key}: ${displayValue}`);
        });
      });
    } else {
      console.log('   ⚠️  No data in competitor_videos table');
    }

    console.log('\n   competitors (first 3 rows):');
    const { data: compSamples, error: compSampleError } = await supabase
      .from('competitors')
      .select('*')
      .limit(3);
    
    if (compSampleError) {
      console.error('   ❌ Error:', compSampleError);
    } else if (compSamples && compSamples.length > 0) {
      compSamples.forEach((row, idx) => {
        console.log(`\n   Row ${idx + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          const displayValue = value === null ? 'NULL' : 
                              typeof value === 'string' && value.length > 50 ? 
                              value.substring(0, 50) + '...' : 
                              value;
          console.log(`      ${key}: ${displayValue}`);
        });
      });
    } else {
      console.log('   ⚠️  No data in competitors table');
    }

    // 4. Check relationship
    console.log('\n🔗 4. RELATIONSHIP ANALYSIS:');
    console.log('='.repeat(60));
    
    // Check if competitor_videos has competitor_id
    const { data: cvWithComp } = await supabase
      .from('competitor_videos')
      .select('competitor_id, competitors(*)')
      .limit(1);
    
    if (cvWithComp && cvWithComp.length > 0) {
      console.log('\n   ✅ competitor_videos.competitor_id exists');
      console.log(`   Sample competitor_id: ${cvWithComp[0].competitor_id}`);
      if (cvWithComp[0].competitors) {
        console.log('   ✅ Can join with competitors table');
        console.log(`   Sample competitor data:`, {
          id: cvWithComp[0].competitors.id,
          name: cvWithComp[0].competitors.name,
          show_id: cvWithComp[0].competitors.show_id
        });
      }
    } else {
      console.log('   ⚠️  Could not verify relationship');
    }

    // Check if competitors has show_id
    const { data: compWithShow } = await supabase
      .from('competitors')
      .select('id, show_id, name')
      .limit(1);
    
    if (compWithShow && compWithShow.length > 0) {
      console.log('\n   ✅ competitors.show_id exists');
      console.log(`   Sample: competitor.id = ${compWithShow[0].id}, show_id = ${compWithShow[0].show_id}`);
    } else {
      console.log('   ⚠️  Could not verify show_id in competitors');
    }

    // 5. Show the relationship path
    console.log('\n📊 5. RELATIONSHIP PATH:');
    console.log('='.repeat(60));
    console.log('\n   competitor_videos → competitors → shows');
    console.log('   ├─ competitor_videos.competitor_id → competitors.id');
    console.log('   └─ competitors.show_id → shows.id');
    console.log('\n   To get videos for a show:');
    console.log('   1. Get competitor IDs: SELECT id FROM competitors WHERE show_id = ?');
    console.log('   2. Get videos: SELECT * FROM competitor_videos WHERE competitor_id IN (...)');

    console.log('\n' + '='.repeat(60));
    console.log('✅ SCHEMA INSPECTION COMPLETE');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
  }
}

checkSchema();
