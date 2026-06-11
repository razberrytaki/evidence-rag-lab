import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { AppConfigService } from "./app.config";

export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(AppConfigService);

  app.enableCors({
    origin: config.corsOrigins
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  return app;
}
