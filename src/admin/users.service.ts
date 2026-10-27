import {
	Injectable,
	BadRequestException,
	ConflictException,
	NotFoundException,
	ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthService, type UserSession } from "@thallesp/nestjs-better-auth";
import { BetterAuthInstanceType } from "src/configs/better-auth.config";
import { Prisma, UserRole } from "@prisma/client";
import { PaginatedResponseDto } from "src/common/types";
import { PaginationService } from "src/common/pagination.service";
import { caseInsensitiveContains } from "src/common/prisma-filters";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { FilterUserDto } from "./dto/filter-user.dto";

export interface UserListItem {
	id: string;
	email: string;
	name: string | null;
	role: UserRole;
	isActive: boolean;
	createdAt: Date;
}

@Injectable()
export class AdminUsersService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly paginationService: PaginationService,
		private readonly authService: AuthService<BetterAuthInstanceType>
	) {}

	public async findAll(filter: FilterUserDto): Promise<PaginatedResponseDto<UserListItem>> {
		const { page = 1, limit = 20, search } = filter;
		const skip = this.paginationService.calculateSkip(page, limit);

		const searchTerm = search?.trim() || undefined;
		const where: Prisma.UserWhereInput = searchTerm
			? {
					OR: [{ email: caseInsensitiveContains(searchTerm) }, { name: caseInsensitiveContains(searchTerm) }],
				}
			: {};

		const [users, total] = await Promise.all([
			this.prisma.user.findMany({
				where,
				skip,
				take: limit,
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					email: true,
					name: true,
					role: true,
					isActive: true,
					createdAt: true,
				},
			}),
			this.prisma.user.count({ where }),
		]);

		return this.paginationService.buildPaginatedResponse(users, total, page, limit);
	}

	public async createUser(dto: CreateUserDto): Promise<{ id: string; name: string; email: string }> {
		if (!dto.name || !dto.email || !dto.password) {
			throw new BadRequestException("Name, email, and password are required");
		}

		const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
		if (existing) throw new ConflictException("A user with this email already exists");

		const signUpResult = await this.authService.api.signUpEmail({
			body: { email: dto.email, password: dto.password, name: dto.name },
		});
		return {
			id: signUpResult.user.id,
			name: signUpResult.user.name,
			email: signUpResult.user.email,
		};
	}

	public async updateUser(
		session: UserSession,
		userId: string,
		updateData: UpdateUserDto
	): Promise<{ id: string; name: string; email: string; role: UserRole; isActive: boolean }> {
		const existing = await this.prisma.user.findUnique({ where: { id: userId } });
		if (!existing) throw new NotFoundException("User not found");

		if (userId === session.user.id && updateData.role && updateData.role !== UserRole.ADMIN) {
			throw new ForbiddenException("Cannot change your own admin role");
		}

		const updated = await this.prisma.user.update({
			where: { id: userId },
			data: {
				...(updateData.name && { name: updateData.name }),
				...(updateData.email && { email: updateData.email }),
				...(updateData.role && { role: updateData.role }),
				...(typeof updateData.isActive === "boolean" && { isActive: updateData.isActive }),
			},
			select: { id: true, name: true, email: true, role: true, isActive: true },
		});

		return updated;
	}

	public async deleteUser(session: UserSession, userId: string): Promise<{ success: boolean; message: string }> {
		if (userId === session.user.id) {
			throw new ForbiddenException("Cannot delete your own account");
		}

		const existing = await this.prisma.user.findUnique({ where: { id: userId } });
		if (!existing) throw new NotFoundException("User not found");

		await this.prisma.user.delete({ where: { id: userId } });
		return { success: true, message: "User deleted successfully" };
	}
}
