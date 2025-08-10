import { 
  Controller, 
  Post, 
  Get, 
  Delete, 
  Param, 
  Body, 
  UploadedFile, 
  UseInterceptors,
  Query
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a document for processing' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        title: {
          type: 'string',
        },
        metadata: {
          type: 'object',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    return await this.documentsService.uploadDocument(file, body);
  }

  @Post('import-qa')
  @ApiOperation({ summary: 'Import Q&A pairs' })
  async importQA(@Body() qaData: Array<{ question: string; answer: string; metadata?: any }>) {
    return await this.documentsService.importQA(qaData);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search documents' })
  async searchDocuments(@Query('q') query: string, @Query() options: any) {
    return await this.documentsService.searchDocuments(query, options);
  }

  @Get()
  @ApiOperation({ summary: 'List all documents' })
  async listDocuments(@Query() options: any) {
    return await this.documentsService.listDocuments(options);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document by ID' })
  async getDocument(@Param('id') id: string) {
    return await this.documentsService.getDocument(id);
  }

  @Delete('all')
  @ApiOperation({ summary: 'Delete all documents' })
  async deleteAllDocuments() {
    const result = await this.documentsService.deleteAllDocuments();
    return { 
      success: true,
      message: 'All documents deleted successfully',
      ...result
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document' })
  async deleteDocument(@Param('id') id: string) {
    await this.documentsService.deleteDocument(id);
    return { success: true, documentId: id };
  }
}