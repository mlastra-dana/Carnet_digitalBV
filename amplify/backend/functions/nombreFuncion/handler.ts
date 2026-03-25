import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
} from "aws-lambda";

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

    const payload = {
      NOMBRECLIENTE:
        pickString(requestData.NOMBRECLIENTE) ||
        pickString(requestData.NombreCliente),
      DOCUMENT_ID:
        pickString(requestData.DOCUMENT_ID) ||
        pickString(requestData.Document_ID),
      PKPASS: pickString(requestData.PKPASS) || pickString(requestData.Pkpass),
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
