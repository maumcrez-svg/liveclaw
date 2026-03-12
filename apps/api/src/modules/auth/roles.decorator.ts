import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to users whose role is in the provided list.
 * Must be used together with RolesGuard (after JwtAuthGuard).
 *
 * Usage: @Roles('admin', 'creator')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
