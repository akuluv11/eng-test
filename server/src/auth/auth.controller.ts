import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRequest, AuthResponse } from '@roundsquares/contract';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post()
  async login(@Body() loginDto: AuthRequest): Promise<AuthResponse> {
    const user = await this.authService.validateUser(loginDto.username, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Неверный пароль для этого имени пользователя');
    }

    return this.authService.login(user);
  }
}
