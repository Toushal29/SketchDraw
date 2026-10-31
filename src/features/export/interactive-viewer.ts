/**
 * A single self-contained HTML file for reviewing a sketch without SketchDraw: pan and zoom, page tabs, layer
 * toggles, hyperlinks, page links with transitions, and prototype links that focus another object. Frames can
 * be stepped through as screens. All document text arrives already escaped inside the SVG markup.
 */
export type ViewerFrame = { id: string; name: string; x: number; y: number; w: number; h: number };
export type ViewerLayer = { id: string; name: string; hidden: boolean };
export type ViewerPage = {
  id: string; name: string;
  /** World-space bounds of the page's content, used as the starting view. */
  bounds: { x: number; y: number; w: number; h: number };
  background: string;
  /** Serialized SVG elements in world coordinates. */
  svg: string;
  layers: ViewerLayer[];
  frames: ViewerFrame[];
};
export type ViewerOptions = { title: string; pages: ViewerPage[]; startPageId?: string; prototype?: boolean };

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const number = (value: number) => (Number.isFinite(value) ? Math.round(value * 100) / 100 : 0);

const STYLE = `*{box-sizing:border-box}html,body{margin:0;height:100%;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f2933;background:#eef1f5}
.sd-bar{position:fixed;inset:0 0 auto 0;z-index:5;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 10px;background:#ffffffee;border-bottom:1px solid #d5dbe3;backdrop-filter:blur(6px)}
.sd-bar h1{margin:0 8px 0 0;font-size:14px;font-weight:600}
.sd-bar button,.sd-bar select{height:28px;padding:0 10px;border:1px solid #b6c0cc;border-radius:6px;background:#fff;color:inherit;font:inherit;cursor:pointer}
.sd-bar button:hover:not(:disabled){background:#eef1f5}.sd-bar button:disabled{opacity:.45;cursor:default}.sd-bar button[aria-pressed=true]{background:#dbe8f5;border-color:#2468a0}
.sd-tabs{display:flex;gap:4px;flex-wrap:wrap}.sd-spacer{flex:1}
.sd-stage{position:fixed;inset:0;overflow:hidden;touch-action:none}
.sd-page{position:absolute;inset:0;display:none}.sd-page.active{display:block}
.sd-page svg{width:100%;height:100%;display:block;cursor:grab}.sd-page svg.panning{cursor:grabbing}
[data-page-link],[data-prototype-target],a{cursor:pointer}
.sd-layers{position:fixed;top:48px;right:10px;z-index:6;max-height:60vh;overflow:auto;padding:8px 10px;border:1px solid #d5dbe3;border-radius:8px;background:#fff;box-shadow:0 8px 24px #0002;font-size:12px}
.sd-layers[hidden]{display:none}.sd-layers label{display:flex;gap:6px;align-items:center;padding:2px 0}
.sd-hint{position:fixed;left:10px;bottom:8px;z-index:5;padding:4px 8px;border-radius:6px;background:#ffffffdd;font-size:11px;color:#52606d}
@media (prefers-reduced-motion:reduce){.sd-page{transition:none!important}}`;

