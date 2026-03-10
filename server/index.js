const express = require("express");
const cors = require("cors");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const archiver = require("archiver");
const { handler: helloWorld } = require("../amplify/backend/functions/helloWorld/index.js");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(
  express.json({
    limit: "5mb"
  })
);

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
async function sendContactToDana({ name, email, imageRef, passType }) {
  try {
    const endpoint =
      process.env.DANA_CONTACTS_URL ||
      "https://ws.danaconnect.com/api/contacts/rest/webdb/table/PRUEBAASEGURADORAFO1";
    const authBasic =
      process.env.DANA_AUTH_BASIC ||
      "Y2RlbGdhZG9AdmVudHVyZXN0YXJzOkNhbWlvMTIxMS0=";

    const safe = (value) => (value || "").toString().replace(/"/g, '""');

    const typeLabelMap = {
      eventTicket: "Event Ticket",
      boardingPass: "Boarding Pass",
      storeCard: "Store Card",
      coupon: "Coupon",
      generic: "Generic",
      transit: "Transit"
    };

    const typeLabel = typeLabelMap[passType] || passType || "Unknown";

    const csvLine = `"${safe(name)}","${safe(email)}","${safe(
      imageRef
    )}","${safe(typeLabel)}"\n`;

    const formData = new FormData();
    formData.append("delimiter", '"');
    formData.append("encodingType", "UTF-8");
    formData.append("includeHeaders", "false");
    formData.append("operationType", "INSALL");
    formData.append("separator", ",");
    formData.append("strict", "true");
    formData.append("fieldsCode", "NOMBRE;EMAIL;IMAGEN;TIPODEPASE");

    const csvBlob = new Blob([csvLine], { type: "text/csv" });
    formData.append("file", csvBlob, "contacto_sin_encabezado.csv");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authBasic}`
      },
      body: formData
    });

    if (!response.ok) {
      console.error(
        "Error al enviar contacto a Dana:",
        response.status,
        response.statusText
      );
      return;
    }

    const data = await response.json().catch(() => null);
    console.log("Contacto enviado a Dana correctamente", data || "");
  } catch (error) {
    console.error("Error inesperado al enviar contacto a Dana:", error);
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

app.post("/dana-contact", async (req, res) => {
  try {
    const name = (req.body?.name || "").toString();
    const email = (req.body?.email || "").toString();
    const photoDataUrl = (req.body?.photoDataUrl || "").toString();
    const passType = (req.body?.passType || "eventTicket").toString();

    const imageRef =
      photoDataUrl ||
      "https://media.istockphoto.com/id/1389348844/es/foto/foto-de-estudio-de-una-hermosa-joven-sonriendo-mientras-est%C3%A1-de-pie-sobre-un-fondo-gris.jpg?s=612x612&w=0&k=20&c=kUufmNoTnDcRbyeHhU1wRiip-fNjTWP9owjHf75frFQ=";

    await sendContactToDana({ name, email, imageRef, passType });
    res.json({ ok: true });
  } catch (error) {
    console.error("Error en /dana-contact", error);
    res.status(500).json({ ok: false });
  }
});

app.get("/pkpass", async (req, res) => {
  // Versión GET: usa solo query params, sin imagen.
  const templateDir = path.join(__dirname, "..", "pass-template");
  const templatePassPath = path.join(templateDir, "pass.json");

  try {
    const name = (req.query.name || "Juan Pérez").toString();
    const email = (req.query.email || "").toString();

    const passTemplateRaw = await fs.readFile(templatePassPath, "utf8");
    const passTemplate = JSON.parse(passTemplateRaw);

    const pass = { ...passTemplate };

    if (pass.eventTicket && Array.isArray(pass.eventTicket.primaryFields)) {
      pass.eventTicket.primaryFields = [...pass.eventTicket.primaryFields];
      if (pass.eventTicket.primaryFields[0]) {
        pass.eventTicket.primaryFields[0] = {
          ...pass.eventTicket.primaryFields[0],
          value: name
        };
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
        message: `https://example.com/carnet?name=${encodeURIComponent(
          name
        )}&email=${encodeURIComponent(email)}`
      };
    }

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

app.post("/pkpass", async (req, res) => {
  const templateDir = path.join(__dirname, "..", "pass-template");
  const templatePassPath = path.join(templateDir, "pass.json");

  try {
    const name = (req.body?.name || "Juan Pérez").toString();
    const email = (req.body?.email || "").toString();
    const photoDataUrl = (req.body?.photoDataUrl || "").toString();
    const passType = (req.body?.passType || "eventTicket").toString();

    const passTemplateRaw = await fs.readFile(templatePassPath, "utf8");
    const passTemplate = JSON.parse(passTemplateRaw);

    const pass = { ...passTemplate };

    // Determinar la "clase" de pase según lo elegido en la UI.
    const typeMap = {
      eventTicket: "eventTicket",
      boardingPass: "boardingPass",
      storeCard: "storeCard",
      coupon: "coupon",
      generic: "generic",
      transit: "boardingPass"
    };

    const styleKey = typeMap[passType] || "eventTicket";

    // Usamos eventTicket del template como base para todos los estilos.
    const baseLayout =
      passTemplate.eventTicket ||
      passTemplate.generic || {
        headerFields: [],
        primaryFields: [],
        secondaryFields: [],
        auxiliaryFields: []
      };

    // Clonar el layout base para el estilo seleccionado.
    pass[styleKey] = JSON.parse(JSON.stringify(baseLayout));

    // Eliminar otros estilos para que solo exista uno.
    ["eventTicket", "boardingPass", "storeCard", "coupon", "generic"].forEach(
      (key) => {
        if (key !== styleKey && pass[key]) {
          delete pass[key];
        }
      }
    );

    const layout = pass[styleKey];

    // Para boardingPass/transit, se requiere transitType.
    if (styleKey === "boardingPass") {
      layout.transitType = layout.transitType || "PKTransitTypeBus";
    }

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

    // Campo asegurado dinámico en auxiliaryFields
    if (Array.isArray(layout.auxiliaryFields)) {
      layout.auxiliaryFields = [...layout.auxiliaryFields];
      const aseguradoIndex = layout.auxiliaryFields.findIndex(
        (f) => f.key === "asegurado"
      );
      const aseguradoField = {
        key: "asegurado",
        label: "Asegurado",
        value: name
      };
      if (aseguradoIndex >= 0) {
        layout.auxiliaryFields[aseguradoIndex] = aseguradoField;
      } else {
        layout.auxiliaryFields.push(aseguradoField);
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
        message: `https://example.com/carnet?name=${encodeURIComponent(
          name
        )}&email=${encodeURIComponent(email)}`
      };
    }

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
