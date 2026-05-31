require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Mock database for testing
const mockUsers = [
  { id: 1, email: "testuser@example.com", password: "hashedpassword123", resetToken: null, tokenExpiry: null }
];

// Configure Nodemailer SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// New Root Route (Fixes the "Cannot GET /" error)
app.get('/', (req, res) => {
  res.status(200).send('Password Reset API Server is running successfully!');
});

// Forgot Password Route
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = mockUsers.find(u => u.email === email);
  
  if (!user) {
    return res.status(404).json({ error: "User with this email does not exist." });
  }

  // Generate 1-hour secure token
  const token = crypto.randomBytes(20).toString('hex');
  user.resetToken = token;
  user.tokenExpiry = Date.now() + 3600000;

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const resetLink = `${appUrl}/reset-password?token=${token}`;

  const mailOptions = {
    from: `"My App Alerts" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: 'Password Reset Request',
    html: `
      <h3>You requested a password reset</h3>
      <p>Click the link below to securely reset your account password. This link is valid for 1 hour.</p>
      <a href="${resetLink}" target="_blank" style="padding: 10px 20px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <br/><br/>
      <p>If you did not request this, please ignore this email.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Password reset link sent successfully to email." });
  } catch (error) {
    console.error("Nodemailer Error:", error);
    res.status(500).json({ error: "Failed to send email. Check SMTP server configurations." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
