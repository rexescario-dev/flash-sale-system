import { PrismaClient } from '@prisma/client';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale';

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

type ColumnRow = {
  column_name: string;
  data_type: string;
  datetime_precision: null | number;
  is_nullable: 'NO' | 'YES';
};

describe('flash sale PostgreSQL schema (#15)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates products, flash_sales, and purchases tables', async () => {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('products', 'flash_sales', 'purchases')
      ORDER BY table_name
    `;

    expect(tables.map((row) => row.table_name)).toEqual(['flash_sales', 'products', 'purchases']);
  });

  it('defines id primary keys on all three tables', async () => {
    const keys = await prisma.$queryRaw<{ column_name: string; table_name: string }[]>`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_name IN ('products', 'flash_sales', 'purchases')
      ORDER BY tc.table_name
    `;

    expect(keys).toEqual([
      { column_name: 'id', table_name: 'flash_sales' },
      { column_name: 'id', table_name: 'products' },
      { column_name: 'id', table_name: 'purchases' },
    ]);
  });

  it('stores id columns as text with no database default', async () => {
    const idColumns = await prisma.$queryRaw<
      {
        column_default: null | string;
        column_name: string;
        data_type: string;
        table_name: string;
      }[]
    >`
      SELECT table_name, column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('products', 'flash_sales', 'purchases')
        AND column_name = 'id'
      ORDER BY table_name
    `;

    expect(idColumns).toEqual([
      {
        column_default: null,
        column_name: 'id',
        data_type: 'text',
        table_name: 'flash_sales',
      },
      {
        column_default: null,
        column_name: 'id',
        data_type: 'text',
        table_name: 'products',
      },
      {
        column_default: null,
        column_name: 'id',
        data_type: 'text',
        table_name: 'purchases',
      },
    ]);
  });

  it('exposes exact snake_case physical column sets (no unexpected columns)', async () => {
    const columns = await prisma.$queryRaw<
      { column_name: string; is_nullable: 'NO' | 'YES'; table_name: string }[]
    >`
      SELECT table_name, column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('products', 'flash_sales', 'purchases')
      ORDER BY table_name, column_name
    `;

    const byTable = (table: string) =>
      columns
        .filter((row) => row.table_name === table)
        .map((row) => ({ column_name: row.column_name, is_nullable: row.is_nullable }));

    expect(byTable('products')).toEqual([
      { column_name: 'created_at', is_nullable: 'NO' },
      { column_name: 'description', is_nullable: 'YES' },
      { column_name: 'id', is_nullable: 'NO' },
      { column_name: 'name', is_nullable: 'NO' },
      { column_name: 'updated_at', is_nullable: 'NO' },
    ]);

    expect(byTable('flash_sales')).toEqual([
      { column_name: 'created_at', is_nullable: 'NO' },
      { column_name: 'ends_at', is_nullable: 'NO' },
      { column_name: 'id', is_nullable: 'NO' },
      { column_name: 'product_id', is_nullable: 'NO' },
      { column_name: 'remaining_stock', is_nullable: 'NO' },
      { column_name: 'starts_at', is_nullable: 'NO' },
      { column_name: 'total_stock', is_nullable: 'NO' },
      { column_name: 'updated_at', is_nullable: 'NO' },
    ]);

    expect(byTable('purchases')).toEqual([
      { column_name: 'created_at', is_nullable: 'NO' },
      { column_name: 'flash_sale_id', is_nullable: 'NO' },
      { column_name: 'id', is_nullable: 'NO' },
      { column_name: 'purchased_at', is_nullable: 'NO' },
      { column_name: 'updated_at', is_nullable: 'NO' },
      { column_name: 'user_id', is_nullable: 'NO' },
    ]);
  });

  it('stores all timestamps as timestamptz with precision 3', async () => {
    const timestampColumns = await prisma.$queryRaw<ColumnRow[]>`
      SELECT table_name, column_name, data_type, datetime_precision, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('products', 'flash_sales', 'purchases')
        AND column_name IN (
          'created_at', 'updated_at', 'starts_at', 'ends_at', 'purchased_at'
        )
      ORDER BY table_name, column_name
    `;

    expect(timestampColumns.length).toBeGreaterThan(0);
    for (const column of timestampColumns) {
      expect(column.data_type).toBe('timestamp with time zone');
      expect(column.datetime_precision).toBe(3);
    }
  });

  it('defines Restrict foreign keys and FK indexes', async () => {
    const foreignKeys = await prisma.$queryRaw<
      {
        column_name: string;
        constraint_name: string;
        delete_rule: string;
        foreign_column_name: string;
        foreign_table_name: string;
        table_name: string;
      }[]
    >`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
       AND rc.constraint_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('flash_sales', 'purchases')
      ORDER BY tc.table_name, kcu.column_name
    `;

    expect(foreignKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          column_name: 'product_id',
          delete_rule: 'RESTRICT',
          foreign_column_name: 'id',
          foreign_table_name: 'products',
          table_name: 'flash_sales',
        }),
        expect.objectContaining({
          column_name: 'flash_sale_id',
          delete_rule: 'RESTRICT',
          foreign_column_name: 'id',
          foreign_table_name: 'flash_sales',
          table_name: 'purchases',
        }),
      ]),
    );

    const indexes = await prisma.$queryRaw<
      { indexdef: string; indexname: string; tablename: string }[]
    >`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('flash_sales', 'purchases')
    `;

    expect(
      indexes.some((idx) => idx.tablename === 'flash_sales' && idx.indexdef.includes('product_id')),
    ).toBe(true);
    expect(
      indexes.some(
        (idx) => idx.tablename === 'purchases' && idx.indexdef.includes('flash_sale_id'),
      ),
    ).toBe(true);

    // #15 contract: no standalone purchases(user_id) index (composite unique is #16).
    expect(
      indexes.some(
        (idx) => idx.tablename === 'purchases' && /\(\s*user_id\s*\)/.test(idx.indexdef),
      ),
    ).toBe(false);
  });

  it('defines the four named FlashSale CHECK constraints', async () => {
    // Umbrella #15 contract asserts CHECK constraints by name (not by pg expression text).
    const checks = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname
      FROM pg_constraint
      WHERE contype = 'c'
        AND conrelid = 'public.flash_sales'::regclass
      ORDER BY conname
    `;

    const names = checks.map((row) => row.conname);
    expect(names).toEqual(
      expect.arrayContaining([
        'flash_sales_total_stock_positive',
        'flash_sales_remaining_stock_non_negative',
        'flash_sales_remaining_stock_lte_total',
        'flash_sales_starts_before_ends',
      ]),
    );
  });
});
