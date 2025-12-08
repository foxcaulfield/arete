import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { BeforeHook, Hook, type AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth";
import { PrismaService } from "src/prisma/prisma.service";
import { APP_LIMITS_SYMBOL } from "src/configs/app-limits.config";
import type { AppLimitsConfig } from "src/configs/app-limits.config";

@Hook()
@Injectable()
export class SignUpHook {
	public constructor(
		private readonly prismaService: PrismaService,
		@Inject(APP_LIMITS_SYMBOL) private readonly appLimits: AppLimitsConfig
	) {}

	@BeforeHook()
	public async handle(ctx: AuthHookContext): Promise<void> {
		const allowedPaths = ["/sign-in/email", "/sign-up/email", "/get-session", "/sign-out"];

		if (!allowedPaths.includes(ctx.path)) {
			throw new APIError(HttpStatus.BAD_REQUEST, { message: "Invalid path (forbidden action)" });
		}

		// Check registration limit for sign-up
		if (ctx.path === "/sign-up/email") {
			const userCount = await this.prismaService.user.count();
			if (userCount >= this.appLimits.MAX_REGISTERED_USERS) {
				throw new APIError(HttpStatus.FORBIDDEN, {
					message: "Registration is currently closed. Maximum user limit reached.",
				});
			}
		}
	}
}
