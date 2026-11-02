const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");

const {
  getAccountsWithCredentials,
  incrementAccountSentCount,
  createCampaign,
  updateCampaignStatus,
  createCampaignLog
} = require("./db");

const DEFAULT_DELAY_SECONDS = 7;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeRecipients(input) {
  const raw = Array.isArray(input)
    ? input
    : String(input || "")
        .split(/[\n,;]+/);

  const seen = new Set();
  const result = [];

  for (const value of raw) {
    const email = String(value || "")
      .trim()
      .toLowerCase();

    if (!email) {
      continue;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      continue;
    }

    if (seen.has(email)) {
      continue;
    }

    seen.add(email);
    result.push(email);
  }

  return result;
}

function deriveMergeData(email) {
  const localPart = email.split("@")[0] || "";

  const firstName = localPart
    .replace(/[._-]+/g, " ")
    .split(" ")[0]
    .replace(/[^a-zA-Z]/g, "");

  return {
    first_name:
      firstName.length > 0
        ? firstName.charAt(0).toUpperCase() +
          firstName.slice(1).toLowerCase()
        : "",
    company_name: "",
    industry: ""
  };
}

function applyMergeTags(text, recipient) {
  const data = deriveMergeData(recipient);

  return String(text || "")
    .replace(
      /\{first_name\}/gi,
      data.first_name
    )
    .replace(
      /\{company_name\}/gi,
      data.company_name
    )
    .replace(
      /\{industry\}/gi,
      data.industry
    );
}

function createGoogleTransport(account) {
  const credentials = account.credentials || {};

  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    credentials.clientId;

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ||
    credentials.clientSecret;

  const refreshToken = credentials.refreshToken;

  if (
    !clientId ||
    !clientSecret ||
    !refreshToken
  ) {
    throw new Error(
      `Google OAuth credentials are incomplete for ${account.email}.`
    );
  }

  const oauth2Client = new OAuth2Client(
    clientId,
    clientSecret
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: account.email,
      clientId,
      clientSecret,
      refreshToken
    },
    pool: false
  });
}

