require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");
const {
  startDiscovery,
  getDiscoveryJob
} = require("./discovery");
const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// --------------------------------------------------
// HEALTH CHECKS
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "LeadPulse backend is running"
  });
});

app.get("/api/health/database", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database, NOW() AS server_time"
    );

    res.json({
      success: true,
      message: "PostgreSQL connection successful",
      database: result.rows[0].database,
      serverTime: result.rows[0].server_time
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not connect to PostgreSQL"
    });
  }
});

// --------------------------------------------------
// LEADS: RETRIEVE AND FILTER
// --------------------------------------------------

app.get("/api/leads", async (req, res) => {
  try {
    const {
      q,
      city,
      category,
      country,
      has_phone,
      has_email
    } = req.query;

    const conditions = [];
    const values = [];

    function addCondition(sql, value) {
      values.push(value);
      conditions.push(sql.replace("?", `$${values.length}`));
    }

    if (q && q.trim()) {
      values.push(`%${q.trim()}%`);
      conditions.push(
        `(business_name ILIKE $${values.length}
          OR email ILIKE $${values.length}
          OR phone ILIKE $${values.length}
          OR address ILIKE $${values.length})`
      );
    }

    if (city && city.trim()) {
      addCondition("city ILIKE ?", `%${city.trim()}%`);
    }

    if (category && category.trim()) {
      addCondition("category ILIKE ?", `%${category.trim()}%`);
    }

    if (country && country.trim()) {
      addCondition("country ILIKE ?", `%${country.trim()}%`);
    }

    if (has_phone === "true") {
      conditions.push("phone IS NOT NULL AND BTRIM(phone) <> ''");
    } else if (has_phone === "false") {
      conditions.push("(phone IS NULL OR BTRIM(phone) = '')");
    }

    if (has_email === "true") {
      conditions.push("email IS NOT NULL AND BTRIM(email) <> ''");
    } else if (has_email === "false") {
      conditions.push("(email IS NULL OR BTRIM(email) = '')");
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const parsedOffset = Number.parseInt(req.query.offset, 10);

    const limit = Number.isInteger(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 25;

    const offset = Number.isInteger(parsedOffset)
      ? Math.max(parsedOffset, 0)
      : 0;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM leads
       ${whereClause}`,
      values
    );

    const dataValues = [...values, limit, offset];

    const leadsResult = await pool.query(
      `SELECT *
       FROM leads
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${dataValues.length - 1}
       OFFSET $${dataValues.length}`,
      dataValues
    );

    res.json({
      success: true,
      total: countResult.rows[0].total,
      limit,
      offset,
      leads: leadsResult.rows
    });
  } catch (error) {
    console.error("Failed to retrieve leads:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve leads"
    });
  }
});

// --------------------------------------------------
// LEADS: ADD A BUSINESS
// --------------------------------------------------

app.post("/api/leads", async (req, res) => {
  try {
    const {
      business_name,
      category,
      phone,
      email,
      website,
      address,
      city,
      country,
      owner_name,
      source,
      source_id,
      source_url
    } = req.body || {};

    if (
      typeof business_name !== "string" ||
      !business_name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "business_name is required"
      });
    }

    const result = await pool.query(
      `INSERT INTO leads (
        business_name,
        category,
        phone,
        email,
        website,
        address,
        city,
        country,
        owner_name,
        source,
        source_id,
        source_url
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12
      )
      RETURNING *`,
      [
        business_name.trim(),
        category || null,
        phone || null,
        email || null,
        website || null,
        address || null,
        city || null,
        country || null,
        owner_name || null,
        source || null,
        source_id || null,
        source_url || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Lead saved successfully",
      lead: result.rows[0]
    });
  } catch (error) {
    console.error("Failed to save lead:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to save lead"
    });
  }
});

// --------------------------------------------------
// LEADS: GET ONE BUSINESS
// --------------------------------------------------

app.get("/api/leads/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID"
      });
    }

    const result = await pool.query(
      "SELECT * FROM leads WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Lead not found"
      });
    }

    res.json({
      success: true,
      lead: result.rows[0]
    });
  } catch (error) {
    console.error("Failed to retrieve lead:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve lead"
    });
  }
});

// --------------------------------------------------
// AUTOMATIC LEAD DISCOVERY
// --------------------------------------------------

app.post("/api/discovery/start", (req, res) => {
  try {
    const { category, location } = req.body || {};

    const job = startDiscovery(pool, {
      category,
      location
    });

    res.status(202).json({
      success: true,
      message: "Lead discovery started.",
      job
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

app.get("/api/discovery/:id", (req, res) => {
  const job = getDiscoveryJob(req.params.id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: "Discovery job not found."
    });
  }

  res.json({
    success: true,
    job
  });
});

// --------------------------------------------------
// EXISTING ENDPOINTS
// --------------------------------------------------

app.get("/api/accounts", (req, res) => {
  res.json([]);
});

app.get("/api/campaigns", (req, res) => {
  res.json([]);
});

app.get("/api/whatsapp/state", (req, res) => {
  res.json({
    status: "disconnected",
    account: null
  });
});

// --------------------------------------------------
// START SERVER AFTER VERIFYING DATABASE
// --------------------------------------------------

async function startServer() {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database"
    );

    console.log(
      `PostgreSQL connected to database: ${result.rows[0].database}`
    );

    app.listen(PORT, () => {
      console.log(
        `LeadPulse backend running on http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Failed to connect to PostgreSQL:",
      error.message
    );

    process.exitCode = 1;
  }
}

startServer();