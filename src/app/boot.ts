import { applyCssTokens } from "../theme/palette";
import { NO_WEBGL, webglAvailable } from "./webglModel";

/** Replaces the page with a calm message and a Reload button; nothing of the game is left behind. */
function showNoWebgl() {
  applyCssTokens(document.documentElement);
  document.getElementById("app")?.remove();
  document.getElementById("ui")?.remove();
  const wrap = document.createElement("div");
  wrap.setAttribute("role", "alert");
  wrap.style.cssText =
    "position:fixed;inset:0;display:flex;align-items:safe center;justify-content:center;" +
    "padding:16px;box-sizing:border-box;overflow:auto;background:var(--zw-bg);" +
    "color:var(--zw-text);font:15px sans-serif;";
  const card = document.createElement("div");
  card.style.cssText =
    "width:min(100%,480px);margin:auto;display:flex;flex-direction:column;gap:12px;line-height:1.4;";
  const h = document.createElement("h1");
  h.style.cssText = "margin:0;font-size:22px;";
  h.textContent = NO_WEBGL.title;
  const p = document.createElement("p");
  p.style.cssText = "margin:0;";
  p.textContent = NO_WEBGL.body;
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = NO_WEBGL.reload;
  b.style.cssText =
    "min-height:44px;min-width:44px;padding:0 16px;font:inherit;font-weight:700;align-self:flex-start;cursor:pointer;";
  b.addEventListener("click", () => window.location.reload());
  card.append(h, p, b);
  wrap.append(card);
  document.body.append(wrap);
  b.focus();
}

const probe = document.createElement("canvas");
if (webglAvailable((kind) => probe.getContext(kind))) {
  void import("./main");
} else {
  showNoWebgl();
}
