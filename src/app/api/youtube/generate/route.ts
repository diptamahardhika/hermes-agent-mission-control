import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function callOpenAI(apiKey: string, payload: object, timeout = 45000): string {
  const tmpFile = path.join('/tmp', `yt-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(payload));
  try {
    return execSync(
      `curl -s -X POST "https://api.openai.com/v1/chat/completions" -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json" -d @${tmpFile}`,
      { timeout, encoding: 'utf-8' }
    );
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ok */ }
  }
}

function braveSearch(query: string, braveKey: string, count = 5): { title: string; url: string; description: string }[] {
  try {
    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
    const res = execSync(
      `curl -s "${searchUrl}" -H "Accept: application/json" -H "X-Subscription-Token: ${braveKey}"`,
      { timeout: 10000, encoding: 'utf-8' }
    );
    const data = JSON.parse(res);
    return (data.web?.results || []).map((r: any) => ({ title: r.title, url: r.url, description: r.description }));
  } catch {
    return [];
  }
}

function fetchArticle(url: string): string {
  try {
    const raw = execSync(
      `curl -s -L --max-time 10 "${url}" | sed 's/<script[^>]*>.*<\\/script>//g; s/<style[^>]*>.*<\\/style>//g; s/<[^>]*>//g' | head -c 5000`,
      { timeout: 15000, encoding: 'utf-8' }
    );
    return raw.replace(/\s+/g, ' ').trim().slice(0, 3000);
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  const { topic, sourceUrl, sourceSummary } = await req.json();
  if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY || '';
  const braveKey = process.env.BRAVE_API_KEY || '';
  if (!apiKey) return NextResponse.json({ error: 'No API key' }, { status: 500 });

  // Load reference materials
  let johnPrompt = '';
  try { johnPrompt = fs.readFileSync('./data/john-prompt.md', 'utf-8'); } catch { /* ok */ }

  // Load past scripts as style/topic reference
  let pastScriptsRef = '';
  try {
    const raw = fs.readFileSync('./data/scripts-full.md', 'utf-8');
    pastScriptsRef = `\n\n## PAST SCRIPTS (study these for tone, topic variety, and style)\nHere are 50+ scripts the user already filmed. Notice the WIDE variety. Most are mainstream brands (Red Bull, Nike, Barbie, Tesla, McDonald's, Apple, etc.) with a business/marketing lesson. NEW scripts should follow this same pattern: mainstream hook, then founder lesson.\n${raw.slice(0, 3000)}`;
  } catch { /* ok */ }

  // Load ALL feedback (rejections + approvals) to learn from
  let feedbackContext = '';
  try {
    const feedback = JSON.parse(fs.readFileSync('./data/youtube-feedback.json', 'utf-8'));
    const scriptFeedback = feedback.filter((f: { type?: string }) => f.type === 'script' || !f.type);
    if (scriptFeedback.length > 0) {
      const rejections = scriptFeedback.filter((f: { reason?: string }) => f.reason).slice(-20);
      feedbackContext = `\n\n## CRITICAL: LEARN FROM PAST FEEDBACK\nThe user has reviewed scripts before. Here's what they rejected and WHY. Do NOT repeat these mistakes:\n${rejections.map((f: { title?: string; reason?: string }) => `- REJECTED "${f.title}": ${f.reason}`).join('\n')}\n\nKey patterns from feedback:\n- Don't sound "too AI" or "too polished" — write like a real person talking\n- Always name the SPECIFIC brand/person — never be vague ("a company", "one firm")\n- Every claim must be real and verifiable — no made-up stories\n- Don't reference old/stale trends as if they're new\n- No generic motivational endings or "download my free guide" CTAs\n- The story must have substance and real value, not just a clickbait hook`;
    }
  } catch { /* ok */ }

  // ── STEP 1: Gather real source material BEFORE writing ──
  const sourceUrls: string[] = [];
  let sourceContext = '';

  // 1a. Fetch the primary source article if we have a sourceUrl
  if (sourceUrl) {
    sourceUrls.push(sourceUrl);
    const articleText = fetchArticle(sourceUrl);
    if (articleText) {
      sourceContext += `\n\n## PRIMARY SOURCE ARTICLE (from ${sourceUrl}):\n${articleText}`;
    }
  }

  // 1b. Generate search queries for additional context
  const keyClaimsResult = callOpenAI(apiKey, {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Extract 3 specific search queries to verify and gather more context about this video topic. Return JSON: {"queries":["query1","query2","query3"]}' },
      { role: 'user', content: `Topic: ${topic}${sourceSummary ? `\nSource summary: ${sourceSummary}` : ''}` }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  }, 15000);

  let additionalQueries: string[] = [];
  try {
    const kc = JSON.parse(keyClaimsResult);
    additionalQueries = JSON.parse(kc.choices[0].message.content).queries || [];
  } catch { /* ok */ }

  // 1c. Run additional Brave searches
  for (const query of additionalQueries.slice(0, 3)) {
    if (!braveKey) break;
    const results = braveSearch(query, braveKey, 3);
    if (results.length > 0) {
      sourceContext += `\n\n## SEARCH: "${query}"\n${results.map(r => {
        sourceUrls.push(r.url);
        return `- ${r.title} (${r.url})\n  ${r.description}`;
      }).join('\n')}`;
    }
  }

  // ── STEP 2: Generate script with REAL source material ──
  const systemPrompt = `You are a viral short-form scriptwriter for the user, a founder and content creator.\n\n## YOUR PERSONALITY (from John)\n${johnPrompt.slice(0, 1500)}\n\n## CRITICAL: FACT-FIRST APPROACH\nYou have been given REAL source material gathered from web searches and articles. \n|- ONLY use facts that appear in the source material below\n|- DO NOT add any facts, numbers, dates, quotes, or claims not supported by the sources\n|- If you need to generalize because exact data isn't available, use hedging language ("reportedly", "around", "roughly")\n|- If the sources don't have enough detail for a section, keep it shorter rather than inventing details\n\n## SOURCE MATERIAL (verified):\n${sourceContext || "No sources available — be EXTRA cautious with claims, hedge everything."}\n\n## SCRIPT RULES\n|- Target length: 1-2 minutes when read aloud (~150-280 words)\n|- Written as SPOKEN WORD but WITH normal punctuation (commas, periods, question marks).\n|- Every line earns its place. Zero filler.\n|- Use the Hero's Journey: Hook → Story/Setup → Conflict/Pivot → Insight/Payoff → CTA → Caption\n|- Reference REAL pop culture brands/people/stories — must be factually accurate\n|- Always tie back to a lesson for founders, creators, or builders\n\n## HOOK RULES\n|- TOF hooks: Wide appeal, recognizable products/brands, desired outcomes\n|- "I did X, unexpected Y happened" = powerful hook format\n|- Call out common mistakes or counter common assumptions\n|- Use cultural icons, pop brands, unexpected comparisons\n|- Start like a viral rant — deliver massive insight up top\n\n## SCRIPT STRUCTURE\n1. HOOK — Scroll-stopping (first 3 seconds decide everything)\n2. STORY SETUP — Context, backstory, make viewer invested\n3. CONFLICT — Create tension, counter assumptions\n4. INSIGHT/PAYOFF — The aha moment, the lesson\n5. CTA — ONE clear action only\n6. CAPTION — One-line summary without spoilers\n\n## FACTUAL ACCURACY\n|- Include a "factClaims" array listing every specific factual claim in the script (dates, numbers, events, quotes)\n|- Each claim MUST be traceable to the source material above\n\n## THE USER'S ANGLE\n|- Runs a marketing-focused business\n|- Content: founder branding, marketing, distribution > product, culture > features\n|- Voice: conversational, no fancy words, lowercase energy, real numbers, honest/vulnerable\n${pastScriptsRef}\n${feedbackContext}\n\nOUTPUT FORMAT — valid JSON only:\n{
  "title": "Brand/Person — Core Lesson (short)",
  "hook": "Opening 2-4 lines. Scroll-stopping.",
  "storySetup": "The backstory context. 3-5 sentences.",
  "conflict": "The tension pivot or controversial statement. 3-5 sentences.",
  "insight": "The aha moment payoff lesson for founders. 3-5 sentences.",
  "cta": "One clear action. One line.",
  "caption": "One punchy line without spoilers.",
  "onScreenText": "What appears on screen during the hook",
  "hookType": "observation|experience|expert|controversial",
  "funnelStage": "TOF|MOF|BOF",
  "factClaims": ["Claim 1: specific fact used in script", "Claim 2: ..."]
}`;

  const genResult = await callOpenAI(apiKey, {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Write a 1-2 minute viral short-form video script about: ${topic}\n\nMake the hook FIRE. Make every line earn its place. ONLY use facts from the provided source material.` }
    ],
    temperature: 0.85,
    response_format: { type: 'json_object' }
  }, 60000);

  const genData = JSON.parse(genResult);
  const script = JSON.parse(genData.choices[0].message.content);
  const factClaims: string[] = script.factClaims || [];
  delete script.factClaims;

  // ── STEP 3: Fact-check via web search (safety net) ──
  let factCheck: { status: string; issues: string[]; verified: string[]; sourceUrls: string[] } = {
    status: '✅', issues: [], verified: [], sourceUrls: [...new Set(sourceUrls)]
  };

  if (factClaims.length > 0) {
    try {
      const searchResults: string[] = [];
      for (const claim of factClaims.slice(0, 5)) {
        try {
          const results = braveSearch(claim, braveKey, 3);
          const snippets = results.map(r => `${r.title}: ${r.description}`).join(' | ');
          searchResults.push(`Claim: ${claim}\nSearch results: ${snippets || 'No results found'}`);
        } catch {
          searchResults.push(`Claim: ${claim}\nSearch results: SEARCH FAILED — mark as uncertain`);
        }
      }

      const checkResult = await callOpenAI(apiKey, {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are a strict fact-checker. You will receive claims paired with REAL web search results. Use ONLY the search results to determine if each claim is CORRECT, INCORRECT, or UNCERTAIN. Do NOT rely on your own knowledge — only what the search results show. Be very strict: if search results don't clearly confirm a claim, mark it UNCERTAIN.\n\nReturn JSON: { "results": [{ "claim": "...", "verdict": "correct|incorrect|uncertain", "correction": "only if incorrect/uncertain, what the real fact is based on search results" }] }` },
          { role: 'user', content: `Fact-check these claims using the provided search results:\n\n${searchResults.join("\n\n")}` }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      }, 30000);

      const checkData = JSON.parse(checkResult);
      const checks = JSON.parse(checkData.choices[0].message.content);

      for (const r of checks.results || []) {
        if (r.verdict === 'correct') {
          factCheck.verified.push(r.claim);
        } else {
          factCheck.issues.push(`${r.verdict.toUpperCase()}: ${r.claim}${r.correction ? ` → ${r.correction}` : ''}`);
        }
      }

      if (factCheck.issues.length > 0) factCheck.status = '⚠️';

      // ── STEP 4: If issues found, regenerate with corrections ──
      if (factCheck.issues.length > 0) {
        const fixResult = await callOpenAI(apiKey, {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You fix factual errors in video scripts. Return the SAME JSON structure with corrected facts. Keep the style, voice, and structure identical — only fix the wrong facts.' },
            { role: 'user', content: `Here's a script with factual issues:\n${JSON.stringify(script)}\n\nIssues found:\n${factCheck.issues.join("\n")}\n\nFix ONLY the factual errors. Return valid JSON with same keys: title, hook, storySetup, conflict, insight, cta, caption, onScreenText, hookType, funnelStage` }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        }, 30000);

        const fixData = JSON.parse(fixResult);
        const fixed = JSON.parse(fixData.choices[0].message.content);
        Object.assign(script, fixed);
        factCheck.status = '🔧';
      }
    } catch {
      factCheck.status = '❓';
      factCheck.issues.push('Fact-check failed — review manually');
    }
  }

  return NextResponse.json({
    id: `gen-${Date.now()}`,
    ...script,
    factCheck: {
      status: factCheck.status,
      verified: factCheck.verified.length,
      issues: factCheck.issues,
      sourceUrls: factCheck.sourceUrls,
    },
    status: 'draft',
    createdAt: new Date().toISOString().split('T')[0],
  });
}