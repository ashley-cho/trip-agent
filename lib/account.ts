/**
 * Is this deployment stopped, or just unlucky?
 *
 * The rules driver is the floor, and the floor is supposed to be quiet: one
 * dropped connection does not deserve a paragraph in the middle of planning a
 * trip. Two things are not that, and both were discovered the same way — by
 * somebody using the app for an hour and being answered by regexes without
 * being told.
 *
 *   "auth"    the key is rejected. 401, 403, authentication_error.
 *   "billing" the account has no credit. Anthropic sends this as a 400
 *             invalid_request_error, which is the same status code a
 *             malformed request gets.
 *
 * That second one is the whole reason this file exists rather than a regex at
 * the call site. The first version of this check matched 401 and nothing else,
 * because a rejected key was the failure I had actually seen. When the credit
 * ran out, the 400 matched nothing, the app fell back silently, and sixty
 * research runs' worth of dogfooding could have gone into the rules floor
 * without a word. A matcher that only covers the failure you have already met
 * is not a matcher, it is a note about last time.
 *
 * So the question this asks is not which status code arrived. It is: will
 * this fix itself, and is the person running the deployment the only one who
 * can do anything about it? Both of these are permanent until she acts.
 *
 * Exported and pure so the test can hand it the exact strings the API really
 * returned, rather than grepping the component for a variable name — which is
 * how the gap got shipped: the old test asserted that a source line existed,
 * and the source line existed, and the app was broken anyway.
 */
export type AccountStop = "auth" | "billing";

const AUTH = /\b401\b|\b403\b|authentication_error|invalid x-api-key|permission_error/i;
const BILLING = /credit balance|billing|\bquota\b|payment|insufficient[_ ]?funds|plans ?& ?billing/i;

export function accountStopped(reason: string | undefined): AccountStop | undefined {
  if (!reason) return undefined;
  // Billing first: an out-of-credit body can carry the word "permission" from
  // an unrelated sentence, and telling her the key is bad when the key is fine
  // sends her to the wrong page.
  if (BILLING.test(reason)) return "billing";
  if (AUTH.test(reason)) return "auth";
  return undefined;
}

/** What she reads. One sentence for the cause, one shared explanation. */
export function accountStopSays(stop: AccountStop): string {
  const cause = stop === "billing"
    ? "this deployment's Anthropic account is out of credit"
    : "the key this deployment is configured with is being rejected";
  return `One thing you should know before we go further: ${cause}, so I'm answering with `
    + "pattern matching rather than a model. Scheduling, opening hours and costs are the same "
    + "either way, but I can't research anywhere new and I won't read you as well. "
    + "Worth fixing before you judge me on it.";
}
