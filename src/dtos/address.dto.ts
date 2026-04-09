import { Expose, Transform } from 'class-transformer';

export class AddressResponseDto {
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  _id!: string;

  @Expose()
  userId!: string;

  @Expose()
  street!: string;

  @Expose()
  city!: string;

  @Expose()
  state!: string;

  @Expose()
  postalCode!: string;

  @Expose()
  country!: string;

  @Expose()
  isDefault!: boolean;

  @Expose()
  addressType!: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
