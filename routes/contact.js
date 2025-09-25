// contact.js (ESM)
import express from 'express';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Initialize SendGrid with your API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

router.post('/contact', async (req, res) => {
    const { name, email, phone, message } = req.body;

    try {
        // Validate required fields
        if (!name || !email || !message) {
            return res.status(400).json({
                message: 'Name, email, and message are required'
            });
        }

        // Prepare email content
        const msg = {
            to: 'kdeken1218@gmail.com',
            from: process.env.SENDGRID_FROM_EMAIL, // This should be verified in SendGrid
            subject: `New Contact Form Submission from ${name}`,
            text: `
Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}

Message:
${message}
            `,
            html: `
<h2>New Contact Form Submission</h2>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
<h3>Message:</h3>
<p>${message}</p>
            `
        };

        // Send email
        await sgMail.send(msg);

        res.status(200).json({
            message: 'Thank you for your message. We\'ll get back to you soon!'
        });
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({
            message: 'Failed to send message. Please try again or contact us directly.'
        });
    }
});

export default router;