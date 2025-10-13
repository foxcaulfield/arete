import { CustomDecorator, SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const Roles = (...args: string[]): CustomDecorator => SetMetadata(ROLES_KEY, args);
