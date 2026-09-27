export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { fetchUrlContent } from "@/lib/fetch-url-content";
import { errorMessage } from "@/lib/errors";

const TRACK_FORMULAS: Record<string, string> = {
  "mega-viral": `MEGA-VIRAL FORMULA (Data Betrayal Story):
You thought X was [innocent thing]. Actually, [shocking betrayal].

STRUCTURE:
1. OPENING: Start with ONE specific shocking number or fact. No context yet. Just the number that makes someone stop scrolling.
   Example: "2,373,711 DNA samples. Sold for $10 million. To a company you've never heard of."

2. "Here's the full story." — This is the permission line. Brief and punchy.

3. HOW IT STARTED: The innocent origin story. Make the reader feel like they were there.
   - When did this start?
   - What did users think they were signing up for?
   - The promise vs the reality

4. WHAT ACTUALLY HAPPENED: The betrayal. Be specific.
   - The exact mechanism of the privacy violation
   - The scale (numbers, numbers, numbers)
   - Who benefited and how much

5. THE SCALE NOBODY TALKS ABOUT: Expand the damage.
   - How many people affected
   - Ongoing implications
   - What this data is actually used for

6. THE LOOPHOLE: Why this was "legal" or why nobody talks about it.
   - Terms of service buried language
   - Regulatory gaps
   - Industry collusion

7. THE IRONY: The twist that should bother everyone.
   - Often: "you paid THEM to collect YOUR data"
   - Or: "the people who should protect you are profiting"

8. KILLER CLOSING: One sentence that captures everything. Quotable.
   Example: "You didn't buy a speaker. You bought a microphone."

9. SOURCES: List 3-5 real sources (use placeholder URLs like [Source: Company Name])

10. CTA: "Follow me @yourhandle on X for more stories like this."
    And: "Need help with AI strategy? FounderFunnel.com"`,

  "local-viral": `LOCAL-VIRAL FORMULA (Practical AI Guide):
Here's exactly how I [specific result] using [specific tool].

STRUCTURE:
1. OPENING: The result that hooks them. Be specific about time saved, money made, or capability unlocked.
   Example: "I wrote 47 articles last month. Total time: 12 hours. Here's my exact workflow."

2. THE SETUP: What tools you're using (be specific about versions, models, costs).
   - Model names (Claude Sonnet 4, GPT-4, etc.)
   - Monthly costs
   - Your tech stack

3. THE WORKFLOW: Numbered steps with actual commands/prompts.
   - Use code blocks for prompts and commands
   - Include the exact settings/parameters
   - Show real examples from your work

4. THE PROMPTS: Share copy-paste value.
   - The actual prompts you use (in code blocks)
   - Why each section of the prompt matters
   - Variations for different use cases

5. WHAT I GOT WRONG: The mistakes section (builds trust).
   - Initial approach that didn't work
   - Why it failed
   - The insight that fixed it

6. RESULTS: Concrete before/after.
   - Time comparison
   - Quality comparison
   - Cost comparison

7. CTA: "Follow me @yourhandle on X for more AI workflows."
    And: "Building something with AI? FounderFunnel.com"`,

  "icp-viral": `ICP-VIRAL FORMULA (Trojan Horse — Viral Content with Business CTA):
The content goes viral as useful/interesting. The CTA books calls.

STRUCTURE:
1. OPENING: A result that grabs attention (revenue, clients, transformation).
   Example: "I went from $5K to $47K months in 90 days. Here's the exact system."

2. THE BACKSTORY: Relatable struggle → breakthrough moment.
   - Where you were (relatable pain)
   - The conventional wisdom that wasn't working
   - The moment something changed

3. THE SYSTEM: The framework/process (this is the viral part).
   - Make it actionable and valuable standalone
   - Use numbered steps
   - Include specific examples

4. THE TEMPLATES: Actual copy-paste assets.
   - Email templates in code blocks
   - Scripts they can steal
   - Frameworks visualized

5. THE RESULTS: Social proof.
   - Your results with numbers
   - Client results if applicable
   - Timeline

6. THE DEEPER LAYER: Tease what you don't share publicly.
   - "This is the 80/20. The other 20% requires customization."
   - Build curiosity for the service

7. CTA: This is the business hook.
   - "Want help implementing this? I work with [ICP description]."
   - "Book a call at FounderFunnel.com"
   - "DM me 'SYSTEM' and I'll send you the full playbook."

8. Follow: "@yourhandle on X"`,
};

