// Test Supabase Connection
// Run this with: node scripts/test-connection.js

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n🔍 Testing Supabase Connection...\n');
console.log('Supabase URL:', supabaseUrl);
console.log('Service Key exists:', !!supabaseKey);
console.log('Service Key length:', supabaseKey?.length || 0);

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ Missing environment variables!');
  console.error('Make sure you have .env.local with:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test 1: Check if we can connect
    console.log('\n📡 Test 1: Testing connection...');
    const { data: tables, error: tablesError } = await supabase
      .from('locations')
      .select('*')
      .limit(1);
    
    if (tablesError) {
      console.error('❌ Connection error:', tablesError.message);
      return;
    }
    console.log('✅ Connection successful!');

    // Test 2: Check if schema exists
    console.log('\n📋 Test 2: Checking if tables exist...');
    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select('count');
    
    if (locError) {
      console.error('❌ Schema error:', locError.message);
      console.error('\n💡 You need to run the schema.sql file in Supabase!');
      console.error('   1. Go to: https://supabase.com/dashboard/project/xpzzvuaqiytgnaychoea');
      console.error('   2. Click SQL Editor');
      console.error('   3. Copy contents of supabase/schema.sql');
      console.error('   4. Paste and Run');
      return;
    }
    console.log('✅ Tables exist!');

    // Test 3: Count records
    console.log('\n📊 Test 3: Counting records...');
    const { count: locCount } = await supabase
      .from('locations')
      .select('*', { count: 'exact', head: true });
    
    const { count: compCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });
    
    const { count: roomCount } = await supabase
      .from('rooms')
      .select('*', { count: 'exact', head: true });
    
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    console.log('  Locations:', locCount || 0);
    console.log('  Companies:', compCount || 0);
    console.log('  Rooms:', roomCount || 0);
    console.log('  Users:', userCount || 0);

    if (locCount === 0) {
      console.log('\n⚠️  No data found! Run the seed script:');
      console.log('   1. Go to: https://supabase.com/dashboard/project/xpzzvuaqiytgnaychoea');
      console.log('   2. Click SQL Editor');
      console.log('   3. Copy contents of scripts/quick-seed.sql');
      console.log('   4. Paste and Run');
    } else {
      console.log('\n✅ Data exists! Fetching locations...\n');
      const { data: allLocations } = await supabase
        .from('locations')
        .select('*');
      
      console.table(allLocations);
    }

    console.log('\n✅ All tests passed!');
    console.log('\nIf the web app still shows no data, check:');
    console.log('  1. Browser console for errors (F12)');
    console.log('  2. Network tab to see API calls');
    console.log('  3. Try refreshing the page');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

testConnection();

