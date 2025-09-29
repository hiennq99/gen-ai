import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Input,
  Modal,
  Alert,
  Progress,
  Row,
  Col,
  Tag,
  Divider,
  List,
  Typography,
  Table,
  Statistic,
  Space,
  message,
} from 'antd';
import {
  RobotOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  SettingOutlined,
  BookOutlined,
  FileSearchOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { spiritualGuidanceService } from '../services/spiritualGuidance';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

interface TrainingStats {
  totalExamples: number;
  byCategory: Record<string, number>;
  byEmotionalState: Record<string, number>;
  byDifficulty?: Record<string, number>;
}


interface ModelStatus {
  config: any;
  stats: {
    totalRequests: number;
    averageResponseTime: number;
    cacheHitRate: number;
  };
}

const FineTunedModelManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [trainingStats, setTrainingStats] = useState<TrainingStats | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [openTestModal, setOpenTestModal] = useState(false);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);

  useEffect(() => {
    loadModelStatus();
  }, []);

  const loadModelStatus = async () => {
    try {
      const status = await spiritualGuidanceService.getFineTunedModelStatus();
      setModelStatus(status.data);
    } catch (error: any) {
      message.error('Failed to load model status: ' + error.message);
    }
  };

  const handlePrepareTrainingData = async () => {
    setActiveOperation('prepare');
    setLoading(true);
    try {
      const result = await spiritualGuidanceService.prepareQATrainingData();
      setTrainingStats(result.data.stats);
      message.success(result.message);
    } catch (error: any) {
      message.error('Failed to prepare Q&A training data: ' + error.message);
    } finally {
      setLoading(false);
      setActiveOperation(null);
    }
  };

  const handleValidateTrainingData = async () => {
    setActiveOperation('validate');
    setLoading(true);
    try {
      const result = await spiritualGuidanceService.validateQATrainingData();
      setValidationResult(result.data);
      message[result.data.valid ? 'success' : 'warning'](result.message);
    } catch (error: any) {
      message.error('Failed to validate Q&A training data: ' + error.message);
    } finally {
      setLoading(false);
      setActiveOperation(null);
    }
  };

  const handleSaveTrainingData = async () => {
    setActiveOperation('save');
    setLoading(true);
    try {
      const result = await spiritualGuidanceService.saveQATrainingData();
      message.success(result.message);
    } catch (error: any) {
      message.error('Failed to save Q&A training data: ' + error.message);
    } finally {
      setLoading(false);
      setActiveOperation(null);
    }
  };

  const handleTrainModel = async () => {
    setActiveOperation('train');
    setLoading(true);
    try {
      const result = await spiritualGuidanceService.trainFineTunedModel();
      message[result.success ? 'success' : 'error'](result.message);
      if (result.success) {
        await loadModelStatus();
      }
    } catch (error: any) {
      message.error('Failed to start training: ' + error.message);
    } finally {
      setLoading(false);
      setActiveOperation(null);
    }
  };

  const handleTestGuidance = async () => {
    if (!testMessage.trim()) {
      message.error('Please enter a test message');
      return;
    }

    setLoading(true);
    try {
      const result = await spiritualGuidanceService.testDirectQAResponse({
        message: testMessage
      });
      setTestResult(result.data);
      message.success('Q&A test completed successfully');
    } catch (error: any) {
      message.error('Q&A test failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };


  const renderTrainingStats = () => {
    if (!trainingStats) return null;

    const categoryData = Object.entries(trainingStats.byCategory).map(([key, value]) => ({
      key,
      category: key.replace('_', ' ').toUpperCase(),
      count: value,
    }));

    const emotionData = Object.entries(trainingStats.byEmotionalState).map(([key, value]) => ({
      key,
      emotion: key.charAt(0).toUpperCase() + key.slice(1),
      count: value,
    }));

    return (
      <Card
        title={
          <Space>
            <DatabaseOutlined />
            Training Data Statistics
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Examples"
                value={trainingStats.totalExamples}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>

          <Col span={8}>
            <Card title="By Category" size="small">
              <Table
                dataSource={categoryData}
                columns={[
                  { title: 'Category', dataIndex: 'category', key: 'category' },
                  {
                    title: 'Count',
                    dataIndex: 'count',
                    key: 'count',
                    render: (count) => <Tag color="blue">{count}</Tag>
                  },
                ]}
                pagination={false}
                size="small"
              />
            </Card>
          </Col>

          <Col span={8}>
            <Card title="By Emotional State" size="small">
              <Table
                dataSource={emotionData}
                columns={[
                  { title: 'Emotion', dataIndex: 'emotion', key: 'emotion' },
                  {
                    title: 'Count',
                    dataIndex: 'count',
                    key: 'count',
                    render: (count) => <Tag color="green">{count}</Tag>
                  },
                ]}
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      </Card>
    );
  };

  const renderValidationResult = () => {
    if (!validationResult) return null;

    return (
      <Card
        title={
          <Space>
            <CheckCircleOutlined />
            Training Data Validation
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Alert
          message={validationResult.valid
            ? 'Training data is valid and ready for fine-tuning'
            : `Found ${validationResult.issues.length} validation issues`
          }
          type={validationResult.valid ? 'success' : 'warning'}
          style={{ marginBottom: 16 }}
        />

        <Row gutter={16}>
          <Col span={12}>
            <Title level={5}>Validation Statistics</Title>
            <List
              dataSource={[
                { label: 'Total Examples', value: validationResult.stats.total.toLocaleString() },
                { label: 'Valid Examples', value: validationResult.stats.valid.toLocaleString() },
                { label: 'Validation Rate', value: `${(validationResult.stats.validationRate * 100).toFixed(1)}%` },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <Text strong>{item.label}:</Text> <Text>{item.value}</Text>
                </List.Item>
              )}
            />
          </Col>

          {validationResult.issues.length > 0 && (
            <Col span={12}>
              <Title level={5}>Issues Found</Title>
              <List
                dataSource={validationResult.issues.slice(0, 5)}
                renderItem={(issue: string) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
                      description={issue}
                    />
                  </List.Item>
                )}
              />
              {validationResult.issues.length > 5 && (
                <Text type="secondary">... and {validationResult.issues.length - 5} more issues</Text>
              )}
            </Col>
          )}
        </Row>
      </Card>
    );
  };

  const renderModelStatus = () => {
    if (!modelStatus) return null;

    return (
      <Card
        title={
          <Space>
            <RobotOutlined />
            Model Status
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Title level={5}>Configuration</Title>
            <List
              dataSource={[
                {
                  label: 'Model ID',
                  value: modelStatus.config?.modelId || 'Not configured'
                },
                {
                  label: 'Is Custom Model',
                  value: (
                    <Tag color={modelStatus.config?.isCustomModel ? 'success' : 'default'}>
                      {modelStatus.config?.isCustomModel ? 'Yes' : 'No'}
                    </Tag>
                  )
                },
                {
                  label: 'Training Status',
                  value: (
                    <Tag color={modelStatus.config?.trainingStatus === 'COMPLETED' ? 'success' : 'warning'}>
                      {modelStatus.config?.trainingStatus || 'Unknown'}
                    </Tag>
                  )
                },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <Text strong>{item.label}:</Text> {item.value}
                </List.Item>
              )}
            />
          </Col>

          <Col span={12}>
            <Title level={5}>Performance Statistics</Title>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Total Requests"
                  value={modelStatus.stats.totalRequests}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Avg Response Time"
                  value={modelStatus.stats.averageResponseTime}
                  suffix="ms"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Cache Hit Rate"
                  value={(modelStatus.stats.cacheHitRate * 100).toFixed(1)}
                  suffix="%"
                />
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>
    );
  };

  return (
    <div>
      <Title level={3}>
        <RobotOutlined style={{ marginRight: 8 }} />
        Fine-Tuned Model Manager
      </Title>

      <Paragraph type="secondary">
        Manage AI training and fine-tuned models for spiritual guidance. This approach replaces DynamoDB queries with direct AI knowledge.
      </Paragraph>

      {loading && (
        <Progress
          percent={100}
          status="active"
          style={{ marginBottom: 16 }}
          format={() => `${activeOperation || 'Processing'}...`}
        />
      )}

      {/* Model Status */}
      {renderModelStatus()}

      {/* Training Data Stats */}
      {renderTrainingStats()}

      {/* Validation Results */}
      {renderValidationResult()}

      {/* Action Buttons */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            Training Actions
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col span={6}>
            <Button
              type="default"
              block
              size="large"
              onClick={handlePrepareTrainingData}
              loading={loading && activeOperation === 'prepare'}
              icon={<DatabaseOutlined />}
            >
              Prepare Training Data
            </Button>
          </Col>

          <Col span={6}>
            <Button
              type="default"
              block
              size="large"
              onClick={handleValidateTrainingData}
              loading={loading && activeOperation === 'validate'}
              icon={<CheckCircleOutlined />}
            >
              Validate Data
            </Button>
          </Col>

          <Col span={6}>
            <Button
              type="default"
              block
              size="large"
              onClick={handleSaveTrainingData}
              loading={loading && activeOperation === 'save'}
              icon={<CloudUploadOutlined />}
            >
              Save Training File
            </Button>
          </Col>

          <Col span={6}>
            <Button
              type="primary"
              block
              size="large"
              onClick={handleTrainModel}
              loading={loading && activeOperation === 'train'}
              icon={<RobotOutlined />}
            >
              Train Model
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Test Interface */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            Test Fine-Tuned Model
          </Space>
        }
      >
        <Row gutter={16}>
          <Col span={16}>
            <TextArea
              rows={4}
              placeholder="Enter a spiritual guidance question to test the fine-tuned model..."
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              style={{ marginBottom: 16 }}
            />

            <Space>
              <Button
                type="primary"
                onClick={handleTestGuidance}
                loading={loading}
                disabled={!testMessage.trim()}
                icon={<PlayCircleOutlined />}
              >
                Test Guidance
              </Button>

              <Button
                onClick={() => setOpenTestModal(true)}
                disabled={!testResult}
                icon={<FileTextOutlined />}
              >
                View Full Results
              </Button>
            </Space>
          </Col>

          <Col span={8}>
            {testResult && (
              <Card size="small" title="Quick Results">
                <Paragraph>
                  <Text strong>Citation Level:</Text> {testResult.citationLevel}
                </Paragraph>
                <Paragraph>
                  <Text strong>Template:</Text> {testResult.templateUsed}
                </Paragraph>
                {testResult.metadata && (
                  <Paragraph>
                    <Text strong>Quality Score:</Text> {testResult.metadata.qualityScore}
                  </Paragraph>
                )}
              </Card>
            )}
          </Col>
        </Row>

        {testResult && (
          <Card
            title="Response Preview"
            style={{ marginTop: 16 }}
            size="small"
          >
            <Paragraph style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
              {testResult.response.substring(0, 300)}
              {testResult.response.length > 300 && '...'}
            </Paragraph>

            {/* Source Information */}
            {testResult.metadata?.source && (
              <Card
                size="small"
                style={{ marginTop: 12 }}
                title={
                  <Space>
                    {testResult.metadata.source.type === 'qa_training' && <BookOutlined />}
                    {testResult.metadata.source.type === 'document' && <FileSearchOutlined />}
                    {testResult.metadata.source.type === 'ai_knowledge' && <BulbOutlined />}
                    <Text strong>Response Source</Text>
                  </Space>
                }
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div>
                    <Text strong>Source: </Text>
                    <Text>{testResult.metadata.sourceDisplay || testResult.metadata.source.reference}</Text>
                  </div>

                  {testResult.metadata.source.originalQuestion && (
                    <div>
                      <Text strong>Original Question: </Text>
                      <Text italic>"{testResult.metadata.source.originalQuestion}"</Text>
                    </div>
                  )}

                  {testResult.metadata.source.location && (
                    <div>
                      <Text strong>Location: </Text>
                      <Text>{testResult.metadata.source.location}</Text>
                    </div>
                  )}

                  <div>
                    <Space>
                      <Tag color={
                        testResult.metadata.source.type === 'qa_training' ? 'blue' :
                        testResult.metadata.source.type === 'document' ? 'green' : 'orange'
                      }>
                        {testResult.metadata.source.type.replace('_', ' ').toUpperCase()}
                      </Tag>
                      <Tag color={testResult.metadata.source.confidence >= 0.8 ? 'success' :
                                 testResult.metadata.source.confidence >= 0.6 ? 'warning' : 'error'}>
                        {(testResult.metadata.source.confidence * 100).toFixed(0)}% Confidence
                      </Tag>
                    </Space>
                  </div>
                </Space>
              </Card>
            )}
          </Card>
        )}
      </Card>

      {/* Test Results Modal */}
      <Modal
        title="Full Test Results"
        open={openTestModal}
        onCancel={() => setOpenTestModal(false)}
        footer={[
          <Button key="close" onClick={() => setOpenTestModal(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        {testResult && (
          <div>
            <Title level={5}>Response</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f5f5f5', padding: 16 }}>
              {testResult.response}
            </Paragraph>

            <Divider />

            <Row gutter={16}>
              <Col span={12}>
                <List
                  header={<Text strong>Metadata</Text>}
                  dataSource={[
                    { label: 'Citation Level', value: testResult.citationLevel },
                    { label: 'Template Used', value: testResult.templateUsed },
                    ...(testResult.metadata ? [
                      { label: 'Model Type', value: testResult.metadata.modelType },
                      { label: 'Quality Score', value: testResult.metadata.qualityScore },
                    ] : [])
                  ]}
                  renderItem={(item) => (
                    <List.Item>
                      <Text strong>{item.label}:</Text> {item.value}
                    </List.Item>
                  )}
                />

                {/* Source Information in Modal */}
                {testResult.metadata?.source && (
                  <Card
                    size="small"
                    style={{ marginTop: 16 }}
                    title={
                      <Space>
                        {testResult.metadata.source.type === 'qa_training' && <BookOutlined />}
                        {testResult.metadata.source.type === 'document' && <FileSearchOutlined />}
                        {testResult.metadata.source.type === 'ai_knowledge' && <BulbOutlined />}
                        <Text strong>Source Details</Text>
                      </Space>
                    }
                  >
                    <List
                      size="small"
                      dataSource={[
                        { label: 'Type', value: (
                          <Tag color={
                            testResult.metadata.source.type === 'qa_training' ? 'blue' :
                            testResult.metadata.source.type === 'document' ? 'green' : 'orange'
                          }>
                            {testResult.metadata.source.type.replace('_', ' ').toUpperCase()}
                          </Tag>
                        )},
                        { label: 'Reference', value: testResult.metadata.source.reference },
                        ...(testResult.metadata.source.originalQuestion ? [
                          { label: 'Original Question', value: (
                            <Text italic>"{testResult.metadata.source.originalQuestion}"</Text>
                          )}
                        ] : []),
                        ...(testResult.metadata.source.location ? [
                          { label: 'Location', value: testResult.metadata.source.location }
                        ] : []),
                        { label: 'Confidence', value: (
                          <Tag color={testResult.metadata.source.confidence >= 0.8 ? 'success' :
                                     testResult.metadata.source.confidence >= 0.6 ? 'warning' : 'error'}>
                            {(testResult.metadata.source.confidence * 100).toFixed(0)}%
                          </Tag>
                        )}
                      ]}
                      renderItem={(item) => (
                        <List.Item style={{ padding: '4px 0' }}>
                          <Text strong style={{ minWidth: '120px', display: 'inline-block' }}>
                            {item.label}:
                          </Text>
                          {item.value}
                        </List.Item>
                      )}
                    />
                  </Card>
                )}
              </Col>

              <Col span={12}>
                {testResult.citations && testResult.citations.length > 0 && (
                  <List
                    header={<Text strong>Citations</Text>}
                    dataSource={testResult.citations}
                    renderItem={(citation: any) => (
                      <List.Item>
                        <List.Item.Meta
                          description={
                            <div>
                              <Paragraph style={{ fontSize: 12 }}>
                                {citation.quote || citation.content}
                              </Paragraph>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Page {citation.page}
                                {citation.source && ` - ${citation.source}`}
                              </Text>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FineTunedModelManager;