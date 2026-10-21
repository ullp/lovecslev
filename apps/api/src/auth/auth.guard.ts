import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DomainError } from '@lovecslev/shared';
import type { AuthenticatedUser } from './auth.types';

interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

/** Ověří `Authorization: Bearer <accessToken>` (spec §13.1) a nastaví `request.user`. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;

    if (value === undefined || !value.startsWith('Bearer ')) {
      throw new DomainError('UNAUTHORIZED', 'Chybí access token');
    }

    try {
      const payload = this.jwt.verify<{ sub: string; email: string }>(value.slice('Bearer '.length));
      request.user = { userId: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new DomainError('UNAUTHORIZED', 'Neplatný nebo expirovaný access token');
    }
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user === undefined) {
      throw new DomainError('UNAUTHORIZED', 'Chybí přihlášený uživatel');
    }
    return request.user;
  },
);
