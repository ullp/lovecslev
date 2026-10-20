import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_REPOSITORY, USER_REPOSITORY } from './auth.types';
import { ACCESS_TOKEN_TTL_SECONDS, accessTokenSecret } from './jwt-config';
import { PASSWORD_HASHER } from './password.hasher';
import { Argon2PasswordHasher } from './password.hasher';
import { PrismaRefreshTokenRepository, PrismaUserRepository } from './prisma-user.repository';
import { TokenService } from './token.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: accessTokenSecret(),
      signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    AuthGuard,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
  ],
  exports: [AuthGuard, AuthService, JwtModule],
})
export class AuthModule {}
