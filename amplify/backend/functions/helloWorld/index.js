exports.handler = async (event, context, callback) => {
  const result = {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "pong",
      timestamp: new Date().toISOString(),
      requestId: (context && context.awsRequestId) || "local-mock-request-id"
    })
  };

  if (callback) {
    callback(null, result);
    return;
  }

  return result;
};
