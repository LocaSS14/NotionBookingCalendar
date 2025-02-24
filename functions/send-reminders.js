// functions/send-reminders.js
const { Client } = require('@notionhq/client');
const nodemailer = require('nodemailer');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.handler = async (event, context) => {
  try {
    // 1. Calculate the time 24 hours from now (in ISO format).
    const now = new Date();
    const date24HoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // We'll search for pages with a date that's close to `date24HoursFromNow`.
    // However, Notion's filter doesn't do "date is exactly..." with hours precision easily.
    // We'll do a "date is on or before" and "on or after" approach for a 1-hour window around that time
    // or a same-day approach if you prefer. For simplicity, let's do same day + same hour approach.

    // Convert date24HoursFromNow to an ISO string, but keep in mind Notion might store times with or without timezone.
    const targetISO = date24HoursFromNow.toISOString().slice(0, 16); 
    // e.g. "2025-03-01T11:00"

    // We can do a broad approach: 
    // "date >= targetISO and date < (targetISO + 1 hour)" to ensure we catch the hour.

    // This is tricky because Notion filters aren't super precise with times. 
    // Alternatively, we can query for appointments in the next 1-2 hours, 
    // then check in code for exactly 24-hour difference. 
    // For a simple example, let's try a "before" and "after" approach:

    const after24Hours = new Date(date24HoursFromNow.getTime() - 30 * 60 * 1000); // -30m window
    const before24Hours = new Date(date24HoursFromNow.getTime() + 30 * 60 * 1000); // +30m window

    // Convert those to ISO for Notion
    const after24ISO = after24Hours.toISOString();
    const before24ISO = before24Hours.toISOString();

    // 2. Query Notion for any "Booked" appointment that:
    //    - "Date/Time" is on or after `after24ISO`
    //    - "Date/Time" is on or before `before24ISO`
    //    - "Reminder Sent" is not checked
    const response = await notion.databases.query({
      database_id: '1a3a19df84ee804ba7d6c2ed5577d06b',
      filter: {
        and: [
          {
            property: 'Status',
            select: { equals: 'Booked' },
          },
          {
            property: 'Reminder Sent',
            checkbox: { equals: false },
          },
          {
            property: 'Date/Time',
            date: {
              on_or_after: after24ISO,
            },
          },
          {
            property: 'Date/Time',
            date: {
              on_or_before: before24ISO,
            },
          },
        ],
      },
    });

    const pagesToRemind = response.results; // array of pages

    // 3. For each page, send a reminder email
    for (const page of pagesToRemind) {
      // Extract the relevant data
      const props = page.properties;
      const name = props.Name?.title?.[0]?.plain_text || 'Guest';
      const email = props.Email?.email || '';
      const phone = props.Phone?.phone_number || '';
      const dateStart = props['Date/Time']?.date?.start;

      // Email the customer
      if (email) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Appointment Reminder (24h)',
          text: `Hello ${name},\n\nThis is a reminder that your appointment is scheduled in 24 hours (on ${dateStart}).\n\nThank you!`,
        });
      }

      // (Optional) Email yourself too if you want:
      // ...

      // 4. Mark the page as "Reminder Sent" so we don’t send twice
      await notion.pages.update({
        page_id: page.id,
        properties: {
          'Reminder Sent': {
            checkbox: true,
          },
        },
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Reminders sent', count: pagesToRemind.length }),
    };
  } catch (error) {
    console.error('Reminder Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.toString() }),
    };
  }
};
