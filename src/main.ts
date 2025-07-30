import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { JourneyWorkerService } from './services/journey-worker.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Patient Journey Scheduler API')
    .setDescription('API for Patient Journey Scheduler')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Start the journey worker
  const journeyWorker = app.get(JourneyWorkerService);
  journeyWorker.startWorker(5000); // Poll every 5 seconds

  // Graceful shutdown
  process.on('SIGTERM', () => {
    journeyWorker.stopWorker();
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
