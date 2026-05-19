import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface ClassifyRequest {
  url: string;
  page_title: string;
  user_task: string;
}

export interface ClassifyResponse {
  productive: boolean;
  reason: string;
  confidence: number;
}

/**
 * Task 1: Classify whether a page is on-task or off-task using Gemini.
 * Caches results by (domain, user_task) for 24 hours to reduce API calls.
 */
export async function classifyPage(req: ClassifyRequest): Promise<ClassifyResponse> {
  let domain: string;
  try {
    domain = new URL(req.url).hostname.replace('www.', '');
  } catch {
    domain = req.url || 'unknown';
  }

  // Check cache first
  const { data: cached } = await supabase
    .from('classification_cache')
    .select('productive, reason, confidence, expires_at')
    .eq('domain', domain)
    .eq('user_task', req.user_task)
    .single();

  if (cached && new Date(cached.expires_at) > new Date()) {
    return {
      productive: cached.productive,
      reason: cached.reason,
      confidence: cached.confidence,
    };
  }

  // Call Gemini
  const prompt = `You are a productivity classifier. Determine if visiting this website is productive/relevant for the user's task.

User's task: "${req.user_task}"
Website domain: ${domain}
Page title: "${req.page_title || 'unknown'}"

Respond in this EXACT JSON format only (no markdown, no extra text):
{"productive": true/false, "reason": "one sentence explanation", "confidence": 0.0-1.0}

Rules:
- If the page content could reasonably help with the user's task, mark productive=true
- YouTube watching a tutorial related to the task = productive
- Social media, entertainment, news (unless task-related) = not productive
- Documentation, educational content, tools = generally productive
- Be generous — if there's a reasonable connection, err on the side of productive`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Parse JSON from response (handle potential markdown wrapping)
    const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    const response: ClassifyResponse = {
      productive: !!parsed.productive,
      reason: parsed.reason || 'No reason provided',
      confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
    };

    // Cache the result (upsert by domain + user_task)
    await supabase.from('classification_cache').upsert({
      domain,
      user_task: req.user_task,
      page_title: req.page_title,
      productive: response.productive,
      reason: response.reason,
      confidence: response.confidence,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'domain,user_task' });

    return response;
  } catch (err: any) {
    console.error('[Classify] AI error:', err.message);
    // Default to not productive if classification fails
    return {
      productive: false,
      reason: 'Classification unavailable — defaulting to nudge',
      confidence: 0.3,
    };
  }
}

/** Invalidate a cached classification (user feedback: "This is wrong") */
export async function invalidateClassification(domain: string, userTask: string) {
  await supabase
    .from('classification_cache')
    .delete()
    .eq('domain', domain)
    .eq('user_task', userTask);
}
