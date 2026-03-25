import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { handler as helloWorldHandler } from "../../functions/helloWorld/index";
import { handler as nombreFuncionHandler } from "../../functions/nombreFuncion/handler";

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  if (event.rawPath === "/ping" && event.requestContext.http.method === "GET") {
    return helloWorldHandler(event, {} as any, () => {});
  }
  if (
    event.rawPath === "/start-conversation" &&
    event.requestContext.http.method === "POST"
  ) {
    return nombreFuncionHandler(event);
  }

  return {
    statusCode: 404,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Not found" })
  };
}
