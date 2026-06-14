import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/app-config.module";
import { DatabaseModule } from "../database/database.module";
import { QueryTraceController } from "./query-trace.controller";
import { QueryTraceService } from "./query-trace.service";

@Module({
  imports: [AppConfigModule, DatabaseModule],
  controllers: [QueryTraceController],
  providers: [QueryTraceService]
})
export class QueryTracesModule {}
