import "reflect-metadata";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppConfigModule } from "./app-config.module";
import { AppConfigService } from "./app.config";
import { ApiAuthGuard } from "./api-auth.guard";
import { DatabaseModule } from "./database.module";
import { HealthController } from "./health.controller";
import { QueryController } from "./query.controller";
import { QueryTraceController } from "./query-trace.controller";
import { QueryService } from "./query.service";
import { QueryTraceService } from "./query-trace.service";

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => [
        {
          name: "default",
          ttl: config.rateLimitWindowMs,
          limit: config.rateLimitMax
        }
      ]
    })
  ],
  controllers: [HealthController, QueryController, QueryTraceController],
  providers: [
    QueryService,
    QueryTraceService,
    {
      provide: APP_GUARD,
      useClass: ApiAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
