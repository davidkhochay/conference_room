// Copy every object in the room-photos bucket from one Supabase project to another,
// then print the SQL that rewrites stored photo/image URLs to the new project.
// Only needed when moving to a NEW project (not for an org transfer).
//
// Usage:
//   OLD_SUPABASE_URL=... OLD_SUPABASE_SERVICE_ROLE_KEY=... \
//   NEW_SUPABASE_URL=... NEW_SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/migrate-storage.js

const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'room-photos';
const PAGE_SIZE = 100;

const required = [
  'OLD_SUPABASE_URL',
  'OLD_SUPABASE_SERVICE_ROLE_KEY',
  'NEW_SUPABASE_URL',
  'NEW_SUPABASE_SERVICE_ROLE_KEY',
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error('Missing env vars:', missing.join(', '));
  process.exit(1);
}

const clientOpts = { auth: { autoRefreshToken: false, persistSession: false } };
const oldDb = createClient(process.env.OLD_SUPABASE_URL, process.env.OLD_SUPABASE_SERVICE_ROLE_KEY, clientOpts);
const newDb = createClient(process.env.NEW_SUPABASE_URL, process.env.NEW_SUPABASE_SERVICE_ROLE_KEY, clientOpts);

// Recursively list file paths; folder entries come back with id === null.
async function listAll(prefix = '') {
  const paths = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await oldDb.storage.from(BUCKET).list(prefix, { limit: PAGE_SIZE, offset });
    if (error) throw error;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) paths.push(...(await listAll(path)));
      else paths.push(path);
    }
    if (data.length < PAGE_SIZE) return paths;
  }
}

async function ensureBucket() {
  const { data } = await newDb.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await newDb.storage.createBucket(BUCKET, { public: true });
  if (error) throw error;
  console.log(`Created public bucket "${BUCKET}" in new project`);
}

async function main() {
  await ensureBucket();
  const paths = await listAll();
  console.log(`Found ${paths.length} objects in "${BUCKET}"`);

  let copied = 0;
  const failed = [];
  for (const path of paths) {
    const { data: blob, error: dlError } = await oldDb.storage.from(BUCKET).download(path);
    if (dlError) {
      failed.push([path, dlError.message]);
      continue;
    }
    const { error: upError } = await newDb.storage.from(BUCKET).upload(path, Buffer.from(await blob.arrayBuffer()), {
      contentType: blob.type || undefined,
      cacheControl: '3600',
      upsert: true,
    });
    if (upError) failed.push([path, upError.message]);
    else copied++;
  }

  console.log(`Copied ${copied}/${paths.length}`);
  failed.forEach(([path, msg]) => console.error(`  FAILED ${path}: ${msg}`));

  const oldHost = new URL(process.env.OLD_SUPABASE_URL).host;
  const newHost = new URL(process.env.NEW_SUPABASE_URL).host;
  console.log('\nRun this in the NEW project SQL editor to repoint stored URLs:\n');
  for (const [table, column] of [['rooms', 'photo_url'], ['users', 'photo_url'], ['floors', 'image_url']]) {
    console.log(`UPDATE ${table} SET ${column} = replace(${column}, '${oldHost}', '${newHost}') WHERE ${column} LIKE '%${oldHost}%';`);
  }

  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
