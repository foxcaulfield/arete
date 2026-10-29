import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { UsersService } from "src/users/users.service";
import { UserSession } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";

type RequestWithSession = Request & {
	session?: UserSession & { user: UserSession["user"] & { isActive?: boolean } };
};

@Injectable()
export class RolesGuard implements CanActivate {
	public constructor(
		private reflector: Reflector,
		private readonly usersService: UsersService
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<RequestWithSession>();
		const sessionUser = request.session?.user;

		if (!sessionUser?.id) {
			// Defensive — AuthGuard (global) should have already rejected.
			// 401 (not 403) so the client can distinguish "session dead"
			// from "role denied".
			throw new UnauthorizedException("User is not authenticated");
		}

		// Deactivated accounts get 401 everywhere — this is the enforcement
		// for the admin CRUD "Is active" toggle. cookieCache: false in
		// better-auth.config.ts ensures isActive is fresh on every request.
		if (sessionUser.isActive === false) {
			throw new UnauthorizedException("Account is deactivated");
		}

		const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!requiredRoles || requiredRoles.length === 0) {
			return true;
		}

		const user = await this.usersService.findUser(sessionUser.id);
		const hasRole = user?.role && requiredRoles.includes(user.role);
		if (!hasRole) {
			throw new ForbiddenException("Insufficient permissions");
		}
		return true;
	}
}
