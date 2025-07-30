import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityTarget,
  Repository,
  FindOptionsWhere,
  FindManyOptions,
  FindOneOptions,
  ObjectLiteral,
  EntityManager,
} from 'typeorm';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get repository for a specific entity
   */
  getRepository<Entity extends ObjectLiteral>(
    entity: EntityTarget<Entity>,
  ): Repository<Entity> {
    return this.dataSource.getRepository(entity);
  }

  /**
   * Start a database transaction
   */
  async transaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(fn);
  }

  /**
   * Get database connection info
   */
  getConnectionInfo() {
    return {
      isConnected: this.dataSource.isInitialized,
      database: this.dataSource.options.database,
      type: this.dataSource.options.type,
    };
  }

  /**
   * Generic find method
   */
  async find<Entity extends ObjectLiteral>(
    entity: EntityTarget<Entity>,
    options?: FindManyOptions<Entity>,
  ): Promise<Entity[]> {
    const repository = this.getRepository(entity);
    return repository.find(options);
  }

  /**
   * Generic findOne method
   */
  async findOne<Entity extends ObjectLiteral>(
    entity: EntityTarget<Entity>,
    options: FindOneOptions<Entity>,
  ): Promise<Entity | null> {
    const repository = this.getRepository(entity);
    return repository.findOne(options);
  }

  /**
   * Generic save method
   */
  async save<Entity extends ObjectLiteral>(
    entity: EntityTarget<Entity>,
    data: any,
  ): Promise<any> {
    const repository = this.getRepository(entity);
    return repository.save(data);
  }

  /**
   * Generic delete method
   */
  async delete<Entity extends ObjectLiteral>(
    entity: EntityTarget<Entity>,
    criteria: FindOptionsWhere<Entity>,
  ): Promise<void> {
    const repository = this.getRepository(entity);
    await repository.delete(criteria);
  }

  /**
   * Run raw SQL query
   */
  async query(sql: string, parameters?: any[]): Promise<any> {
    return this.dataSource.query(sql, parameters);
  }

  /**
   * Create a query builder
   */
  createQueryBuilder<Entity extends ObjectLiteral>(
    entity?: EntityTarget<Entity>,
    alias?: string,
  ) {
    if (entity && alias) {
      return this.dataSource.createQueryBuilder(entity, alias);
    }
    return this.dataSource.createQueryBuilder();
  }
}
