import "reflect-metadata";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppConfigModule } from "./config/app-config.module";
import { AppConfigService } from "./config/app.config";
import { HealthModule } from "./health/health.module";
import { QueryModule } from "./query/query.module";
import { QueryTracesModule } from "./query-traces/query-traces.module";
import { ApiAuthGuard } from "./security/api-auth.guard";

@Module({
  imports: [
    AppConfigModule,
    HealthModule,
    QueryModule,
    QueryTracesModule,
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
  providers: [
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
