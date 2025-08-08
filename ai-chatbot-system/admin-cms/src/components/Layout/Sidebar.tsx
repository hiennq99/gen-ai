import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  MessageOutlined,
  BarChartOutlined,
  SettingOutlined,
  RobotOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

interface SidebarProps {
  collapsed: boolean;
}

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: '/documents',
    icon: <FileTextOutlined />,
    label: 'Documents',
  },
  {
    key: '/training',
    icon: <ExperimentOutlined />,
    label: 'Training',
  },
  {
    key: '/conversations',
    icon: <MessageOutlined />,
    label: 'Conversations',
  },
  {
    key: '/analytics',
    icon: <BarChartOutlined />,
    label: 'Analytics',
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: 'Settings',
  },
];

export default function Sidebar({ collapsed }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Sider trigger={null} collapsible collapsed={collapsed}>
      <div className="logo">
        <RobotOutlined style={{ fontSize: 20, marginRight: collapsed ? 0 : 8 }} />
        {!collapsed && <span>AI Admin</span>}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  );
}