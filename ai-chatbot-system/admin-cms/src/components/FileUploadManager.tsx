import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Divider,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
  TableChart as CsvIcon,
  PictureAsPdf as PdfIcon,
  FileUpload as DragDropIcon,
} from '@mui/icons-material';
import { spiritualGuidanceService } from '../services/spiritualGuidance';

interface UploadedFile {
  id: string;
  name: string;
  type: 'csv' | 'pdf';
  size: number;
  status: 'uploading' | 'success' | 'error';
  message?: string;
  uploadedAt: Date;
  stats?: {
    totalExamples?: number;
    importedPairs?: number;
    generatedQAPairs?: number;
    byCategory?: Record<string, number>;
    byEmotionalState?: Record<string, number>;
  };
}

const FileUploadManager: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [alerts, setAlerts] = useState<Array<{ type: 'success' | 'error' | 'info'; message: string }>>([]);
  const [dragOver, setDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addAlert = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const newAlert = { type, message };
    setAlerts(prev => [...prev, newAlert]);
    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert !== newAlert));
    }, 5000);
  }, []);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['text/csv', 'application/pdf'];
    const allowedExtensions = ['.csv', '.pdf'];

    if (file.size > maxSize) {
      return { valid: false, error: 'File size must be less than 10MB' };
    }

    const hasValidType = allowedTypes.includes(file.type);
    const hasValidExtension = allowedExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidType && !hasValidExtension) {
      return { valid: false, error: 'Only CSV and PDF files are allowed' };
    }

    return { valid: true };
  };

  const getFileType = (file: File): 'csv' | 'pdf' => {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return 'pdf';
    }
    return 'csv';
  };

  const uploadFile = async (file: File) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      addAlert('error', validation.error!);
      return;
    }

    const fileId = `${Date.now()}-${file.name}`;
    const fileType = getFileType(file);

    const newFile: UploadedFile = {
      id: fileId,
      name: file.name,
      type: fileType,
      size: file.size,
      status: 'uploading',
      uploadedAt: new Date(),
    };

    setUploadedFiles(prev => [newFile, ...prev]);
    setUploading(true);

    try {
      let result;
      if (fileType === 'csv') {
        result = await spiritualGuidanceService.uploadCSVData(file);
        addAlert('success', `CSV uploaded successfully: ${result.data.importedPairs} Q&A pairs imported`);
      } else {
        result = await spiritualGuidanceService.uploadPDFDocument(file);
        addAlert('success', `PDF uploaded successfully: ${result.data.generatedQAPairs} Q&A pairs generated`);
      }

      setUploadedFiles(prev =>
        prev.map(f =>
          f.id === fileId
            ? {
                ...f,
                status: 'success',
                message: result.message,
                stats: result.data
              }
            : f
        )
      );

    } catch (error: any) {
      setUploadedFiles(prev =>
        prev.map(f =>
          f.id === fileId
            ? { ...f, status: 'error', message: error.message }
            : f
        )
      );
      addAlert('error', `Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(uploadFile);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    const files = event.dataTransfer.files;
    if (files) {
      Array.from(files).forEach(uploadFile);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return <InfoIcon color="info" />;
      case 'success':
        return <SuccessIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <InfoIcon />;
    }
  };

  const getFileIcon = (type: string) => {
    return type === 'pdf' ? <PdfIcon color="error" /> : <CsvIcon color="primary" />;
  };

  return (
    <Box>
      {/* Alerts */}
      {alerts.map((alert, index) => (
        <Alert key={index} severity={alert.type} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      ))}

      <Typography variant="h4" gutterBottom>
        Training Data Upload
      </Typography>

      <Typography variant="body1" color="textSecondary" gutterBottom sx={{ mb: 3 }}>
        Upload CSV files with Q&A pairs or PDF documents to enhance your AI training data.
        Files are automatically processed and added to your training dataset.
      </Typography>

      {/* Upload Area */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            sx={{
              border: '2px dashed',
              borderColor: dragOver ? 'primary.main' : 'grey.300',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              bgcolor: dragOver ? 'action.hover' : 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <DragDropIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Drag & Drop Files Here
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              or click to browse files
            </Typography>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              disabled={uploading}
              sx={{ mt: 2 }}
            >
              Choose Files
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </Box>

          {uploading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Uploading and processing files...
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Quick Upload Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          size="large"
          startIcon={<CsvIcon />}
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.accept = '.csv';
              fileInputRef.current.click();
            }
          }}
          sx={{ flex: '1 1 200px', py: 2 }}
        >
          Upload CSV Files
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<PdfIcon />}
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.accept = '.pdf';
              fileInputRef.current.click();
            }
          }}
          sx={{ flex: '1 1 200px', py: 2 }}
        >
          Upload PDF Documents
        </Button>
      </Box>

      {/* Upload History */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Upload History ({uploadedFiles.length} files)
            </Typography>

            <List>
              {uploadedFiles.map((file, index) => (
                <React.Fragment key={file.id}>
                  <ListItem
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          onClick={() => setPreviewFile(file)}
                          disabled={file.status === 'uploading' || file.status === 'error'}
                        >
                          <PreviewIcon />
                        </IconButton>
                        <IconButton onClick={() => removeFile(file.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemIcon>
                      {getFileIcon(file.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle1">{file.name}</Typography>
                          <Chip
                            label={file.type.toUpperCase()}
                            size="small"
                            color={file.type === 'pdf' ? 'error' : 'primary'}
                          />
                          <Chip
                            icon={getStatusIcon(file.status)}
                            label={file.status.charAt(0).toUpperCase() + file.status.slice(1)}
                            size="small"
                            color={
                              file.status === 'success' ? 'success' :
                              file.status === 'error' ? 'error' : 'default'
                            }
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Size: {formatFileSize(file.size)} • Uploaded: {file.uploadedAt.toLocaleString()}
                          </Typography>
                          {file.message && (
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              {file.message}
                            </Typography>
                          )}
                          {file.stats && (
                            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {file.stats.totalExamples && (
                                <Chip label={`${file.stats.totalExamples} examples`} size="small" variant="outlined" />
                              )}
                              {file.stats.importedPairs && (
                                <Chip label={`${file.stats.importedPairs} Q&A pairs`} size="small" variant="outlined" />
                              )}
                              {file.stats.generatedQAPairs && (
                                <Chip label={`${file.stats.generatedQAPairs} generated pairs`} size="small" variant="outlined" />
                              )}
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < uploadedFiles.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* File Preview Dialog */}
      <Dialog
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          File Details: {previewFile?.name}
        </DialogTitle>
        <DialogContent>
          {previewFile && (
            <Box>
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>File Information</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Typography><strong>Type:</strong> {previewFile.type.toUpperCase()}</Typography>
                  <Typography><strong>Size:</strong> {formatFileSize(previewFile.size)}</Typography>
                  <Typography><strong>Status:</strong> {previewFile.status}</Typography>
                  <Typography><strong>Uploaded:</strong> {previewFile.uploadedAt.toLocaleString()}</Typography>
                </Box>
              </Paper>

              {previewFile.stats && (
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>Processing Results</Typography>

                  {previewFile.stats.byCategory && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>By Category:</Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {Object.entries(previewFile.stats.byCategory).map(([category, count]) => (
                          <Chip key={category} label={`${category}: ${count}`} size="small" />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {previewFile.stats.byEmotionalState && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>By Emotional State:</Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {Object.entries(previewFile.stats.byEmotionalState).map(([emotion, count]) => (
                          <Chip key={emotion} label={`${emotion}: ${count}`} size="small" color="secondary" />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Paper>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewFile(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FileUploadManager;