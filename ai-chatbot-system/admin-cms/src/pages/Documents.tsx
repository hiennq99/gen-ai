import { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Upload,
  message,
  Input,
  Dropdown,
  Progress,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  EyeOutlined,
  DownloadOutlined,
  SearchOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsService } from '@/services/documents';
import ImportQAModal from '@/components/Documents/ImportQAModal';

const { Dragger } = Upload;
const { Search } = Input;

export default function Documents() {
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [importQAModalVisible, setImportQAModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', searchText],
    queryFn: () => {
      const params = searchText ? { search: searchText } : {};
      return documentsService.getDocuments(params);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: documentsService.uploadDocument,
    onSuccess: () => {
      message.success('Document uploaded successfully');
      setUploadModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: () => {
      message.error('Failed to upload document');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: documentsService.deleteDocument,
    onSuccess: () => {
      message.success('Document deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const handleBulkDelete = async () => {
    Modal.confirm({
      title: 'Delete Selected Documents',
      content: `Are you sure you want to delete ${selectedRowKeys.length} selected document(s)?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          // Delete each selected document
          for (const id of selectedRowKeys) {
            await documentsService.deleteDocument(id);
          }
          message.success(`Successfully deleted ${selectedRowKeys.length} document(s)`);
          setSelectedRowKeys([]);
          queryClient.invalidateQueries({ queryKey: ['documents'] });
        } catch {
          message.error('Failed to delete some documents');
        }
      },
    });
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys as string[]);
    },
    getCheckboxProps: (record: any) => ({
      disabled: record.status === 'processing',
    }),
  };

  const hasSelected = selectedRowKeys.length > 0;

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FilePdfOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />;
      case 'docx':
        return <FileWordOutlined style={{ fontSize: 20, color: '#1890ff' }} />;
      default:
        return <FileTextOutlined style={{ fontSize: 20, color: '#52c41a' }} />;
    }
  };

  const columns = [
    {
      title: 'File',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: any) => (
        <Space>
          {getFileIcon(record.type)}
          <span>{title}</span>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => <Tag>{type.toUpperCase()}</Tag>,
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => `${(size / 1024).toFixed(2)} KB`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: string) => {
        const statusConfig: Record<string, { color: string; text: string }> = {
          processed: { color: 'success', text: 'Processed' },
          completed: { color: 'success', text: 'Processed' }, // backward compatibility
          processing: { color: 'processing', text: 'Processing' },
          failed: { color: 'error', text: 'Failed' },
          pending: { color: 'default', text: 'Pending' },
        };
        const config = statusConfig[status] || statusConfig.pending;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Chunks',
      dataIndex: 'chunks',
      key: 'chunks',
      width: 100,
      render: (chunks: number) => chunks || 0,
    },
    {
      title: 'Uploaded',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: any) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'view',
                icon: <EyeOutlined />,
                label: 'View',
              },
              {
                key: 'download',
                icon: <DownloadOutlined />,
                label: 'Download',
              },
              {
                type: 'divider',
              },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: 'Delete',
                danger: true,
                onClick: () => {
                  Modal.confirm({
                    title: 'Delete Document',
                    content: 'Are you sure you want to delete this document?',
                    onOk: () => deleteMutation.mutate(record.id),
                  });
                },
              },
            ],
          }}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.pdf,.docx,.txt,.json',
    beforeUpload: (file: any) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);
      uploadMutation.mutate(formData);
      return false;
    },
  };

  return (
    <div>
      <Card
        title="Documents Management"
        extra={
          <Space>
            <Search
              placeholder="Search documents"
              onSearch={setSearchText}
              style={{ width: 200 }}
              prefix={<SearchOutlined />}
            />
            <Button
              type="default"
              icon={<FileTextOutlined />}
              onClick={() => setImportQAModalVisible(true)}
            >
              Import Q&A
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              Upload Document
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button
              size="small"
              onClick={() => {
                if (documents && documents.length > 0) {
                  const allKeys = documents.map((doc: any) => doc.id);
                  setSelectedRowKeys(allKeys);
                }
              }}
              disabled={!documents || documents.length === 0}
            >
              Select All
            </Button>
            {hasSelected && (
              <>
                <Tag color="blue">
                  {selectedRowKeys.length} of {documents?.length || 0} selected
                </Tag>
                <Button
                  size="small"
                  onClick={() => setSelectedRowKeys([])}
                >
                  Clear Selection
                </Button>
              </>
            )}
          </Space>
          {hasSelected && (
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              onClick={handleBulkDelete}
            >
              Delete Selected ({selectedRowKeys.length})
            </Button>
          )}
        </div>
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={documents}
          loading={isLoading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} documents`,
          }}
        />
      </Card>

      <Modal
        title="Upload Document"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
        width={600}
      >
        <Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: 48, color: '#3b82f6' }} />
          </p>
          <p className="ant-upload-text">Click or drag file to upload</p>
          <p className="ant-upload-hint">
            Support PDF, DOCX, TXT, JSON files. Max size: 10MB
          </p>
        </Dragger>
        {uploadMutation.isPending && (
          <div style={{ marginTop: 16 }}>
            <Progress percent={50} status="active" />
            <p style={{ textAlign: 'center', marginTop: 8 }}>Processing document...</p>
          </div>
        )}
      </Modal>

      <ImportQAModal
        visible={importQAModalVisible}
        onClose={() => setImportQAModalVisible(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['documents'] });
        }}
      />
    </div>
  );
}