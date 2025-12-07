import { IsEmail, IsOptional, IsEnum, IsBoolean, IsString } from "class-validator";
import { UserRole } from "@prisma/client";

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    public name?: string;

    @IsOptional()
    @IsEmail()
    public email?: string;

    @IsOptional()
    @IsEnum(UserRole)
    public role?: UserRole;

    @IsOptional()
    @IsBoolean()
    public isActive?: boolean;
}
