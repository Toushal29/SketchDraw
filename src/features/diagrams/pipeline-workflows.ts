import { parseAllDocuments } from "yaml";
import type { Element } from "../../model";
import { buildStructuredDiagram, type StructuredGraphLink, type StructuredGraphNode } from "./structured-data";

type RecordValue = Record<string, unknown>;
type PythonStatement = { text: string; indent: number; line: number };
const objectValue = (value: unknown): RecordValue | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
const stringValue = (value: unknown) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";

function logicalPythonStatements(source: string): PythonStatement[] {
  const result: PythonStatement[] = []; let current = ""; let indent = 0; let startLine = 0; let depth = 0; let quote = ""; let triple = false; let escaped = false;
  for (const [lineIndex, line] of source.split(/\r?\n/).entries()) {
    let visible = "";
    for (let index = 0; index < line.length; index++) {
      const char = line[index]; const next = line[index + 1] ?? ""; const third = line[index + 2] ?? "";
      if (quote) {
        visible += char;
        if (triple && char === quote && next === quote && third === quote) { visible += next + third; index += 2; quote = ""; triple = false; }
        else if (!triple && !escaped && char === quote) quote = "";
        if (char === "\\" && !escaped) escaped = true; else escaped = false;
        continue;
      }
      if (char === "#") break;
      if ((char === "'" || char === "\"") && next === char && third === char) { quote = char; triple = true; visible += char + next + third; index += 2; continue; }
      if (char === "'" || char === "\"") { quote = char; visible += char; continue; }
      if ("([{".includes(char)) depth++;
      else if (")]}".includes(char)) depth = Math.max(0, depth - 1);
      visible += char;
    }
    if (!current && visible.trim()) { indent = line.length - line.trimStart().length; startLine = lineIndex + 1; }
    if (visible.trim()) current += (current ? " " : "") + visible.trim();
    if (depth === 0 && current) { result.push({ text: current, indent, line: startLine }); current = ""; }
  }
  if (current) result.push({ text: current, indent, line: startLine });
  return result;
}

