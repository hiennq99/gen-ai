import { Controller, Post, Body, Get, Param, Query, Delete, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { TrainingService } from './training.service';

@ApiTags('training')
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get()
  @ApiOperation({ summary: 'Get all training data' })
  async getTrainingData(@Query() query: any) {
    return await this.trainingService.getTrainingData(query);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Get all training jobs' })
  async getTrainingJobs() {
    return await this.trainingService.getTrainingJobs();
  }

  @Get('qa')
  @ApiOperation({ summary: 'Get Q&A training data' })
  async getQAData(@Query() query: any) {
    return await this.trainingService.getQAData(query);
  }

  @Post('start')
  @ApiOperation({ summary: 'Start training job' })
  async startTraining(@Body() trainingData: any) {
    return await this.trainingService.startTraining(trainingData);
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Get training job status' })
  async getTrainingStatus(@Param('jobId') jobId: string) {
    return await this.trainingService.getTrainingStatus(jobId);
  }

  @Post('upload-csv')
  @ApiOperation({ summary: 'Upload CSV file with question/answer pairs for training' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file with question and answer columns',
        },
        name: {
          type: 'string',
          description: 'Training job name',
        },
        description: {
          type: 'string',
          description: 'Training job description',
        },
        questionColumn: {
          type: 'string',
          description: 'Column name for questions (default: "question")',
        },
        answerColumn: {
          type: 'string',
          description: 'Column name for answers (default: "answer")',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadCSV(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    return await this.trainingService.uploadCSV(file, body);
  }

  @Post(':jobId/stop')
  @ApiOperation({ summary: 'Stop training job' })
  async stopTraining(@Param('jobId') jobId: string) {
    return await this.trainingService.stopTraining(jobId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete training data' })
  async deleteTrainingData(@Param('id') id: string) {
    return await this.trainingService.deleteTrainingData(id);
  }

  @Delete('qa/all')
  @ApiOperation({ summary: 'Clear all Q&A training data' })
  async clearAllQAData() {
    return await this.trainingService.clearAllQAData();
  }
}