/**
 * scripts/copyLogos.ts
 *
 * Build-time script that copies simple-icons SVG data into public/logos/{category}/
 * Run via: npx ts-node --project tsconfig.scripts.json scripts/copyLogos.ts
 *
 * If a simple-icons key does not exist, the script logs a warning and skips it silently.
 */

import * as fs from "fs";
import * as path from "path";

// simple-icons exports every icon at the module root
// eslint-disable-next-line @typescript-eslint/no-var-requires
const si = require("simple-icons");

interface IconSpec {
  key: string;       // simple-icons export name, e.g. "siAmazons3"
  outFile: string;   // path relative to project root, e.g. "public/logos/aws/s3.svg"
}

const ICONS: IconSpec[] = [
  // AWS
  { key: "siAmazons3",         outFile: "public/logos/aws/s3.svg" },
  { key: "siAmazonec2",        outFile: "public/logos/aws/ec2.svg" },
  { key: "siAmazonrds",        outFile: "public/logos/aws/rds.svg" },
  { key: "siAwslambda",        outFile: "public/logos/aws/lambda.svg" },
  { key: "siAmazoncloudwatch", outFile: "public/logos/aws/cloudwatch.svg" },
  { key: "siAmazonsqs",        outFile: "public/logos/aws/sqs.svg" },
  { key: "siAmazondynamodb",   outFile: "public/logos/aws/dynamodb.svg" },
  { key: "siAmazoneks",        outFile: "public/logos/aws/eks.svg" },
  { key: "siAmazonecs",        outFile: "public/logos/aws/ecs.svg" },
  { key: "siAmazonroute53",    outFile: "public/logos/aws/route53.svg" },
  { key: "siAwsamplify",       outFile: "public/logos/aws/amplify.svg" },
  { key: "siAmazonapigateway", outFile: "public/logos/aws/api-gateway.svg" },

  // Azure
  { key: "siMicrosoftazure",             outFile: "public/logos/azure/azure.svg" },
  { key: "siAzurefunctions",             outFile: "public/logos/azure/functions.svg" },
  { key: "siAzuredevops",                outFile: "public/logos/azure/devops.svg" },
  { key: "siMicrosoftazuresql",          outFile: "public/logos/azure/sql.svg" },
  { key: "siMicrosoftazureblobstorage",  outFile: "public/logos/azure/blob-storage.svg" },

  // GCP
  { key: "siGooglecloud",        outFile: "public/logos/gcp/gcp.svg" },
  { key: "siGooglecloudspanner", outFile: "public/logos/gcp/spanner.svg" },
  { key: "siGooglecloudstorage", outFile: "public/logos/gcp/storage.svg" },
  { key: "siGooglecloudrun",     outFile: "public/logos/gcp/cloud-run.svg" },

  // Messaging
  { key: "siApachekafka",  outFile: "public/logos/messaging/kafka.svg" },
  { key: "siRabbitmq",     outFile: "public/logos/messaging/rabbitmq.svg" },
  { key: "siApachepulsar", outFile: "public/logos/messaging/pulsar.svg" },
  { key: "siNatsdotio",    outFile: "public/logos/messaging/nats.svg" },

  // Databases
  { key: "siPostgresql",    outFile: "public/logos/databases/postgresql.svg" },
  { key: "siMysql",         outFile: "public/logos/databases/mysql.svg" },
  { key: "siMongodb",       outFile: "public/logos/databases/mongodb.svg" },
  { key: "siRedis",         outFile: "public/logos/databases/redis.svg" },
  { key: "siElasticsearch", outFile: "public/logos/databases/elasticsearch.svg" },
  { key: "siInfluxdb",      outFile: "public/logos/databases/influxdb.svg" },
  { key: "siNeo4j",         outFile: "public/logos/databases/neo4j.svg" },
  { key: "siSqlite",        outFile: "public/logos/databases/sqlite.svg" },

  // Infra / Orchestration
  { key: "siKubernetes", outFile: "public/logos/infra/kubernetes.svg" },
  { key: "siDocker",     outFile: "public/logos/infra/docker.svg" },
  { key: "siTerraform",  outFile: "public/logos/infra/terraform.svg" },
  { key: "siHelm",       outFile: "public/logos/infra/helm.svg" },
  { key: "siIstio",      outFile: "public/logos/infra/istio.svg" },
  { key: "siNginx",      outFile: "public/logos/infra/nginx.svg" },
  { key: "siVault",      outFile: "public/logos/infra/vault.svg" },

  // Observability
  { key: "siGrafana",       outFile: "public/logos/observability/grafana.svg" },
  { key: "siPrometheus",    outFile: "public/logos/observability/prometheus.svg" },
  { key: "siDatadog",       outFile: "public/logos/observability/datadog.svg" },
  { key: "siJaeger",        outFile: "public/logos/observability/jaeger.svg" },
  { key: "siOpentelemetry", outFile: "public/logos/observability/opentelemetry.svg" },

  // CI/CD
  { key: "siGithubactions",   outFile: "public/logos/cicd/github-actions.svg" },
  { key: "siJenkins",         outFile: "public/logos/cicd/jenkins.svg" },
  { key: "siGitlab",          outFile: "public/logos/cicd/gitlab.svg" },
  { key: "siCircleci",        outFile: "public/logos/cicd/circleci.svg" },
  { key: "siArgo",            outFile: "public/logos/cicd/argocd.svg" },

  // Security / Auth
  { key: "siKeycloak", outFile: "public/logos/security/keycloak.svg" },
  { key: "siOkta",     outFile: "public/logos/security/okta.svg" },
  { key: "siAuth0",    outFile: "public/logos/security/auth0.svg" },
  { key: "siVault",    outFile: "public/logos/security/vault.svg" },

  // Frontend / API
  { key: "siReact",              outFile: "public/logos/frontend/react.svg" },
  { key: "siNextdotjs",          outFile: "public/logos/frontend/nextjs.svg" },
  { key: "siGraphql",            outFile: "public/logos/frontend/graphql.svg" },
  { key: "siOpenapiinitiative",  outFile: "public/logos/frontend/openapi.svg" },
  { key: "siWebassembly",        outFile: "public/logos/frontend/wasm.svg" },
];

const PROJECT_ROOT = path.resolve(__dirname, "..");

function buildSvg(svgPath: string, hex: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#${hex}">\n  <path d="${svgPath}"/>\n</svg>\n`;
}

let written = 0;
let skipped = 0;

for (const spec of ICONS) {
  // Attempt to resolve the icon from simple-icons exports
  // simple-icons v14+ exports as named exports with camelCase
  const icon = si[spec.key];

  if (!icon || !icon.path) {
    console.warn(`[copyLogos] WARNING: Icon key "${spec.key}" not found in simple-icons — skipping.`);
    skipped++;
    continue;
  }

  const absOut = path.resolve(PROJECT_ROOT, spec.outFile);
  const dir = path.dirname(absOut);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const svgContent = buildSvg(icon.path, icon.hex);
  fs.writeFileSync(absOut, svgContent, "utf8");
  written++;
}

console.log(
  `[copyLogos] Done. ${written} SVG(s) written, ${skipped} skipped (key not found).`
);
