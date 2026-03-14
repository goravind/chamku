const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

/**
 * Parse user input into subtasks without AI.
 * Handles: "1. Step one\n2. Step two" or "Step one, Step two" or "Step one\nStep two"
 */
function parseSubtasksFromText(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Try numbered list: 1. X, 2. Y or 1) X, 2) Y
  const numberedMatch = trimmed.match(/^\d+[.)]\s*.+$/gm);
  if (numberedMatch?.length) {
    return numberedMatch.map((s) => s.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
  }

  // Try newline-separated
  const lines = trimmed.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (lines.length > 1) return lines;

  // Try comma-separated
  const commaSplit = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  if (commaSplit.length > 1) return commaSplit;

  // Single item
  return [trimmed];
}

/**
 * Generate subtasks using OpenAI API
 */
async function generateWithOpenAI(taskTitle, userPrompt) {
  if (!OPENAI_API_KEY) return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You help break down relocation tasks into subtasks. Return ONLY a JSON array of strings, no other text. Example: ["Subtask 1", "Subtask 2", "Subtask 3"]`,
        },
        {
          role: 'user',
          content: `Task: "${taskTitle}"\n\nUser request: "${userPrompt}"\n\nReturn a JSON array of 3-8 specific, actionable subtasks for this relocation task.`,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('No response from AI');

  // Extract JSON array (handle markdown code blocks)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  const jsonStr = jsonMatch ? jsonMatch[0] : content;
  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) throw new Error('Invalid response format');
  return parsed.map((s) => (typeof s === 'string' ? s.trim() : String(s))).filter(Boolean);
}

/**
 * Check if input looks like a manual list (user typed items, not a request to AI)
 */
function looksLikeList(text) {
  const t = text.trim();
  return (
    /^\d+[.)]\s/m.test(t) || // "1. X" or "1) X"
    (t.includes('\n') && t.split('\n').filter((s) => s.trim()).length > 1) ||
    (t.includes(',') && t.split(',').length > 1)
  );
}

/**
 * Generate subtasks - uses OpenAI for natural language, parses manual lists
 */
export async function generateSubtasks(taskTitle, userPrompt) {
  const hasOpenAI = !!OPENAI_API_KEY;

  // If user typed a clear list, parse it (free, instant)
  if (looksLikeList(userPrompt)) {
    return parseSubtasksFromText(userPrompt);
  }

  // Natural language request → use OpenAI if available
  if (hasOpenAI && userPrompt.trim().length > 5) {
    try {
      return await generateWithOpenAI(taskTitle, userPrompt);
    } catch (err) {
      console.error('OpenAI error:', err);
      throw err;
    }
  }

  // Fallback: parse whatever they typed
  return parseSubtasksFromText(userPrompt);
}

export function hasOpenAI() {
  return !!OPENAI_API_KEY;
}
