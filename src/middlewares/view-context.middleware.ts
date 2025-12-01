import { Injectable, NestMiddleware } from "@nestjs/common";
import { AuthService } from "@thallesp/nestjs-better-auth";
import { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";

@Injectable()
export class ViewContextMiddleware implements NestMiddleware {
	public constructor(private readonly authService: AuthService) {}
	public async use(req: Request, res: Response, next: NextFunction): Promise<void> {
		const user = await this.authService.api.getSession({
			headers: fromNodeHeaders(req.headers),
		});

		res.locals.isAuthenticated = !!user;
		next();
	}
}
