#!/usr/bin/env node
/* 调试：44 节 DOM 结构——renderCards 后 char pane 的区块/子节点 */
"use strict";
const fs = require("fs");
const path = require("path");
const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
const js = fs.readFileSync(jsPath, "utf8");
global.V = { maplebirch: { npc: {} }, NPCName: [], characters: { npc: {} } };
global.State = { variables: global.V };
global.setup = {};
global.rv = { variables: global.V, characters: global.V.characters };
setup.NPCNameList = ["Avery","Bailey","Robin","Whitney","Zephyr"];
setup.loveInterestNpc = ["Robin","Whitney"];
V.per_npc = { "manager": { name: "Helen", love: 42 }, "school_nurse": {} };
V.NPCName = [{ nam: "Robin", love: 0 }, { nam: "Bailey", love: 0 }];
V.maplebirch.npc = {};
function mkNode(tag) {
  const n = {
    tagName: tag, children: [], _text: "", className: "", type: "", value: "", checked: false, step: "", id: "", title: "", listeners: {},
    set textContent(v) { this._text = String(v); },
    get textContent() { let s = this._text; this.children.forEach(function (c) { s += c.textContent; }); return s; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    setAttribute(k, v) { this["attr_" + k] = v; },
    getAttribute(k) { return this["attr_" + k]; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    contains(n) { return n === this || (this.children && this.children.some(function (c) { return c.contains ? c.contains(n) : false; })); },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); } return c; },
    querySelector(sel) { return qs(this, sel); },
    querySelectorAll(sel) { const out = []; qa(this, sel, out); return out; }
  };
  return n;
}
function qs(node, sel) {
  if (!node || !node.children) { return null; }
  const m = sel.match(/^\[data-(\w+)="([^"]+)"\]$/);
  for (let i = 0; i < node.children.length; i++) {
    const c = node.children[i];
    if (m && c.getAttribute && c.getAttribute("data-" + m[1]) === m[2]) { return c; }
    const r = qs(c, sel);
    if (r) { return r; }
  }
  return null;
}
function qa(node, sel, out) {
  if (!node || !node.children) { return; }
  node.children.forEach(function (c) {
    const m = sel.match(/^\[data-(\w+)="([^"]+)"\]$/);
    if (m && c.getAttribute && c.getAttribute("data-" + m[1]) === m[2]) { out.push(c); }
    qa(c, sel, out);
  });
}
global.window = {
  maplebirch: { npc: {
    data: new Map([
      ["Robin", { Data: { nam: "Robin" }, Config: {}, Patch: {} }],
      ["Bailey", { Data: { nam: "Bailey" }, Config: {}, Patch: {} }],
      ["tsukihan", { Data: { nam: "tsukihan" }, Config: {}, Patch: {} }],
      ["Zephyr", { Data: { nam: "Zephyr" }, Config: { loveInterest: true }, Patch: {} }]
    ]),
    NPCNameList: setup.NPCNameList,
    romanceConditions: { Robin: [() => true] },
    customStats: {},
    type: { loveInterestNpcs: [], importantNPCs: [], specialNPCs: [] }
  } }
};
const dBody = mkNode("body"), dHead = mkNode("head");
global.document = { body: dBody, head: dHead, createElement: mkNode, getElementById: () => null, addEventListener: () => {} };
delete global.$;
eval(js);
const api = setup.mbStageCE;
console.log("charCategory(zephyr) =", api.charCategory("zephyr"), "| isLoveCharacter(zephyr) =", api.isLoveCharacter("zephyr"));
console.log("isLoveCharacter(Zephyr) =", api.isLoveCharacter("Zephyr"));
const root = dBody.children.filter(c => c.id === "mce-root")[0];
api.renderCards();
const pane = root.querySelector('[data-pane="char"]');
console.log("pane children count:", pane.children.length);
pane.children.forEach(function (b, i) {
  console.log("[" + i + "] tag=" + b.tagName + " cls=" + b.className + " tcat=" + b.getAttribute("data-tcat") + " children=" + b.children.length + " text=" + b.textContent.slice(0, 50));
});
const sec = root.querySelector('[data-tcat="恋爱角色"]');
console.log("love sec children:", sec.children.length);
sec.children.forEach(function (b, i) { console.log("  [" + i + "] cls=" + b.className + " attr-collapsed=" + b.getAttribute("data-collapsed") + " text=" + b.textContent.slice(0, 40)); });
