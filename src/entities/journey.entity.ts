import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  Journey as IJourney,
  JourneyNode,
} from '../interfaces/journey.interface';

@Entity('journeys')
export class Journey implements IJourney {
  @PrimaryColumn('uuid')
  id: string;

  @Column('varchar')
  name: string;

  @Column('varchar')
  start_node_id: string;

  @Column('text')
  private _nodes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Getter and setter for nodes
  get nodes(): JourneyNode[] {
    return JSON.parse(this._nodes) as JourneyNode[];
  }

  set nodes(value: JourneyNode[]) {
    this._nodes = JSON.stringify(value);
  }
}
