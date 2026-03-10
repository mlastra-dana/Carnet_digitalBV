import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { handler as helloWorldHandler } from "../../functions/helloWorld/index";

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  if (event.rawPath === "/ping" && event.requestContext.http.method === "GET") {
    return helloWorldHandler(event, {} as any, () => {});
  }

  return {
    statusCode: 404,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Not found" })
  };
}

