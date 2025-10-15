import { HttpStatus, Injectable } from "@nestjs/common";
import { BeforeHook, Hook, type AuthHookContext } from "@thallesp/nestjs-better-auth";
import { APIError } from "better-auth";
// import { SignUpService } from "./sign-up.service";

@Hook()
@Injectable()
export class SignUpHook {
	// public constructor(private readonly signUpService: SignUpService) {}

	@BeforeHook()
	public async handle(ctx: AuthHookContext): Promise<void> {
		const allowedPaths = ["/sign-in/email", "/sign-up/email", "/get-session", "/sign-out"];

		if (allowedPaths.includes(ctx.path)) {
			await Promise.resolve();
			return;
		}
		throw new APIError(HttpStatus.BAD_REQUEST, { message: "Invalid path (forbidden action)" });

		// Custom logic like enforcing email domain registration
		// Can throw APIError if validation fails
		// await this.signUpService.execute(ctx);
		// console.log("Sign-up hook executed", ctx);
	}
}