function createSmtpTransport(account) {
  const credentials = account.credentials || {};

  if (
    !credentials.host ||
    !credentials.port ||
    !credentials.username ||
    !credentials.password
  ) {
    throw new Error(
      `SMTP credentials are incomplete for ${account.email}.`
    );
  }

  return nodemailer.createTransport({
    host: credentials.host,
    port: Number(credentials.port),
    secure: Boolean(credentials.secure),
    auth: {
      user: credentials.username,
      pass: credentials.password
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000
  });
}

function createTransport(account) {
  if (account.auth_type === "google_oauth") {
    return createGoogleTransport(account);
  }

  return createSmtpTransport(account);
}

function emitLog(emit, level, message, data = {}) {
  emit({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  });
}

async function launchCampaign({
  recipients,
  subject,
  body,
  delaySeconds = DEFAULT_DELAY_SECONDS,
  emit = () => {}
}) {
  const normalizedRecipients =
    normalizeRecipients(recipients);

  if (normalizedRecipients.length === 0) {
    throw new Error(
      "No valid recipient email addresses were provided."
    );
  }

  if (!String(subject || "").trim()) {
    throw new Error(
      "A subject line is required."
    );
  }

  if (!String(body || "").trim()) {
    throw new Error(
      "An email body is required."
    );
  }

  const accounts = getAccountsWithCredentials();

  if (accounts.length === 0) {
    throw new Error(
      "No connected accounts have available daily quota."
    );
  }

  const campaignId = createCampaign(
    subject,
    body,
    "running"
  );

  emitLog(
    emit,
    "info",
    `Campaign #${campaignId} started with ${normalizedRecipients.length} recipient(s).`
  );

  emitLog(
    emit,
    "info",
    `Available sender accounts: ${accounts.length}.`
  );

  const safeDelay = Math.max(
    0,
    Math.min(
      3600,
      Number(delaySeconds) || DEFAULT_DELAY_SECONDS
    )
  );

  let accountIndex = 0;
  let successful = 0;
  let failed = 0;

  const transports = new Map();

  try {
    for (
      let recipientIndex = 0;
      recipientIndex < normalizedRecipients.length;
      recipientIndex += 1
    ) {
      const recipient =
        normalizedRecipients[recipientIndex];

      const eligibleAccounts =
        getAccountsWithCredentials();

      if (eligibleAccounts.length === 0) {
        emitLog(
          emit,
          "error",
          "All connected sender accounts have reached their daily quota."
        );

        for (
          let remainingIndex =
            recipientIndex;
          remainingIndex <
          normalizedRecipients.length;
          remainingIndex += 1
        ) {
          createCampaignLog({
            campaignId,
            recipient:
              normalizedRecipients[
                remainingIndex
              ],
            senderEmail: "quota-exhausted",
            status: "failed"
          });

          failed += 1;
        }

        break;
      }

      accountIndex =
        accountIndex % eligibleAccounts.length;

      const account =
        eligibleAccounts[accountIndex];

      accountIndex += 1;

      emitLog(
        emit,
        "rotation",
        `Sender selected: ${account.email}`,
        {
          accountId: account.id,
          recipient,
          recipientIndex:
            recipientIndex + 1,
          total:
            normalizedRecipients.length
        }
      );

      let transport =
        transports.get(account.id);

      if (!transport) {
        transport = createTransport(account);
        transports.set(account.id, transport);

        emitLog(
          emit,
          "info",
          `Transport initialized for ${account.email}.`
        );
      }

      const renderedSubject =
        applyMergeTags(subject, recipient);

      const renderedBody =
        applyMergeTags(body, recipient);

      emitLog(
        emit,
        "queue",
        `Sending ${recipientIndex + 1}/${normalizedRecipients.length} → ${recipient}`
      );

      try {
        const info =
          await transport.sendMail({
            from: account.email,
            to: recipient,
            subject: renderedSubject,
            text: renderedBody,
            headers: {
              "X-Mailer":
                "LeadPulse/1.0.0-Beta"
            }
          });

        incrementAccountSentCount(
          account.id
        );

        createCampaignLog({
          campaignId,
          recipient,
          senderEmail: account.email,
          status: "sent"
        });

        successful += 1;

        emitLog(
          emit,
          "success",
          `Delivered to ${recipient}`,
          {
            sender: account.email,
            messageId:
              info.messageId || null
          }
        );
      } catch (error) {
        failed += 1;

        createCampaignLog({
          campaignId,
          recipient,
          senderEmail: account.email,
          status: "failed"
        });

        emitLog(
          emit,
          "error",
          `Delivery failed for ${recipient}: ${error.message}`,
          {
            sender: account.email
          }
        );
      }

      const isLast =
        recipientIndex ===
        normalizedRecipients.length - 1;

      if (!isLast && safeDelay > 0) {
        for (
          let remaining = safeDelay;
          remaining > 0;
          remaining -= 1
        ) {
          emitLog(
            emit,
            "delay",
            `Next dispatch in ${remaining}s`
          );

          await sleep(1000);
        }
      }
    }

    const finalStatus =
      failed === 0
        ? "completed"
        : successful === 0
          ? "failed"
          : "completed_with_errors";

    updateCampaignStatus(
      campaignId,
      finalStatus
    );

    emitLog(
      emit,
      "complete",
      `Campaign #${campaignId} finished: ${successful} sent, ${failed} failed.`
    );

    return {
      campaignId,
      status: finalStatus,
      total: normalizedRecipients.length,
      successful,
      failed
    };
  } catch (error) {
    updateCampaignStatus(
      campaignId,
      "failed"
    );

    emitLog(
      emit,
      "error",
      `Campaign stopped: ${error.message}`
    );

    throw error;
  } finally {
    for (const transport of transports.values()) {
      try {
        transport.close();
      } catch {
        // Transport cleanup failure does not affect campaign result.
      }
    }
  }
}

module.exports = {
  launchCampaign,
  normalizeRecipients
};