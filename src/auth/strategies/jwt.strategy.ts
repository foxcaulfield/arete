import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy as PassportJwtStrategy } from "passport-jwt";
import { UnauthorizedException } from "@nestjs/common";
import { JWTPayload } from "../interfaces/jwt-payload.interface";

/**
 * Passport strategy that verifies JWT bearer tokens and returns the decoded payload (when JwtAuthGuard is used).
 * It only validates signature/expiration (no DB calls) — downstream guards should
 * hydrate the user from the DB and enforce isActive/tokenVersion/roles.
 */
export class JwtStrategy extends PassportStrategy(PassportJwtStrategy, "jwt") {
	public constructor() {
		if (!process.env.JWT_SECRET) {
			throw new Error("JWT_SECRET is not defined in environment variables");
		}

		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: process.env.JWT_SECRET,
		});
	}
	public validate(payload: JWTPayload): JWTPayload {
		if (!payload.sub || !payload.jti || typeof payload.tv !== "number") {
			throw new UnauthorizedException("Invalid JWT payload");
		}
		return payload;
	}
}
