import { useState } from 'react';
import { Card, Row, Col, Select, DatePicker, Space, Statistic, Table } from 'antd';
import { Line, Column, Pie, Area } from '@ant-design/charts';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analytics';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  UserOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { RangePicker } = DatePicker;
const { Option } = Select;

export default function Analytics() {
  const [dateRange, setDateRange] = useState<any>(null);
  const [metric, setMetric] = useState('conversations');

  const { data: analytics } = useQuery({
    queryKey: ['analytics', dateRange, metric],
    queryFn: () => analyticsService.getAnalytics({ dateRange, metric }),
  });

  const responseTimeConfig = {
    data: analytics?.responseTime || [],
    xField: 'date',
    yField: 'avgTime',
    smooth: true,
    height: 300,
    yAxis: {
      label: {
        formatter: (v: string) => `${v}ms`,
      },
    },
    annotations: [
      {
        type: 'line',
        start: ['min', 5000],
        end: ['max', 5000],
        style: {
          stroke: '#ff4d4f',
          lineDash: [2, 2],
        },
      },
    ],
  };

  const emotionDistributionConfig = {
    data: analytics?.emotionDistribution || [],
    angleField: 'count',
    colorField: 'emotion',
    radius: 0.8,
    height: 300,
    label: {
      type: 'outer',
      content: '{name} {percentage}',
    },
  };

  const hourlyActivityConfig = {
    data: analytics?.hourlyActivity || [],
    xField: 'hour',
    yField: 'count',
    height: 300,
    columnStyle: {
      radius: [8, 8, 0, 0],
    },
  };

  const confidenceScoreConfig = {
    data: analytics?.confidenceScore || [],
    xField: 'date',
    yField: 'confidence',
    height: 300,
    areaStyle: {
      fill: 'l(270) 0:#ffffff 0.5:#7ec2f3 1:#1890ff',
    },
  };

  const topQuestions = [
    { question: 'How to improve business strategy?', count: 245, trend: 'up' },
    { question: 'What is machine learning?', count: 189, trend: 'up' },
    { question: 'Best practices for remote work', count: 156, trend: 'down' },
    { question: 'How to write professional emails?', count: 134, trend: 'up' },
    { question: 'Marketing tips for startups', count: 98, trend: 'down' },
  ];

  return (
    <div>
      <Card
        title="Analytics Dashboard"
        extra={
          <Space>
            <Select
              value={metric}
              onChange={setMetric}
              style={{ width: 150 }}
            >
              <Option value="conversations">Conversations</Option>
              <Option value="users">Users</Option>
              <Option value="documents">Documents</Option>
            </Select>
            <RangePicker onChange={setDateRange} />
          </Space>
        }
      >
        {/* Key Metrics */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Conversations"
                value={analytics?.totalConversations || 0}
                prefix={<MessageOutlined />}
                valueStyle={{ color: '#3b82f6' }}
                suffix={
                  <span style={{ fontSize: 14, color: '#52c41a' }}>
                    <ArrowUpOutlined /> 23%
                  </span>
                }
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Unique Users"
                value={analytics?.uniqueUsers || 0}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Avg Response Time"
                value={analytics?.avgResponseTime || 0}
                suffix="ms"
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: analytics?.avgResponseTime > 5000 ? '#ff4d4f' : '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Success Rate"
                value={analytics?.successRate || 0}
                suffix="%"
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Charts */}
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={24} lg={12}>
            <Card title="Response Time Trend">
              <Line {...responseTimeConfig} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Emotion Distribution">
              <Pie {...emotionDistributionConfig} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card title="Hourly Activity">
              <Column {...hourlyActivityConfig} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Average Confidence Score">
              <Area {...confidenceScoreConfig} />
            </Card>
          </Col>
        </Row>

        {/* Top Questions Table */}
        <Card title="Top Questions" style={{ marginTop: 16 }}>
          <Table
            dataSource={topQuestions}
            pagination={false}
            columns={[
              {
                title: 'Question',
                dataIndex: 'question',
                key: 'question',
              },
              {
                title: 'Count',
                dataIndex: 'count',
                key: 'count',
                width: 100,
              },
              {
                title: 'Trend',
                dataIndex: 'trend',
                key: 'trend',
                width: 100,
                render: (trend: string) => (
                  <span style={{ color: trend === 'up' ? '#52c41a' : '#ff4d4f' }}>
                    {trend === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      </Card>
    </div>
  );
}