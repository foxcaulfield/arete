import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UsersService } from "src/users/users.service";
import { IS_PUBLIC_KEY, ROLES_KEY } from "../decorators/with-roles.decorator";
import { UserRole } from "@prisma/client";
import { JWTPayload } from "../interfaces/jwt-payload.interface";

@Injectable()
export class RolesGuard implements CanActivate {
	public constructor(
		private reflector: Reflector,
		private usersService: UsersService
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		// Check for public access
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (isPublic) return true;

		// Get required roles from metadata
		const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (!requiredRoles || requiredRoles.length === 0) return true;

		// Get user from request
		const request = context.switchToHttp().getRequest<{ user?: JWTPayload }>();
		const user: JWTPayload | undefined = request.user;

		if (!user || !user.sub) {
			throw new ForbiddenException("User not authenticated");
		}

		// Fetch the latest user from the database
		const dbUser = await this.usersService.findById(user.sub);
		if (!dbUser) {
			throw new ForbiddenException("User not found");
		}

		if (!dbUser?.role) throw new ForbiddenException();

		// Check roles (assuming dbUser.role is a string or array)
		// const userRoles = Array.isArray(dbUser.role) ? dbUser.role : [dbUser.role];
		// const hasRole = requiredRoles.some((role): boolean => userRoles.includes(role));

		const hasRole = requiredRoles.includes(dbUser.role);

		if (!hasRole) {
			throw new ForbiddenException("User does not have the required role");
		}

		return true;
	}
}
