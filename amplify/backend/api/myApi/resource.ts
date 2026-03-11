import { api } from "@aws-amplify/backend";
import { helloWorld } from "../../functions/helloWorld/resource";

export const myApi = api({
  name: "myApi",
  routes: [
    {
      path: "/ping",
      method: "GET",
      function: helloWorld
    }
  ]
});
