import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Patient } from '../entities/patient.entity';

@Injectable()
export class PatientService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(): Promise<Patient[]> {
    return this.databaseService.find(Patient);
  }
}
