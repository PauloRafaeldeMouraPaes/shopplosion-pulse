#!/usr/bin/env node
/*
 * Runtime A-vs-B verifier for the real Supabase project.
 *
 * Required environment variables:
 *   PULSE_SUPABASE_URL
 *   PULSE_SUPABASE_ANON_KEY
 *   PULSE_TEST_A_EMAIL
 *   PULSE_TEST_A_PASSWORD
 *   PULSE_TEST_B_EMAIL
 *   PULSE_TEST_B_PASSWORD
 *
 * This script intentionally uses only the public/publishable key.
 * Never provide a service/secret key here.
 * Node 18+ is required for global fetch.
 */

const required = [
  'PULSE_SUPABASE_URL', 'PULSE_SUPABASE_ANON_KEY',
  'PULSE_TEST_A_EMAIL', 'PULSE_TEST_A_PASSWORD',
  'PULSE_TEST_B_EMAIL', 'PULSE_TEST_B_PASSWORD'
];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing ${name}`);
    process.exit(2);
  }
}

const BASE = process.env.PULSE_SUPABASE_URL.replace(/\/$/, '');
const KEY = process.env.PULSE_SUPABASE_ANON_KEY;

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      apikey: KEY,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
}

async function signIn(email, password) {
  const { response, body } = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok || !body?.access_token || !body?.user?.id) {
    throw new Error(`Login failed for ${email}: HTTP ${response.status} ${JSON.stringify(body)}`);
  }
  return { token: body.access_token, user: body.user };
}

async function rest(token, table, query, method = 'GET', payload) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: method === 'GET' ? 'return=representation' : 'return=representation'
  };
  const { response, body } = await request(`/rest/v1/${table}${query}`, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

async function main() {
  console.log('Pulse runtime multi-tenant isolation test');
  const A = await signIn(process.env.PULSE_TEST_A_EMAIL, process.env.PULSE_TEST_A_PASSWORD);
  const B = await signIn(process.env.PULSE_TEST_B_EMAIL, process.env.PULSE_TEST_B_PASSWORD);

  const aProfile = await rest(A.token, 'profiles', `?select=id,industry_id,role&id=eq.${encodeURIComponent(A.user.id)}`);
  const bProfile = await rest(B.token, 'profiles', `?select=id,industry_id,role&id=eq.${encodeURIComponent(B.user.id)}`);
  assert(aProfile.response.ok && aProfile.body?.length === 1, 'A has exactly one profile');
  assert(bProfile.response.ok && bProfile.body?.length === 1, 'B has exactly one profile');
  const industryA = aProfile.body[0].industry_id;
  const industryB = bProfile.body[0].industry_id;
  assert(industryA && industryB && industryA !== industryB, 'A and B belong to different industries');

  const aDocs = await rest(A.token, 'documents', '?select=id,industry_id,storage_path,filename');
  const bDocs = await rest(B.token, 'documents', '?select=id,industry_id,storage_path,filename');
  const aAnalyses = await rest(A.token, 'analyses', '?select=id,industry_id,title');
  const bAnalyses = await rest(B.token, 'analyses', '?select=id,industry_id,title');

  assert(aDocs.response.ok, 'A can query documents');
  assert(bDocs.response.ok, 'B can query documents');
  assert(aAnalyses.response.ok, 'A can query analyses');
  assert(bAnalyses.response.ok, 'B can query analyses');
  assert((aDocs.body || []).every(row => row.industry_id === industryA), 'A document result set contains only A');
  assert((bDocs.body || []).every(row => row.industry_id === industryB), 'B document result set contains only B');
  assert((aAnalyses.body || []).every(row => row.industry_id === industryA), 'A analysis result set contains only A');
  assert((bAnalyses.body || []).every(row => row.industry_id === industryB), 'B analysis result set contains only B');

  const injected = await rest(A.token, 'analyses', '', 'POST', {
    industry_id: industryB,
    created_by: A.user.id,
    title: 'SECURITY TEST — MUST FAIL',
    payload: { test: true }
  });
  assert(!injected.response.ok, 'A cannot insert an analysis into B');

  const bDoc = (bDocs.body || [])[0];
  if (bDoc?.id) {
    const crossRead = await rest(A.token, 'documents', `?select=id&id=eq.${encodeURIComponent(bDoc.id)}`);
    assert(crossRead.response.ok && (!crossRead.body || crossRead.body.length === 0), 'A cannot read a B document by ID');
  } else {
    console.log('SKIP: B has no document yet; direct document-ID cross-read test needs a B fixture.');
  }

  const aDoc = (aDocs.body || [])[0];
  if (aDoc?.storage_path) {
    const encodedPath = aDoc.storage_path.split('/').map(encodeURIComponent).join('/');
    const crossStorage = await request(`/storage/v1/object/pulse-documents/${encodedPath}`, {
      headers: { Authorization: `Bearer ${B.token}` }
    });
    assert(!crossStorage.response.ok, 'B cannot download an A Storage object');
  } else {
    console.log('SKIP: A has no document yet; Storage cross-read test needs an A fixture.');
  }

  console.log('\nRuntime isolation gate completed.');
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
