export const CLOUD_PROVIDER_COMPONENTS = [
  { kind: "aws-ec2", provider: "AWS", iconKind: "ec2", label: "Amazon EC2", description: "Elastic compute instance", glyph: "EC2", accent: "#ed8b00" },
  { kind: "aws-lambda", provider: "AWS", iconKind: "lambda", label: "AWS Lambda", description: "Event driven serverless compute", glyph: "λ", accent: "#ed8b00" },
  { kind: "aws-s3", provider: "AWS", iconKind: "s3", label: "Amazon S3", description: "Object storage bucket", glyph: "S3", accent: "#ed8b00" },
  { kind: "aws-rds", provider: "AWS", iconKind: "rds", label: "Amazon RDS", description: "Managed relational database", glyph: "DB", accent: "#ed8b00" },
  { kind: "aws-api-gateway", provider: "AWS", iconKind: "api-gateway", label: "API Gateway", description: "Managed HTTP API entry point", glyph: "API", accent: "#ed8b00" },
  { kind: "aws-sqs", provider: "AWS", iconKind: "sqs", label: "Amazon SQS", description: "Message queue", glyph: "Q", accent: "#ed8b00" },
  { kind: "aws-vpc", provider: "AWS", iconKind: "vpc", label: "Amazon VPC", description: "Virtual private cloud boundary", glyph: "VPC", accent: "#ed8b00" },
  { kind: "aws-cloudfront", provider: "AWS", iconKind: "cloudfront", label: "CloudFront", description: "Content delivery network", glyph: "CDN", accent: "#ed8b00" },
  { kind: "aws-ecs", provider: "AWS", iconKind: "elastic-container-service", label: "Amazon ECS", description: "Managed container orchestration", glyph: "ECS", accent: "#ed8b00" },
  { kind: "aws-eks", provider: "AWS", iconKind: "elastic-kubernetes-service", label: "Amazon EKS", description: "Managed Kubernetes control plane", glyph: "EKS", accent: "#ed8b00" },
  { kind: "aws-dynamodb", provider: "AWS", iconKind: "dynamodb", label: "Amazon DynamoDB", description: "Managed key-value and document database", glyph: "DDB", accent: "#ed8b00" },
  { kind: "aws-sns", provider: "AWS", iconKind: "sns", label: "Amazon SNS", description: "Publish and subscribe notifications", glyph: "SNS", accent: "#ed8b00" },
  { kind: "aws-eventbridge", provider: "AWS", iconKind: "eventbridge", label: "Amazon EventBridge", description: "Event routing and integration bus", glyph: "EVT", accent: "#ed8b00" },
  { kind: "aws-cloudwatch", provider: "AWS", iconKind: "cloudwatch", label: "Amazon CloudWatch", description: "Metrics, logs, and alarms", glyph: "MON", accent: "#ed8b00" },
  { kind: "aws-secrets-manager", provider: "AWS", iconKind: "secrets-manager", label: "AWS Secrets Manager", description: "Managed secret storage and rotation", glyph: "KEY", accent: "#ed8b00" },
  { kind: "aws-iam", provider: "AWS", iconKind: "identity-and-access-management", label: "AWS IAM", description: "Identity and access management", glyph: "IAM", accent: "#ed8b00" },
  { kind: "azure-vm", provider: "Azure", iconKind: "virtual-machine", label: "Azure Virtual Machine", description: "Cloud compute instance", glyph: "VM", accent: "#0078d4" },
  { kind: "azure-functions", provider: "Azure", iconKind: "function-apps", label: "Azure Functions", description: "Event driven serverless compute", glyph: "ƒ", accent: "#0078d4" },
  { kind: "azure-blob-storage", provider: "Azure", iconKind: "storage-accounts", label: "Blob Storage", description: "Object and file storage", glyph: "BLOB", accent: "#0078d4" },
  { kind: "azure-sql", provider: "Azure", iconKind: "sql-database", label: "Azure SQL", description: "Managed relational database", glyph: "DB", accent: "#0078d4" },
  { kind: "azure-api-management", provider: "Azure", iconKind: "api-management", label: "API Management", description: "Managed API gateway", glyph: "API", accent: "#0078d4" },
  { kind: "azure-service-bus", provider: "Azure", iconKind: "service-bus", label: "Service Bus", description: "Message queue and topic service", glyph: "BUS", accent: "#0078d4" },
  { kind: "azure-vnet", provider: "Azure", iconKind: "virtual-networks", label: "Virtual Network", description: "Private network boundary", glyph: "VNET", accent: "#0078d4" },
  { kind: "azure-app-service", provider: "Azure", iconKind: "app-services", label: "App Service", description: "Managed web application host", glyph: "APP", accent: "#0078d4" },
  { kind: "azure-aks", provider: "Azure", iconKind: "kubernetes-services", label: "Azure Kubernetes Service", description: "Managed Kubernetes clusters", glyph: "AKS", accent: "#0078d4" },
  { kind: "azure-cosmos-db", provider: "Azure", iconKind: "azure-cosmos-db", label: "Azure Cosmos DB", description: "Globally distributed NoSQL database", glyph: "COS", accent: "#0078d4" },
  { kind: "azure-key-vault", provider: "Azure", iconKind: "key-vault", label: "Azure Key Vault", description: "Managed keys, secrets, and certificates", glyph: "KEY", accent: "#0078d4" },
  { kind: "azure-event-hubs", provider: "Azure", iconKind: "event-hubs", label: "Azure Event Hubs", description: "Managed event streaming service", glyph: "EVT", accent: "#0078d4" },
  { kind: "azure-monitor", provider: "Azure", iconKind: "monitor", label: "Azure Monitor", description: "Metrics, logs, and alerts", glyph: "MON", accent: "#0078d4" },
  { kind: "azure-application-gateway", provider: "Azure", iconKind: "application-gateways", label: "Application Gateway", description: "Layer 7 traffic routing and protection", glyph: "GW", accent: "#0078d4" },
  { kind: "azure-storage-queue", provider: "Azure", iconKind: "storage-queue", label: "Azure Storage Queue", description: "Managed asynchronous message queue", glyph: "Q", accent: "#0078d4" },
  { kind: "azure-firewall", provider: "Azure", iconKind: "firewall", label: "Azure Firewall", description: "Managed network security boundary", glyph: "FW", accent: "#0078d4" },
  { kind: "gcp-compute-engine", provider: "Google Cloud", iconKind: "compute-engine", label: "Compute Engine", description: "Cloud compute instance", glyph: "VM", accent: "#4285f4" },
  { kind: "gcp-cloud-functions", provider: "Google Cloud", iconKind: "cloud-functions", label: "Cloud Functions", description: "Event driven serverless compute", glyph: "ƒ", accent: "#4285f4" },
  { kind: "gcp-cloud-storage", provider: "Google Cloud", iconKind: "cloud-storage", label: "Cloud Storage", description: "Object storage bucket", glyph: "GCS", accent: "#4285f4" },
  { kind: "gcp-cloud-sql", provider: "Google Cloud", iconKind: "cloud-sql", label: "Cloud SQL", description: "Managed relational database", glyph: "DB", accent: "#4285f4" },
  { kind: "gcp-api-gateway", provider: "Google Cloud", iconKind: "cloud-api-gateway", label: "API Gateway", description: "Managed HTTP API entry point", glyph: "API", accent: "#4285f4" },
  { kind: "gcp-pubsub", provider: "Google Cloud", iconKind: "pubsub", label: "Pub/Sub", description: "Publish and subscribe messaging", glyph: "PUB", accent: "#4285f4" },
  { kind: "gcp-vpc", provider: "Google Cloud", iconKind: "vpc", label: "VPC Network", description: "Virtual private cloud boundary", glyph: "VPC", accent: "#4285f4" },
  { kind: "gcp-load-balancing", provider: "Google Cloud", iconKind: "cloud-load-balancing", label: "Cloud Load Balancing", description: "Managed traffic distribution", glyph: "LB", accent: "#4285f4" },
  { kind: "gcp-gke", provider: "Google Cloud", iconKind: "google-kubernetes-engine", label: "Google Kubernetes Engine", description: "Managed Kubernetes clusters", glyph: "GKE", accent: "#4285f4" },
  { kind: "gcp-cloud-run", provider: "Google Cloud", iconKind: "cloud-run", label: "Cloud Run", description: "Managed container application platform", glyph: "RUN", accent: "#4285f4" },
  { kind: "gcp-firestore", provider: "Google Cloud", iconKind: "firestore", label: "Cloud Firestore", description: "Managed document database", glyph: "FS", accent: "#4285f4" },
  { kind: "gcp-spanner", provider: "Google Cloud", iconKind: "cloud-spanner", label: "Cloud Spanner", description: "Globally distributed relational database", glyph: "SQL", accent: "#4285f4" },
  { kind: "gcp-monitoring", provider: "Google Cloud", iconKind: "cloud-monitoring", label: "Cloud Monitoring", description: "Metrics, logs, and alerting", glyph: "MON", accent: "#4285f4" },
  { kind: "gcp-secret-manager", provider: "Google Cloud", iconKind: "secret-manager", label: "Secret Manager", description: "Managed secret storage and access", glyph: "KEY", accent: "#4285f4" },
  { kind: "gcp-cloud-dns", provider: "Google Cloud", iconKind: "cloud-dns", label: "Cloud DNS", description: "Managed DNS zones and records", glyph: "DNS", accent: "#4285f4" },
  { kind: "gcp-firewall", provider: "Google Cloud", iconKind: "cloud-firewall-rules", label: "Cloud Firewall", description: "VPC firewall rules and protection", glyph: "FW", accent: "#4285f4" },
  { kind: "aws-aurora", provider: "AWS", iconKind: "aurora", label: "Amazon Aurora", description: "Managed MySQL and PostgreSQL compatible database", glyph: "AUR", accent: "#ed8b00" },
  { kind: "aws-bedrock", provider: "AWS", iconKind: "bedrock", label: "Amazon Bedrock", description: "Managed foundation model and agent platform", glyph: "AI", accent: "#ed8b00" },
  { kind: "aws-cloudtrail", provider: "AWS", iconKind: "cloudtrail", label: "AWS CloudTrail", description: "Account activity and API audit events", glyph: "AUD", accent: "#ed8b00" },
  { kind: "aws-ecr", provider: "AWS", iconKind: "elastic-container-registry", label: "Amazon ECR", description: "Managed container image registry", glyph: "ECR", accent: "#ed8b00" },
  { kind: "aws-ebs", provider: "AWS", iconKind: "elastic-block-store", label: "Amazon EBS", description: "Block storage volumes for compute instances", glyph: "EBS", accent: "#ed8b00" },
  { kind: "aws-elasticache", provider: "AWS", iconKind: "elasticache", label: "Amazon ElastiCache", description: "Managed in-memory cache", glyph: "MEM", accent: "#ed8b00" },
  { kind: "aws-route53", provider: "AWS", iconKind: "route-53", label: "Amazon Route 53", description: "DNS and domain routing", glyph: "DNS", accent: "#ed8b00" },
  { kind: "aws-step-functions", provider: "AWS", iconKind: "step-functions", label: "AWS Step Functions", description: "Visual workflow and state orchestration", glyph: "FLOW", accent: "#ed8b00" },
  { kind: "aws-glue", provider: "AWS", iconKind: "glue", label: "AWS Glue", description: "Managed data integration and ETL", glyph: "ETL", accent: "#ed8b00" },
  { kind: "aws-redshift", provider: "AWS", iconKind: "redshift", label: "Amazon Redshift", description: "Cloud data warehouse and analytics", glyph: "DWH", accent: "#ed8b00" },
  { kind: "aws-kinesis-data-streams", provider: "AWS", iconKind: "kinesis-data-streams", label: "Amazon Kinesis Data Streams", description: "Real-time event stream ingestion", glyph: "STR", accent: "#ed8b00" },
  { kind: "aws-waf", provider: "AWS", iconKind: "waf", label: "AWS WAF", description: "Web request filtering and protection", glyph: "WAF", accent: "#ed8b00" },
  { kind: "aws-kms", provider: "AWS", iconKind: "key-management-service", label: "AWS Key Management Service", description: "Managed cryptographic keys and policies", glyph: "KMS", accent: "#ed8b00" },
  { kind: "aws-cognito", provider: "AWS", iconKind: "cognito", label: "Amazon Cognito", description: "Application user identity and sign-in", glyph: "ID", accent: "#ed8b00" },
  { kind: "azure-container-registry", provider: "Azure", iconKind: "acr", label: "Azure Container Registry", description: "Private container image registry", glyph: "ACR", accent: "#0078d4" },
  { kind: "azure-front-door", provider: "Azure", iconKind: "front-door", label: "Azure Front Door", description: "Global application delivery and edge routing", glyph: "EDGE", accent: "#0078d4" },
  { kind: "azure-bastion", provider: "Azure", iconKind: "bastion", label: "Azure Bastion", description: "Managed private access to virtual machines", glyph: "BAST", accent: "#0078d4" },
  { kind: "azure-data-factory", provider: "Azure", iconKind: "data-factory", label: "Azure Data Factory", description: "Data movement and pipeline orchestration", glyph: "ETL", accent: "#0078d4" },
  { kind: "azure-synapse", provider: "Azure", iconKind: "synapse", label: "Azure Synapse Analytics", description: "Analytics workspace and data warehouse", glyph: "DWH", accent: "#0078d4" },
  { kind: "azure-log-analytics", provider: "Azure", iconKind: "log-analytics", label: "Azure Log Analytics", description: "Workspace for querying operational logs", glyph: "LOG", accent: "#0078d4" },
  { kind: "azure-app-insights", provider: "Azure", iconKind: "app-insights", label: "Application Insights", description: "Application telemetry and diagnostics", glyph: "APM", accent: "#0078d4" },
  { kind: "azure-entra", provider: "Azure", iconKind: "entra", label: "Microsoft Entra ID", description: "Workforce identity and access management", glyph: "ID", accent: "#0078d4" },
  { kind: "azure-managed-identity", provider: "Azure", iconKind: "managed-identity", label: "Managed Identity", description: "Workload identity without stored credentials", glyph: "MI", accent: "#0078d4" },
  { kind: "azure-private-endpoint", provider: "Azure", iconKind: "private-endpoint", label: "Private Endpoint", description: "Private network access to a managed service", glyph: "PE", accent: "#0078d4" },
  { kind: "azure-traffic-manager", provider: "Azure", iconKind: "traffic-manager", label: "Azure Traffic Manager", description: "DNS-based global traffic distribution", glyph: "DNS", accent: "#0078d4" },
  { kind: "azure-static-web-apps", provider: "Azure", iconKind: "static-web-apps", label: "Azure Static Web Apps", description: "Static web hosting with integrated APIs", glyph: "WEB", accent: "#0078d4" },
  { kind: "azure-container-apps", provider: "Azure", iconKind: "container-apps", label: "Azure Container Apps", description: "Managed serverless container applications", glyph: "APP", accent: "#0078d4" },
  { kind: "azure-postgres", provider: "Azure", iconKind: "postgres", label: "Azure Database for PostgreSQL", description: "Managed PostgreSQL relational database", glyph: "SQL", accent: "#0078d4" },
  { kind: "azure-cdn", provider: "Azure", iconKind: "cdn", label: "Azure CDN", description: "Edge caching and content delivery", glyph: "CDN", accent: "#0078d4" },
  { kind: "azure-dns", provider: "Azure", iconKind: "dns", label: "Azure DNS", description: "Managed public and private DNS zones", glyph: "DNS", accent: "#0078d4" },
  { kind: "azure-waf", provider: "Azure", iconKind: "waf", label: "Azure Web Application Firewall", description: "Web application traffic inspection and protection", glyph: "WAF", accent: "#0078d4" },
  { kind: "azure-data-explorer", provider: "Azure", iconKind: "data-explorer", label: "Azure Data Explorer", description: "Fast analytics for telemetry and time-series data", glyph: "ADX", accent: "#0078d4" },
  { kind: "azure-machine-learning", provider: "Azure", iconKind: "ml", label: "Azure Machine Learning", description: "Machine learning model training and deployment", glyph: "ML", accent: "#0078d4" },
  { kind: "gcp-bigquery", provider: "Google Cloud", iconKind: "bigquery", label: "BigQuery", description: "Serverless data warehouse and analytics", glyph: "BQ", accent: "#4285f4" },
  { kind: "gcp-bigtable", provider: "Google Cloud", iconKind: "bigtable", label: "Bigtable", description: "Wide-column NoSQL database", glyph: "BT", accent: "#4285f4" },
  { kind: "gcp-alloydb", provider: "Google Cloud", iconKind: "alloydb", label: "AlloyDB for PostgreSQL", description: "Managed PostgreSQL-compatible database", glyph: "SQL", accent: "#4285f4" },
  { kind: "gcp-memorystore", provider: "Google Cloud", iconKind: "memorystore", label: "Memorystore", description: "Managed in-memory cache service", glyph: "MEM", accent: "#4285f4" },
  { kind: "gcp-cloud-build", provider: "Google Cloud", iconKind: "cloud-build", label: "Cloud Build", description: "Managed build and delivery pipelines", glyph: "CI", accent: "#4285f4" },
  { kind: "gcp-cloud-logging", provider: "Google Cloud", iconKind: "cloud-logging", label: "Cloud Logging", description: "Centralized log collection and analysis", glyph: "LOG", accent: "#4285f4" },
  { kind: "gcp-dataflow", provider: "Google Cloud", iconKind: "dataflow", label: "Dataflow", description: "Managed batch and streaming data pipelines", glyph: "ETL", accent: "#4285f4" },
  { kind: "gcp-cloud-scheduler", provider: "Google Cloud", iconKind: "cloud-scheduler", label: "Cloud Scheduler", description: "Managed cron-style job scheduling", glyph: "CRON", accent: "#4285f4" },
  { kind: "gcp-cloud-tasks", provider: "Google Cloud", iconKind: "cloud-tasks", label: "Cloud Tasks", description: "Managed asynchronous task queues", glyph: "TASK", accent: "#4285f4" },
  { kind: "gcp-apigee", provider: "Google Cloud", iconKind: "apigee", label: "Apigee", description: "API design, security, and lifecycle management", glyph: "API", accent: "#4285f4" },
  { kind: "gcp-filestore", provider: "Google Cloud", iconKind: "filestore", label: "Filestore", description: "Managed network file storage", glyph: "FILE", accent: "#4285f4" },
  { kind: "gcp-cloud-armor", provider: "Google Cloud", iconKind: "cloud-armor", label: "Cloud Armor", description: "Application and network DDoS protection", glyph: "SEC", accent: "#4285f4" },
  { kind: "gcp-kms", provider: "Google Cloud", iconKind: "key-management-service", label: "Cloud Key Management Service", description: "Managed cryptographic keys and rotation", glyph: "KMS", accent: "#4285f4" },
  { kind: "gcp-cloud-router", provider: "Google Cloud", iconKind: "cloud-router", label: "Cloud Router", description: "Dynamic routing for cloud networks", glyph: "RTR", accent: "#4285f4" },
  { kind: "gcp-cloud-composer", provider: "Google Cloud", iconKind: "cloud-composer", label: "Cloud Composer", description: "Managed workflow orchestration", glyph: "FLOW", accent: "#4285f4" },
  { kind: "gcp-vertex-ai", provider: "Google Cloud", iconKind: "vertex-ai", label: "Vertex AI", description: "Machine learning and generative AI platform", glyph: "AI", accent: "#4285f4" },
  { kind: "gcp-artifact-registry", provider: "Google Cloud", iconKind: "artifact-registry", label: "Artifact Registry", description: "Managed artifact and container image registry", glyph: "REG", accent: "#4285f4" },
  { kind: "gcp-cloud-cdn", provider: "Google Cloud", iconKind: "cloud-cdn", label: "Cloud CDN", description: "Edge caching and content delivery", glyph: "CDN", accent: "#4285f4" },
] as const;

