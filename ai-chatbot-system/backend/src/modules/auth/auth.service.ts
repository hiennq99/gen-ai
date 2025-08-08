import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor(private configService: ConfigService) {
    this.jwtSecret = this.configService.get<string>('jwt.secret') || 'default-secret-key';
    this.jwtExpiresIn = this.configService.get<string>('jwt.expiresIn') || '24h';
  }

  generateToken(payload: any): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    } as jwt.SignOptions);
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      return null;
    }
  }
}