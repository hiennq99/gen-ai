import { Row, Col, Card, Statistic, Progress, Table, Tag } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  MessageOutlined,
  RiseOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { Line, Pie } from '@ant-design/charts';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardService.getStats,
  });

  const lineConfig = {
    data: stats?.dailyChats || [],
    xField: 'date',
    yField: 'count',
    smooth: true,
    height: 300,
  };

  const pieConfig = {
    data: stats?.emotionDistribution || [],
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    height: 300,
    label: {
      type: 'outer',
    },
  };

  const recentConversations = [
    {
      key: '1',
      user: 'User 123',
      message: 'How can I improve my business?',
      emotion: 'neutral',
      confidence: 85,
      time: '2 mins ago',
      status: 'completed',
    },
    {
      key: '2',
      user: 'User 456',
      message: 'I need help with marketing',
      emotion: 'confused',
      confidence: 72,
      time: '5 mins ago',
      status: 'processing',
    },
  ];

  const columns = [
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: 'Emotion',
      dataIndex: 'emotion',
      key: 'emotion',
      render: (emotion: string) => {
        const colors: Record<string, string> = {
          happy: 'green',
          sad: 'blue',
          angry: 'red',
          neutral: 'default',
          confused: 'orange',
        };
        return <Tag color={colors[emotion] || 'default'}>{emotion}</Tag>;
      },
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      render: (confidence: number) => (
        <Progress percent={confidence} size="small" style={{ width: 60 }} />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag icon={status === 'completed' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}>
          {status}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Dashboard</h1>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Conversations"
              value={stats?.totalConversations || 0}
              prefix={<MessageOutlined />}
              suffix={
                <span style={{ fontSize: 14, color: '#52c41a' }}>
                  <RiseOutlined /> 12%
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Users"
              value={stats?.activeUsers || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Documents"
              value={stats?.totalDocuments || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Avg Response Time"
              value={stats?.avgResponseTime || 0}
              suffix="ms"
              precision={0}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Daily Conversations">
            <Line {...lineConfig} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Emotion Distribution">
            <Pie {...pieConfig} />
          </Card>
        </Col>
      </Row>

      <Card title="Recent Conversations" style={{ marginTop: 24 }}>
        <Table
          columns={columns}
          dataSource={recentConversations}
          pagination={false}
          loading={isLoading}
        />
      </Card>
    </div>
  );
}