function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

function parseEventBody(event) {
  if (!event || !event.body) return {};
  if (typeof event.body === "object") return event.body;
  try {
    return JSON.parse(event.body);
  } catch (_error) {
    return {};
  }
}

function getFileIdFromUploadResponse(data) {
  if (!data || typeof data !== "object") return null;
  return (
    data.fileId ||
    data.fileID ||
    data.id ||
    data?.data?.fileId ||
    data?.data?.fileID ||
    data?.result?.fileId ||
    data?.result?.fileID ||
    null
  );
}

function toBase64(value) {
  return Buffer.from(value || "", "utf8").toString("base64");
}

async function uploadFileToDana({ documentId, pkpassBase64, authBasic }) {
  const uploadUrl =
    process.env.DANA_FILE_UPLOAD_URL ||
    "https://ws.danaconnect.com/dana/conversation/http/rest/file/upload";
  const fileBuffer = Buffer.from(pkpassBase64, "base64");
  const formData = new FormData();
  const fileName = `${(documentId || "documento").replace(/[^a-zA-Z0-9_-]/g, "_")}.pkpass`;

  formData.append(
    "file",
    new Blob([fileBuffer], { type: "application/vnd.apple.pkpass" }),
    fileName
  );

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authBasic}`
    },
    body: formData
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => "");
    throw new Error(
      text || `Error subiendo archivo a Dana: ${uploadResponse.status} ${uploadResponse.statusText}`
    );
  }

  const uploadJson = await uploadResponse.json().catch(() => ({}));
  const fileId = getFileIdFromUploadResponse(uploadJson);
  if (!fileId) {
    throw new Error("Dana no devolvió fileId en la carga del archivo.");
  }

  return fileId;
}

async function triggerDanaConversation({
  nombreCliente,
  documentId,
  email,
  fileId,
  authBasic
}) {
  const triggerUrl =
    process.env.DANA_CONVERSATION_TRIGGER_URL ||
    "https://ws.danaconnect.com/dana/conversation/http/rest/conversation/trigger";

  const body = {
    NOMBRECLIENTE: nombreCliente,
    DOCUMENT_ID: documentId,
    EMAIL: email,
    fileId
  };

  const triggerResponse = await fetch(triggerUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authBasic}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!triggerResponse.ok) {
    const text = await triggerResponse.text().catch(() => "");
    throw new Error(
      text ||
        `Error disparando conversación en Dana: ${triggerResponse.status} ${triggerResponse.statusText}`
    );
  }

  return triggerResponse.json().catch(() => ({}));
}

async function handleDanaConversation(event) {
  const body = parseEventBody(event);
  const nombreCliente = (body.NOMBRECLIENTE || "").toString().trim();
  const documentId = (body.DOCUMENT_ID || "").toString().trim();
  const email = (body.EMAIL || "").toString().trim();
  const pkpassBase64 = (body.PKPASS_FILE_BASE64 || "").toString().trim();

  if (!nombreCliente || !documentId || !email || !pkpassBase64) {
    return jsonResponse(400, {
      ok: false,
      message:
        "Payload inválido. Se requiere NOMBRECLIENTE, DOCUMENT_ID, EMAIL y PKPASS_FILE_BASE64."
    });
  }

  const authBasic =
    process.env.DANA_AUTH_BASIC ||
    toBase64(`${process.env.DANA_USERNAME || ""}:${process.env.DANA_PASSWORD || ""}`);

  if (!authBasic || authBasic === "Og==") {
    return jsonResponse(500, {
      ok: false,
      message: "Faltan credenciales de Dana en el backend."
    });
  }

  try {
    const fileId = await uploadFileToDana({
      documentId,
      pkpassBase64,
      authBasic
    });
    const conversationResponse = await triggerDanaConversation({
      nombreCliente,
      documentId,
      email,
      fileId,
      authBasic
    });

    return jsonResponse(200, {
      ok: true,
      fileId,
      conversation: conversationResponse
    });
  } catch (error) {
    return jsonResponse(502, {
      ok: false,
      message: error?.message || "Error en integración con Dana."
    });
  }
}

exports.handler = async (event, context, callback) => {
  const rawPath = event?.rawPath || event?.path || "";
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  let result;

  if (rawPath === "/dana/conversation" && method === "POST") {
    result = await handleDanaConversation(event);
  } else {
    result = jsonResponse(200, {
      message: "pong",
      timestamp: new Date().toISOString(),
      requestId: (context && context.awsRequestId) || "local-mock-request-id"
    });
  }

  if (callback) {
    callback(null, result);
    return;
  }

  return result;
};
