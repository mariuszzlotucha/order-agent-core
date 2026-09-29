import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

// Token serwis-do-serwisu (serwis WhatsApp -> serwis agenta)
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.SERVICE_TOKEN;
    if (!expected) throw new UnauthorizedException();

    const req = context.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : '';

    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(expected).digest();
    if (!timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}