const SCRIPT = `(function(){
"use strict";
var meta=JSON.parse(document.getElementById("sd-meta").textContent);
var stage=document.querySelector(".sd-stage"),pagesEl={},views={},history=[],current=null,prototype=!!meta.prototype;
meta.pages.forEach(function(p){pagesEl[p.id]=document.querySelector('.sd-page[data-page-id="'+p.id+'"]');});
function pageMeta(id){return meta.pages.filter(function(p){return p.id===id})[0]}
function svgOf(id){return pagesEl[id].querySelector("svg")}
function aspect(){var r=stage.getBoundingClientRect();return r.height/Math.max(1,r.width)}
function apply(id){var v=views[id],s=svgOf(id);v.h=v.w*aspect();s.setAttribute("viewBox",[v.x,v.y,v.w,v.h].join(" "))}
function fitRect(id,rect,pad){var v=views[id],a=aspect(),w=rect.w+pad*2,h=rect.h+pad*2;var scale=Math.max(w,h/a);v.w=Math.max(10,scale);v.h=v.w*a;v.x=rect.x+rect.w/2-v.w/2;v.y=rect.y+rect.h/2-v.h/2;apply(id)}
function fit(id){var b=pageMeta(id).bounds;fitRect(id,b.w>0&&b.h>0?b:{x:0,y:0,w:800,h:600},48)}
function zoomAt(id,factor,cx,cy){var v=views[id],r=stage.getBoundingClientRect(),ux=v.x+(cx-r.left)/r.width*v.w,uy=v.y+(cy-r.top)/r.height*v.h;var nw=Math.min(1e7,Math.max(5,v.w*factor));var k=nw/v.w;v.x=ux-(ux-v.x)*k;v.y=uy-(uy-v.y)*k;v.w=nw;apply(id)}
function panBy(id,dx,dy){var v=views[id],r=stage.getBoundingClientRect();v.x-=dx/r.width*v.w;v.y-=dy/r.height*v.h;apply(id)}
function toast(){}
function setTabs(){document.querySelectorAll(".sd-tab").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.pageId===current))})}
function buildLayers(){var box=document.querySelector(".sd-layers-list");box.textContent="";var layers=pageMeta(current).layers;if(!layers.length){var p=document.createElement("div");p.textContent="This page has no named layers.";box.appendChild(p);return}layers.forEach(function(l){var label=document.createElement("label"),cb=document.createElement("input");cb.type="checkbox";cb.dataset.layerId=l.id;var key=current+":"+l.id;cb.checked=layerState[key]===undefined?!l.hidden:layerState[key];cb.addEventListener("change",function(){layerState[key]=cb.checked;applyLayers()});label.appendChild(cb);label.appendChild(document.createTextNode(l.name));box.appendChild(label)})}
var layerState={};
function applyLayers(){pageMeta(current).layers.forEach(function(l){var key=current+":"+l.id,on=layerState[key]===undefined?!l.hidden:layerState[key];svgOf(current).querySelectorAll('[data-layer="'+CSS.escape(l.id)+'"]').forEach(function(n){n.style.display=on?"":"none"})})}
function buildFrames(){var sel=document.querySelector(".sd-frames");if(!sel)return;sel.textContent="";var frames=pageMeta(current).frames;sel.hidden=!frames.length;frames.forEach(function(f,i){var o=document.createElement("option");o.value=String(i);o.textContent=f.name;sel.appendChild(o)})}
function show(id,transition,push){if(!pagesEl[id]||id===current)return;var from=current&&pagesEl[current],to=pagesEl[id];if(push&&current)history.push(current);current=id;Object.keys(pagesEl).forEach(function(k){pagesEl[k].classList.toggle("active",k===id||(k===(from&&from.dataset.pageId)&&!!transition&&transition!=="instant"))});
 if(!views[id]){views[id]={x:0,y:0,w:800,h:600};fit(id)}else apply(id);
 if(from&&transition&&transition!=="instant"&&to.animate&&!matchMedia("(prefers-reduced-motion: reduce)").matches){var slide=transition==="slide";to.animate(slide?[{transform:"translateX(8%)",opacity:0},{transform:"none",opacity:1}]:[{opacity:0},{opacity:1}],{duration:260,easing:"ease-out"});var out=from.animate(slide?[{transform:"none",opacity:1},{transform:"translateX(-8%)",opacity:0}]:[{opacity:1},{opacity:0}],{duration:260,easing:"ease-in"});out.onfinish=function(){if(current!==from.dataset.pageId)from.classList.remove("active")}}else if(from)from.classList.remove("active");
 to.classList.add("active");setTabs();buildLayers();applyLayers();buildFrames();document.querySelector(".sd-back").disabled=!history.length;document.title=meta.title+" - "+pageMeta(id).name}
function goBack(){var id=history.pop();if(id){var c=current;current=null;show(id,"fade",false);void c}document.querySelector(".sd-back").disabled=!history.length}
function focusTarget(wrapperId){var node=document.getElementById(wrapperId);if(!node||!svgOf(current).contains(node))return;var bb=node.getBBox();fitRect(current,{x:bb.x,y:bb.y,w:bb.width||40,h:bb.height||40},Math.max(40,Math.max(bb.width,bb.height)*.6))}
function stepFrame(delta){var frames=pageMeta(current).frames;if(!frames.length){var i=meta.pages.findIndex(function(p){return p.id===current})+delta;if(meta.pages[i])show(meta.pages[i].id,"fade",true);return}var sel=document.querySelector(".sd-frames");var next=Math.max(0,Math.min(frames.length-1,Number(sel.value||0)+delta));sel.value=String(next);var f=frames[next];fitRect(current,f,24)}
stage.addEventListener("wheel",function(e){if(!current)return;e.preventDefault();zoomAt(current,Math.exp(e.deltaY*(e.ctrlKey?.01:.0015)),e.clientX,e.clientY)},{passive:false});
var pointers=new Map(),downAt=null,moved=false,lastPinch=0;
stage.addEventListener("pointerdown",function(e){if(!current||e.button>0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});try{stage.setPointerCapture(e.pointerId)}catch(_){}if(pointers.size===1){downAt={x:e.clientX,y:e.clientY,target:e.target};moved=false;svgOf(current).classList.add("panning")}else{lastPinch=0;moved=true}});
stage.addEventListener("pointermove",function(e){var p=pointers.get(e.pointerId);if(!p||!current)return;var dx=e.clientX-p.x,dy=e.clientY-p.y;if(pointers.size===2){var other=[...pointers].filter(function(en){return en[0]!==e.pointerId})[0][1];var d=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(lastPinch)zoomAt(current,lastPinch/d,(e.clientX+other.x)/2,(e.clientY+other.y)/2);lastPinch=d}else if(downAt){if(!moved&&Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)>4)moved=true;if(moved)panBy(current,dx,dy)}p.x=e.clientX;p.y=e.clientY});
function end(e){if(!pointers.has(e.pointerId))return;var wasSingle=pointers.size===1;pointers.delete(e.pointerId);if(svgOf(current))svgOf(current).classList.remove("panning");if(wasSingle&&downAt&&!moved){activate(downAt.target)}if(!pointers.size){downAt=null;lastPinch=0}}
stage.addEventListener("pointerup",end);stage.addEventListener("pointercancel",end);
function activate(target){if(!target||!target.closest)return;var link=target.closest("[data-page-link]");if(link&&pagesEl[link.dataset.pageLink]){show(link.dataset.pageLink,link.dataset.transition||"instant",true);return}var proto=target.closest("[data-prototype-target]");if(proto)focusTarget(proto.dataset.prototypeTarget)}
document.querySelector(".sd-fit").addEventListener("click",function(){fit(current)});
document.querySelector(".sd-in").addEventListener("click",function(){var r=stage.getBoundingClientRect();zoomAt(current,.8,r.left+r.width/2,r.top+r.height/2)});
document.querySelector(".sd-out").addEventListener("click",function(){var r=stage.getBoundingClientRect();zoomAt(current,1.25,r.left+r.width/2,r.top+r.height/2)});
document.querySelector(".sd-back").addEventListener("click",goBack);
document.querySelector(".sd-layers-toggle").addEventListener("click",function(e){var box=document.querySelector(".sd-layers");box.hidden=!box.hidden;e.currentTarget.setAttribute("aria-pressed",String(!box.hidden))});
document.querySelectorAll(".sd-tab").forEach(function(b){b.addEventListener("click",function(){show(b.dataset.pageId,"instant",true)})});
var frameSel=document.querySelector(".sd-frames");if(frameSel)frameSel.addEventListener("change",function(){var f=pageMeta(current).frames[Number(frameSel.value)];if(f)fitRect(current,f,24)});
document.addEventListener("keydown",function(e){if(e.target&&/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==="ArrowRight"||e.key==="PageDown"){stepFrame(1);e.preventDefault()}else if(e.key==="ArrowLeft"||e.key==="PageUp"){stepFrame(-1);e.preventDefault()}else if(e.key==="0"||e.key==="f"){fit(current)}else if(e.key==="+"||e.key==="="){document.querySelector(".sd-in").click()}else if(e.key==="-"){document.querySelector(".sd-out").click()}else if(e.key==="Backspace"||(e.altKey&&e.key==="ArrowLeft")){goBack()}});
window.addEventListener("resize",function(){if(current)apply(current)});
window.__sketchdrawViewer={show:show,get current(){return current},views:views};
show(meta.start,"instant",false);
})();`;

