import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { validateAppConfig } from "../src/app.config";

const MUTABLE_ENV_KEYS = [
  "API_AUTH_TOKEN",
  "API_CORS_ORIGINS",
  "API_RATE_LIMIT_MAX",
  "API_RATE_LIMIT_WINDOW_MS",
  "RAG_QUERY_MODE"
] as const;

type MutableEnvKey = (typeof MUTABLE_ENV_KEYS)[number];

const originalEnv = new Map<MutableEnvKey, string | undefined>();
let app: INestApplication | undefined;

for (const key of MUTABLE_ENV_KEYS) {
  originalEnv.set(key, process.env[key]);
}

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }

  for (const key of MUTABLE_ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("App HTTP security boundaries", () => {
  it("rejects query requests without a valid question DTO", async () => {
    app = await createInitializedApp();

    const response = await request(app.getHttpServer()).post("/query").send({ extra: "field" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      message: expect.arrayContaining([expect.stringContaining("question")])
    });
  });

  it("rejects non-whitelisted query request fields", async () => {
    app = await createInitializedApp();

    const response = await request(app.getHttpServer()).post("/query").send({
      question: "Why not rely only on semantic vectors?",
      extra: "field"
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      message: expect.arrayContaining([expect.stringContaining("property extra should not exist")])
    });
  });

  it("requires a bearer token for protected API routes when API_AUTH_TOKEN is configured", async () => {
    process.env.API_AUTH_TOKEN = "test-api-token";
    app = await createInitializedApp();

    const response = await request(app.getHttpServer()).get("/query-traces/latest");

    expect(response.status).toBe(401);
  });

  it("rate limits repeated query requests", async () => {
    process.env.API_RATE_LIMIT_MAX = "1";
    process.env.API_RATE_LIMIT_WINDOW_MS = "60000";
    app = await createInitializedApp();

    const first = await request(app.getHttpServer()).post("/query").send({
      question: "Why not rely only on semantic vectors?"
    });
    const second = await request(app.getHttpServer()).post("/query").send({
      question: "Why not rely only on semantic vectors?"
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(429);
  });

  it("rejects unsupported RAG_QUERY_MODE during config validation", () => {
    expect(() => validateAppConfig({ RAG_QUERY_MODE: "bad-mode" })).toThrow(/RAG_QUERY_MODE/);
  });
});

async function createInitializedApp(): Promise<INestApplication> {
  const created = await NestFactory.create(AppModule, { logger: false });
  configureApp(created);
  await created.init();
  return created;
}
