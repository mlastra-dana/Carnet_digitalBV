import { defineBackend } from "@aws-amplify/backend";
import { myApi } from "./backend/api/myApi/resource";
import { helloWorld } from "./backend/functions/helloWorld/resource";
import { addOutput } from "@aws-amplify/backend-output-plugin";
import { generatePkpass } from "./generatePkpass/resource";


const backend = defineBackend({
  myApi,
  helloWorld,
  generatePkpass
});

addOutput({
  apiUrl: backend.myApi.url,
  lambdaName: backend.helloWorld.name
});

export default backend;