export type CloudProviderComponentKind = (typeof CLOUD_PROVIDER_COMPONENTS)[number]["kind"];
export type CloudProviderComponent = (typeof CLOUD_PROVIDER_COMPONENTS)[number];

export const CLOUD_NEUTRAL_COMPONENTS = [
  { kind: "cloud-compute-instance", section: "Cloud | Provider-neutral | Compute", label: "Compute instance", description: "Provider-neutral virtual machine or compute instance", glyph: "VM", category: "COMPUTE", accent: "#3b6d8c" },
  { kind: "cloud-container", section: "Cloud | Provider-neutral | Compute", label: "Container runtime", description: "Containerized application or task", glyph: "CTR", category: "COMPUTE", accent: "#3b6d8c" },
  { kind: "cloud-kubernetes", section: "Cloud | Provider-neutral | Compute", label: "Kubernetes cluster", description: "Managed Kubernetes cluster and node pool", glyph: "K8S", category: "COMPUTE", accent: "#3b6d8c" },
  { kind: "cloud-machine-learning", section: "Cloud | Provider-neutral | Compute", label: "Machine learning service", description: "Model training, serving, and inference", glyph: "ML", category: "AI / ML", accent: "#3b6d8c" },
  { kind: "cloud-api-gateway", section: "Cloud | Provider-neutral | Networking", label: "API gateway", description: "Managed API entry point and policy layer", glyph: "API", category: "NETWORK", accent: "#55739b" },
  { kind: "cloud-load-balancer", section: "Cloud | Provider-neutral | Networking", label: "Load balancer", description: "Traffic distribution across healthy backends", glyph: "LB", category: "NETWORK", accent: "#55739b" },
  { kind: "cloud-cdn", section: "Cloud | Provider-neutral | Networking", label: "Content delivery network", description: "Edge cache and content delivery", glyph: "CDN", category: "NETWORK", accent: "#55739b" },
  { kind: "cloud-dns", section: "Cloud | Provider-neutral | Networking", label: "DNS service", description: "Managed domain names, zones, and records", glyph: "DNS", category: "NETWORK", accent: "#55739b" },
  { kind: "cloud-firewall", section: "Cloud | Provider-neutral | Networking", label: "Cloud firewall", description: "Network rules and traffic inspection", glyph: "FW", category: "NETWORK", accent: "#55739b" },
  { kind: "cloud-network", section: "Cloud | Provider-neutral | Networking", label: "Private cloud network", description: "Private virtual network and subnets", glyph: "VPC", category: "NETWORK", accent: "#55739b" },
  { kind: "cloud-event-bus", section: "Cloud | Provider-neutral | Integration", label: "Event bus", description: "Event routing between producers and consumers", glyph: "BUS", category: "INTEGRATION", accent: "#8b6799" },
  { kind: "cloud-topic", section: "Cloud | Provider-neutral | Integration", label: "Publish / subscribe topic", description: "Topic with multiple subscribers", glyph: "PUB", category: "INTEGRATION", accent: "#8b6799" },
  { kind: "cloud-stream-processing", section: "Cloud | Provider-neutral | Integration", label: "Stream processor", description: "Real-time event processing pipeline", glyph: "STR", category: "INTEGRATION", accent: "#8b6799" },
  { kind: "cloud-workflow", section: "Cloud | Provider-neutral | Integration", label: "Workflow orchestrator", description: "Multi-step workflow and state orchestration", glyph: "FLOW", category: "INTEGRATION", accent: "#8b6799" },
  { kind: "cloud-scheduler", section: "Cloud | Provider-neutral | Integration", label: "Scheduler", description: "Scheduled job or recurring task", glyph: "CRON", category: "INTEGRATION", accent: "#8b6799" },
  { kind: "cloud-cache", section: "Cloud | Provider-neutral | Data", label: "In-memory cache", description: "Low-latency key-value cache", glyph: "MEM", category: "DATA", accent: "#2f7d70" },
  { kind: "cloud-file-storage", section: "Cloud | Provider-neutral | Data", label: "File storage", description: "Managed shared file system", glyph: "FILE", category: "DATA", accent: "#2f7d70" },
  { kind: "cloud-block-storage", section: "Cloud | Provider-neutral | Data", label: "Block storage", description: "Persistent block volume for compute or databases", glyph: "BLK", category: "DATA", accent: "#2f7d70" },
  { kind: "cloud-document-database", section: "Cloud | Provider-neutral | Data", label: "Document database", description: "Document-oriented NoSQL database", glyph: "DOC", category: "DATA", accent: "#2f7d70" },
  { kind: "cloud-time-series-database", section: "Cloud | Provider-neutral | Data", label: "Time-series database", description: "Database for timestamped metrics and events", glyph: "TS", category: "DATA", accent: "#2f7d70" },
  { kind: "cloud-data-lake", section: "Cloud | Provider-neutral | Data", label: "Data lake", description: "Scalable store for raw and curated datasets", glyph: "LAKE", category: "ANALYTICS", accent: "#786a3b" },
  { kind: "cloud-data-warehouse", section: "Cloud | Provider-neutral | Data", label: "Data warehouse", description: "Analytics store for structured datasets", glyph: "DWH", category: "ANALYTICS", accent: "#786a3b" },
  { kind: "cloud-search", section: "Cloud | Provider-neutral | Data", label: "Search service", description: "Indexed search across application data", glyph: "SRCH", category: "DATA", accent: "#2f7d70" },
  { kind: "cloud-secret-store", section: "Cloud | Provider-neutral | Security", label: "Secret store", description: "Protected storage for credentials and secrets", glyph: "KEY", category: "SECURITY", accent: "#a66b43" },
  { kind: "cloud-key-management", section: "Cloud | Provider-neutral | Security", label: "Key management", description: "Cryptographic key creation, policy, and rotation", glyph: "KMS", category: "SECURITY", accent: "#a66b43" },
  { kind: "cloud-identity", section: "Cloud | Provider-neutral | Security", label: "Identity service", description: "Workforce or application identity provider", glyph: "ID", category: "SECURITY", accent: "#a66b43" },
  { kind: "cloud-container-registry", section: "Cloud | Provider-neutral | Platform", label: "Container registry", description: "Registry for versioned container images", glyph: "REG", category: "PLATFORM", accent: "#647b63" },
  { kind: "cloud-backup", section: "Cloud | Provider-neutral | Platform", label: "Backup service", description: "Backup, retention, and recovery policy", glyph: "BKP", category: "PLATFORM", accent: "#647b63" },
  { kind: "cloud-monitoring", section: "Cloud | Provider-neutral | Operations", label: "Metrics and monitoring", description: "Metrics, alerts, and service health", glyph: "MET", category: "OPERATIONS", accent: "#647b63" },
  { kind: "cloud-logging", section: "Cloud | Provider-neutral | Operations", label: "Log service", description: "Central log collection and query", glyph: "LOG", category: "OPERATIONS", accent: "#647b63" },
] as const;

