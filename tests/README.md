# Certificate Validation Service - Test Suite

This directory contains a comprehensive test suite for the certificate validation service that covers all major functionalities and edge cases.

## 🧪 Test Files

### Core Operation Tests

1. **`test-upload-valid.ts`** - Tests upload operations with valid certificate IDs
   - Valid certificate uploads
   - Multiple certificates per product
   - Data persistence verification

2. **`test-upload-invalid.ts`** - Tests upload operations with invalid data
   - Invalid certificate IDs
   - Missing required fields
   - Malformed file data
   - Empty/null values

3. **`test-list-operations.ts`** - Tests listing operations
   - List all products (empty and populated)
   - List certificates for specific product
   - Non-existent product handling
   - Data structure validation

4. **`test-delete-operations.ts`** - Tests deleteProductCertificate operations
   - Delete existing certificates
   - Delete non-existent certificates
   - Delete from non-existent products
   - Multiple certificates management

### Advanced Tests

5. **`test-edge-cases.ts`** - Tests edge cases and error handling
   - Malformed JSON messages
   - Invalid operation types
   - Special characters and Unicode
   - Large data handling
   - Null values

6. **`test-concurrent-operations.ts`** - Tests concurrent operations
   - Concurrent uploads to different products
   - Concurrent uploads to same product
   - Mixed concurrent operations
   - High volume stress testing
   - Race conditions

## 🚀 How to Run Tests

### Prerequisites

1. **Service must be running** in the background with mock storage:
   ```bash
   USE_MOCK_STORAGE=true bun run server.ts
   ```

2. **Environment variables** must be configured in `.env`:
   - `PROJECT_ID` - Google Cloud project ID
   - `REQUEST_TOPIC` - PubSub request topic
   - `RESPONSE_TOPIC` - PubSub response topic
   - `RESPONSE_SUBSCRIPTION` - PubSub response subscription

### Running Individual Tests

Use the simple test runner:

```bash
# Run a specific test
bun tests/run-simple-test.ts upload-valid
bun tests/run-simple-test.ts upload-invalid
bun tests/run-simple-test.ts list-operations
bun tests/run-simple-test.ts delete-operations
bun tests/run-simple-test.ts edge-cases
bun tests/run-simple-test.ts concurrent-operations

# Run all tests sequentially
bun tests/run-simple-test.ts all
```

### Running with Full Test Runner

For comprehensive testing with service management:

```bash
bun tests/run-all-tests.ts
```

This will:
- Start the service automatically with mock storage
- Run all test suites sequentially
- Generate a detailed report
- Clean up resources

## 📊 Test Coverage

### Operations Tested

✅ **upload** - Upload and validate certificates  
✅ **deleteProductCertificate** - Delete specific certificates  
✅ **list** - List all products with certificates  
✅ **listProductCertificates** - List certificates for specific product  

### Scenarios Covered

✅ **Happy paths** - Normal successful operations  
✅ **Error paths** - Invalid data and error conditions  
✅ **Edge cases** - Boundary conditions and unusual inputs  
✅ **Concurrent operations** - Multiple simultaneous requests  
✅ **Data consistency** - Verify data integrity  
✅ **Service resilience** - Error handling and recovery  

### Test Data

- **Valid certificate IDs**: `ISCC-CORSIA-Cert-US201-2440920252`, `EU-ISCC-Cert-ES216-20254133`
- **Test file**: `test_to_send/spiderweb.pdf`
- **Mock storage**: Uses in-memory storage for isolated testing

## 📋 Expected Response Formats

### Upload Response
```json
{
  "operationType": "uploadResponse",
  "status": true|false
}
```

### List Response
```json
{
  "operationType": "listResponse", 
  "productIds": ["product1", "product2"],
  "total": 2
}
```

### List Product Certificates Response
```json
{
  "operationType": "listProductCertificatesResponse",
  "productId": "product1",
  "certificates": [
    {
      "id": "cert123",
      "bucketPath": "gs://bucket/path",
      "uploadedAt": "2025-01-01T00:00:00.000Z",
      "verified": true,
      "validUntil": "2025-12-31"
    }
  ],
  "total": 1
}
```

### Delete Response
```json
{
  "operationType": "deleteProductCertificateResponse",
  "productId": "product1",
  "certificateId": "cert123", 
  "status": true|false
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Required
PROJECT_ID=ultra-component-479316-a5
REQUEST_TOPIC=projects/ultra-component-479316-a5/topics/certificate-validation
RESPONSE_TOPIC=projects/ultra-component-479316-a5/topics/certificate-validator-response
RESPONSE_SUBSCRIPTION=projects/ultra-component-479316-a5/subscriptions/certificate-validator-response-sub

# For testing
USE_MOCK_STORAGE=true
```

### Test Settings

- **Timeout**: 15-30 seconds per operation (longer for stress tests)
- **Retry logic**: Built into response waiting
- **Cleanup**: Tests clean up their own data
- **Isolation**: Each test runs independently

## 📈 Test Results

### Success Criteria

- ✅ All operations return expected response formats
- ✅ Certificate validation works correctly
- ✅ Data persistence and retrieval function properly
- ✅ Error conditions are handled gracefully
- ✅ Concurrent operations don't cause data corruption
- ✅ Service remains responsive under load

### Sample Output

```
🧪 Testing Upload Operations with Valid Certificates

1️⃣ Testing upload with valid certificate #1...
📤 Published upload message (12345)
⏳ Waiting for uploadResponse response...
✅ Got uploadResponse response
   Result: ✅ Success

📊 Test Summary:
   ✅ Valid certificate #1 upload
   ✅ Valid certificate #2 upload
   ✅ Multiple certificates for same product
   ✅ Certificates storage verification

🎯 Overall Result: 4/4 tests passed
```

## 🐛 Troubleshooting

### Common Issues

1. **Service not running**
   - Start the service: `USE_MOCK_STORAGE=true bun run server.ts`
   - Check if port 8080 is available

2. **PubSub connection issues**
   - Verify Google Cloud credentials
   - Check topic/subscription names
   - Ensure proper permissions

3. **Test timeouts**
   - Increase timeout values in test files
   - Check network connectivity
   - Verify service responsiveness

4. **Certificate validation failures**
   - Check if ISCC API is accessible
   - Verify certificate IDs are valid
   - Check network connectivity to iscc-system.org

### Debug Mode

For debugging, you can:
1. Run tests individually to isolate issues
2. Check service logs for detailed error messages
3. Use the existing debug files in the tests directory
4. Verify PubSub message flow manually

## 📝 Notes

- Tests use mock storage (`USE_MOCK_STORAGE=true`) to avoid affecting production data
- Each test cleans up after itself to maintain isolation
- The service must be running before executing tests
- Tests are designed to be run in any order
- Concurrent tests may take longer due to volume

## 🎯 Best Practices

1. **Always use mock storage** for testing
2. **Run tests individually** first to isolate issues
3. **Check service logs** when tests fail
4. **Clean up test data** regularly
5. **Monitor PubSub quotas** during stress testing
6. **Use the simple runner** for quick feedback
7. **Use the full runner** for comprehensive validation