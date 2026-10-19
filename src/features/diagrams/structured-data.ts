import { parseAllDocuments } from "yaml";
import type { Element, ShapeElement } from "../../model";

type GraphNode = { key: string; title: string; detail?: string; kind?: string; status?: "drift" | "create" | "update" | "delete" };
type GraphLink = { from: string; to: string; label?: string };
const makeId = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const stringValue = (value: unknown) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
const objectValue = (value: unknown): Record<string, unknown> | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const titleFor = (value: Record<string, unknown>, fallback: string) => stringValue(value.name ?? value.label ?? value.title ?? value.id) || fallback;
const cloudFormationTags = [
  { tag: "!Ref", resolve: (value: string) => ({ Ref: value }) },
  { tag: "!GetAtt", resolve: (value: string) => ({ "Fn::GetAtt": value }) },
  { tag: "!Sub", resolve: (value: string) => ({ "Fn::Sub": value }) },
  { tag: "!Join", resolve: (value: string) => ({ "Fn::Join": value }) },
  { tag: "!ImportValue", resolve: (value: string) => ({ "Fn::ImportValue": value }) },
  { tag: "!Select", resolve: (value: string) => ({ "Fn::Select": value }) },
  { tag: "!Base64", resolve: (value: string) => ({ "Fn::Base64": value }) },
];

