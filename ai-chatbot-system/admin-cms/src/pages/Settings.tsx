import { Card, Form, Input, InputNumber, Select, Switch, Button, Tabs, Space, message, Divider } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState } from 'react';

const { Option } = Select;
const { TextArea } = Input;

export default function Settings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      // Save settings API call would go here
      console.log('Saving settings:', values);
      await new Promise(resolve => setTimeout(resolve, 1000));
      message.success('Settings saved successfully');
    } catch {
      message.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card title="System Settings">
        <Tabs
          items={[
            {
              key: 'general',
              label: 'General',
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSave}
                  initialValues={{
                    systemName: 'AI Chatbot System',
                    language: 'en',
                    timezone: 'UTC',
                    debugMode: false,
                  }}
                >
                  <Form.Item label="System Name" name="systemName">
                    <Input placeholder="Enter system name" />
                  </Form.Item>

                  <Form.Item label="Default Language" name="language">
                    <Select>
                      <Option value="en">English</Option>
                      <Option value="vi">Vietnamese</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item label="Timezone" name="timezone">
                    <Select>
                      <Option value="UTC">UTC</Option>
                      <Option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</Option>
                      <Option value="America/New_York">America/New_York</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item label="Debug Mode" name="debugMode" valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                        Save Settings
                      </Button>
                      <Button icon={<ReloadOutlined />} onClick={() => form.resetFields()}>
                        Reset
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'ai',
              label: 'AI Configuration',
              children: (
                <Form
                  layout="vertical"
                  onFinish={handleSave}
                  initialValues={{
                    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
                    maxTokens: 4096,
                    temperature: 0.7,
                    topP: 0.9,
                    responseTime: 5000,
                    cacheEnabled: true,
                    cacheTTL: 3600,
                  }}
                >
                  <Form.Item label="Model ID" name="modelId">
                    <Select>
                      <Option value="anthropic.claude-3-sonnet-20240229-v1:0">Claude 3 Sonnet</Option>
                      <Option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</Option>
                      <Option value="anthropic.claude-3-opus-20240229-v1:0">Claude 3 Opus</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item label="Max Tokens" name="maxTokens">
                    <InputNumber min={100} max={8192} style={{ width: '100%' }} />
                  </Form.Item>

                  <Form.Item label="Temperature" name="temperature">
                    <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>

                  <Form.Item label="Top P" name="topP">
                    <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>

                  <Divider />

                  <Form.Item label="Target Response Time (ms)" name="responseTime">
                    <InputNumber min={1000} max={10000} style={{ width: '100%' }} />
                  </Form.Item>

                  <Form.Item label="Enable Cache" name="cacheEnabled" valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Form.Item label="Cache TTL (seconds)" name="cacheTTL">
                    <InputNumber min={60} max={86400} style={{ width: '100%' }} />
                  </Form.Item>

                  <Form.Item label="System Prompt" name="systemPrompt">
                    <TextArea
                      rows={6}
                      placeholder="Enter custom system prompt..."
                      defaultValue="You are an AI consulting assistant powered by Claude. Your goal is to provide accurate, helpful, and contextually relevant responses to user queries."
                    />
                  </Form.Item>

                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                        Save AI Settings
                      </Button>
                      <Button>Test Connection</Button>
                    </Space>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'aws',
              label: 'AWS Configuration',
              children: (
                <Form
                  layout="vertical"
                  onFinish={handleSave}
                  initialValues={{
                    region: 'ap-southeast-2',
                    s3DocumentsBucket: 'ai-chatbot-documents',
                    s3MediaBucket: 'ai-chatbot-media',
                    dynamodbConversationsTable: 'ai-chatbot-conversations',
                    dynamodbDocumentsTable: 'ai-chatbot-documents',
                  }}
                >
                  <Form.Item label="AWS Region" name="region">
                    <Select>
                      <Option value="ap-southeast-2">Asia Pacific (Sydney)</Option>
                      <Option value="us-east-1">US East (N. Virginia)</Option>
                      <Option value="us-west-2">US West (Oregon)</Option>
                      <Option value="eu-west-1">Europe (Ireland)</Option>
                      <Option value="ap-southeast-1">Asia Pacific (Singapore)</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item label="S3 Documents Bucket" name="s3DocumentsBucket">
                    <Input placeholder="Bucket name for documents" />
                  </Form.Item>

                  <Form.Item label="S3 Media Bucket" name="s3MediaBucket">
                    <Input placeholder="Bucket name for media files" />
                  </Form.Item>

                  <Form.Item label="DynamoDB Conversations Table" name="dynamodbConversationsTable">
                    <Input placeholder="Table name for conversations" />
                  </Form.Item>

                  <Form.Item label="DynamoDB Documents Table" name="dynamodbDocumentsTable">
                    <Input placeholder="Table name for documents" />
                  </Form.Item>

                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                        Save AWS Settings
                      </Button>
                      <Button>Validate Configuration</Button>
                    </Space>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'notifications',
              label: 'Notifications',
              children: (
                <Form
                  layout="vertical"
                  onFinish={handleSave}
                  initialValues={{
                    emailEnabled: true,
                    slackEnabled: false,
                    errorAlerts: true,
                    performanceAlerts: true,
                    dailyReports: false,
                  }}
                >
                  <Form.Item label="Email Notifications" name="emailEnabled" valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Form.Item label="Slack Notifications" name="slackEnabled" valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Form.Item label="Error Alerts" name="errorAlerts" valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Form.Item label="Performance Alerts" name="performanceAlerts" valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Form.Item label="Daily Reports" name="dailyReports" valuePropName="checked">
                    <Switch />
                  </Form.Item>

                  <Form.Item label="Alert Email" name="alertEmail">
                    <Input type="email" placeholder="admin@example.com" />
                  </Form.Item>

                  <Form.Item label="Slack Webhook URL" name="slackWebhook">
                    <Input placeholder="https://hooks.slack.com/services/..." />
                  </Form.Item>

                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                        Save Notification Settings
                      </Button>
                      <Button>Send Test Notification</Button>
                    </Space>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}