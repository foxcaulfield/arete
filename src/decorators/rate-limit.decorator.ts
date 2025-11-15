import { CustomDecorator, SetMetadata } from "@nestjs/common";
export const RATE_LIMIT_KEY = "rate-limit";
export const RateLimit = (maxLimit: number): CustomDecorator => SetMetadata(RATE_LIMIT_KEY, maxLimit);
