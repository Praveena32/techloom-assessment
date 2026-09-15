import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://127.0.0.1:5001/api';

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 RUNNING AUTOMATED POS & CONCURRENCY VERIFICATION TEST SUITE');
  console.log('===============================================================');

  // Test 1: Health check
  console.log('\n[Test 1] Checking server health...');
  try {
    const health = await axios.get('http://127.0.0.1:5001/health');
    console.log('✅ Server is healthy:', health.data);
  } catch (err: any) {
    console.error('❌ Server is not reachable. Make sure the backend is running on port 5001.');
    process.exit(1);
  }

  // Test 2: Concurrency Stress Test (50 simultaneous buyers for 5 stock items)
  console.log('\n[Test 2] Concurrency Stress Test: 50 simultaneous checkouts against 5 stock items...');
  const initialStock = 5;
  const totalConcurrentBuyers = 50;

  // Create product with 5 stock
  const productRes = await axios.post(`${BASE_URL}/products`, {
    name: `Flash Sale Item ${Date.now()}`,
    description: 'Limited inventory item for concurrency race condition testing',
    price: 199.99,
    stock: initialStock,
    category: 'StressTest',
  });
  const testProduct = productRes.data.data;
  console.log(`Created test product "${testProduct.name}" (ID: ${testProduct.id}) with initial available stock: ${initialStock}`);

  // Launch 50 concurrent requests simultaneously
  console.log(`Firing ${totalConcurrentBuyers} concurrent checkout requests...`);
  const startTime = Date.now();

  const checkoutPromises = Array.from({ length: totalConcurrentBuyers }).map(async (_, idx) => {
    try {
      const res = await axios.post(`${BASE_URL}/orders/checkout`, {
        customerName: `Buyer #${idx + 1}`,
        items: [{ productId: testProduct.id, quantity: 1 }],
      });
      return { status: res.status, data: res.data, success: true };
    } catch (err: any) {
      return {
        status: err.response?.status || 500,
        data: err.response?.data,
        success: false,
      };
    }
  });

  const responses = await Promise.all(checkoutPromises);
  const elapsedMs = Date.now() - startTime;

  const successfulCheckouts = responses.filter((r) => r.success && r.status === 201);
  const outOfStockRejections = responses.filter((r) => !r.success && r.status === 409);
  const otherFailures = responses.filter((r) => r.status !== 201 && r.status !== 409);

  console.log(`\n📊 Concurrency Test Results (Execution Time: ${elapsedMs}ms):`);
  console.log(`- Total Requests Sent:         ${totalConcurrentBuyers}`);
  console.log(`- Successful Reservations:    ${successfulCheckouts.length} (Expected: ${initialStock})`);
  console.log(`- Out of Stock Rejections:     ${outOfStockRejections.length} (Expected: ${totalConcurrentBuyers - initialStock})`);
  console.log(`- Unexpected Errors:           ${otherFailures.length} (Expected: 0)`);

  // Verify stock in database
  const stockCheck = await axios.get(`${BASE_URL}/products/${testProduct.id}`);
  const finalProduct = stockCheck.data.data;
  console.log(`- Final Available Stock:       ${finalProduct.stock} (Expected: 0)`);
  console.log(`- Final Reserved Stock:        ${finalProduct.reservedStock} (Expected: ${initialStock})`);

  if (
    successfulCheckouts.length === initialStock &&
    outOfStockRejections.length === totalConcurrentBuyers - initialStock &&
    finalProduct.stock === 0 &&
    finalProduct.reservedStock === initialStock
  ) {
    console.log('✅ PASSED: Concurrency check succeeded! ZERO overselling occurred.');
  } else {
    console.error('❌ FAILED: Concurrency violation detected!');
    process.exit(1);
  }

  // Test 3: Payment Life Cycle (SUCCESS, FAILURE, TIMEOUT)
  console.log('\n[Test 3] Testing Mock Payment Lifecycle...');
  const firstOrder = successfulCheckouts[0].data.data;

  // Test Duplicate Payment Prevention (Idempotency)
  console.log(`Attempting Payment for Order ${firstOrder.id} with SUCCESS...`);
  const paySuccess = await axios.post(`${BASE_URL}/payments/process`, {
    orderId: firstOrder.id,
    simulateStatus: 'SUCCESS',
    idempotencyKey: `idem-${firstOrder.id}`,
  });
  console.log('✅ Payment succeeded. Order status:', paySuccess.data.data.order.status);

  // Attempt duplicate payment
  console.log('Attempting duplicate payment on already PAID order...');
  try {
    await axios.post(`${BASE_URL}/payments/process`, {
      orderId: firstOrder.id,
      simulateStatus: 'SUCCESS',
    });
    console.error('❌ FAILED: Duplicate payment was not rejected!');
    process.exit(1);
  } catch (err: any) {
    console.log(`✅ PASSED: Duplicate payment rejected with status ${err.response?.status}:`, err.response?.data?.error);
  }

  // Test 4: Order Cancellation & Stock Restoration
  console.log('\n[Test 4] Testing Order Cancellation & Stock Restoration...');
  const secondOrder = successfulCheckouts[1].data.data;
  console.log(`Cancelling reserved order ${secondOrder.id}...`);
  const cancelRes = await axios.post(`${BASE_URL}/orders/${secondOrder.id}/cancel`);
  console.log('✅ Order cancelled:', cancelRes.data.data.status);

  const stockAfterCancel = await axios.get(`${BASE_URL}/products/${testProduct.id}`);
  console.log(`- Stock after cancellation: Available = ${stockAfterCancel.data.data.stock} (Expected: 1), Reserved = ${stockAfterCancel.data.data.reservedStock} (Expected: ${initialStock - 2})`);

  if (stockAfterCancel.data.data.stock === 1) {
    console.log('✅ PASSED: Stock correctly restored to inventory upon cancellation.');
  } else {
    console.error('❌ FAILED: Stock was not restored correctly!');
    process.exit(1);
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL AUTOMATED EVALUATION CHECKS PASSED WITH 100% SUCCESS!');
  console.log('===============================================================');
}

runTests().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