/** Builds the viewer page. Frames, layers, and bounds travel as JSON; the SVG is already escaped by the exporter. */
export function buildInteractiveViewer(options: ViewerOptions): string {
  if (!options.pages.length) throw new Error("There are no pages to export.");
  const start = options.pages.some(page => page.id === options.startPageId) ? options.startPageId! : options.pages[0].id;
  const meta = {
    title: options.title, start, prototype: !!options.prototype,
    pages: options.pages.map(page => ({ id: page.id, name: page.name, bounds: { x: number(page.bounds.x), y: number(page.bounds.y), w: number(page.bounds.w), h: number(page.bounds.h) }, layers: page.layers, frames: page.frames.map(frame => ({ ...frame, x: number(frame.x), y: number(frame.y), w: number(frame.w), h: number(frame.h) })) })),
  };
  const pages = options.pages.map(page => `<section class="sd-page" data-page-id="${escapeHtml(page.id)}" aria-label="${escapeHtml(page.name)}"><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(page.name)}" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet" style="background:${escapeHtml(page.background)}">${page.svg}</svg></section>`).join("\n");
  const tabs = options.pages.length > 1 ? `<nav class="sd-tabs" aria-label="Pages">${options.pages.map(page => `<button type="button" class="sd-tab" data-page-id="${escapeHtml(page.id)}" aria-pressed="false">${escapeHtml(page.name)}</button>`).join("")}</nav>` : "";
  const title = escapeHtml(options.title);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="SketchDraw interactive viewer">
<title>${title}</title>
<style>${STYLE}</style>
</head>
<body>
<header class="sd-bar" role="toolbar" aria-label="Viewer controls">
<h1>${title}</h1>
${tabs}
<button type="button" class="sd-back" disabled aria-label="Go back">Back</button>
<select class="sd-frames" aria-label="Screens" hidden></select>
<span class="sd-spacer"></span>
<button type="button" class="sd-out" aria-label="Zoom out">&minus;</button>
<button type="button" class="sd-in" aria-label="Zoom in">+</button>
<button type="button" class="sd-fit">Fit</button>
<button type="button" class="sd-layers-toggle" aria-pressed="false">Layers</button>
</header>
<aside class="sd-layers" hidden aria-label="Layers"><div class="sd-layers-list"></div></aside>
<main class="sd-stage" tabindex="0" aria-label="Diagram. Drag to pan, scroll to zoom.">
${pages}
</main>
<div class="sd-hint">${options.prototype ? "Click linked objects to navigate. Arrow keys step through screens." : "Drag to pan, scroll to zoom. Links open in a new tab."}</div>
<script type="application/json" id="sd-meta">${safeJson(meta)}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
