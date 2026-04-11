import { GoogleGenerativeAI } from "@google/generative-ai";

// Support multiple API keys for rotation (comma-separated in env)
const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

let keyIndex = 0;

function getNextApiKey(): string | null {
  if (API_KEYS.length === 0) return null;
  const key = API_KEYS[keyIndex % API_KEYS.length];
  keyIndex++;
  return key;
}

const MODEL_NAME = "gemini-3.1-flash-lite-preview";

export interface SubtaskContext {
  index: number;
  id: string;
  title: string;
  status: string;
}

export interface CommentContext {
  author: string;
  body: string;
  createdAt: string;
}

export interface WhatsAppParseResult {
  // What the user intends
  intent: "done" | "blocked" | "in_progress" | "comment" | "question" | "unknown";
  // Subtask indices to mark DONE (1-indexed)
  completedSubtaskIndices: number[];
  // Subtask indices to mark BLOCKED (1-indexed)
  blockedSubtaskIndices: number[];
  // New status for the parent task (null = no change)
  newTaskStatus: "DONE" | "BLOCKED" | "IN_PROGRESS" | null;
  // Text to save as a comment on the task
  comment: string | null;
  // Message to send back to user (null = no reply needed)
  replyMessage: string | null;
}

const SYSTEM_PROMPT = `You are an intelligent task management assistant for a WhatsApp-based reminder system.
You parse replies from team members about their assigned tasks and extract structured actions.

Your job is to understand natural language replies and return a JSON object with these fields:
- intent: one of "done", "blocked", "in_progress", "comment", "question", "unknown"
- completedSubtaskIndices: array of 1-based subtask numbers that are complete (empty if none)
- blockedSubtaskIndices: array of 1-based subtask numbers that are blocked (empty if none)
- newTaskStatus: "DONE", "BLOCKED", "IN_PROGRESS", or null (for the parent task overall)
- comment: text to save as a comment (the substance of what they said, or null)
- replyMessage: a helpful reply to send back via WhatsApp (or null if no reply needed)

Rules:
- "done", "finished", "complete", "ho gaya", "kar diya" etc → mark as done
- "blocked", "stuck", "pending", "problem", "issue", "help needed", "ruk gaya" etc → mark as blocked
- "working on it", "in progress", "chalu hai", "kar raha hoon" etc → mark as in_progress
- CRITICAL: Pay close attention to "X is done BUT Y is pending/blocked" patterns:
  - The part BEFORE "but" = done
  - The part AFTER "but" (pending/blocked/stuck) = blocked, NOT done
  - Example: "it is done but sub task 2 is pending" → subtask 1=DONE, subtask 2=BLOCKED
  - Example: "done 1, but 2 is stuck on approval" → subtask 1=DONE, subtask 2=BLOCKED
- When subtasks are explicitly named/numbered as "pending", "not done", "blocked", "getting blocked", "stuck" — they go in blockedSubtaskIndices, NEVER in completedSubtaskIndices
- "it is done" or "first one is done" with subtasks present = only the mentioned subtask is done, others remain as-is
- Numbers like "1, 2 done" or "done 1 and 3" refer to subtask indices
- "all done" or just "done" with no qualifier = mark all subtasks done
- Always be friendly and brief in replyMessage (in the same language they used - Hindi/English/Hinglish)
- For blockers, acknowledge and ask what help is needed
- Keep comments factual - record what they said
- If genuinely unclear, ask a clarifying question (intent: question)

EXAMPLES:
Message: "Sub task first one I think is completed, sub task second one right we are getting blocked with rahul he is not responding"
Subtasks: 1. sub task 1, 2. sub task 2
→ {"intent":"blocked","completedSubtaskIndices":[1],"blockedSubtaskIndices":[2],"newTaskStatus":"BLOCKED","comment":"Sub task 1 done. Sub task 2 blocked - Rahul not responding.","replyMessage":"Got it! Sub task 1 marked done. Sub task 2 marked as blocked. Will follow up with Rahul. 🙏"}

Message: "it is done but sub task 2 is pending partially blocked on hire"
Subtasks: 1. sub task 1, 2. sub task 2
→ {"intent":"blocked","completedSubtaskIndices":[1],"blockedSubtaskIndices":[2],"newTaskStatus":null,"comment":"Sub task 1 done. Sub task 2 blocked on hiring.","replyMessage":"Noted! Sub task 1 ✅. Sub task 2 blocked on hire - I'll escalate. 🙏"}

Message: "done"
Subtasks: 1. sub task 1, 2. sub task 2
→ {"intent":"done","completedSubtaskIndices":[1,2],"blockedSubtaskIndices":[],"newTaskStatus":"DONE","comment":"All tasks marked done.","replyMessage":"✅ Great work! All tasks marked as done."}

Message: "ho gaya sab"
Subtasks: none
→ {"intent":"done","completedSubtaskIndices":[],"blockedSubtaskIndices":[],"newTaskStatus":"DONE","comment":"Task marked done.","replyMessage":"✅ Bahut accha! Task complete kar diya. 🙏"}`;

