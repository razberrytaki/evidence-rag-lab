import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/app-config.module";
import { DatabaseModule } from "../database/database.module";
import { QueryController } from "./query.controller";
import { defaultQueryPipelineRunner, QUERY_PIPELINE_RUNNER, QueryService } from "./query.service";

@Module({
  imports: [AppConfigModule, DatabaseModule],
  controllers: [QueryController],
  providers: [
    {
      provide: QUERY_PIPELINE_RUNNER,
      useValue: defaultQueryPipelineRunner
    },
    QueryService
  ]
})
export class QueryModule {}