function pythonStringArgument(source: string, name: string): string | undefined {
  const match = new RegExp("(?:^|[,\\s])" + name + "\\s*=\\s*(['\"])(.*?)\\1").exec(source);
  return match?.[2]?.replace(/\\\\(['\"\\\\])/g, "$1");
}

function splitTopLevel(source: string, separators: string[]): string[] {
  const pieces: string[] = []; let start = 0; let depth = 0; let quote = ""; let escaped = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quote) { if (!escaped && char === quote) quote = ""; if (char === "\\" && !escaped) escaped = true; else escaped = false; continue; }
    if (char === "'" || char === "\"") { quote = char; continue; }
    if ("([{".includes(char)) { depth++; continue; }
    if (")]}".includes(char)) { depth--; continue; }
    if (!depth) {
      const separator = separators.find(value => source.startsWith(value, index));
      if (separator) { pieces.push(source.slice(start, index).trim(), separator); index += separator.length - 1; start = index + 1; }
    }
  }
  pieces.push(source.slice(start).trim());
  return pieces;
}

/** Import a static Airflow subset; dynamic Python expressions are not executed. */
export function airflowDagToDiagram(source: string): Element[] {
  if (source.length > 5_000_000) throw new Error("Airflow DAG source is limited to 5 MB.");
  const statements = logicalPythonStatements(source);
  const dagStatement = statements.find(item => /\b(?:with\s+)?(?:[\w.]+\.)?DAG\s*\(|@(?:[\w.]+\.)?dag\s*\(/i.test(item.text));
  if (!dagStatement) throw new Error("No Airflow DAG declaration was found in this Python file.");
  const dagCall = dagStatement?.text.match(/(?:DAG|dag)\s*\(([\s\S]*)/i)?.[1] ?? "";
  const firstDagArgument = /^\s*(['\"])(.*?)\1/.exec(dagCall)?.[2];
  const dagId = pythonStringArgument(dagCall, "dag_id") ?? firstDagArgument ?? "Airflow DAG";
  const schedule = pythonStringArgument(dagCall, "schedule") ?? pythonStringArgument(dagCall, "schedule_interval");
  const decorated = new Map<string, string | undefined>(); let pendingDecorator: string | undefined;
  for (const statement of statements) {
    const decorator = /^@(?:[\w.]+\.)?task(?:\s*\(([\s\S]*)\))?$/.exec(statement.text);
    if (decorator) { pendingDecorator = decorator[1] ?? ""; continue; }
    const definition = /^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/.exec(statement.text);
    if (definition && pendingDecorator !== undefined) decorated.set(definition[1], pythonStringArgument(pendingDecorator, "task_id"));
    pendingDecorator = undefined;
  }

  type Task = { key: string; alias: string; title: string; operator: string; line: number; group?: string };
  const tasks: Task[] = []; const aliasToKey = new Map<string, string>(); const taskFlowCalls: { alias: string; functionName: string; args: string }[] = [];
  const groups: { indent: number; name: string }[] = [];
  for (const statement of statements) {
    while (groups.length && groups[groups.length - 1].indent >= statement.indent) groups.pop();
    const groupOpen = /^with\s+(?:[\w.]+\.)?TaskGroup\s*\(([\s\S]*)\)(?:\s+as\s+[A-Za-z_]\w*)?\s*:?\s*$/.exec(statement.text);
    if (groupOpen) {
      const name = pythonStringArgument(groupOpen[1], "group_id") ?? /^\s*(['\"])(.*?)\1/.exec(groupOpen[1])?.[2] ?? "TaskGroup";
      groups.push({ indent: statement.indent, name }); continue;
    }
    if (/^(?:async\s+)?def\s|^@/.test(statement.text)) continue;
    const assignment = /^([A-Za-z_]\w*)\s*=\s*([\w.]+)\s*\(([\s\S]*)\)\s*$/.exec(statement.text);
    const bareCall = /^([\w.]+)\s*\(([\s\S]*)\)\s*$/.exec(statement.text);
    const qualifiedName = assignment?.[2] ?? bareCall?.[1]; const functionName = qualifiedName?.split(".").pop(); const args = assignment?.[3] ?? bareCall?.[2] ?? "";
    if (!functionName) continue;
    if (decorated.has(functionName)) {
      taskFlowCalls.push({ alias: assignment?.[1] ?? functionName, functionName, args }); continue;
    }
    const operator = functionName.split(".").pop()!;
    if (!/(?:Operator|Sensor)$/.test(operator)) continue;
    const taskId = pythonStringArgument(args, "task_id") ?? assignment?.[1] ?? operator.replace(/(?:Operator|Sensor)$/, "").toLowerCase();
    const alias = assignment?.[1] ?? taskId; const key = "airflow:" + dagId + ":" + taskId;
    if (aliasToKey.has(alias) || tasks.some(task => task.key === key)) throw new Error("Airflow source declares duplicate task ID or variable \"" + taskId + "\".");
    tasks.push({ key, alias, title: taskId, operator, line: statement.line, ...(groups.length ? { group: groups[groups.length - 1].name } : {}) });
    aliasToKey.set(alias, key);
  }
  for (const call of taskFlowCalls) {
    const taskId = decorated.get(call.functionName) ?? call.functionName; const key = "airflow:" + dagId + ":" + taskId;
    if (aliasToKey.has(call.alias) || tasks.some(task => task.key === key)) continue;
    tasks.push({ key, alias: call.alias, title: taskId, operator: "TaskFlow @task", line: statements.find(item => item.text.includes(call.functionName + "("))?.line ?? 1 });
    aliasToKey.set(call.alias, key);
  }
  if (!tasks.length) throw new Error("No static Airflow tasks were found. The importer recognizes Operator/Sensor calls and invoked @task functions; it does not execute dynamic Python DAG code.");
  if (tasks.length > 500) throw new Error("Airflow DAGs are limited to 500 diagram tasks.");

  const links: StructuredGraphLink[] = []; const linkKeys = new Set<string>();
  const addLink = (fromAlias: string, toAlias: string, type: "configured" | "inferred") => {
    const from = aliasToKey.get(fromAlias); const to = aliasToKey.get(toAlias);
    if (!from || !to || from === to) return;
    const signature = from + "|" + to + "|" + type; if (linkKeys.has(signature)) return; linkKeys.add(signature);
    links.push({
      from, to,
      label: type === "configured" ? "depends on (configured)" : "data dependency (inferred from TaskFlow argument)",
      componentRole: "airflow-edge|" + type + "|" + encodeURIComponent(fromAlias) + "|" + encodeURIComponent(toAlias),
      liveKey: fromAlias + " -> " + toAlias,
    });
  };
  const endpointNames = (expression: string) => {
    const value = expression.trim().replace(/^\(([\s\S]*)\)$/s, "$1").trim();
    const list = /^\[([\s\S]*)\]$/.exec(value); const body = list?.[1] ?? value;
    return splitTopLevel(body, [","]).filter(part => part !== ",").map(part => part.trim()).filter(name => /^[A-Za-z_]\w*$/.test(name));
  };
  for (const statement of statements) {
    const expression = statement.text.replace(/^\(([\s\S]*)\)$/s, "$1");
    const chain = splitTopLevel(expression, ["<<", ">>"]);
    if (chain.length > 1) for (let index = 0; index + 2 < chain.length; index += 2) {
      const left = endpointNames(chain[index]); const right = endpointNames(chain[index + 2]);
      for (const from of chain[index + 1] === ">>" ? left : right) for (const to of chain[index + 1] === ">>" ? right : left) addLink(from, to, "configured");
    }
    const method = /^([A-Za-z_]\w*)\.set_(downstream|upstream)\(([\s\S]*)\)\s*$/.exec(expression);
    if (method) for (const target of endpointNames(method[3])) addLink(method[2] === "downstream" ? method[1] : target, method[2] === "downstream" ? target : method[1], "configured");
    const helper = /^(?:[\w.]+\.)?(chain|cross_downstream)\(([\s\S]*)\)\s*$/.exec(expression);
    if (helper) {
      const args = splitTopLevel(helper[2], [","]).filter((_, index) => index % 2 === 0); const groups = args.map(endpointNames);
      const pairs = helper[1] === "cross_downstream" ? [[groups[0] ?? [], groups[1] ?? []]] : groups.slice(0, -1).map((group, index) => [group, groups[index + 1] ?? []]);
      for (const pair of pairs) {
        const left = pair[0]; const right = pair[1];
        if (helper[1] === "chain" && left.length === right.length && left.length > 1) left.forEach((from, index) => addLink(from, right[index], "configured"));
        else for (const from of left) for (const to of right) addLink(from, to, "configured");
      }
    }
  }
  for (const call of taskFlowCalls) {
    const referencedAliases = new Set(call.args.match(/[A-Za-z_]\w*/g) ?? []);
    for (const alias of aliasToKey.keys()) if (alias !== call.alias && referencedAliases.has(alias)) addLink(alias, call.alias, "inferred");
  }
  const nodes: StructuredGraphNode[] = tasks.map(task => ({
    key: task.key, title: task.title, kind: "Airflow " + task.operator,
    detail: ["DAG: " + dagId, schedule ? "Schedule: " + schedule : "", task.group ? "TaskGroup: " + task.group : "", "Declared at line " + task.line].filter(Boolean).join("\n"),
    componentRole: "airflow-task|" + encodeURIComponent(task.alias) + "|" + encodeURIComponent(task.operator), liveKey: task.alias,
  }));
  return buildStructuredDiagram(nodes, links, "airflow");
}

/** Import GitHub Actions jobs and needs edges from YAML without executing workflow steps. */
export function githubActionsWorkflowToDiagram(source: string): Element[] | undefined {
  if (source.length > 5_000_000) throw new Error("GitHub Actions workflow YAML is limited to 5 MB.");
  let root: RecordValue | undefined;
  try {
    const documents = parseAllDocuments(source);
    if (documents.length !== 1 || documents[0].errors.length) throw new Error();
    root = objectValue(documents[0].toJS({ maxAliasCount: 100 }));
  } catch { throw new Error("GitHub Actions workflow YAML could not be parsed."); }
  const jobs = objectValue(root?.jobs); if (!jobs || !("on" in (root ?? {}))) return undefined;
  const entries = Object.entries(jobs).filter(([, value]) => !!objectValue(value));
  if (!entries.length) throw new Error("The GitHub Actions workflow has no job definitions.");
  if (entries.length > 300) throw new Error("GitHub Actions workflows are limited to 300 diagram jobs.");
  const workflowName = stringValue(root?.name) || "GitHub Actions workflow";
  const triggerValue = root?.on;
  const triggers = typeof triggerValue === "string" ? triggerValue : Array.isArray(triggerValue) ? triggerValue.map(stringValue).filter(Boolean).join(", ") : Object.keys(objectValue(triggerValue) ?? {}).join(", ");
  const keys = new Map(entries.map(([id]) => [id, "github:" + id]));
  const nodes: StructuredGraphNode[] = entries.map(([id, raw]) => {
    const job = objectValue(raw)!; const steps = Array.isArray(job.steps) ? job.steps : [];
    const stepDetails = steps.slice(0, 12).flatMap((step, index) => {
      const item = objectValue(step); if (!item) return [];
      const command = stringValue(item.run).split(/\r?\n/)[0].slice(0, 100);
      return [(index + 1) + ". " + (stringValue(item.name) || stringValue(item.uses) || (command ? "Shell: " + command : "Step " + (index + 1)))];
    });
    const matrix = objectValue(objectValue(job.strategy)?.matrix);
    const runner = Array.isArray(job["runs-on"]) ? job["runs-on"].map(stringValue).join(", ") : stringValue(job["runs-on"]);
    const detail = ["Workflow: " + workflowName, triggers ? "Triggers: " + triggers : "", runner ? "Runner: " + runner : "", matrix ? "Matrix: " + Object.keys(matrix).join(", ") : "", ...stepDetails, steps.length > 12 ? "…and " + (steps.length - 12) + " more steps" : ""].filter(Boolean).join("\n");
    return { key: keys.get(id)!, title: stringValue(job.name) || id, kind: "GitHub Actions job", detail, componentRole: "github-job|" + encodeURIComponent(id), liveKey: id };
  });
  const links: StructuredGraphLink[] = [];
  for (const [id, raw] of entries) {
    const job = objectValue(raw)!;
    const needs = typeof job.needs === "string" ? [job.needs] : Array.isArray(job.needs) ? job.needs.map(stringValue).filter(Boolean) : [];
    for (const dependency of needs) {
      const from = keys.get(dependency); const to = keys.get(id);
      if (!from) throw new Error("GitHub Actions job \"" + id + "\" needs unknown job \"" + dependency + "\".");
      if (from !== to) links.push({ from, to: to!, label: "needs (configured)", componentRole: "github-needs|" + encodeURIComponent(dependency) + "|" + encodeURIComponent(id), liveKey: dependency + " -> " + id });
    }
  }
  return buildStructuredDiagram(nodes, links, "github-actions");
}