function graphToElements(nodes: GraphNode[], links: GraphLink[], prefix: string): Element[] {
  if (!nodes.length) throw new Error("No resources or records were found in this file.");
  if (nodes.length > 500) throw new Error("A generated diagram can contain up to 500 nodes.");
  if (links.length > 2000) throw new Error("A generated diagram can contain up to 2,000 relationships.");
  if (new Set(nodes.map(node => node.key)).size !== nodes.length) throw new Error("The input contains duplicate object identifiers.");
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const boxes = new Map<string, ShapeElement>();
  nodes.forEach((node, index) => {
    const details = [node.kind, node.detail].filter(Boolean).join("\n");
    const label = [node.title.slice(0, 120), details.slice(0, 1500)].filter(Boolean).join("\n");
    const width = Math.max(190, Math.min(300, 56 + Math.max(...label.split("\n").map(line => line.length), 0) * 7));
    const height = Math.max(76, 42 + label.split("\n").length * 21);
    boxes.set(node.key, {
      type: "rectangle", id: makeId(prefix), x: (index % columns) * 340, y: Math.floor(index / columns) * 240,
      w: width, h: height, color: node.status === "drift" || node.status === "delete" ? "#b42318" : node.status === "create" ? "#16804a" : node.status === "update" ? "#a15c00" : "#56616d", thickness: 1.6, fillColor: node.status === "drift" ? "#fff1f0" : node.status === "delete" ? "#fff5f4" : node.status === "create" ? "#effaf3" : node.status === "update" ? "#fff8e8" : "#ffffff",
      label: { text: label, color: "#202b36", fontSize: 13, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "middle", offsetX: 10, offsetY: 2 },
    });
  });
  const anchor = (from: ShapeElement, to: ShapeElement) => {
    const dx = to.x + to.w / 2 - (from.x + from.w / 2); const dy = to.y + to.h / 2 - (from.y + from.h / 2);
    return Math.abs(dx) > Math.abs(dy) ? { x: dx > 0 ? 1 : 0, y: .5 } : { x: .5, y: dy > 0 ? 1 : 0 };
  };
  const edges: ShapeElement[] = [];
  for (const link of links) {
    const from = boxes.get(link.from); const to = boxes.get(link.to);
    if (!from || !to || from === to) continue;
    const start = anchor(from, to); const end = anchor(to, from);
    const edge: ShapeElement = {
      type: "arrow", id: makeId(`${prefix}-link`), x: from.x + from.w * start.x, y: from.y + from.h * start.y,
      w: to.x + to.w * end.x - (from.x + from.w * start.x), h: to.y + to.h * end.y - (from.y + from.h * start.y),
      color: "#718091", thickness: 1.5, startHead: "none", endHead: "solid",
      startBinding: { elementId: from.id!, anchor: start }, endBinding: { elementId: to.id!, anchor: end },
    };
    if (link.label) edge.label = { text: link.label.slice(0, 160), color: "#435160", fontSize: 11, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" };
    edges.push(edge);
  }
  return [...edges, ...boxes.values()];
}

/** Generate editable cards from JSON graph data or record arrays. */
export function jsonToDiagram(source: string): Element[] {
  if (source.length > 5_000_000) throw new Error("JSON input is limited to 5 MB.");
  let root: unknown;
  try { root = JSON.parse(source); } catch { throw new Error("The selected JSON file is not valid JSON."); }
  const rootObject = objectValue(root);
  const explicitNodes = rootObject && Array.isArray(rootObject.nodes) ? rootObject.nodes : Array.isArray(root) ? root : undefined;
  if (explicitNodes) {
    const nodes: GraphNode[] = []; const idByString = new Map<string, string>(); const links: GraphLink[] = [];
    for (const [index, raw] of explicitNodes.entries()) {
      const item = objectValue(raw); if (!item) continue;
      const key = stringValue(item.id ?? item.key) || String(index + 1);
      if (idByString.has(key)) throw new Error(`JSON contains duplicate node ID "${key}".`);
      const title = titleFor(item, key);
      const detail = Object.entries(item).filter(([name, value]) => !["id", "key", "name", "title", "label", "from", "to", "source", "target", "edges", "links"].includes(name.toLowerCase()) && ["string", "number", "boolean"].includes(typeof value)).slice(0, 12).map(([name, value]) => `${name}: ${stringValue(value)}`).join("\n");
      const nodeKey = `json:${key}`; idByString.set(key, nodeKey); nodes.push({ key: nodeKey, title, detail });
    }
    const rawLinks = rootObject && Array.isArray(rootObject.edges) ? rootObject.edges : rootObject && Array.isArray(rootObject.links) ? rootObject.links : [];
    for (const raw of rawLinks) {
      const item = objectValue(raw); if (!item) continue;
      const from = stringValue(item.from ?? item.source); const to = stringValue(item.to ?? item.target);
      if (from && to) links.push({ from: idByString.get(from) ?? `json:${from}`, to: idByString.get(to) ?? `json:${to}`, label: stringValue(item.label ?? item.type) });
    }
    if (rootObject && Array.isArray(rootObject.nodes)) return graphToElements(nodes, links, "json");
    const keys = new Set(nodes.map(item => item.key));
    for (const raw of explicitNodes) {
      const item = objectValue(raw); if (!item) continue;
      const from = idByString.get(stringValue(item.id ?? item.key)) ?? "";
      for (const [name, value] of Object.entries(item)) {
        if (!/(?:_id|Id|Ref|Reference|Parent)$/i.test(name)) continue;
        const refs = Array.isArray(value) ? value : [value];
        for (const ref of refs) { const to = idByString.get(stringValue(ref)); if (from && to && keys.has(to)) links.push({ from, to, label: name.replace(/[_-]?id$/i, "") }); }
      }
    }
    return graphToElements(nodes, links, "json");
  }
  if (!rootObject) throw new Error("JSON must contain an array of objects or a graph object with a nodes array.");
  const collections = Object.entries(rootObject).filter(([, value]) => Array.isArray(value) && (value as unknown[]).some(item => objectValue(item)));
  if (!collections.length) throw new Error("JSON must contain a records array or a graph object with nodes and edges.");
  const nodes: GraphNode[] = []; const ids = new Map<string, string>(); const links: GraphLink[] = [];
  for (const [collection, records] of collections) for (const [index, raw] of (records as unknown[]).entries()) {
    const item = objectValue(raw); if (!item) continue;
    const rawId = stringValue(item.id ?? item.key) || `${collection}-${index + 1}`; const key = `${collection}:${rawId}`;
    const detail = Object.entries(item).filter(([name, value]) => !["id", "key", "name", "title", "label"].includes(name.toLowerCase()) && ["string", "number", "boolean"].includes(typeof value)).slice(0, 10).map(([name, value]) => `${name}: ${stringValue(value)}`).join("\n");
    ids.set(`${collection}:${rawId}`, key); ids.set(rawId, key);
    nodes.push({ key, title: titleFor(item, rawId), kind: collection, detail });
  }
  for (const [collection, records] of collections) for (const raw of records as unknown[]) {
    const item = objectValue(raw); if (!item) continue;
    const fromId = stringValue(item.id ?? item.key);
    const from = ids.get(`${collection}:${fromId}`) ?? ids.get(fromId);
    for (const [name, value] of Object.entries(item)) {
      if (!/(?:_id|Id|Ref|Reference|Parent)$/i.test(name)) continue;
      for (const ref of Array.isArray(value) ? value : [value]) { const to = ids.get(stringValue(ref)); if (from && to && from !== to) links.push({ from, to, label: name.replace(/[_-]?id$/i, "") }); }
    }
  }
  return graphToElements(nodes, links, "json");
}

type TerraformBlock = { kind: string; type: string; name: string; body: string; key: string; title: string; detail: string };

function findBlockEnd(source: string, openAt: number): number {
  let depth = 1; let quote = false; let escaped = false; let lineComment = false; let blockComment = false; let heredoc: string | undefined;
  for (let index = openAt + 1; index < source.length; index++) {
    const char = source[index]; const next = source[index + 1];
    if (heredoc) {
      if (index === 0 || source[index - 1] === "\n") {
        const lineEnd = source.indexOf("\n", index); const line = source.slice(index, lineEnd < 0 ? source.length : lineEnd).replace(/\r$/, "").trim();
        if (line === heredoc) { heredoc = undefined; if (lineEnd < 0) break; index = lineEnd; }
      }
      continue;
    }
    if (lineComment) { if (char === "\n") lineComment = false; continue; }
    if (blockComment) { if (char === "*" && next === "/") { blockComment = false; index++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quote = false; continue; }
    if (char === '"') { quote = true; continue; }
    if (char === "<" && next === "<") {
      const start = source.slice(index).match(/^<<-?([A-Za-z_][\w-]*)[ \t]*\r?\n/);
      if (start) { heredoc = start[1]; index += start[0].length - 1; continue; }
    }
    if ((char === "#") || (char === "/" && next === "/")) { lineComment = true; if (char === "/") index++; continue; }
    if (char === "/" && next === "*") { blockComment = true; index++; continue; }
    if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return index;
  }
  return -1;
}

/** Import Terraform resource/data/module blocks as a dependency diagram. Supports HCL blocks and .tf.json blocks. */
export function terraformToDiagram(source: string): Element[] {
  if (source.length > 5_000_000) throw new Error("Terraform input is limited to 5 MB.");
  if (/^\s*\{/.test(source)) {
    let parsed: unknown;
    try { parsed = JSON.parse(source); } catch { throw new Error("The Terraform JSON file is not valid JSON."); }
    const root = objectValue(parsed) ?? {};
    if (Array.isArray(root.resource_changes) || Array.isArray(root.resource_drift) || objectValue(root.values)?.root_module) return terraformSnapshotToDiagram(root);
  }
  const blocks: TerraformBlock[] = [];
  if (/^\s*\{/.test(source) && /"(?:resource|data|module)"\s*:/.test(source)) {
    let root: unknown; try { root = JSON.parse(source); } catch { throw new Error("The Terraform JSON file is not valid JSON."); }
    const top = objectValue(root) ?? {}; const resources = objectValue(top.resource) ?? {}; const datas = objectValue(top.data) ?? {};
    for (const [type, names] of Object.entries(resources)) for (const [name, config] of Object.entries(objectValue(names) ?? {})) blocks.push({ kind: "resource", type, name, body: JSON.stringify(config), key: `${type}.${name}`, title: `${type}.${name}`, detail: "Terraform resource" });
    for (const [type, names] of Object.entries(datas)) for (const [name, config] of Object.entries(objectValue(names) ?? {})) blocks.push({ kind: "data", type, name, body: JSON.stringify(config), key: `data.${type}.${name}`, title: `data.${type}.${name}`, detail: "Terraform data source" });
    for (const [name, config] of Object.entries(objectValue(top.module) ?? {})) blocks.push({ kind: "module", type: "module", name, body: JSON.stringify(config), key: `module.${name}`, title: `module.${name}`, detail: "Terraform module" });
  } else {
    const pattern = /^\s*(?:(resource|data)\s+"([^"\r\n]+)"\s+"([^"\r\n]+)"|module\s+"([^"\r\n]+)")\s*\{/gm;
    for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
      if (blocks.length >= 500) throw new Error("Terraform diagrams are limited to 500 resource blocks.");
      const openAt = pattern.lastIndex - 1; const end = findBlockEnd(source, openAt);
      const kind = match[1] ?? "module"; const type = match[2] ?? "module"; const name = match[4] ?? match[3] ?? "";
      if (end < 0) throw new Error(`Terraform block ${type}.${name} is missing a closing brace.`);
      const body = source.slice(openAt + 1, end);
      const attributes = [...body.matchAll(/^\s*([A-Za-z_][\w-]*)\s*=\s*(.+?)\s*$/gm)].map(item => `${item[1]}: ${item[2].replace(/\s+#.*$/, "").slice(0, 100)}`).slice(0, 8);
      blocks.push({ kind, type, name, body, key: kind === "module" ? `module.${name}` : kind === "data" ? `data.${type}.${name}` : `${type}.${name}`, title: `${kind === "module" ? "module" : kind === "data" ? `data.${type}` : type}.${name}`, detail: [kind === "module" ? "Terraform module" : kind === "data" ? "Data source" : "Resource", ...attributes].join("\n") });
      pattern.lastIndex = end + 1;
    }
  }
  if (!blocks.length) throw new Error("No Terraform resource, data, or module blocks were found.");
  if (blocks.length > 500) throw new Error("Terraform diagrams are limited to 500 resource blocks.");
  const address = new Map(blocks.map(item => [item.key, item.key])); const links: GraphLink[] = [];
  for (const block of blocks) {
    const referencePattern = /\b((?:data\.)?[A-Za-z_][\w-]*)\.([A-Za-z_][\w-]*)(?:\.(?:[A-Za-z_][\w-]*|\*))?/g;
    for (const reference of block.body.matchAll(referencePattern)) {
      const key = `${reference[1]}.${reference[2]}`;
      if (key !== block.key && address.has(key)) links.push({ from: block.key, to: key, label: "depends on" });
    }
  }
  const uniqueLinks = [...new Map(links.map(link => [`${link.from}|${link.to}`, link])).values()];
  return graphToElements(blocks.map(({ key, title, detail }) => ({ key, title, detail })), uniqueLinks, "terraform");
}

function terraformSnapshotToDiagram(root: Record<string, unknown>): Element[] {
  type SnapshotResource = { address: string; type: string; name: string; mode?: string; values?: Record<string, unknown>; dependsOn?: string[] };
  const resources: SnapshotResource[] = [];
  const collectModule = (module: unknown) => {
    const value = objectValue(module); if (!value) return;
    for (const raw of Array.isArray(value.resources) ? value.resources : []) {
      const item = objectValue(raw); if (!item) continue;
      const address = stringValue(item.address) || `${stringValue(item.type)}.${stringValue(item.name)}`;
      if (!address) continue;
      resources.push({ address, type: stringValue(item.type) || "resource", name: stringValue(item.name) || address, mode: stringValue(item.mode), values: objectValue(item.values), dependsOn: Array.isArray(item.depends_on) ? item.depends_on.map(stringValue).filter(Boolean) : [] });
    }
    for (const child of Array.isArray(value.child_modules) ? value.child_modules : []) collectModule(child);
  };
  const plannedValues = objectValue(root.planned_values); const stateValues = objectValue(root.values);
  collectModule(plannedValues?.root_module ?? stateValues?.root_module);
  const drift = new Map<string, Record<string, unknown>>();
  for (const item of Array.isArray(root.resource_drift) ? root.resource_drift : []) { const record = objectValue(item); if (record?.address) drift.set(stringValue(record.address), record); }
  const changes = new Map<string, Record<string, unknown>>();
  for (const item of Array.isArray(root.resource_changes) ? root.resource_changes : []) { const record = objectValue(item); if (record?.address) changes.set(stringValue(record.address), record); }
  for (const item of [...changes.values(), ...drift.values()]) {
    const address = stringValue(item.address); if (!resources.some(resource => resource.address === address)) resources.push({ address, type: stringValue(item.type) || "resource", name: stringValue(item.name) || address, mode: stringValue(item.mode) });
  }
  const nodes = resources.slice(0, 500).map(resource => {
    const change = changes.get(resource.address); const driftEntry = drift.get(resource.address);
    const actions = objectValue(change?.change)?.actions ?? objectValue(driftEntry?.change)?.actions;
    const actionList = Array.isArray(actions) ? actions.map(stringValue) : [];
    const status = driftEntry ? "drift" as const : actionList.includes("delete") ? "delete" as const : actionList.includes("create") ? "create" as const : actionList.includes("update") || actionList.includes("read") ? "update" as const : undefined;
    const changeBody = objectValue(change?.change) ?? objectValue(driftEntry?.change);
    const before = objectValue(changeBody?.before) ?? {}; const after = objectValue(changeBody?.after) ?? {};
    const changedKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])).slice(0, 12);
    const valueSummary = Object.entries(resource.values ?? {}).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).slice(0, 5).map(([key, value]) => `${key}: ${stringValue(value)}`);
    const detail = [resource.mode === "data" ? "Data source" : "Terraform resource", status ? `${driftEntry ? "Drift detected" : "Planned action"}: ${driftEntry ? "out-of-band change" : actionList.join(" then ") || status}` : "Present in state", ...changedKeys.map(key => `${key}: ${stringValue(before[key]).slice(0, 80)} → ${stringValue(after[key]).slice(0, 80)}`), ...valueSummary].slice(0, 18).join("\n");
    return { key: resource.address, title: resource.address, kind: resource.mode === "data" ? "Data source" : resource.type, detail, status };
  });
  if (resources.length > 500) throw new Error("Terraform plans and state files are limited to 500 resources.");
  const keys = new Set(nodes.map(node => node.key));
  const links = resources.flatMap(resource => (resource.dependsOn ?? []).filter(address => keys.has(address)).map(address => ({ from: resource.address, to: address, label: "depends on" })));
  return graphToElements(nodes, links, "terraform-snapshot");
}

