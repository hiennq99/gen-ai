import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getStats() {
    return await this.dashboardService.getStats();
  }

  @Get('recent-conversations')
  @ApiOperation({ summary: 'Get recent conversations' })
  async getRecentConversations(@Query('limit') limit?: number) {
    return await this.dashboardService.getRecentConversations(limit);
  }
}