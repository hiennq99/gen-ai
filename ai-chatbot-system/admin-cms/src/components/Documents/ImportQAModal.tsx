import { useState } from 'react';
import { Modal, Form, Input, Button, Upload, Table, Space, message } from 'antd';
import { UploadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { documentsService } from '@/services/documents';

const { TextArea } = Input;

interface ImportQAModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportQAModal({ visible, onClose, onSuccess }: ImportQAModalProps) {
  const [form] = Form.useForm();
  const [qaData, setQaData] = useState<Array<{ question: string; answer: string }>>([]);

  const importMutation = useMutation({
    mutationFn: documentsService.importQA,
    onSuccess: () => {
      message.success('Q&A pairs imported successfully');
      onSuccess();
      onClose();
      form.resetFields();
      setQaData([]);
    },
    onError: () => {
      message.error('Failed to import Q&A pairs');
    },
  });

  const handleAddQA = () => {
    form.validateFields().then((values) => {
      setQaData([...qaData, values]);
      form.resetFields();
    });
  };

  const handleRemoveQA = (index: number) => {
    setQaData(qaData.filter((_, i) => i !== index));
  };

  const handleImport = () => {
    if (qaData.length === 0) {
      message.warning('Please add at least one Q&A pair');
      return;
    }
    importMutation.mutate(qaData);
  };

  const handleFileUpload = (file: any) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (Array.isArray(json)) {
          setQaData(json);
          message.success(`Loaded ${json.length} Q&A pairs from file`);
        } else {
          message.error('Invalid JSON format');
        }
      } catch {
        message.error('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    return false;
  };

  const columns = [
    {
      title: 'Question',
      dataIndex: 'question',
      key: 'question',
      ellipsis: true,
    },
    {
      title: 'Answer',
      dataIndex: 'answer',
      key: 'answer',
      ellipsis: true,
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      render: (_: any, __: any, index: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveQA(index)}
        />
      ),
    },
  ];

  return (
    <Modal
      title="Import Q&A Pairs"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="import"
          type="primary"
          loading={importMutation.isPending}
          onClick={handleImport}
        >
          Import {qaData.length} Q&A Pairs
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Upload
          accept=".json"
          beforeUpload={handleFileUpload}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />}>Upload JSON File</Button>
        </Upload>

        <Form form={form} layout="vertical">
          <Form.Item
            label="Question"
            name="question"
            rules={[{ required: true, message: 'Please enter a question' }]}
          >
            <Input placeholder="Enter question" />
          </Form.Item>

          <Form.Item
            label="Answer"
            name="answer"
            rules={[{ required: true, message: 'Please enter an answer' }]}
          >
            <TextArea rows={3} placeholder="Enter answer" />
          </Form.Item>

          <Form.Item>
            <Button
              type="dashed"
              onClick={handleAddQA}
              icon={<PlusOutlined />}
              block
            >
              Add Q&A Pair
            </Button>
          </Form.Item>
        </Form>

        {qaData.length > 0 && (
          <Table
            columns={columns}
            dataSource={qaData}
            rowKey={(_, index) => index!.toString()}
            pagination={false}
            size="small"
            scroll={{ y: 300 }}
          />
        )}
      </Space>
    </Modal>
  );
}