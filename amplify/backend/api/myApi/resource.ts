import { api } from "@aws-amplify/backend";
import { helloWorld } from "../../functions/helloWorld/resource";
import { nombreFuncion } from "../../functions/nombreFuncion/resource";

export const myApi = api({
  name: "myApi",
  routes: [
    {
      path: "/ping",
      method: "GET",
      function: helloWorld
    },
    {
      path: "/start-conversation",
      method: "POST",
      function: nombreFuncion
    }
  ]
});
