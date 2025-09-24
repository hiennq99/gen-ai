import { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Progress,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Alert,
  Row,
  Col,
  Modal,
  Divider,
  Typography,
  Upload,
  Statistic,
  Badge,
  Tooltip,
  Drawer,
  List,
} from 'antd';
import {
  BookOutlined,
  HeartOutlined,
  FileTextOutlined,
  UploadOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  BarChartOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { spiritualGuidanceService } from '@/services/spiritualGuidance';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { TabPane } = Tabs;

export default function SpiritualGuidance() {
  const [activeTab, setActiveTab] = useState('diseases');
  const [selectedDisease, setSelectedDisease] = useState<any>(null);
  const [diseaseForm] = Form.useForm();
  const [testForm] = Form.useForm();
  const [diseaseModalVisible, setDiseaseModalVisible] = useState(false);
  const [testDrawerVisible, setTestDrawerVisible] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const queryClient = useQueryClient();

  // Queries
  const { data: diseases, isLoading: diseasesLoading } = useQuery({
    queryKey: ['spiritual-diseases'],
    queryFn: () => spiritualGuidanceService.getSpiritualDiseases(),
  });

  const { data: handbookContent, isLoading: handbookLoading } = useQuery({
    queryKey: ['handbook-content'],
    queryFn: () => spiritualGuidanceService.getHandbookContent(),
  });

  const { data: analytics } = useQuery({
    queryKey: ['spiritual-analytics'],
    queryFn: () => spiritualGuidanceService.getAnalytics(),
  });

  const { data: healthStatus } = useQuery({
    queryKey: ['spiritual-health'],
    queryFn: () => spiritualGuidanceService.getHealthStatus(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mutations
  const createDiseaseMutation = useMutation({
    mutationFn: (data: any) => spiritualGuidanceService.createSpiritualDisease(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spiritual-diseases'] });
      setDiseaseModalVisible(false);
      diseaseForm.resetFields();
      message.success('Spiritual disease created successfully');
    },
    onError: (error: any) => {
      message.error(`Failed to create disease: ${error.message}`);
    },
  });

  const updateDiseaseMutation = useMutation({
    mutationFn: ({ name, data }: { name: string; data: any }) =>
      spiritualGuidanceService.updateSpiritualDisease(name, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spiritual-diseases'] });
      setDiseaseModalVisible(false);
      diseaseForm.resetFields();
      setSelectedDisease(null);
      message.success('Spiritual disease updated successfully');
    },
    onError: (error: any) => {
      message.error(`Failed to update disease: ${error.message}`);
    },
  });

  const deleteDiseaseMutation = useMutation({
    mutationFn: (name: string) => spiritualGuidanceService.deleteSpiritualDisease(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spiritual-diseases'] });
      message.success('Spiritual disease deleted successfully');
    },
    onError: (error: any) => {
      message.error(`Failed to delete disease: ${error.message}`);
    },
  });

  const testGuidanceMutation = useMutation({
    mutationFn: (data: any) => spiritualGuidanceService.testGuidance(data),
    onSuccess: (result) => {
      setTestResult(result);
      message.success('Test completed successfully');
    },
    onError: (error: any) => {
      message.error(`Test failed: ${error.message}`);
    },
  });

  // Handlers
  const handleCreateDisease = (values: any) => {
    const diseaseData = {
      ...values,
      emotionalTriggers: values.emotionalTriggers?.split(',').map((t: string) => t.trim()) || [],
      directQuotes: values.directQuotes || [],
      quranicEvidence: values.quranicEvidence || [],
      hadithEvidence: values.hadithEvidence || [],
    };

    if (selectedDisease) {
      updateDiseaseMutation.mutate({ name: selectedDisease.name, data: diseaseData });
    } else {
      createDiseaseMutation.mutate(diseaseData);
    }
  };

  const handleEditDisease = (disease: any) => {
    setSelectedDisease(disease);
    diseaseForm.setFieldsValue({
      ...disease,
      emotionalTriggers: disease.emotionalTriggers?.join(', ') || '',
    });
    setDiseaseModalVisible(true);
  };

  const handleDeleteDisease = (name: string) => {
    Modal.confirm({
      title: 'Delete Spiritual Disease',
      content: `Are you sure you want to delete "${name}"?`,
      onOk: () => deleteDiseaseMutation.mutate(name),
    });
  };

  const handleTestGuidance = (values: any) => {
    testGuidanceMutation.mutate({
      message: values.message,
      conversationHistory: values.conversationHistory
        ? values.conversationHistory.split('\n').filter((line: string) => line.trim())
        : [],
    });
  };

  // Spiritual Diseases Columns
  const diseaseColumns = [
    {
      title: 'Disease Name',
      key: 'name',
      render: (record: any) => (
        <div>
          <Text strong>{record.name}</Text>
          <br />
          <Text type="secondary">{record.arabicName}</Text>
        </div>
      ),
    },
    {
      title: 'Page Range',
      dataIndex: 'pageRange',
      key: 'pageRange',
      render: (pageRange: string) => <Tag color="blue">{pageRange}</Tag>,
    },
    {
      title: 'Triggers',
      dataIndex: 'emotionalTriggers',
      key: 'emotionalTriggers',
      render: (triggers: string[]) => (
        <div>
          {triggers?.slice(0, 3).map(trigger => (
            <Tag key={trigger} color="orange" style={{ marginBottom: 4 }}>
              {trigger}
            </Tag>
          ))}
          {triggers?.length > 3 && <Text type="secondary">+{triggers.length - 3} more</Text>}
        </div>
      ),
    },
    {
      title: 'Citations',
      key: 'citations',
      render: (record: any) => (
        <Statistic
          value={record.directQuotes?.length || 0}
          suffix="quotes"
          valueStyle={{ fontSize: 14 }}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space>
          <Tooltip title="Edit Disease">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditDisease(record)}
            />
          </Tooltip>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                Modal.info({
                  title: record.name,
                  width: 800,
                  content: (
                    <div>
                      <Divider />
                      <Row gutter={16}>
                        <Col span={12}>
                          <Text strong>Arabic Name:</Text> {record.arabicName}
                        </Col>
                        <Col span={12}>
                          <Text strong>Pages:</Text> {record.pageRange}
                        </Col>
                      </Row>
                      <Divider />
                      <Text strong>Emotional Triggers:</Text>
                      <div style={{ marginTop: 8 }}>
                        {record.emotionalTriggers?.map((trigger: string) => (
                          <Tag key={trigger} color="orange">{trigger}</Tag>
                        ))}
                      </div>
                      <Divider />
                      <Text strong>Direct Quotes ({record.directQuotes?.length || 0}):</Text>
                      <List
                        size="small"
                        dataSource={record.directQuotes || []}
                        renderItem={(quote: any) => (
                          <List.Item>
                            <Text>Page {quote.page}: "{quote.quote}"</Text>
                            <Tag color="green">{quote.context}</Tag>
                          </List.Item>
                        )}
                      />
                    </div>
                  ),
                });
              }}
            />
          </Tooltip>
          <Tooltip title="Delete Disease">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteDisease(record.name)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <BookOutlined style={{ marginRight: 8 }} />
          Spiritual Guidance Training
        </Title>
        <Text type="secondary">
          Manage spiritual diseases, handbook content, and training data for the AI guidance system
        </Text>
      </div>

      {/* Health Status Alert */}
      {healthStatus && (
        <Alert
          message="System Health Status"
          description={
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="Status"
                  value={healthStatus.status}
                  valueStyle={{ color: healthStatus.status === 'healthy' ? '#3f8600' : '#cf1322' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Diseases Loaded"
                  value={healthStatus.spiritualDiseasesLoaded}
                />
              </Col>
              <Col span={12}>
                <Space>
                  {Object.entries(healthStatus.features || {}).map(([feature, enabled]) => (
                    <Tag
                      key={feature}
                      color={enabled ? 'green' : 'red'}
                      style={{ marginBottom: 4 }}
                    >
                      {feature.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </Tag>
                  ))}
                </Space>
              </Col>
            </Row>
          }
          type={healthStatus.status === 'healthy' ? 'success' : 'error'}
          style={{ marginBottom: 24 }}
        />
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* Spiritual Diseases Tab */}
        <TabPane tab={<span><HeartOutlined />Spiritual Diseases</span>} key="diseases">
          <Card
            title="Spiritual Diseases Management"
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setSelectedDisease(null);
                  diseaseForm.resetFields();
                  setDiseaseModalVisible(true);
                }}
              >
                Add Disease
              </Button>
            }
          >
            <Table
              columns={diseaseColumns}
              dataSource={diseases || []}
              loading={diseasesLoading}
              rowKey="name"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        {/* Handbook Content Tab */}
        <TabPane tab={<span><FileTextOutlined />Handbook Content</span>} key="handbook">
          <Card
            title="Handbook Content Management"
            extra={
              <Space>
                <Upload
                  accept=".json,.xlsx,.csv"
                  showUploadList={false}
                  customRequest={async ({ file }) => {
                    try {
                      const result = await spiritualGuidanceService.importHandbookContent(file as File);
                      message.success(`Imported ${result.success} items with ${result.errors.length} errors`);
                      queryClient.invalidateQueries({ queryKey: ['handbook-content'] });
                    } catch (error: any) {
                      message.error(`Import failed: ${error.message}`);
                    }
                  }}
                >
                  <Button icon={<UploadOutlined />}>Import Content</Button>
                </Upload>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={async () => {
                    try {
                      const blob = await spiritualGuidanceService.exportTrainingData('xlsx');
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'spiritual-guidance-training.xlsx';
                      a.click();
                    } catch (error: any) {
                      message.error(`Export failed: ${error.message}`);
                    }
                  }}
                >
                  Export Data
                </Button>
              </Space>
            }
          >
            <Table
              dataSource={handbookContent || []}
              loading={handbookLoading}
              rowKey="id"
              columns={[
                {
                  title: 'Title',
                  dataIndex: 'title',
                  key: 'title',
                  render: (title: string, record: any) => (
                    <div>
                      <Text strong>{title}</Text>
                      {record.arabicTitle && (
                        <>
                          <br />
                          <Text type="secondary">{record.arabicTitle}</Text>
                        </>
                      )}
                    </div>
                  ),
                },
                {
                  title: 'Chapter',
                  dataIndex: 'chapter',
                  key: 'chapter',
                },
                {
                  title: 'Pages',
                  key: 'pages',
                  render: (record: any) => `${record.pageStart}-${record.pageEnd}`,
                },
                {
                  title: 'Diseases',
                  dataIndex: 'spiritualDiseases',
                  key: 'spiritualDiseases',
                  render: (diseases: string[]) => (
                    <div>
                      {diseases?.map(disease => (
                        <Tag key={disease} color="purple">{disease}</Tag>
                      ))}
                    </div>
                  ),
                },
                {
                  title: 'Status',
                  key: 'status',
                  render: () => <Tag color="green">Active</Tag>,
                },
              ]}
              pagination={{ pageSize: 8 }}
            />
          </Card>
        </TabPane>

        {/* Analytics Tab */}
        <TabPane tab={<span><BarChartOutlined />Analytics</span>} key="analytics">
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Total Citations"
                  value={analytics?.totalCitations || 0}
                  prefix={<BookOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Average Quality Score"
                  value={analytics?.qualityScores.average || 0}
                  precision={2}
                  suffix="%"
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Response Time"
                  value={analytics?.responseTime || 0}
                  precision={1}
                  suffix="s"
                  prefix={<BookOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Perfect Matches"
                  value={analytics?.citationsByLevel['perfect_match'] || 0}
                  prefix={<HeartOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card title="Citation Levels Distribution">
                {analytics?.citationsByLevel && Object.entries(analytics.citationsByLevel).map(([level, count]) => (
                  <div key={level} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>{level.replace('_', ' ')}</Text>
                      <Text strong>{count}</Text>
                    </div>
                    <Progress
                      percent={(count / Object.values(analytics.citationsByLevel).reduce((a, b) => a + b, 0)) * 100}
                      size="small"
                      strokeColor={
                        level === 'perfect_match' ? '#722ed1' :
                        level === 'related_theme' ? '#1890ff' :
                        level === 'general_guidance' ? '#52c41a' : '#faad14'
                      }
                    />
                  </div>
                ))}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Popular Spiritual Diseases">
                <List
                  dataSource={analytics?.popularDiseases || []}
                  renderItem={(item, index) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Badge count={index + 1} style={{ backgroundColor: '#722ed1' }} />}
                        title={item.name}
                        description={`${item.count} requests`}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>

        {/* Testing Tab */}
        <TabPane tab={<span><PlayCircleOutlined />Testing</span>} key="testing">
          <Row gutter={16}>
            <Col span={12}>
              <Card
                title="Test Spiritual Guidance"
                extra={
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => setTestDrawerVisible(true)}
                  >
                    Open Test Console
                  </Button>
                }
              >
                <Form
                  form={testForm}
                  layout="vertical"
                  onFinish={handleTestGuidance}
                >
                  <Form.Item
                    label="Test Message"
                    name="message"
                    rules={[{ required: true, message: 'Please enter a test message' }]}
                  >
                    <TextArea
                      rows={4}
                      placeholder="Enter a message to test spiritual guidance (e.g., 'I'm feeling angry with my coworkers')"
                    />
                  </Form.Item>

                  <Form.Item
                    label="Conversation History (Optional)"
                    name="conversationHistory"
                  >
                    <TextArea
                      rows={3}
                      placeholder="Enter previous messages, one per line"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Space>
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={testGuidanceMutation.isPending}
                        icon={<PlayCircleOutlined />}
                      >
                        Test Guidance
                      </Button>
                      <Button onClick={() => testForm.resetFields()}>
                        Clear
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>

                {testResult && (
                  <Card
                    size="small"
                    title="Test Result"
                    style={{ marginTop: 16 }}
                    extra={
                      <Tag color={
                        testResult.citationLevel === 'perfect_match' ? 'purple' :
                        testResult.citationLevel === 'related_theme' ? 'blue' :
                        testResult.citationLevel === 'general_guidance' ? 'green' : 'orange'
                      }>
                        {testResult.citationLevel?.replace('_', ' ')}
                      </Tag>
                    }
                  >
                    <div style={{ marginBottom: 12 }}>
                      <Text strong>Response:</Text>
                      <div style={{
                        background: '#fafafa',
                        padding: 12,
                        borderRadius: 6,
                        marginTop: 8,
                        whiteSpace: 'pre-wrap'
                      }}>
                        {testResult.response}
                      </div>
                    </div>

                    {testResult.citations && testResult.citations.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong>Citations ({testResult.citations.length}):</Text>
                        <List
                          size="small"
                          dataSource={testResult.citations}
                          renderItem={(citation: any) => (
                            <List.Item>
                              <Text>Page {citation.page}: "{citation.quote}"</Text>
                              <Tag color="blue">{citation.context}</Tag>
                            </List.Item>
                          )}
                        />
                      </div>
                    )}

                    {testResult.metadata?.qualityScore && (
                      <div>
                        <Text strong>Quality Score: </Text>
                        <Progress
                          percent={Math.round(testResult.metadata.qualityScore * 100)}
                          size="small"
                          status={testResult.metadata.qualityScore > 0.8 ? 'success' :
                                 testResult.metadata.qualityScore > 0.6 ? 'normal' : 'exception'}
                          style={{ width: 200, display: 'inline-block', marginLeft: 8 }}
                        />
                      </div>
                    )}
                  </Card>
                )}
              </Card>
            </Col>

            <Col span={12}>
              <Card title="Quick Test Scenarios">
                <List
                  dataSource={[
                    {
                      title: "Anger Test",
                      message: "I'm so frustrated with my coworkers. They never listen to me and I feel like exploding every day at work.",
                      expectedLevel: "perfect_match"
                    },
                    {
                      title: "Envy Test",
                      message: "Everyone on social media seems to have perfect lives. I see their vacations, new cars, and promotions, and I feel so jealous.",
                      expectedLevel: "perfect_match"
                    },
                    {
                      title: "Spiritual Emptiness",
                      message: "I feel so disconnected from everything. Prayer doesn't mean anything to me anymore, and I feel like my heart has become stone.",
                      expectedLevel: "perfect_match"
                    },
                    {
                      title: "General Question",
                      message: "Life has been really difficult lately. I'm trying to stay positive but it's hard.",
                      expectedLevel: "general_guidance"
                    }
                  ]}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button
                          size="small"
                          onClick={() => {
                            testForm.setFieldsValue({ message: item.message });
                            handleTestGuidance({ message: item.message });
                          }}
                        >
                          Test
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        title={item.title}
                        description={
                          <div>
                            <Text ellipsis style={{ width: 300 }}>{item.message}</Text>
                            <br />
                            <Tag color="blue">Expected: {item.expectedLevel}</Tag>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>

      {/* Disease Modal */}
      <Modal
        title={selectedDisease ? 'Edit Spiritual Disease' : 'Create Spiritual Disease'}
        open={diseaseModalVisible}
        onCancel={() => {
          setDiseaseModalVisible(false);
          setSelectedDisease(null);
          diseaseForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={diseaseForm}
          layout="vertical"
          onFinish={handleCreateDisease}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Disease Name"
                name="name"
                rules={[{ required: true, message: 'Please enter disease name' }]}
              >
                <Input placeholder="e.g., Anger" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Arabic Name"
                name="arabicName"
                rules={[{ required: true, message: 'Please enter Arabic name' }]}
              >
                <Input placeholder="e.g., الغضب" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Page Range"
            name="pageRange"
            rules={[{ required: true, message: 'Please enter page range' }]}
          >
            <Input placeholder="e.g., 30-42" />
          </Form.Item>

          <Form.Item
            label="Emotional Triggers (comma-separated)"
            name="emotionalTriggers"
            rules={[{ required: true, message: 'Please enter emotional triggers' }]}
          >
            <TextArea
              rows={3}
              placeholder="e.g., frustrated, angry, mad, furious, rage, annoyed, irritated"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createDiseaseMutation.isPending || updateDiseaseMutation.isPending}
              >
                {selectedDisease ? 'Update' : 'Create'} Disease
              </Button>
              <Button onClick={() => {
                setDiseaseModalVisible(false);
                setSelectedDisease(null);
                diseaseForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Test Drawer */}
      <Drawer
        title="Spiritual Guidance Test Console"
        width={600}
        open={testDrawerVisible}
        onClose={() => setTestDrawerVisible(false)}
      >
        <div>
          <Alert
            message="Test Console"
            description="Use this console to test different scenarios and validate the spiritual guidance system responses."
            type="info"
            style={{ marginBottom: 16 }}
          />

          {/* Test console content would go here */}
          <Text>Advanced testing features coming soon...</Text>
        </div>
      </Drawer>
    </div>
  );
}