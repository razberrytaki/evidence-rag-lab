import { NestFactory } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";

describe("AppModule", () => {
  it("boots controllers without requiring test-only dependency objects from Nest DI", async () => {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false
    });

    try {
      expect(app).toBeDefined();
    } finally {
      await app.close();
    }
  });

  it("creates the HTTP application without resolving controller dependency bags from DI", async () => {
    const app = await NestFactory.create(AppModule, {
      logger: false
    });

    try {
      expect(app).toBeDefined();
    } finally {
      await app.close();
    }
  });
});
