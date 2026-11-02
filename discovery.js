
const { randomUUID } = require("crypto");

const jobs = new Map();
let activeJobId = null;

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const USER_AGENT = "LeadPulse/1.0 (local business discovery application)";

const CATEGORY_QUERIES = {
  all: [
    'nwr["shop"]',
    'nwr["office"]',
    'nwr["craft"]',
    'nwr["industrial"]',
    'nwr["amenity"~"^(school|college|university|hospital|clinic|doctors|dentist|pharmacy|language_school|community_centre|social_centre|training)$"]',
    'nwr["office"~"^(ngo|educational_institution|company|consulting|lawyer|accountant|estate_agent|recruitment_agency)$"]'
  ],

  companies: [
    'nwr["office"]',
    'nwr["craft"]',
    'nwr["industrial"]'
  ],

  education: [
    'nwr["amenity"~"^(school|college|university|language_school|training)$"]',
    'nwr["office"="educational_institution"]'
  ],

  organizations: [
    'nwr["office"="ngo"]',
    'nwr["amenity"~"^(community_centre|social_centre)$"]'
  ],

  retail: [
    'nwr["shop"]'
  ],

  professional: [
    'nwr["office"~"^(company|consulting|lawyer|accountant|estate_agent|recruitment_agency)$"]'
  ],

  healthcare: [
    'nwr["amenity"~"^(hospital|clinic|doctors|dentist|pharmacy)$"]'
  ]
};

function normalizeCategory(value) {
  const text = String(value || "all").toLowerCase().trim();

  const mappings = {
    "all categories": "all",
    "all": "all",
    "companies and businesses": "companies",
    "company": "companies",
    "companies": "companies",
    "business": "companies",
    "businesses": "companies",
    "educational institutions": "education",
    "education": "education",
    "schools": "education",
    "colleges": "education",
    "organizations and ngos": "organizations",
    "organizations": "organizations",
    "ngo": "organizations",
    "ngos": "organizations",
    "retail and commercial": "retail",
    "retail": "retail",
    "shops": "retail",
    "professional services": "professional",
    "professional": "professional",
    "healthcare": "healthcare",
    "health": "healthcare"
  };

  if (mappings[text]) return mappings[text];

  if (/\b(school|college|university|education|training|institute)\b/.test(text)) {
    return "education";
  }

  if (/\b(ngo|organization|foundation|association|charity)\b/.test(text)) {
    return "organizations";
  }

  if (/\b(hospital|clinic|health|medical|pharmacy|dentist)\b/.test(text)) {
    return "healthcare";
  }

  if (/\b(shop|retail|supermarket|store)\b/.test(text)) {
    return "retail";
  }

  if (/\b(law|legal|accountant|accounting|consulting|recruitment|real estate)\b/.test(text)) {
    return "professional";
  }

  if (/\b(company|companies|business|businesses|manufacturer|manufacturing|factory|software|it company)\b/.test(text)) {
    return "companies";
  }

  return null;
}

async function geocodeLocation(location) {
  const url = new URL(NOMINATIM_URL);

  url.searchParams.set("q", location);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "application/json"
    },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(`Location lookup failed (${response.status}).`);
  }

  const results = await response.json();

  if (!results.length) {
    throw new Error("Location not found. Try a more specific city or district.");
  }

  const place = results[0];

  return {
    boundingBox: place.boundingbox.map(Number),
    address: place.address || {},
    displayName: place.display_name
  };
}

function buildOverpassQuery(category, boundingBox) {
  const [south, north, west, east] = boundingBox;

  const bbox = `${south},${west},${north},${east}`;

  const selectors = CATEGORY_QUERIES[category];

  if (!selectors) {
    throw new Error("Unsupported discovery category.");
  }

  const statements = selectors
    .map(selector => `${selector}(${bbox});`)
    .join("\n");

  return `
    [out:json][timeout:45];
    (
      ${statements}
    );
    out center tags;
  `;
}

function cleanValue(value) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();

  return cleaned || null;
}

function normalizeWebsite(value) {
  const website = cleanValue(value);

  if (!website) return null;

  if (/^https?:\/\//i.test(website)) {
    return website;
  }

  return `https://${website}`;
}

function getAddress(tags) {
  if (tags["addr:full"]) {
    return tags["addr:full"];
  }

  return [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"]
  ]
    .filter(Boolean)
    .join(", ") || null;
}

function getBusinessCategory(tags, fallback) {
  return (
    tags.amenity ||
    tags.shop ||
    tags.office ||
    tags.craft ||
    tags.industrial ||
    tags.healthcare ||
    fallback
  );
}

function extractLead(element, location, category) {
  const tags = element.tags || {};

  const businessName = cleanValue(tags.name);

  if (!businessName) {
    return null;
  }

  return {
    business_name: businessName,
    category: getBusinessCategory(tags, category),
    phone: cleanValue(tags.phone || tags["contact:phone"]),
    email: cleanValue(tags.email || tags["contact:email"]),
    website: normalizeWebsite(tags.website || tags["contact:website"]),
    address: getAddress(tags),
    city: cleanValue(
      tags["addr:city"] ||
      tags["addr:town"] ||
      tags["addr:municipality"]
    ) || location,
    country: cleanValue(tags["addr:country"]),
    source: "openstreetmap",
    source_id: `${element.type}/${element.id}`,
    source_url: `https://www.openstreetmap.org/${element.type}/${element.id}`
  };
}


