import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schema = JSON.parse(readFileSync("schemas/app-manifest.schema.json", "utf8"));
const example = JSON.parse(readFileSync("examples/third-party-app/app-manifest.json", "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(example)) throw new Error(`Example manifest failed schema validation: ${JSON.stringify(validate.errors)}`);

const invalidManifests = [
  { ...example, requestedCapabilities: ["root.access"] },
  { ...example, supportedClients: ["unknown-client"] },
  { ...example, callbackUrls: ["http://example.com/callback"] },
  { ...example, unexpected: true },
];
for (const manifest of invalidManifests) {
  if (validate(manifest)) throw new Error(`Invalid manifest unexpectedly passed: ${JSON.stringify(manifest)}`);
}
console.log("App manifest JSON Schema and positive/negative fixtures passed");
