const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:bL3zSA8ZMnuWUoSa@db.sucywzycbaknqzekcfoa.supabase.co:5432/postgres'
});
async function run() {
  await client.connect();
  try {
    const res = await client.query(`ALTER TABLE push_subscriptions ADD COLUMN timezone_offset int;`);
    console.log('Success:', res);
  } catch (err) {
    console.error('Error:', err);
  }
  // Reload the PostgREST schema cache so the API recognizes the new column
  try {
    await client.query(`NOTIFY pgrst, 'reload schema'`);
    console.log('Schema cache reloaded');
  } catch(e) {}
  await client.end();
}
run();
