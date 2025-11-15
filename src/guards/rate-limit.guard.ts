import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserSession } from "@thallesp/nestjs-better-auth";
import { IncomingMessage } from "node:http";
import { RATE_LIMIT_KEY } from "src/decorators/rate-limit.decorator";
import {} from "@nestjs/throttler";
import { TooManyRequestsException } from "src/exceptions/too-many-requests.exception";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Logger } from "@nestjs/common";
interface AuthenticatedRequest extends UserSession, IncomingMessage {
	user: UserSession["user"];
}

const requestTimestamps = new Map<string, number[]>();

@Injectable()
export class RateLimitGuard implements CanActivate {
	@Inject(Reflector)
	private readonly reflector!: Reflector;

	private readonly logger = new Logger(RateLimitGuard.name);

	public constructor() {}
	public canActivate(context: ExecutionContext): boolean {
		const handler = context.getHandler();
		const classObj = context.getClass();

		const limits = this.reflector?.getAllAndMerge<number[]>(RATE_LIMIT_KEY, [handler, classObj]) || [];
		const rateLimit = limits.length > 0 ? Math.min(...limits) : 10;
		const httpContext = context.switchToHttp();
		const request = httpContext.getRequest<AuthenticatedRequest>();
		const userId = request.user.id;

		const now = Date.now();

		if (!requestTimestamps.has(userId)) {
			requestTimestamps.set(userId, []);
		}

		const userTimestamps = requestTimestamps.get(userId)!;
		userTimestamps.push(now);

		const windowTime = 60_000;
		const cutoff = now - windowTime;
		const recentRequests = userTimestamps.filter((ts): boolean => ts > cutoff);

		if (recentRequests.length > rateLimit) {
			throw new TooManyRequestsException();
		}

		return true;
	}

	@Cron(CronExpression.EVERY_10_SECONDS)
	public clearRequestRates(): void {
		this.logger.debug("Clearing request rates map");
		requestTimestamps.clear();
	}
}
