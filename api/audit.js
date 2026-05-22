const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

const BUYER_QUERIES = {
  drinkware: "best promo companies for custom branded tumblers and water bottles for a corporate event",
  totes: "where to order custom branded tote bags for a company conference",
  apparel: "best companies for custom branded polos and hoodies for a sales team"
};

const CATEGORY_LABELS = {
  drinkware: 'drinkware (tumblers & water bottles)',
  totes: 'tote bags',
  apparel: 'apparel (polo shirts & hoodies)'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { company, category } = req.body || {};

  if (!company || !category) {
    return res.status(400).json({ error: 'Missing required fields: company and category' });
  }

  const buyerQuery = BUYER_QUERIES[category];
  if (!buyerQuery) {
    return res.status(400).json({ error: 'Invalid category. Must be drinkware, totes, or apparel' });
  }

  const categoryLabel = CATEGORY_LABELS[category];

  try {
    // Call 1: OpenAI GPT-4o — simulate the buyer's query
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const openaiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a knowledgeable assistant helping corporate buyers find promotional products vendors. Be specific and helpful — name actual companies, include pricing when you know it, state minimum order quantities where relevant, and explain what makes each company a good choice. Format your response as a numbered list.'
        },
        {
          role: 'user',
          content: buyerQuery
        }
      ],
      max_tokens: 1200,
      temperature: 0.7
    });

    const openaiText = openaiResponse.choices[0]?.message?.content || '';

    // Call 2: Claude — analyze visibility and generate gap diagnosis
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const claudePrompt = `You are analyzing AI commerce visibility for a promotional products distributor.

A corporate buyer just searched ChatGPT for ${categoryLabel} and got this response:
${openaiText}

The distributor checking their visibility is: "${company}"

Return ONLY valid JSON with no other text, no markdown, no code blocks. Use this exact structure:

{
  "found": boolean — true if company name appears anywhere in the response (case insensitive),
  "found_but_weak": string or null — if found=true, one sentence explaining they appeared as a brand mention but without specific product listings or pricing that buyers need. If found=false set to null,
  "competitors": array of up to 4 objects — companies that DID appear in the response with details. Each object: { "name": string, "price": string or null (any dollar amount mentioned for that company), "detail": string (one specific thing that made them appear — a feature, MOQ, price, or capability they listed) },
  "key_competitor": object — the single competitor with the most specific details (has both pricing AND a specific feature). Same structure as competitors array items,
  "gap_reason": string — ONE specific sentence explaining why ${company} did not appear (or appeared without product data). Rules for this sentence: (1) must name a specific competitor from the results, (2) must reference a specific detail that competitor has such as a price or MOQ, (3) must name the specific missing field from ${company} such as minimum order quantity or bulk pricing, (4) must use plain language with no technical jargon — no mention of ACP feeds, structured data, or APIs, (5) must include ${company}'s name, (6) format: "${company} doesn't show [specific missing thing] on their product listings — [Competitor] appeared in this search because they clearly state [specific detail they have] which is what buyers need to see before they'll reach out.",
  "category_label": string — human readable category name
}

IMPORTANT: The gap_reason must feel personal and specific, not generic. Bad example: "Your product data is incomplete." Good example: "${company} doesn't list minimum order quantities on their drinkware pages — 4imprint appeared in this search because they clearly state pricing from $4.66 per unit at 100 pieces, which is exactly what a buyer ordering for 200 employees needs to see before they'll reach out."`;

    const claudeResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: claudePrompt
        }
      ]
    });

    const claudeText = claudeResponse.content[0]?.text || '';

    let analysisData;
    try {
      // Strip any accidental markdown code fences before parsing
      const cleaned = claudeText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      analysisData = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Claude JSON parse error:', parseErr.message, 'Raw:', claudeText.slice(0, 300));
      return res.status(500).json({ error: 'Failed to parse AI analysis. Please try again.' });
    }

    return res.status(200).json({
      openai_response: openaiText,
      buyer_query: buyerQuery,
      analysis: analysisData
    });

  } catch (err) {
    console.error('Audit error:', err.message);
    // Never expose keys or internal details
    return res.status(500).json({ error: 'The audit could not be completed. Please try again in a moment.' });
  }
};
