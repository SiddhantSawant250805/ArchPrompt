/**
 * lib/logoRegistry.ts
 *
 * Canonical catalogue of technology logos for ArchPrompt's logo overlay system.
 * All entries correspond to SVG files written by scripts/copyLogos.ts into public/logos/.
 */

// ── LOGO SYSTEM: types ──────────────────────────────────────────────────────

export type LogoCategory =
  | "aws"
  | "azure"
  | "gcp"
  | "messaging"
  | "databases"
  | "infra"
  | "observability"
  | "cicd"
  | "security"
  | "frontend";

export type LogoEntry = {
  id: string;            // unique snake_case identifier
  name: string;          // display name
  keywords: string[];    // lowercase keyword strings matched against node labels
  path: string;          // absolute path from public root, e.g. "/logos/aws/s3.svg"
  category: LogoCategory;
  brandColor: string;    // hex color used for badge background
};

// ── LOGO SYSTEM: registry ───────────────────────────────────────────────────

export const LOGO_REGISTRY: LogoEntry[] = [
  // ── AWS ─────────────────────────────────────────────────────────────────
  {
    id: "aws_s3",
    name: "Amazon S3",
    keywords: ["s3", "amazon s3", "simple storage", "object storage", "s3 bucket", "aws storage", "blob storage aws"],
    path: "/logos/aws/s3.svg",
    category: "aws",
    brandColor: "#232F3E",
  },
  {
    id: "aws_ec2",
    name: "Amazon EC2",
    keywords: ["ec2", "amazon ec2", "elastic compute", "virtual machine", "aws vm", "instance", "ec2 instance"],
    path: "/logos/aws/ec2.svg",
    category: "aws",
    brandColor: "#232F3E",
  },
  {
    id: "aws_rds",
    name: "Amazon RDS",
    keywords: ["rds", "amazon rds", "relational database", "aurora", "aws rds", "managed database"],
    path: "/logos/aws/rds.svg",
    category: "aws",
    brandColor: "#232F3E",
  },
  {
    id: "aws_lambda",
    name: "AWS Lambda",
    keywords: ["lambda", "aws lambda", "serverless", "function", "faas", "serverless function"],
    path: "/logos/aws/lambda.svg",
    category: "aws",
    brandColor: "#232F3E",
  },
  {
    id: "aws_cloudwatch",
    name: "Amazon CloudWatch",
    keywords: ["cloudwatch", "amazon cloudwatch", "aws monitoring", "aws logs", "aws metrics"],
    path: "/logos/aws/cloudwatch.svg",
    category: "aws",
    brandColor: "#232F3E",
  },
  {
    id: "aws_sqs",
    name: "Amazon SQS",
    keywords: ["sqs", "amazon sqs", "simple queue", "aws queue", "message queue aws"],
    path: "/logos/aws/sqs.svg",
    category: "aws",
    brandColor: "#232F3E",
  },
  {
    id: "aws_dynamodb",
    name: "Amazon DynamoDB",
    keywords: ["dynamodb", "amazon dynamodb", "dynamo", "aws nosql", "nosql aws"],
    path: "/logos/aws/dynamodb.svg",
    category: "aws",
    brandColor: "#232F3E",
  },
  {
    id: "aws_eks",
    name: "Amazon EKS",
    keywords: ["eks", "amazon eks", "elastic kubernetes", "aws kubernetes", "kubernetes aws"],
    path: "/logos/aws/eks.svg",
    category: "aws",
    brandColor: "#232F3E",
  },
  {
    id: "aws_ecs",
    name: "Amazon ECS",
    keywords: ["ecs", "amazon ecs", "elastic container", "fargate", "aws containers", "aws ecs"],
    path: "/logos/aws/ecs.svg",
    category: "aws",
    brandColor: "#232F3E",
  },
  {
    id: "aws_route53",
    name: "Amazon Route 53",
    keywords: ["route53", "route 53", "amazon route", "aws dns", "dns aws", "aws routing"],
    path: "/logos/aws/route53.svg",
    category: "aws",
    brandColor: "#232F3E",
  },
  {
    id: "aws_amplify",
    name: "AWS Amplify",
    keywords: ["amplify", "aws amplify", "aws frontend", "aws hosting"],
    path: "/logos/aws/amplify.svg",
    category: "aws",
    brandColor: "#232F3E",
  },
  {
    id: "aws_api_gateway",
    name: "Amazon API Gateway",
    keywords: ["api gateway", "amazon api gateway", "aws api", "aws gateway", "apigw"],
    path: "/logos/aws/api-gateway.svg",
    category: "aws",
    brandColor: "#232F3E",
  },

  // ── Azure ────────────────────────────────────────────────────────────────
  {
    id: "azure",
    name: "Microsoft Azure",
    keywords: ["azure", "microsoft azure", "azure cloud"],
    path: "/logos/azure/azure.svg",
    category: "azure",
    brandColor: "#0078D4",
  },
  {
    id: "azure_functions",
    name: "Azure Functions",
    keywords: ["azure functions", "azure serverless", "azure function", "azure faas"],
    path: "/logos/azure/functions.svg",
    category: "azure",
    brandColor: "#0078D4",
  },
  {
    id: "azure_devops",
    name: "Azure DevOps",
    keywords: ["azure devops", "devops azure", "ado", "vsts", "tfs"],
    path: "/logos/azure/devops.svg",
    category: "azure",
    brandColor: "#0078D4",
  },
  {
    id: "azure_sql",
    name: "Azure SQL",
    keywords: ["azure sql", "azure database", "sql azure", "azure mssql"],
    path: "/logos/azure/sql.svg",
    category: "azure",
    brandColor: "#0078D4",
  },
  {
    id: "azure_blob",
    name: "Azure Blob Storage",
    keywords: ["azure blob", "blob storage", "azure storage", "azure object storage"],
    path: "/logos/azure/blob-storage.svg",
    category: "azure",
    brandColor: "#0078D4",
  },

  // ── GCP ─────────────────────────────────────────────────────────────────
  {
    id: "gcp",
    name: "Google Cloud",
    keywords: ["gcp", "google cloud", "google cloud platform"],
    path: "/logos/gcp/gcp.svg",
    category: "gcp",
    brandColor: "#4285F4",
  },
  {
    id: "gcp_spanner",
    name: "Cloud Spanner",
    keywords: ["spanner", "cloud spanner", "gcp spanner", "google spanner"],
    path: "/logos/gcp/spanner.svg",
    category: "gcp",
    brandColor: "#4285F4",
  },
  {
    id: "gcp_storage",
    name: "Google Cloud Storage",
    keywords: ["gcs", "cloud storage", "google cloud storage", "gcp storage"],
    path: "/logos/gcp/storage.svg",
    category: "gcp",
    brandColor: "#4285F4",
  },
  {
    id: "gcp_cloud_run",
    name: "Cloud Run",
    keywords: ["cloud run", "gcp cloud run", "google cloud run"],
    path: "/logos/gcp/cloud-run.svg",
    category: "gcp",
    brandColor: "#4285F4",
  },

  // ── Messaging ────────────────────────────────────────────────────────────
  {
    id: "kafka",
    name: "Apache Kafka",
    keywords: [
      "kafka", "apache kafka", "event streaming", "kafka broker",
      "kafka topic", "kafka consumer", "kafka producer", "event bus",
      "message bus", "kafka bus",
    ],
    path: "/logos/messaging/kafka.svg",
    category: "messaging",
    brandColor: "#231F20",
  },
  {
    id: "rabbitmq",
    name: "RabbitMQ",
    keywords: ["rabbitmq", "rabbit mq", "amqp", "message broker", "rabbit"],
    path: "/logos/messaging/rabbitmq.svg",
    category: "messaging",
    brandColor: "#FF6600",
  },
  {
    id: "pulsar",
    name: "Apache Pulsar",
    keywords: ["pulsar", "apache pulsar", "pulsar broker", "pulsar topic"],
    path: "/logos/messaging/pulsar.svg",
    category: "messaging",
    brandColor: "#188FFF",
  },
  {
    id: "nats",
    name: "NATS",
    keywords: ["nats", "nats.io", "nats messaging", "nats broker"],
    path: "/logos/messaging/nats.svg",
    category: "messaging",
    brandColor: "#27AAE1",
  },

  // ── Databases ────────────────────────────────────────────────────────────
  {
    id: "postgresql",
    name: "PostgreSQL",
    keywords: ["postgresql", "postgres", "pg", "psql", "postgre"],
    path: "/logos/databases/postgresql.svg",
    category: "databases",
    brandColor: "#336791",
  },
  {
    id: "mysql",
    name: "MySQL",
    keywords: ["mysql", "my sql", "mariadb", "maria db"],
    path: "/logos/databases/mysql.svg",
    category: "databases",
    brandColor: "#4479A1",
  },
  {
    id: "mongodb",
    name: "MongoDB",
    keywords: ["mongodb", "mongo", "mongo db", "document store", "atlas"],
    path: "/logos/databases/mongodb.svg",
    category: "databases",
    brandColor: "#47A248",
  },
  {
    id: "redis",
    name: "Redis",
    keywords: ["redis", "cache", "redis cache", "elasticache", "memcached"],
    path: "/logos/databases/redis.svg",
    category: "databases",
    brandColor: "#DC382D",
  },
  {
    id: "elasticsearch",
    name: "Elasticsearch",
    keywords: ["elasticsearch", "elastic", "elk", "opensearch", "search engine"],
    path: "/logos/databases/elasticsearch.svg",
    category: "databases",
    brandColor: "#005571",
  },
  {
    id: "influxdb",
    name: "InfluxDB",
    keywords: ["influxdb", "influx", "time series", "tsdb"],
    path: "/logos/databases/influxdb.svg",
    category: "databases",
    brandColor: "#22ADF6",
  },
  {
    id: "neo4j",
    name: "Neo4j",
    keywords: ["neo4j", "neo", "graph database", "graph db"],
    path: "/logos/databases/neo4j.svg",
    category: "databases",
    brandColor: "#008CC1",
  },
  {
    id: "sqlite",
    name: "SQLite",
    keywords: ["sqlite", "sqlite3", "embedded db", "embedded database"],
    path: "/logos/databases/sqlite.svg",
    category: "databases",
    brandColor: "#003B57",
  },

  // ── Infrastructure / Orchestration ───────────────────────────────────────
  {
    id: "kubernetes",
    name: "Kubernetes",
    keywords: [
      "kubernetes", "k8s", "kube", "eks", "aks", "gke",
      "container orchestration", "pod", "cluster", "kubectl",
    ],
    path: "/logos/infra/kubernetes.svg",
    category: "infra",
    brandColor: "#326CE5",
  },
  {
    id: "docker",
    name: "Docker",
    keywords: ["docker", "container", "dockerfile", "docker compose", "docker hub"],
    path: "/logos/infra/docker.svg",
    category: "infra",
    brandColor: "#2496ED",
  },
  {
    id: "terraform",
    name: "Terraform",
    keywords: ["terraform", "iac", "infrastructure as code", "hcl", "hashicorp terraform"],
    path: "/logos/infra/terraform.svg",
    category: "infra",
    brandColor: "#7B42BC",
  },
  {
    id: "helm",
    name: "Helm",
    keywords: ["helm", "helm chart", "k8s package", "kubernetes package"],
    path: "/logos/infra/helm.svg",
    category: "infra",
    brandColor: "#277A9F",
  },
  {
    id: "istio",
    name: "Istio",
    keywords: ["istio", "service mesh", "mesh", "envoy", "sidecar proxy"],
    path: "/logos/infra/istio.svg",
    category: "infra",
    brandColor: "#466BB0",
  },
  {
    id: "nginx",
    name: "Nginx",
    keywords: ["nginx", "reverse proxy", "load balancer", "ingress", "nginx proxy"],
    path: "/logos/infra/nginx.svg",
    category: "infra",
    brandColor: "#009639",
  },
  {
    id: "vault",
    name: "HashiCorp Vault",
    keywords: ["vault", "hashicorp vault", "secrets manager", "secret store", "secret management"],
    path: "/logos/infra/vault.svg",
    category: "infra",
    brandColor: "#000000",
  },

  // ── Observability ────────────────────────────────────────────────────────
  {
    id: "grafana",
    name: "Grafana",
    keywords: ["grafana", "dashboard", "metrics dashboard", "grafana dashboard"],
    path: "/logos/observability/grafana.svg",
    category: "observability",
    brandColor: "#F46800",
  },
  {
    id: "prometheus",
    name: "Prometheus",
    keywords: ["prometheus", "metrics", "alertmanager", "promql", "prom"],
    path: "/logos/observability/prometheus.svg",
    category: "observability",
    brandColor: "#E6522C",
  },
  {
    id: "datadog",
    name: "Datadog",
    keywords: ["datadog", "dd", "apm", "datadog apm", "observability platform"],
    path: "/logos/observability/datadog.svg",
    category: "observability",
    brandColor: "#632CA6",
  },
  {
    id: "jaeger",
    name: "Jaeger",
    keywords: ["jaeger", "distributed tracing", "tracing", "jaeger tracing"],
    path: "/logos/observability/jaeger.svg",
    category: "observability",
    brandColor: "#66CFE2",
  },
  {
    id: "opentelemetry",
    name: "OpenTelemetry",
    keywords: ["opentelemetry", "otel", "otelcol", "open telemetry", "telemetry"],
    path: "/logos/observability/opentelemetry.svg",
    category: "observability",
    brandColor: "#4A4A4A",
  },

  // ── CI/CD ────────────────────────────────────────────────────────────────
  {
    id: "github_actions",
    name: "GitHub Actions",
    keywords: ["github actions", "gh actions", "actions", "workflows", "github ci", "ci cd github"],
    path: "/logos/cicd/github-actions.svg",
    category: "cicd",
    brandColor: "#2088FF",
  },
  {
    id: "jenkins",
    name: "Jenkins",
    keywords: ["jenkins", "jenkins ci", "jenkins pipeline", "ci server"],
    path: "/logos/cicd/jenkins.svg",
    category: "cicd",
    brandColor: "#D24939",
  },
  {
    id: "gitlab",
    name: "GitLab",
    keywords: ["gitlab", "gitlab ci", "gitlab runner", "gitlab pipeline"],
    path: "/logos/cicd/gitlab.svg",
    category: "cicd",
    brandColor: "#FC6D26",
  },
  {
    id: "circleci",
    name: "CircleCI",
    keywords: ["circleci", "circle ci", "circle", "circleci pipeline"],
    path: "/logos/cicd/circleci.svg",
    category: "cicd",
    brandColor: "#343434",
  },
  {
    id: "argocd",
    name: "Argo CD",
    keywords: ["argocd", "argo cd", "argo", "gitops", "argo rollouts"],
    path: "/logos/cicd/argocd.svg",
    category: "cicd",
    brandColor: "#EF7B4D",
  },

  // ── Security / Auth ──────────────────────────────────────────────────────
  {
    id: "keycloak",
    name: "Keycloak",
    keywords: ["keycloak", "identity provider", "idp", "oidc", "sso keycloak"],
    path: "/logos/security/keycloak.svg",
    category: "security",
    brandColor: "#4D4D4D",
  },
  {
    id: "okta",
    name: "Okta",
    keywords: ["okta", "okta sso", "identity", "sso okta", "workforce identity"],
    path: "/logos/security/okta.svg",
    category: "security",
    brandColor: "#007DC1",
  },
  {
    id: "auth0",
    name: "Auth0",
    keywords: ["auth0", "auth 0", "authentication", "authorization", "oauth", "openid"],
    path: "/logos/security/auth0.svg",
    category: "security",
    brandColor: "#EB5424",
  },
  {
    id: "vault_security",
    name: "HashiCorp Vault",
    keywords: ["vault security", "secrets", "pki", "dynamic secrets"],
    path: "/logos/security/vault.svg",
    category: "security",
    brandColor: "#000000",
  },

  // ── Frontend / API ───────────────────────────────────────────────────────
  {
    id: "react",
    name: "React",
    keywords: ["react", "reactjs", "react app", "react frontend", "react ui"],
    path: "/logos/frontend/react.svg",
    category: "frontend",
    brandColor: "#61DAFB",
  },
  {
    id: "nextjs",
    name: "Next.js",
    keywords: ["nextjs", "next.js", "next js", "nextjs app", "next frontend"],
    path: "/logos/frontend/nextjs.svg",
    category: "frontend",
    brandColor: "#000000",
  },
  {
    id: "graphql",
    name: "GraphQL",
    keywords: ["graphql", "graph ql", "gql", "graphql api", "apollo"],
    path: "/logos/frontend/graphql.svg",
    category: "frontend",
    brandColor: "#E10098",
  },
  {
    id: "openapi",
    name: "OpenAPI",
    keywords: ["openapi", "open api", "swagger", "rest api", "api spec", "api docs"],
    path: "/logos/frontend/openapi.svg",
    category: "frontend",
    brandColor: "#6BA539",
  },
  {
    id: "wasm",
    name: "WebAssembly",
    keywords: ["webassembly", "wasm", "web assembly"],
    path: "/logos/frontend/wasm.svg",
    category: "frontend",
    brandColor: "#654FF0",
  },
];

