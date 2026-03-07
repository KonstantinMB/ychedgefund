/**
 * ACLED OAuth Connection Test
 * Run with: npx tsx scripts/test-acled.ts
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const email = process.env.ACLED_EMAIL;
const password = process.env.ACLED_PASSWORD;

console.log('=== ACLED OAuth Test ===\n');

if (!email || !password) {
  console.error('❌ Missing credentials:');
  console.error(`   ACLED_EMAIL: ${email ? '✓ Set' : '✗ NOT SET'}`);
  console.error(`   ACLED_PASSWORD: ${password ? '✓ Set' : '✗ NOT SET'}`);
  console.error('\nAdd these to your .env.local file:');
  console.error('ACLED_EMAIL=your_email@domain.com');
  console.error('ACLED_PASSWORD=your_password');
  process.exit(1);
}

console.log(`📧 Email: ${email}`);
console.log(`🔑 Password: ${'*'.repeat(password.length)}\n`);

// Step 1: Get OAuth token
console.log('Step 1: Requesting OAuth token...');

const formData = new URLSearchParams({
  username: email,
  password: password,
  grant_type: 'password',
  client_id: 'acled',
});

try {
  const tokenRes = await fetch('https://acleddata.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  console.log(`   Status: ${tokenRes.status} ${tokenRes.statusText}`);

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    console.error(`\n❌ OAuth failed: ${errorText.substring(0, 200)}`);
    console.error('\nPossible issues:');
    console.error('- Wrong email/password');
    console.error('- Account not activated');
    console.error('- Need to register at: https://acleddata.com/register');
    process.exit(1);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  console.log(`✅ Token received (expires in ${tokenData.expires_in}s)`);
  console.log(`   Token: ${accessToken.substring(0, 20)}...`);

  // Step 2: Fetch conflict events
  console.log('\nStep 2: Fetching last 7 days of conflict events...');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const url =
    `https://acleddata.com/api/acled/read` +
    `?limit=50` +
    `&event_date=${startDate}|${today}` +
    `&event_date_where=BETWEEN` +
    `&fields=event_id_cnty,event_date,event_type,country,latitude,longitude,fatalities,notes`;

  const dataRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  console.log(`   Status: ${dataRes.status} ${dataRes.statusText}`);

  if (!dataRes.ok) {
    const errorText = await dataRes.text();
    console.error(`\n❌ Data fetch failed: ${errorText.substring(0, 200)}`);
    process.exit(1);
  }

  const data = await dataRes.json();
  const events = data.data || [];

  console.log(`✅ Received ${events.length} events`);

  if (events.length > 0) {
    console.log('\nSample event:');
    const sample = events[0];
    console.log(`   Date: ${sample.event_date}`);
    console.log(`   Type: ${sample.event_type}`);
    console.log(`   Country: ${sample.country}`);
    console.log(`   Location: ${sample.latitude}, ${sample.longitude}`);
    console.log(`   Fatalities: ${sample.fatalities}`);
    console.log(`   Notes: ${sample.notes?.substring(0, 80)}...`);
  }

  console.log('\n✅ ACLED connection is working!\n');
  console.log('Next steps:');
  console.log('1. Deploy to Vercel with these env vars:');
  console.log(`   ACLED_EMAIL=${email}`);
  console.log('   ACLED_PASSWORD=***');
  console.log('2. Conflict zones will update hourly');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}
