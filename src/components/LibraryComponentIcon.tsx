import { Dynamic } from "solid-js/web";
import {
  IconChartAreaLine,
  IconChartBar,
  IconChartDonut,
  IconChartLine,
  IconChartPie,
  IconChartScatter,
  IconComponents,
  type IconProps,
} from "@tabler/icons-solidjs";
import type { Component } from "solid-js";
import { buildLibraryComponent, buildLibraryRelationship, LIBRARY_COMPONENTS, type LibraryComponentKind } from "../notes";
import type { GroupElement } from "../model";
import { modelComponentSvg } from "../features/components/model-component-renderer";

const chartIcons: Partial<Record<LibraryComponentKind, Component<IconProps>>> = {
  "viz-bar": IconChartBar,
  "viz-horizontal-bar": IconChartBar,
  "viz-stacked-bar": IconChartBar,
  "viz-line": IconChartLine,
  "viz-area": IconChartAreaLine,
  "viz-scatter": IconChartScatter,
  "viz-pie": IconChartPie,
  "viz-donut": IconChartDonut,
  "viz-radar": IconChartLine,
  "viz-gauge": IconChartDonut,
  "viz-funnel": IconChartBar,
  "viz-heatmap": IconChartScatter,
  "viz-treemap": IconChartBar,
  "viz-kpi": IconChartBar,
};

const renderedIcons = new Map<LibraryComponentKind, string>();

function componentIconSvg(kind: LibraryComponentKind): string {
  const cached = renderedIcons.get(kind);
  if (cached !== undefined) return cached;
  const definition = LIBRARY_COMPONENTS.find(item => item.kind === kind);
  if (!definition) return "";
  const relation = buildLibraryRelationship(kind, 0, 0);
  const component: GroupElement = relation
    ? { type: "group", elements: [], componentBounds: { x: 0, y: 0, w: definition.width, h: definition.height }, libraryComponent: { kind, label: definition.label } }
    : buildLibraryComponent(kind, 0, 0);
  const svg = modelComponentSvg(component);
  renderedIcons.set(kind, svg);
  return svg;
}

export function LibraryComponentIcon(props: { kind: LibraryComponentKind }) {
  const definition = () => LIBRARY_COMPONENTS.find(item => item.kind === props.kind);
  const svg = () => componentIconSvg(props.kind);
  return <>
    {chartIcons[props.kind]
      ? <Dynamic component={chartIcons[props.kind]!} class="stencil-component-icon" size={24} strokeWidth={1.8} aria-hidden="true" />
      : definition() && svg()
        ? <svg class="stencil-component-icon stencil-component-rendered-icon" viewBox={`0 0 ${definition()!.width} ${definition()!.height}`} aria-hidden="true" innerHTML={svg()} />
        : <Dynamic component={IconComponents} class="stencil-component-icon" size={24} strokeWidth={1.8} aria-hidden="true" />}
  </>;
}
