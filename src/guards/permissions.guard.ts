import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserPermission } from "@prisma/client";
import { UserSession } from "@thallesp/nestjs-better-auth";
import { IncomingMessage } from "node:http";
import { PERMISSIONS_KEY } from "src/decorators/permissions.decorator";
import { UsersService } from "src/users/users.service";

interface AuthenticatedRequest extends UserSession, IncomingMessage {
	user: UserSession["user"];
}

@Injectable()
export class PermissionsGuard implements CanActivate {
	public constructor(
		private reflector: Reflector,
		private users: UsersService
	) {}

	public async canActivate(ctx: ExecutionContext): Promise<boolean> {
		const required = this.reflector.getAllAndOverride<UserPermission[]>(PERMISSIONS_KEY, [
			ctx.getHandler(),
			ctx.getClass(),
		]);
		if (!required?.length) return true;
		// 		if (!requiredRoles || requiredRoles.length === 0) {
		// 	return true;
		// }

		const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

		const userId = request.user?.id;

		if (!userId) {
			throw new ForbiddenException("User is not authenticated");
		}

		if (!userId) return false;

		const user = await this.users.findByIdWithPermissions(userId);
		const userPermissions = user?.permissions?.map((p): UserPermission => p.name) || [];
		const hasPermission = required.every((p): boolean => userPermissions.includes(p));

		if (!hasPermission) {
			throw new ForbiddenException("Insufficient permissions");
		}
		return true;
	}
}
