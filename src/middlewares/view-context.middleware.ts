import { Injectable, NestMiddleware } from "@nestjs/common";
import { AuthService } from "@thallesp/nestjs-better-auth";
import { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class ViewContextMiddleware implements NestMiddleware {
	public constructor(
		private readonly authService: AuthService,
		private readonly prismaService: PrismaService
	) {}
	public async use(req: Request, res: Response, next: NextFunction): Promise<void> {
		const session = await this.authService.api.getSession({
			headers: fromNodeHeaders(req.headers),
		});

		res.locals.isAuthenticated = !!session;
		res.locals.currentPath = req.path;
		res.locals.isAdmin = false;

		if (session?.user?.id) {
			const user = await this.prismaService.user.findUnique({
				where: { id: session.user.id },
				select: { role: true },
			});
			res.locals.isAdmin = user?.role === "ADMIN";
		}

		next();
	}
}