/** Import Kubernetes YAML/JSON resources and common selector, owner, secret, and storage relationships. */
export function kubernetesToDiagram(source: string): Element[] {
  if (source.length > 5_000_000) throw new Error("Kubernetes manifest input is limited to 5 MB.");
  let documents: unknown[];
  try {
    const parsed = parseAllDocuments(source);
    if (parsed.length > 500 || parsed.some(document => document.errors.length)) throw new Error("Kubernetes YAML contains a parse error or more than 500 documents.");
    documents = parsed.map(document => document.toJS({ maxAliasCount: 100 }));
  } catch { throw new Error("The Kubernetes YAML or JSON file could not be parsed."); }
  if (!documents.length) throw new Error("The Kubernetes file contains no manifest documents.");
  const resources: { key: string; kind: string; namespace: string; name: string; raw: Record<string, unknown> }[] = [];
  const namespaces = new Set<string>(); const namespaceLabels = new Map<string, Record<string, unknown>>();
  for (const doc of documents) {
    const raw = objectValue(doc); const metadata = objectValue(raw?.metadata);
    const kind = stringValue(raw?.kind); const name = stringValue(metadata?.name);
    if (!kind || !name) continue;
    if (kind === "Namespace") { namespaces.add(name); namespaceLabels.set(name, objectValue(metadata?.labels) ?? {}); continue; }
    const namespace = stringValue(metadata?.namespace) || "default";
    namespaces.add(namespace);
    resources.push({ key: `${kind}/${namespace}/${name}`, kind, namespace, name, raw: raw! });
  }
  if (!resources.length) throw new Error("Kubernetes manifests need kind and metadata.name fields.");
  if (resources.length > 500) throw new Error("Kubernetes diagrams are limited to 500 resources.");
  const byName = new Map(resources.map(item => [`${item.kind}/${item.namespace}/${item.name}`, item.key]));
  const find = (kind: string, name: string, namespace = "default") => byName.get(`${kind}/${namespace}/${name}`);
  const links: GraphLink[] = [];
  const add = (from: string, to: string | undefined, label: string) => { if (to && from !== to) links.push({ from, to, label }); };
  const labels = (item: Record<string, unknown>) => objectValue(objectValue(item.metadata)?.labels) ?? {};
  const workload = (item: typeof resources[number]) => objectValue(objectValue(item.raw.spec)?.template);
  const selectorMatches = (actual: Record<string, unknown>, selector: Record<string, unknown> | undefined) => {
    if (!selector) return true;
    const matchLabels = objectValue(selector.matchLabels) ?? {};
    if (!Object.entries(matchLabels).every(([key, value]) => actual[key] === value)) return false;
    const expressions = Array.isArray(selector.matchExpressions) ? selector.matchExpressions.map(objectValue).filter(Boolean) as Record<string, unknown>[] : [];
    return expressions.every(expression => {
      const key = stringValue(expression.key); const values = Array.isArray(expression.values) ? expression.values.map(stringValue) : [];
      const exists = Object.prototype.hasOwnProperty.call(actual, key); const value = stringValue(actual[key]);
      if (expression.operator === "In") return exists && values.includes(value);
      if (expression.operator === "NotIn") return !exists || !values.includes(value);
      if (expression.operator === "Exists") return exists;
      if (expression.operator === "DoesNotExist") return !exists;
      return false;
    });
  };
  const matchingWorkloads = (podSelector: Record<string, unknown> | undefined, namespaceSelector?: Record<string, unknown>) => resources.filter(candidate => {
    if (!/^(?:Deployment|StatefulSet|DaemonSet|ReplicaSet|Pod|Job|CronJob)$/.test(candidate.kind)) return false;
    if (namespaceSelector && !selectorMatches(namespaceLabels.get(candidate.namespace) ?? {}, namespaceSelector)) return false;
    return selectorMatches(labels(candidate.kind === "Pod" ? candidate.raw : workload(candidate) ?? {}), podSelector);
  });
  for (const resource of resources) {
    const spec = objectValue(resource.raw.spec) ?? {};
    const ownerRefs = Array.isArray(objectValue(resource.raw.metadata)?.ownerReferences) ? objectValue(resource.raw.metadata)!.ownerReferences as unknown[] : [];
    for (const ownerRef of ownerRefs) { const owner = objectValue(ownerRef); add(resource.key, find(stringValue(owner?.kind), stringValue(owner?.name), resource.namespace), "owned by"); }
    if (resource.kind === "Service") {
      const selector = objectValue(spec.selector);
      if (selector) for (const candidate of resources) {
        if (!/^(?:Deployment|StatefulSet|DaemonSet|ReplicaSet|Pod)$/.test(candidate.kind) || candidate.namespace !== resource.namespace) continue;
        const podLabels = labels(candidate.kind === "Pod" ? candidate.raw : workload(candidate) ?? {});
        if (Object.entries(selector).every(([key, value]) => podLabels[key] === value)) add(resource.key, candidate.key, "selects");
      }
    }
    const template = workload(resource); const podSpec = objectValue(objectValue(template?.spec)?.template) ?? objectValue(template?.spec) ?? (resource.kind === "Pod" ? spec : undefined);
    const pod = objectValue(podSpec);
    if (pod) {
      const containers = [...(Array.isArray(pod.containers) ? pod.containers : []), ...(Array.isArray(pod.initContainers) ? pod.initContainers : [])].map(objectValue).filter((item): item is Record<string, unknown> => !!item);
      for (const container of containers) {
        for (const envFrom of (Array.isArray(container.envFrom) ? container.envFrom : []).map(objectValue).filter(Boolean) as Record<string, unknown>[]) {
          const cm = objectValue(envFrom.configMapRef); const secret = objectValue(envFrom.secretRef);
          add(resource.key, cm ? find("ConfigMap", stringValue(cm.name), resource.namespace) : undefined, "uses config");
          add(resource.key, secret ? find("Secret", stringValue(secret.name), resource.namespace) : undefined, "uses secret");
        }
        for (const env of (Array.isArray(container.env) ? container.env : []).map(objectValue).filter(Boolean) as Record<string, unknown>[]) {
          const ref = objectValue(objectValue(env.valueFrom)?.configMapKeyRef); const secret = objectValue(objectValue(env.valueFrom)?.secretKeyRef);
          add(resource.key, ref ? find("ConfigMap", stringValue(ref.name), resource.namespace) : undefined, "reads config");
          add(resource.key, secret ? find("Secret", stringValue(secret.name), resource.namespace) : undefined, "reads secret");
        }
      }
      for (const volume of (Array.isArray(pod.volumes) ? pod.volumes : []).map(objectValue).filter(Boolean) as Record<string, unknown>[]) {
        const cm = objectValue(volume.configMap); const secret = objectValue(volume.secret); const claim = objectValue(volume.persistentVolumeClaim);
        add(resource.key, cm ? find("ConfigMap", stringValue(cm.name), resource.namespace) : undefined, "mounts config");
        add(resource.key, secret ? find("Secret", stringValue(secret.secretName), resource.namespace) : undefined, "mounts secret");
        add(resource.key, claim ? find("PersistentVolumeClaim", stringValue(claim.claimName), resource.namespace) : undefined, "mounts volume");
      }
    }
    if (resource.kind === "Ingress") {
      const rules = Array.isArray(spec.rules) ? spec.rules.map(objectValue).filter(Boolean) as Record<string, unknown>[] : [];
      for (const rule of rules) {
        const http = objectValue(rule.http); const paths = Array.isArray(http?.paths) ? http.paths.map(objectValue).filter(Boolean) as Record<string, unknown>[] : [];
        for (const path of paths) { const service = objectValue(objectValue(path.backend)?.service); add(resource.key, service ? find("Service", stringValue(service.name), resource.namespace) : undefined, "routes to"); }
      }
      add(resource.key, find("IngressClass", stringValue(spec.ingressClassName), resource.namespace), "uses ingress class");
    }
    if (resource.kind === "PersistentVolumeClaim") {
      add(resource.key, find("StorageClass", stringValue(spec.storageClassName), resource.namespace), "uses storage class");
      const claimName = resource.name; const claimNamespace = resource.namespace;
      for (const volume of resources.filter(candidate => candidate.kind === "PersistentVolume")) {
        const claim = objectValue(objectValue(volume.raw.spec)?.claimRef);
        if (stringValue(claim?.name) === claimName && (!stringValue(claim?.namespace) || stringValue(claim?.namespace) === claimNamespace)) add(resource.key, volume.key, "bound to volume");
      }
    }
    if (resource.kind === "PersistentVolume") add(resource.key, find("StorageClass", stringValue(spec.storageClassName), resource.namespace), "uses storage class");
    if (resource.kind === "NetworkPolicy") {
      const selector = objectValue(spec.podSelector) ?? {};
      const selected = matchingWorkloads(selector).filter(candidate => candidate.namespace === resource.namespace);
      for (const candidate of selected) add(resource.key, candidate.key, "applies to");
      const peerTargets = (peer: Record<string, unknown>) => resources.filter(candidate => {
        if (!/^(?:Deployment|StatefulSet|DaemonSet|ReplicaSet|Pod|Job|CronJob)$/.test(candidate.kind)) return false;
        const namespaceSelector = objectValue(peer.namespaceSelector); const podSelector = objectValue(peer.podSelector);
        if (namespaceSelector && !selectorMatches(namespaceLabels.get(candidate.namespace) ?? {}, namespaceSelector)) return false;
        if (!podSelector && !namespaceSelector && candidate.namespace !== resource.namespace) return false;
        return selectorMatches(labels(candidate.kind === "Pod" ? candidate.raw : workload(candidate) ?? {}), podSelector);
      });
      for (const [index, ruleRaw] of (Array.isArray(spec.ingress) ? spec.ingress : []).entries()) {
        const rule = objectValue(ruleRaw); if (!rule) continue;
        const peers = Array.isArray(rule.from) ? rule.from.map(objectValue).filter(Boolean) as Record<string, unknown>[] : [];
        for (const peer of peers) for (const candidate of peerTargets(peer)) add(candidate.key, resource.key, `ingress allowed by policy ${index + 1}`);
      }
      for (const [index, ruleRaw] of (Array.isArray(spec.egress) ? spec.egress : []).entries()) {
        const rule = objectValue(ruleRaw); if (!rule) continue;
        const peers = Array.isArray(rule.to) ? rule.to.map(objectValue).filter(Boolean) as Record<string, unknown>[] : [];
        for (const peer of peers) for (const candidate of peerTargets(peer)) add(resource.key, candidate.key, `egress allowed by policy ${index + 1}`);
      }
    }
  }
  const namespaceNodes = [...namespaces].map(namespace => ({ key: `namespace/${namespace}`, title: namespace, kind: "Kubernetes namespace boundary" }));
  for (const resource of resources) links.push({ from: `namespace/${resource.namespace}`, to: resource.key, label: "contains" });
  const uniqueLinks = [...new Map(links.map(link => [`${link.from}|${link.to}|${link.label}`, link])).values()];
  const resourceNodes = resources.map(item => ({ key: item.key, title: item.name, kind: `${item.kind} · ${item.namespace}`, detail: stringValue(objectValue(item.raw.metadata)?.labels ? Object.entries(objectValue(objectValue(item.raw.metadata)?.labels)!).map(([key, value]) => `${key}=${stringValue(value)}`).join("\n") : "") }));
  return graphToElements([...namespaceNodes, ...resourceNodes], uniqueLinks, "k8s");
}

