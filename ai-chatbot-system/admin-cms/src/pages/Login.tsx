import { Card, Form, Input, Button, Typography, Space, message } from 'antd';
import { UserOutlined, LockOutlined, RobotOutlined } from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';

const { Title, Text } = Typography;

export default function Login() {
  const { login } = useAuth();
  const [form] = Form.useForm();

  const handleLogin = async (values: any) => {
    try {
      await login(values.username, values.password);
      message.success('Login successful');
      // Force a page reload to update authentication state
      window.location.href = '/dashboard';
    } catch {
      message.error('Invalid credentials');
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{ width: 400, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }} size="large">
          <div>
            <RobotOutlined style={{ fontSize: 48, color: '#3b82f6' }} />
            <Title level={2} style={{ marginTop: 16 }}>AI Chatbot Admin</Title>
            <Text type="secondary">Sign in to manage your AI assistant</Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleLogin}
            initialValues={{
              username: 'admin',
              password: 'admin123',
            }}
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Please enter your username' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Username"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Password"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" size="large" block>
                Sign In
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Default credentials: admin / admin123
          </Text>
        </Space>
      </Card>
    </div>
  );
}