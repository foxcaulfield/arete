import { Strategy } from "passport-local";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ResponseUserDto } from "src/users/dto/response-user.dto";
import { UsersService } from "src/users/users.service";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
	public constructor(private readonly userService: UsersService) {
		super({
			usernameField: "email",
			passwordField: "password",
		});
	}

	public async validate(email: string, password: string): Promise<ResponseUserDto> {
		const result = await this.userService.validateUser(email, password);
		if (!result) {
			throw new UnauthorizedException();
		}
		return result;
	}
}
