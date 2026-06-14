import type { INestApplication } from "@nestjs/common";
import { createRequestValidationPipe } from "./common/request-validation.pipe";
import { AppConfigService } from "./config/app.config";

export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(AppConfigService);

  app.enableCors({
    origin: config.corsOrigins
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(createRequestValidationPipe());

  return app;
}
