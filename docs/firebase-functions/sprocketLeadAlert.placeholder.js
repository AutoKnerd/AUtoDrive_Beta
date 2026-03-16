/**
 * Firebase Cloud Function placeholder for lead alerts.
 *
 * Deploy this in a Firebase Functions workspace (not in the Next.js app bundle).
 * Trigger: onCreate -> sprocket_leads/{leadId}
 */

// Example for Functions v2:
//
// const { onDocumentCreated } = require('firebase-functions/v2/firestore');
// const logger = require('firebase-functions/logger');
//
// exports.onSprocketLeadCreated = onDocumentCreated('sprocket_leads/{leadId}', (event) => {
//   const leadId = event.params.leadId;
//   const data = event.data?.data() || {};
//
//   logger.info('New Sprocket lead created', {
//     leadId,
//     email: data.email || null,
//     dealership: data.dealership || null,
//     intent: data.intent || null,
//     source: data.source || 'sprocket_chat',
//     score: data.score ?? null,
//   });
//
//   // TODO: future alert integrations
//   // - Slack webhook
//   // - Sendgrid / Resend follow-up
//   // - Internal notification queue
//   return;
// });

