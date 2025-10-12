import { Injectable } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { ResponseUserDto } from "./dto/response-user.dto";
import { plainToInstance } from "class-transformer";

@Injectable()
export class UsersService {
	public constructor(
		private readonly prismaService: PrismaService // Assume PrismaService is imported at module level
	) {}

	private readonly defaultUserSelect: Prisma.UserSelect = {
		id: true,
		email: true,
		role: true,
		isActive: true,
		permissions: true,
	};

	private toResponseDto(entity: User): ResponseUserDto;
	private toResponseDto(entity: User[]): ResponseUserDto[];
	private toResponseDto(entity: User | User[]): ResponseUserDto | ResponseUserDto[] {
		if (Array.isArray(entity)) {
			return entity.map((user): ResponseUserDto => this.convertToResponseDto(user));
		}
		return this.convertToResponseDto(entity);
	}

	private convertToResponseDto(user: User): ResponseUserDto {
		return plainToInstance(ResponseUserDto, {
			id: user.id,
			email: user.email,
			role: user.role,
			isActive: user.isActive,
			permissions: user.permissions,
		});
	}

	public async findById(id: string): Promise<ResponseUserDto | null> {
		const user = await this.prismaService.user.findUnique({
			where: { id },
			select: this.defaultUserSelect,
		});

		return user && this.toResponseDto(user);
	}

	public async findByEmail(email: string): Promise<ResponseUserDto | null> {
		const user = await this.prismaService.user.findUnique({
			where: { email },
			select: this.defaultUserSelect,
		});
		return user && this.toResponseDto(user);
	}

	// public async create(data: CreateUserDto): Promise<ResponseUserDto> {
	// 	// Hash password
	// 	const passwordHash = await argon2.hash(data.password);

	// 	const user = await this.prismaService.user.create({
	// 		data: {
	// 			email: data.email,
	// 			passwordHash: passwordHash,
	// 			isActive: data.isActive ?? true,
	// 			permissions: data.permissions ?? [],
	// 		},
	// 	});

	// 	return this.toResponseDto(user);
	// }

	// public async validateUser(email: string, password: string): Promise<ResponseUserDto | null> {
	// 	const user = await this.prismaService.user.findUnique({
	// 		where: { email },
	// 		select: {
	// 			...this.defaultUserSelect,
	// 			passwordHash: true,
	// 		},
	// 	});

	// 	if (!user || !user.isActive) {
	// 		return null;
	// 	}

	// 	const isPasswordValid = await this.verifyPassword(user.passwordHash, password);
	// 	if (!isPasswordValid) {
	// 		return null;
	// 	}

	// 	// Remove passwordHash before converting to DTO
	// 	return this.toResponseDto(user);
	// }

	// public async verifyPasswordForUser(userId: string, password: string): Promise<boolean> {
	// 	const user = await this.prismaService.user.findUniqueOrThrow({
	// 		where: { id: userId },
	// 		select: { passwordHash: true },
	// 	});

	// 	return this.verifyPassword(user.passwordHash, password);
	// }

	// private async verifyPassword(passwordHash: string, password: string): Promise<boolean> {
	// 	return argon2.verify(passwordHash, password);
	// }

	public async updateLastLogin(userId: string): Promise<void> {
		await this.prismaService.user.update({
			where: { id: userId },
			data: { lastLogin: new Date() },
		});
	}

	public async delete(id: string): Promise<void> {
		await this.prismaService.user.delete({
			where: { id },
		});
	}
}
