# Patient Journey Scheduler

A scalable, event-driven patient journey automation system built with NestJS and TypeScript. This system orchestrates multi-step patient care workflows with message delivery, conditional logic, and time-based delays.

## How to Run the Project

### Prerequisites
- Node.js 18+
- pnpm package manager
- Docker & Docker Compose

### Setup & Run

1. **Start PostgreSQL database**:
   ```bash
   docker-compose up -d postgres
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Run the application**:
   ```bash
   # Development mode with hot reload
   pnpm run start:dev

   # Production mode
   pnpm run start:prod
   ```

4. **Run tests**:
   ```bash
   # Unit tests
   pnpm run test

   # E2E tests
   pnpm run test:e2e

   # Test coverage
   pnpm run test:cov
   ```

### API Documentation

The application includes comprehensive **Swagger/OpenAPI documentation** for easy API exploration and testing:

- **Interactive Documentation**: Visit `http://localhost:3000/api` when the application is running
- **API Explorer**: Test endpoints directly from the browser interface
- **Schema Definitions**: Complete request/response models with validation rules
- **Authentication**: Built-in support for testing authenticated endpoints

#### Swagger Features
- **Real-time Testing**: Execute API calls directly from the documentation
- **Request Examples**: Pre-populated example payloads for all endpoints
- **Response Schemas**: Detailed response structure with status codes
- **Parameter Documentation**: Query parameters, path variables, and request bodies
- **Error Responses**: Documented error scenarios with example responses

The Swagger client provides a complete reference for:
- Journey creation and management
- Patient journey execution
- Journey run status monitoring
- Worker health and status endpoints

## Horizontal Scaling for Workers

The system supports horizontal scaling through multiple worker instances that can resume pending job runs:

### Worker Architecture
- **Polling-based Workers**: Multiple `JourneyWorkerService` instances poll the database for ready journeys
- **Pessimistic Locking**: Uses `FOR UPDATE` locks to prevent race conditions between workers
- **Atomic Claiming**: Workers atomically claim jobs by changing status from `WAITING_DELAY` to `IN_PROGRESS`
- **Batch Processing**: Configurable batch size (default: 1000) for efficient processing

### Scaling Strategy
```typescript
// Multiple worker instances can run simultaneously
const worker1 = new JourneyWorkerService(db, executionService);
const worker2 = new JourneyWorkerService(db, executionService);

worker1.startWorker(5000); // Poll every 5 seconds
worker2.startWorker(3000); // Poll every 3 seconds
```

Workers automatically:
- Find journeys with `resumeAt <= NOW()`
- Lock rows to prevent double-processing
- Update status atomically
- Process in separate transactions to avoid deadlocks

## Delay Node & Efficient Task Scheduling

### Delay Node Implementation
The delay mechanism follows an efficient task scheduler pattern:

```typescript
interface DelayNode {
  id: string;
  type: NodeType.DELAY;
  duration_seconds: number;
  next_node_id: string | null;
}
```

### Scheduling Pattern
1. **No Active Waiting**: Delay nodes don't block threads or use timers
2. **Database-Driven**: Future execution time stored as `resumeAt` timestamp
3. **Worker Polling**: Background workers periodically check for ready tasks
4. **Scalable**: Supports millions of delayed tasks without memory overhead

### Process Flow
```
Journey reaches DELAY node →
Calculate resumeAt = NOW() + duration_seconds →
Set status to WAITING_DELAY →
Worker finds resumeAt <= NOW() →
Resume journey execution
```

This approach ensures:
- **Memory Efficiency**: No in-memory timers or queues
- **Persistence**: Delays survive application restarts
- **Scalability**: Unlimited concurrent delayed tasks
- **Reliability**: No lost delays due to process failures

## Interface-Driven Decoupled Architecture

The system follows strict interface segregation and dependency inversion:

### Core Interfaces
```typescript
// Clean domain interfaces
interface Journey {
  id: string;
  name: string;
  start_node_id: string;
  nodes: JourneyNode[];
}

interface PatientContext {
  id: string;
  age: number;
  language: 'en' | 'es';
}
```

### Service Abstraction
- **Node Processing**: `NodeProcessorService` handles all node types through polymorphic interfaces
- **Journey Execution**: `JourneyExecutionService` orchestrates flow without knowing node internals
- **Database Layer**: `DatabaseService` abstracts persistence from business logic

### Benefits
- **Testability**: Easy to mock interfaces for unit tests
- **Extensibility**: New node types can be added without changing existing code
- **Maintainability**: Clear separation of concerns
- **Flexibility**: Swap implementations without affecting consumers

## Pure Unit Tests with Comprehensive Mocking

### Testing Philosophy
All tests are pure unit tests that:
- **Mock All Dependencies**: No real database, no network calls, no file system
- **Fast Execution**: Tests run in milliseconds
- **Deterministic**: Same input always produces same output
- **Isolated**: Each test is completely independent

### Mock Infrastructure
```typescript
// Comprehensive mock helpers
export class MockHelpers {
  static createMockJourneyService(): Partial<JourneyService> {
    return {
      createJourney: jest.fn(),
      getJourney: jest.fn(),
      // ... all methods mocked
    };
  }
}

// Reusable test fixtures
export class TestFixtures {
  static createValidJourney(): Journey {
    // Returns consistent test data
  }
}
```

### Test Structure
- **Arrange**: Set up mocks with predictable responses
- **Act**: Execute the system under test
- **Assert**: Verify interactions and outcomes
- **Cleanup**: Automatic mock reset between tests

### Coverage
- **Business Logic**: 100% coverage of core journey execution logic
- **Error Scenarios**: Comprehensive error handling verification
- **Edge Cases**: Boundary conditions and invalid inputs
- **Integration Points**: Mock-based verification of service interactions

## Architecture Highlights

- **Event-Driven**: Asynchronous processing with TypeORM transactions
- **Type-Safe**: Full TypeScript with strict type checking
- **Testable**: Dependency injection enables comprehensive testing
- **Scalable**: Stateless services with database-driven coordination
- **Maintainable**: Clean architecture with clear separation of concerns
