# 📚 Spiritual Guidance Training File Upload Guide

## 🚀 Access the Admin CMS

Your admin CMS is now running with comprehensive file upload functionality!

**Admin CMS URL**: http://localhost:5173

## 📂 Training Upload Interface

Navigate to the **"Training Upload"** tab in the Spiritual Guidance section to access the file upload interface.

### 🎯 Upload Categories

#### 1. 📚 **Handbook Content Upload**
- **Purpose**: Upload handbook content files to train the spiritual guidance model
- **Supported Formats**: PDF, DOCX, DOC, TXT
- **Endpoint**: `/api/v1/admin/spiritual-guidance/import/handbook`

#### 2. ❓ **Q&A Training Data**
- **Purpose**: Upload CSV/Excel files with questions and answers for training
- **Supported Formats**: CSV, XLSX, XLS
- **Endpoint**: `/api/v1/documents/import-qa`

#### 3. 📄 **General Documents**
- **Purpose**: Upload general training documents for processing
- **Supported Formats**: PDF, DOCX, DOC, TXT, CSV, XLSX, XLS
- **Endpoint**: `/api/v1/documents/upload`

## 🛠 Features

### ✨ **Drag & Drop Upload**
- Simply drag files into the upload areas
- Multiple file upload support
- Real-time upload progress
- Automatic file validation

### 📊 **Upload Statistics**
- Success/failure tracking
- Real-time upload counts
- Success rate calculation
- Recent activity log

### 📈 **Results Display**
- ✅ Success indicators (green checkmark)
- ❌ Error indicators (red warning)
- Detailed upload messages
- File-by-file status

### 🔄 **Data Management**
- **Clear Results**: Remove upload history
- **Export Training Data**: Download processed training data as Excel
- **Real-time Refresh**: Automatically updates spiritual diseases and handbook content

## 🚀 How to Use

1. **Access the Admin CMS**: Navigate to http://localhost:5173
2. **Go to Spiritual Guidance**: Click on the Spiritual Guidance section
3. **Select Training Upload Tab**: Click the "Training Upload" tab
4. **Choose Upload Type**: Select Handbook, Q&A, or General documents
5. **Upload Files**: Drag and drop or click to browse files
6. **Monitor Results**: View upload progress and results in real-time

## 📝 Example Files to Test

### CSV Format for Q&A Data
```csv
question,answer,category
"I am feeling very angry",This is spiritual guidance about anger...,anger
"Why do I feel envious?",Envy guidance from the handbook...,envy
```

### Handbook Content
- Upload PDF files containing "A Handbook of Spiritual Medicine" content
- Text files with Islamic spiritual guidance
- DOCX files with structured spiritual disease information

## 🔍 System Integration

The upload system automatically:
- ✅ Processes uploaded files
- ✅ Extracts training content
- ✅ Updates the spiritual guidance AI model
- ✅ Validates content quality
- ✅ Creates citations and references
- ✅ Refreshes the knowledge base

## 🎉 Success!

Your Citation-Based Spiritual Guidance AI Training System is now fully operational with a comprehensive file upload interface!

Upload your training files and watch the AI model improve its spiritual guidance capabilities with authentic citations from Islamic teachings.