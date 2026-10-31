import { stringify } from "yaml";
import type { Element, GroupElement, SchemaTableElement, ShapeElement } from "../../model";
import { elementBounds } from "../canvas/bounds";
import { normalizeExternalHref } from "../links/links";

export type ScaffoldFile = { path: string; contents: string };
export type ScaffoldFormat = "terraform" | "openapi" | "html" | "react";

const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
const words = (value: string) => clean(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
const snake = (value: string, fallback: string) => { const joined = words(value).join("_").toLowerCase(); return /^[a-z_]/.test(joined) ? joined : joined ? `r_${joined}` : fallback; };
const pascal = (value: string, fallback: string) => { const joined = words(value).map(part => part[0].toUpperCase() + part.slice(1)).join(""); return /^[A-Za-z_]/.test(joined) ? joined : joined ? `Screen${joined}` : fallback; };
function uniqueName(base: string, used: Set<string>): string { let name = base; let count = 2; while (used.has(name)) name = `${base}_${count++}`; used.add(name); return name; }

function walk(items: Element[], visit: (element: Element) => void) { for (const item of items) { visit(item); if (item.type === "group") walk(item.elements, visit); } }
const componentsOf = (items: Element[]) => { const found: GroupElement[] = []; walk(items, item => { if (item.type === "group" && item.libraryComponent) found.push(item); }); return found; };
const fieldsOf = (group: GroupElement): Record<string, string> => Object.fromEntries((group.libraryComponent?.componentFields ?? []).map(field => [field.key, field.value.trim()]));
const connectorsOf = (items: Element[]) => { const found: ShapeElement[] = []; walk(items, item => { if ((item.type === "arrow" || item.type === "line") && item.startBinding && item.endBinding) found.push(item); }); return found; };

/* ---------------------------------------------------------------- Terraform */

const TERRAFORM_RESOURCES: Record<string, { type: string; hint: string }> = {
  "aws-ec2": { type: "aws_instance", hint: "ami, instance_type" }, "aws-lambda": { type: "aws_lambda_function", hint: "function_name, role, handler, runtime" }, "aws-s3": { type: "aws_s3_bucket", hint: "bucket" },
  "aws-rds": { type: "aws_db_instance", hint: "engine, instance_class, allocated_storage" }, "aws-api-gateway": { type: "aws_apigatewayv2_api", hint: "name, protocol_type" }, "aws-sqs": { type: "aws_sqs_queue", hint: "name" },
  "aws-vpc": { type: "aws_vpc", hint: "cidr_block" }, "aws-cloudfront": { type: "aws_cloudfront_distribution", hint: "origin, default_cache_behavior, enabled" }, "aws-ecs": { type: "aws_ecs_cluster", hint: "name" },
  "aws-eks": { type: "aws_eks_cluster", hint: "name, role_arn, vpc_config" }, "aws-dynamodb": { type: "aws_dynamodb_table", hint: "name, hash_key, attribute" }, "aws-sns": { type: "aws_sns_topic", hint: "name" },
  "aws-eventbridge": { type: "aws_cloudwatch_event_bus", hint: "name" }, "aws-cloudwatch": { type: "aws_cloudwatch_log_group", hint: "name" }, "aws-secrets-manager": { type: "aws_secretsmanager_secret", hint: "name" },
  "aws-iam": { type: "aws_iam_role", hint: "assume_role_policy" }, "aws-aurora": { type: "aws_rds_cluster", hint: "engine, master_username" }, "aws-ecr": { type: "aws_ecr_repository", hint: "name" },
  "aws-ebs": { type: "aws_ebs_volume", hint: "availability_zone, size" }, "aws-elasticache": { type: "aws_elasticache_cluster", hint: "engine, node_type, num_cache_nodes" }, "aws-route53": { type: "aws_route53_zone", hint: "name" },
  "aws-step-functions": { type: "aws_sfn_state_machine", hint: "name, role_arn, definition" }, "aws-glue": { type: "aws_glue_catalog_database", hint: "name" }, "aws-redshift": { type: "aws_redshift_cluster", hint: "cluster_identifier, node_type" },
  "aws-kinesis-data-streams": { type: "aws_kinesis_stream", hint: "name, shard_count" }, "aws-waf": { type: "aws_wafv2_web_acl", hint: "name, scope, default_action" }, "aws-kms": { type: "aws_kms_key", hint: "description" },
  "aws-cognito": { type: "aws_cognito_user_pool", hint: "name" }, "aws-cloudtrail": { type: "aws_cloudtrail", hint: "name, s3_bucket_name" },
  "azure-vm": { type: "azurerm_linux_virtual_machine", hint: "name, resource_group_name, location, size, admin_username" }, "azure-functions": { type: "azurerm_linux_function_app", hint: "name, resource_group_name, location, service_plan_id" },
  "azure-blob-storage": { type: "azurerm_storage_account", hint: "name, resource_group_name, location, account_tier, account_replication_type" }, "azure-sql": { type: "azurerm_mssql_server", hint: "name, resource_group_name, location, version" },
  "azure-api-management": { type: "azurerm_api_management", hint: "name, publisher_name, publisher_email, sku_name" }, "azure-service-bus": { type: "azurerm_servicebus_namespace", hint: "name, sku" },
  "azure-vnet": { type: "azurerm_virtual_network", hint: "name, address_space" }, "azure-app-service": { type: "azurerm_linux_web_app", hint: "name, service_plan_id, site_config" }, "azure-aks": { type: "azurerm_kubernetes_cluster", hint: "name, dns_prefix, default_node_pool" },
  "azure-cosmos-db": { type: "azurerm_cosmosdb_account", hint: "offer_type, kind, consistency_policy, geo_location" }, "azure-key-vault": { type: "azurerm_key_vault", hint: "tenant_id, sku_name" }, "azure-event-hubs": { type: "azurerm_eventhub_namespace", hint: "sku" },
  "azure-application-gateway": { type: "azurerm_application_gateway", hint: "sku, gateway_ip_configuration, frontend_port" }, "azure-firewall": { type: "azurerm_firewall", hint: "sku_name, sku_tier" }, "azure-container-registry": { type: "azurerm_container_registry", hint: "sku" },
  "azure-postgres": { type: "azurerm_postgresql_flexible_server", hint: "version, administrator_login" }, "azure-dns": { type: "azurerm_dns_zone", hint: "name, resource_group_name" }, "azure-log-analytics": { type: "azurerm_log_analytics_workspace", hint: "sku, retention_in_days" },
  "gcp-compute-engine": { type: "google_compute_instance", hint: "machine_type, zone, boot_disk, network_interface" }, "gcp-cloud-functions": { type: "google_cloudfunctions2_function", hint: "location, build_config" },
  "gcp-cloud-storage": { type: "google_storage_bucket", hint: "name, location" }, "gcp-cloud-sql": { type: "google_sql_database_instance", hint: "database_version, settings" }, "gcp-pubsub": { type: "google_pubsub_topic", hint: "name" },
  "gcp-vpc": { type: "google_compute_network", hint: "name" }, "gcp-gke": { type: "google_container_cluster", hint: "location, initial_node_count" }, "gcp-cloud-run": { type: "google_cloud_run_v2_service", hint: "location, template" },
  "gcp-firestore": { type: "google_firestore_database", hint: "name, location_id, type" }, "gcp-spanner": { type: "google_spanner_instance", hint: "config, display_name" }, "gcp-bigquery": { type: "google_bigquery_dataset", hint: "dataset_id" },
  "gcp-bigtable": { type: "google_bigtable_instance", hint: "name" }, "gcp-memorystore": { type: "google_redis_instance", hint: "name, memory_size_gb" }, "gcp-secret-manager": { type: "google_secret_manager_secret", hint: "secret_id, replication" },
  "gcp-cloud-dns": { type: "google_dns_managed_zone", hint: "name, dns_name" }, "gcp-kms": { type: "google_kms_key_ring", hint: "name, location" }, "gcp-artifact-registry": { type: "google_artifact_registry_repository", hint: "repository_id, format" },
};
const TERRAFORM_PROVIDERS: Record<string, { source: string; version: string; block: string }> = {
  aws: { source: "hashicorp/aws", version: "~> 5.0", block: 'provider "aws" {\n  region = var.aws_region\n}\n' },
  azurerm: { source: "hashicorp/azurerm", version: "~> 3.0", block: 'provider "azurerm" {\n  features {}\n}\n' },
  google: { source: "hashicorp/google", version: "~> 5.0", block: 'provider "google" {\n  project = var.gcp_project\n  region  = var.gcp_region\n}\n' },
};

/** A buildable Terraform starting point: one resource block per AWS, Azure, or GCP component, with the diagram's links as comments. */
export function terraformFiles(elements: Element[]): ScaffoldFile[] {
  const components = componentsOf(elements).filter(group => TERRAFORM_RESOURCES[group.libraryComponent!.kind]);
  if (!components.length) throw new Error("Add AWS, Azure, or Google Cloud components to the diagram first. Provider-neutral cloud symbols have no single Terraform resource.");
  const used = new Map<string, Set<string>>(); const idToAddress = new Map<string, string>(); const idToLabel = new Map<string, string>();
  const providers = new Set<string>(); const blocks: { id: string; type: string; name: string; label: string; hint: string }[] = [];
  for (const group of components) {
    const info = TERRAFORM_RESOURCES[group.libraryComponent!.kind]; const provider = info.type.startsWith("aws") ? "aws" : info.type.startsWith("azurerm") ? "azurerm" : "google";
    providers.add(provider);
    const label = clean(group.libraryComponent!.label) || group.libraryComponent!.kind;
    const taken = used.get(info.type) ?? new Set<string>(); used.set(info.type, taken);
    const name = uniqueName(snake(label, "resource"), taken);
    if (group.id) { idToAddress.set(group.id, `${info.type}.${name}`); idToLabel.set(group.id, label); }
    blocks.push({ id: group.id ?? "", type: info.type, name, label, hint: info.hint });
  }
  const links = new Map<string, string[]>();
  for (const connector of connectorsOf(elements)) {
    const from = connector.startBinding!.elementId; const to = connector.endBinding!.elementId;
    if (!idToAddress.has(from) || !idToAddress.has(to)) continue;
    const text = `${idToLabel.get(to)} (${idToAddress.get(to)})${clean(connector.label?.text) ? `: ${clean(connector.label?.text)}` : ""}`;
    links.set(from, [...(links.get(from) ?? []), text]);
  }
  const main = blocks.map(block => [
    `resource "${block.type}" "${block.name}" {`,
    `  # ${block.label}`,
    `  # TODO: set required arguments (${block.hint})`,
    ...(links.get(block.id) ?? []).map(link => `  # Diagram: connects to ${link}`),
    "}",
  ].join("\n")).join("\n\n") + "\n";
  const providerList = [...providers];
  const versions = `terraform {\n  required_version = ">= 1.5"\n  required_providers {\n${providerList.map(name => `    ${name} = {\n      source  = "${TERRAFORM_PROVIDERS[name].source}"\n      version = "${TERRAFORM_PROVIDERS[name].version}"\n    }`).join("\n")}\n  }\n}\n\n${providerList.map(name => TERRAFORM_PROVIDERS[name].block).join("\n")}`;
  const variables = [
    ...(providers.has("aws") ? ['variable "aws_region" {\n  type    = string\n  default = "us-east-1"\n}'] : []),
    ...(providers.has("google") ? ['variable "gcp_project" {\n  type = string\n}', 'variable "gcp_region" {\n  type    = string\n  default = "us-central1"\n}'] : []),
  ].join("\n\n");
  return [{ path: "versions.tf", contents: versions }, ...(variables ? [{ path: "variables.tf", contents: `${variables}\n` }] : []), { path: "main.tf", contents: `# Generated by SketchDraw from your diagram. Review every block before applying.\n\n${main}` }];
}

/* ------------------------------------------------------------------ OpenAPI */

const jsonType = (sqlType: string): Record<string, unknown> => {
  const type = sqlType.toLowerCase();
  if (/int|serial/.test(type)) return { type: "integer" };
  if (/numeric|decimal|float|double|real|money/.test(type)) return { type: "number" };
  if (/bool/.test(type)) return { type: "boolean" };
  if (/json/.test(type)) return { type: "object" };
  if (/timestamp|datetime/.test(type)) return { type: "string", format: "date-time" };
  if (/^date/.test(type)) return { type: "string", format: "date" };
  if (/uuid/.test(type)) return { type: "string", format: "uuid" };
  return { type: "string" };
};
const MEDIA_LINE = /^([\w.+-]+\/[\w.+-]+)\s*[:\-]\s*(.+)$/;
function schemaFor(text: string, refs: Set<string>): Record<string, unknown> {
  const array = /^(.+)\[\]$/.exec(text.trim()); const name = (array?.[1] ?? text).trim();
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return { type: "string", description: text.trim() };
  refs.add(name);
  const reference = { $ref: `#/components/schemas/${name}` };
  return array ? { type: "array", items: reference } : reference;
}

/** An OpenAPI 3.1 document from API endpoint components. Schemas named in requests and responses are filled from matching database table cards. */
export function openApiFiles(elements: Element[]): ScaffoldFile[] {
  const endpoints = componentsOf(elements).filter(group => group.libraryComponent!.kind === "software-api");
  if (!endpoints.length) throw new Error("Add API endpoint components (Software > API endpoint) to the diagram first.");
  const refs = new Set<string>(); const paths: Record<string, Record<string, unknown>> = {}; const schemes: Record<string, unknown> = {}; const servers = new Set<string>(); const operationIds = new Set<string>();
  for (const endpoint of endpoints) {
    const fields = fieldsOf(endpoint);
    const method = (fields.method || "GET").toLowerCase().replace(/[^a-z]/g, "");
    const rawPath = fields.path || "/"; const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    if (!["get", "put", "post", "delete", "options", "head", "patch", "trace"].includes(method)) continue;
    const operation: Record<string, unknown> = {};
    const label = clean(endpoint.libraryComponent!.label);
    if (fields.summary || label) operation.summary = fields.summary || label;
    operation.operationId = uniqueName(fields["operation-id"] || camelId(method, path), operationIds);
    const parameters: Record<string, unknown>[] = [];
    for (const line of (fields.parameters ?? "").split(/\r?\n/).map(clean).filter(Boolean)) {
      const [name, location, type, required] = line.split(/[,|]\s*/);
      if (!name || !/^[A-Za-z_][\w.-]*$/.test(name)) continue;
      const where = ["path", "query", "header", "cookie"].includes((location ?? "").toLowerCase()) ? location.toLowerCase() : "query";
      parameters.push({ name, in: where, required: where === "path" || /^(true|yes|required)$/i.test(required ?? ""), schema: { type: ["integer", "number", "boolean", "string", "array", "object"].includes((type ?? "").toLowerCase()) ? type.toLowerCase() : "string" } });
    }
    for (const match of path.matchAll(/\{([^}]+)\}/g)) if (!parameters.some(parameter => parameter.name === match[1])) parameters.push({ name: match[1], in: "path", required: true, schema: { type: "string" } });
    if (parameters.length) operation.parameters = parameters;
    if (fields["request-body"]) {
      const media = MEDIA_LINE.exec(clean(fields["request-body"]));
      operation.requestBody = { required: true, content: { [media?.[1] ?? "application/json"]: { schema: schemaFor(media?.[2] ?? fields["request-body"], refs) } } };
    }
    const responses: Record<string, unknown> = {};
    for (const line of (fields.responses ?? "").split(/\r?\n/).map(clean).filter(Boolean)) {
      const match = /^(\d{3}|default)\s*[:\-]\s*(.*)$/i.exec(line); if (!match) continue;
      const detail = match[2].trim();
      responses[match[1].toLowerCase()] = detail && /^[A-Za-z][A-Za-z0-9_]*(\[\])?$/.test(detail) ? { description: statusText(match[1]), content: { "application/json": { schema: schemaFor(detail, refs) } } } : { description: detail || statusText(match[1]) };
    }
    operation.responses = Object.keys(responses).length ? responses : { "200": { description: "OK" } };
    const security = clean(fields.security).toLowerCase();
    if (security === "none") operation.security = [];
    else if (security) {
      const scheme = /oauth/.test(security) ? "oauth2" : /api[\s-]?key/.test(security) ? "apiKey" : /basic/.test(security) ? "basicAuth" : "bearerAuth";
      schemes[scheme] = scheme === "oauth2" ? { type: "oauth2", flows: { authorizationCode: { authorizationUrl: "https://example.com/oauth/authorize", tokenUrl: "https://example.com/oauth/token", scopes: {} } } }
        : scheme === "apiKey" ? { type: "apiKey", in: "header", name: "X-API-Key" } : scheme === "basicAuth" ? { type: "http", scheme: "basic" } : { type: "http", scheme: "bearer" };
      operation.security = [{ [scheme]: [] }];
    }
    if (/^https?:\/\//i.test(fields.server ?? "")) servers.add(fields.server.replace(/\/+$/, ""));
    (paths[path] ??= {})[method] = operation;
  }
  const tables = new Map<string, SchemaTableElement>(); walk(elements, item => { if (item.type === "schemaTable") tables.set(item.name.toLowerCase(), item); });
  const schemas: Record<string, unknown> = {};
  for (const name of [...refs].sort()) {
    const table = tables.get(name.toLowerCase());
    schemas[name] = table
      ? { type: "object", required: table.columns.filter(column => column.nullable === false || column.primaryKey).map(column => column.name), properties: Object.fromEntries(table.columns.map(column => [column.name, jsonType(column.dataType)])) }
      : { type: "object", description: `TODO: define ${name}.` };
  }
  const document = {
    openapi: "3.1.0", info: { title: "API generated by SketchDraw", version: "0.1.0", description: "Stub generated from API endpoint components. Review request and response schemas before publishing." },
    ...(servers.size ? { servers: [...servers].map(url => ({ url })) } : {}), paths,
    ...(Object.keys(schemas).length || Object.keys(schemes).length ? { components: { ...(Object.keys(schemas).length ? { schemas } : {}), ...(Object.keys(schemes).length ? { securitySchemes: schemes } : {}) } } : {}),
  };
  return [{ path: "openapi.yaml", contents: stringify(document, { lineWidth: 0 }) }];
}
function camelId(method: string, path: string): string {
  const parts = words(path.replace(/\{([^}]+)\}/g, "by $1")); return method + parts.map(part => part[0].toUpperCase() + part.slice(1)).join("");
}
const statusText = (code: string) => ({ "200": "OK", "201": "Created", "202": "Accepted", "204": "No content", "400": "Bad request", "401": "Unauthorized", "403": "Forbidden", "404": "Not found", "409": "Conflict", "422": "Unprocessable entity", "500": "Server error" } as Record<string, string>)[code] ?? (code === "default" ? "Unexpected error" : `Status ${code}`);

