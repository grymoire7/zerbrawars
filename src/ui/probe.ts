export interface Probe {
  /** Asks the question; `done` gets the answer text, or null if skipped. */
  ask(turn: number, done: (answer: string | null) => void): void;
  isOpen(): boolean;
  dispose(): void;
}

const CHOICES = [
  "Some germs get cleared or held",
  "Germs grow or spread",
  "Not sure",
] as const;

/** The facilitator's prediction probe: a tiny question before End Turn. */
export function createProbe(root: HTMLElement): Probe {
  const backdrop = document.createElement("div");
  backdrop.style.cssText =
    "position:absolute;inset:0;display:none;align-items:center;justify-content:center;" +
    "padding:12px;box-sizing:border-box;background:rgba(14,15,19,0.6);pointer-events:auto;" +
    "font:15px sans-serif;color:var(--zw-text);z-index:4;";
  const card = document.createElement("div");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "probe-title");
  card.tabIndex = -1;
  card.style.cssText =
    "background:var(--zw-raised);border:1px solid var(--zw-line-strong);border-radius:10px;padding:16px 18px;" +
    "width:min(100%,420px);display:flex;flex-direction:column;gap:8px;box-sizing:border-box;";
  const title = document.createElement("h2");
  title.id = "probe-title";
  title.style.cssText = "margin:0;font:600 18px sans-serif;";
  title.textContent = "What will happen when you end the turn?";
  const text = document.createElement("input");
  text.type = "text";
  text.placeholder = "A few words, if you like";
  text.setAttribute("aria-label", "Your guess in a few words");
  text.maxLength = 140;
  text.style.cssText =
    "min-height:44px;font:inherit;box-sizing:border-box;padding:0 8px;";
  card.append(title);
  let done: ((a: string | null) => void) | null = null;
  const finish = (answer: string | null) => {
    backdrop.style.display = "none";
    const cb = done;
    done = null;
    cb?.(answer);
  };
  const choiceBtns = CHOICES.map((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = c;
    b.style.cssText = "min-height:44px;padding:0 12px;text-align:left;";
    b.addEventListener("click", () => {
      const extra = text.value.trim();
      finish(extra ? `${c} | ${extra}` : c);
    });
    return b;
  });
  const skip = document.createElement("button");
  skip.type = "button";
  skip.textContent = "Skip";
  skip.style.cssText = "min-height:44px;padding:0 12px;opacity:0.8;";
  skip.addEventListener("click", () => finish(null));
  card.append(...choiceBtns, text, skip);
  backdrop.append(card);
  root.append(backdrop);

  return {
    ask(turn, cb) {
      done = cb;
      title.textContent = `Turn ${turn}: what will happen when you end the turn?`;
      text.value = "";
      backdrop.style.display = "flex";
      choiceBtns[0].focus();
    },
    isOpen: () => done !== null,
    dispose: () => backdrop.remove(),
  };
}