export type CloudNeutralComponentKind = (typeof CLOUD_NEUTRAL_COMPONENTS)[number]["kind"];
export type CloudNeutralComponent = (typeof CLOUD_NEUTRAL_COMPONENTS)[number];

export function cloudNeutralComponent(kind: string): CloudNeutralComponent | undefined {
  return CLOUD_NEUTRAL_COMPONENTS.find(component => component.kind === kind);
}

export function cloudProviderComponent(kind: string): CloudProviderComponent | undefined {
  return CLOUD_PROVIDER_COMPONENTS.find(component => component.kind === kind);
}

export type CloudProviderGlyph = { viewBox: string; svg: string };
type ProviderAssetPack = { kinds: { components: Record<string, { glyph: CloudProviderGlyph }> } };
const packLoaders: Record<CloudProviderComponent["provider"], () => Promise<{ default: ProviderAssetPack }>> = {
  AWS: () => import("@orrery-diagrams/pack-aws"),
  Azure: () => import("@orrery-diagrams/pack-azure"),
  "Google Cloud": () => import("@orrery-diagrams/pack-gcp"),
};
const packPromises = new Map<CloudProviderComponent["provider"], Promise<ProviderAssetPack>>();

export async function loadCloudProviderGlyph(kind: string): Promise<CloudProviderGlyph | undefined> {
  const component = cloudProviderComponent(kind);
  if (!component) return undefined;
  let packPromise = packPromises.get(component.provider);
  if (!packPromise) {
    packPromise = packLoaders[component.provider]().then(module => module.default);
    packPromises.set(component.provider, packPromise);
  }
  const pack = await packPromise;
  return pack.kinds.components[component.iconKind]?.glyph;
}
