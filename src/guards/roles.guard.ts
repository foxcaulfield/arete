import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { UserSession } from "@thallesp/nestjs-better-auth";
import { UserRole } from "@prisma/client";
import { IncomingMessage } from "node:http";
// import { Request } from "express";

interface AuthenticatedRequest extends UserSession, IncomingMessage {
	user: UserSession["user"] & {
		role?: UserRole;
	};
}

@Injectable()
export class RolesGuard implements CanActivate {
	public constructor(private reflector: Reflector) {}

	public canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!requiredRoles || requiredRoles.length === 0) {
			return true;
		}

		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const user = request.user;

		if (!user) {
			throw new ForbiddenException("User is not authenticated");
		}

		const hasRole = user?.role && requiredRoles.includes(user?.role);
		if (!hasRole) {
			throw new ForbiddenException("Insufficient permissions");
		}

		return true;
	}
}
