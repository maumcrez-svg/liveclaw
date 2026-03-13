import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Validates the X-Webhook-Secret header against the MEDIAMTX_WEBHOOK_SECRET
 * environment variable.
 *
 * If the env var is not set, all webhook requests are REJECTED for security.
 *
 * Usage:
 *   @UseGuards(WebhookSecretGuard)
 *   @Post('webhook/mediamtx')
 *   handleWebhook(...) {}
 */
@Injectable()
export class WebhookSecretGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSecretGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.configService.get<string>('MEDIAMTX_WEBHOOK_SECRET');

    // If no secret is configured, reject all webhook requests
    if (!secret) {
      this.logger.warn(
        'MEDIAMTX_WEBHOOK_SECRET is not configured — rejecting webhook request. ' +
          'Set this environment variable to allow MediaMTX webhooks.',
      );
      throw new ForbiddenException(
        'Webhook secret is not configured on the server',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const headerSecret = request.headers['x-webhook-secret'];

    if (!headerSecret || headerSecret !== secret) {
      throw new ForbiddenException('Invalid or missing webhook secret');
    }

    return true;
  }
}
