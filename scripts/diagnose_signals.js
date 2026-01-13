/**
 * DIAGNOSE SIGNALS ISSUE
 * Run this to check why signals aren't being saved
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('🔍 Diagnosing Signals Issue...\n');
  
  // 1. Check shows
  console.log('1️⃣ Checking shows...');
  const { data: shows, error: showsError } = await supabase
    .from('shows')
    .select('id, name')
    .limit(10);
  
  if (showsError) {
    console.error('❌ Error fetching shows:', showsError);
  } else {
    console.log(`✅ Found ${shows.length} shows:`);
    shows.forEach(s => console.log(`   - ${s.id}: ${s.name}`));
  }
  
  // 2. Check signals table exists and count
  console.log('\n2️⃣ Checking signals table...');
  const { count, error: countError } = await supabase
    .from('signals')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('❌ Error counting signals:', countError);
    console.error('   This might indicate RLS policy issues or table doesn\'t exist');
  } else {
    console.log(`✅ Total signals in database: ${count}`);
  }
  
  // 3. Check signals by show_id
  if (shows && shows.length > 0) {
    const showId = shows[0].id;
    console.log(`\n3️⃣ Checking signals for show: ${showId}...`);
    
    const { data: signals, error: signalsError } = await supabase
      .from('signals')
      .select('id, title, score, created_at, show_id')
      .eq('show_id', showId)
      .limit(10);
    
    if (signalsError) {
      console.error('❌ Error fetching signals:', signalsError);
      console.error('   Code:', signalsError.code);
      console.error('   Message:', signalsError.message);
      console.error('   Details:', signalsError.details);
      console.error('   Hint:', signalsError.hint);
    } else {
      console.log(`✅ Found ${signals.length} signals for this show:`);
      if (signals.length > 0) {
        signals.forEach(s => {
          console.log(`   - ${s.id}: "${s.title?.substring(0, 50)}..." (score: ${s.score}, created: ${s.created_at})`);
        });
      } else {
        console.log('   ⚠️  No signals found for this show_id');
      }
    }
  }
  
  // 4. Try to insert a test signal
  if (shows && shows.length > 0) {
    const showId = shows[0].id;
    console.log(`\n4️⃣ Testing signal insertion for show: ${showId}...`);
    
    const testSignal = {
      show_id: showId,
      title: `TEST SIGNAL ${Date.now()}`,
      description: 'This is a test signal to check if insertion works',
      url: 'https://example.com/test',
      type: 'news',
      score: 50,
      hook_potential: '5.0',
      status: 'new',
      raw_data: { test: true },
      detected_at: new Date().toISOString()
    };
    
    const { data: inserted, error: insertError } = await supabase
      .from('signals')
      .insert(testSignal)
      .select();
    
    if (insertError) {
      console.error('❌ Error inserting test signal:', insertError);
      console.error('   Code:', insertError.code);
      console.error('   Message:', insertError.message);
      console.error('   Details:', insertError.details);
      console.error('   Hint:', insertError.hint);
      console.error('\n   💡 This indicates a write issue (RLS policy or schema mismatch)');
    } else {
      console.log('✅ Test signal inserted successfully!');
      console.log('   Signal ID:', inserted[0].id);
      
      // Clean up test signal
      await supabase
        .from('signals')
        .delete()
        .eq('id', inserted[0].id);
      console.log('   Test signal cleaned up');
    }
  }
  
  // 5. Check RLS policies (if we can)
  console.log('\n5️⃣ Checking RLS policies...');
  console.log('   Run this SQL in Supabase dashboard:');
  console.log('   SELECT * FROM pg_policies WHERE tablename = \'signals\';');
  console.log('   SELECT * FROM pg_policies WHERE tablename = \'shows\';');
  
  console.log('\n✅ Diagnosis complete!');
}

diagnose().catch(console.error);




