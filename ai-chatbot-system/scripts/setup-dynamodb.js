#!/usr/bin/env node

const { DynamoDBClient, CreateTableCommand, ListTablesCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

// Configure AWS
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  } : undefined
});

const tables = [
  {
    TableName: 'ai-chatbot-conversations',
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'N' }
    ],
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserIdIndex',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: 'ai-chatbot-documents',
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'type', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'N' }
    ],
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'TypeIndex',
        KeySchema: [
          { AttributeName: 'type', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: 'ai-chatbot-users',
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EmailIndex',
        KeySchema: [
          { AttributeName: 'email', KeyType: 'HASH' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: 'ai-chatbot-qa',
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'category', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'N' }
    ],
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'CategoryIndex',
        KeySchema: [
          { AttributeName: 'category', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  }
];

async function tableExists(tableName) {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
}

async function createTable(tableConfig) {
  const tableName = tableConfig.TableName;
  
  try {
    // Check if table already exists
    const exists = await tableExists(tableName);
    if (exists) {
      console.log(`✓ Table ${tableName} already exists`);
      return;
    }

    // Create table
    console.log(`Creating table ${tableName}...`);
    await client.send(new CreateTableCommand(tableConfig));
    console.log(`✓ Table ${tableName} created successfully`);
    
  } catch (error) {
    console.error(`✗ Error creating table ${tableName}:`, error.message);
    throw error;
  }
}

async function setupDynamoDB() {
  console.log('Setting up DynamoDB tables in ap-southeast-2...\n');
  
  try {
    // Create all tables
    for (const tableConfig of tables) {
      await createTable(tableConfig);
    }
    
    console.log('\n✓ All DynamoDB tables setup completed!');
    
    // List tables to verify
    console.log('\nVerifying tables:');
    const listCommand = new ListTablesCommand({});
    const response = await client.send(listCommand);
    
    const aiChatbotTables = response.TableNames.filter(name => name.startsWith('ai-chatbot-'));
    console.log('Found tables:', aiChatbotTables);
    
  } catch (error) {
    console.error('\n✗ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
setupDynamoDB();