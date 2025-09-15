import { Controller, Post, Body, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { IsString, IsNotEmpty } from 'class-validator';

class LoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  async login(@Body() loginDto: LoginDto) {
    // For development, accept admin/admin123
    if (loginDto.username === 'admin' && loginDto.password === 'admin123') {
      const token = this.authService.generateToken({ userId: 'admin-user' });
      return {
        token,
        user: {
          id: 'admin-user',
          name: 'Admin User',
          email: 'admin@example.com',
          role: 'admin',
        },
      };
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  @Post('token')
  @ApiOperation({ summary: 'Generate authentication token' })
  async generateToken(@Body() body: { userId: string }) {
    const token = this.authService.generateToken({ userId: body.userId });
    return { token };
  }

  @Post('logout')
  @ApiOperation({ summary: 'User logout' })
  async logout() {
    return { success: true };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh authentication token' })
  async refresh(@Body() _body: { token: string }) {
    // In production, verify the old token and generate new one
    const newToken = this.authService.generateToken({ userId: 'refreshed-user' });
    return { token: newToken };
  }

  @Get('validate')
  @ApiOperation({ summary: 'Validate authentication token' })
  async validate(@Headers('authorization') authorization?: string) {
    if (!authorization) {
      return { valid: false };
    }

    try {
      const token = authorization.replace('Bearer ', '');
      const decoded = this.authService.verifyToken(token);
      return { 
        valid: !!decoded,
        user: decoded 
      };
    } catch {
      return { valid: false };
    }
  }
}