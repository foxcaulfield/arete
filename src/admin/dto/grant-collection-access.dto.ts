import { CollectionAccessLevel } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class GrantCollectionAccessDto {
	@IsString()
	@IsNotEmpty()
	public userId!: string;

	@IsOptional()
	@IsEnum(CollectionAccessLevel)
	public accessLevel?: CollectionAccessLevel = CollectionAccessLevel.STUDY;
}
