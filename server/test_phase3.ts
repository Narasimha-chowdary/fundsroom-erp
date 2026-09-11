const BASE_AUTH_URL = 'http://localhost:5000/api/v1/auth';
const BASE_CUSTOMER_URL = 'http://localhost:5000/api/v1/customers';
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'Fundsroom@2026';

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE_AUTH_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return data.data.token;
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 3 CUSTOMER CRM VERIFICATION');
  console.log('====================================================\n');

  // Obtain tokens for all roles
  console.log('Authenticating test users...');
  const salesToken = await login('sales@fundsroom.local');
  const accountsToken = await login('accounts@fundsroom.local');
  const warehouseToken = await login('warehouse@fundsroom.local');
  const adminToken = await login('admin@fundsroom.local');
  console.log('[PASS] All role tokens obtained.\n');

  // 1. Create Test Customer as SALES
  console.log('--- TEST 1: CREATE CUSTOMER AS SALES ---');
  const newCustomerPayload = {
    name: 'Rajesh Sharma',
    businessName: 'Apex Wholesale Mart',
    mobileNumber: '9876543210',
    email: 'rajesh@apexmart.com',
    gstNumber: '27ABCDE1234F1Z5',
    customerType: 'WHOLESALE',
    address: 'Plot 42, Sector 18, Industrial Area, Pune, Maharashtra',
    status: 'LEAD',
    followUpDate: '2026-09-25',
    initialNote: 'Met at national trade expo. Highly interested in bulk distribution pricing.',
  };

  const createRes = await fetch(BASE_CUSTOMER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${salesToken}`,
    },
    body: JSON.stringify(newCustomerPayload),
  });

  const createData: any = await createRes.json();
  if (createRes.status !== 201) {
    console.error('[FAIL] Create customer failed:', createRes.status, createData);
    process.exit(1);
  }

  const createdCustomer = createData.data.customer;
  console.log(`[PASS] Customer created successfully with ID: ${createdCustomer.id}`);
  console.log(`  Name: ${createdCustomer.name}`);
  console.log(`  Business: ${createdCustomer.businessName}`);
  console.log(`  Created By: ${createdCustomer.createdBy.name} (${createdCustomer.createdBy.role})`);
  console.log(`  Initial Notes count: ${createdCustomer.notes.length}`);
  console.log(`  Note Content: "${createdCustomer.notes[0]?.note}"`);

  const customerId = createdCustomer.id;

  // 2. Search Customer (by name, business name, mobile)
  console.log('\n--- TEST 2: SEARCH CUSTOMER ---');
  // Search by businessName
  {
    const searchRes = await fetch(`${BASE_CUSTOMER_URL}?search=Apex`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const searchData: any = await searchRes.json();
    const found = searchData.data.some((c: any) => c.id === customerId);
    if (searchRes.ok && found) {
      console.log('[PASS] Search by business name "Apex" succeeded.');
    } else {
      console.error('[FAIL] Search by "Apex" failed to find customer:', searchData);
      process.exit(1);
    }
  }

  // Search by mobile
  {
    const searchRes = await fetch(`${BASE_CUSTOMER_URL}?search=9876543210`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const searchData: any = await searchRes.json();
    const found = searchData.data.some((c: any) => c.id === customerId);
    if (searchRes.ok && found) {
      console.log('[PASS] Search by mobile number "9876543210" succeeded.');
    } else {
      console.error('[FAIL] Search by mobile failed:', searchData);
      process.exit(1);
    }
  }

  // 3. Filter Customer (by status and customerType)
  console.log('\n--- TEST 3: FILTER CUSTOMER BY STATUS AND TYPE ---');
  {
    const filterRes = await fetch(`${BASE_CUSTOMER_URL}?status=LEAD&customerType=WHOLESALE`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const filterData: any = await filterRes.json();
    const found = filterData.data.some((c: any) => c.id === customerId);
    if (filterRes.ok && found) {
      console.log(`[PASS] Filter by status=LEAD & customerType=WHOLESALE returned matching customer.`);
    } else {
      console.error('[FAIL] Filter failed:', filterData);
      process.exit(1);
    }
  }

  // 4. Get Customer Details (by ID)
  console.log('\n--- TEST 4: GET CUSTOMER DETAILS (WITH NOTES & CHALLANS) ---');
  {
    const getRes = await fetch(`${BASE_CUSTOMER_URL}/${customerId}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const getData: any = await getRes.json();
    if (getRes.status === 200 && getData.data.customer.id === customerId) {
      console.log('[PASS] GET /customers/:id returned full details:');
      console.log(`  Notes count: ${getData.data.customer.notes.length}`);
      console.log(`  Notes author: ${getData.data.customer.notes[0]?.author.name}`);
      console.log(`  Challans array present: ${Array.isArray(getData.data.customer.challans)}`);
    } else {
      console.error('[FAIL] GET customer details failed:', getData);
      process.exit(1);
    }
  }

  // 5. Edit Customer Details
  console.log('\n--- TEST 5: EDIT CUSTOMER AS SALES ---');
  {
    const updateRes = await fetch(`${BASE_CUSTOMER_URL}/${customerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${salesToken}`,
      },
      body: JSON.stringify({
        status: 'ACTIVE',
        followUpDate: '2026-10-01',
        businessName: 'Apex Wholesale Mart Private Limited',
      }),
    });
    const updateData: any = await updateRes.json();
    if (updateRes.status === 200 && updateData.data.customer.status === 'ACTIVE') {
      console.log('[PASS] Customer updated to ACTIVE and businessName modified.');
    } else {
      console.error('[FAIL] Update customer failed:', updateData);
      process.exit(1);
    }
  }

  // 6. Add Follow-up Note
  console.log('\n--- TEST 6: ADD FOLLOW-UP INTERACTION NOTE ---');
  {
    const noteRes = await fetch(`${BASE_CUSTOMER_URL}/${customerId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${salesToken}`,
      },
      body: JSON.stringify({
        note: 'Follow-up call completed. Customer verified GST and confirmed first order will be placed next week.',
      }),
    });
    const noteData: any = await noteRes.json();
    if (noteRes.status === 201 && noteData.data.note.author.role === 'SALES') {
      console.log('[PASS] Follow-up note successfully added:');
      console.log(`  Note ID: ${noteData.data.note.id}`);
      console.log(`  Author: ${noteData.data.note.author.name} (${noteData.data.note.author.role})`);
    } else {
      console.error('[FAIL] Add note failed:', noteData);
      process.exit(1);
    }
  }

  // 7. Verify ACCOUNTS permissions (View allowed, Create/Edit forbidden)
  console.log('\n--- TEST 7: VERIFY ACCOUNTS ROLE RESTRICTIONS ---');
  // Accounts can view list
  {
    const res = await fetch(BASE_CUSTOMER_URL, {
      headers: { Authorization: `Bearer ${accountsToken}` },
    });
    if (res.status === 200) {
      console.log('[PASS] ACCOUNTS role successfully viewed customer list (HTTP 200)');
    } else {
      console.error('[FAIL] ACCOUNTS could not view customer list:', res.status);
      process.exit(1);
    }
  }

  // Accounts can view details
  {
    const res = await fetch(`${BASE_CUSTOMER_URL}/${customerId}`, {
      headers: { Authorization: `Bearer ${accountsToken}` },
    });
    if (res.status === 200) {
      console.log('[PASS] ACCOUNTS role successfully viewed customer details (HTTP 200)');
    } else {
      console.error('[FAIL] ACCOUNTS could not view customer details:', res.status);
      process.exit(1);
    }
  }

  // Accounts cannot create customer (403 Forbidden)
  {
    const res = await fetch(BASE_CUSTOMER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountsToken}`,
      },
      body: JSON.stringify(newCustomerPayload),
    });
    const data: any = await res.json();
    if (res.status === 403) {
      console.log(`[PASS] ACCOUNTS blocked from creating customer (HTTP 403): "${data.error.message}"`);
    } else {
      console.error('[FAIL] ACCOUNTS should have been blocked from creating customer, got:', res.status);
      process.exit(1);
    }
  }

  // Accounts cannot edit customer (403 Forbidden)
  {
    const res = await fetch(`${BASE_CUSTOMER_URL}/${customerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountsToken}`,
      },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    const data: any = await res.json();
    if (res.status === 403) {
      console.log(`[PASS] ACCOUNTS blocked from editing customer (HTTP 403): "${data.error.message}"`);
    } else {
      console.error('[FAIL] ACCOUNTS should have been blocked from editing customer, got:', res.status);
      process.exit(1);
    }
  }

  // Accounts cannot add note (403 Forbidden)
  {
    const res = await fetch(`${BASE_CUSTOMER_URL}/${customerId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountsToken}`,
      },
      body: JSON.stringify({ note: 'Accounts test note' }),
    });
    const data: any = await res.json();
    if (res.status === 403) {
      console.log(`[PASS] ACCOUNTS blocked from adding customer note (HTTP 403): "${data.error.message}"`);
    } else {
      console.error('[FAIL] ACCOUNTS should have been blocked from adding note, got:', res.status);
      process.exit(1);
    }
  }

  // 8. Verify WAREHOUSE is completely blocked from Customer CRM
  console.log('\n--- TEST 8: VERIFY WAREHOUSE IS FORBIDDEN FROM ALL CUSTOMER CRM ---');
  {
    const res = await fetch(BASE_CUSTOMER_URL, {
      headers: { Authorization: `Bearer ${warehouseToken}` },
    });
    const data: any = await res.json();
    if (res.status === 403) {
      console.log(`[PASS] WAREHOUSE blocked from listing customers (HTTP 403): "${data.error.message}"`);
    } else {
      console.error('[FAIL] WAREHOUSE should be forbidden from customer CRM, got:', res.status);
      process.exit(1);
    }
  }

  // 9. Verify Invalid Customer Data returns HTTP 400 with Zod details
  console.log('\n--- TEST 9: VERIFY INVALID DATA RETURNS HTTP 400 ---');
  {
    const res = await fetch(BASE_CUSTOMER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${salesToken}`,
      },
      body: JSON.stringify({
        name: '',
        businessName: '',
        mobileNumber: 'not-a-phone',
        email: 'invalid-email-format',
        gstNumber: 'invalid-gst',
        address: '',
      }),
    });
    const data: any = await res.json();
    if (res.status === 400 && data.error.details?.length > 0) {
      console.log('[PASS] Invalid customer data returned HTTP 400 with validation details:');
      for (const d of data.error.details) {
        console.log(`  - Field: ${d.field} -> ${d.message}`);
      }
    } else {
      console.error('[FAIL] Expected 400 with details, got:', res.status, data);
      process.exit(1);
    }
  }

  // 10. Verify Nonexistent Customer returns HTTP 404
  console.log('\n--- TEST 10: VERIFY NONEXISTENT CUSTOMER RETURNS HTTP 404 ---');
  {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${BASE_CUSTOMER_URL}/${fakeId}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const data: any = await res.json();
    if (res.status === 404) {
      console.log(`[PASS] Nonexistent customer returned HTTP 404: "${data.error.message}"`);
    } else {
      console.error('[FAIL] Expected 404, got:', res.status, data);
      process.exit(1);
    }
  }

  // 11. Verify Pagination Works
  console.log('\n--- TEST 11: VERIFY PAGINATION ---');
  {
    const res = await fetch(`${BASE_CUSTOMER_URL}?page=1&limit=2`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data: any = await res.json();
    if (res.status === 200 && data.pagination) {
      console.log('[PASS] Pagination metadata verified:');
      console.log(`  Total: ${data.pagination.total}`);
      console.log(`  Page: ${data.pagination.page}`);
      console.log(`  Limit: ${data.pagination.limit}`);
      console.log(`  Total Pages: ${data.pagination.totalPages}`);
      console.log(`  Has Next Page: ${data.pagination.hasNextPage}`);
      console.log(`  Has Prev Page: ${data.pagination.hasPrevPage}`);
      console.log(`  Customers on current page: ${data.data.length}`);
    } else {
      console.error('[FAIL] Pagination metadata missing or invalid:', data);
      process.exit(1);
    }
  }

  console.log('\n====================================================');
  console.log('ALL PHASE 3 CUSTOMER CRM TESTS PASSED! (100% PASS)');
  console.log('====================================================');
}

runTests().catch((e) => {
  console.error('Fatal error running Phase 3 tests:', e);
  process.exit(1);
});
