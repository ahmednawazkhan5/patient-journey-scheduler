import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';

export default registerAs('database', (): TypeOrmModuleOptions => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // PostgreSQL configuration
  if (
    process.env.DATABASE_URL &&
    process.env.DATABASE_URL.startsWith('postgresql://')
  ) {
    return {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: isDevelopment,
      logging: isDevelopment,
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      migrationsRun: false,
    };
  }

  // Fallback to SQLite for backwards compatibility
  return {
    type: 'sqlite',
    database:
      process.env.DATABASE_URL ||
      path.join(process.cwd(), 'data', 'database.sqlite'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: isDevelopment,
    logging: isDevelopment,
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    migrationsRun: false,
  };
});
