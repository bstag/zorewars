// The model-response contract and screening phase. Malformed responses keep
// their token usage; individual bad drafts do not discard later valid drafts.
export async function requestProposal(propose, request) {
  const response = await propose(request);
  if (!Array.isArray(response?.variants)) {
    throw Object.assign(new Error('the model did not submit an array of variants'), { usage: response?.usage });
  }
  return response;
}

export async function screenProposals(variants, { limit, seed, draft, judge }) {
  const ranked = [], failures = [];
  for (const variant of variants.slice(0, limit)) {
    if (typeof variant?.idea !== 'string' || typeof variant?.redcode !== 'string') {
      failures.push({ idea: typeof variant?.idea === 'string' ? variant.idea : 'unnamed rewrite', outcome: 'rewrite needs idea and redcode strings' });
      continue;
    }
    let w;
    try { w = draft(variant.redcode); }
    catch (error) { failures.push({ idea: variant.idea, outcome: error.message }); continue; }
    const result = await judge(w, seed);
    ranked.push({ ...variant, w, screen: result.fit, text: result.text });
  }
  ranked.sort((a, b) => b.screen - a.screen);
  return { ranked, failures };
}
