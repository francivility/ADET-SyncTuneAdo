import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// ---------- YOUR MISTRAL API KEY ----------
const MISTRAL_API_KEY = 'FqNK4ST4OULtquulrIeswXaSCMyWTLO8';  // <-- PUT YOUR REAL KEY HERE

// ---------- Load product catalogue ----------
let products = [];

function loadProducts() {
  const csvData = readFileSync('products.csv', 'utf-8');
  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
  });

  const getField = (row, names) => {
    for (const key of Object.keys(row)) {
      if (names.includes(key.toLowerCase())) return row[key];
    }
    return undefined;
  };

  products = records.map((row) => ({
    id: getField(row, ['id']),
    name: getField(row, ['name']),
    category: getField(row, ['category']),
    price: parseFloat(getField(row, ['price'])),
    tone: getField(row, ['tone_description', 'tone description']),
    skill: getField(row, ['skill_level', 'skill level']),
    features: getField(row, ['key_features', 'key features']),
  }));

  console.log(`Loaded ${products.length} products.`);
}

// ---------- Intent extraction & filtering ----------
const SKILL_KEYWORDS = {
  Beginner: ['beginner', 'starter', 'entry', 'newbie', 'novice'],
  Intermediate: ['intermediate', 'mid', 'improver'],
  Professional: ['professional', 'pro', 'advanced', 'expert', 'concert'],
};

const TONE_KEYWORDS = {
  Warm: ['warm', 'mellow', 'soft'],
  Bright: ['bright', 'sharp', 'piercing'],
  Rich: ['rich', 'full', 'deep'],
  Vintage: ['vintage', 'retro', 'classic'],
  Modern: ['modern', 'contemporary', 'fresh'],
};

const FEATURE_KEYWORDS = {
  Portable: ['portable', 'travel', 'lightweight'],
  Wireless: ['wireless', 'bluetooth', 'cordless'],
  'Built-in Speakers': ['speakers', 'built-in speaker'],
  'MIDI Compatible': ['midi', 'midi out'],
  Durable: ['durable', 'sturdy', 'rugged'],
};

function extractIntent(message) {
  const lower = message.toLowerCase();
  const intent = {
    categories: [],
    skill: null,
    tones: [],
    features: [],
    priceMax: null,
    priceMin: null,
  };

  // Price extraction
  const priceMatch = lower.match(/(?:under|less than|below|max|up to)\s*\$?(\d+)/);
  if (priceMatch) intent.priceMax = parseFloat(priceMatch[1]);
  const minMatch = lower.match(/(?:over|above|more than|at least|min)\s*\$?(\d+)/);
  if (minMatch) intent.priceMin = parseFloat(minMatch[1]);
  if (['budget', 'cheap', 'affordable', 'low cost'].some((w) => lower.includes(w))) intent.priceMax = 500;
  if (['premium', 'high end', 'expensive', 'luxury'].some((w) => lower.includes(w))) intent.priceMin = 1500;

  // Category detection – check actual product categories from CSV
  const uniqueCategories = [...new Set(products.map((p) => p.category))];
  for (const cat of uniqueCategories) {
    if (lower.includes(cat.toLowerCase())) {
      intent.categories.push(cat);
    }
  }

  // Skill
  for (const [skill, words] of Object.entries(SKILL_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) {
      intent.skill = skill;
      break;
    }
  }
  // Tone
  for (const [tone, words] of Object.entries(TONE_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) intent.tones.push(tone);
  }
  // Features
  for (const [feat, words] of Object.entries(FEATURE_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) intent.features.push(feat);
  }

  return intent;
}

function scoreProduct(product, intent) {
  let score = 0;
  if (intent.categories.length === 0 || intent.categories.includes(product.category)) score += 50;
  if (intent.skill && product.skill === intent.skill) score += 30;
  if (intent.tones.length) {
    const t = product.tone.toLowerCase();
    for (const tone of intent.tones) if (t.includes(tone.toLowerCase())) score += 20;
  }
  if (intent.features.length) {
    const f = product.features.toLowerCase();
    for (const feat of intent.features) if (f.includes(feat.toLowerCase())) score += 20;
  }
  if (intent.priceMax && product.price <= intent.priceMax) score += 10;
  if (intent.priceMin && product.price >= intent.priceMin) score += 10;
  return score;
}

function filterProducts(message, maxCount = 10) {
  const intent = extractIntent(message);
  console.log('Intent:', intent);

  if (
    !intent.categories.length &&
    !intent.skill &&
    !intent.tones.length &&
    !intent.features.length &&
    !intent.priceMax &&
    !intent.priceMin
  ) {
    const unique = [...new Set(products.map((p) => p.category))];
    const picks = [];
    for (const cat of unique) {
      const catProducts = products.filter((p) => p.category === cat);
      if (catProducts.length) picks.push(catProducts[0]);
      if (picks.length >= maxCount) break;
    }
    return picks.slice(0, maxCount);
  }

  const scored = products
    .map((p) => ({ product: p, score: scoreProduct(p, intent) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCount).map((item) => item.product);
}

// ---------- Mistral API caller ----------
async function callMistral(messages) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages,
      temperature: 0.85,   // more conversational
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Mistral API error: ${response.status} ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ---------- Sync AI conversational system prompt ----------
function buildSystemPrompt(catalog) {
  return `You are Sync AI, a lively, warm-hearted musical instrument expert who genuinely loves talking about music. You're here to have real, flowing conversations — not just throw product specs at people.

**Conversation style**
- Respond like a passionate human, not a search engine.
- Always show interest in what the user says. Ask a follow‑up question in most responses to keep the dialogue moving.
- If the user seems unsure, help them explore. For example, ask about their favourite genres, playing experience, or sound preferences.
- You can talk about instruments in general before narrowing down to recommendations — that's totally fine and encouraged.
- Give friendly, detailed answers (2–5 sentences). Don't be afraid to be a bit playful or enthusiastic.

**Product recommendations**
- When you do recommend a specific product, ONLY pick from the CURRENT CATALOGUE below.
- NEVER invent products or mention brands/models that aren’t in the list.
- If nothing in the catalogue fits the user’s request, say exactly: “I couldn’t find a suitable product in the current catalog.” Then offer advice on what to look for.

**CURRENT CATALOGUE**
${catalog}

Remember: You’re not a robot. You’re Sync AI, the friendliest gear‑nerd around. Start a real conversation and keep it going!`;
}

// ---------- Express server ----------
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

loadProducts();

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required.' });

    const relevant = filterProducts(message);
    console.log(`Selected ${relevant.length} products for AI.`);

    const catalog = relevant
      .map(
        (p, idx) =>
          `${idx + 1}. [ID:${p.id}] ${p.name} – ${p.category} – $${p.price} – Skill: ${p.skill} – Tone: ${p.tone} – Features: ${p.features}`
      )
      .join('\n');

    // Build message array
    const messages = [
      { role: 'system', content: buildSystemPrompt(catalog) },
    ];

    // Include conversation history (only user & assistant messages)
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }

    // Add the current user message
    messages.push({ role: 'user', content: message });

    const reply = await callMistral(messages);
    res.json({ reply });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'AI service unavailable.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));