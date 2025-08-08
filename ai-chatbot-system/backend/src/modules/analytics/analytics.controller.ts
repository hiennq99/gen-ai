import { Controller, Get, Post, Query, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Get analytics data' })
  async getAnalytics(@Query() params: any) {
    return await this.analyticsService.getAnalytics(params);
  }

  @Get('metrics/:metric')
  @ApiOperation({ summary: 'Get specific metric data' })
  async getMetrics(@Param('metric') metric: string, @Query() params: any) {
    return await this.analyticsService.getMetrics(metric, params);
  }

  @Post('report')
  @ApiOperation({ summary: 'Generate analytics report' })
  async generateReport(@Body() params: any) {
    return await this.analyticsService.generateReport(params);
  }
}