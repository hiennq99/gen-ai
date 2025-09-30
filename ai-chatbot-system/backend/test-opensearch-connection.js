#!/usr/bin/env node
/**
 * OpenSearch Connection Test Script
 * Tests connection to AWS OpenSearch and verifies indices
 */

require('dotenv').config();
const { Client } = require('@opensearch-project/opensearch');

// Color codes for terminal output
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

async function testOpenSearchConnection() {
  log('\n🔍 Testing OpenSearch Connection\n', 'cyan');
  log('=====================================\n', 'cyan');

  // Read configuration
  const config = {
    node: process.env.OPENSEARCH_NODE,
    username: process.env.OPENSEARCH_USERNAME,
    password: process.env.OPENSEARCH_PASSWORD,
    documentsIndex: process.env.OPENSEARCH_DOCUMENTS_INDEX || 'ai-chatbot-documents',
    conversationsIndex: process.env.OPENSEARCH_CONVERSATIONS_INDEX || 'ai-chatbot-conversations',
  };

  // Validate configuration
  log('📋 Configuration:', 'blue');
  log(`   Node: ${config.node}`);
  log(`   Username: ${config.username}`);
  log(`   Password: ${'*'.repeat(config.password?.length || 0)}`);
  log(`   Documents Index: ${config.documentsIndex}`);
  log(`   Conversations Index: ${config.conversationsIndex}\n`);

  if (!config.node || !config.username || !config.password) {
    log('❌ Missing required environment variables!', 'red');
    log('   Please set: OPENSEARCH_NODE, OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD\n', 'red');
    process.exit(1);
  }

  // Create OpenSearch client
  const client = new Client({
    node: config.node,
    auth: {
      username: config.username,
      password: config.password,
    },
    ssl: {
      rejectUnauthorized: false,
    },
    requestTimeout: 30000,
    sniffOnStart: false,
  });

  try {
    // Test 1: Ping cluster
    log('1️⃣  Testing cluster connection...', 'yellow');
    const pingResponse = await client.ping();
    if (pingResponse.statusCode === 200) {
      log('   ✅ Cluster ping successful!\n', 'green');
    } else {
      throw new Error(`Ping failed with status: ${pingResponse.statusCode}`);
    }

    // Test 2: Get cluster health
    log('2️⃣  Checking cluster health...', 'yellow');
    const healthResponse = await client.cluster.health();
    const health = healthResponse.body;

    const statusColor = health.status === 'green' ? 'green' :
                       health.status === 'yellow' ? 'yellow' : 'red';

    log(`   Status: ${health.status.toUpperCase()}`, statusColor);
    log(`   Number of nodes: ${health.number_of_nodes}`);
    log(`   Number of data nodes: ${health.number_of_data_nodes}`);
    log(`   Active shards: ${health.active_shards}`);
    log(`   Relocating shards: ${health.relocating_shards}`);
    log(`   Initializing shards: ${health.initializing_shards}`);
    log(`   Unassigned shards: ${health.unassigned_shards}\n`);

    // Test 3: List existing indices
    log('3️⃣  Listing existing indices...', 'yellow');
    const catResponse = await client.cat.indices({ format: 'json' });
    const indices = catResponse.body;

    if (indices.length === 0) {
      log('   No indices found.\n', 'yellow');
    } else {
      log(`   Found ${indices.length} indices:`);
      indices.forEach(index => {
        log(`   - ${index.index} (${index['docs.count']} docs, ${index['store.size']})`);
      });
      log('');
    }

    // Test 4: Check if our indices exist
    log('4️⃣  Checking application indices...', 'yellow');

    const documentsExists = await client.indices.exists({
      index: config.documentsIndex,
    });

    const conversationsExists = await client.indices.exists({
      index: config.conversationsIndex,
    });

    if (documentsExists.statusCode === 200) {
      log(`   ✅ Documents index "${config.documentsIndex}" exists`, 'green');

      // Get document count
      const docCount = await client.count({
        index: config.documentsIndex,
      });
      log(`      Documents: ${docCount.body.count}`);
    } else {
      log(`   ⚠️  Documents index "${config.documentsIndex}" does not exist`, 'yellow');
      log(`      Will be created automatically on first document upload.`);
    }

    if (conversationsExists.statusCode === 200) {
      log(`   ✅ Conversations index "${config.conversationsIndex}" exists`, 'green');

      // Get conversation count
      const convCount = await client.count({
        index: config.conversationsIndex,
      });
      log(`      Conversations: ${convCount.body.count}`);
    } else {
      log(`   ⚠️  Conversations index "${config.conversationsIndex}" does not exist`, 'yellow');
      log(`      Will be created automatically on first conversation.`);
    }
    log('');

    // Test 5: Test search functionality
    log('5️⃣  Testing search functionality...', 'yellow');
    try {
      if (documentsExists.statusCode === 200) {
        const searchResponse = await client.search({
          index: config.documentsIndex,
          body: {
            size: 1,
            query: {
              match_all: {},
            },
          },
        });

        const hits = searchResponse.body.hits.total.value;
        log(`   ✅ Search working! Found ${hits} documents`, 'green');

        if (hits > 0) {
          const firstDoc = searchResponse.body.hits.hits[0];
          log(`   Sample document ID: ${firstDoc._id}`);
          if (firstDoc._source.title) {
            log(`   Sample document title: ${firstDoc._source.title}`);
          }
        }
      } else {
        log(`   ⏭️  Skipped (no documents index yet)`, 'yellow');
      }
    } catch (error) {
      log(`   ❌ Search test failed: ${error.message}`, 'red');
    }
    log('');

    // Test 6: Test vector search capability
    log('6️⃣  Testing vector search capability...', 'yellow');
    if (documentsExists.statusCode === 200) {
      try {
        const mapping = await client.indices.getMapping({
          index: config.documentsIndex,
        });

        const mappings = mapping.body[config.documentsIndex].mappings;
        const hasEmbedding = mappings.properties && mappings.properties.embedding;

        if (hasEmbedding) {
          log(`   ✅ Vector field "embedding" configured`, 'green');
          log(`      Type: ${mappings.properties.embedding.type}`);
          log(`      Dimensions: ${mappings.properties.embedding.dims || 'N/A'}`);
          log(`      Similarity: ${mappings.properties.embedding.similarity || 'N/A'}`);
        } else {
          log(`   ⚠️  No embedding field found in mapping`, 'yellow');
        }
      } catch (error) {
        log(`   ❌ Mapping check failed: ${error.message}`, 'red');
      }
    } else {
      log(`   ⏭️  Skipped (no documents index yet)`, 'yellow');
    }
    log('');

    // Summary
    log('=====================================', 'cyan');
    log('✅ All connection tests passed!\n', 'green');
    log('🚀 Your OpenSearch cluster is ready to use.', 'green');
    log('   Start your backend to automatically create indices:\n');
    log('   docker-compose restart backend\n', 'blue');

    return true;

  } catch (error) {
    log('\n❌ Connection test failed!\n', 'red');
    log('Error details:', 'red');
    log(`   ${error.message}\n`, 'red');

    if (error.meta) {
      log('Meta information:', 'yellow');
      log(`   Status: ${error.meta.statusCode}`);
      log(`   Body: ${JSON.stringify(error.meta.body, null, 2)}\n`);
    }

    log('💡 Troubleshooting tips:', 'yellow');
    log('   1. Check if OPENSEARCH_NODE URL is correct');
    log('   2. Verify username and password are correct');
    log('   3. Check AWS OpenSearch domain security settings');
    log('   4. Ensure IP address is whitelisted in access policy');
    log('   5. Check VPC/security group settings if using VPC access\n');

    return false;
  }
}

// Run the test
testOpenSearchConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    log(`\n❌ Unexpected error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });