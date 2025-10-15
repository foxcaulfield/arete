import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { UserSession } from "@thallesp/nestjs-better-auth";
import { UserRole } from "@prisma/client";
import { IncomingMessage } from "node:http";
import { UsersService } from "src/users/users.service";
// import { Request } from "express";

interface AuthenticatedRequest extends UserSession, IncomingMessage {
	user: UserSession["user"] & {
		role?: UserRole;
	};
}

@Injectable()
export class RolesGuard implements CanActivate {
	public constructor(
		private reflector: Reflector,
		private readonly usersService: UsersService
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!requiredRoles || requiredRoles.length === 0) {
			return true;
		}

		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

		if (!request.user) {
			throw new ForbiddenException("User is not authenticated");
		}
		const userId = request.user.id;
		const user = await this.usersService.findByIdWithPermissions(userId);

		const hasRole = user?.role && requiredRoles.includes(user?.role);
		if (!hasRole) {
			throw new ForbiddenException("Insufficient permissions");
		}

		return true;
	}
}