function parseYamlRoot(source: string, message: string): unknown {
  if (source.length > 5_000_000) throw new Error("Structured import input is limited to 5 MB.");
  try {
    const documents = parseAllDocuments(source, { customTags: cloudFormationTags });
    if (documents.length > 500 || documents.some(document => document.errors.length)) throw new Error(message);
    return documents.map(document => document.toJS({ maxAliasCount: 100 })).filter(value => value !== null && value !== undefined);
  } catch { throw new Error(message); }
}

/** Convert Docker Compose services, networks, volumes and dependency declarations into editable nodes. */
export function dockerComposeToDiagram(source: string): Element[] {
  const parsed = parseYamlRoot(source, "The Docker Compose YAML could not be parsed.");
  const root = objectValue(Array.isArray(parsed) ? parsed[0] : parsed) ?? {};
  const services = objectValue(root.services);
  if (!services) throw new Error("Docker Compose input needs a services mapping.");
  const nodes: GraphNode[] = []; const links: GraphLink[] = []; const serviceNames = new Set(Object.keys(services));
  for (const [name, raw] of Object.entries(services)) {
    const service = objectValue(raw) ?? {}; const depends = Array.isArray(service.depends_on) ? service.depends_on.map(stringValue) : Object.keys(objectValue(service.depends_on) ?? {});
    const networks = Array.isArray(service.networks) ? service.networks.map(stringValue) : Object.keys(objectValue(service.networks) ?? {});
    const volumes = Array.isArray(service.volumes) ? service.volumes.map(stringValue) : [];
    nodes.push({ key: `service:${name}`, title: name, kind: "Docker Compose service", detail: [stringValue(service.image) ? `Image: ${stringValue(service.image)}` : "", stringValue(service.build) ? `Build: ${stringValue(service.build)}` : "", stringValue(service.ports) ? `Ports: ${stringValue(service.ports)}` : "", stringValue(service.restart) ? `Restart: ${stringValue(service.restart)}` : ""].filter(Boolean).join("\n") });
    for (const dependency of depends) if (serviceNames.has(dependency)) links.push({ from: `service:${name}`, to: `service:${dependency}`, label: "depends on" });
    for (const network of networks) { const key = `network:${network}`; if (!nodes.some(node => node.key === key)) nodes.push({ key, title: network, kind: "Compose network" }); links.push({ from: `service:${name}`, to: key, label: "joins" }); }
    for (const mount of volumes) {
      const volume = mount.split(":")[0]?.trim(); if (!volume || volume.startsWith(".") || volume.startsWith("/")) continue;
      const key = `volume:${volume}`; if (!nodes.some(node => node.key === key)) nodes.push({ key, title: volume, kind: "Compose volume" }); links.push({ from: `service:${name}`, to: key, label: "mounts" });
    }
  }
  if (nodes.length > 500) throw new Error("Docker Compose diagrams are limited to 500 services, networks, and volumes.");
  for (const [name] of Object.entries(objectValue(root.networks) ?? {})) if (!nodes.some(node => node.key === `network:${name}`)) nodes.push({ key: `network:${name}`, title: name, kind: "Compose network" });
  for (const [name] of Object.entries(objectValue(root.volumes) ?? {})) if (!nodes.some(node => node.key === `volume:${name}`)) nodes.push({ key: `volume:${name}`, title: name, kind: "Compose volume" });
  return graphToElements(nodes, links, "compose");
}

