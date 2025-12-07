import { Controller, Patch, Delete, Post, Body, Param } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import { AdminUsersService } from "./users.service";
import { Roles } from "src/decorators/roles.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Controller("admin/users")
@Roles("ADMIN")
export class AdminUsersController {
    public constructor(private readonly service: AdminUsersService) {}

    @Post()
    public async createUser(@Body() createData: CreateUserDto) {
        const user = await this.service.createUser(createData);
        return { success: true, user };
    }

    @Patch(":id")
    public async updateUser(@Session() session: any, @Param("id") id: string, @Body() updateData: UpdateUserDto) {
        const user = await this.service.updateUser(session, id, updateData);
        return { success: true, user };
    }

    @Delete(":id")
    public async deleteUser(@Session() session: any, @Param("id") id: string) {
        return await this.service.deleteUser(session, id);
    }
}
