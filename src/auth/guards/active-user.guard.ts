import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UsersService } from "../../users/users.service";
import { JWTPayload } from "src/auth/interfaces/jwt-payload.interface";
import { IS_PUBLIC_KEY } from "src/auth/decorators/with-roles.decorator";

@Injectable()
export class ActiveUserGuard implements CanActivate {
	public constructor(
		private readonly usersService: UsersService,
		private readonly reflector: Reflector
	) {}

	public async canActivate(ctx: ExecutionContext): Promise<boolean> {
		// Check for public access
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
		if (isPublic) return true;

		const req = ctx.switchToHttp().getRequest<{ user?: JWTPayload; authUser?: any }>();
		const jwtUser = req.user;
		if (!jwtUser?.sub) throw new UnauthorizedException();

		const user = await this.usersService.findById(jwtUser.sub);

		if (!user) throw new UnauthorizedException("User not found");
		if (!user.isActive) throw new ForbiddenException("User is blocked");
		if (user.tokenVersion !== (jwtUser.tv ?? -1)) {
			throw new UnauthorizedException("Token invalidated");
		}

		req.authUser = user;
		return true;
	}
}
