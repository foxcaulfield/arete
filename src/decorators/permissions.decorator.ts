export const PERMISSIONS_KEY = "permissions";
import { CustomDecorator, SetMetadata } from "@nestjs/common";
export const Permissions = (...permissions: string[]): CustomDecorator => SetMetadata(PERMISSIONS_KEY, permissions);
