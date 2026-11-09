import { render } from "solid-js/web";
import { createUIElement, createUIFrame, createUIDesignDocument, type UIElement } from "../src/features/ui-design/model";
import { UIHierarchyIndex } from "../src/features/ui-design/hierarchy";
import { createUIDesignSession } from "../src/features/ui-design/session";
import { UiDesignWorkspace } from "../src/features/ui-design/UiDesignWorkspace";

const host = {
  chooseOpen: async () => null,
  chooseSave: async () => null,
  authorize: async (path: string) => path,
  read: async () => "",
  write: async () => undefined,
  displayName: (path: string) => path,
};

const session = createUIDesignSession(host);
session.create("Hierarchy interaction audit");
const doc = createUIDesignDocument("Hierarchy interaction audit");
const page = doc.pages[0];
const screen = createUIFrame(0, { x: 80, y: 40 }, page.id, "custom");
screen.name = "Root screen";
screen.frameType = "screen";
screen.width = 700;
screen.height = 540;

const transformed = createUIElement("frame", 0, { x: 80, y: 60 }, screen.id, { width: 450, height: 360 });
transformed.name = "Rotated container";
transformed.frameType = "container";
transformed.rotation = 11;
transformed.clipContent = true;

const hitTarget = createUIElement("rectangle", 0, { x: 35, y: 50 }, transformed.id, { width: 90, height: 64 });
hitTarget.name = "Nested hit target";
hitTarget.rotation = 8;
const nestedResize = createUIElement("rectangle", 1, { x: 270, y: 150 }, transformed.id, { width: 92, height: 56 });
nestedResize.name = "Nested resize target";

const destination = createUIFrame(2, { x: 320, y: 245 }, transformed.id, "custom");
destination.name = "Rotated destination";
destination.frameType = "screen";
destination.width = 128;
destination.height = 100;
destination.rotation = -9;

const marqueeA = createUIElement("rectangle", 1, { x: 250, y: 35 }, screen.id, { width: 72, height: 48 });
marqueeA.name = "Marquee item A";
const marqueeB = createUIElement("rectangle", 2, { x: 390, y: 35 }, screen.id, { width: 72, height: 48 });
marqueeB.name = "Marquee item B";
const reparentTarget = createUIElement("rectangle", 3, { x: 565, y: 440 }, screen.id, { width: 48, height: 36 });
reparentTarget.name = "Reparent target";

page.elements.push(screen, transformed, hitTarget, nestedResize, destination, marqueeA, marqueeB, reparentTarget);
page.prototypeFlows[0].startNodeId = screen.id;
session.update(doc);

const mount = document.createElement("div");
mount.id = "ui-design-audit-root";
document.body.append(mount);
const dispose = render(() => <UiDesignWorkspace session={session} />, mount);

const api = {
  ids: { screen: screen.id, transformed: transformed.id, hitTarget: hitTarget.id, nestedResize: nestedResize.id, destination: destination.id, marqueeA: marqueeA.id, marqueeB: marqueeB.id, reparentTarget: reparentTarget.id },
  worldTransform(id: string) {
    const current = session.document().pages[0];
    return new UIHierarchyIndex<UIElement>(current.id, current.elements).worldTransform(id);
  },
  worldBounds(id: string) {
    const current = session.document().pages[0];
    return new UIHierarchyIndex<UIElement>(current.id, current.elements).worldBounds(id);
  },
  document() { return session.document(); },
  dispose,
};
(globalThis as typeof globalThis & { __uiDesignAudit?: typeof api }).__uiDesignAudit = api;
