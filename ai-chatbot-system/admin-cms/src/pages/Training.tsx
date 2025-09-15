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
  Upload,
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
  UploadOutlined,
  FileTextOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingService } from '@/services/training';
import { documentsService } from '@/services/documents';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

// Helper function to format answer text with proper list formatting
const formatAnswerText = (text: string) => {
  if (!text) return text;

  console.log('=== DEBUGGING BULLET POINT PROCESSING ===');
  console.log('Original text:', text);
  console.log('Text length:', text.length);
  console.log('Contains ▪️?', text.includes('▪️'));

  // Test: Let's try the simplest possible approach
  // If text contains ▪️, split it properly
  if (text.includes('▪️')) {
    // Most basic approach: split on bullet point and rejoin with newlines
    const parts = text.split('▪️').filter(part => part.trim().length > 0);
    console.log('Split parts:', parts.length, parts);

    if (parts.length > 1) {
      // Rejoin with bullet points on new lines - add space after bullet
      let result = parts[0].trim();
      for (let i = 1; i < parts.length; i++) {
        // Add space after ▪️ if the text doesn't already start with space
        const part = parts[i].trim();
        const spacedPart = part.startsWith(' ') ? part : ' ' + part;
        result += '\n▪️' + spacedPart;
      }
      console.log('Processed result:', result);
      console.log('Result lines:', result.split('\n'));

      const finalText = result
        .replace(/(\s+)(Inhale:)/g, '\n$2')
        .replace(/(\s+)(Exhale:)/g, '\n$2')
        .trim();

      console.log('Final text:', finalText);
      return finalText;
    }
  }

  // Fallback: return original text with breathing pattern handling
  const fallbackText = text
    .replace(/(\s+)(Inhale:)/g, '\n$2')
    .replace(/(\s+)(Exhale:)/g, '\n$2')
    .trim();

  console.log('Using fallback text:', fallbackText);
  return fallbackText;
};

