import { Controller, Post, Body, Get, Param, Query, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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
}