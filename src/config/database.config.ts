import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'sqlite',
    database:
      process.env.DATABASE_URL ||
      path.join(process.cwd(), 'data', 'database.sqlite'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    migrationsRun: false,
  }),
);
