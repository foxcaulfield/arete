export interface JWTPayload {
	sub: string; // userId
	jti: string; // JWT id
	tv: number; // tokenVersion snapshot
	iat?: number;
	exp?: number;
}
