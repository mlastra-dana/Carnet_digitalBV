// amplify/backend/functions/generatePkpass/resource.ts
import { defineFunction } from '@aws-amplify/backend';

export const generatePkpass = defineFunction({
  name: 'generatePkpass',
  entry: './handler.ts', // archivo que vas a crear al lado
  timeoutSeconds: 30,
});
