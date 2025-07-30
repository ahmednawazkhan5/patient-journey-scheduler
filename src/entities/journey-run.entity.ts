import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  JourneyRun as IJourneyRun,
  PatientContext,
} from '../interfaces/journey.interface';
import { JourneyRunStatus } from '../enums/journey-run-status.enum';

@Entity('journey_runs')
export class JourneyRun implements IJourneyRun {
  @PrimaryColumn('varchar')
  runId: string;

  @Column('varchar')
  journeyId: string;

  @Column('varchar')
  status: JourneyRunStatus;

  @Column({ type: 'varchar', nullable: true })
  currentNodeId: string | null;

  @Column('text')
  private _patientContext: string;

  @Column({ type: 'timestamp', nullable: true })
  resumeAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Getter and setter for patientContext
  get patientContext(): PatientContext {
    return JSON.parse(this._patientContext) as PatientContext;
  }

  set patientContext(value: PatientContext) {
    this._patientContext = JSON.stringify(value);
  }
}
