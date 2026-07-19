const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(6).toString("hex");
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${unique}-${safeName}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB per file

// Render provides DATABASE_URL automatically once you link a Postgres database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      full_name TEXT,
      roll_number TEXT,
      college_name TEXT,
      course TEXT,
      course_year TEXT,
      skills TEXT,
      certificates JSONB,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

app.use(express.json());
app.use(express.static(path.join(__dirname))); // serves index.html, style.css, script.js
app.use("/uploads", express.static(UPLOAD_DIR)); // serves uploaded certificate files

// Upload a single certificate file, returns its public URL
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file received" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Create a new saved resume
app.post("/api/save", async (req, res) => {
  try {
    const id = crypto.randomBytes(5).toString("hex");
    const {
      fullName,
      rollNumber,
      collegeName,
      course,
      courseYear,
      skills,
      certificates,
    } = req.body;

    await pool.query(
      `INSERT INTO resumes
        (id, full_name, roll_number, college_name, course, course_year, skills, certificates)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        fullName,
        rollNumber,
        collegeName,
        course,
        courseYear,
        skills,
        JSON.stringify(certificates || []),
      ]
    );

    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save resume" });
  }
});

// Update an existing saved resume
app.put("/api/save", async (req, res) => {
  try {
    const {
      id,
      fullName,
      rollNumber,
      collegeName,
      course,
      courseYear,
      skills,
      certificates,
    } = req.body;

    if (!id) return res.status(400).json({ error: "Missing id" });

    await pool.query(
      `UPDATE resumes SET
        full_name=$2, roll_number=$3, college_name=$4, course=$5,
        course_year=$6, skills=$7, certificates=$8, updated_at=NOW()
       WHERE id=$1`,
      [
        id,
        fullName,
        rollNumber,
        collegeName,
        course,
        courseYear,
        skills,
        JSON.stringify(certificates || []),
      ]
    );

    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update resume" });
  }
});

// Fetch a single saved resume by id
app.get("/api/resume/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM resumes WHERE id=$1", [
      req.params.id,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });

    const row = rows[0];
    res.json({
      fullName: row.full_name,
      rollNumber: row.roll_number,
      collegeName: row.college_name,
      course: row.course,
      courseYear: row.course_year,
      skills: row.skills,
      certificates: row.certificates,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch resume" });
  }
});

// List all saved resumes (simple admin view)
app.get("/api/submissions", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, full_name, roll_number, college_name, course, updated_at FROM resumes ORDER BY updated_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list resumes" });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });