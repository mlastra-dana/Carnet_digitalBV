import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
} from "aws-lambda";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type LambdaResponse = APIGatewayProxyStructuredResultV2;
type InputPayload = Record<string, unknown>;

const json = (statusCode: number, payload: Record<string, unknown>): LambdaResponse => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  body: JSON.stringify(payload)
});

const getEnv = (name: string, fallback = ""): string =>
  (process.env[name] || fallback).toString().trim();

const toBasicAuth = (user: string, idCompany: string, password: string): string => {
  const raw = `${user}@${idCompany}:${password}`;
  return `Basic ${Buffer.from(raw, "utf-8").toString("base64")}`;
};

const decodeBody = (event: APIGatewayProxyEventV2): InputPayload => {
  if (!event?.body) return {};

  const rawBody =
    event.isBase64Encoded === true
      ? Buffer.from(event.body, "base64").toString("utf-8")
      : event.body;

  const parsed = JSON.parse(rawBody);
  if (parsed && typeof parsed === "object") {
    return parsed as InputPayload;
  }
  return {};
};

const pickString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toBase64BodyBuffer = (value: string): Buffer => {
  const normalized = value.includes(",") ? (value.split(",").pop() || "") : value;
  return Buffer.from(normalized.replace(/\s+/g, ""), "base64");
};

const isLikelyPkpassZip = (buffer: Buffer): boolean => {
  if (!buffer || buffer.length < 4) return false;
  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  );
};

const buildS3ObjectKey = (keyPrefix: string, requestId: string, documentId?: string): string => {
  const normalizedPrefix = keyPrefix.replace(/^\/+|\/+$/g, "");
  const normalizedDocumentId = (documentId || "")
    .replace(/[^0-9A-Za-z_-]/g, "")
    .slice(0, 48);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileId = normalizedDocumentId || requestId || "asegurado";
  const filename = `${fileId}-${timestamp}.pkpass`;

  return normalizedPrefix ? `${normalizedPrefix}/${filename}` : filename;
};

const buildPkpassFileName = (documentId?: string): string => {
  const normalizedDocumentId = (documentId || "")
    .replace(/\D+/g, "")
    .slice(0, 48);
  return `${normalizedDocumentId || "asegurado"}.pkpass`;
};

const buildPublicReference = (
  bucketName: string,
  key: string,
  publicBaseUrl?: string
): string => {
  if (publicBaseUrl) {
    const normalizedBaseUrl = publicBaseUrl.replace(/\/+$/, "");
    const encodedKey = key.split("/").map((part) => encodeURIComponent(part)).join("/");
    return `${normalizedBaseUrl}/${encodedKey}`;
  }
  return `s3://${bucketName}/${key}`;
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<LambdaResponse> => {
  try {
    const projectId = getEnv("DANA_PROJECT_ID");
    const user = getEnv("DANA_USER");
    const idCompany = getEnv("DANA_IDCOMPANY");
    const password = getEnv("DANA_PASSWORD");
    const apiBase = getEnv("DANA_API_BASE", "https://appserv.danaconnect.com").replace(
      /\/+$/,
      ""
    );
    const s3BucketName = getEnv("S3_BUCKET_NAME");
    const s3KeyPrefix = getEnv("S3_KEY_PREFIX", "pkpass");
    const s3PublicBaseUrl = getEnv("S3_PUBLIC_BASE_URL");
    const awsRegion = getEnv("AWS_REGION", "us-east-1");

    const missing = [
      !projectId ? "DANA_PROJECT_ID" : "",
      !user ? "DANA_USER" : "",
      !idCompany ? "DANA_IDCOMPANY" : "",
      !password ? "DANA_PASSWORD" : ""
    ].filter(Boolean);

    if (missing.length > 0) {
      return json(500, {
        error: "Missing environment variables",
        required: missing
      });
    }

    let requestData: InputPayload = {};
    try {
      requestData = decodeBody(event);
    } catch {
      return json(400, {
        error: "InvalidJSON",
        message: "El body no es JSON valido."
      });
    }

    if (Object.keys(requestData).length === 0) {
      requestData = (event || {}) as unknown as InputPayload;
    }

    const requestPkpass =
      pickString(requestData.PKPASS) ||
      pickString(requestData.Pkpass) ||
      pickString(requestData.pkpass);
    const documentId =
      pickString(requestData.DOCUMENT_ID) || pickString(requestData.Document_ID);
    const pkpassBase64 =
      pickString(requestData.PKPASS_BASE64) ||
      pickString(requestData.PkpassBase64) ||
      pickString(requestData.pkpassBase64);
    const pkpassFileName = buildPkpassFileName(documentId);

    let uploadedPkpassReference: string | undefined;

    if (pkpassBase64 && s3BucketName) {
      try {
        const requestId = event?.requestContext?.requestId || "unknown-request-id";
        const key = buildS3ObjectKey(
          s3KeyPrefix,
          requestId,
          documentId
        );
        const pkpassBodyBuffer = toBase64BodyBuffer(pkpassBase64);

        if (pkpassBodyBuffer.length === 0) {
          return json(400, {
            error: "InvalidPkpassBase64",
            message: "PKPASS_BASE64 esta vacio o no es valido."
          });
        }

        if (!isLikelyPkpassZip(pkpassBodyBuffer)) {
          return json(400, {
            error: "InvalidPkpassBinary",
            message: "El archivo PKPASS decodificado no tiene formato ZIP valido."
          });
        }

        const s3Client = new S3Client({ region: awsRegion });
        await s3Client.send(
          new PutObjectCommand({
            Bucket: s3BucketName,
            Key: key,
            Body: pkpassBodyBuffer,
            ContentType: "application/vnd.apple.pkpass",
            ContentDisposition: `attachment; filename="${pkpassFileName}"`
          })
        );

        uploadedPkpassReference = buildPublicReference(s3BucketName, key, s3PublicBaseUrl);
      } catch (error) {
        console.error("Error subiendo PKPASS a S3", {
          error: error instanceof Error ? error.message : error
        });

        return json(500, {
          error: "PkpassUploadFailed",
          message: "No se pudo subir el archivo PKPASS al bucket S3."
        });
      }
    }

    const payload = {
      NOMBRECLIENTE:
        pickString(requestData.NOMBRECLIENTE) ||
        pickString(requestData.NombreCliente),
      DOCUMENT_ID:
        documentId,
      PKPASS: uploadedPkpassReference || requestPkpass,
      EMAIL:
        pickString(requestData.EMAIL) ||
        pickString(requestData.Email) ||
        pickString(requestData.email)
    };

    const filteredPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => Boolean(value))
    );

    if (Object.keys(filteredPayload).length === 0) {
      return json(400, {
        error: "EmptyPayload",
        message:
          "Debes enviar al menos un campo: NOMBRECLIENTE, DOCUMENT_ID, PKPASS o EMAIL."
      });
    }

    const url = `${apiBase}/api/1.0/rest/conversation/ProjectID/${projectId}/start/data`;

    console.log(
      JSON.stringify({
        projectId,
        url,
        payloadKeys: Object.keys(filteredPayload),
        pkpassStoredInS3: Boolean(uploadedPkpassReference),
        requestId: event?.requestContext?.requestId || "unknown-request-id"
      })
    );

    const upstreamResponse = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: toBasicAuth(user, idCompany, password),
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-DEBUG": "0"
      },
      body: JSON.stringify(filteredPayload)
    });

    const responseText = await upstreamResponse.text();
    let responseBody: Record<string, unknown>;

    try {
      responseBody = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      responseBody = { raw_response: responseText };
    }

    return json(upstreamResponse.status, responseBody);
  } catch (error) {
    console.error("nombreFuncion failed", {
      error: error instanceof Error ? error.message : error
    });

    const message = error instanceof Error ? error.message : "Internal server error";

    return json(500, {
      error: "InternalError",
      message
    });
  }
};
