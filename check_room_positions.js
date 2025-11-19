const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRoomPositions() {
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('id, name, floor_id, map_position')
    .not('map_position', 'is', null);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== MAPPED ROOM POSITIONS ===\n');
  rooms.forEach(room => {
    console.log(`Room: ${room.name}`);
    console.log(`  ID: ${room.id}`);
    console.log(`  Floor ID: ${room.floor_id}`);
    console.log(`  Position: ${JSON.stringify(room.map_position, null, 2)}`);
    console.log('---');
  });

  // Also check floor dimensions
  const { data: floors } = await supabase
    .from('floors')
    .select('id, name, width, height')
    .limit(5);

  console.log('\n=== FLOOR DIMENSIONS ===\n');
  floors.forEach(floor => {
    console.log(`Floor: ${floor.name}`);
    console.log(`  ID: ${floor.id}`);
    console.log(`  Canvas Size: ${floor.width} x ${floor.height}`);
    console.log('---');
  });
}

checkRoomPositions();
