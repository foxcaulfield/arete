import { Controller, Patch, Delete, Post, Body, Param } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { AdminUsersService } from "./users.service";
import { Roles } from "src/decorators/roles.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Controller("admin/users")
@Roles("ADMIN")
export class AdminUsersController {
	public constructor(private readonly service: AdminUsersService) {}

	@Post()
	public async createUser(
		@Body() createData: CreateUserDto
	): Promise<{ success: boolean; user: { id: string; name: string; email: string } }> {
		const user = await this.service.createUser(createData);
		return { success: true, user };
	}

	@Patch(":id")
	public async updateUser(
		@Session() session: UserSession,
		@Param("id") id: string,
		@Body() updateData: UpdateUserDto
	): Promise<{
		success: boolean;
		user: { id: string; name: string; email: string; role: string; isActive: boolean };
	}> {
		const user = await this.service.updateUser(session, id, updateData);
		return { success: true, user };
	}

	@Delete(":id")
	public async deleteUser(
		@Session() session: UserSession,
		@Param("id") id: string
	): Promise<{ success: boolean; message: string }> {
		return await this.service.deleteUser(session, id);
	}
}
