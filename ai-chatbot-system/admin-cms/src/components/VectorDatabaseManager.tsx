import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Textarea,
  Badge,
  Alert,
  AlertDescription,
  Separator,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { Upload, Search, Database, Trash2, Eye, BarChart3 } from 'lucide-react';

interface VectorDocument {
  id: string;
  text: string;
  metadata: {
    type: string;
    sourceFile?: string;
    chunkIndex?: number;
    createdAt: string;
  };
  similarity?: number;
  embeddingLength?: number;
}

interface VectorStats {
  totalDocuments: number;
  indexInfo: {
    storage: string;
    vectorSearch: string;
    indexName: string;
  };
}

const VectorDatabaseManager: React.FC = () => {
  const [stats, setStats] = useState<VectorStats | null>(null);
  const [documents, setDocuments] = useState<VectorDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VectorDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<VectorDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [searchThreshold, setSearchThreshold] = useState(0.3);
  const [sourceFileFilter, setSourceFileFilter] = useState('');

  const API_BASE = '/api/v1/admin/spiritual-guidance';

  // Load initial data
  useEffect(() => {
    loadStats();
    loadDocuments();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/vectors/stats`);
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (sourceFileFilter) params.append('sourceFile', sourceFileFilter);
      params.append('limit', '20');

      const response = await fetch(`${API_BASE}/vectors/documents?${params}`);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchVectors = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        q: searchQuery,
        threshold: searchThreshold.toString(),
        limit: '10',
      });
      if (sourceFileFilter) params.append('sourceFile', sourceFileFilter);

      const response = await fetch(`${API_BASE}/vectors/search?${params}`);
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.results);
        setMessage({ type: 'success', text: `Found ${data.total} results` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Search failed' });
    } finally {
      setLoading(false);
    }
  };

  const uploadPDF = async () => {
    if (!uploadFile) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch(`${API_BASE}/documents/upload-pdf`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setUploadFile(null);
        loadStats();
        loadDocuments();
      } else {
        setMessage({ type: 'error', text: 'Upload failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Upload failed' });
    } finally {
      setLoading(false);
    }
  };

  const viewDocument = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/vectors/document/${id}`);
      const data = await response.json();
      if (data.success) {
        setSelectedDocument(data.document);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load document' });
    }
  };

  const deleteDocument = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`${API_BASE}/vectors/document/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Document deleted' });
        loadStats();
        loadDocuments();
        if (selectedDocument?.id === id) {
          setSelectedDocument(null);
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete document' });
    }
  };

  const clearDatabase = async () => {
    if (!confirm('Are you sure you want to clear ALL vector documents? This cannot be undone!')) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/vectors/clear`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Database cleared' });
        setDocuments([]);
        setSearchResults([]);
        setSelectedDocument(null);
        loadStats();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clear database' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Vector Database Manager</h1>
        <Badge variant="outline" className="text-lg">
          <Database className="w-4 h-4 mr-2" />
          Redis Vector DB
        </Badge>
      </div>

      {message && (
        <Alert className={message.type === 'error' ? 'border-red-500' : 'border-green-500'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Database Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalDocuments}</div>
                <div className="text-sm text-gray-600">Total Documents</div>
              </div>
              <div className="text-center">
                <div className="text-lg">{stats.indexInfo.storage}</div>
                <div className="text-sm text-gray-600">Storage Engine</div>
              </div>
              <div className="text-center">
                <div className="text-lg">{stats.indexInfo.vectorSearch}</div>
                <div className="text-sm text-gray-600">Search Method</div>
              </div>
            </div>
          ) : (
            <div>Loading stats...</div>
          )}
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Upload PDF Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="pdf-upload">Select PDF File</Label>
            <Input
              id="pdf-upload"
              type="file"
              accept=".pdf"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
          </div>
          <Button
            onClick={uploadPDF}
            disabled={!uploadFile || loading}
            className="w-full"
          >
            {loading ? 'Uploading...' : 'Upload & Process PDF'}
          </Button>
          <p className="text-sm text-gray-600">
            PDF will be processed, chunked, and stored as vectors for semantic search.
          </p>
        </CardContent>
      </Card>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="w-5 h-5 mr-2" />
            Vector Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="search-query">Search Query</Label>
              <Input
                id="search-query"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter search terms..."
                onKeyPress={(e) => e.key === 'Enter' && searchVectors()}
              />
            </div>
            <div>
              <Label htmlFor="threshold">Similarity Threshold</Label>
              <Select value={searchThreshold.toString()} onValueChange={(v) => setSearchThreshold(parseFloat(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.1">0.1 (Very Low)</SelectItem>
                  <SelectItem value="0.3">0.3 (Low)</SelectItem>
                  <SelectItem value="0.5">0.5 (Medium)</SelectItem>
                  <SelectItem value="0.7">0.7 (High)</SelectItem>
                  <SelectItem value="0.9">0.9 (Very High)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="source-filter">Source File Filter (optional)</Label>
            <Input
              id="source-filter"
              value={sourceFileFilter}
              onChange={(e) => setSourceFileFilter(e.target.value)}
              placeholder="e.g., spiritual-guidance.pdf"
            />
          </div>
          <Button onClick={searchVectors} disabled={loading} className="w-full">
            {loading ? 'Searching...' : 'Search Vectors'}
          </Button>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results ({searchResults.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {searchResults.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">{doc.id}</Badge>
                        <Badge variant="outline">
                          {(doc.similarity! * 100).toFixed(1)}% match
                        </Badge>
                        {doc.metadata.sourceFile && (
                          <Badge variant="outline">{doc.metadata.sourceFile}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{doc.text}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewDocument(doc.id)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteDocument(doc.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Documents ({documents.length})</CardTitle>
          <div className="flex gap-2">
            <Button onClick={loadDocuments} variant="outline" size="sm">
              Refresh
            </Button>
            <Button onClick={clearDatabase} variant="destructive" size="sm">
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm">{doc.id}</span>
                    {doc.metadata.sourceFile && (
                      <Badge variant="outline">{doc.metadata.sourceFile}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{doc.text}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => viewDocument(doc.id)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteDocument(doc.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Document Detail Modal */}
      {selectedDocument && (
        <Card>
          <CardHeader>
            <CardTitle>Document Details: {selectedDocument.id}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Text Content</Label>
              <Textarea
                value={selectedDocument.text}
                readOnly
                className="min-h-32"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Metadata</Label>
                <pre className="text-sm bg-gray-100 p-3 rounded">
                  {JSON.stringify(selectedDocument.metadata, null, 2)}
                </pre>
              </div>
              <div>
                <Label>Vector Information</Label>
                <div className="space-y-2">
                  <p><strong>Embedding Length:</strong> {selectedDocument.embeddingLength}</p>
                  <p><strong>Type:</strong> {selectedDocument.metadata.type}</p>
                  {selectedDocument.metadata.chunkIndex !== undefined && (
                    <p><strong>Chunk Index:</strong> {selectedDocument.metadata.chunkIndex}</p>
                  )}
                </div>
              </div>
            </div>
            <Button onClick={() => setSelectedDocument(null)} variant="outline">
              Close
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VectorDatabaseManager;