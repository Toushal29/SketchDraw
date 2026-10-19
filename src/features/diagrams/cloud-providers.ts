export const CLOUD_PROVIDER_COMPONENTS = [
  { kind: "aws-ec2", provider: "AWS", iconKind: "ec2", label: "Amazon EC2", description: "Elastic compute instance", glyph: "EC2", accent: "#ed8b00" },
  { kind: "aws-lambda", provider: "AWS", iconKind: "lambda", label: "AWS Lambda", description: "Event driven serverless compute", glyph: "λ", accent: "#ed8b00" },
  { kind: "aws-s3", provider: "AWS", iconKind: "s3", label: "Amazon S3", description: "Object storage bucket", glyph: "S3", accent: "#ed8b00" },
  { kind: "aws-rds", provider: "AWS", iconKind: "rds", label: "Amazon RDS", description: "Managed relational database", glyph: "DB", accent: "#ed8b00" },
  { kind: "aws-api-gateway", provider: "AWS", iconKind: "api-gateway", label: "API Gateway", description: "Managed HTTP API entry point", glyph: "API", accent: "#ed8b00" },
  { kind: "aws-sqs", provider: "AWS", iconKind: "sqs", label: "Amazon SQS", description: "Message queue", glyph: "Q", accent: "#ed8b00" },
  { kind: "aws-vpc", provider: "AWS", iconKind: "vpc", label: "Amazon VPC", description: "Virtual private cloud boundary", glyph: "VPC", accent: "#ed8b00" },
  { kind: "aws-cloudfront", provider: "AWS", iconKind: "cloudfront", label: "CloudFront", description: "Content delivery network", glyph: "CDN", accent: "#ed8b00" },
  { kind: "azure-vm", provider: "Azure", iconKind: "virtual-machine", label: "Azure Virtual Machine", description: "Cloud compute instance", glyph: "VM", accent: "#0078d4" },
  { kind: "azure-functions", provider: "Azure", iconKind: "function-apps", label: "Azure Functions", description: "Event driven serverless compute", glyph: "ƒ", accent: "#0078d4" },
  { kind: "azure-blob-storage", provider: "Azure", iconKind: "storage-accounts", label: "Blob Storage", description: "Object and file storage", glyph: "BLOB", accent: "#0078d4" },
  { kind: "azure-sql", provider: "Azure", iconKind: "sql-database", label: "Azure SQL", description: "Managed relational database", glyph: "DB", accent: "#0078d4" },
  { kind: "azure-api-management", provider: "Azure", iconKind: "api-management", label: "API Management", description: "Managed API gateway", glyph: "API", accent: "#0078d4" },
  { kind: "azure-service-bus", provider: "Azure", iconKind: "service-bus", label: "Service Bus", description: "Message queue and topic service", glyph: "BUS", accent: "#0078d4" },
  { kind: "azure-vnet", provider: "Azure", iconKind: "virtual-networks", label: "Virtual Network", description: "Private network boundary", glyph: "VNET", accent: "#0078d4" },
  { kind: "azure-app-service", provider: "Azure", iconKind: "app-services", label: "App Service", description: "Managed web application host", glyph: "APP", accent: "#0078d4" },
  { kind: "gcp-compute-engine", provider: "Google Cloud", iconKind: "compute-engine", label: "Compute Engine", description: "Cloud compute instance", glyph: "VM", accent: "#4285f4" },
  { kind: "gcp-cloud-functions", provider: "Google Cloud", iconKind: "cloud-functions", label: "Cloud Functions", description: "Event driven serverless compute", glyph: "ƒ", accent: "#4285f4" },
  { kind: "gcp-cloud-storage", provider: "Google Cloud", iconKind: "cloud-storage", label: "Cloud Storage", description: "Object storage bucket", glyph: "GCS", accent: "#4285f4" },
  { kind: "gcp-cloud-sql", provider: "Google Cloud", iconKind: "cloud-sql", label: "Cloud SQL", description: "Managed relational database", glyph: "DB", accent: "#4285f4" },
  { kind: "gcp-api-gateway", provider: "Google Cloud", iconKind: "cloud-api-gateway", label: "API Gateway", description: "Managed HTTP API entry point", glyph: "API", accent: "#4285f4" },
  { kind: "gcp-pubsub", provider: "Google Cloud", iconKind: "pubsub", label: "Pub/Sub", description: "Publish and subscribe messaging", glyph: "PUB", accent: "#4285f4" },
  { kind: "gcp-vpc", provider: "Google Cloud", iconKind: "vpc", label: "VPC Network", description: "Virtual private cloud boundary", glyph: "VPC", accent: "#4285f4" },
  { kind: "gcp-load-balancing", provider: "Google Cloud", iconKind: "cloud-load-balancing", label: "Cloud Load Balancing", description: "Managed traffic distribution", glyph: "LB", accent: "#4285f4" },
] as const;

export type CloudProviderComponentKind = (typeof CLOUD_PROVIDER_COMPONENTS)[number]["kind"];
export type CloudProviderComponent = (typeof CLOUD_PROVIDER_COMPONENTS)[number];

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
