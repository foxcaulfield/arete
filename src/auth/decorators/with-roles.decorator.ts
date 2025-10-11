import { CustomDecorator, SetMetadata } from "@nestjs/common";
import { UserRole } from "@prisma/client";

export const ROLES_KEY = "roles";
export const WithRoles = (...roles: Array<UserRole>): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC_KEY = "isPublic";
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
