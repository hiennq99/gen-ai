import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  LinearProgress,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
} from '@mui/material';
import {
  ModelTraining as TrainingIcon,
  CloudUpload as UploadIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Psychology as BrainIcon,
  Speed as SpeedIcon,
  Storage as DataIcon,
  FileUpload as FileUploadIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
} from '@mui/icons-material';
import { spiritualGuidanceService } from '../services/spiritualGuidance';

interface TrainingStats {
  totalExamples: number;
  byCategory: Record<string, number>;
  byEmotionalState: Record<string, number>;
}

interface ModelStatus {
  config: any;
  stats: {
    totalRequests: number;
    averageResponseTime: number;
    cacheHitRate: number;
  };
}

const FineTunedModelManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [trainingStats, setTrainingStats] = useState<TrainingStats | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [alerts, setAlerts] = useState<Array<{ type: 'success' | 'error' | 'info'; message: string }>>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; type: 'csv' | 'pdf'; status: 'uploading' | 'success' | 'error'; message?: string }>>([]);

  const addAlert = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setAlerts(prev => [...prev, { type, message }]);
    setTimeout(() => {
      setAlerts(prev => prev.slice(1));
    }, 5000);
  }, []);

  const loadModelStatus = useCallback(async () => {
    try {
      const status = await spiritualGuidanceService.getFineTunedModelStatus();
      setModelStatus(status.data);
    } catch (error: any) {
      addAlert('error', 'Failed to load model status: ' + error.message);
    }
  }, [addAlert]);

  useEffect(() => {
    loadModelStatus();
  }, [loadModelStatus]);

  const handlePrepareTrainingData = async () => {
    setLoading(true);
    try {
      const result = await spiritualGuidanceService.prepareTrainingData();
      setTrainingStats(result.data.stats);
      addAlert('success', result.message);
    } catch (error: any) {
      addAlert('error', 'Failed to prepare training data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateTrainingData = async () => {
    setLoading(true);
    try {
      const result = await spiritualGuidanceService.validateTrainingData();
      setValidationResult(result.data);
      addAlert(result.data.valid ? 'success' : 'error', result.message);
    } catch (error: any) {
      addAlert('error', 'Failed to validate training data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTrainingData = async () => {
    setLoading(true);
    try {
      const result = await spiritualGuidanceService.saveTrainingDataToFile({
        includeValidation: true
      });
      addAlert('success', result.message);
    } catch (error: any) {
      addAlert('error', 'Failed to save training data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTrainModel = async () => {
    setLoading(true);
    try {
      const result = await spiritualGuidanceService.trainFineTunedModel();
      addAlert(result.success ? 'success' : 'error', result.message);
      if (result.success) {
        await loadModelStatus();
      }
    } catch (error: any) {
      addAlert('error', 'Failed to start training: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestGuidance = async () => {
    if (!testMessage.trim()) {
      addAlert('error', 'Please enter a test message');
      return;
    }

    setLoading(true);
    try {
      const result = await spiritualGuidanceService.testFineTunedGuidance({
        message: testMessage
      });
      setTestResult(result.data);
      addAlert('success', 'Test completed successfully');
    } catch (error: any) {
      addAlert('error', 'Test failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // CSV test upload is now handled by handleCSVUpload for consistency

  const handleTestCSVGuidance = async () => {
    if (!testMessage.trim()) {
      addAlert('error', 'Please enter a test message');
      return;
    }

    setLoading(true);
    try {
      // Use a test CSV file path - in production this would come from file upload
      const result = await spiritualGuidanceService.testAIResponseWithCSV({
        csvFilePath: '/tmp/test-qa-data.csv',
        testQuestion: testMessage
      });
      setTestResult(result.data);
      addAlert('success', 'CSV AI test completed successfully');
    } catch (error: any) {
      addAlert('error', 'CSV AI test failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePDFUpload = async (file: File) => {
    const fileEntry = { name: file.name, type: 'pdf' as const, status: 'uploading' as const };
    setUploadedFiles(prev => [...prev, fileEntry]);

    setLoading(true);
    try {
      const result = await spiritualGuidanceService.uploadPDFDocument(file);

      setUploadedFiles(prev =>
        prev.map(f =>
          f.name === file.name
            ? { ...f, status: 'success', message: result.message }
            : f
        )
      );

      addAlert('success', `PDF uploaded successfully: ${result.message}`);

      // Refresh training stats if available
      if (result.data?.stats) {
        setTrainingStats(result.data.stats);
      }
    } catch (error: any) {
      setUploadedFiles(prev =>
        prev.map(f =>
          f.name === file.name
            ? { ...f, status: 'error', message: error.message }
            : f
        )
      );
      addAlert('error', 'PDF upload failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = async (file: File) => {
    const fileEntry = { name: file.name, type: 'csv' as const, status: 'uploading' as const };
    setUploadedFiles(prev => [...prev, fileEntry]);

    setLoading(true);
    try {
      const result = await spiritualGuidanceService.uploadCSVData(file);

      setUploadedFiles(prev =>
        prev.map(f =>
          f.name === file.name
            ? { ...f, status: 'success', message: result.message }
            : f
        )
      );

      addAlert('success', `CSV uploaded successfully: ${result.message}`);

      // Update training stats
      if (result.data?.stats) {
        setTrainingStats(result.data.stats);
      }
    } catch (error: any) {
      setUploadedFiles(prev =>
        prev.map(f =>
          f.name === file.name
            ? { ...f, status: 'error', message: error.message }
            : f
        )
      );
      addAlert('error', 'CSV upload failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderTrainingStats = () => {
    if (!trainingStats) return null;

    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <DataIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Training Data Statistics
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 300px' }}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {trainingStats.totalExamples.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Examples
                </Typography>
              </Paper>
            </Box>

            <Box sx={{ flex: '1 1 300px' }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  By Category
                </Typography>
                {Object.entries(trainingStats.byCategory).map(([category, count]) => (
                  <Box key={category} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">{category}:</Typography>
                    <Chip label={count} size="small" color="primary" />
                  </Box>
                ))}
              </Paper>
            </Box>

            <Box sx={{ flex: '1 1 300px' }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  By Emotional State
                </Typography>
                {Object.entries(trainingStats.byEmotionalState).map(([emotion, count]) => (
                  <Box key={emotion} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">{emotion}:</Typography>
                    <Chip label={count} size="small" color="secondary" />
                  </Box>
                ))}
              </Paper>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderValidationResult = () => {
    if (!validationResult) return null;

    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <CheckIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Training Data Validation
          </Typography>

          <Alert severity={validationResult.valid ? 'success' : 'warning'} sx={{ mb: 2 }}>
            {validationResult.valid
              ? 'Training data is valid and ready for fine-tuning'
              : `Found ${validationResult.issues.length} validation issues`
            }
          </Alert>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 400px' }}>
              <Typography variant="subtitle2" gutterBottom>Validation Statistics</Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Total Examples"
                    secondary={validationResult.stats.total.toLocaleString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Valid Examples"
                    secondary={validationResult.stats.valid.toLocaleString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Validation Rate"
                    secondary={`${(validationResult.stats.validationRate * 100).toFixed(1)}%`}
                  />
                </ListItem>
              </List>
            </Box>

            {validationResult.issues.length > 0 && (
              <Box sx={{ flex: '1 1 400px' }}>
                <Typography variant="subtitle2" gutterBottom>Issues Found</Typography>
                <List dense>
                  {validationResult.issues.slice(0, 5).map((issue: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ErrorIcon color="warning" />
                      </ListItemIcon>
                      <ListItemText primary={issue} />
                    </ListItem>
                  ))}
                  {validationResult.issues.length > 5 && (
                    <ListItem>
                      <ListItemText
                        secondary={`... and ${validationResult.issues.length - 5} more issues`}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderModelStatus = () => {
    if (!modelStatus) return null;

    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <BrainIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Model Status
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 400px' }}>
              <Typography variant="subtitle2" gutterBottom>Configuration</Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Model ID"
                    secondary={modelStatus.config?.modelId || 'Not configured'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Is Custom Model"
                    secondary={
                      <Chip
                        label={modelStatus.config?.isCustomModel ? 'Yes' : 'No'}
                        color={modelStatus.config?.isCustomModel ? 'success' : 'default'}
                        size="small"
                      />
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Training Status"
                    secondary={
                      <Chip
                        label={modelStatus.config?.trainingStatus || 'Unknown'}
                        color={modelStatus.config?.trainingStatus === 'COMPLETED' ? 'success' : 'warning'}
                        size="small"
                      />
                    }
                  />
                </ListItem>
              </List>
            </Box>

            <Box sx={{ flex: '1 1 400px' }}>
              <Typography variant="subtitle2" gutterBottom>Performance Statistics</Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Total Requests"
                    secondary={modelStatus.stats.totalRequests.toLocaleString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Average Response Time"
                    secondary={`${modelStatus.stats.averageResponseTime}ms`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Cache Hit Rate"
                    secondary={`${(modelStatus.stats.cacheHitRate * 100).toFixed(1)}%`}
                  />
                </ListItem>
              </List>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
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
        Fine-Tuned Model Manager
      </Typography>

      <Typography variant="body1" color="textSecondary" gutterBottom>
        Manage AI training and fine-tuned models for spiritual guidance. This approach replaces DynamoDB queries with direct AI knowledge.
      </Typography>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Model Status */}
      {renderModelStatus()}

      {/* Training Data Stats */}
      {renderTrainingStats()}

      {/* Validation Results */}
      {renderValidationResult()}

      {/* Action Buttons */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <TrainingIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Training Actions
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 250px' }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={handlePrepareTrainingData}
                disabled={loading}
                startIcon={<DataIcon />}
              >
                Prepare Training Data
              </Button>
            </Box>

            <Box sx={{ flex: '1 1 250px' }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={handleValidateTrainingData}
                disabled={loading}
                startIcon={<CheckIcon />}
              >
                Validate Data
              </Button>
            </Box>

            <Box sx={{ flex: '1 1 250px' }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={handleSaveTrainingData}
                disabled={loading}
                startIcon={<UploadIcon />}
              >
                Save Training File
              </Button>
            </Box>

            <Box sx={{ flex: '1 1 250px' }}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleTrainModel}
                disabled={loading}
                startIcon={<TrainingIcon />}
              >
                Train Model
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* File Upload Interface */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <FileUploadIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Training Data Upload
          </Typography>

          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Upload CSV files with Q&A pairs or PDF documents to enhance your AI training data.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            {/* CSV Upload */}
            <Box sx={{ flex: '1 1 300px' }}>
              <input
                accept=".csv"
                style={{ display: 'none' }}
                id="csv-upload-button"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCSVUpload(file);
                }}
              />
              <label htmlFor="csv-upload-button">
                <Button
                  variant="outlined"
                  component="span"
                  fullWidth
                  disabled={loading}
                  startIcon={<CsvIcon />}
                  sx={{ height: '100px', flexDirection: 'column' }}
                >
                  <Typography variant="h6">Upload CSV</Typography>
                  <Typography variant="body2">Q&A Data Pairs</Typography>
                </Button>
              </label>
            </Box>

            {/* PDF Upload */}
            <Box sx={{ flex: '1 1 300px' }}>
              <input
                accept=".pdf"
                style={{ display: 'none' }}
                id="pdf-upload-button"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePDFUpload(file);
                }}
              />
              <label htmlFor="pdf-upload-button">
                <Button
                  variant="outlined"
                  component="span"
                  fullWidth
                  disabled={loading}
                  startIcon={<PdfIcon />}
                  sx={{ height: '100px', flexDirection: 'column' }}
                >
                  <Typography variant="h6">Upload PDF</Typography>
                  <Typography variant="body2">Document Content</Typography>
                </Button>
              </label>
            </Box>

            {/* Test with CSV */}
            <Box sx={{ flex: '1 1 300px' }}>
              <Button
                variant="contained"
                color="secondary"
                fullWidth
                onClick={handleTestCSVGuidance}
                disabled={loading || !testMessage.trim()}
                startIcon={<BrainIcon />}
                sx={{ height: '100px', flexDirection: 'column' }}
              >
                <Typography variant="h6">Test AI</Typography>
                <Typography variant="body2">with CSV Data</Typography>
              </Button>
            </Box>
          </Box>

          {/* Upload Status */}
          {uploadedFiles.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Upload Status:
              </Typography>
              <List dense>
                {uploadedFiles.map((file, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      {file.status === 'uploading' && <UploadIcon color="info" />}
                      {file.status === 'success' && <CheckIcon color="success" />}
                      {file.status === 'error' && <ErrorIcon color="error" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${file.name} (${file.type.toUpperCase()})`}
                      secondary={file.message || file.status}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Test Interface */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <SpeedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Test Fine-Tuned Model
          </Typography>

          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Test Message"
              placeholder="Enter a spiritual guidance question to test the fine-tuned model..."
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              sx={{ mb: 2 }}
            />

            <Button
              variant="contained"
              onClick={handleTestGuidance}
              disabled={loading || !testMessage.trim()}
              startIcon={<BrainIcon />}
            >
              Test Guidance
            </Button>
          </Box>

          {testResult && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>Test Result</Typography>
              <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="body1" gutterBottom>
                  <strong>Response:</strong>
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                  {testResult.response}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: '1 1 400px' }}>
                    <Typography variant="body2">
                      <strong>Citation Level:</strong> {testResult.citationLevel}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Template Used:</strong> {testResult.templateUsed}
                    </Typography>
                  </Box>

                  <Box sx={{ flex: '1 1 400px' }}>
                    {testResult.metadata && (
                      <>
                        <Typography variant="body2">
                          <strong>Model Type:</strong> {testResult.metadata.modelType}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Quality Score:</strong> {testResult.metadata.qualityScore}
                        </Typography>
                      </>
                    )}
                  </Box>
                </Box>

                {testResult.citations && testResult.citations.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      <strong>Citations:</strong>
                    </Typography>
                    <List dense>
                      {testResult.citations.map((citation: any, index: number) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={citation.quote || citation.content}
                            secondary={`Page ${citation.page}${citation.source ? ` - ${citation.source}` : ''}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Paper>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default FineTunedModelManager;