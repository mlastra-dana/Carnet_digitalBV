import { defineFunction } from "@aws-amplify/backend";

export const nombreFuncion = defineFunction({
  name: "nombreFuncion",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  environment: {
    LOG_LEVEL: "info",
    DANA_API_BASE: "https://appserv.danaconnect.com",
    DANA_PROJECT_ID: process.env.DANA_PROJECT_ID || "",
    DANA_USER: process.env.DANA_USER || "",
    DANA_IDCOMPANY: process.env.DANA_IDCOMPANY || "",
    DANA_PASSWORD: process.env.DANA_PASSWORD || "",
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || "",
    S3_KEY_PREFIX: process.env.S3_KEY_PREFIX || "pkpass",
    S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL || ""
  }
});
