import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import connectDB from '../config/db';
import { UserRepository } from '../repository/UserRepository';
import { AddressRepository } from '../repository/AddressRepository';
import { UserStatus, UserRole } from '../models/User';

dotenv.config();

async function createSuperAdminUser(): Promise<void> {
  try {
    await connectDB();

    const userRepository = new UserRepository();
    const addressRepository = new AddressRepository();

    // Check if SUPER_ADMIN already exists
    const existingSuperAdmin = await userRepository.findByEmailOrUsername(
      process.env.SUPER_ADMIN_EMAIL!,
      process.env.SUPER_ADMIN_USERNAME!
    );
    if (existingSuperAdmin) {
      console.log('SUPER_ADMIN user already exists:', existingSuperAdmin.email);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD!, 10);

    // Create SUPER_ADMIN user
    const superAdminData = {
      username: process.env.SUPER_ADMIN_USERNAME!,
      email: process.env.SUPER_ADMIN_EMAIL!,
      password: hashedPassword,
      status: UserStatus.ACTIVE,
      role: UserRole.SUPER_ADMIN,
    };

    const superAdminUser = await userRepository.create(superAdminData);

    // Create default address for SUPER_ADMIN
    await addressRepository.create({
      userId: superAdminUser._id.toString(),
      street: "Admin Office",
      city: "Headquarters",
      state: "Admin State",
      postalCode: "000000",
      country: "Admin Country",
      isDefault: true,
      addressType: 'work',
    });

    console.log('SUPER_ADMIN user created successfully:');
    console.log('Username:', superAdminUser.username);
    console.log('Email:', superAdminUser.email);
    console.log('Role:', superAdminUser.role);
    console.log('Status:', superAdminUser.status);
    console.log('Address: Default work address created');
    console.log('\nIMPORTANT: Change the default password in production!');
  } catch (error) {
    console.error('Error creating SUPER_ADMIN user:', error);
  } finally {
    mongoose.connection.close();
  }
}

createSuperAdminUser();
