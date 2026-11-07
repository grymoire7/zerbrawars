export interface BroughtView {
  readonly icon: string;
  readonly title: string;
  readonly detail: string;
}

export interface BroughtStrip {
  /** `soft`: a lighter, friendlier look for a skirmish. */
  show(heading: string, items: readonly BroughtView[], soft?: boolean): void;
  hide(): void;
  dispose(): void;
}

/** The "you brought" strip: how the week shaped this fight. Dismissible by any tap, never blocks the board. */
export function createBroughtStrip(
  root: HTMLElement,
  onDismiss: () => void,
): BroughtStrip {
  const wide = window.matchMedia("(min-width: 900px), (min-aspect-ratio: 5/4)");
  const box = document.createElement("div");
  box.setAttribute("role", "region");
  box.setAttribute("aria-label", "What you brought into this fight");
  const place = () => {
    box.style.cssText =
      "position:absolute;left:8px;top:8px;display:none;flex-direction:column;gap:6px;" +
      "pointer-events:auto;box-sizing:border-box;padding:8px 10px;border-radius:8px;" +
      "background:rgba(35,38,46,0.94);border:1px solid var(--zw-line-strong);font:13px sans-serif;color:var(--zw-text);" +
      (wide.matches
        ? "right:calc(clamp(300px,28vw,360px) + 8px);"
        : "right:8px;") +
      "max-height:46%;overflow:auto;";
  };
  place();
  wide.addEventListener("change", () => {
    const shown = box.style.display !== "none";
    place();
    if (shown) box.style.display = "flex";
  });
  const head = document.createElement("div");
  head.style.cssText = "display:flex;align-items:center;gap:8px;";
  const title = document.createElement("strong");
  title.style.cssText = "flex:1;font-size:14px;";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Got it";
  close.style.cssText = "min-height:44px;min-width:44px;padding:0 12px;";
  close.addEventListener("click", onDismiss);
  // Any tap dismisses, on the strip or off it (the tap still reaches whatever is under it), so
  // a thumb anywhere on the screen will do. The listener is only live while the strip shows.
  const anyTap = () => onDismiss();
  const listen = (on: boolean) => {
    if (on) document.addEventListener("pointerdown", anyTap, { capture: true });
    else document.removeEventListener("pointerdown", anyTap, { capture: true });
  };
  head.append(title, close);
  const chips = document.createElement("div");
  chips.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;";
  box.append(head, chips);
  root.append(box);

  return {
    show(heading, items, soft = false) {
      title.textContent = soft
        ? heading.charAt(0).toUpperCase() + heading.slice(1)
        : heading;
      box.style.background = soft
        ? "rgba(34,48,58,0.9)"
        : "rgba(35,38,46,0.94)";
      box.style.borderColor = soft
        ? "var(--zw-swarm-loaded)"
        : "var(--zw-line-strong)";
      title.style.fontWeight = soft ? "500" : "";
      chips.replaceChildren(
        ...items.map((it) => {
          const c = document.createElement("div");
          c.style.cssText =
            "display:flex;gap:6px;align-items:center;padding:4px 8px;border-radius:6px;" +
            "background:var(--zw-control);border:1px solid var(--zw-line);line-height:1.25;";
          const icon = document.createElement("span");
          icon.textContent = it.icon;
          icon.setAttribute("aria-hidden", "true");
          icon.style.cssText = "font-size:18px;";
          const text = document.createElement("span");
          const t = document.createElement("div");
          t.textContent = it.title;
          t.style.fontWeight = "600";
          const d = document.createElement("div");
          d.textContent = it.detail;
          d.style.cssText = "font-size:12px;opacity:0.8;";
          text.append(t, d);
          c.append(icon, text);
          return c;
        }),
      );
      box.style.display = "flex";
      listen(false);
      // Skip the tap that is already in flight, so showing it never dismisses it at once.
      setTimeout(() => {
        if (box.style.display !== "none") listen(true);
      }, 0);
    },
    hide() {
      box.style.display = "none";
      listen(false);
    },
    dispose() {
      listen(false);
      box.remove();
    },
  };
}
