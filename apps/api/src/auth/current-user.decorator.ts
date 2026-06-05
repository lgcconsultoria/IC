import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AppUser } from './app-user';

/** Injeta o usuário autenticado (resolvido pelo SupabaseAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AppUser => {
    const req = ctx.switchToHttp().getRequest<Request & { appUser: AppUser }>();
    return req.appUser;
  },
);
