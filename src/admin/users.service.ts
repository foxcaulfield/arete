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
import { UserRole } from "@prisma/client";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class AdminUsersService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly authService: AuthService<BetterAuthInstanceType>
	) {}

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
			// role: dto.role || UserRole.USER,
			// isActive: true,
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
		// Prevent admin from deleting themselves
		if (userId === session.user.id) {
			throw new ForbiddenException("Cannot delete your own account");
		}

		const existing = await this.prisma.user.findUnique({ where: { id: userId } });
		if (!existing) throw new NotFoundException("User not found");

		await this.prisma.user.delete({ where: { id: userId } });
		return { success: true, message: "User deleted successfully" };
	}
}