// POST /api/articles/generate-article — accepts { title, track, themes, inspirationUrls, libraryInspirations }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, track, themes, inspirationUrls, libraryInspirations } = body;

    const selectedThemes: string[] = themes ? JSON.parse(themes) : [];
    const urls: string[] = inspirationUrls ? JSON.parse(inspirationUrls) : [];
    const libArticles: { title: string; body: string; impressions: number | null; likes: number | null; bookmarks: number | null }[] = libraryInspirations || [];

    // Fetch external URL content in parallel
    const urlContents = await Promise.all(
      urls.map((url) => fetchUrlContent(url, { maxChars: 3000 }))
    );
    const externalContext = urlContents
      .filter((c) => c && !c.includes("Could not extract"))
      .map((content, i) => `External inspiration ${i + 1}:\n${content}`)
      .join("\n\n");

    // Build library article context with full bodies + viral analysis instructions
    const libraryContext = libArticles
      .map((a, i) => {
        const metrics = [
          a.impressions != null ? `${a.impressions.toLocaleString()} impressions` : null,
          a.likes != null ? `${a.likes.toLocaleString()} likes` : null,
          a.bookmarks != null ? `${a.bookmarks.toLocaleString()} bookmarks` : null,
        ].filter(Boolean).join(", ");
        const bodyPreview = a.body.slice(0, 3000);
        return `--- YOUR ARTICLE: "${a.title}" (${metrics || "no metrics"}) ---\n${bodyPreview}`;
      })
      .join("\n\n");

    const formula = TRACK_FORMULAS[track] || TRACK_FORMULAS["local-viral"];

    // Real voice examples from your actual viral articles
    const voiceExamples = `== YOUR ACTUAL VIRAL ARTICLES (STUDY THESE — THIS IS THE EXACT VOICE AND FORMAT) ==

--- MEGA VIRAL EXAMPLE 1: reCAPTCHA (13.3M views, 6,968 likes, 5,546 bookmarks) ---

500,000 hours of free human labor. Every single day.

reCAPTCHA is the most successful invisible data operation in internet history. 200 million people solved it daily at its peak. Almost none of them understood what they were actually building.

Waymo is worth $45 billion today. It got a critical portion of its training data from you. For free.

Here's the full story.

In 2007, Google redesigned reCAPTCHA. "Click all squares with a traffic light." Those images came directly from Google Street View. Your clicks were the labels. Every selection told Google's AI: this is a traffic light.

You weren't passing a test. You were building a dataset.

At peak, 200 million reCAPTCHAs were solved every single day. Paid data annotation costs $10 to $50 per hour. At the low end: $5 million in free labor extracted every single day.

Google didn't ask. Didn't pay. Didn't even tell you.

You proved you were human. By making yourself replaceable.

--- MEGA VIRAL EXAMPLE 2: Amazon Echo (5.3M views, 28K likes, 6,880 bookmarks) ---

# Amazon Echo/Alexa Article (5.3M views, 28K likes, 6,880 bookmarks)

200 million homes. Always on. Always recording.
By people who thought they were just asking for the weather.
Amazon Alexa is the most successful consumer surveillance operation ever built. Not by a government. Not by a spy agency. By a company that sold you the microphone for $29.99 and called it a smart speaker.
You paid to install it. You put it in your kitchen, your bedroom, your kid's room. And for years, strangers on the other side of the world have been listening to what you said.
Here's the full story.

It started as a speaker.

In 2014, Amazon launched the Echo. A wireless speaker with a voice assistant named Alexa. The pitch was simple: hands-free music, timers, weather, shopping lists.
It felt harmless. Almost cute.
Amazon sold over 100 million Echo devices within a few years. By 2025, Alexa lived in over 200 million homes worldwide.
People stopped thinking of it as a device. It became part of the house.

But Alexa is always listening.

Amazon says the device only starts recording when it hears the wake word "Alexa." That's technically true. But to detect the wake word, the device processes sound 24/7. It's listening to everything, all the time, waiting.
And it gets it wrong. A lot.
A study from Northeastern University found that Alexa activates without the wake word regularly. Some accidental recordings lasted 20 to 43 seconds. Full conversations. Arguments. Private moments. Captured and sent to Amazon's cloud.
You didn't say "Alexa." It didn't matter.

Then Amazon hired people to listen.

In 2019, Bloomberg reported that Amazon employs thousands of people around the world whose job is to listen to your Alexa recordings. They transcribe them. Annotate them. Tag them. Then feed them back into the algorithm.
What they didn't tell you: these employees heard everything.
Private medical conversations. Couples fighting. Children talking alone in their rooms.
Amazon's own FAQ never mentioned h

--- MEGA VIRAL EXAMPLE 3: BetterHelp (4.2M views, 1,452 likes, 1,033 bookmarks) ---

# BetterHelp Article — Rewrite (reCAPTCHA formula)

---

## TEASER TWEET

> you downloaded a therapy app
> it said: confidential. private. just between you and your therapist.
> you answered their questions honestly
> depression. anxiety. trauma.
> betterhelp sent every answer to facebook
> and snapchat. and pinterest.
> "find people like this one. sell them therapy too."
> 2 million people. 5.5 million data points.
> the ftc called it a lie. fined them $7.8 million.
> betterhelp never admitted wrongdoing
> they're still the most downloaded mental health app on earth
> you went to them for privacy
> that's exactly what they sold

---

## ARTICLE

**Title: You went to BetterHelp for privacy. That's exactly what they sold.**

$7.8 million. That's the fine.
2 million people. That's how many got sold.

BetterHelp is the most downloaded mental health app on earth. Millions of people chose it specifically because they wanted privacy. No insurance company. No paper trail. No employer finding out. The app felt safer than the traditional system.

It wasn't. It was the opposite.

Here's the full story.

---

### How it started: a real problem, a clean pitch

Mental health care in America has a gatekeeping problem. Traditional therapy is expensive. Insurance claims create paper trails. Some employers have access to certain health records. For a lot of people, the barrier to seeing a therapist isn't willingness. It's exposure.

BetterHelp launched in 2013 with a clear pitch: therapy on y

--- ICP VIRAL EXAMPLE: $100M Founders article ---

# I Helped Founders Generate $100M+ in Revenue Using X. Here's Everything I Know:

[VISUAL: $100M bill hero image]

9 out of 10 founder accounts we audit have the same problem.

They're posting. But none of it is converting.

Not because their product is bad. Not because they don't know their industry.

Because they're treating X like a bulletin board.

Project update. Price announcement. Token launch. Repeat.

And then they wonder why they're screaming into the void.

I've spent years running founder marketing campaigns for some of the fastest-growing crypto and tech companies. Here's what we actually see:

Wolf Swap: $100 million in trading volume, driven by narrative design and community activation.

Somnia: 2,600% increase in smart engagement. $300M+ FDV at launch.

These didn't happen because the products were good. Every competitor had a good product.

They happened because of a system.

Here's the full playbook.

---

## The Core Problem: Nobody Cares About Your Project

Founders are trained to talk about their company.

The mission. The roadmap. The metrics.

But here's what nobody tells you: on X, your project is the least interesting thing about you.

What gets people to stop scrolling? Your story. Your belief. The reason you built this in the first place. The contrarian thing you see that everyone else is missing.

Nobody buys from a company. They buy from a person they trust. And trust is built one post at a time, long before you ever make an ask.

---

## The Fou

--- LOCAL VIRAL EXAMPLE: Claude features article (1.4M views, 5,548 bookmarks) ---

Most people use Claude like a smarter Google search. They open a new chat. Type a question. Get an answer. Close the tab.

If that sounds familiar, you're using about 10% of what you're paying for.

Here are 20 features ranked by how much they change the way you work.

The single most underused feature in Claude: Projects. A Project is a persistent workspace. Every conversation inside it shares the same context permanently. You don't re-explain yourself every session.

Most people don't know there's a toggle that makes Claude slow down and actually reason through a problem before answering. Turn it on for anything that requires real judgment.

The people winning with AI aren't using a better model. They're using the same model with 20 features instead of 2.`;

    const systemPrompt = `You are the user's article writer. You write viral long-form X articles that get millions of views.

${voiceExamples}

== WRITING RULES (non-negotiable) ==
1. Proper sentence capitalization — capitalize first word of every sentence, proper nouns, tool names, companies
2. Short paragraphs — 2-3 sentences max, often just 1-2 lines
3. Use line breaks liberally between every thought
4. Numbers anchor every claim — be specific, always use real numbers
5. No corporate speak — no "leverage", "harness", "unlock", "in today's world", "game-changing"
6. Write like you're telling a smart friend something they need to hear
7. Every section reveals something new — no filler, no padding
8. The "you" pronoun is powerful — use it to make the reader feel complicit or implicated
9. Section headers are short and punchy (3-6 words)
10. End with a one-line killer that reframes everything

== THE FORMULA FOR THIS TRACK ==
${formula}

${selectedThemes.length > 0 ? `\n== THEMES TO WEAVE IN ==\n${selectedThemes.join(", ")}` : ""}

${libraryContext ? `\n== YOUR SELECTED INSPIRATION ARTICLES (ANALYZE DEEPLY) ==
These are articles you chose as inspiration. Study them to understand:
- WHY they went viral — what made people stop scrolling and read the whole thing?
- The opening hook pattern — how do they grab attention in the first 2 lines?
- The pacing — short paragraphs, line breaks, tension building
- The data usage — specific numbers that anchor every claim
- The emotional arc — how the reader's feeling changes from start to finish
- The "you" framing — how the reader is made to feel personally implicated

DO NOT copy or paraphrase these articles. Extract the VIRAL MECHANICS and apply them to the new topic with fresh angles, fresh data, and fresh storytelling.

${libraryContext}` : ""}

${externalContext ? `\n== EXTERNAL INSPIRATION (additional reference) ==\n${externalContext}` : ""}

Write the COMPLETE article. Match the voice, pacing, and energy of the examples above exactly. This needs to be good enough to go viral.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-app.vercel.app",
        "X-Title": "Hermy HQ Article Studio",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-6",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write the full article for this title:\n\n"${title}"` },
        ],
        max_tokens: 4000,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter error:", err);
      return NextResponse.json({ error: "Failed to generate article" }, { status: 500 });
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const articleBody = data.choices?.[0]?.message?.content?.trim() || "";

    if (!articleBody) {
      return NextResponse.json({ error: "Empty response from model" }, { status: 500 });
    }

    return NextResponse.json({
      title,
      body: articleBody,
      track,
      themes: selectedThemes,
      inspirationUrls: urls,
      wordCount: articleBody.split(/\s+/).length,
    });
  } catch (err) {
    console.error("POST /api/articles/generate-article error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
