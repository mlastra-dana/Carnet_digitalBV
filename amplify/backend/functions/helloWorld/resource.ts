import { lambda } from "@aws-amplify/backend";

export const helloWorld = lambda({
  name: "helloWorld",
  entry: "./index.js"
});

