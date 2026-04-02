const express = require("express");
const cors = require("cors");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const archiver = require("archiver");
const { recognize } = require("tesseract.js");
const { handler: helloWorld } = require("../amplify/backend/functions/helloWorld/index.js");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(
  express.json({
    limit: "20mb"
  })
);

function buildQrDemoMessage(name, email) {
  const safeName = (name || "ASEGURADO").toString().trim();
  const safeEmail = (email || "sin-email").toString().trim();
  return `LBC-DEMO|${safeName}|${safeEmail}|CARNET-DIGITAL`;
}

function escapeHtml(value) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeContactUrl(rawUrl) {
  const input = (rawUrl || "").toString().trim();
  if (!input) return "";
  if (/^https?:\/\//i.test(input) || /^mailto:/i.test(input) || /^tel:/i.test(input)) {
    return input;
  }
  return `https://${input}`;
}

function applyContactBackFields(pass, { contactUrlInput, email }) {
  if (!pass.eventTicket) return;

  if (!Array.isArray(pass.eventTicket.backFields)) {
    pass.eventTicket.backFields = [];
  } else {
    pass.eventTicket.backFields = [...pass.eventTicket.backFields];
  }

  const upsertBackField = (field) => {
    const index = pass.eventTicket.backFields.findIndex(
      (current) => current?.key === field.key
    );
    if (index >= 0) {
      pass.eventTicket.backFields[index] = field;
      return;
    }
    pass.eventTicket.backFields.push(field);
  };

  // Siempre agregamos una nota para garantizar que el pase tenga reverso/detalles.
  upsertBackField({
    key: "nota_carnet",
    label: "Información",
    value: "Carnet digital de asegurado LBC Seguros."
  });

  const normalizedEmail = (email || "").toString().trim();
  if (normalizedEmail) {
    upsertBackField({
      key: "email_contacto",
      label: "Email",
      value: normalizedEmail
    });
  }

  const contactUrl = sanitizeContactUrl(contactUrlInput || process.env.PKPASS_CONTACT_URL);
  if (!contactUrl) return;

  const safeHref = escapeHtml(contactUrl);
  upsertBackField({
    key: "contacto",
    label: "Contacto",
    value: contactUrl,
    attributedValue: `<a href="${safeHref}">Abrir contacto</a>`
  });
}

