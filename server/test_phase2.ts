const BASE_URL = 'http://localhost:5000/api/v1/auth';
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'Fundsroom@2026';

interface TestUser {
  email: string;
  role: string;
}

const users: TestUser[] = [
  { email: 'admin@fundsroom.local', role: 'ADMIN' },
  { email: 'sales@fundsroom.local', role: 'SALES' },
  { email: 'warehouse@fundsroom.local', role: 'WAREHOUSE' },
  { email: 'accounts@fundsroom.local', role: 'ACCOUNTS' },
];

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 2 AUTHENTICATION & RBAC VERIFICATION');
  console.log('====================================================\n');

  const tokens: Record<string, string> = {};

  // 1. Test Login for all 4 roles
  console.log('--- TEST 1: LOGIN FOR ALL 4 ROLES ---');
  for (const user of users) {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        password: DEMO_PASSWORD,
      }),
    });

    const data: any = await res.json();
    if (!res.ok) {
      console.error(`[FAIL] Login failed for ${user.email}:`, data);
      process.exit(1);
    }

    console.log(`[PASS] Login succeeded (HTTP ${res.status}) for ${user.email} (${user.role})`);
    if (data.data.user.passwordHash) {
      throw new Error(`SECURITY LEAK: passwordHash exposed in response for ${user.email}!`);
    }
    tokens[user.role] = data.data.token;
  }

  // 2. Test GET /api/v1/auth/me for all 4 roles
  console.log('\n--- TEST 2: GET /auth/me WITH RETURNED JWT ---');
  for (const user of users) {
    const token = tokens[user.role];
    const res = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data: any = await res.json();
    if (!res.ok) {
      console.error(`[FAIL] /auth/me failed for ${user.role}:`, data);
      process.exit(1);
    }

    console.log(`[PASS] /auth/me returned profile (HTTP ${res.status}) for ${user.email}: Role=${data.data.user.role}, Name="${data.data.user.name}"`);
    if (data.data.user.passwordHash) {
      throw new Error(`SECURITY LEAK: passwordHash exposed in /auth/me for ${user.email}!`);
    }
  }

  // 3. Test Invalid Credentials (wrong password) -> 401
  console.log('\n--- TEST 3: INVALID CREDENTIALS HANDLING ---');
  {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@fundsroom.local',
        password: 'IncorrectPassword123!',
      }),
    });
    const data: any = await res.json();
    if (res.status === 401) {
      console.log(`[PASS] Invalid password returned HTTP 401: "${data.error.message}"`);
    } else {
      console.error('[FAIL] Expected 401, got:', res.status, data);
      process.exit(1);
    }
  }

  // Test Non-existent Email -> 401
  {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@fundsroom.local',
        password: DEMO_PASSWORD,
      }),
    });
    const data: any = await res.json();
    if (res.status === 401) {
      console.log(`[PASS] Non-existent email returned HTTP 401: "${data.error.message}"`);
    } else {
      console.error('[FAIL] Expected 401, got:', res.status, data);
      process.exit(1);
    }
  }

  // 4. Test Missing / Invalid JWT -> 401
  console.log('\n--- TEST 4: MISSING OR INVALID JWT HANDLING ---');
  // Missing token
  {
    const res = await fetch(`${BASE_URL}/me`);
    const data: any = await res.json();
    if (res.status === 401) {
      console.log(`[PASS] Missing token returned HTTP 401: "${data.error.message}"`);
    } else {
      console.error('[FAIL] Expected 401 for missing token, got:', res.status);
      process.exit(1);
    }
  }

  // Invalid token
  {
    const res = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: 'Bearer this-is-an-invalid-fake-token' },
    });
    const data: any = await res.json();
    if (res.status === 401) {
      console.log(`[PASS] Fake token returned HTTP 401: "${data.error.message}"`);
    } else {
      console.error('[FAIL] Expected 401 for fake token, got:', res.status);
      process.exit(1);
    }
  }

  // 5. Test RBAC for all four roles
  console.log('\n--- TEST 5: RBAC ENFORCEMENT ACROSS ALL 4 ROLES ---');

  const rbacTests = [
    { role: 'ADMIN', endpoint: 'admin', expectedAllowed: true },
    { role: 'ADMIN', endpoint: 'sales', expectedAllowed: false },
    { role: 'SALES', endpoint: 'sales', expectedAllowed: true },
    { role: 'SALES', endpoint: 'admin', expectedAllowed: false },
    { role: 'WAREHOUSE', endpoint: 'warehouse', expectedAllowed: true },
    { role: 'WAREHOUSE', endpoint: 'accounts', expectedAllowed: false },
    { role: 'ACCOUNTS', endpoint: 'accounts', expectedAllowed: true },
    { role: 'ACCOUNTS', endpoint: 'admin', expectedAllowed: false },
  ];

  for (const t of rbacTests) {
    const token = tokens[t.role];
    const res = await fetch(`${BASE_URL}/test/${t.endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data: any = await res.json();

    if (t.expectedAllowed) {
      if (res.status === 200) {
        console.log(`[PASS] ${t.role} successfully accessed /test/${t.endpoint} (HTTP 200)`);
      } else {
        console.error(`[FAIL] ${t.role} should have been allowed on /test/${t.endpoint}, got ${res.status}:`, data);
        process.exit(1);
      }
    } else {
      if (res.status === 403) {
        console.log(`[PASS] ${t.role} blocked from /test/${t.endpoint} with HTTP 403: "${data.error.message}"`);
      } else {
        console.error(`[FAIL] ${t.role} should have been forbidden on /test/${t.endpoint}, got ${res.status}:`, data);
        process.exit(1);
      }
    }
  }

  // 6. Test Zod Validation error formatting
  console.log('\n--- TEST 6: ZOD VALIDATION ERROR HANDLING ---');
  {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: '',
      }),
    });
    const data: any = await res.json();
    if (res.status === 400) {
      console.log('[PASS] Validation error returned HTTP 400 with structured field errors:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.error('[FAIL] Expected 400, got:', res.status);
      process.exit(1);
    }
  }

  console.log('\n====================================================');
  console.log('ALL PHASE 2 TESTS PASSED SUCCESSFULLY! (100% PASS)');
  console.log('====================================================');
}

runTests().catch((e) => {
  console.error('Fatal error running tests:', e);
  process.exit(1);
});
