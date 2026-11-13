/**
 * The epilogue: a short, hopeful information screen about curative options, reached from the
 * Arc 2 summary. The claims come only from the pitch ("Curative treatments") and clinician
 * questions 14-17. It is a draft until a clinician has reviewed it, and one flag hides it.
 */

/** The one switch: false hides the epilogue (no button, no screen). `?epilogue=0|1` overrides it. */
export const EPILOGUE_ENABLED = true;

export function parseEpilogue(
  params: URLSearchParams,
  fallback: boolean = EPILOGUE_ENABLED,
): boolean {
  const v = params.get("epilogue");
  return v === "0" ? false : v === "1" ? true : fallback;
}

/** Read once from the first URL and kept for the page session, like facilitator mode. */
export const epilogue = { on: EPILOGUE_ENABLED };

export function initEpilogue(params: URLSearchParams): void {
  epilogue.on = parseEpilogue(params);
}

export const EPILOGUE_LABEL = "What comes next";
export const EPILOGUE_DRAFT = "Draft: pending clinical review";
export const EPILOGUE_BACK = "Back to your summary";

const PARAGRAPHS: readonly string[] = [
  "Bone marrow transplant and gene therapy are real options for CGD. They keep changing, and the choice is made together with your care team.",
  "After one of them works, there is no more prophylaxis medicine, restrictions ease to what anyone else has, and the immune response is about normal.",
  "The process can be long and arduous, and it looks different for each person.",
  "Gene therapy does not have to correct every cell. In early results, roughly 20 to 30 percent corrected cells looked like enough, and one recent patient reached about 70 percent.",
  "This is information, not medical advice. Your care team knows your situation, so talk with them about anything here.",
];

export interface EpilogueCard {
  readonly title: string;
  readonly draft: string;
  readonly paragraphs: readonly string[];
}

export function epilogueCard(): EpilogueCard {
  return {
    title: EPILOGUE_LABEL,
    draft: EPILOGUE_DRAFT,
    paragraphs: PARAGRAPHS,
  };
}
