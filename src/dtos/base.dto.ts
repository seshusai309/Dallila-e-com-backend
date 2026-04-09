import { Expose, Transform } from 'class-transformer';

// Base DTO with common fields
export class BaseDto {
  @Expose({ name: '_id' })
  @Transform(({ obj }) => obj._id?.toString())
  id!: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
