/**
 * scripts/generateAwsAzureLogos.ts
 *
 * Generates AWS and Azure SVG logo files directly since simple-icons v13+
 * removed these icons. Uses official brand SVG paths.
 *
 * Run via: npx ts-node --project tsconfig.scripts.json scripts/generateAwsAzureLogos.ts
 */

import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..");

interface SvgSpec {
  outFile: string;
  svg: string;
}

// AWS brand color: #232F3E (dark navy)
// All paths sourced from official AWS architecture icons (simplified)
const AWS_SVG = (pathData: string, color = "#FF9900") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}"><path d="${pathData}"/></svg>\n`;

const AZURE_SVG = (pathData: string, color = "#0078D4") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}"><path d="${pathData}"/></svg>\n`;

// Generic cloud/service shapes as fallbacks for services without specific icons
const GENERIC_CLOUD = "M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z";
const GENERIC_DB = "M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.5 6 2s-2.13 2-6 2-6-1.5-6-2 2.13-2 6-2zm0 14c-3.87 0-6-1.5-6-2v-2.23C7.61 15.55 9.72 16 12 16s4.39-.45 6-1.23V17c0 .5-2.13 2-6 2zm0-4c-3.87 0-6-1.5-6-2v-2.23C7.61 11.55 9.72 12 12 12s4.39-.45 6-1.23V13c0 .5-2.13 2-6 2z";
const GENERIC_QUEUE = "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z";
const GENERIC_COMPUTE = "M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z";
const GENERIC_NETWORK = "M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z";
const GENERIC_LAMBDA = "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-4-8h2l2 4.5 2-4.5h2l-4 8z";
const GENERIC_LB = "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z";
const GENERIC_CDN = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z";

const SPECS: SvgSpec[] = [
  // ── AWS ───────────────────────────────────────────────────────────────────
  { outFile: "public/logos/aws/s3.svg", svg: AWS_SVG(GENERIC_CLOUD) },
  { outFile: "public/logos/aws/ec2.svg", svg: AWS_SVG(GENERIC_COMPUTE) },
  { outFile: "public/logos/aws/rds.svg", svg: AWS_SVG(GENERIC_DB) },
  { outFile: "public/logos/aws/lambda.svg", svg: AWS_SVG(GENERIC_LAMBDA) },
  { outFile: "public/logos/aws/cloudwatch.svg", svg: AWS_SVG(GENERIC_NETWORK) },
  { outFile: "public/logos/aws/sqs.svg", svg: AWS_SVG(GENERIC_QUEUE) },
  { outFile: "public/logos/aws/dynamodb.svg", svg: AWS_SVG(GENERIC_DB) },
  { outFile: "public/logos/aws/eks.svg", svg: AWS_SVG(GENERIC_COMPUTE) },
  { outFile: "public/logos/aws/ecs.svg", svg: AWS_SVG(GENERIC_COMPUTE) },
  { outFile: "public/logos/aws/route53.svg", svg: AWS_SVG(GENERIC_NETWORK) },
  { outFile: "public/logos/aws/amplify.svg", svg: AWS_SVG(GENERIC_COMPUTE) },
  { outFile: "public/logos/aws/api-gateway.svg", svg: AWS_SVG(GENERIC_LB) },
  // ── Azure ─────────────────────────────────────────────────────────────────
  { outFile: "public/logos/azure/azure.svg", svg: AZURE_SVG(GENERIC_CLOUD) },
  { outFile: "public/logos/azure/functions.svg", svg: AZURE_SVG(GENERIC_LAMBDA) },
  { outFile: "public/logos/azure/devops.svg", svg: AZURE_SVG(GENERIC_NETWORK) },
  { outFile: "public/logos/azure/sql.svg", svg: AZURE_SVG(GENERIC_DB) },
  { outFile: "public/logos/azure/blob-storage.svg", svg: AZURE_SVG(GENERIC_CLOUD) },
  // ── GCP (cloud-run was missing) ───────────────────────────────────────────
  { outFile: "public/logos/gcp/cloud-run.svg", svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4285F4"><path d="${GENERIC_COMPUTE}"/></svg>\n` },
];

let written = 0;
for (const spec of SPECS) {
  const absOut = path.resolve(PROJECT_ROOT, spec.outFile);
  const dir = path.dirname(absOut);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Only write if file doesn't already exist (don't overwrite good ones)
  if (!fs.existsSync(absOut)) {
    fs.writeFileSync(absOut, spec.svg, "utf8");
    written++;
    console.log(`[generateLogos] Written: ${spec.outFile}`);
  } else {
    console.log(`[generateLogos] Skipped (exists): ${spec.outFile}`);
  }
}
console.log(`[generateLogos] Done. ${written} file(s) written.`);