const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

async function queryOverpass(query) {
  const failures = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 1; attempt++) {
      try {
        console.log(
          `Overpass request: ${endpoint} (attempt ${attempt}/2)`
        );

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data.elements)) {
          throw new Error("Invalid Overpass response.");
        }

        console.log(
          `Overpass success: ${data.elements.length} records`
        );

        return data;

      } catch (error) {
        const reason = error.name === "TimeoutError"
          ? "Request timed out"
          : error.message;

        failures.push(`${endpoint}: ${reason}`);

        console.error(
          `Overpass attempt failed: ${endpoint}: ${reason}`
        );

        if (attempt < 2) {
          await sleep(1000);
        }
      }
    }
  }

  throw new Error(
    `All Overpass endpoints failed:\n${failures.join("\n")}`
  );
}


async function saveLead(pool, lead) {
  const existing = await pool.query(
    `SELECT id
     FROM leads
     WHERE source = $1 AND source_id = $2
     LIMIT 1`,
    [lead.source, lead.source_id]
  );

  if (existing.rows.length) {
    await pool.query(
      `UPDATE leads
       SET last_seen_at = NOW(),
           updated_at = NOW(),
           phone = COALESCE(NULLIF(phone, ''), $1),
           email = COALESCE(NULLIF(email, ''), $2),
           website = COALESCE(NULLIF(website, ''), $3),
           address = COALESCE(NULLIF(address, ''), $4)
       WHERE id = $5`,
      [
        lead.phone,
        lead.email,
        lead.website,
        lead.address,
        existing.rows[0].id
      ]
    );

    return "duplicate";
  }

  await pool.query(
    `INSERT INTO leads (
      business_name,
      category,
      phone,
      email,
      website,
      address,
      city,
      country,
      source,
      source_id,
      source_url
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11
    )`,
    [
      lead.business_name,
      lead.category,
      lead.phone,
      lead.email,
      lead.website,
      lead.address,
      lead.city,
      lead.country,
      lead.source,
      lead.source_id,
      lead.source_url
    ]
  );

  return "inserted";
}

async function runDiscovery(pool, job) {
  try {
    job.status = "running";
    job.message = "Looking up the requested location.";

    const place = await geocodeLocation(job.location);

    job.locationFound = place.displayName;

    job.message = "Searching OpenStreetMap for businesses.";

    const query = buildOverpassQuery(
      job.categoryKey,
      place.boundingBox
    );

    const data = await queryOverpass(query);

    job.discovered = data.elements.length;
    job.message = "Processing and saving business records.";

    for (const element of data.elements) {
      const lead = extractLead(
        element,
        job.location,
        job.category
      );

      if (!lead) {
        job.skipped++;
        continue;
      }

      if (!lead.country && place.address.country) {
        lead.country = place.address.country;
      }

      if (!lead.city) {
        lead.city =
          place.address.city ||
          place.address.town ||
          place.address.village ||
          job.location;
      }

      const result = await saveLead(pool, lead);

      if (result === "inserted") {
        job.inserted++;
      } else {
        job.duplicates++;
      }

      job.processed++;
    }

    job.status = "completed";
    job.message = "Discovery completed successfully.";
  } catch (error) {
    job.status = "failed";
    job.error = error.message;
    job.message = "Discovery could not be completed.";

    console.error("Lead discovery failed:", error.message);
  } finally {
    job.completedAt = new Date().toISOString();

    if (activeJobId === job.id) {
      activeJobId = null;
    }
  }
}

function startDiscovery(pool, { category, location }) {
  if (activeJobId) {
    const activeJob = jobs.get(activeJobId);

    if (activeJob && activeJob.status === "running") {
      throw new Error("Another discovery job is already running.");
    }

    activeJobId = null;
  }

  const normalizedCategory = normalizeCategory(category);

  if (!normalizedCategory) {
    throw new Error(
      "This category is not supported yet. Try companies, education, organizations, retail, professional services or healthcare."
    );
  }

  if (
    typeof location !== "string" ||
    !location.trim() ||
    location.trim().length > 150
  ) {
    throw new Error("Enter a valid location (maximum 150 characters).");
  }

  const job = {
    id: randomUUID(),
    category: String(category || "all"),
    categoryKey: normalizedCategory,
    location: location.trim(),
    status: "queued",
    message: "Discovery job queued.",
    discovered: 0,
    processed: 0,
    inserted: 0,
    duplicates: 0,
    skipped: 0,
    error: null,
    createdAt: new Date().toISOString(),
    completedAt: null
  };

  jobs.set(job.id, job);
  activeJobId = job.id;

  setImmediate(() => {
    runDiscovery(pool, job);
  });

  return job;
}

function getDiscoveryJob(id) {
  return jobs.get(id) || null;
}

module.exports = {
  startDiscovery,
  getDiscoveryJob
};
