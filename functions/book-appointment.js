// functions/book-appointment.js

const { Client } = require('@notionhq/client');
const nodemailer = require('nodemailer');

// We can optionally use dotenv if we test locally:
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// 1. Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// 2. Create a transporter for sending emails
//    For example, using Gmail + Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // e.g. "your.email@gmail.com"
    pass: process.env.EMAIL_PASS, // e.g. "gmail-app-password"
  },
});

// 3. Netlify serverless function format
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405, // Method Not Allowed
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse the incoming data (assuming JSON format)
    const data = JSON.parse(event.body);

    // Data expected from the front-end booking form
    const { name, email, phone, dateTime } = data; 
    // Example of dateTime: "2025-03-01T11:00:00" (ISO string or similar)

    if (!name || !email || !phone || !dateTime) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields.' }),
      };
    }

    // 1. Query Notion to see if dateTime is already booked:
const existing = await notion.databases.query({
    database_id:'1a3a19df84ee804ba7d6c2ed5577d06b'
    ,
    filter: {
      and: [
        {
          property: 'Date/Time',
          date: {
            equals: dateTime, 
          },
        },
        {
          property: 'Status',
          select: {
            equals: 'Booked',
          },
        },
      ],
    },
  });
  
  // If we find any result, that means the slot is taken
  if (existing.results.length > 0) {
    return {
      statusCode: 409, // Conflict
      body: JSON.stringify({ error: 'This slot is already booked!' }),
    };
  }
  
    // 5. Send a confirmation email to the customer
    const mailOptionsToCustomer = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Appointment Confirmation',
      text: `Hello ${name},\n\nYour appointment has been booked for ${dateTime}.\n\nThank you!`,
    };

    await transporter.sendMail(mailOptionsToCustomer);

    // 6. Send a notification email to yourself (the consultant)
    const mailOptionsToYou = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // or another email if you prefer
      subject: 'New Appointment Booked',
      text: `A new appointment was booked by ${name} (${email}, ${phone}) for ${dateTime}.`,
    };

    await transporter.sendMail(mailOptionsToYou);

    // 7. Return a success response
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Appointment booked successfully!' }),
    };

  } catch (error) {
    console.error('Booking Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.toString() }),
    };
  }
};
