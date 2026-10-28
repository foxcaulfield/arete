import { Module } from "@nestjs/common";
import { SrsService } from "./srs.service";
import { PrismaModule } from "src/prisma/prisma.module";

@Module({
	imports: [PrismaModule],
	providers: [SrsService],
	exports: [SrsService],
})
export class SrsModule {}
