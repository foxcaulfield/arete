import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Get } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { TokensResponseDto } from "./dto/tokens-response.dto";
import { type JWTPayload } from "./interfaces/jwt-payload.interface";
import { CurrentAuthUser, CurrentUser } from "./decorators/current-user.decorator";
import { RolesGuard } from "./guards/roles.guard";
import { Public, WithRoles } from "./decorators/with-roles.decorator";
import { UserRole } from "@prisma/client";
import { ResponseUserDto } from "src/users/dto/response-user.dto";
// import { Public } from "./decorators/with-roles.decorator";

@Controller("auth")
export class AuthController {
	public constructor(private readonly authService: AuthService) {}

	@Public()
	@Post("register")
	public async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
		return this.authService.register(dto);
	}

	@HttpCode(HttpStatus.OK)
	@Public()
	@Post("login")
	public async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
		return this.authService.login(dto);
	}

	@Post("refresh")
	@Public()
	@HttpCode(HttpStatus.OK)
	public async refresh(@Body() dto: RefreshTokenDto): Promise<TokensResponseDto> {
		return this.authService.refreshTokens(dto);
	}

	@Post("logout")
	@HttpCode(HttpStatus.NO_CONTENT)
	public async logout(@CurrentUser() user: JWTPayload): Promise<void> {
		return this.authService.invalidateAllTokensForUser(user.sub);
	}

	@Post("logout-session")
	@HttpCode(HttpStatus.NO_CONTENT)
	public async logoutSession(@Body() dto: RefreshTokenDto): Promise<void> {
		return this.authService.logout(dto.refreshToken);
	}

	@HttpCode(HttpStatus.OK)
	@Get("me")
	public getMe(@CurrentUser() user: JWTPayload): { id: string } {
		return { id: user.sub };
	}
	@WithRoles(UserRole.ADMIN)
	@UseGuards(RolesGuard)
	@HttpCode(HttpStatus.OK)
	@Get("profile")
	public getAdminMe(@CurrentAuthUser() user: ResponseUserDto): ResponseUserDto {
		return user;
	}
}
