import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes, randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { addSeconds } from "date-fns";
import { PrismaService } from "src/prisma/prisma.service";
import { UsersService } from "src/users/users.service";
import { JWTPayload } from "./interfaces/jwt-payload.interface";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { TokensResponseDto } from "./dto/tokens-response.dto";

@Injectable()
export class AuthService {
	private static readonly REFRESH_TOKEN_EXPIRATION_SECONDS = 60 * 60 * 24 * 3; // 3 days

	private hashToken(token: string): string {
		return createHash("sha256").update(token).digest("hex");
	}

	public constructor(
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
		private readonly prismaService: PrismaService
	) {}

	public async register(dto: RegisterDto): Promise<AuthResponseDto> {
		// Check if user already exists
		const existingUser = await this.usersService.findByEmail(dto.email);

		if (existingUser) {
			throw new ConflictException("User with this email already exists");
		}

		// Create user
		const user = await this.usersService.create({
			email: dto.email,
			password: dto.password,
		});

		if (!user) {
			throw new Error("Failed to create user");
		}

		// Generate tokens
		const accessToken = await this.signAccessToken({
			id: user.id,
			tokenVersion: user.tokenVersion,
		});

		const refreshToken = await this.issueRefreshToken({ id: user.id });

		// Use the user object directly for the response DTO
		return {
			accessToken,
			refreshToken,
			user,
		};
	}

	public async login(dto: LoginDto): Promise<AuthResponseDto> {
		// Find user by email
		const user = await this.usersService.findByEmail(dto.email);

		if (!user) {
			throw new UnauthorizedException("Invalid credentials");
		}

		// Check if user is active
		if (!user.isActive) {
			throw new UnauthorizedException("Account is deactivated");
		}

		// Verify password
		const isPasswordValid = await this.usersService.verifyPasswordForUser(user.id, dto.password);
		if (!isPasswordValid) {
			throw new UnauthorizedException("Invalid credentials");
		}

		// Update last login
		await this.usersService.updateLastLogin(user.id);

		// Generate tokens
		const accessToken = await this.signAccessToken({
			id: user.id,
			tokenVersion: user.tokenVersion,
		});
		const refreshToken = await this.issueRefreshToken({ id: user.id });

		return {
			accessToken,
			refreshToken,
			user,
		};
	}

	public async refreshTokens(dto: RefreshTokenDto): Promise<TokensResponseDto> {
		const result = await this.rotateRefreshToken(dto.refreshToken);
		if (!result) {
			throw new UnauthorizedException("Invalid or expired refresh token");
		}

		return {
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
		};
	}

	// Only revoke the provided refresh token (not all tokens for the user)
	public async logout(refreshToken: string): Promise<void> {
		const tokenHash = this.hashToken(refreshToken);

		await this.prismaService.refreshToken.updateMany({
			where: {
				tokenHash,
				revoked: false,
			},
			data: { revoked: true },
		});
	}

	public async invalidateAllTokensForUser(userId: string): Promise<void> {
		// Invalidate all access tokens by bumping tokenVersion
		await this.prismaService.user.update({
			where: { id: userId },
			data: { tokenVersion: { increment: 1 } },
		});

		// Revoke all refresh tokens
		await this.prismaService.refreshToken.updateMany({
			where: { userId },
			data: { revoked: true },
		});
	}

	public async signAccessToken(user: { id: string; tokenVersion: number }): Promise<string> {
		const payload: JWTPayload = {
			sub: user.id,
			jti: randomUUID(),
			tv: user.tokenVersion,
		};

		return this.jwtService.signAsync(payload, {
			expiresIn: "15m",
		});
	}

	public async issueRefreshToken(user: { id: string }): Promise<string> {
		const token = randomBytes(64).toString("hex");
		const tokenHash = this.hashToken(token);
		const expiresAt = addSeconds(new Date(), AuthService.REFRESH_TOKEN_EXPIRATION_SECONDS); // 3 days

		await this.prismaService.refreshToken.create({
			data: {
				userId: user.id,
				tokenHash,
				expiresAt,
			},
		});

		return token;
	}

	public async rotateRefreshToken(oldToken: string): Promise<{
		accessToken: string;
		refreshToken: string;
	} | null> {
		const oldHash = this.hashToken(oldToken);

		// Find the refresh token record
		const record = await this.prismaService.refreshToken.findFirst({
			where: {
				tokenHash: oldHash,
				revoked: false,
				expiresAt: { gt: new Date() },
			},
			include: {
				user: {
					select: {
						id: true,
						tokenVersion: true,
						isActive: true,
					},
				},
			},
		});

		if (!record || !record.user.isActive) {
			return null;
		}

		// Revoke old token
		await this.prismaService.refreshToken.update({
			where: { id: record.id },
			data: { revoked: true },
		});

		// Issue new tokens
		const newRefreshToken = await this.issueRefreshToken({
			id: record.userId,
		});

		const accessToken = await this.signAccessToken({
			id: record.userId,
			tokenVersion: record.user.tokenVersion,
		});

		return {
			accessToken,
			refreshToken: newRefreshToken,
		};
	}

	// Clean up expired refresh tokens
	public async cleanupExpiredTokens(): Promise<void> {
		await this.prismaService.refreshToken.deleteMany({
			where: {
				expiresAt: { lt: new Date() },
			},
		});
	}
}
