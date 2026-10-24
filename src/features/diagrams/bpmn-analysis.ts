import type { Element, ShapeElement } from "../../model";
import { flatten, isConnector } from "../../operations";

export type BpmnSimulationStep = { elementId: string; label: string; kind: "node" | "flow"; elapsedMinutes: number; durationMinutes?: number; branch?: number };
export type BpmnContext = Record<string, string | number | boolean>;

/** Parse a small, editable context list such as `approved=true` and `amount=500`. */
export function parseBpmnContext(source: string): BpmnContext {
  const values: BpmnContext = {};
  for (const entry of source.split(/[\r\n,;]+/)) {
    const match = /^\s*([A-Za-z_][\w.-]*)\s*=\s*(.*?)\s*$/.exec(entry);
    if (!match) continue;
    const [, key, raw] = match;
    if (/^(?:true|false)$/i.test(raw)) values[key] = raw.toLowerCase() === "true";
    else if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw) && Number.isFinite(Number(raw))) values[key] = Number(raw);
    else values[key] = raw.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_all, doubleQuoted: string, singleQuoted: string) => doubleQuoted ?? singleQuoted ?? raw);
  }
  return values;
}

/** Evaluate a deliberately small, safe subset of BPMN condition expressions. */
export function evaluateBpmnCondition(expression: string | undefined, context: BpmnContext): boolean | undefined {
  const source = expression?.trim(); if (!source) return undefined;
  const condition = /^(!?)\s*([A-Za-z_][\w.-]*)\s*(?:(==|!=|>=|<=|>|<)\s*(true|false|-?(?:\d+\.?\d*|\.\d+)|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z_][\w.-]*))?$/i.exec(source);
  if (!condition) return undefined;
  const [, negate, key, operator, rawExpected] = condition;
  const actual = context[key];
  if (!operator) return actual === undefined ? undefined : negate ? !Boolean(actual) : Boolean(actual);
  if (actual === undefined) return undefined;
  const unquote = (value: string) => value.startsWith('"') ? value.slice(1, -1).replace(/\\(["\\])/g, "$1") : value.startsWith("'") ? value.slice(1, -1).replace(/\\([\\'])/g, "$1") : value;
  const raw = unquote(rawExpected);
  const expected: string | number | boolean = /^(?:true|false)$/i.test(raw) ? raw.toLowerCase() === "true" : /^-?(?:\d+\.?\d*|\.\d+)$/.test(raw) ? Number(raw) : context[raw] ?? raw;
  const left = typeof actual === "string" && typeof expected === "string" ? actual.toLowerCase() : actual;
  const right = typeof actual === "string" && typeof expected === "string" ? expected.toLowerCase() : expected;
  switch (operator) {
    case "==": return left === right;
    case "!=": return left !== right;
    case ">": return typeof left === "number" && typeof right === "number" ? left > right : String(left) > String(right);
    case "<": return typeof left === "number" && typeof right === "number" ? left < right : String(left) < String(right);
    case ">=": return typeof left === "number" && typeof right === "number" ? left >= right : String(left) >= String(right);
    case "<=": return typeof left === "number" && typeof right === "number" ? left <= right : String(left) <= String(right);
  }
}

type Token = { nodeId: string; elapsed: number; branch: number; visits: Map<string, number>; visitedFlows: Set<string> };