// ── LOGO SYSTEM: helper functions ────────────────────────────────────────────

/** Strip emoji characters from a string */
function stripEmoji(text: string): string {
  return text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    ""
  );
}

/**
 * Resolve the best-matching logo for a Mermaid node label.
 * Returns null if no keyword matches — never throws.
 */
export function resolveLogoForNode(nodeLabel: string): LogoEntry | null {
  try {
    const clean = stripEmoji(nodeLabel).toLowerCase().trim();
    if (!clean) return null;

    for (const entry of LOGO_REGISTRY) {
      for (const kw of entry.keywords) {
        if (clean.includes(kw)) return entry;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Direct lookup by LogoEntry.id */
export function resolveLogoById(id: string): LogoEntry | null {
  return LOGO_REGISTRY.find((e) => e.id === id) ?? null;
}

/** All entries for a given category */
export function listByCategory(category: LogoCategory): LogoEntry[] {
  return LOGO_REGISTRY.filter((e) => e.category === category);
}

/** Distinct ordered list of categories present in the registry */
export function listAllCategories(): LogoCategory[] {
  const seen = new Set<LogoCategory>();
  const result: LogoCategory[] = [];
  for (const entry of LOGO_REGISTRY) {
    if (!seen.has(entry.category)) {
      seen.add(entry.category);
      result.push(entry.category);
    }
  }
  return result;
}

/**
 * Fuzzy search: case-insensitive substring match across name and keywords.
 * Exact name matches are returned first.
 */
export function searchLogos(query: string): LogoEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return LOGO_REGISTRY.slice();

  const exactName: LogoEntry[] = [];
  const keywordMatch: LogoEntry[] = [];

  for (const entry of LOGO_REGISTRY) {
    if (entry.name.toLowerCase().includes(q)) {
      exactName.push(entry);
    } else if (entry.keywords.some((kw) => kw.includes(q))) {
      keywordMatch.push(entry);
    }
  }

  return [...exactName, ...keywordMatch];
}