/** Convert Ansible plays, tasks, handlers and roles into a readable execution graph. */
export function ansibleToDiagram(source: string): Element[] {
  const parsed = parseYamlRoot(source, "The Ansible playbook YAML could not be parsed.");
  const plays = Array.isArray(parsed) ? parsed : [parsed]; const nodes: GraphNode[] = []; const links: GraphLink[] = [];
  for (const [playIndex, raw] of plays.entries()) {
    const play = objectValue(raw); if (!play) continue;
    const playName = stringValue(play.name) || `Play ${playIndex + 1}`; const playKey = `play:${playIndex}:${playName}`;
    nodes.push({ key: playKey, title: playName, kind: "Ansible play", detail: `Hosts: ${stringValue(play.hosts) || "all"}${Array.isArray(play.roles) ? `\nRoles: ${play.roles.map(stringValue).join(", ")}` : ""}` });
    for (const section of ["pre_tasks", "tasks", "post_tasks", "handlers"] as const) {
      const tasks = Array.isArray(play[section]) ? play[section] as unknown[] : [];
      let previous: string | undefined;
      for (const [taskIndex, rawTask] of tasks.entries()) {
        const task = objectValue(rawTask); if (!task) continue;
        const name = stringValue(task.name) || `${section} ${taskIndex + 1}`; const module = Object.keys(task).find(key => !["name", "when", "tags", "register", "become", "notify", "loop", "with_items", "vars", "delegate_to", "ignore_errors"].includes(key) && !key.startsWith("_") );
        const key = `task:${playIndex}:${section}:${taskIndex}`;
        nodes.push({ key, title: name, kind: `Ansible ${section === "handlers" ? "handler" : "task"}`, detail: [module ? `Module: ${module}` : "", stringValue(task.when) ? `When: ${stringValue(task.when)}` : "", Array.isArray(task.tags) ? `Tags: ${task.tags.map(stringValue).join(", ")}` : ""].filter(Boolean).join("\n") });
        links.push({ from: playKey, to: key, label: section });
        if (previous) links.push({ from: previous, to: key, label: "next" });
        previous = key;
      }
    }
  }
  if (!nodes.some(node => node.kind === "Ansible task" || node.kind === "Ansible handler")) throw new Error("Ansible playbooks need one or more plays with tasks or handlers.");
  if (nodes.length > 500) throw new Error("Ansible imports are limited to 500 plays and tasks.");
  return graphToElements(nodes, links, "ansible");
}

