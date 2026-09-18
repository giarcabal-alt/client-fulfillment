// Ported from the prototype's scriptText() (recruiting-desk.html) — same
// message templates and placeholder shape, adapted to take
// companyName/recruiterName from org_settings/profiles (BUILD_BRIEF.md §5)
// instead of the prototype's local-storage settings object.

export type ScriptContext = {
  candidateName: string;
  roleTitle: string | null;
  companyName: string | null;
  recruiterName: string | null;
};

export function scriptFor(
  key: string | null,
  ctx: ScriptContext
): string | null {
  if (!key) return null;

  const name = ctx.candidateName || "[Candidate]";
  const role = ctx.roleTitle || "[Role]";
  const company = ctx.companyName || "[Company]";
  const you = ctx.recruiterName || "[Your Name]";

  const templates: Record<string, string> = {
    coldOutreach: `Hi ${name},

I'm ${you}, recruiting for ${role} at ${company}. Your background caught my eye — happy to share more if you're open to a quick conversation.

Not asking for a commitment, just 15 minutes to see if it's worth a real conversation. Open to a call this week or next?

${you}`,
    followup1: `Hi ${name} — following up in case this got buried. Totally understand if the timing's off. If you're curious at all about the ${role} role at ${company}, happy to send more detail or hop on a quick call. If not, no worries.`,
    followup2: `Hi ${name} — I'll stop here after this one. If the timing isn't right, totally understand. If you ever want to hear more about ${company} or just compare notes, my door's open — no agenda. Good luck with everything.`,
    phoneScreenScript: `[Send to candidate] Looking forward to our call — I'll walk through the ${role} role at ${company} and would love to hear what you're looking for next. Should take about 30 minutes.

[Your call outline]
- Open: How's your week going?
- "What's prompting you to look right now?"
- "Walk me through what you're working on day to day."
- "What does your ideal next step look like?"
- "What matters most in comp — base, equity, flexibility?"
- Pitch ${company} tailored to what they said
- Close: confirm next step + a specific follow-up date`,
    postScreenThankYou: `Hi ${name}, thanks again for the time today — really enjoyed hearing about your work. I'll have an update on next steps from our end soon. Let me know if anything comes up on your side in the meantime.`,
    statusUpdate: `Hi ${name} — quick update on the ${role} process: still finishing up on our end (nothing on you). Wanted to make sure you're not left wondering. I'll have something more concrete for you soon.`,
    verbalOffer: `[Call first, then send] Hi ${name}, great news — the team at ${company} would like to extend an offer for ${role}. Walking you through the details on our call, then I'll follow up in writing today. Congrats!`,
    offerCheckin1: `Hi ${name} — wanted to check in on the offer for ${role}. Happy to answer questions or jump on a call if useful.`,
    offerCheckin2: `Hi ${name} — following up ahead of the decision deadline. Anything I can clarify to help you decide on the ${role} offer?`,
    acceptanceConfirm: `Hi ${name}, thrilled to have you joining ${company} as ${role}! Sending next steps for paperwork shortly. Welcome to the team.`,
    preStartCheckin: `Hi ${name} — excited for your start date to come around. Any questions about logistics or what to expect on day one?`,
    day1Welcome: `Good morning ${name}! Welcome to ${company} — today's the day. I'll check in around midday to see how the morning's going. Excited to have you here.`,
    week1Checkin: `Hey ${name}, one week down — how's it feeling so far? Anything confusing or that I can help unblock?`,
    day30Checkin: `Hi ${name} — 30 days in. How's the role matching what we discussed during the interview process? Any feedback on the ramp-up so far?`,
    day60Checkin: `Hi ${name} — 60 days in. How are things settling? Anything you need more support on?`,
    day90Checkin: `Hi ${name} — 90 days in! How's it going overall, and any feedback on the hiring/onboarding process while it's fresh?`,
  };

  return templates[key] ?? null;
}