export async function parseWhatsAppMessage(
  message: string,
  taskTitle: string,
  subtasks: SubtaskContext[],
  recentComments: CommentContext[]
): Promise<WhatsAppParseResult> {
  const fallback = simpleFallback(message, subtasks);

  const apiKey = getNextApiKey();
  if (!apiKey) return fallback;

  const subtaskList =
    subtasks.length > 0
      ? subtasks.map((s) => `${s.index}. [${s.status}] ${s.title}`).join("\n")
      : "(no subtasks)";

  const commentHistory =
    recentComments.length > 0
      ? recentComments
          .slice(-5)
          .map((c) => `[${c.createdAt}] ${c.author}: ${c.body}`)
          .join("\n")
      : "(no previous comments)";

  const userPrompt = `Task: "${taskTitle}"

Subtasks:
${subtaskList}

Recent conversation history:
${commentHistory}

New message from team member: "${message}"

Return ONLY a JSON object matching the schema. No markdown, no explanation.`;

  for (let attempt = 0; attempt < Math.max(1, API_KEYS.length); attempt++) {
    const currentKey = API_KEYS[(keyIndex + attempt) % API_KEYS.length];
    try {
      const genAI = new GoogleGenerativeAI(currentKey);
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { responseMimeType: "application/json" },
        systemInstruction: SYSTEM_PROMPT,
      });

      const result = await model.generateContent(userPrompt);
      const text = result.response.text().trim();

      // Strip markdown code fences if present
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(cleaned) as WhatsAppParseResult;

      // Ensure arrays exist
      parsed.completedSubtaskIndices = parsed.completedSubtaskIndices ?? [];
      parsed.blockedSubtaskIndices = parsed.blockedSubtaskIndices ?? [];
      parsed.newTaskStatus = parsed.newTaskStatus ?? null;
      parsed.comment = parsed.comment ?? null;
      parsed.replyMessage = parsed.replyMessage ?? null;

      return parsed;
    } catch (e: any) {
      const isQuotaError =
        e?.status === 429 || e?.message?.includes("quota") || e?.message?.includes("rate");

      if (isQuotaError && attempt < API_KEYS.length - 1) {
        console.warn(`[Gemini] Key ${attempt + 1} quota exceeded, rotating...`);
        continue;
      }

      console.error("[Gemini] parseWhatsAppMessage error, using fallback:", e?.message ?? e);
      break;
    }
  }

  return fallback;
}

function simpleFallback(message: string, subtasks: SubtaskContext[]): WhatsAppParseResult {
  const lower = message.toLowerCase().trim();
  const doneWords = ["done", "finished", "complete", "ho gaya", "kar diya"];
  const blockedWords = ["blocked", "stuck", "problem", "issue", "help"];

  const isDone = doneWords.some((w) => lower.includes(w));
  const isBlocked = blockedWords.some((w) => lower.includes(w));

  if (isDone) {
    // Check for specific subtask numbers
    const numbers = (lower.match(/\d+/g) || []).map(Number).filter((n) => n >= 1 && n <= subtasks.length);
    if (numbers.length > 0) {
      return {
        intent: "done",
        completedSubtaskIndices: numbers,
        blockedSubtaskIndices: [],
        newTaskStatus: null,
        comment: `Marked subtask(s) ${numbers.join(", ")} as done`,
        replyMessage: `✅ Got it! Marked ${numbers.length} subtask(s) as done.`,
      };
    }
    return {
      intent: "done",
      completedSubtaskIndices: subtasks.map((s) => s.index),
      blockedSubtaskIndices: [],
      newTaskStatus: subtasks.length === 0 ? "DONE" : null,
      comment: "Marked all tasks as done",
      replyMessage: "✅ Great work! All tasks marked as done.",
    };
  }

  if (isBlocked) {
    return {
      intent: "blocked",
      completedSubtaskIndices: [],
      blockedSubtaskIndices: [],
      newTaskStatus: "BLOCKED",
      comment: message,
      replyMessage: "🚧 Noted! I've marked this as blocked. The team will follow up.",
    };
  }

  return {
    intent: "comment",
    completedSubtaskIndices: [],
    blockedSubtaskIndices: [],
    newTaskStatus: null,
    comment: message,
    replyMessage: null,
  };
}

// Legacy export for backward compatibility (not used in new webhook)
export async function parseTaskReply(
  message: string,
  tasks: Array<{ index: number; id: string; title: string }>
): Promise<{ completedTaskIds: string[] }> {
  const subtasks: SubtaskContext[] = tasks.map((t) => ({ ...t, status: "TODO" }));
  const result = await parseWhatsAppMessage(message, "Task", subtasks, []);
  const completedTaskIds = result.completedSubtaskIndices
    .map((i) => tasks.find((t) => t.index === i)?.id)
    .filter(Boolean) as string[];
  return { completedTaskIds };
}
