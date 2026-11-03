// A small "(?)" toggle that shows or hides an explanation line. The button is a real <button> with
// aria-expanded and aria-controls and a 44px tap target; the circle you see is smaller than the
// target. Open state lives in the factory, so a panel that rebuilds its rows keeps tips open.

export interface InfoTip {
  /** The (?) button. */
  readonly button: HTMLButtonElement;
  /** The explanation, hidden until the button is pressed. */
  readonly note: HTMLElement;
  /** Replaces the explanation text (the tip hides itself when the text is empty). */
  setText(text: string): void;
}

export type InfoTipFactory = (
  key: string,
  text: string,
  about: string,
) => InfoTip;

let counter = 0;

/** A factory whose tips remember if they are open, by key. */
export function createInfoTips(): InfoTipFactory {
  const open = new Map<string, boolean>();
  return (key, text, about) => {
    const id = `zw-tip-${++counter}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "zw-tip-btn";
    button.dataset.tip = key;
    button.setAttribute("aria-controls", id);
    button.setAttribute("aria-label", `About ${about}`);
    button.title = `About ${about}`;
    const dot = document.createElement("span");
    dot.className = "zw-tip-dot";
    dot.setAttribute("aria-hidden", "true");
    dot.textContent = "?";
    button.append(dot);
    const note = document.createElement("div");
    note.id = id;
    note.className = "zw-tip-note";
    let body = text;
    const sync = () => {
      const shown = open.get(key) === true && body !== "";
      button.setAttribute("aria-expanded", String(shown));
      button.style.display = body === "" ? "none" : "";
      note.hidden = !shown;
      note.textContent = body;
    };
    button.addEventListener("click", () => {
      open.set(key, open.get(key) !== true);
      sync();
    });
    sync();
    return {
      button,
      note,
      setText(next) {
        body = next;
        sync();
      },
    };
  };
}
