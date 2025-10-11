import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { TokensResponseDto } from "./dto/tokens-response.dto";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { type JWTPayload } from "./interfaces/jwt-payload.interface";
import { CurrentUser } from "./decorators/current-user.decorator";

@Controller("auth")
export class AuthController {
	public constructor(private readonly authService: AuthService) {}

	@Post("register")
	public async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
		return this.authService.register(dto);
	}

	@UseGuards(LocalAuthGuard)
	@Post("login")
	@HttpCode(HttpStatus.OK)
	public async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
		return this.authService.login(dto);
	}

	@UseGuards(JwtAuthGuard)
	@Post("refresh")
	@HttpCode(HttpStatus.OK)
	public async refresh(@Body() dto: RefreshTokenDto): Promise<TokensResponseDto> {
		return this.authService.refreshTokens(dto);
	}

	@UseGuards(JwtAuthGuard)
	@Post("logout")
	@HttpCode(HttpStatus.NO_CONTENT)
	public async logout(@CurrentUser() user: JWTPayload): Promise<void> {
		return this.authService.invalidateAllTokensForUser(user.sub);
	}

	@UseGuards(JwtAuthGuard)
	@Post("logout-session")
	@HttpCode(HttpStatus.NO_CONTENT)
	public async logoutSession(@Body() dto: RefreshTokenDto): Promise<void> {
		return this.authService.logout(dto.refreshToken);
	}
}
