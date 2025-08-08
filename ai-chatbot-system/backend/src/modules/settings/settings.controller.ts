import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  async getSettings() {
    return await this.settingsService.getSettings();
  }

  @Put()
  @ApiOperation({ summary: 'Update settings' })
  async updateSettings(@Body() settings: any) {
    return await this.settingsService.updateSettings(settings);
  }
}