import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { QueryController } from "./query.controller";
import { QueryTraceController } from "./query-trace.controller";

@Module({
  controllers: [HealthController, QueryController, QueryTraceController]
})
export class AppModule {}