/** Convert OpenAPI path operations and component schemas into editable API maps. */
export function openApiToDiagram(source: string): Element[] {
  const parsed = parseYamlRoot(source, "The OpenAPI YAML or JSON could not be parsed.");
  const root = objectValue(Array.isArray(parsed) ? parsed[0] : parsed) ?? {};
  if (!stringValue(root.openapi) && !stringValue(root.swagger)) throw new Error("OpenAPI input needs an openapi or swagger version field.");
  const paths = objectValue(root.paths) ?? {}; const nodes: GraphNode[] = []; const links: GraphLink[] = [];
  for (const [path, rawPath] of Object.entries(paths)) {
    const pathItem = objectValue(rawPath) ?? {};
    for (const [method, rawOperation] of Object.entries(pathItem)) {
      if (!/^(get|post|put|patch|delete|head|options|trace)$/i.test(method)) continue;
      const operation = objectValue(rawOperation) ?? {}; const key = `operation:${method.toUpperCase()}:${path}`;
      const params = Array.isArray(operation.parameters) ? operation.parameters.length : 0;
      const responses = objectValue(operation.responses) ?? {};
      nodes.push({ key, title: `${method.toUpperCase()} ${path}`, kind: "OpenAPI operation", detail: [stringValue(operation.summary), stringValue(operation.operationId) ? `ID: ${stringValue(operation.operationId)}` : "", params ? `Parameters: ${params}` : "", `Responses: ${Object.keys(responses).slice(0, 8).join(", ")}`].filter(Boolean).join("\n") });
      const references = JSON.stringify(operation).matchAll(/#\/components\/schemas\/([^"/]+)/g);
      for (const reference of references) links.push({ from: key, to: `schema:${reference[1]}`, label: "uses schema" });
    }
  }
  const schemas = objectValue(objectValue(root.components)?.schemas) ?? objectValue(objectValue(root.definitions)) ?? {};
  for (const [name, rawSchema] of Object.entries(schemas)) {
    const schema = objectValue(rawSchema) ?? {}; const properties = objectValue(schema.properties) ?? {};
    const required = Array.isArray(schema.required) ? new Set(schema.required.map(stringValue)) : new Set<string>();
    const fields = Object.entries(properties).slice(0, 30).map(([field, value]) => `${required.has(field) ? "*" : ""}${field}: ${stringValue(objectValue(value)?.type) || "object"}`);
    nodes.push({ key: `schema:${name}`, title: name, kind: "OpenAPI schema", detail: fields.join("\n") });
    for (const reference of JSON.stringify(schema).matchAll(/#\/(?:components\/schemas|definitions)\/([^"/]+)/g)) links.push({ from: `schema:${name}`, to: `schema:${reference[1]}`, label: "references" });
  }
  if (!nodes.length) throw new Error("The OpenAPI document contains no path operations or component schemas.");
  if (nodes.length > 500) throw new Error("OpenAPI diagrams are limited to 500 operations and schemas.");
  return graphToElements(nodes, links, "openapi");
}

/** Import AWS CloudFormation and AWS CDK synthesized templates. */
export function cloudFormationToDiagram(source: string): Element[] {
  const parsed = parseYamlRoot(source, "The CloudFormation or CDK template could not be parsed.");
  const root = objectValue(Array.isArray(parsed) ? parsed[0] : parsed) ?? {};
  const resources = objectValue(root.Resources ?? root.resources);
  if (!resources || !Object.keys(resources).length) throw new Error("CloudFormation and CDK templates need a Resources mapping.");
  const nodes: GraphNode[] = []; const links: GraphLink[] = []; const keys = new Set(Object.keys(resources));
  const references = (value: unknown, output: Set<string>) => {
    if (Array.isArray(value)) { value.forEach(item => references(item, output)); return; }
    const record = objectValue(value); if (!record) return;
    const ref = stringValue(record.Ref);
    if (keys.has(ref)) output.add(ref);
    const getAtt = record["Fn::GetAtt"];
    const attribute = typeof getAtt === "string" ? getAtt.split(".")[0] : Array.isArray(getAtt) ? stringValue(getAtt[0]) : "";
    if (keys.has(attribute)) output.add(attribute);
    const sub = stringValue(record["Fn::Sub"]);
    for (const match of sub.matchAll(/\$\{([A-Za-z][\w-]*)(?:\.[^}]+)?\}/g)) if (keys.has(match[1])) output.add(match[1]);
    Object.values(record).forEach(item => references(item, output));
  };
  for (const [logicalId, raw] of Object.entries(resources)) {
    const resource = objectValue(raw); if (!resource) continue;
    const type = stringValue(resource.Type) || "AWS resource"; const properties = objectValue(resource.Properties) ?? {};
    const resourceName = stringValue(properties.Name ?? properties.BucketName ?? properties.FunctionName ?? properties.TableName);
    const details = [type, resourceName && `Name: ${resourceName}`, stringValue(resource.Condition) && `Condition: ${stringValue(resource.Condition)}`].filter(Boolean).join("\n");
    const key = `cfn:${logicalId}`; nodes.push({ key, title: logicalId, kind: type, detail: details });
    const dependencies = new Set<string>();
    for (const dependency of Array.isArray(resource.DependsOn) ? resource.DependsOn : resource.DependsOn ? [resource.DependsOn] : []) if (keys.has(stringValue(dependency))) dependencies.add(stringValue(dependency));
    references(properties, dependencies);
    for (const dependency of dependencies) links.push({ from: key, to: `cfn:${dependency}`, label: "references" });
  }
  return graphToElements(nodes, links, "cloudformation");
}

/** Import Azure Resource Manager JSON templates, including nested deployments. */
export function azureArmToDiagram(source: string): Element[] {
  const parsed = parseYamlRoot(source, "The Azure ARM template could not be parsed.");
  const root = objectValue(Array.isArray(parsed) ? parsed[0] : parsed) ?? {};
  if (!Array.isArray(root.resources)) throw new Error("Azure ARM templates need a resources array.");
  const resources: { key: string; type: string; name: string; id: string; raw: Record<string, unknown> }[] = [];
  const collect = (items: unknown[], parent = "") => {
    for (const raw of items) {
      const item = objectValue(raw); if (!item) continue;
      const type = stringValue(item.type) || "Azure resource"; const name = stringValue(item.name) || `${type}-${resources.length + 1}`;
      const fullName = parent ? `${parent}/${name}` : name; const key = `${type}/${fullName}`;
      resources.push({ key, type, name: fullName, id: stringValue(item.id), raw: item });
      if (Array.isArray(item.resources)) collect(item.resources, fullName);
    }
  };
  collect(root.resources);
  if (!resources.length) throw new Error("The Azure ARM template contains no resources.");
  if (resources.length > 500) throw new Error("Azure ARM imports are limited to 500 resources.");
  const aliases = new Map<string, string>();
  for (const item of resources) for (const alias of [item.key, item.name, item.id].filter(Boolean)) aliases.set(alias.toLowerCase(), item.key);
  const nodes = resources.map(item => {
    const properties = objectValue(item.raw.properties) ?? {};
    const detail = [item.type, stringValue(item.raw.apiVersion) && `API: ${stringValue(item.raw.apiVersion)}`, ...Object.entries(properties).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).slice(0, 8).map(([name, value]) => `${name}: ${stringValue(value)}`)].join("\n");
    return { key: item.key, title: item.name, kind: item.type, detail };
  });
  const links: GraphLink[] = [];
  for (const item of resources) {
    const dependencies = Array.isArray(item.raw.dependsOn) ? item.raw.dependsOn : [];
    for (const dependency of dependencies) {
      const raw = stringValue(dependency).toLowerCase();
      const target = aliases.get(raw) ?? resources.find(candidate => raw.includes(candidate.name.toLowerCase()))?.key;
      if (target && target !== item.key) links.push({ from: item.key, to: target, label: "depends on" });
    }
    const body = JSON.stringify(item.raw.properties ?? {});
    for (const candidate of resources) if (candidate.key !== item.key && (body.includes(candidate.name) || candidate.id && body.includes(candidate.id))) links.push({ from: item.key, to: candidate.key, label: "references" });
  }
  return graphToElements(nodes, [...new Map(links.map(link => [`${link.from}|${link.to}|${link.label}`, link])).values()], "azure-arm");
}

/** Import Bicep resource declarations and simple dependsOn/resource-id references. */
export function bicepToDiagram(source: string): Element[] {
  if (source.length > 5_000_000) throw new Error("Bicep input is limited to 5 MB.");
  const declarations: { id: string; type: string; body: string }[] = [];
  const pattern = /^\s*resource\s+([A-Za-z_]\w*)\s+['"]([^'"]+)['"]\s*(?:existing\s*)?=\s*\{/gm;
  const findEnd = (open: number) => {
    let depth = 1; let quote = ""; let escape = false; let lineComment = false; let blockComment = false;
    for (let index = open + 1; index < source.length; index++) {
      const char = source[index]; const next = source[index + 1];
      if (lineComment) { if (char === "\n") lineComment = false; continue; }
      if (blockComment) { if (char === "*" && next === "/") { blockComment = false; index++; } continue; }
      if (quote) { if (escape) escape = false; else if (char === "\\") escape = true; else if (char === quote) quote = ""; continue; }
      if (char === "'" || char === '"') { quote = char; continue; }
      if (char === "/" && next === "/") { lineComment = true; index++; continue; }
      if (char === "/" && next === "*") { blockComment = true; index++; continue; }
      if (char === "{") depth++;
      else if (char === "}" && --depth === 0) return index;
    }
    return -1;
  };
  for (const match of source.matchAll(pattern)) {
    const open = (match.index ?? 0) + match[0].lastIndexOf("{"); const close = findEnd(open);
    if (close < 0) throw new Error(`Bicep resource "${match[1]}" has an unclosed body.`);
    declarations.push({ id: match[1], type: match[2], body: source.slice(open + 1, close) });
  }
  if (!declarations.length) throw new Error("Bicep input needs one or more resource declarations.");
  if (declarations.length > 500) throw new Error("Bicep imports are limited to 500 resources.");
  const ids = new Set(declarations.map(item => item.id));
  const nodes = declarations.map(item => {
    const name = /^\s*name\s*:\s*([^\r\n]+)/m.exec(item.body)?.[1]?.trim().replace(/,$/, "") ?? item.id;
    return { key: `bicep:${item.id}`, title: name.replace(/^['"]|['"]$/g, ""), kind: item.type, detail: item.type };
  });
  const links: GraphLink[] = [];
  for (const item of declarations) {
    const dependBlock = /\bdependsOn\s*:\s*\[([\s\S]*?)\]/m.exec(item.body)?.[1] ?? "";
    const dependencies = new Set([...dependBlock.matchAll(/\b([A-Za-z_]\w*)\b/g)].map(match => match[1]).filter(id => ids.has(id)));
    for (const reference of item.body.matchAll(/\b([A-Za-z_]\w*)\.(?:id|name|properties)\b/g)) if (ids.has(reference[1]) && reference[1] !== item.id) dependencies.add(reference[1]);
    for (const dependency of dependencies) links.push({ from: `bicep:${item.id}`, to: `bicep:${dependency}`, label: "depends on" });
  }
  return graphToElements(nodes, links, "bicep");
}

/** Detect supported infrastructure and API YAML formats by their top-level structure. */
export function structuredYamlToDiagram(source: string): Element[] {
  const parsed = parseYamlRoot(source, "The YAML file could not be parsed.");
  const first = objectValue(Array.isArray(parsed) ? parsed[0] : parsed) ?? {};
  if (stringValue(first.openapi) || stringValue(first.swagger)) return openApiToDiagram(source);
  if (objectValue(first.Resources) || objectValue(first.resources) && !Array.isArray(first.resources)) return cloudFormationToDiagram(source);
  if (Array.isArray(first.resources) && (stringValue(first.$schema).includes("deploymentTemplate") || first.contentVersion || objectValue(first.parameters))) return azureArmToDiagram(source);
  if (objectValue(first.services)) return dockerComposeToDiagram(source);
  if (Array.isArray(parsed) && parsed.some(item => { const play = objectValue(item); return !!play && (Array.isArray(play.tasks) || Array.isArray(play.pre_tasks)); })) return ansibleToDiagram(source);
  return kubernetesToDiagram(source);
}
