import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { UsersService } from "src/users/users.service";
import { UserSession } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";

type RequestWithSession = Request & { session?: UserSession };

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

		// AuthGuard (global) runs before this guard (controller-scoped) and
		// populates request.session = { user, session }. Read from there.
		const request = context.switchToHttp().getRequest<RequestWithSession>();
		const sessionUser = request.session?.user;

		if (!sessionUser?.id) {
			throw new ForbiddenException("User is not authenticated");
		}

		const user = await this.usersService.findUser(sessionUser.id);

		const hasRole = user?.role && requiredRoles.includes(user?.role);
		if (!hasRole) {
			throw new ForbiddenException("Insufficient permissions");
		}

		return true;
	}
}
