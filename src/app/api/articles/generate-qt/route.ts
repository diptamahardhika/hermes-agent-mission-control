export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorMessage } from "@/lib/errors";

const QT_SYSTEM = `You write viral Quote Tweets (QTs) for your articles.

== THE PROVEN QT FORMAT ==
This format consistently gets millions of views:

> you [relatable action the reader has done]
> [what they thought was happening]
> [the reveal — what was actually happening]
> [escalating consequence]
> [the punchline that reframes everything]

== YOUR ACTUAL VIRAL QTs (STUDY THESE — THIS IS THE VOICE) ==

QT 1 — reCAPTCHA article (73M views, 6,968 likes):
you click "i am not a robot"
you think you're proving you're human
you're actually training Google's AI
for free
for 15 years
this is the full story:

QT 2 — Amazon Alexa article (5.3M views, 28K likes):
you buy an Echo for $29.99
you put it in your bedroom
Amazon hires thousands to listen
you didn't buy a speaker
you bought a microphone

QT 3 — 23andMe article:
you spit in a tube
you think you're learning about your ancestry
you're actually giving away your family's DNA
forever
here's what they did with it:

QT 4 — BetterHelp article (4.2M views, 1,452 likes):
you downloaded a therapy app
it said: confidential. private. just between you and your therapist.
you answered their questions honestly
depression. anxiety. trauma.
betterhelp sent every answer to facebook
and snapchat. and pinterest.
"find people like this one. sell them therapy too."
2 million people. 5.5 million data points.
the ftc called it a lie. fined them $7.8 million.
betterhelp never admitted wrongdoing
they're still the most downloaded mental health app on earth
you went to them for privacy
that's exactly what they sold

QT 5 — Google Photos article:
you stored the memories
they stored the faces

QT 6 — $100M Founders article (ICP viral):
9 out of 10 founder accounts we audit have the same problem
they're posting. but none of it is converting
not because their product is bad
because they're treating X like a bulletin board
here's the full playbook:

QT 7 — Claude features article (1.4M views, 5,548 bookmarks):
most people use Claude like a smarter Google search
open chat. type question. get answer. close tab.
if that sounds familiar
you're using about 10% of what you're paying for
here are 20 features ranked by impact:

== RULES (non-negotiable) ==
1. Start with "you [action]" — make it personal and relatable
2. Build tension line by line — each line hits harder
3. The final line REFRAMES everything the reader thought they knew
4. Keep each line short — under 50 characters ideally
5. 5-10 lines total (shorter is usually better)
6. End with a hook: "here's the full story:" or "here's what happened:" or similar
7. NO hashtags, NO emojis, NO "thread 🧵", NO quotation marks around the QT
8. Lowercase throughout (except proper nouns like Google, Amazon, etc.)
9. Use specific numbers when available — numbers stop the scroll
10. The "you" pronoun is mandatory — the reader must feel implicated

Output ONLY the QT text. No explanation, no quotes around it, no markdown.`;

// POST /api/articles/generate-qt — accepts { articleId } OR { title, body, track } for unsaved articles
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { articleId, title: directTitle, body: directBody, track: directTrack } = body;

    let articleTitle: string;
    let articleBody: string;
    let articleTrack: string;
    let shouldSave = false;

    if (articleId) {
      // Load from DB
      const article = await prisma.article.findUnique({ where: { id: articleId } });
      if (!article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }
      articleTitle = article.title;
      articleBody = article.body;
      articleTrack = article.track;
      shouldSave = true;
    } else if (directTitle && directBody) {
      // Direct body for unsaved articles (compose flow)
      articleTitle = directTitle;
      articleBody = directBody;
      articleTrack = directTrack || "local-viral";
    } else {
      return NextResponse.json({ error: "articleId or (title + body) required" }, { status: 400 });
    }

    // Fetch real QT examples from library (same track preferred)
    let libraryQtExamples = "";
    try {
      const exampleArticles = await prisma.article.findMany({
        where: {
          status: "posted",
          qtTweet: { not: null },
          track: articleTrack,
        },
        select: { title: true, qtTweet: true, impressions: true },
        orderBy: { impressions: "desc" },
        take: 5,
      });
      if (exampleArticles.length > 0) {
        libraryQtExamples = `\n\n== YOUR OWN VIRAL QTs FROM THE LIBRARY (study these — they performed) ==\n${exampleArticles
          .map((a, i) => `QT for "${a.title}" (${a.impressions?.toLocaleString() || "?"} impressions):\n${a.qtTweet}`)
          .join("\n\n")}`;
      }
    } catch {}

    // Get first 1500 chars of article body for context
    const articlePreview = articleBody.slice(0, 1500);

    const userPrompt = `Write ONE viral QT for this article.

TITLE: ${articleTitle}
TRACK: ${articleTrack}

ARTICLE BODY (preview):
${articlePreview}

Generate the perfect QT that will make people NEED to click through and read the full article. Follow the "you [action]" format exactly. Match the energy and voice of the examples in your instructions.
${libraryQtExamples}`;

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
          { role: "system", content: QT_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter error:", err);
      return NextResponse.json({ error: "Failed to generate QT" }, { status: 500 });
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const qtTweet = data.choices?.[0]?.message?.content?.trim() || "";

    if (!qtTweet) {
      return NextResponse.json({ error: "Empty response from model" }, { status: 500 });
    }

    // Update the article with the generated QT if it's saved
    if (shouldSave && articleId) {
      await prisma.article.update({
        where: { id: articleId },
        data: { qtTweet },
      });
    }

    return NextResponse.json({
      articleId: articleId || null,
      qtTweet,
      title: articleTitle,
      track: articleTrack,
    });
  } catch (err) {
    console.error("POST /api/articles/generate-qt error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
