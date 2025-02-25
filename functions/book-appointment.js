// netlify/functions/book-appointment.js

const { Client } = require('@notionhq/client');
const nodemailer = require('nodemailer');

// (Optional) Load .env if running locally; Netlify sets env vars in production
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// 1. Initialize the Notion client with your token
const notion = new Client({
  auth: process.env.NOTION_TOKEN, // set in Netlify or your .env
});

// 2. Create an email transporter (if you're using Gmail for confirmations)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,  // e.g. "your.email@gmail.com"
    pass: process.env.EMAIL_PASS,  // e.g. "an-app-password"
  },
});

// 3. The handler function (Netlify serverless format)
exports.handler = async (event) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405, // Method Not Allowed
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse JSON input from the request body
    const { name, email, phone, dateTime } = JSON.parse(event.body);

    // Basic validation
    if (!name || !email || !phone || !dateTime) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields.' }),
      };
    }

    /**********************************************************
     * 4. Check if the slot is already booked in Notion
     *    - We assume your database has:
     *      - A "Status" property using the "Status" type
     *      - A "Date/Time" (date) property
     **********************************************************/
    const existing = await notion.databases.query({
      database_id: 'YOUR_DATABASE_ID', // e.g. "1a3a19df84ee804ba7d6c2ed5577d06b"
      filter: {
        and: [
          {
            property: 'Date/Time',
            date: {
              equals: dateTime, // must match exactly the date/time
            },
          },
          {
            property: 'Status',
            status: {
              equals: 'Booked',
            },
          },
        ],
      },
    });

    if (existing.results.length > 0) {
      // Slot is already booked
      return {
        statusCode: 409, // Conflict
        body: JSON.stringify({ error: 'This slot is already booked!' }),
      };
    }

    /**********************************************************
     * 5. Create a new page in Notion
     *    NOTE: We use "status: { name: 'Booked' }" for a Status property
     **********************************************************/
    await notion.pages.create({
      parent: { database_id: 'YOUR_DATABASE_ID' },
      properties: {
        // "Name" property (title)
        Name: {
          title: [
            { text: { content: name } },
          ],
        },
        // "Email" property (email type) 
        Email: {
          email: email,
        },
        // "Phone" property (phone number type) 
        Phone: {
          phone_number: phone,
        },
        // "Date/Time" property (date type, must match the property name exactly)
        'Date/Time': {
          date: {
            start: dateTime, // must be ISO8601 date-time, e.g. "2025-03-01T11:00:00"
          },
        },
        // "Status" property (Status type in Notion, not a Select)
        Status: {
          status: {
            name: 'Booked',
          },
        },
      },
    });

    /**********************************************************
     * 6. Send Confirmation Emails (Optional)
     *    - Email to the customer
     *    - Email to yourself (if desired)
     **********************************************************/
    // Email to customer
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Appointment Confirmation',
      text: `Hello ${name},\n\nYour appointment has been booked for ${dateTime}.\n\nThank you!`,
    });

    // (Optional) Email yourself
    // await transporter.sendMail({
    //   from: process.env.EMAIL_USER,
    //   to: process.env.EMAIL_USER, 
    //   subject: 'New Appointment Booked',
    //   text: `A new appointment was booked by ${name} (${email}, ${phone}) for ${dateTime}.`,
    // });

    // 7. Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Appointment booked successfully!' }),
    };
  } catch (error) {
    console.error('Booking Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal Server Error',
        details: error.toString(),
      }),
    };
  }
};
