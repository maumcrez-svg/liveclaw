import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Validates the X-Webhook-Secret header against the MEDIAMTX_WEBHOOK_SECRET
 * environment variable.
 *
 * If the env var is not set, all requests are allowed through (backwards
 * compatibility with existing MediaMTX webhook calls).
 *
 * Usage:
 *   @UseGuards(WebhookSecretGuard)
 *   @Post('webhook/mediamtx')
 *   handleWebhook(...) {}
 */
@Injectable()
export class WebhookSecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.configService.get<string>('MEDIAMTX_WEBHOOK_SECRET');

    // If no secret is configured, allow all requests (backwards compat)
    if (!secret) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const headerSecret = request.headers['x-webhook-secret'];

    if (!headerSecret || headerSecret !== secret) {
      throw new ForbiddenException('Invalid or missing webhook secret');
    }

    return true;
  }
}
