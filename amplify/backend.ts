import { defineBackend } from "@aws-amplify/backend";
import { myApi } from "./backend/api/myApi/resource";
import { helloWorld } from "./backend/functions/helloWorld/resource";
import { addOutput } from "@aws-amplify/backend-output-plugin";
import { generatePkpass } from "./backend/functions/generatePkpass/resource";
import { nombreFuncion } from "./backend/functions/nombreFuncion/resource";


const backend = defineBackend({
  myApi,
  helloWorld,
  generatePkpass,
  nombreFuncion
});

addOutput({
  apiUrl: backend.myApi.url,
  lambdaName: backend.helloWorld.name,
  nombreFuncionName: backend.nombreFuncion.name
});

export default backend;
