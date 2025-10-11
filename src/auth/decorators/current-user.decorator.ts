import { createParamDecorator, ExecutionContext, InternalServerErrorException } from "@nestjs/common";
import { JWTPayload } from "src/auth/interfaces/jwt-payload.interface";
import { ResponseUserDto } from "src/users/dto/response-user.dto";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JWTPayload => {
	const req = ctx.switchToHttp().getRequest<{ user?: JWTPayload }>();
	if (!req.user) {
		throw new InternalServerErrorException("JWT payload not found on request. Is JwtAuthGuard applied?");
	}
	return req.user;
});

export const CurrentAuthUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): ResponseUserDto => {
	const req = ctx.switchToHttp().getRequest<{ authUser?: ResponseUserDto }>();
	if (!req.authUser) {
		throw new InternalServerErrorException("Auth user not hydrated. Is ActiveUserGuard applied?");
	}
	return req.authUser;
});
