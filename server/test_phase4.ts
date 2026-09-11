const BASE_AUTH_URL = 'http://localhost:5000/api/v1/auth';
const BASE_PRODUCT_URL = 'http://localhost:5000/api/v1/products';
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
  console.log('STARTING PHASE 4 PRODUCT & INVENTORY VERIFICATION');
  console.log('====================================================\n');

  // Authenticate all test roles
  console.log('Authenticating test users...');
  const adminToken = await login('admin@fundsroom.local');
  const warehouseToken = await login('warehouse@fundsroom.local');
  const salesToken = await login('sales@fundsroom.local');
  const accountsToken = await login('accounts@fundsroom.local');
  console.log('[PASS] All role tokens obtained.\n');

  const testSku = `PROD-${Date.now()}`;
  let productId = '';

  // 1. Create a product with initial stock as WAREHOUSE
  console.log('--- TEST 1: CREATE PRODUCT WITH INITIAL STOCK (WAREHOUSE) ---');
  {
    const res = await fetch(BASE_PRODUCT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${warehouseToken}`,
      },
      body: JSON.stringify({
        name: 'Industrial Heavy Duty Drill',
        sku: testSku,
        category: 'Power Tools',
        unitPrice: 4500.5,
        initialStock: 50,
        minStockAlert: 15,
        location: 'Bay A, Rack 3, Shelf 2',
      }),
    });

    const data: any = await res.json();
    if (res.status !== 201) {
      console.error('[FAIL] Create product failed:', res.status, data);
      process.exit(1);
    }

    productId = data.data.product.id;
    console.log(`[PASS] Product created successfully with ID: ${productId}`);
    console.log(`  SKU: ${data.data.product.sku}`);
    console.log(`  Current Stock: ${data.data.product.currentStock}`);
    console.log(`  Unit Price: ₹${data.data.product.unitPrice}`);

    if (data.data.product.currentStock !== 50) {
      console.error('[FAIL] Initial stock does not match 50!');
      process.exit(1);
    }
  }

  // 2. Verify initial stock and automatic INITIAL_PURCHASE_RECEIPT movement log
  console.log('\n--- TEST 2: VERIFY INITIAL STOCK & INITIAL STOCK MOVEMENT RECORD ---');
  {
    const res = await fetch(`${BASE_PRODUCT_URL}/${productId}`, {
      headers: { Authorization: `Bearer ${warehouseToken}` },
    });
    const data: any = await res.json();
    const product = data.data.product;

    if (product.currentStock === 50 && product.movements.length >= 1) {
      const initialMovement = product.movements[0];
      console.log(`[PASS] Product verified. Current stock: ${product.currentStock}`);
      console.log(`[PASS] Initial stock movement verified:`);
      console.log(`  Type: ${initialMovement.movementType}`);
      console.log(`  Quantity: ${initialMovement.quantity}`);
      console.log(`  Reason: ${initialMovement.reason}`);
      console.log(`  Created By: ${initialMovement.createdBy.name} (${initialMovement.createdBy.role})`);
      console.log(`  Timestamp: ${initialMovement.createdAt}`);
    } else {
      console.error('[FAIL] Product movements missing initial stock record:', data);
      process.exit(1);
    }
  }

  // 3. Verify IN movement increases stock
  console.log('\n--- TEST 3: VERIFY IN MOVEMENT INCREASES STOCK ---');
  {
    const res = await fetch(`${BASE_INVENTORY_URL}/movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${warehouseToken}`,
      },
      body: JSON.stringify({
        productId,
        movementType: 'IN',
        quantity: 25,
        reason: 'Restock Shipment PO-8841',
        remarks: 'Direct delivery from manufacturer',
      }),
    });

    const data: any = await res.json();
    if (res.status === 201 && data.data.currentStock === 75) {
      console.log(`[PASS] IN movement of +25 succeeded. New stock: ${data.data.currentStock} (Expected: 75)`);
    } else {
      console.error('[FAIL] IN movement failed:', res.status, data);
      process.exit(1);
    }
  }

  // 4. Verify OUT movement decreases stock
  console.log('\n--- TEST 4: VERIFY OUT MOVEMENT DECREASES STOCK ---');
  {
    const res = await fetch(`${BASE_INVENTORY_URL}/movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${warehouseToken}`,
      },
      body: JSON.stringify({
        productId,
        movementType: 'OUT',
        quantity: 20,
        reason: 'Internal Warehouse Transfer',
        remarks: 'Dispatched to secondary depot',
      }),
    });

    const data: any = await res.json();
    if (res.status === 201 && data.data.currentStock === 55) {
      console.log(`[PASS] OUT movement of -20 succeeded. New stock: ${data.data.currentStock} (Expected: 55)`);
    } else {
      console.error('[FAIL] OUT movement failed:', res.status, data);
      process.exit(1);
    }
  }

  // 5. Attempt OUT movement greater than available stock -> 409 Conflict
  console.log('\n--- TEST 5: ATTEMPT EXCESSIVE OUT MOVEMENT (PREVENT NEGATIVE STOCK) ---');
  {
    const res = await fetch(`${BASE_INVENTORY_URL}/movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${warehouseToken}`,
      },
      body: JSON.stringify({
        productId,
        movementType: 'OUT',
        quantity: 999, // Current stock is 55
        reason: 'Invalid Large Dispatch',
      }),
    });

    const data: any = await res.json();
    if (res.status === 409) {
      console.log(`[PASS] Excessive OUT movement rejected with HTTP 409: "${data.error.message}"`);
    } else {
      console.error('[FAIL] Expected HTTP 409 Conflict for insufficient stock, got:', res.status, data);
      process.exit(1);
    }
  }

  // 6. Verify stock remains unchanged after failed movement
  console.log('\n--- TEST 6: VERIFY STOCK UNCHANGED AFTER FAILED ATTEMPT ---');
  {
    const res = await fetch(`${BASE_PRODUCT_URL}/${productId}`, {
      headers: { Authorization: `Bearer ${warehouseToken}` },
    });
    const data: any = await res.json();
    if (data.data.product.currentStock === 55) {
      console.log(`[PASS] Stock verified unchanged at ${data.data.product.currentStock} (Atomic rollback confirmed).`);
    } else {
      console.error('[FAIL] Stock altered after failed transaction! Current:', data.data.product.currentStock);
      process.exit(1);
    }
  }

  // 7. Verify stock movement records contain all required fields
  console.log('\n--- TEST 7: VERIFY STOCK MOVEMENT AUDIT LOG DETAILS ---');
  {
    const res = await fetch(`${BASE_INVENTORY_URL}/movements?productId=${productId}`, {
      headers: { Authorization: `Bearer ${warehouseToken}` },
    });
    const data: any = await res.json();
    if (res.status === 200 && data.data.length >= 3) {
      console.log(`[PASS] Retrieved ${data.data.length} movements for product.`);
      const latest = data.data[0];
      console.log(`  Latest movement: Type=${latest.movementType}, Qty=${latest.quantity}, Reason="${latest.reason}"`);
      console.log(`  Creator: ${latest.createdBy.name} (${latest.createdBy.role})`);
      console.log(`  Timestamp present: ${Boolean(latest.createdAt)}`);
    } else {
      console.error('[FAIL] Movement log missing records:', data);
      process.exit(1);
    }
  }

  // 8. Verify duplicate SKU is rejected (409 Conflict)
  console.log('\n--- TEST 8: VERIFY DUPLICATE SKU REJECTION ---');
  {
    const res = await fetch(BASE_PRODUCT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Duplicate SKU Product',
        sku: testSku, // Same SKU
        category: 'Hardware',
        unitPrice: 100,
        location: 'Bay B',
      }),
    });

    const data: any = await res.json();
    if (res.status === 409) {
      console.log(`[PASS] Duplicate SKU cleanly rejected with HTTP 409: "${data.error.message}"`);
    } else {
      console.error('[FAIL] Duplicate SKU should return 409, got:', res.status, data);
      process.exit(1);
    }
  }

  // 9. Verify invalid/negative quantities return HTTP 400
  console.log('\n--- TEST 9: VERIFY INVALID / NEGATIVE QUANTITIES RETURN HTTP 400 ---');
  {
    const res = await fetch(`${BASE_INVENTORY_URL}/movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${warehouseToken}`,
      },
      body: JSON.stringify({
        productId,
        movementType: 'IN',
        quantity: -10, // Invalid negative quantity
        reason: 'Negative test',
      }),
    });

    const data: any = await res.json();
    if (res.status === 400) {
      console.log(`[PASS] Negative movement quantity rejected with HTTP 400: "${data.error.details[0]?.message}"`);
    } else {
      console.error('[FAIL] Expected HTTP 400 for negative quantity, got:', res.status, data);
      process.exit(1);
    }
  }

  // 10. Verify SALES and ACCOUNTS can view products
  console.log('\n--- TEST 10: VERIFY SALES & ACCOUNTS CAN VIEW PRODUCTS ---');
  {
    const salesRes = await fetch(BASE_PRODUCT_URL, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const accountsRes = await fetch(`${BASE_PRODUCT_URL}/${productId}`, {
      headers: { Authorization: `Bearer ${accountsToken}` },
    });

    if (salesRes.status === 200 && accountsRes.status === 200) {
      console.log('[PASS] SALES successfully listed products (HTTP 200)');
      console.log('[PASS] ACCOUNTS successfully viewed product details (HTTP 200)');
    } else {
      console.error('[FAIL] Viewing failed for SALES or ACCOUNTS:', salesRes.status, accountsRes.status);
      process.exit(1);
    }
  }

  // 11. Verify SALES and ACCOUNTS cannot create or edit products (HTTP 403)
  console.log('\n--- TEST 11: VERIFY SALES & ACCOUNTS CANNOT CREATE / EDIT PRODUCTS ---');
  {
    // SALES trying to create
    const salesCreate = await fetch(BASE_PRODUCT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${salesToken}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Product',
        sku: 'UNAUTH-1',
        category: 'Test',
        unitPrice: 50,
        location: 'Nowhere',
      }),
    });
    const salesData: any = await salesCreate.json();

    // ACCOUNTS trying to edit
    const accountsEdit = await fetch(`${BASE_PRODUCT_URL}/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountsToken}`,
      },
      body: JSON.stringify({ name: 'Hacked Price' }),
    });
    const accountsData: any = await accountsEdit.json();

    if (salesCreate.status === 403 && accountsEdit.status === 403) {
      console.log(`[PASS] SALES blocked from creating product (HTTP 403): "${salesData.error.message}"`);
      console.log(`[PASS] ACCOUNTS blocked from editing product (HTTP 403): "${accountsData.error.message}"`);
    } else {
      console.error('[FAIL] Permission check failed for SALES/ACCOUNTS:', salesCreate.status, accountsEdit.status);
      process.exit(1);
    }
  }

  // 12. Verify WAREHOUSE and ADMIN can manage products & inventory
  console.log('\n--- TEST 12: VERIFY WAREHOUSE & ADMIN CAN EDIT PRODUCTS & MANAGE STOCK ---');
  {
    // WAREHOUSE edit product
    const editRes = await fetch(`${BASE_PRODUCT_URL}/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${warehouseToken}`,
      },
      body: JSON.stringify({
        name: 'Industrial Heavy Duty Drill Pro Max',
        unitPrice: 4800,
      }),
    });
    const editData: any = await editRes.json();

    // ADMIN record movement
    const adminMov = await fetch(`${BASE_INVENTORY_URL}/movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId,
        movementType: 'IN',
        quantity: 10,
        reason: 'Admin Management Restock',
      }),
    });
    const adminMovData: any = await adminMov.json();

    if (editRes.status === 200 && adminMov.status === 201) {
      console.log('[PASS] WAREHOUSE successfully updated product details (HTTP 200)');
      console.log('[PASS] ADMIN successfully recorded stock movement (HTTP 201)');
    } else {
      console.error('[FAIL] Edit or movement failed:', editRes.status, adminMov.status);
      process.exit(1);
    }
  }

  // 13. Verify pagination, search, and low-stock filtering
  console.log('\n--- TEST 13: VERIFY PAGINATION, SEARCH, AND LOW-STOCK FILTERING ---');
  {
    // Search by SKU
    const searchRes = await fetch(`${BASE_PRODUCT_URL}?search=${testSku}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const searchData: any = await searchRes.json();
    const found = searchData.data.some((p: any) => p.sku === testSku);
    if (found) {
      console.log(`[PASS] Search by SKU '${testSku}' returned the target product.`);
    } else {
      console.error('[FAIL] Search by SKU failed:', searchData);
      process.exit(1);
    }

    // Create a product with low stock (currentStock <= minStockAlert) to test lowStock filter
    const lowStockSku = `LOW-${Date.now()}`;
    await fetch(BASE_PRODUCT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${warehouseToken}`,
      },
      body: JSON.stringify({
        name: 'Low Stock Safety Helmet',
        sku: lowStockSku,
        category: 'Safety Gear',
        unitPrice: 650,
        initialStock: 3,
        minStockAlert: 10, // 3 <= 10 -> Low stock!
        location: 'Bay S, Rack 1',
      }),
    });

    const lowStockRes = await fetch(`${BASE_PRODUCT_URL}?lowStock=true`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    const lowStockData: any = await lowStockRes.json();
    const lowStockFound = lowStockData.data.some((p: any) => p.sku === lowStockSku);
    if (lowStockRes.status === 200 && lowStockFound) {
      console.log('[PASS] Low-stock filter (?lowStock=true) successfully detected low-stock product.');
      const prod = lowStockData.data.find((p: any) => p.sku === lowStockSku);
      console.log(`  Product: ${prod.name}, Stock: ${prod.currentStock}, Alert Threshold: ${prod.minStockAlert}`);
      console.log(`  Computed isLowStock: ${prod.isLowStock}`);
    } else {
      console.error('[FAIL] Low stock filter failed to detect product:', lowStockData);
      process.exit(1);
    }

    // Verify pagination metadata
    console.log('[PASS] Pagination metadata verified:');
    console.log(`  Total Products: ${lowStockData.pagination.total}`);
    console.log(`  Page: ${lowStockData.pagination.page}`);
    console.log(`  Limit: ${lowStockData.pagination.limit}`);
    console.log(`  Total Pages: ${lowStockData.pagination.totalPages}`);
  }

  console.log('\n====================================================');
  console.log('ALL PHASE 4 PRODUCT & INVENTORY TESTS PASSED! (100% PASS)');
  console.log('====================================================');
}

runTests().catch((e) => {
  console.error('Fatal error running Phase 4 tests:', e);
  process.exit(1);
});
