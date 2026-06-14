import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppConfigService, validateAppConfig } from "./app.config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateAppConfig
    })
  ],
  providers: [AppConfigService],
  exports: [AppConfigService]
})
export class AppConfigModule {}
