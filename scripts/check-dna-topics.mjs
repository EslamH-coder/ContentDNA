/**
 * Diagnostic script to check show_dna topics structure
 * Run: node scripts/check-dna-topics.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

let envVars = {};
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });
} catch (e) {
  console.warn('⚠️  Could not read .env.local, using process.env');
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const showId = 'a7982c70-2b0e-46af-a0ad-c78f4f69cd56'; // AlMokhbir

async function checkDNATopics() {
  console.log('🔍 Checking show_dna for show_id:', showId);
  console.log('');

  // 1. Get show_dna record
  const { data: showDna, error: dnaError } = await supabase
    .from('show_dna')
    .select('*')
    .eq('show_id', showId)
    .single();

  if (dnaError) {
    console.error('❌ Error fetching show_dna:', dnaError);
    return;
  }

  if (!showDna) {
    console.error('❌ No show_dna record found for show_id:', showId);
    return;
  }

  console.log('✅ Found show_dna record');
  console.log('   Columns in show_dna:', Object.keys(showDna));
  console.log('');

  // 2. Check topics column
  console.log('📊 Topics Column Analysis:');
  console.log('   Type:', typeof showDna.topics);
  console.log('   Value:', showDna.topics);
  console.log('   Is null:', showDna.topics === null);
  console.log('   Is undefined:', showDna.topics === undefined);
  console.log('');

  // 3. Try to parse if it's a string
  if (typeof showDna.topics === 'string') {
    console.log('📝 Topics is a string, attempting to parse...');
    try {
      const parsed = JSON.parse(showDna.topics);
      console.log('   ✅ Parsed successfully');
      console.log('   Parsed type:', typeof parsed);
      console.log('   Is array:', Array.isArray(parsed));
      console.log('   Is object:', typeof parsed === 'object' && parsed !== null);
      console.log('   Parsed value:', JSON.stringify(parsed, null, 2));
      
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log('');
        console.log('📋 First topic in array:');
        console.log('   Keys:', Object.keys(parsed[0] || {}));
        console.log('   Data:', JSON.stringify(parsed[0], null, 2));
      } else if (typeof parsed === 'object' && parsed !== null) {
        console.log('');
        console.log('📋 Object keys:', Object.keys(parsed));
        console.log('   First value:', parsed[Object.keys(parsed)[0]]);
      }
    } catch (e) {
      console.log('   ❌ Failed to parse JSON:', e.message);
    }
  } else if (Array.isArray(showDna.topics)) {
    console.log('📝 Topics is already an array');
    console.log('   Length:', showDna.topics.length);
    if (showDna.topics.length > 0) {
      console.log('   First topic:', JSON.stringify(showDna.topics[0], null, 2));
    }
  } else if (typeof showDna.topics === 'object' && showDna.topics !== null) {
    console.log('📝 Topics is an object');
    console.log('   Keys:', Object.keys(showDna.topics));
    console.log('   First value:', JSON.stringify(showDna.topics[Object.keys(showDna.topics)[0]], null, 2));
  }

  console.log('');

  // 4. Check topic_definitions table
  console.log('📚 Checking topic_definitions table...');
  const { data: topicDefs, error: topicDefError } = await supabase
    .from('topic_definitions')
    .select('*')
    .eq('show_id', showId);

  if (topicDefError) {
    console.log('   ⚠️  Error or table not found:', topicDefError.message);
  } else {
    console.log(`   ✅ Found ${topicDefs?.length || 0} topic definitions`);
    if (topicDefs && topicDefs.length > 0) {
      console.log('   First topic definition:', JSON.stringify(topicDefs[0], null, 2));
    }
  }

  console.log('');

  // 5. Check what topics SHOULD exist (based on user's expectation)
  console.log('🎯 Expected DNA Topics:');
  const expectedTopics = [
    {
      topic_id: 'energy_oil_gas',
      name: 'Energy, Oil & Gas',
      keywords: ['oil', 'نفط', 'petroleum', 'غاز', 'gas', 'energy', 'طاقة', 'bpetrol', 'crude', 'lng']
    },
    {
      topic_id: 'geopolitics',
      name: 'Geopolitics',
      keywords: ['trump', 'ترامب', 'china', 'الصين', 'war', 'حرب', 'iran', 'إيران', 'russia', 'روسيا']
    },
    {
      topic_id: 'economy',
      name: 'Economy',
      keywords: ['economy', 'اقتصاد', 'inflation', 'تضخم', 'dollar', 'دولار', 'market', 'سوق']
    }
  ];

  expectedTopics.forEach(topic => {
    console.log(`   - ${topic.topic_id}: ${topic.name}`);
    console.log(`     Keywords: ${topic.keywords.slice(0, 5).join(', ')}...`);
  });

  console.log('');
  console.log('💡 Recommendation:');
  if (!showDna.topics || (typeof showDna.topics === 'string' && showDna.topics.trim() === '') || 
      (Array.isArray(showDna.topics) && showDna.topics.length === 0)) {
    console.log('   Topics column is empty or invalid. Need to populate with proper topic definitions.');
  } else {
    console.log('   Topics exist but may have wrong structure. Check the parsed value above.');
  }
}

checkDNATopics().catch(console.error);
