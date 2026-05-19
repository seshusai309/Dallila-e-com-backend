import nodemailer from 'nodemailer';
import { logger } from './logger';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }


  async sendOTP(email: string, otp: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@ecominventory.com',
        to: email,
        subject: 'OTP Verification - E-commerce Inventory',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verification</h2>
            <p>Thank you for registering with E-commerce Inventory Backend!</p>
            <p>Please use the following OTP to verify your email address:</p>
            <div style="background: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 32px; margin: 0;">${otp}</h1>
            </div>
            <p><strong>Important:</strong></p>
            <ul>
              <li>This OTP will expire in 5 minutes</li>
              <li>Do not share this OTP with anyone</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              E-commerce Inventory Team
            </p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      logger.success('system', 'sendOTP', `OTP email sent successfully to: ${email}`);
      return true;
    } catch (error: any) {
      logger.error('system', 'sendOTP', `Failed to send OTP email to ${email}: ${error.message}`);
      console.error('Email service error:', error);
      return false;
    }
  }

  async sendWelcomeEmail(email: string, username: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@ecominventory.com',
        to: email,
        subject: 'Welcome to E-commerce Inventory Backend!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome ${username}!</h2>
            <p>Thank you for registering with E-commerce Inventory Backend!</p>
            <p>Your account has been created successfully. Please verify your email using the OTP sent to you.</p>
            <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-left: 4px solid #007bff;">
              <h3 style="color: #007bff; margin-top: 0;">Next Steps:</h3>
              <ol>
                <li>Check your email for the OTP verification code</li>
                <li>Use the OTP to verify your account</li>
                <li>Provide your address details to complete registration</li>
                <li>Once completed, you can login with your email and password</li>
              </ol>
            </div>
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              E-commerce Inventory Team
            </p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      logger.success('system', 'sendWelcomeEmail', `Welcome email sent to: ${email}`);
      return true;
    } catch (error: any) {
      logger.error('system', 'sendWelcomeEmail', `Failed to send welcome email to ${email}: ${error.message}`);
      return false;
    }
  }

  async sendApprovalEmail(email: string, username: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@ecominventory.com',
        to: email,
        subject: 'Account Approved - E-commerce Inventory Backend',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #28a745;">Account Approved! 🎉</h2>
            <p>Great news, ${username}!</p>
            <p>Your account has been approved by the administrator. You can now login and start using the E-commerce Inventory Backend.</p>
            <div style="background: #d4edda; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="color: #155724; margin-top: 0;">Login Details:</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Login URL:</strong> <a href="http://localhost:3000/api/users/login">Login Here</a></p>
            </div>
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              E-commerce Inventory Team
            </p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      logger.success('system', 'sendApprovalEmail', `Approval email sent to: ${email}`);
      return true;
    } catch (error: any) {
      logger.error('system', 'sendApprovalEmail', `Failed to send approval email to ${email}: ${error.message}`);
      return false;
    }
  }

  async sendRejectionEmail(email: string, username: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@ecominventory.com',
        to: email,
        subject: 'Account Status Update - E-commerce Inventory Backend',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc3545;">Account Status Update</h2>
            <p>Hello ${username},</p>
            <p>We regret to inform you that your account registration has been rejected by the administrator.</p>
            <div style="background: #f8d7da; padding: 20px; margin: 20px 0; border-left: 4px solid #dc3545;">
              <h3 style="color: #721c24; margin-top: 0;">What's Next:</h3>
              <p>If you believe this was done in error or would like to request a review, please contact our support team.</p>
            </div>
            <p style="color: #666; font-size: 14px;">
              Best regards,<br>
              E-commerce Inventory Team
            </p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      logger.success('system', 'sendRejectionEmail', `Rejection email sent to: ${email}`);
      return true;
    } catch (error: any) {
      logger.error('system', 'sendRejectionEmail', `Failed to send rejection email to ${email}: ${error.message}`);
      return false;
    }
  }

  // Send password reset OTP email
  async sendPasswordResetOTP(email: string, otp: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"E-commerce Inventory" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Password Reset OTP - E-commerce Inventory',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hi there,</p>
            <p>We received a request to reset your password for your E-commerce Inventory account.</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 18px;"><strong>Your OTP is:</strong></p>
              <h1 style="color: #007bff; font-size: 32px; margin: 10px 0; letter-spacing: 3px;">${otp}</h1>
              <p style="margin: 0; color: #666;">This OTP will expire in 10 minutes.</p>
            </div>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <p>For security reasons, please do not share this OTP with anyone.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 14px;">
              This is an automated message from E-commerce Inventory System.<br>
              Please do not reply to this email.
            </p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      logger.success('system', 'sendPasswordResetOTP', `Password reset OTP email sent successfully to: ${email}`);
      return true;
    } catch (error: any) {
      logger.error('system', 'sendPasswordResetOTP', `Failed to send password reset OTP email to ${email}: ${error.message}`);
      return false;
    }
  }

  // Send profile update OTP email
  async sendProfileUpdateOTP(email: string, otp: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"E-commerce Inventory" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Profile Update Verification - E-commerce Inventory',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Profile Update Request</h2>
            <p>Hi there,</p>
            <p>We received a request to update your profile for your E-commerce Inventory account.</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 18px;"><strong>Your verification OTP is:</strong></p>
              <h1 style="color: #28a745; font-size: 32px; margin: 10px 0; letter-spacing: 3px;">${otp}</h1>
              <p style="margin: 0; color: #666;">This OTP will expire in 10 minutes.</p>
            </div>
            <p>If you didn't request this profile update, please ignore this email.</p>
            <p>For security reasons, please do not share this OTP with anyone.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 14px;">
              This is an automated message from E-commerce Inventory System.<br>
              Please do not reply to this email.
            </p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      logger.success('system', 'sendProfileUpdateOTP', `Profile update OTP email sent successfully to: ${email}`);
      return true;
    } catch (error: any) {
      logger.error('system', 'sendProfileUpdateOTP', `Failed to send profile update OTP email to ${email}: ${error.message}`);
      return false;
    }
  }

  // Send delivery confirmation OTP email
  async sendDeliveryOTP(email: string, otp: string, orderNumber: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"E-commerce Inventory" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Delivery OTP for Order ${orderNumber} - E-commerce Inventory`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #28a745;">Your Order Has Been Shipped! 🚚</h2>
            <p>Great news! Your order <strong>${orderNumber}</strong> has been shipped and is on its way to you.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <p style="margin: 0; font-size: 18px;"><strong>Delivery Confirmation OTP:</strong></p>
              <h1 style="color: #28a745; font-size: 32px; margin: 10px 0; letter-spacing: 3px;">${otp}</h1>
              <p style="margin: 0; color: #666;">This OTP will expire in 24 hours.</p>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #856404; margin-top: 0;">Important Instructions:</h3>
              <ul style="color: #856404;">
                <li>Please share this OTP only with the delivery person</li>
                <li>This OTP confirms that you have received your order</li>
                <li>The OTP will expire after 24 hours for security reasons</li>
                <li>If you didn't receive your order, do not share this OTP</li>
              </ul>
            </div>
            
            <p>Thank you for shopping with E-commerce Inventory!</p>
            <p style="color: #666; font-size: 14px;">
              This is an automated message from E-commerce Inventory System.<br>
              If you have any questions, please contact our support team.
            </p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      logger.success('system', 'sendDeliveryOTP', `Delivery OTP email sent successfully to: ${email} for order: ${orderNumber}`);
      return true;
    } catch (error: any) {
      logger.error('system', 'sendDeliveryOTP', `Failed to send delivery OTP email to ${email}: ${error.message}`);
      return false;
    }
  }
}

export const emailService = new EmailService();
