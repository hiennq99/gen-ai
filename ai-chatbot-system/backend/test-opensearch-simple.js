#!/usr/bin/env node
/**
 * Simple OpenSearch Connection Test using HTTP requests
 */

require('dotenv').config();
const https = require('https');
const { URL } = require('url');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(endpoint, method = 'GET') {
  return new Promise((resolve, reject) => {
    const config = {
      node: process.env.OPENSEARCH_NODE,
      username: process.env.OPENSEARCH_USERNAME,
      password: process.env.OPENSEARCH_PASSWORD,
    };

    const url = new URL(endpoint, config.node);
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function testConnection() {
  log('\n🔍 OpenSearch Connection Test\n', 'cyan');
  log('=====================================\n', 'cyan');

  const config = {
    node: process.env.OPENSEARCH_NODE,
    username: process.env.OPENSEARCH_USERNAME,
    password: process.env.OPENSEARCH_PASSWORD,
    documentsIndex: process.env.OPENSEARCH_DOCUMENTS_INDEX || 'ai-chatbot-documents',
  };

  log('📋 Configuration:', 'blue');
  log(`   Node: ${config.node}`);
  log(`   Username: ${config.username}`);
  log(`   Password: ${'*'.repeat(config.password?.length || 0)}\n`);

  try {
    // Test 1: Cluster Health
    log('1️⃣  Testing cluster health...', 'yellow');
    const healthResponse = await makeRequest('/_cluster/health');

    if (healthResponse.statusCode === 200) {
      const health = healthResponse.body;
      log(`   ✅ Connection successful!`, 'green');
      log(`   Status: ${health.status.toUpperCase()}`, health.status === 'green' ? 'green' : 'yellow');
      log(`   Nodes: ${health.number_of_nodes}`);
      log(`   Shards: ${health.active_shards}\n`);
    } else {
      throw new Error(`Health check failed: ${healthResponse.statusCode}`);
    }

    // Test 2: List indices
    log('2️⃣  Listing indices...', 'yellow');
    const indicesResponse = await makeRequest('/_cat/indices?format=json');

    if (indicesResponse.statusCode === 200) {
      const indices = indicesResponse.body;
      log(`   Found ${indices.length} indices:`);

      if (indices.length === 0) {
        log(`   (No indices yet - will be created automatically)\n`, 'yellow');
      } else {
        indices.forEach(idx => {
          log(`   - ${idx.index} (${idx['docs.count']} docs)`);
        });
        log('');
      }
    }

    // Test 3: Check application indices
    log('3️⃣  Checking application indices...', 'yellow');

    const checkIndex = async (indexName) => {
      try {
        const response = await makeRequest(`/${indexName}`);
        if (response.statusCode === 200) {
          log(`   ✅ Index "${indexName}" exists`, 'green');

          // Get count
          const countResponse = await makeRequest(`/${indexName}/_count`);
          if (countResponse.statusCode === 200) {
            log(`      Documents: ${countResponse.body.count}`);
          }
          return true;
        } else if (response.statusCode === 404) {
          log(`   ⚠️  Index "${indexName}" not found (will be auto-created)`, 'yellow');
          return false;
        }
      } catch (e) {
        log(`   ⚠️  Index "${indexName}" not found`, 'yellow');
        return false;
      }
    };

    await checkIndex(config.documentsIndex);
    await checkIndex('ai-chatbot-conversations');
    log('');

    // Test 4: Test search
    log('4️⃣  Testing search capability...', 'yellow');
    try {
      const searchResponse = await makeRequest(`/${config.documentsIndex}/_search?size=1`);
      if (searchResponse.statusCode === 200) {
        log(`   ✅ Search is working!`, 'green');
        log(`      Total documents: ${searchResponse.body.hits.total.value}\n`);
      } else if (searchResponse.statusCode === 404) {
        log(`   ⏭️  Skipped (index not created yet)\n`, 'yellow');
      }
    } catch (e) {
      log(`   ⏭️  Skipped (index not created yet)\n`, 'yellow');
    }

    // Summary
    log('=====================================', 'cyan');
    log('✅ OpenSearch is configured correctly!\n', 'green');
    log('Next steps:', 'blue');
    log('  1. Restart backend: docker-compose restart backend');
    log('  2. Upload documents via Admin CMS');
    log('  3. Check backend logs: docker logs ai-chatbot-backend\n');

    return true;

  } catch (error) {
    log('\n❌ Connection failed!\n', 'red');
    log(`Error: ${error.message}\n`, 'red');

    if (error.code === 'ENOTFOUND') {
      log('💡 The OpenSearch domain URL could not be resolved.', 'yellow');
      log('   Check if OPENSEARCH_NODE is correct.\n');
    } else if (error.code === 'ECONNREFUSED') {
      log('💡 Connection refused.', 'yellow');
      log('   Check security groups and network access.\n');
    }

    return false;
  }
}

// Run test
testConnection()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  });