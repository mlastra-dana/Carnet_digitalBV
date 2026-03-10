exports.handler = async (event, context, callback) => {
  const response = {
    message: "pong",
    timestamp: new Date().toISOString(),
    requestId: (context && context.awsRequestId) || "local-mock-request-id"
  };

  const result = {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(response)
  };

  if (callback) {
    callback(null, result);
    return;
  }

  return result;
};

