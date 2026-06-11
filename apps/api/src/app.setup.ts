import type { INestApplication } from "@nestjs/common";
import { AppConfigService } from "./app.config";
import { createRequestValidationPipe } from "./request-validation.pipe";

export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(AppConfigService);

  app.enableCors({
    origin: config.corsOrigins
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(createRequestValidationPipe());

  return app;
}