/* ------------------------------------------------------------ HTML and React */

type UiNode = { tag: string; attrs?: Record<string, string | boolean>; style?: Record<string, string>; children?: (UiNode | string)[] };
const VOID = new Set(["input", "img", "br", "hr"]);
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const kebab = (key: string) => key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

function renderHtml(node: UiNode | string, depth: number): string {
  const pad = "  ".repeat(depth);
  if (typeof node === "string") return `${pad}${escapeHtml(node)}`;
  const attrs = Object.entries(node.attrs ?? {}).flatMap(([key, value]) => value === true ? [key] : value === false || (key === "placeholder" && value === "") ? [] : [`${key}="${escapeHtml(value)}"`]);
  if (node.style && Object.keys(node.style).length) attrs.push(`style="${Object.entries(node.style).map(([key, value]) => `${kebab(key)}: ${value}`).join("; ")}"`);
  const open = `<${node.tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}`;
  if (VOID.has(node.tag)) return `${pad}${open}>`;
  const children = node.children ?? [];
  if (!children.length) return `${pad}${open}></${node.tag}>`;
  if (children.length === 1 && typeof children[0] === "string") return `${pad}${open}>${escapeHtml(children[0])}</${node.tag}>`;
  return `${pad}${open}>\n${children.map(child => renderHtml(child, depth + 1)).join("\n")}\n${pad}</${node.tag}>`;
}
const JSX_ATTRS: Record<string, string> = { class: "className", for: "htmlFor", checked: "defaultChecked", value: "defaultValue", tabindex: "tabIndex" };
function renderJsx(node: UiNode | string, depth: number): string {
  const pad = "  ".repeat(depth);
  if (typeof node === "string") return `${pad}{${JSON.stringify(node)}}`;
  const attrs = Object.entries(node.attrs ?? {}).flatMap(([key, value]) => {
    if (value === false || key === "selected" || (key === "placeholder" && value === "")) return [];
    const name = JSX_ATTRS[key] ?? key;
    // Plain JSX string attributes do not process escapes, so fall back to an expression for anything unusual.
    return value === true ? [name] : /^[^"\\\r\n&<>{}]*$/.test(value) ? [`${name}="${value}"`] : [`${name}={${JSON.stringify(value)}}`];
  });
  if (node.style && Object.keys(node.style).length) attrs.push(`style={${JSON.stringify(node.style)}}`);
  const open = `<${node.tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}`;
  if (VOID.has(node.tag)) return `${pad}${open} />`;
  const children = node.children ?? [];
  if (!children.length) return `${pad}${open} />`;
  if (children.length === 1 && typeof children[0] === "string") return `${pad}${open}>{${JSON.stringify(children[0])}}</${node.tag}>`;
  return `${pad}${open}>\n${children.map(child => renderJsx(child, depth + 1)).join("\n")}\n${pad}</${node.tag}>`;
}

const px = (value: number) => `${Math.round(value)}px`;
function guiNode(group: GroupElement, used: Set<string>): UiNode {
  const component = group.libraryComponent!; const props = component.guiProperties; const label = clean(component.label);
  const title = clean(props?.title) || clean(component.formTitle) || label;
  const options = (component.formOptions?.length ? component.formOptions : props?.items) ?? [];
  const id = uniqueName(snake(title || component.kind, "field"), used);
  const field = (control: UiNode): UiNode => ({ tag: "label", attrs: { for: id }, children: [title, control] });
  const kind = component.kind;
  if (kind === "form-button") return { tag: "button", attrs: { type: "button" }, children: [clean(props?.actionLabel) || title || "Button"] };
  if (["form-input", "form-email", "form-password", "form-search", "form-date"].includes(kind)) return field({ tag: "input", attrs: { id, name: id, type: kind === "form-email" ? "email" : kind === "form-password" ? "password" : kind === "form-search" ? "search" : kind === "form-date" ? "date" : "text", placeholder: clean(props?.placeholder) } });
  if (kind === "form-textarea") return field({ tag: "textarea", attrs: { id, name: id, rows: "4", placeholder: clean(props?.placeholder) } });
  if (kind === "form-select") return field({ tag: "select", attrs: { id, name: id, value: options[component.selectedOption ?? 0] ?? "" }, children: options.map(option => ({ tag: "option", attrs: { value: option, ...(options[component.selectedOption ?? 0] === option ? { selected: true } : {}) }, children: [option] })) });
  if (kind === "form-checkbox" || kind === "form-radio") return { tag: "fieldset", children: [{ tag: "legend", children: [title] }, ...options.map((option, index): UiNode => ({ tag: "label", children: [{ tag: "input", attrs: { type: kind === "form-radio" ? "radio" : "checkbox", name: id, value: option, ...((kind === "form-radio" ? (component.selectedOption ?? 0) === index : component.formStates?.[index]) ? { checked: true } : {}) } }, option] }))] };
  if (kind === "form-toggle") return { tag: "label", children: [{ tag: "input", attrs: { id, type: "checkbox", role: "switch", ...(component.formState ? { checked: true } : {}) } }, title] };
  if (kind === "form-slider") return field({ tag: "input", attrs: { id, name: id, type: "range" } });
  if (kind === "form-file") return field({ tag: "input", attrs: { id, name: id, type: "file" } });
  if (kind === "gui-card") return { tag: "article", children: [{ tag: "h3", children: [title || "Card"] }, ...(clean(props?.bodyText) ? [{ tag: "p", children: [clean(props?.bodyText)] } as UiNode] : []), ...(clean(props?.actionLabel) ? [{ tag: "button", attrs: { type: "button" }, children: [clean(props?.actionLabel)] } as UiNode] : [])] };
  if (kind === "gui-app-bar") return { tag: "header", children: [{ tag: "strong", children: [title || "App"] }] };
  if (kind === "gui-navigation" || kind === "gui-menu" || kind === "gui-tabs") return { tag: "nav", attrs: { "aria-label": title || "Navigation" }, children: [{ tag: "ul", children: options.map((item, index): UiNode => ({ tag: "li", children: [{ tag: "a", attrs: { href: "#", ...(props?.activeItem === index ? { "aria-current": "page" } : {}) }, children: [item] }] })) }] };
  if (kind === "gui-breadcrumbs") return { tag: "nav", attrs: { "aria-label": "Breadcrumb" }, children: [{ tag: "ol", children: options.map((item): UiNode => ({ tag: "li", children: [item] })) }] };
  if (kind === "gui-list") return { tag: "ul", children: options.map((item): UiNode => ({ tag: "li", children: [item] })) };
  if (kind === "gui-alert") return { tag: "div", attrs: { role: "alert" }, children: [clean(props?.bodyText) || title || "Alert"] };
  if (kind === "gui-modal") return { tag: "dialog", attrs: { open: true, "aria-label": title || "Dialog" }, children: [{ tag: "h2", children: [title || "Dialog"] }, ...(clean(props?.bodyText) ? [{ tag: "p", children: [clean(props?.bodyText)] } as UiNode] : []), ...(clean(props?.actionLabel) ? [{ tag: "button", attrs: { type: "button" }, children: [clean(props?.actionLabel)] } as UiNode] : [])] };
  if (kind === "gui-badge") return { tag: "span", attrs: { class: "badge" }, children: [title || "Badge"] };
  if (kind === "gui-progress") return { tag: "progress", attrs: { max: "100", value: "50", "aria-label": title || "Progress" } };
  if (kind === "gui-image") return { tag: "div", attrs: { role: "img", "aria-label": clean(group.altText) || title || "Image", class: "image-placeholder" } };
  if (kind === "gui-accordion") return { tag: "div", children: options.map((item): UiNode => ({ tag: "details", children: [{ tag: "summary", children: [item] }] })) };
  return { tag: "div", attrs: { "data-component": kind }, children: [title || label || kind] };
}

type ScreenContext = { used: Set<string> };
function childNode(child: Element, frame: { x: number; y: number }, absolute: boolean, context: ScreenContext, fill: boolean): UiNode | undefined {
  if (child.hidden || child.type === "line" || child.type === "arrow" || child.type === "freehand") return undefined;
  const box = elementBounds(child);
  const style: Record<string, string> = absolute ? { position: "absolute", left: px(box.x - frame.x), top: px(box.y - frame.y), width: px(box.w), minHeight: px(box.h) } : fill ? { flex: "1 1 0" } : {};
  let node: UiNode | undefined;
  if (child.type === "group" && child.libraryComponent) node = guiNode(child, context.used);
  else if (child.type === "group" && child.container) node = containerNode(child, context);
  else if (child.type === "group" && child.note) node = { tag: "aside", children: [...(clean(child.note.title) ? [{ tag: "strong", children: [clean(child.note.title)] } as UiNode] : []), { tag: "p", children: [clean(child.note.content)] }] };
  else if (child.type === "group") node = { tag: "div", children: child.elements.flatMap(grandchild => childNode(grandchild, { x: box.x, y: box.y }, true, context, false) ?? []) };
  else if (child.type === "text") { node = { tag: child.fontSize >= 24 ? "h2" : child.fontSize >= 18 ? "h3" : "p", children: [clean(child.text)] }; style.color = child.color; if (child.bold) style.fontWeight = "700"; }
  else if (child.type === "image") node = { tag: "div", attrs: { role: "img", "aria-label": clean(child.altText) || "Image", class: "image-placeholder" } };
  else if (child.type !== "schemaTable") {
    const label = clean(child.label?.text);
    node = { tag: "div", attrs: { class: "shape" }, children: label ? [label] : [] };
    style.border = `${Math.max(1, child.thickness)}px solid ${child.color}`; if (child.fillColor) style.background = child.fillColor;
    if (child.type === "circle") style.borderRadius = "50%"; else if (child.edgeStyle === "pill") style.borderRadius = "999px"; else if (child.cornerRadius) style.borderRadius = px(child.cornerRadius);
  }
  if (!node) return undefined;
  if (clean(child.altText) && !node.attrs?.["aria-label"]) node = { ...node, attrs: { ...node.attrs, "aria-label": clean(child.altText) } };
  if (clean(child.tooltip)) node = { ...node, attrs: { ...node.attrs, title: clean(child.tooltip) } };
  const href = normalizeExternalHref(child.href);
  if (href) return { tag: "a", attrs: { href, target: "_blank", rel: "noopener noreferrer" }, style, children: [node] };
  return { ...node, style: { ...node.style, ...style } };
}

function containerNode(frame: GroupElement, context: ScreenContext): UiNode {
  const bounds = frame.componentBounds ?? elementBounds(frame); const layout = frame.container?.autoLayout;
  const children = frame.elements.filter(child => !child.hidden);
  const style: Record<string, string> = layout
    ? { display: "flex", flexDirection: layout.direction === "horizontal" ? "row" : "column", gap: px(layout.gap), padding: px(layout.padding), alignItems: layout.align === "stretch" ? "stretch" : layout.align === "center" ? "center" : layout.align === "end" ? "flex-end" : "flex-start", boxSizing: "border-box" }
    : { position: "relative" };
  if (frame.container?.background) style.background = frame.container.background;
  if (!layout) { style.width = px(bounds.w); style.height = px(bounds.h); }
  const ordered = layout ? children : [...children].sort((a, b) => elementBounds(a).y - elementBounds(b).y || elementBounds(a).x - elementBounds(b).x);
  return { tag: "section", attrs: { class: "frame", "aria-label": frame.container?.name ?? "Frame" }, style, children: ordered.flatMap(child => childNode(child, bounds, !layout, context, !!layout && !!child.layoutFill) ?? []) };
}

function framesOf(elements: Element[]): GroupElement[] {
  const frames: GroupElement[] = [];
  const visit = (items: Element[]) => { for (const item of items) if (item.type === "group") { if (item.container?.kind === "frame" && !item.hidden) frames.push(item); else visit(item.elements); } };
  visit(elements);
  return frames;
}
const SCREEN_CSS = `* { box-sizing: border-box; }
body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2933; background: #f3f5f8; }
.screen { margin: 0 0 32px; }
.screen > h1 { margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #52606d; }
.frame { background: #ffffff; border: 1px solid #d5dbe3; border-radius: 6px; overflow: hidden; }
.frame label { display: block; font-size: 12px; font-weight: 600; }
.frame input, .frame select, .frame textarea { display: block; width: 100%; margin-top: 4px; padding: 6px 8px; border: 1px solid #b6c0cc; border-radius: 4px; font: inherit; }
.frame button { padding: 8px 14px; border: 0; border-radius: 4px; background: #2468a0; color: #ffffff; font: inherit; cursor: pointer; }
.frame nav ul, .frame nav ol, .frame ul { margin: 0; padding-left: 18px; }
.frame article, .frame aside, .frame header { padding: 12px; border: 1px solid #d5dbe3; border-radius: 6px; background: #ffffff; }
.frame h2, .frame h3, .frame p { margin: 0; }
.image-placeholder { background: repeating-linear-gradient(45deg, #e4e9ef, #e4e9ef 8px, #f3f5f8 8px, #f3f5f8 16px); min-height: 60px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #e1ecf7; font-size: 12px; }
.shape { padding: 8px; display: flex; align-items: center; justify-content: center; text-align: center; }
`;

export function htmlFiles(elements: Element[]): ScaffoldFile[] {
  const frames = framesOf(elements);
  if (!frames.length) throw new Error("Create a screen frame first: select your UI components and choose Create frame from selection.");
  const screens = frames.map(frame => {
    const name = clean(frame.container?.name) || "Screen";
    return { name, node: containerNode(frame, { used: new Set() }) };
  });
  const body = screens.map(screen => renderHtml({ tag: "section", attrs: { class: "screen" }, children: [{ tag: "h1", children: [screen.name] }, screen.node] }, 2)).join("\n");
  const page = `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>${escapeHtml(screens[0].name)}</title>\n    <link rel="stylesheet" href="styles.css" />\n  </head>\n  <body>\n${body}\n  </body>\n</html>\n`;
  return [{ path: "index.html", contents: page }, { path: "styles.css", contents: SCREEN_CSS }];
}

export function reactFiles(elements: Element[]): ScaffoldFile[] {
  const frames = framesOf(elements);
  if (!frames.length) throw new Error("Create a screen frame first: select your UI components and choose Create frame from selection.");
  const used = new Set<string>();
  const screens = frames.map(frame => {
    const name = uniqueName(pascal(clean(frame.container?.name), "Screen"), used);
    return { name, title: clean(frame.container?.name) || name, node: containerNode(frame, { used: new Set() }) };
  });
  const files: ScaffoldFile[] = screens.map(screen => ({ path: `src/screens/${screen.name}.jsx`, contents: `export default function ${screen.name}() {\n  return (\n${renderJsx(screen.node, 2)}\n  );\n}\n` }));
  files.push(
    { path: "src/App.jsx", contents: `import { useState } from "react";\n${screens.map(screen => `import ${screen.name} from "./screens/${screen.name}.jsx";`).join("\n")}\n\nconst screens = [\n${screens.map(screen => `  { name: ${JSON.stringify(screen.title)}, Component: ${screen.name} },`).join("\n")}\n];\n\nexport default function App() {\n  const [index, setIndex] = useState(0);\n  const { Component } = screens[index];\n  return (\n    <main>\n      <nav className="screen-tabs" aria-label="Screens">\n        {screens.map((screen, position) => (\n          <button key={screen.name} type="button" aria-pressed={position === index} onClick={() => setIndex(position)}>{screen.name}</button>\n        ))}\n      </nav>\n      <Component />\n    </main>\n  );\n}\n` },
    { path: "src/main.jsx", contents: `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App.jsx";\nimport "./styles.css";\n\ncreateRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);\n` },
    { path: "src/styles.css", contents: `${SCREEN_CSS}.screen-tabs { display: flex; gap: 8px; margin-bottom: 16px; }\n.screen-tabs button[aria-pressed="true"] { background: #1b4f7a; }\n` },
    { path: "index.html", contents: `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>${escapeHtml(screens[0].title)}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n` },
    { path: "vite.config.js", contents: `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({ plugins: [react()] });\n` },
    { path: "package.json", contents: `${JSON.stringify({ name: "sketchdraw-screens", private: true, version: "0.1.0", type: "module", scripts: { dev: "vite", build: "vite build" }, dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" }, devDependencies: { "@vitejs/plugin-react": "^4.3.1", vite: "^5.4.0" } }, null, 2)}\n` },
    { path: "README.md", contents: `# Screens from SketchDraw\n\nRun \`npm install\` then \`npm run dev\`. Each frame in your sketch became a component in \`src/screens\`. Frames with auto layout use flexbox; others keep their positions.\n` },
  );
  return files;
}

export function buildScaffoldFiles(format: ScaffoldFormat, elements: Element[]): ScaffoldFile[] {
  return format === "terraform" ? terraformFiles(elements) : format === "openapi" ? openApiFiles(elements) : format === "html" ? htmlFiles(elements) : reactFiles(elements);
}