function normalizeNameText(value) {
  return (value || "")
    .replace(/[^A-Za-zÀ-ÿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanBoliviaNameValue(value, maxWords = 4) {
  const cleaned = normalizeNameText((value || "").split(/[|><]/)[0] || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  const noiseWords = new Set([
    "ESTADO",
    "PLURINACIONAL",
    "BOLIVIA",
    "SERVICIO",
    "GENERAL",
    "IDENTIFICACION",
    "PERSONAL",
    "NACIMIENTO",
    "NACIONALIDAD",
    "FIRMA",
    "TITULAR",
    "CARNET",
    "IDENTIDAD",
    "APELLIDO",
    "APELLIDOS",
    "NOMBRE",
    "NOMBRES",
    "CI",
    "SEGIP",
    "NUMERO",
    "DOCUMENTO"
  ]);

  return cleaned
    .split(" ")
    .filter((word) => word && !noiseWords.has(word))
    .slice(0, maxWords)
    .join(" ")
    .trim();
}

function extractLabeledBoliviaField(lines, labels, maxWords = 3) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineUpper = line.toUpperCase();
    const matchedLabel = labels.find((label) => lineUpper.includes(label));
    if (!matchedLabel) continue;

    const inline = line
      .replace(new RegExp(`.*${matchedLabel}\\s*[:\\-]?\\s*`, "i"), "")
      .trim();
    const cleanInline = cleanBoliviaNameValue(inline, maxWords);
    if (cleanInline) return cleanInline;

    const nextLine = cleanBoliviaNameValue(lines[index + 1] || "", maxWords);
    if (nextLine) return nextLine;
  }
  return "";
}

function formatBoliviaDocumentId(digits, complement, expedition) {
  if (!digits) return "";
  const normalizedComplement = (complement || "").replace(/[^0-9A-Z]/gi, "").toUpperCase();
  const normalizedExpedition = (expedition || "").replace(/[^A-Z]/gi, "").toUpperCase();
  return [
    `${digits}${normalizedComplement ? `-${normalizedComplement}` : ""}`,
    normalizedExpedition
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function extractBoliviaDocumentId(lines) {
  const joinedText = lines.join(" ");
  const labelFocusedText = lines
    .filter((line) =>
      /(C[.\s]?I\b|CARNET|NRO|Nº|N°|NUMERO|DOCUMENTO|IDENTIDAD)/i.test(line)
    )
    .join(" ");
  const searchText = `${labelFocusedText} ${joinedText}`.trim();
  const docRegex =
    /\b([0-9]{5,10})(?:\s*[-.]\s*([0-9A-Z]{1,3}))?(?:\s+(LP|CB|SC|OR|PT|CH|TJ|BE|PD))?\b/gi;

  let bestMatch = null;
  let currentMatch = docRegex.exec(searchText);
  while (currentMatch) {
    const digits = (currentMatch[1] || "").replace(/\D/g, "");
    const complement = (currentMatch[2] || "").toUpperCase();
    const expedition = (currentMatch[3] || "").toUpperCase();
    if (digits.length >= 5 && digits.length <= 10) {
      if (!bestMatch || digits.length > bestMatch.digits.length) {
        bestMatch = { digits, complement, expedition };
      }
    }
    currentMatch = docRegex.exec(searchText);
  }

  if (!bestMatch) return "";
  return formatBoliviaDocumentId(bestMatch.digits, bestMatch.complement, bestMatch.expedition);
}

function parseBoliviaIdCardData(ocrText) {
  const lines = (ocrText || "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const apellidoPaterno = extractLabeledBoliviaField(
    lines,
    ["APELLIDO PATERNO", "PRIMER APELLIDO"],
    2
  );
  const apellidoMaterno = extractLabeledBoliviaField(
    lines,
    ["APELLIDO MATERNO", "SEGUNDO APELLIDO"],
    2
  );
  const genericLastNames = extractLabeledBoliviaField(lines, ["APELLIDOS", "APELLIDO"], 3);
  let lastNamesValue = [apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ").trim();
  if (!lastNamesValue) {
    lastNamesValue = genericLastNames;
  }

  let firstNamesValue = extractLabeledBoliviaField(lines, ["NOMBRES", "NOMBRE"], 3);

  if (!firstNamesValue || !lastNamesValue) {
    const candidateLines = lines
      .map((line) => cleanBoliviaNameValue(line, 3))
      .filter((line) => line.split(" ").length >= 2);
    if (!lastNamesValue && candidateLines[0]) {
      lastNamesValue = candidateLines[0].split(" ").slice(0, 2).join(" ");
    }
    if (!firstNamesValue && candidateLines[1]) {
      firstNamesValue = candidateLines[1];
    }
  }

  const documentIdValue = extractBoliviaDocumentId(lines);

  return {
    firstNamesValue,
    lastNamesValue,
    documentIdValue
  };
}

function decodeDataUrlToBuffer(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") {
    throw new Error("Imagen vacía.");
  }
  const matched = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matched?.[2]) {
    throw new Error("Formato de imagen inválido. Se esperaba data URL base64.");
  }
  return Buffer.from(matched[2], "base64");
}

async function createSignedPkpass({
  res,
  pass,
  templateDir,
  photoDataUrl
}) {
  const tmpRoot = os.tmpdir();
  const tmpDir = await fs.mkdtemp(path.join(tmpRoot, "pkpass-"));

  try {
    const certPath = path.join(__dirname, "..", "certs", "pass-cert.pem");
    const keyPath = path.join(__dirname, "..", "certs", "pass-key.pem");
    const certPassword = process.env.PKPASS_CERT_PASSWORD || "";

    const [certStat, keyStat] = await Promise.all([
      fs.stat(certPath),
      fs.stat(keyPath)
    ]);

    if (!certStat.isFile() || !keyStat.isFile()) {
      throw new Error("Certificados para pkpass no encontrados o no son archivos.");
    }

    const entries = await fs.readdir(templateDir);
    await Promise.all(
      entries
        .filter((file) => file !== "pass.json")
        .map(async (file) => {
          const src = path.join(templateDir, file);
          const dest = path.join(tmpDir, file);
          const stats = await fs.stat(src);
          if (stats.isFile()) {
            await fs.copyFile(src, dest);
          }
        })
    );

    const passPath = path.join(tmpDir, "pass.json");
    await fs.writeFile(passPath, JSON.stringify(pass, null, 2), "utf8");

    if (photoDataUrl && photoDataUrl.startsWith("data:")) {
      const commaIndex = photoDataUrl.indexOf(",");
      const base64 = photoDataUrl.slice(commaIndex + 1);
      const buffer = Buffer.from(base64, "base64");
      const thumbnailPath = path.join(tmpDir, "thumbnail.png");
      await fs.writeFile(thumbnailPath, buffer);
    }

    const filesForManifest = await fs.readdir(tmpDir);
    const manifest = {};

    for (const file of filesForManifest) {
      const filePath = path.join(tmpDir, file);
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        const content = await fs.readFile(filePath);
        const hash = crypto.createHash("sha1").update(content).digest("hex");
        manifest[file] = hash;
      }
    }

    const manifestPath = path.join(tmpDir, "manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    const signaturePath = path.join(tmpDir, "signature");

    await new Promise((resolve, reject) => {
      const child = execFile(
        "openssl",
        [
          "smime",
          "-binary",
          "-sign",
          "-signer",
          certPath,
          "-inkey",
          keyPath,
          "-in",
          manifestPath,
          "-out",
          signaturePath,
          "-outform",
          "DER",
          "-passin",
          "env:PKPASS_CERT_PASSWORD"
        ],
        {
          env: {
            ...process.env,
            PKPASS_CERT_PASSWORD: certPassword
          }
        },
        (error, stdout, stderr) => {
          if (error) {
            console.error("Error al firmar el pkpass con openssl:", stderr);
            reject(error);
          } else {
            resolve();
          }
        }
      );

      child.on("error", reject);
    });

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("Error creando el archivo pkpass firmado", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error al generar el archivo pkpass" });
      } else {
        res.end();
      }
    });

    archive.pipe(res);
    archive.directory(tmpDir, false);
    archive.finalize();
  } catch (error) {
    console.error("Error preparando pkpass firmado", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error al generar el archivo pkpass" });
    } else {
      res.end();
    }
  }
}
app.get("/ping", async (req, res) => {
  try {
    const lambdaResponse = await helloWorld(
      {},
      { awsRequestId: "local-express-request" },
      null
    );
    res
      .status(lambdaResponse.statusCode || 200)
      .set(lambdaResponse.headers || {})
      .send(lambdaResponse.body);
  } catch (error) {
    console.error("Error in /ping handler", error);
    res.status(500).json({ message: "Internal server error in local mock /ping" });
  }
});

app.get("/pkpass", async (req, res) => {
  // Versión GET: usa solo query params, sin imagen.
  const templateDir = path.join(__dirname, "..", "pass-template");
  const templatePassPath = path.join(templateDir, "pass.json");

  try {
    const name = (req.query.name || "Juan Pérez").toString();
    const email = (req.query.email || "").toString();
    const contactUrl = (req.query.contactUrl || "").toString();

    const passTemplateRaw = await fs.readFile(templatePassPath, "utf8");
    const passTemplate = JSON.parse(passTemplateRaw);

    const pass = { ...passTemplate };

    if (pass.eventTicket && Array.isArray(pass.eventTicket.primaryFields)) {
      pass.eventTicket.primaryFields = [...pass.eventTicket.primaryFields];
      const aseguradoFieldIndex = pass.eventTicket.primaryFields.findIndex(
        (f) => f.key === "asegurado"
      );
      const aseguradoField = {
        key: "asegurado",
        label: "Asegurado",
        value: name
      };
      if (aseguradoFieldIndex >= 0) {
        pass.eventTicket.primaryFields[aseguradoFieldIndex] = aseguradoField;
      } else {
        pass.eventTicket.primaryFields.push(aseguradoField);
      }
    }

    if (pass.eventTicket && Array.isArray(pass.eventTicket.secondaryFields)) {
      pass.eventTicket.secondaryFields = [...pass.eventTicket.secondaryFields];
      const emailFieldIndex = pass.eventTicket.secondaryFields.findIndex(
        (f) => f.key === "email"
      );
      const emailField = {
        key: "email",
        label: "Email",
        value: email || "no-email"
      };
      if (emailFieldIndex >= 0) {
        pass.eventTicket.secondaryFields[emailFieldIndex] = emailField;
      } else {
        pass.eventTicket.secondaryFields.push(emailField);
      }
    }

    if (Array.isArray(pass.barcodes) && pass.barcodes[0]) {
      pass.barcodes[0] = {
        ...pass.barcodes[0],
        message: buildQrDemoMessage(name, email)
      };
    }

    applyContactBackFields(pass, { contactUrlInput: contactUrl, email });

    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="carnet-asegurado.pkpass"'
    );

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("Error creating pkpass archive", err);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ message: "Error al generar el archivo pkpass" });
      } else {
        res.end();
      }
    });

    archive.pipe(res);

    // Añadir todos los archivos del template excepto pass.json
    const entries = await fs.readdir(templateDir);
    await Promise.all(
      entries
        .filter((file) => file !== "pass.json")
        .map(async (file) => {
          const filePath = path.join(templateDir, file);
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            archive.file(filePath, { name: file });
          }
        })
    );

    // Añadir pass.json generado dinámicamente
    archive.append(JSON.stringify(pass, null, 2), { name: "pass.json" });

    archive.finalize();
  } catch (error) {
    console.error("Error preparing pkpass", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error al generar el archivo pkpass" });
    } else {
      res.end();
    }
  }
});

