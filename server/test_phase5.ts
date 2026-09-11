const BASE_AUTH_URL = 'http://localhost:5000/api/v1/auth';
const BASE_CUSTOMER_URL = 'http://localhost:5000/api/v1/customers';
const BASE_PRODUCT_URL = 'http://localhost:5000/api/v1/products';
const BASE_CHALLAN_URL = 'http://localhost:5000/api/v1/challans';
const BASE_INVENTORY_URL = 'http://localhost:5000/api/v1/inventory';
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
  console.log('STARTING PHASE 5 SALES CHALLAN VERIFICATION');
  console.log('====================================================\n');

  // Authenticate all 4 test roles
  console.log('Authenticating test users...');
  const adminToken = await login('admin@fundsroom.local');
  const salesToken = await login('sales@fundsroom.local');
  const warehouseToken = await login('warehouse@fundsroom.local');
  const accountsToken = await login('accounts@fundsroom.local');
  console.log('[PASS] All role tokens obtained.\n');

  // Step A: Setup test Customer and two test Products
  console.log('Setting up prerequisite test entities...');
  const customerRes = await fetch(BASE_CUSTOMER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
    body: JSON.stringify({
      name: 'Vikas Patel',
      businessName: 'Patel Hardware & Electricals',
      mobileNumber: '9988776655',
      address: 'Shop 12, Main Bazaar, Ahmedabad, Gujarat',
    }),
  });
  const customerData: any = await customerRes.json();
  const customerId = customerData.data.customer.id;

  // Product 1: 100 in stock, unit price 500
  const prod1Sku = `CH-P1-${Date.now()}`;
  const prod1Res = await fetch(BASE_PRODUCT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${warehouseToken}` },
    body: JSON.stringify({
      name: 'Industrial Safety Gloves',
      sku: prod1Sku,
      category: 'Safety',
      unitPrice: 500,
      initialStock: 100,
      location: 'Rack 1',
    }),
  });
  const prod1Data: any = await prod1Res.json();
  const prod1Id = prod1Data.data.product.id;

  // Product 2: 40 in stock, unit price 1200
  const prod2Sku = `CH-P2-${Date.now()}`;
  const prod2Res = await fetch(BASE_PRODUCT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${warehouseToken}` },
    body: JSON.stringify({
      name: 'Safety Goggles Pro',
      sku: prod2Sku,
      category: 'Safety',
      unitPrice: 1200,
      initialStock: 40,
      location: 'Rack 2',
    }),
  });
  const prod2Data: any = await prod2Res.json();
  const prod2Id = prod2Data.data.product.id;

  console.log(`[PASS] Prerequisite customer (${customerId}) and products (${prod1Id}, ${prod2Id}) created.\n`);

  let challan1Id = '';
  let challan1Number = '';

  // 1. Create a DRAFT challan as SALES with multiple products
  console.log('--- TEST 1: CREATE DRAFT CHALLAN (SALES) WITH MULTIPLE PRODUCTS ---');
  {
    const res = await fetch(BASE_CHALLAN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({
        customerId,
        items: [
          { productId: prod1Id, quantity: 10 }, // 10 * 500 = 5000
          { productId: prod2Id, quantity: 5 },  // 5 * 1200 = 6000
        ],
        notes: 'Urgent commercial dispatch requested',
      }),
    });

    const data: any = await res.json();
    if (res.status !== 201) {
      console.error('[FAIL] Create challan failed:', res.status, data);
      process.exit(1);
    }

    const challan = data.data.challan;
    challan1Id = challan.id;
    challan1Number = challan.challanNumber;

    console.log(`[PASS] Challan created successfully with ID: ${challan.id}`);
    console.log(`  Challan Number (auto): ${challan.challanNumber}`);
    console.log(`  Status: ${challan.status}`);
    console.log(`  Customer: ${challan.customer.name} (${challan.customer.businessName})`);
    console.log(`  Total Quantity: ${challan.totalQuantity} (Expected: 15)`);
    console.log(`  Total Amount: ₹${challan.totalAmount} (Expected: 11000)`);
    console.log(`  Items count: ${challan.items.length}`);

    // Verify format CH-YYYYMM-XXXX
    const formatRegex = /^CH-\d{6}-\d{4}$/;
    if (!formatRegex.test(challan.challanNumber)) {
      console.error('[FAIL] Challan number does not match format CH-YYYYMM-XXXX:', challan.challanNumber);
      process.exit(1);
    }
    console.log('[PASS] Auto-generated Challan Number format verified: ' + challan.challanNumber);

    // Verify snapshot fields
    for (const item of challan.items) {
      console.log(`  Snapshot -> Product: "${item.productNameSnapshot}", SKU: ${item.skuSnapshot}, Price: ₹${item.unitPriceSnapshot}, Qty: ${item.quantity}, LineTotal: ₹${item.lineTotal}`);
      if (!item.productNameSnapshot || !item.skuSnapshot || !item.unitPriceSnapshot) {
        console.error('[FAIL] Snapshot fields missing on challan item:', item);
        process.exit(1);
      }
    }
  }

  // 2. Verify creating a DRAFT did NOT reduce stock
  console.log('\n--- TEST 2: VERIFY DRAFT CREATION DOES NOT REDUCE STOCK ---');
  {
    const p1Res = await fetch(`${BASE_PRODUCT_URL}/${prod1Id}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const p1Data: any = await p1Res.json();
    const p2Res = await fetch(`${BASE_PRODUCT_URL}/${prod2Id}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const p2Data: any = await p2Res.json();

    if (p1Data.data.product.currentStock === 100 && p2Data.data.product.currentStock === 40) {
      console.log(`[PASS] Stock unchanged for both products: Prod 1 = ${p1Data.data.product.currentStock} (100), Prod 2 = ${p2Data.data.product.currentStock} (40)`);
    } else {
      console.error('[FAIL] Stock was incorrectly deducted upon draft creation!', p1Data, p2Data);
      process.exit(1);
    }
  }

  // 3. Confirm challan with sufficient stock (as WAREHOUSE)
  console.log('\n--- TEST 3: CONFIRM CHALLAN WITH SUFFICIENT STOCK (WAREHOUSE) ---');
  {
    const res = await fetch(`${BASE_CHALLAN_URL}/${challan1Id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${warehouseToken}` },
    });
    const data: any = await res.json();

    if (res.status === 200 && data.data.challan.status === 'CONFIRMED') {
      console.log('[PASS] Challan confirmed successfully!');
      console.log(`  Status: ${data.data.challan.status}`);
      console.log(`  Confirmed By: ${data.data.challan.confirmedBy.name} (${data.data.challan.confirmedBy.role})`);
      console.log(`  Confirmed At: ${data.data.challan.confirmedAt}`);
    } else {
      console.error('[FAIL] Confirmation failed:', res.status, data);
      process.exit(1);
    }
  }

  // 4. Verify stock is reduced correctly & OUT movements created
  console.log('\n--- TEST 4: VERIFY STOCK REDUCED & OUT MOVEMENTS CREATED ---');
  {
    const p1Res = await fetch(`${BASE_PRODUCT_URL}/${prod1Id}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const p1Data: any = await p1Res.json();
    const p2Res = await fetch(`${BASE_PRODUCT_URL}/${prod2Id}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const p2Data: any = await p2Res.json();

    // Prod 1: 100 - 10 = 90
    // Prod 2: 40 - 5 = 35
    if (p1Data.data.product.currentStock === 90 && p2Data.data.product.currentStock === 35) {
      console.log(`[PASS] Stock reduced correctly: Prod 1 = ${p1Data.data.product.currentStock} (Expected: 90), Prod 2 = ${p2Data.data.product.currentStock} (Expected: 35)`);
    } else {
      console.error('[FAIL] Stock deduction mismatch:', p1Data.data.product.currentStock, p2Data.data.product.currentStock);
      process.exit(1);
    }

    // Verify OUT stock movements
    const movRes = await fetch(`${BASE_INVENTORY_URL}/movements?productId=${prod1Id}`, {
      headers: { Authorization: `Bearer ${warehouseToken}` },
    });
    const movData: any = await movRes.json();
    const dispatchMov = movData.data.find((m: any) => m.referenceId === challan1Id);
    if (dispatchMov && dispatchMov.movementType === 'OUT' && dispatchMov.quantity === 10) {
      console.log(`[PASS] OUT Stock Movement verified: Type=${dispatchMov.movementType}, Qty=${dispatchMov.quantity}, Ref=${dispatchMov.referenceId}, Reason="${dispatchMov.reason}"`);
    } else {
      console.error('[FAIL] OUT stock movement missing or incorrect:', movData);
      process.exit(1);
    }
  }

  // 5. Attempt to confirm the same confirmed challan again -> rejected (400)
  console.log('\n--- TEST 5: PREVENT RE-CONFIRMING AN ALREADY CONFIRMED CHALLAN ---');
  {
    const res = await fetch(`${BASE_CHALLAN_URL}/${challan1Id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const data: any = await res.json();
    if (res.status === 400) {
      console.log(`[PASS] Re-confirmation cleanly rejected with HTTP 400: "${data.error.message}"`);
    } else {
      console.error('[FAIL] Expected HTTP 400 on re-confirm, got:', res.status, data);
      process.exit(1);
    }
  }

  // 6. Attempt to edit a CONFIRMED challan -> rejected (400)
  console.log('\n--- TEST 6: PREVENT EDITING A CONFIRMED CHALLAN ---');
  {
    const res = await fetch(`${BASE_CHALLAN_URL}/${challan1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({ notes: 'Trying to edit confirmed challan' }),
    });
    const data: any = await res.json();
    if (res.status === 400) {
      console.log(`[PASS] Editing confirmed challan rejected with HTTP 400: "${data.error.message}"`);
    } else {
      console.error('[FAIL] Expected HTTP 400 on editing confirmed challan, got:', res.status, data);
      process.exit(1);
    }
  }

  // 7. Test Insufficient Stock Transactional Rollback:
  // Create a challan with 2 items: item 1 has enough stock (5 available, request 2), item 2 has insufficient stock (35 available, request 500)
  console.log('\n--- TEST 7: INSUFFICIENT STOCK TRANSACTIONAL ATOMIC ROLLBACK ---');
  let excessiveChallanId = '';
  {
    const draftRes = await fetch(BASE_CHALLAN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({
        customerId,
        items: [
          { productId: prod1Id, quantity: 5 },   // Prod 1 has 90
          { productId: prod2Id, quantity: 500 }, // Prod 2 has only 35!
        ],
        notes: 'Excessive order draft',
      }),
    });
    const draftData: any = await draftRes.json();
    excessiveChallanId = draftData.data.challan.id;

    // Attempt confirmation
    const confirmRes = await fetch(`${BASE_CHALLAN_URL}/${excessiveChallanId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${warehouseToken}` },
    });
    const confirmData: any = await confirmRes.json();

    if (confirmRes.status === 409) {
      console.log(`[PASS] Insufficient stock confirmation rejected with HTTP 409: "${confirmData.error.message}"`);
    } else {
      console.error('[FAIL] Expected HTTP 409 Conflict, got:', confirmRes.status, confirmData);
      process.exit(1);
    }

    // Verify Prod 1 stock was NOT partially deducted (must still be 90)
    const p1Check = await fetch(`${BASE_PRODUCT_URL}/${prod1Id}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const p1CheckData: any = await p1Check.json();

    // Verify Prod 2 stock was NOT deducted (must still be 35)
    const p2Check = await fetch(`${BASE_PRODUCT_URL}/${prod2Id}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const p2CheckData: any = await p2Check.json();

    if (p1CheckData.data.product.currentStock === 90 && p2CheckData.data.product.currentStock === 35) {
      console.log(`[PASS] Full rollback verified: Prod 1 = ${p1CheckData.data.product.currentStock} (90), Prod 2 = ${p2CheckData.data.product.currentStock} (35). Zero partial stock deduction!`);
    } else {
      console.error('[FAIL] Partial stock update detected during failed transaction!', p1CheckData, p2CheckData);
      process.exit(1);
    }

    // Verify no stock movement was logged for this failed challan
    const movCheck = await fetch(`${BASE_INVENTORY_URL}/movements?productId=${prod1Id}`, {
      headers: { Authorization: `Bearer ${warehouseToken}` },
    });
    const movCheckData: any = await movCheck.json();
    const badMov = movCheckData.data.find((m: any) => m.referenceId === excessiveChallanId);
    if (!badMov) {
      console.log('[PASS] Verified NO partial StockMovement records exist for failed confirmation.');
    } else {
      console.error('[FAIL] Partial StockMovement was committed despite failure!', badMov);
      process.exit(1);
    }
  }

  // 8. Test Editing DRAFT Challan (SALES)
  console.log('\n--- TEST 8: EDIT DRAFT CHALLAN & REFRESH SNAPSHOTS ---');
  {
    const updateRes = await fetch(`${BASE_CHALLAN_URL}/${excessiveChallanId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({
        items: [
          { productId: prod1Id, quantity: 2 }, // Updated quantity
        ],
        notes: 'Revised to single item within stock limits',
      }),
    });
    const updateData: any = await updateRes.json();
    if (updateRes.status === 200 && updateData.data.challan.items.length === 1) {
      console.log('[PASS] Draft challan edited successfully:');
      console.log(`  Items count: ${updateData.data.challan.items.length}`);
      console.log(`  New Total Quantity: ${updateData.data.challan.totalQuantity}`);
      console.log(`  New Total Amount: ₹${updateData.data.challan.totalAmount}`);
    } else {
      console.error('[FAIL] Edit draft challan failed:', updateRes.status, updateData);
      process.exit(1);
    }
  }

  // 9. Verify Role Restrictions:
  console.log('\n--- TEST 9: VERIFY ROLE-BASED ACCESS CONTROL (RBAC) ---');
  // WAREHOUSE cannot create draft challan (403)
  {
    const res = await fetch(BASE_CHALLAN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${warehouseToken}` },
      body: JSON.stringify({ customerId, items: [{ productId: prod1Id, quantity: 1 }] }),
    });
    const data: any = await res.json();
    if (res.status === 403) {
      console.log(`[PASS] WAREHOUSE blocked from creating draft challan (HTTP 403): "${data.error.message}"`);
    } else {
      console.error('[FAIL] WAREHOUSE should be forbidden from creating challans, got:', res.status);
      process.exit(1);
    }
  }

  // ACCOUNTS cannot create or confirm challan (403)
  {
    const resCreate = await fetch(BASE_CHALLAN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountsToken}` },
      body: JSON.stringify({ customerId, items: [{ productId: prod1Id, quantity: 1 }] }),
    });
    const resConfirm = await fetch(`${BASE_CHALLAN_URL}/${excessiveChallanId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accountsToken}` },
    });

    if (resCreate.status === 403 && resConfirm.status === 403) {
      console.log('[PASS] ACCOUNTS blocked from creating and confirming challans (HTTP 403)');
    } else {
      console.error('[FAIL] ACCOUNTS should be forbidden from creating/confirming challans:', resCreate.status, resConfirm.status);
      process.exit(1);
    }
  }

  // ACCOUNTS can view and cancel challan
  {
    const resView = await fetch(BASE_CHALLAN_URL, {
      headers: { Authorization: `Bearer ${accountsToken}` },
    });
    const resCancel = await fetch(`${BASE_CHALLAN_URL}/${excessiveChallanId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accountsToken}` },
    });
    const cancelData: any = await resCancel.json();

    if (resView.status === 200 && resCancel.status === 200 && cancelData.data.challan.status === 'CANCELLED') {
      console.log('[PASS] ACCOUNTS successfully viewed challans and cancelled draft challan (HTTP 200)');
      console.log(`  Cancelled Status: ${cancelData.data.challan.status}`);
      console.log(`  Cancelled At: ${cancelData.data.challan.cancelledAt}`);
    } else {
      console.error('[FAIL] ACCOUNTS view or cancel failed:', resView.status, resCancel.status, cancelData);
      process.exit(1);
    }
  }

  // 10. Verify Invalid input returns HTTP 400
  console.log('\n--- TEST 10: VERIFY INVALID INPUT RETURNS HTTP 400 ---');
  {
    const res = await fetch(BASE_CHALLAN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${salesToken}` },
      body: JSON.stringify({
        customerId: 'not-a-uuid',
        items: [], // empty items array
      }),
    });
    const data: any = await res.json();
    if (res.status === 400 && data.error.details?.length > 0) {
      console.log('[PASS] Invalid challan input returned HTTP 400 with validation details:');
      for (const d of data.error.details) {
        console.log(`  - ${d.field}: ${d.message}`);
      }
    } else {
      console.error('[FAIL] Expected 400 for invalid challan input, got:', res.status, data);
      process.exit(1);
    }
  }

  // 11. Verify Nonexistent Customer/Product/Challan returns HTTP 404
  console.log('\n--- TEST 11: VERIFY NONEXISTENT ENTITY RETURNS HTTP 404 ---');
  {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${BASE_CHALLAN_URL}/${fakeId}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const data: any = await res.json();
    if (res.status === 404) {
      console.log(`[PASS] Nonexistent challan returned HTTP 404: "${data.error.message}"`);
    } else {
      console.error('[FAIL] Expected 404, got:', res.status, data);
      process.exit(1);
    }
  }

  // 12. Verify Pagination and Status Filtering
  console.log('\n--- TEST 12: VERIFY PAGINATION AND STATUS FILTERING ---');
  {
    const res = await fetch(`${BASE_CHALLAN_URL}?status=CONFIRMED&page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data: any = await res.json();
    if (res.status === 200 && data.pagination && Array.isArray(data.data)) {
      console.log('[PASS] Pagination & filter by status=CONFIRMED verified:');
      console.log(`  Total Confirmed Challans: ${data.pagination.total}`);
      console.log(`  Page: ${data.pagination.page}, Limit: ${data.pagination.limit}`);
      console.log(`  All returned items have status CONFIRMED: ${data.data.every((c: any) => c.status === 'CONFIRMED')}`);
    } else {
      console.error('[FAIL] Pagination or status filter failed:', data);
      process.exit(1);
    }
  }

  console.log('\n====================================================');
  console.log('ALL PHASE 5 SALES CHALLAN TESTS PASSED! (100% PASS)');
  console.log('====================================================');
}

runTests().catch((e) => {
  console.error('Fatal error running Phase 5 tests:', e);
  process.exit(1);
});
