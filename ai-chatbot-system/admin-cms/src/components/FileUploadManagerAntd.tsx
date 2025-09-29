import React, { useState, useCallback } from 'react';
import {
  Card,
  Upload,
  Button,
  Progress,
  Alert,
  List,
  Tag,
  Divider,
  Space,
  Row,
  Col,
  Statistic,
  Typography,
  Modal,
  message,
  Descriptions,
  Badge,
} from 'antd';
import {
  InboxOutlined,
  CloudUploadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { UploadProps, UploadFile } from 'antd';
import { spiritualGuidanceService } from '../services/spiritualGuidance';

const { Dragger } = Upload;
const { Title, Text } = Typography;

interface ProcessedFile {
  uid: string;
  name: string;
  type: 'csv' | 'pdf';
  size: number;
  status: 'uploading' | 'done' | 'error';
  response?: any;
  uploadedAt: Date;
  stats?: {
    totalExamples?: number;
    importedPairs?: number;
    generatedQAPairs?: number;
    byCategory?: Record<string, number>;
    byEmotionalState?: Record<string, number>;
  };
}

const FileUploadManagerAntd: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [previewFile, setPreviewFile] = useState<ProcessedFile | null>(null);
  const [uploadStats, setUploadStats] = useState({
    totalFiles: 0,
    successfulUploads: 0,
    totalQAPairs: 0,
    totalPDFsProcessed: 0,
  });

  const getFileType = (file: UploadFile): 'csv' | 'pdf' => {
    const fileName = file.name?.toLowerCase() || '';
    return fileName.endsWith('.pdf') ? 'pdf' : 'csv';
  };

  const updateStats = useCallback((newFile: ProcessedFile) => {
    setUploadStats(prev => ({
      totalFiles: prev.totalFiles + 1,
      successfulUploads: prev.successfulUploads + (newFile.status === 'done' ? 1 : 0),
      totalQAPairs: prev.totalQAPairs + (newFile.stats?.importedPairs || newFile.stats?.generatedQAPairs || 0),
      totalPDFsProcessed: prev.totalPDFsProcessed + (newFile.type === 'pdf' && newFile.status === 'done' ? 1 : 0),
    }));
  }, []);

  const customUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    const uploadFile = file as File;
    const fileType = getFileType({ name: uploadFile.name } as UploadFile);

    setUploading(true);

    try {
      let result;
      if (fileType === 'csv') {
        result = await spiritualGuidanceService.uploadCSVData(uploadFile);
        message.success(`CSV uploaded successfully: ${result.data.importedPairs} Q&A pairs imported`);
      } else {
        result = await spiritualGuidanceService.uploadPDFDocument(uploadFile);
        message.success(`PDF uploaded successfully: ${result.data.generatedQAPairs} Q&A pairs generated`);
      }

      const processedFile: ProcessedFile = {
        uid: `${Date.now()}-${uploadFile.name}`,
        name: uploadFile.name,
        type: fileType,
        size: uploadFile.size,
        status: 'done',
        response: result,
        uploadedAt: new Date(),
        stats: result.data,
      };

      setProcessedFiles(prev => [processedFile, ...prev]);
      updateStats(processedFile);

      onSuccess?.(result);
    } catch (error: any) {
      message.error(`Upload failed: ${error.message}`);

      const processedFile: ProcessedFile = {
        uid: `${Date.now()}-${uploadFile.name}`,
        name: uploadFile.name,
        type: fileType,
        size: uploadFile.size,
        status: 'error',
        uploadedAt: new Date(),
      };

      setProcessedFiles(prev => [processedFile, ...prev]);
      updateStats(processedFile);

      onError?.(error);
    } finally {
      setUploading(false);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    customRequest: customUpload,
    accept: '.csv,.pdf',
    showUploadList: false,
    beforeUpload: (file) => {
      const isCSVOrPDF = file.type === 'text/csv' ||
                        file.type === 'application/pdf' ||
                        file.name.toLowerCase().endsWith('.csv') ||
                        file.name.toLowerCase().endsWith('.pdf');

      if (!isCSVOrPDF) {
        message.error('You can only upload CSV or PDF files!');
        return false;
      }

      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('File must be smaller than 10MB!');
        return false;
      }

      return true;
    },
    onChange: (info) => {
      setFileList(info.fileList);
    },
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'success';
      case 'error': return 'error';
      case 'uploading': return 'processing';
      default: return 'default';
    }
  };

  const removeFile = (uid: string) => {
    setProcessedFiles(prev => prev.filter(f => f.uid !== uid));
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Training Data Upload</Title>
      <Text type="secondary">
        Upload CSV files with Q&A pairs or PDF documents to enhance your AI training data.
        Files are automatically processed and added to your training dataset.
      </Text>

      {/* Upload Statistics */}
      <Row gutter={16} style={{ margin: '24px 0' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Files"
              value={uploadStats.totalFiles}
              prefix={<CloudUploadOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Successful Uploads"
              value={uploadStats.successfulUploads}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Q&A Pairs"
              value={uploadStats.totalQAPairs}
              prefix={<FileExcelOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="PDFs Processed"
              value={uploadStats.totalPDFsProcessed}
              prefix={<FilePdfOutlined style={{ color: '#ff4d4f' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Upload Area */}
      <Card title="Upload Files" style={{ marginBottom: 24 }}>
        <Dragger {...uploadProps} style={{ marginBottom: 16 }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Click or drag files to this area to upload</p>
          <p className="ant-upload-hint">
            Support for CSV and PDF files. Maximum file size: 10MB.
            CSV files should contain Q&A pairs, PDF documents will be processed for content extraction.
          </p>
        </Dragger>

        {uploading && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Progress type="circle" percent={75} status="active" />
            <div style={{ marginTop: 8 }}>
              <Text>Processing files...</Text>
            </div>
          </div>
        )}

        {/* Quick Upload Buttons */}
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Upload {...uploadProps} accept=".csv">
              <Button
                icon={<FileExcelOutlined />}
                size="large"
                block
                disabled={uploading}
              >
                Upload CSV Files
              </Button>
            </Upload>
          </Col>
          <Col span={12}>
            <Upload {...uploadProps} accept=".pdf">
              <Button
                icon={<FilePdfOutlined />}
                size="large"
                block
                disabled={uploading}
              >
                Upload PDF Documents
              </Button>
            </Upload>
          </Col>
        </Row>
      </Card>

      {/* Upload History */}
      {processedFiles.length > 0 && (
        <Card
          title={`Upload History (${processedFiles.length} files)`}
          extra={
            <Button
              type="link"
              onClick={() => setProcessedFiles([])}
              icon={<DeleteOutlined />}
            >
              Clear All
            </Button>
          }
        >
          <List
            itemLayout="horizontal"
            dataSource={processedFiles}
            renderItem={(file) => (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => setPreviewFile(file)}
                    disabled={file.status === 'error'}
                  >
                    Details
                  </Button>,
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeFile(file.uid)}
                  >
                    Remove
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    file.type === 'pdf' ?
                    <FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f' }} /> :
                    <FileExcelOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                  }
                  title={
                    <Space>
                      <Text strong>{file.name}</Text>
                      <Tag color={file.type === 'pdf' ? 'red' : 'blue'}>
                        {file.type.toUpperCase()}
                      </Tag>
                      <Badge
                        status={getStatusColor(file.status) as any}
                        text={file.status.charAt(0).toUpperCase() + file.status.slice(1)}
                      />
                    </Space>
                  }
                  description={
                    <div>
                      <Text type="secondary">
                        Size: {formatFileSize(file.size)} •
                        Uploaded: {file.uploadedAt.toLocaleString()}
                      </Text>
                      {file.response && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary">{file.response.message}</Text>
                        </div>
                      )}
                      {file.stats && (
                        <div style={{ marginTop: 8 }}>
                          <Space wrap>
                            {file.stats.totalExamples && (
                              <Tag>{file.stats.totalExamples} examples</Tag>
                            )}
                            {file.stats.importedPairs && (
                              <Tag color="green">{file.stats.importedPairs} Q&A pairs</Tag>
                            )}
                            {file.stats.generatedQAPairs && (
                              <Tag color="blue">{file.stats.generatedQAPairs} generated pairs</Tag>
                            )}
                          </Space>
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* File Details Modal */}
      <Modal
        title={`File Details: ${previewFile?.name}`}
        open={!!previewFile}
        onCancel={() => setPreviewFile(null)}
        footer={[
          <Button key="close" onClick={() => setPreviewFile(null)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {previewFile && (
          <div>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Type">
                <Tag color={previewFile.type === 'pdf' ? 'red' : 'blue'}>
                  {previewFile.type.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Size">
                {formatFileSize(previewFile.size)}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Badge
                  status={getStatusColor(previewFile.status) as any}
                  text={previewFile.status.charAt(0).toUpperCase() + previewFile.status.slice(1)}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Uploaded">
                {previewFile.uploadedAt.toLocaleString()}
              </Descriptions.Item>
            </Descriptions>

            {previewFile.response && (
              <>
                <Divider />
                <Title level={4}>Upload Response</Title>
                <Alert
                  message={previewFile.response.message}
                  type={previewFile.status === 'done' ? 'success' : 'error'}
                  showIcon
                />
              </>
            )}

            {previewFile.stats && (
              <>
                <Divider />
                <Title level={4}>Processing Statistics</Title>

                <Row gutter={16}>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic
                        title="Total Examples"
                        value={previewFile.stats.totalExamples || 0}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic
                        title="Imported Pairs"
                        value={previewFile.stats.importedPairs || 0}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic
                        title="Generated Pairs"
                        value={previewFile.stats.generatedQAPairs || 0}
                      />
                    </Card>
                  </Col>
                </Row>

                {previewFile.stats.byCategory && Object.keys(previewFile.stats.byCategory).length > 0 && (
                  <>
                    <Title level={5} style={{ marginTop: 16 }}>By Category</Title>
                    <Space wrap>
                      {Object.entries(previewFile.stats.byCategory).map(([category, count]) => (
                        <Tag key={category} color="blue">
                          {category}: {count}
                        </Tag>
                      ))}
                    </Space>
                  </>
                )}

                {previewFile.stats.byEmotionalState && Object.keys(previewFile.stats.byEmotionalState).length > 0 && (
                  <>
                    <Title level={5} style={{ marginTop: 16 }}>By Emotional State</Title>
                    <Space wrap>
                      {Object.entries(previewFile.stats.byEmotionalState).map(([emotion, count]) => (
                        <Tag key={emotion} color="green">
                          {emotion}: {count}
                        </Tag>
                      ))}
                    </Space>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FileUploadManagerAntd;