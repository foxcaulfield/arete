import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserPermission } from "@prisma/client";
import { UserSession } from "@thallesp/nestjs-better-auth";
import { PERMISSIONS_KEY } from "src/decorators/permissions.decorator";
import { UsersService } from "src/users/users.service";
import type { Request } from "express";

type RequestWithSession = Request & { session?: UserSession };

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

		const request = ctx.switchToHttp().getRequest<RequestWithSession>();
		const sessionUser = request.session?.user;

		if (!sessionUser?.id) {
			throw new ForbiddenException("User is not authenticated");
		}

		const user = await this.users.findUser(sessionUser.id);
		const userPermissions = user?.permissions?.map((p: { name: UserPermission }): UserPermission => p.name) || [];
		const hasPermission = required.every((p): boolean => userPermissions.includes(p));

		if (!hasPermission) {
			throw new ForbiddenException("Insufficient permissions");
		}
		return true;
	}
}