app.post("/ocr-id", async (req, res) => {
  try {
    const imageBase64 = (req.body?.imageBase64 || "").toString();
    const sourceLabel = (req.body?.sourceLabel || "documento").toString();
    if (!imageBase64) {
      res.status(400).json({ message: "Debes enviar imageBase64 en formato data URL." });
      return;
    }

    const imageBuffer = decodeDataUrlToBuffer(imageBase64);

    const ocrResult = await Promise.race([
      recognize(imageBuffer, "spa+eng"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("OCR demoró demasiado tiempo.")), 45000)
      )
    ]);

    const ocrText = (ocrResult?.data?.text || "").trim();
    if (!ocrText) {
      res.status(422).json({ message: "OCR no detectó texto legible en el documento." });
      return;
    }

    const parsed = parseBoliviaIdCardData(ocrText);
    const debugSample = ocrText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(" | ");

    res.json({
      sourceLabel,
      firstNamesValue: parsed.firstNamesValue || "",
      lastNamesValue: parsed.lastNamesValue || "",
      documentIdValue: parsed.documentIdValue || "",
      confidence: Number(ocrResult?.data?.confidence || 0),
      debugSample
    });
  } catch (error) {
    console.error("Error en /ocr-id", error);
    res.status(500).json({
      message: "No se pudo procesar OCR en backend.",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/pkpass", async (req, res) => {
  const templateDir = path.join(__dirname, "..", "pass-template");
  const templatePassPath = path.join(templateDir, "pass.json");

  try {
    const name = (req.body?.name || "Juan Pérez").toString();
    const email = (req.body?.email || "").toString();
    const photoDataUrl = (req.body?.photoDataUrl || "").toString();
    const contactUrl = (req.body?.contactUrl || "").toString();

    const passTemplateRaw = await fs.readFile(templatePassPath, "utf8");
    const passTemplate = JSON.parse(passTemplateRaw);

    const pass = { ...passTemplate };

    // Mantener un único estilo de pase: carnet de asegurado.
    if (!pass.eventTicket) {
      pass.eventTicket = {
        headerFields: [],
        primaryFields: [],
        secondaryFields: [],
        auxiliaryFields: []
      };
    }

    const layout = pass.eventTicket;

    // Sesión dinámica (número aleatorio) en headerFields
    if (Array.isArray(layout.headerFields)) {
      layout.headerFields = [...layout.headerFields];
      const sessionId = Math.floor(100000 + Math.random() * 900000).toString();
      if (layout.headerFields[0]) {
        layout.headerFields[0] = {
          ...layout.headerFields[0],
          value: sessionId
        };
      }
    }

    // Campo asegurado dinámico en primaryFields
    if (Array.isArray(layout.primaryFields)) {
      layout.primaryFields = [...layout.primaryFields];
      const aseguradoIndex = layout.primaryFields.findIndex(
        (f) => f.key === "asegurado"
      );
      const aseguradoField = {
        key: "asegurado",
        label: "Asegurado",
        value: name
      };
      if (aseguradoIndex >= 0) {
        layout.primaryFields[aseguradoIndex] = aseguradoField;
      } else {
        layout.primaryFields.push(aseguradoField);
      }
    }

    if (Array.isArray(layout.secondaryFields)) {
      layout.secondaryFields = [...layout.secondaryFields];
      const emailFieldIndex = layout.secondaryFields.findIndex(
        (f) => f.key === "email"
      );
      const emailField = {
        key: "email",
        label: "Email",
        value: email || "no-email"
      };
      if (emailFieldIndex >= 0) {
        layout.secondaryFields[emailFieldIndex] = emailField;
      } else {
        layout.secondaryFields.push(emailField);
      }
    }

    if (Array.isArray(pass.barcodes) && pass.barcodes[0]) {
      pass.barcodes[0] = {
        ...pass.barcodes[0],
        message: buildQrDemoMessage(name, email)
      };
    }

    applyContactBackField(pass, contactUrl);

    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="carnet-asegurado.pkpass"'
    );

    await createSignedPkpass({
      res,
      pass,
      templateDir,
      photoDataUrl
    });
  } catch (error) {
    console.error("Error preparing pkpass (POST)", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error al generar el archivo pkpass" });
    } else {
      res.end();
    }
  }
});

app.listen(port, () => {
  console.log(`Local mock API listening on http://localhost:${port}`);
});
