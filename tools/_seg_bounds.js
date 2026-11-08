"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const m = JSON.parse(fs.readFileSync(path.join(ROOT, "javascript/src/manifest.json"), "utf8"));
let acc = 1;
m.segments.forEach(function (s) {
  const lines = fs.readFileSync(path.join(ROOT, "javascript/src", s.file), "utf8").split("\n").length;
  console.log(s.file + "  start=" + acc + " end=" + (acc + lines - 1));
  acc += lines;
});
