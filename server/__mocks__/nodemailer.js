"use strict";

/**
 * MANUAL JEST MOCK for the `nodemailer` npm package.
 *
 * Place this file at:  server/__mocks__/nodemailer.js
 *
 * Then in tests/setup.js, add near the top:
 *   jest.mock("nodemailer");
 *
 * WHY THIS EXISTS
 * config/nodemailer.js calls `nodemailer.createTransport({ service: "gmail", ... })`
 * and then `transporter.sendMail(...)` for every email — a real network call
 * to Gmail's SMTP servers. That's a second source of the flakiness/races you
 * saw (including the "Cannot log after tests are done" warnings, since real
 * SMTP sends can take a moment to resolve). This mock resolves instantly and
 * deterministically, while your actual template-building logic in
 * config/nodemailer.js (subject lines, HTML content, template selection)
 * still runs for real — only the SMTP network boundary is faked.
 */

const sentEmails = [];

const mockTransporter = {
  sendMail: jest.fn(async (mailOptions) => {
    const info = {
      messageId: `<mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@test>`,
      envelope: { from: mailOptions.from, to: [mailOptions.to] },
      accepted: [mailOptions.to],
      rejected: [],
      response: "250 OK: mock accepted",
    };
    sentEmails.push({ ...mailOptions, messageId: info.messageId });
    return info;
  }),

  verify: jest.fn(async () => true),
};

module.exports = {
  createTransport: jest.fn(() => mockTransporter),

  // test helpers — import these directly if a test wants to assert on
  // what was "sent", e.g.:
  //   const nodemailer = require("nodemailer");
  //   expect(nodemailer.__getSentEmails()).toHaveLength(1);
  __getSentEmails: () => sentEmails,
  __clearSentEmails: () => {
    sentEmails.length = 0;
  },
};