// Helper function to render formatted text
const renderFormattedText = (text: string) => {
  const formattedText = formatAnswerText(text);

  return formattedText.split('\n').map((line, index) => {
    const trimmedLine = line.trim();

    // Check for all types of bullet points (▪️, •, -, *, ○, ●, ▸, ►)
    if (trimmedLine.match(/^[▪️•\-\*○●▸►]\s*/) || trimmedLine.startsWith('▪️')) {
      return (
        <div key={index} style={{
          marginLeft: '20px',
          marginBottom: '6px',
          position: 'relative',
          paddingLeft: '12px'
        }}>
          <span style={{
            position: 'absolute',
            left: '-12px',
            color: '#059669',
            fontWeight: 'bold'
          }}>•</span>
          {trimmedLine.replace(/^[▪️•\-\*○●▸►]\s*/, '')}
        </div>
      );
    }

    // Check for all numbered/lettered lists (1. 2. 3. or 1) 2) 3) or a. b. c. or i. ii. iii. or I. II. III.)
    if (trimmedLine.match(/^(\d+[.)]\s|[a-z][.)]\s|[ivx]+[.)]\s|[IVXLCDM]+[.)]\s)/i)) {
      const listNumber = trimmedLine.match(/^([^.\s)]+[.)]\s*)/)?.[1] || '';
      return (
        <div key={index} style={{
          marginLeft: '20px',
          marginBottom: '6px',
          position: 'relative',
          paddingLeft: '24px',
          fontWeight: '500'
        }}>
          <span style={{
            position: 'absolute',
            left: '0',
            color: '#2563eb',
            fontWeight: 'bold',
            minWidth: '20px'
          }}>{listNumber}</span>
          {trimmedLine.replace(/^[^.\s)]+[.)]\s*/, '')}
        </div>
      );
    }

    // Check for sequential instruction patterns (First, Second, Then, Finally, etc.)
    if (trimmedLine.match(/^(First,|Second,|Third,|Fourth,|Fifth,|Then,|Next,|Finally,|Lastly,|Step \d+:|Method \d+:)/i)) {
      const instruction = trimmedLine.match(/^([^,]+[:,]?\s*)/)?.[1] || '';
      return (
        <div key={index} style={{
          marginLeft: '20px',
          marginBottom: '6px',
          position: 'relative',
          paddingLeft: '60px',
          fontWeight: '500'
        }}>
          <span style={{
            position: 'absolute',
            left: '0',
            color: '#7c3aed',
            fontWeight: 'bold',
            fontSize: '13px',
            textTransform: 'uppercase'
          }}>{instruction}</span>
          {trimmedLine.replace(/^[^,]+[:,]?\s*/, '')}
        </div>
      );
    }

    // Check for Quranic verses (quoted text)
    if (trimmedLine.match(/^[""].+[""]/) || trimmedLine.match(/^\".+\"$/)) {
      return (
        <div key={index} style={{
          fontStyle: 'italic',
          color: '#047857',
          marginTop: '8px',
          marginBottom: '8px',
          paddingLeft: '16px',
          borderLeft: '3px solid #10b981',
          backgroundColor: '#f0fdf4',
          padding: '8px 16px',
          borderRadius: '4px'
        }}>
          {trimmedLine}
        </div>
      );
    }

    // Check for Surah/Hadith references
    if (trimmedLine.match(/\(Surah\s+.*?\)|Ibn Majah|Tirmidhi|Bukhari|Muslim/i)) {
      return (
        <div key={index} style={{
          fontStyle: 'italic',
          color: '#6366f1',
          marginTop: '4px',
          marginBottom: '8px',
          fontSize: '12px',
          fontWeight: '500'
        }}>
          {trimmedLine}
        </div>
      );
    }


    // Empty lines
    if (!trimmedLine) {
      return <div key={index} style={{ height: '8px' }} />;
    }

    // Check for media references (Image, Video, Audio, Quran)
    if (trimmedLine.match(/^\[?(Image|Video|Audio|Quran|Media):/i)) {
      const mediaType = trimmedLine.match(/^\[?(Image|Video|Audio|Quran|Media):/i)?.[1] || '';
      const mediaContent = trimmedLine.replace(/^\[?(Image|Video|Audio|Quran|Media):\s*/i, '').replace(/\]?$/, '');

      const getMediaIcon = (type: string) => {
        switch (type.toLowerCase()) {
          case 'image': return '🖼️';
          case 'video': return '🎥';
          case 'audio': return '🎵';
          case 'quran': return '📖';
          default: return '📱';
        }
      };

      const getMediaColor = (type: string) => {
        switch (type.toLowerCase()) {
          case 'image': return '#10b981';
          case 'video': return '#f59e0b';
          case 'audio': return '#8b5cf6';
          case 'quran': return '#059669';
          default: return '#6b7280';
        }
      };

      return (
        <div key={index} style={{
          marginTop: '12px',
          marginBottom: '8px',
          padding: '12px',
          backgroundColor: '#f8fafc',
          border: `2px solid ${getMediaColor(mediaType)}`,
          borderRadius: '8px',
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '6px'
          }}>
            <span style={{
              fontSize: '20px',
              marginRight: '8px'
            }}>{getMediaIcon(mediaType)}</span>
            <span style={{
              fontWeight: 'bold',
              color: getMediaColor(mediaType),
              textTransform: 'uppercase',
              fontSize: '12px',
              letterSpacing: '0.5px'
            }}>{mediaType}</span>
          </div>
          <div style={{
            color: '#374151',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            {mediaContent}
          </div>
        </div>
      );
    }

    // Regular lines
    return (
      <div key={index} style={{
        marginBottom: '6px',
        lineHeight: '1.6',
        color: '#374151'
      }}>
        {trimmedLine}
      </div>
    );
  });
};

export default function Training() {
  const [activeTab, setActiveTab] = useState('1');
  const [form] = Form.useForm();
  const [csvForm] = Form.useForm();
  const queryClient = useQueryClient();
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [testQuestion, setTestQuestion] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

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

  const { data: qaData, isLoading: qaDataLoading, refetch: refetchQAData } = useQuery({
    queryKey: ['qa-data'],
    queryFn: trainingService.getQAData,
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
      setActiveTab('3');
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

  const csvUploadMutation = useMutation({
    mutationFn: ({ file, options }: { file: File; options: any }) =>
      trainingService.uploadCSV(file, options),
    onSuccess: (data) => {
      message.success(`Successfully processed ${data.recordsProcessed} Q&A pairs from CSV`);
      csvForm.resetFields();
      setCsvFile(null);
      queryClient.invalidateQueries({ queryKey: ['training-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['qa-data'] });
      setActiveTab('5'); // Switch to Q&A data tab
    },
    onError: (error: any) => {
      console.error('CSV upload error:', error);
      message.error(error?.response?.data?.message || 'Failed to upload CSV file');
    },
  });

  const clearQADataMutation = useMutation({
    mutationFn: trainingService.clearAllQAData,
    onSuccess: (data) => {
      message.success(data.message || 'All Q&A training data has been cleared');
      queryClient.invalidateQueries({ queryKey: ['qa-data'] });
      queryClient.invalidateQueries({ queryKey: ['training-jobs'] });
    },
    onError: (error: any) => {
      console.error('Clear Q&A data error:', error);
      message.error(error?.response?.data?.message || 'Failed to clear Q&A data');
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

  const handleCSVUpload = (values: any) => {
    if (!csvFile) {
      message.error('Please select a CSV file');
      return;
    }

    csvUploadMutation.mutate({
      file: csvFile,
      options: values,
    });
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

          <Tabs.TabPane tab={
            <Space>
              <FileTextOutlined />
              CSV Upload
            </Space>
          } key="2">
            <Alert
              message="CSV Training Information"
              description="Upload a CSV file with question and answer columns to train the AI model with Q&A pairs."
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Alert
              message="CSV Format Requirements"
              description={
                <div>
                  <p><strong>Required columns:</strong> Your CSV must contain question and answer columns</p>
                  <ul style={{ marginTop: 8, marginBottom: 0 }}>
                    <li>Default column names: "question" and "answer"</li>
                    <li>You can specify custom column names below</li>
                    <li>Additional columns will be saved as metadata</li>
                    <li>Empty rows or rows missing question/answer will be skipped</li>
                  </ul>
                </div>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Form
              form={csvForm}
              layout="vertical"
              onFinish={handleCSVUpload}
              style={{ maxWidth: 600 }}
            >
              <Form.Item
                label="Training Name"
                name="name"
                rules={[{ required: true, message: 'Please enter training name' }]}
              >
                <Input placeholder="Enter CSV training job name" />
              </Form.Item>

              <Form.Item
                label="Description"
                name="description"
              >
                <TextArea rows={3} placeholder="Describe the CSV training purpose" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Question Column Name"
                    name="questionColumn"
                    initialValue="question"
                    extra="Column name in your CSV that contains questions"
                  >
                    <Input placeholder="question" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Answer Column Name"
                    name="answerColumn"
                    initialValue="answer"
                    extra="Column name in your CSV that contains answers"
                  >
                    <Input placeholder="answer" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="CSV File"
                required
                extra="Upload a CSV file with question and answer columns"
              >
                <Upload
                  accept=".csv"
                  maxCount={1}
                  beforeUpload={(file) => {
                    const isCsv = file.name.toLowerCase().endsWith('.csv');
                    if (!isCsv) {
                      message.error('Please upload a CSV file');
                      return false;
                    }
                    setCsvFile(file);
                    return false; // Prevent auto-upload
                  }}
                  onRemove={() => {
                    setCsvFile(null);
                  }}
                  fileList={csvFile ? [csvFile as any] : []}
                >
                  <Button icon={<UploadOutlined />}>
                    Select CSV File
                  </Button>
                </Upload>
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<UploadOutlined />}
                    loading={csvUploadMutation.isPending}
                    disabled={!csvFile}
                  >
                    Upload & Process CSV
                  </Button>
                  <Button onClick={() => {
                    csvForm.resetFields();
                    setCsvFile(null);
                  }}>
                    Reset
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Tabs.TabPane>

          <Tabs.TabPane tab="Training History" key="3">
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

          <Tabs.TabPane tab="Training Metrics" key="4">
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

          <Tabs.TabPane tab={
            <Space>
              <MessageOutlined />
              Q&A Training Data
            </Space>
          } key="5">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {qaData && qaData.length > 0 &&
                    `Showing ${qaData.length} Q&A training pair${qaData.length > 1 ? 's' : ''}`
                  }
                </span>
                <Space>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => refetchQAData()}
                    loading={qaDataLoading}
                  >
                    Refresh
                  </Button>
                  <Button
                    type="primary"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      Modal.confirm({
                        title: 'Clear All Q&A Training Data',
                        content: 'Are you sure you want to permanently delete all Q&A training data? This action cannot be undone.',
                        okText: 'Yes, Clear All',
                        okType: 'danger',
                        cancelText: 'Cancel',
                        onOk: () => clearQADataMutation.mutate(),
                      });
                    }}
                    loading={clearQADataMutation.isPending}
                  >
                    Clear All Data
                  </Button>
                </Space>
              </div>

              <Table
                columns={[
                  {
                    title: 'Question',
                    dataIndex: 'question',
                    key: 'question',
                    render: (text: string) => (
                      <div style={{ maxWidth: 300 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#1f2937',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={text}
                          onClick={() => {
                            Modal.info({
                              title: 'Full Question',
                              content: (
                                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                                  {text}
                                </div>
                              ),
                              width: 600,
                              maskClosable: true,
                            });
                          }}
                        >
                          {text}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'Answer',
                    dataIndex: 'answer',
                    key: 'answer',
                    render: (text: string) => (
                      <div style={{ maxWidth: 400 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            lineHeight: '1.5',
                            maxHeight: '100px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            padding: '8px',
                            backgroundColor: '#fafafa',
                            borderRadius: '4px',
                            border: '1px solid #f0f0f0',
                            position: 'relative'
                          }}
                          onClick={() => {
                            Modal.info({
                              title: 'Complete Answer',
                              content: (
                                <div style={{ maxHeight: '500px', overflow: 'auto', padding: '8px' }}>
                                  {renderFormattedText(text)}
                                </div>
                              ),
                              width: 800,
                              maskClosable: true,
                            });
                          }}
                        >
                          <div style={{
                            overflow: 'hidden',
                            maxHeight: '120px'
                          }}>
                            {renderFormattedText(text.length > 200 ? text.substring(0, 200) + '...' : text)}
                          </div>
                          {text.length > 150 && (
                            <div style={{
                              position: 'absolute',
                              bottom: '4px',
                              right: '8px',
                              fontSize: '11px',
                              color: '#1890ff',
                              backgroundColor: 'white',
                              padding: '2px 6px',
                              borderRadius: '2px',
                              border: '1px solid #d9d9d9'
                            }}>
                              Click to view full
                            </div>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'Source',
                    dataIndex: 'metadata',
                    key: 'source',
                    width: 120,
                    render: (metadata: any) => (
                      <Tag color="blue">
                        {metadata?.source || 'Manual'}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Job ID',
                    dataIndex: 'metadata',
                    key: 'jobId',
                    width: 120,
                    render: (metadata: any) => (
                      <Tag color="green">
                        {metadata?.jobId ? metadata.jobId.substring(0, 8) + '...' : 'N/A'}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Created',
                    dataIndex: 'createdAtISO',
                    key: 'createdAt',
                    width: 160,
                    render: (date: string) => (
                      <span>{new Date(date).toLocaleDateString()}</span>
                    ),
                  },
                ]}
                dataSource={qaData}
                loading={qaDataLoading}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} Q&A pairs`,
                }}
                scroll={{ x: 800 }}
              />
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