import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Progress,
  Steps,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Alert,
  Slider,
  InputNumber,
  Tooltip,
  Row,
  Col,
  Modal,
  Divider,
  Typography,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RocketOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
  MessageOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingService } from '@/services/training';
import { documentsService } from '@/services/documents';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

export default function Training() {
  const [activeTab, setActiveTab] = useState('1');
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [testQuestion, setTestQuestion] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testLoading, setTestLoading] = useState(false);

  const handleTestQuestion = async () => {
    if (!testQuestion.trim()) return;
    
    setTestLoading(true);
    setTestResponse('Searching documents and generating response...');
    
    try {
      // Call the actual chat API
      const response = await fetch('http://localhost:3000/api/v1/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: testQuestion,
          metadata: {
            mode: 'exact', // Use exact mode for testing trained documents
            source: 'training-test',
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      // Display the response with document usage info
      if (data.metadata?.documentsUsed && data.metadata.documentsUsed > 0) {
        setTestResponse(`📚 Found in ${data.metadata.documentsUsed} document(s):\n\n${data.content}`);
      } else if (data.content) {
        setTestResponse(data.content);
      } else {
        setTestResponse('No relevant information found in the trained documents. Please try a different question.');
      }
    } catch (error) {
      console.error('Error testing question:', error);
      setTestResponse('Error: Failed to get response. Please ensure the backend is running and try again.');
    } finally {
      setTestLoading(false);
    }
  };

  const { data: trainingJobs, isLoading, error: jobsError, refetch: refetchJobs } = useQuery({
    queryKey: ['training-jobs'],
    queryFn: trainingService.getTrainingJobs,
    retry: 2,
  });

  useEffect(() => {
    if (trainingJobs) {
      console.log('Training jobs loaded:', trainingJobs);
    }
    if (jobsError) {
      console.error('Error loading training jobs:', jobsError);
    }
  }, [trainingJobs, jobsError]);

  const { data: documents, isLoading: documentsLoading, refetch: refetchDocuments } = useQuery({
    queryKey: ['documents'],
    queryFn: documentsService.getDocuments,
    retry: 2,
  });

  useEffect(() => {
    if (documents) {
      console.log('Documents loaded:', documents);
    }
  }, [documents]);

  const startTrainingMutation = useMutation({
    mutationFn: trainingService.startTraining,
    onSuccess: () => {
      message.success('Training job started successfully');
      form.resetFields();
      // Invalidate and refetch training jobs to show the new job
      queryClient.invalidateQueries({ queryKey: ['training-jobs'] });
      // Switch to history tab to show the new job
      setActiveTab('2');
    },
    onError: (error: any) => {
      console.error('Training start error:', error);
      message.error('Failed to start training job');
    },
  });

  const stopTrainingMutation = useMutation({
    mutationFn: trainingService.stopTraining,
    onSuccess: () => {
      message.success('Training job stopped');
      queryClient.invalidateQueries({ queryKey: ['training-jobs'] });
    },
    onError: () => {
      message.error('Failed to stop training job');
    },
  });

  const columns = [
    {
      title: 'Job ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => <code>{id.substring(0, 8)}</code>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => name || 'Unnamed Job',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig: Record<string, any> = {
          running: { color: 'processing', icon: <PlayCircleOutlined /> },
          completed: { color: 'success', icon: <CheckCircleOutlined /> },
          failed: { color: 'error', icon: <CloseCircleOutlined /> },
          paused: { color: 'warning', icon: <PauseCircleOutlined /> },
        };
        const config = statusConfig[status] || {};
        return (
          <Tag color={config.color} icon={config.icon}>
            {status.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => <Progress percent={progress} size="small" />,
    },
    {
      title: 'Records Processed',
      dataIndex: 'recordsProcessed',
      key: 'recordsProcessed',
      render: (count: number) => count || 0,
    },
    {
      title: 'Started',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'N/A',
    },
    {
      title: 'Completed',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'In Progress',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          {record.status === 'running' && (
            <Button 
              size="small" 
              danger
              onClick={() => stopTrainingMutation.mutate(record.id)}
              loading={stopTrainingMutation.isPending}
            >
              Stop
            </Button>
          )}
          {record.status === 'stopped' && (
            <Tag color="warning">Stopped</Tag>
          )}
          {record.status === 'completed' && (
            <>
              <Tag color="success">Completed</Tag>
              <Button 
                size="small" 
                type="primary"
                icon={<MessageOutlined />}
                onClick={() => {
                  setSelectedJob(record);
                  setTestModalVisible(true);
                  setTestQuestion('');
                  setTestResponse('');
                }}
              >
                Quick Test
              </Button>
              <Button 
                size="small" 
                onClick={() => {
                  // Open chat in new tab with test context
                  window.open('http://localhost:3001', '_blank');
                }}
              >
                Full Chat
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const handleStartTraining = (values: any) => {
    startTrainingMutation.mutate(values);
  };

  return (
    <div>
      <Card title="Training Management">
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="New Training" key="1">
            <Alert
              message="Training Information"
              description="Start a new training job to improve the AI model's performance with your custom data."
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
            
            {documents && documents.length === 0 && (
              <Alert
                message="No Documents Available"
                description={
                  <span>
                    You need to upload documents before starting a training job. 
                    <a href="/documents" style={{ marginLeft: 8 }}>Go to Documents Page</a>
                  </span>
                }
                type="warning"
                showIcon
                style={{ marginBottom: 24 }}
              />
            )}
            
            <Form
              form={form}
              layout="vertical"
              onFinish={handleStartTraining}
              style={{ maxWidth: 600 }}
            >
              <Form.Item
                label="Training Type"
                name="type"
                rules={[{ required: true, message: 'Please select training type' }]}
              >
                <Select placeholder="Select training type">
                  <Option value="documents">Document Training</Option>
                  <Option value="qa">Q&A Training</Option>
                  <Option value="fine-tuning">Fine-tuning</Option>
                  <Option value="embedding">Embedding Generation</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="Training Name"
                name="name"
                rules={[{ required: true, message: 'Please enter training name' }]}
              >
                <Input placeholder="Enter training job name" />
              </Form.Item>

              <Form.Item
                label="Description"
                name="description"
              >
                <TextArea rows={3} placeholder="Describe the training purpose" />
              </Form.Item>

              <Form.Item
                label={
                  <Space>
                    Select Documents
                    <Button 
                      size="small" 
                      type="link"
                      onClick={() => {
                        if (documents && documents.length > 0) {
                          const allDocIds = documents
                            .filter((doc: any) => doc.status === 'processed' || doc.status === 'completed')
                            .map((doc: any) => doc.id);
                          form.setFieldsValue({ documents: allDocIds });
                        }
                      }}
                      disabled={documentsLoading || !documents || documents.length === 0}
                    >
                      Select All
                    </Button>
                    <Button 
                      size="small" 
                      type="link"
                      onClick={() => {
                        form.setFieldsValue({ documents: [] });
                      }}
                    >
                      Clear All
                    </Button>
                    <Button 
                      size="small" 
                      type="link" 
                      icon={<ReloadOutlined />}
                      onClick={() => refetchDocuments()}
                      loading={documentsLoading}
                    >
                      Refresh
                    </Button>
                  </Space>
                }
                name="documents"
                extra={
                  documents && documents.length > 0 && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {form.getFieldValue('documents')?.length || 0} of {documents.filter((doc: any) => doc.status === 'processed' || doc.status === 'completed').length} ready documents selected
                    </Text>
                  )
                }
              >
                <Select
                  mode="multiple"
                  placeholder={documentsLoading ? "Loading documents..." : "Select documents for training"}
                  style={{ width: '100%' }}
                  loading={documentsLoading}
                  disabled={documentsLoading}
                  notFoundContent={
                    documentsLoading ? 'Loading documents...' : 
                    documents?.length === 0 ? 'No documents found. Please upload documents first.' : 
                    'No documents found'
                  }
                  showSearch
                  filterOption={(input, option: any) => {
                    const doc = documents?.find((d: any) => d.id === option.value);
                    const title = doc?.title || doc?.metadata?.originalName || '';
                    return title.toLowerCase().includes(input.toLowerCase());
                  }}
                  maxTagCount="responsive"
                  maxTagTextLength={30}
                  maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} more`}
                >
                  {documents && Array.isArray(documents) && documents.map((doc: any) => (
                    <Option 
                      key={doc.id} 
                      value={doc.id}
                      disabled={doc.status !== 'processed' && doc.status !== 'completed'}
                    >
                      {doc.title || doc.metadata?.originalName || `Document ${doc.id.substring(0, 8)}`}
                      {(doc.status === 'processed' || doc.status === 'completed') && 
                        <Tag color="green" style={{ marginLeft: 8 }}>Ready</Tag>
                      }
                      {doc.status === 'processing' && 
                        <Tag color="blue" style={{ marginLeft: 8 }}>Processing</Tag>
                      }
                      {doc.status === 'failed' && 
                        <Tag color="red" style={{ marginLeft: 8 }}>Failed</Tag>
                      }
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Card 
                title={
                  <Space>
                    Training Parameters
                    <Tooltip title="Configure advanced training parameters for fine-tuning the model">
                      <InfoCircleOutlined style={{ color: '#1890ff' }} />
                    </Tooltip>
                  </Space>
                }
                size="small"
                style={{ marginBottom: 16 }}
              >
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space>
                          Learning Rate
                          <Tooltip title="Controls how quickly the model adapts. Lower values = slower but more stable learning">
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </Space>
                      }
                      name={['parameters', 'learningRate']}
                      initialValue={0.001}
                    >
                      <InputNumber
                        min={0.0001}
                        max={0.1}
                        step={0.0001}
                        style={{ width: '100%' }}
                        placeholder="0.001"
                      />
                    </Form.Item>
                  </Col>
                  
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space>
                          Batch Size
                          <Tooltip title="Number of examples processed together. Larger = faster but uses more memory">
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </Space>
                      }
                      name={['parameters', 'batchSize']}
                      initialValue={32}
                    >
                      <Select>
                        <Option value={8}>8 (Low Memory)</Option>
                        <Option value={16}>16 (Balanced)</Option>
                        <Option value={32}>32 (Recommended)</Option>
                        <Option value={64}>64 (High Performance)</Option>
                        <Option value={128}>128 (Max Performance)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space>
                          Epochs
                          <Tooltip title="Number of complete passes through the training data">
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </Space>
                      }
                      name={['parameters', 'epochs']}
                      initialValue={10}
                    >
                      <Slider
                        min={1}
                        max={50}
                        marks={{
                          1: '1',
                          10: '10',
                          25: '25',
                          50: '50'
                        }}
                      />
                    </Form.Item>
                  </Col>
                  
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space>
                          Max Tokens
                          <Tooltip title="Maximum length of generated responses">
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </Space>
                      }
                      name={['parameters', 'maxTokens']}
                      initialValue={2048}
                    >
                      <Select>
                        <Option value={512}>512 (Short)</Option>
                        <Option value={1024}>1024 (Medium)</Option>
                        <Option value={2048}>2048 (Standard)</Option>
                        <Option value={4096}>4096 (Long)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  
                  <Col span={24}>
                    <Form.Item
                      label={
                        <Space>
                          Temperature
                          <Tooltip title="Controls randomness: 0 = deterministic, 2 = very creative">
                            <QuestionCircleOutlined />
                          </Tooltip>
                        </Space>
                      }
                      name={['parameters', 'temperature']}
                      initialValue={0.7}
                    >
                      <Slider
                        min={0}
                        max={2}
                        step={0.1}
                        marks={{
                          0: 'Precise',
                          0.7: 'Balanced',
                          1.5: 'Creative',
                          2: 'Very Creative'
                        }}
                      />
                    </Form.Item>
                  </Col>
                  
                  <Col span={24}>
                    <Alert
                      message="Recommended Settings"
                      description="For most use cases, the default parameters work well. Adjust only if you have specific requirements."
                      type="info"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  </Col>
                </Row>
              </Card>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<RocketOutlined />}
                    loading={startTrainingMutation.isPending}
                  >
                    Start Training
                  </Button>
                  <Button onClick={() => form.resetFields()}>
                    Reset
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Tabs.TabPane>

          <Tabs.TabPane tab="Training History" key="2">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {trainingJobs && trainingJobs.length > 0 && 
                    `Showing ${trainingJobs.length} training job${trainingJobs.length > 1 ? 's' : ''}`
                  }
                </span>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={() => refetchJobs()}
                  loading={isLoading}
                >
                  Refresh
                </Button>
              </div>
              
              {jobsError && (
                <Alert
                  message="Error Loading Training Jobs"
                  description="Failed to load training history. Please try refreshing."
                  type="error"
                  showIcon
                />
              )}
              
              <Table
                columns={columns}
                dataSource={trainingJobs || []}
                loading={isLoading}
                rowKey="id"
                locale={{
                  emptyText: (
                    <div style={{ padding: '40px' }}>
                      <p>No training jobs found</p>
                      <p style={{ color: '#999', fontSize: '12px' }}>
                        Start a new training job in the "New Training" tab
                      </p>
                    </div>
                  )
                }}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                }}
              />
            </Space>
          </Tabs.TabPane>

          <Tabs.TabPane tab="Training Metrics" key="3">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Card>
                <Steps current={2}>
                  <Steps.Step title="Data Preparation" description="Completed" />
                  <Steps.Step title="Training" description="In Progress" />
                  <Steps.Step title="Validation" description="Waiting" />
                  <Steps.Step title="Deployment" description="Waiting" />
                </Steps>
              </Card>
              
              <Card title="Current Training Metrics">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <span>Loss: </span>
                    <Progress percent={75} strokeColor="#ff4d4f" format={() => '0.234'} />
                  </div>
                  <div>
                    <span>Accuracy: </span>
                    <Progress percent={89} strokeColor="#52c41a" />
                  </div>
                  <div>
                    <span>F1 Score: </span>
                    <Progress percent={82} strokeColor="#1890ff" format={() => '0.82'} />
                  </div>
                </Space>
              </Card>
            </Space>
          </Tabs.TabPane>
        </Tabs>
      </Card>

      {/* Test Modal */}
      <Modal
        title={
          <Space>
            <MessageOutlined />
            Test Training: {selectedJob?.name || 'Unnamed Job'}
          </Space>
        }
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        width={700}
        footer={[
          <Button key="close" onClick={() => setTestModalVisible(false)}>
            Close
          </Button>,
          <Button 
            key="fullchat" 
            type="primary"
            onClick={() => window.open('http://localhost:3001', '_blank')}
          >
            Open Full Chat
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Alert
            message="Test Your Training"
            description={`This training used ${selectedJob?.documents?.length || 0} document(s). Ask questions related to the content to test if the AI can answer using your trained data.`}
            type="info"
            showIcon
          />
          
          {selectedJob?.documents && selectedJob.documents.length > 0 && (
            <div>
              <Text type="secondary">Trained Documents:</Text>
              <div style={{ marginTop: 8 }}>
                {selectedJob.documents.map((docId: string, index: number) => (
                  <Tag key={index}>{docId.substring(0, 8)}...</Tag>
                ))}
              </div>
            </div>
          )}
          
          <Divider />
          
          <div>
            <Text strong>Ask a Test Question:</Text>
            <Space.Compact style={{ width: '100%', marginTop: 8 }}>
              <Input
                placeholder="e.g., What is the main topic of the document?"
                value={testQuestion}
                onChange={(e) => setTestQuestion(e.target.value)}
                onPressEnter={handleTestQuestion}
              />
              <Button 
                type="primary" 
                icon={<SendOutlined />}
                onClick={handleTestQuestion}
                loading={testLoading}
              >
                Test
              </Button>
            </Space.Compact>
          </div>
          
          {testResponse && (
            <Card style={{ backgroundColor: '#f5f5f5' }}>
              <Text>{testResponse}</Text>
            </Card>
          )}
          
          <Alert
            message="How Document Testing Works"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li>Documents are already indexed when status shows "Processed"</li>
                <li>Training simulates fine-tuning but documents are ready immediately</li>
                <li>The AI will search your documents for relevant information</li>
                <li>Responses include context from your uploaded documents</li>
              </ul>
            }
            type="warning"
          />
        </Space>
      </Modal>
    </div>
  );
}