/** Simulate exclusive decisions and parallel splits/joins with deterministic token scheduling. */
export function simulateBpmn(elements: Element[], context: BpmnContext = {}): BpmnSimulationStep[] {
  const all = flatten(elements);
  const nodes = all.filter((item): item is Extract<Element, { type: "group" }> => item.type === "group" && !!item.id && !!item.libraryComponent?.kind?.startsWith("bpmn-"));
  const byId = new Map(nodes.map(node => [node.id!, node]));
  const flows = all.filter((item): item is ShapeElement => isConnector(item) && !!item.id
    && !!item.startBinding && !!item.endBinding && byId.has(item.startBinding.elementId) && byId.has(item.endBinding.elementId)
    && (!item.relationshipType || item.relationshipType === "sequence"));
  const starts = nodes.filter(node => node.libraryComponent?.kind === "bpmn-start");
  if (!starts.length || !flows.length) return [];
  const outgoing = new Map<string, ShapeElement[]>(); const incoming = new Map<string, ShapeElement[]>();
  for (const flow of flows) {
    const start = flow.startBinding!.elementId; const end = flow.endBinding!.elementId;
    outgoing.set(start, [...outgoing.get(start) ?? [], flow]); incoming.set(end, [...incoming.get(end) ?? [], flow]);
  }
  const label = (node: typeof nodes[number]) => node.libraryComponent?.label ?? node.libraryComponent?.formTitle ?? node.libraryComponent?.kind.replace(/^bpmn-/, "") ?? "BPMN item";
  const trace: BpmnSimulationStep[] = []; const queue: Token[] = [];
  starts.forEach((node, index) => queue.push({ nodeId: node.id!, elapsed: 0, branch: index + 1, visits: new Map(), visitedFlows: new Set() }));
  let branchId = Math.max(1, starts.length); let processed = 0;
  const joins = new Map<string, Token[]>(); const processedJoins = new Set<string>();
  const enqueueFlow = (flow: ShapeElement, token: Token) => {
    if (!flow.id || token.visitedFlows.has(flow.id)) return;
    const next = byId.get(flow.endBinding!.elementId); if (!next) return;
    const visitedFlows = new Set(token.visitedFlows); visitedFlows.add(flow.id);
    trace.push({ elementId: flow.id, label: flow.sequenceCondition?.trim() || (flow.sequenceDefault ? "Default" : "Sequence flow"), kind: "flow", elapsedMinutes: token.elapsed, branch: token.branch });
    queue.push({ ...token, nodeId: next.id!, visits: new Map(token.visits), visitedFlows });
  };
  while (queue.length && processed < 500) {
    queue.sort((left, right) => left.elapsed - right.elapsed || left.branch - right.branch);
    let token = queue.shift()!; const node = byId.get(token.nodeId); if (!node) continue;
    const kind = node.libraryComponent?.kind ?? "";
    if (kind === "bpmn-parallel-gateway" && (incoming.get(node.id!)?.length ?? 0) > 1) {
      const arrivals = joins.get(node.id!) ?? []; arrivals.push(token); joins.set(node.id!, arrivals);
      const needed = incoming.get(node.id!)!.length;
      if (arrivals.length < needed || processedJoins.has(node.id!)) continue;
      processedJoins.add(node.id!);
      token = { ...arrivals.sort((a, b) => a.elapsed - b.elapsed)[arrivals.length - 1], elapsed: Math.max(...arrivals.map(item => item.elapsed)), visits: new Map(arrivals[0].visits), visitedFlows: new Set(arrivals.flatMap(item => [...item.visitedFlows])) };
    }
    processed++;
    const count = (token.visits.get(node.id!) ?? 0) + 1; token.visits.set(node.id!, count);
    if (count > 2) continue;
    const durationMinutes = kind === "bpmn-task" ? node.libraryComponent?.durationMinutes ?? 0 : 0;
    trace.push({ elementId: node.id!, label: label(node), kind: "node", elapsedMinutes: token.elapsed, ...(durationMinutes ? { durationMinutes } : {}), branch: token.branch });
    token = { ...token, elapsed: token.elapsed + durationMinutes };
    if (kind === "bpmn-end") continue;
    let nextFlows = outgoing.get(node.id!) ?? [];
    if (!nextFlows.length) continue;
    if (kind === "bpmn-gateway" && nextFlows.length > 1) {
      const conditioned = nextFlows.filter(flow => !!flow.sequenceCondition?.trim());
      const chosen = conditioned.find(flow => evaluateBpmnCondition(flow.sequenceCondition, context) === true);
      const fallback = nextFlows.find(flow => flow.sequenceDefault) ?? nextFlows.find(flow => !flow.sequenceCondition?.trim());
      nextFlows = chosen ? [chosen] : fallback ? [fallback] : [];
    } else if (kind !== "bpmn-parallel-gateway" && nextFlows.length > 1) {
      nextFlows = [nextFlows.find(flow => flow.sequenceDefault) ?? nextFlows[0]];
    }
    nextFlows.forEach((flow, index) => {
      const branchToken = nextFlows.length > 1 ? { ...token, branch: index === 0 ? token.branch : ++branchId, visits: new Map(token.visits), visitedFlows: new Set(token.visitedFlows) } : token;
      enqueueFlow(flow, branchToken);
    });
  }
  return trace;
}
