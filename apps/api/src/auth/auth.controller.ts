import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from './auth.guard';
import { AuthService, type PublicUser } from './auth.service';
import type { AuthenticatedUser, TokenPair } from './auth.types';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';

/** Auth endpointy (spec §13.2). */
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<{ data: { user: PublicUser; tokens: TokenPair } }> {
    return this.auth.register(dto).then((result) => ({ data: result }));
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<{ data: { user: PublicUser; tokens: TokenPair } }> {
    return this.auth.login(dto.email, dto.password).then((result) => ({ data: result }));
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto): Promise<{ data: { tokens: TokenPair } }> {
    return this.auth.refresh(dto.refreshToken).then((result) => ({ data: result }));
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefreshDto,
  ): Promise<void> {
    void user;
    await this.auth.logout(dto.refreshToken);
  }
}
