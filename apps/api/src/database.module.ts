import { Inject, Injectable, Module, OnApplicationShutdown } from "@nestjs/common";
import { AppConfigModule } from "./app-config.module";
import { AppConfigService } from "./app.config";
import type { QueryExecutor } from "./postgres-rag.pipeline";

export const PG_POOL = Symbol("PG_POOL");

export interface PgPool extends QueryExecutor {
  end(): Promise<void>;
}

const pgPoolProvider = {
  provide: PG_POOL,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService): PgPool => {
    const pg = require("pg") as {
      Pool: new (config: { connectionString: string }) => PgPool;
    };
    return new pg.Pool({ connectionString: config.databaseUrl });
  }
};

@Injectable()
class PgPoolShutdown implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  imports: [AppConfigModule],
  providers: [pgPoolProvider, PgPoolShutdown],
  exports: [PG_POOL]
})
export class DatabaseModule {}
