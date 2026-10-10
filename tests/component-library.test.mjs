import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const build = process.env.SKETCHDRAW_TEST_BUILD_DIR;
const { LIBRARY_COMPONENTS, buildLibraryComponent, buildLibraryRelationship, defaultLibraryChartData } = require(path.join(build, "src/notes.js"));
const { assignLibraryComponentIds, libraryComponentFields, setLibraryChartTrend, setLibraryRadioOption } = require(path.join(build, "src/features/components/library-component-editor.js"));
const { normalizeElement } = require(path.join(build, "src/features/files/parse-sketch.js"));

test("all modeling and UI library entries build into elements the v9 reader can save", () => {
  const relationships = new Set(["uml-inheritance", "uml-realization", "uml-aggregation", "uml-composition", "er-one-many", "er-many-many"]);
  for (const entry of LIBRARY_COMPONENTS) {
    const relationship = buildLibraryRelationship(entry.kind, 120, 90);
    const element = relationship ?? assignLibraryComponentIds(buildLibraryComponent(entry.kind, 120, 90, { chartData: defaultLibraryChartData(entry.kind) }), entry.kind);
    assert.ok(element, `${entry.label} should produce an element`);
    assert.ok(element.id, `${entry.label} should have a stable id`);
    assert.ok(normalizeElement(element), `${entry.label} should pass v9 element validation`);
    if (relationships.has(entry.kind)) assert.equal(element.type, "line", `${entry.label} should use the connected straight relationship path`);
    else assert.ok(element.type === "group" && element.elements.length > 0, `${entry.label} should render as a non-empty editable group`);
  }
});

test("radio choice changes preserve one selected indicator and the option editor has no duplicate text fields", () => {
  const radio = assignLibraryComponentIds(buildLibraryComponent("form-radio", 10, 20), "form-radio");
  const changed = setLibraryRadioOption(radio, 1);
  const rings = changed.elements.filter(element => element.componentRole?.startsWith("form-radio-option-"));
  const selected = rings.find(element => element.componentRole === "form-radio-option-1");
  const unselected = rings.find(element => element.componentRole === "form-radio-option-0");
  const dot = changed.elements.find(element => element.componentRole === "form-radio-dot-1");
  assert.equal(changed.libraryComponent.selectedOption, 1);
  assert.equal(selected.color, "#4d78b8");
  assert.equal(unselected.color, "#ced8e2");
  assert.ok(dot && selected && dot.x + dot.w / 2 === selected.x + selected.w / 2);
  assert.equal(libraryComponentFields(changed).length, 0);
  for (const kind of ["form-checkbox", "form-select", "form-button", "form-toggle"]) {
    const component = assignLibraryComponentIds(buildLibraryComponent(kind, 10, 20), kind);
    assert.deepEqual(libraryComponentFields(component), [], `${kind} should not duplicate structured field text below its option editor`);
  }
});

test("metric trend direction changes presentation metadata without replacing the chart data", () => {
  const data = defaultLibraryChartData("viz-kpi");
  const metric = assignLibraryComponentIds(buildLibraryComponent("viz-kpi", 10, 20, { chartData: data }), "viz-kpi");
  const changed = setLibraryChartTrend(metric, "down");
  assert.equal(changed.libraryComponent.trendDirection, "down");
  assert.deepEqual(changed.libraryComponent.chartData, metric.libraryComponent.chartData);
  assert.ok(normalizeElement(changed));
});

test("cloud database and queue use the cloud-specific drawings", () => {
  for (const kind of ["cloud-database", "cloud-queue"]) {
    const component = assignLibraryComponentIds(buildLibraryComponent(kind, 0, 0), kind);
    const labels = component.elements.filter(element => element.type === "text").map(element => element.text).join(" ");
    assert.match(labels, /CLOUD|MANAGED/);
    assert.ok(normalizeElement(component));
  }
});
