import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

export type PersistenceAdapter = 'IN_MEMORY' | 'POSTGRES';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  readonly persistenceAdapter: PersistenceAdapter;

  constructor(config: ConfigService) {
    const persistenceAdapter = config.get<PersistenceAdapter>(
      'PERSISTENCE_ADAPTER',
      'IN_MEMORY',
    );
    const databaseUrl = config.get<string>('DATABASE_URL');
    super(
      persistenceAdapter === 'POSTGRES' && databaseUrl
        ? { datasources: { db: { url: databaseUrl } } }
        : {},
    );
    this.persistenceAdapter = persistenceAdapter;
  }

  get isPostgres(): boolean {
    return this.persistenceAdapter === 'POSTGRES';
  }

  async ping(): Promise<void> {
    if (!this.isPostgres) return;
    const rows = await this.$queryRawUnsafe<
      Array<{
        migrations: string | null;
        orders: string | null;
        procurements: string | null;
        catalog: string | null;
        crawler: string | null;
        customers: string | null;
        sessions: string | null;
        addresses: string | null;
      }>
    >(
      `SELECT
        to_regclass('_prisma_migrations')::text AS migrations,
        to_regclass('orders')::text AS orders,
        to_regclass('procurement_tasks')::text AS procurements,
        to_regclass('catalog_books')::text AS catalog,
        to_regclass('crawler_checkpoints')::text AS crawler,
        to_regclass('customers')::text AS customers,
        to_regclass('customer_sessions')::text AS sessions,
        to_regclass('customer_addresses')::text AS addresses`,
    );
    const state = rows[0];
    if (
      !state?.migrations ||
      !state.orders ||
      !state.procurements ||
      !state.catalog ||
      !state.crawler || !state.customers || !state.sessions || !state.addresses
    ) {
      throw new Error('PostgreSQL persistence schema is not migrated');
    }
    // Password login is built in, so readiness must check its additive migration too.
    await this.$queryRawUnsafe('SELECT email, password_hash FROM customers LIMIT 0');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
