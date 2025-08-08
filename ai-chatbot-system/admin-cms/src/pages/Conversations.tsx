import { useState } from 'react';
import {
  Card,
  Table,
  Input,
  DatePicker,
  Select,
  Space,
  Tag,
  Button,
  Drawer,
  Timeline,
  Avatar,
  Typography,
  Rate,
} from 'antd';
import {
  SearchOutlined,
  UserOutlined,
  RobotOutlined,
  ExportOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { conversationsService } from '@/services/conversations';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text, Paragraph } = Typography;

export default function Conversations() {
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    emotion: '',
    dateRange: null,
  });

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => conversationsService.getConversations(filters),
  });

  const columns = [
    {
      title: 'Session ID',
      dataIndex: 'sessionId',
      key: 'sessionId',
      width: 120,
      render: (id: string) => <code>{id.substring(0, 8)}</code>,
    },
    {
      title: 'User',
      dataIndex: 'userId',
      key: 'userId',
      render: (userId: string) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          {userId}
        </Space>
      ),
    },
    {
      title: 'Messages',
      dataIndex: 'messageCount',
      key: 'messageCount',
      width: 100,
    },
    {
      title: 'Dominant Emotion',
      dataIndex: 'dominantEmotion',
      key: 'dominantEmotion',
      render: (emotion: string) => {
        const colors: Record<string, string> = {
          happy: 'green',
          sad: 'blue',
          angry: 'red',
          neutral: 'default',
          confused: 'orange',
          grateful: 'pink',
        };
        return <Tag color={colors[emotion] || 'default'}>{emotion}</Tag>;
      },
    },
    {
      title: 'Avg Confidence',
      dataIndex: 'avgConfidence',
      key: 'avgConfidence',
      render: (confidence: number) => `${confidence}%`,
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration: number) => `${Math.round(duration / 60)} min`,
    },
    {
      title: 'Started At',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      render: (rating: number) => rating ? <Rate disabled defaultValue={rating} /> : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button
          type="link"
          onClick={() => {
            setSelectedConversation(record);
            setDrawerVisible(true);
          }}
        >
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="Conversations"
        extra={
          <Button icon={<ExportOutlined />}>
            Export
          </Button>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Search conversations"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <Select
            placeholder="Filter by emotion"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => setFilters({ ...filters, emotion: value })}
          >
            <Option value="happy">Happy</Option>
            <Option value="sad">Sad</Option>
            <Option value="angry">Angry</Option>
            <Option value="neutral">Neutral</Option>
            <Option value="confused">Confused</Option>
          </Select>
          <RangePicker
            onChange={(dates: any) => setFilters({ ...filters, dateRange: dates })}
          />
          <Button icon={<FilterOutlined />}>
            More Filters
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={conversations}
          loading={isLoading}
          rowKey="sessionId"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} conversations`,
          }}
        />
      </Card>

      <Drawer
        title="Conversation Details"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={600}
      >
        {selectedConversation && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>Session ID:</Text>
                <code>{selectedConversation.sessionId}</code>
                <Text strong>User ID:</Text>
                <Text>{selectedConversation.userId}</Text>
                <Text strong>Duration:</Text>
                <Text>{Math.round(selectedConversation.duration / 60)} minutes</Text>
                <Text strong>Total Messages:</Text>
                <Text>{selectedConversation.messageCount}</Text>
              </Space>
            </Card>

            <Timeline>
              {selectedConversation.messages?.map((msg: any, index: number) => (
                <Timeline.Item
                  key={index}
                  dot={
                    msg.role === 'user' ? (
                      <Avatar size="small" icon={<UserOutlined />} />
                    ) : (
                      <Avatar
                        size="small"
                        icon={<RobotOutlined />}
                        style={{ backgroundColor: '#3b82f6' }}
                      />
                    )
                  }
                >
                  <Card size="small">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <Text strong>{msg.role === 'user' ? 'User' : 'Assistant'}</Text>
                        <Text type="secondary">{new Date(msg.timestamp).toLocaleTimeString()}</Text>
                        {msg.emotion && (
                          <Tag color="blue">{msg.emotion}</Tag>
                        )}
                      </Space>
                      <Paragraph>{msg.content}</Paragraph>
                      {msg.confidence && (
                        <Text type="secondary">Confidence: {msg.confidence}%</Text>
                      )}
                    </Space>
                  </Card>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        )}
      </Drawer>
    </div>
  );
}