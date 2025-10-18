import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { BaseService } from "src/base/base.service";
import { Prisma } from "@prisma/client";

type UserWithPermissions = Prisma.UserGetPayload<{
	include: { permissions: true };
}>;

@Injectable()
export class UsersService extends BaseService {
	// private readonly defaultUserSelect: Prisma.UserSelect = {
	// 	id: true,
	// 	email: true,
	// 	isActive: true,
	// };

	public constructor(private readonly prismaService: PrismaService) {
		super();
	}

	public async findUser(userId: string): Promise<UserWithPermissions> {
		const user = await this.prismaService.user.findUnique({
			where: { id: userId },
			include: {
				permissions: true,
			},
			// select: this.defaultUserSelect,
		});
		if (!user) {
			throw new NotFoundException("User not found");
		}

		return user;
		// return this.toResponseDto(ResponseUserDto, user);
	}

	protected async updateLastLogin(userId: string): Promise<void> {
		await this.prismaService.user.update({
			where: { id: userId },
			data: { lastLogin: new Date() },
		});
	}

	protected async delete(id: string): Promise<void> {
		await this.prismaService.user.delete({
			where: { id },
		});
	}
}
