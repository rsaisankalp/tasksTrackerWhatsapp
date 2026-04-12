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

export interface GroupCommandResult {
  // What the user wants
  intent: "list_tasks" | "task_detail" | "status" | "blocked" | "urgent" | "remind" | "overdue" | "create_task" | "help" | "stats_query" | "update_task";
  // For task_detail, remind, update_task: which task name to search for
  taskSearch: string | null;
  // For update_task: what field to update and what value to set
  updateField: "assign" | "status" | "deadline" | "priority" | null;
  updateValue: string | null;
}

export interface TaskCreationResult {
  title: string;
  executorName: string | null;   // name of the person to assign to
  deadlineDays: number | null;   // days from today (e.g. 3 = 3 days from now)
  deadlineDate: string | null;   // explicit date if mentioned (ISO format YYYY-MM-DD)
  importance: "EMERGENCY" | "HIGH" | "MID" | "LOW";
  description: string | null;
  // If key details are missing, set this to ask the user a follow-up question
  followUpQuestion: string | null;
}

const TASK_CREATION_PROMPT = `You are a task management assistant. Extract task details from a natural language message.
Return a JSON object with:
- title: concise task title (extract the core action/task, e.g. "Send honorarium list"). Required — if you cannot determine a meaningful title, set followUpQuestion.
- executorName: name of the person who should do it (null if not mentioned or if it's "me"/"myself"/"I")
- deadlineDays: number of days from today (e.g. "in 3 days" → 3, "by tomorrow" → 1, "next week" → 7, null if not mentioned)
- deadlineDate: explicit date in YYYY-MM-DD if a specific date is mentioned (null otherwise)
- importance: "EMERGENCY", "HIGH", "MID", or "LOW" based on urgency words ("urgent"/"asap"/"emergency" → EMERGENCY, "important"/"high priority" → HIGH, default → "MID")
- description: any additional context or details (null if none)
- followUpQuestion: if the title is unclear or the message is too vague to create a task (e.g. just "create task" or "add a reminder"), set this to a concise question asking for missing details. Otherwise null.

Rules:
- For "remind X to do Y" or "ask X to do Y" → executor is X, title is Y
- For "create a task for X" → executor is X
- Extract the meaningful task action as the title, not the whole sentence
- Deadline and executor are optional — only set followUpQuestion if the title itself is unclear
- Today's date: ${new Date().toISOString().split("T")[0]}

Return ONLY JSON. No markdown.`;

export async function parseTaskCreation(message: string): Promise<TaskCreationResult> {
  const apiKey = getNextApiKey();
  const rawTitle = message.replace(/^(create|add|new)\s+(a\s+)?(task|reminder)(\s+to|\s+for)?\s*/i, "").trim();
  const fallback: TaskCreationResult = {
    title: rawTitle || message,
    executorName: null,
    deadlineDays: null,
    deadlineDate: null,
    importance: "MID",
    description: null,
    followUpQuestion: rawTitle ? null : "What should the task be called? Who should do it and by when?",
  };

  if (!apiKey) return fallback;

  for (let attempt = 0; attempt < Math.max(1, API_KEYS.length); attempt++) {
    const currentKey = API_KEYS[(keyIndex + attempt) % API_KEYS.length];
    try {
      const genAI = new GoogleGenerativeAI(currentKey);
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { responseMimeType: "application/json" },
        systemInstruction: TASK_CREATION_PROMPT,
      });
      const result = await model.generateContent(`Message: "${message}"\n\nReturn JSON only.`);
      const text = result.response.text().trim();
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(cleaned) as TaskCreationResult;
      parsed.importance = parsed.importance ?? "MID";
      parsed.followUpQuestion = parsed.followUpQuestion ?? null;
      return parsed;
    } catch (e: any) {
      const isQuotaError = e?.status === 429 || e?.message?.includes("quota") || e?.message?.includes("rate");
      if (isQuotaError && attempt < API_KEYS.length - 1) { continue; }
      console.error("[Gemini] parseTaskCreation error:", e?.message ?? e);
      break;
    }
  }
  return fallback;
}

const GROUP_COMMAND_PROMPT = `You are a WhatsApp group bot for a task management system.
Classify the user's message into one of these intents:
- list_tasks: user wants to see all pending/active tasks (any variation: "show tasks", "what's pending", "open tasks", "active tasks", "kya kya pending hai", tasks by project, etc.)
- task_detail: user wants details about a specific task (e.g. "tell me about X", "X ka status", "show X", "details of X"). Also use this if the user's message appears to be a task name from the provided list.
- status: user wants a high-level dashboard or statistics summary (e.g. "status", "overview", "how are we doing", "completion rate", "how many done", "statistics", "how many tasks per person")
- blocked: user wants to see blocked/stuck tasks
- urgent: user wants high-priority/emergency/overdue tasks or things that need attention ("what needs attention", "urgent", "critical", "important", "what should I focus on", "what to prioritize")
- remind: user wants to follow up on or send a reminder for a specific task (e.g. "remind X about Y", "follow up on Y", "send reminder for Y", "chase Y", "ping executor of Y")
- overdue: user wants to see tasks that are past their deadline
- help: user wants to see available commands (e.g. "help", "hi", "what can you do")
- create_task: user wants to create a new task (e.g. "create task X", "add a task for X", "remind X to do Y", "add task: X", "new task: X")
- stats_query: user is asking a general question that needs data to answer (e.g. "how many tasks does Swami have?", "which project has most tasks?", "who is most loaded?", "done this week?")
- update_task: user wants to modify an existing task — assign it to someone, change its status, deadline, or priority. IMPORTANT: if the user is replying to a previous bot message about a task (shown as [Quoted message: ...]), and says something like "assign to X", "assigned to X", "give to X", "mark as done", "change deadline to X", "set priority to X" — use update_task.

Return JSON with:
- intent: one of the above strings
- taskSearch: for task_detail, remind, update_task — the task name to search for (null otherwise). If user is replying to a task message, extract the task title from the quoted message.
- updateField: for update_task only — one of "assign", "status", "deadline", "priority" (null otherwise)
- updateValue: for update_task only — the new value (e.g. contact name, "DONE", "2026-04-15", "HIGH") (null otherwise)

Return ONLY JSON. No markdown.`;

export async function parseGroupCommand(message: string, taskTitles: string[] = [], quotedBody: string | null = null): Promise<GroupCommandResult> {
  const fallback = simpleGroupCommandFallback(message);

  const apiKey = getNextApiKey();
  if (!apiKey) return fallback;

  const taskListContext = taskTitles.length > 0
    ? `\n\nCurrent tasks in the system:\n${taskTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
    : "";

  const quotedContext = quotedBody
    ? `\n\n[Quoted message the user is replying to: "${quotedBody.substring(0, 300)}"]\n`
    : "";

  for (let attempt = 0; attempt < Math.max(1, API_KEYS.length); attempt++) {
    const currentKey = API_KEYS[(keyIndex + attempt) % API_KEYS.length];
    try {
      const genAI = new GoogleGenerativeAI(currentKey);
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { responseMimeType: "application/json" },
        systemInstruction: GROUP_COMMAND_PROMPT,
      });

      const result = await model.generateContent(`${quotedContext}User message: "${message}"${taskListContext}\n\nReturn JSON only.`);
      const text = result.response.text().trim();
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(cleaned) as GroupCommandResult;
      parsed.taskSearch = parsed.taskSearch ?? null;
      parsed.updateField = parsed.updateField ?? null;
      parsed.updateValue = parsed.updateValue ?? null;
      return parsed;
    } catch (e: any) {
      const isQuotaError =
        e?.status === 429 || e?.message?.includes("quota") || e?.message?.includes("rate");
      if (isQuotaError && attempt < API_KEYS.length - 1) {
        console.warn(`[Gemini] Key ${attempt + 1} quota exceeded, rotating...`);
        continue;
      }
      console.error("[Gemini] parseGroupCommand error, using fallback:", e?.message ?? e);
      break;
    }
  }

  return fallback;
}

function simpleGroupCommandFallback(message: string): GroupCommandResult {
  const lower = message.toLowerCase().trim();
  const base = { updateField: null as GroupCommandResult["updateField"], updateValue: null };

  if (lower.includes("assign") || lower.includes("give to") || lower.includes("assigned to")) {
    const val = lower.replace(/^(assign(ed)?\s+(to|it\s+to)|give\s+to)\s*/i, "").trim();
    return { intent: "update_task", taskSearch: null, updateField: "assign", updateValue: val || null };
  }
  if (lower.includes("overdue") || lower.includes("late") || lower.includes("past deadline") || lower.includes("missed deadline")) {
    return { intent: "overdue", taskSearch: null, ...base };
  }
  if (lower.includes("remind") || lower.includes("follow up") || lower.includes("followup") || lower.includes("chase") || lower.includes("ping")) {
    const search = lower.replace(/^(remind|follow up on|followup|chase|ping)\s+/i, "").trim();
    return { intent: "remind", taskSearch: search || null, ...base };
  }
  if (lower.includes("block") || lower.includes("stuck")) {
    return { intent: "blocked", taskSearch: null, ...base };
  }
  if (lower.includes("urgent") || lower.includes("atten") || lower.includes("critical") || lower.includes("important") || lower.includes("priority") || lower.includes("focus")) {
    return { intent: "urgent", taskSearch: null, ...base };
  }
  if (lower.includes("status") || lower.includes("summary") || lower.includes("overview") || lower.includes("dashboard")) {
    return { intent: "status", taskSearch: null, ...base };
  }
  if (lower.includes("how many") || lower.includes("statistic") || lower.includes("count") || lower.includes("who has") || lower.includes("which project")) {
    return { intent: "stats_query", taskSearch: null, ...base };
  }
  if (lower.includes("task") || lower.includes("pending") || lower.includes("open") || lower.includes("active")) {
    if (lower.includes("details") || lower.includes("about") || lower.includes("status of")) {
      return { intent: "task_detail", taskSearch: lower.replace(/^(task|details of|about|info)\s+/i, "").trim(), ...base };
    }
    return { intent: "list_tasks", taskSearch: null, ...base };
  }
  if (/^(create|add|new)\s+(a\s+)?(task|reminder)/i.test(lower) || lower.includes("remind") && lower.includes("to ")) {
    return { intent: "create_task", taskSearch: null, ...base };
  }
  if (lower.includes("help") || lower === "hi" || lower === "hello") {
    return { intent: "help", taskSearch: null, ...base };
  }
  return { intent: "stats_query", taskSearch: null, ...base };
}

export async function answerGroupStatsQuery(question: string, statsContext: string): Promise<string> {
  const apiKey = getNextApiKey();
  if (!apiKey) return "❓ Unable to answer — AI not configured.";

  for (let attempt = 0; attempt < Math.max(1, API_KEYS.length); attempt++) {
    const currentKey = API_KEYS[(keyIndex + attempt) % API_KEYS.length];
    try {
      const genAI = new GoogleGenerativeAI(currentKey);
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: "You are a task management assistant. Answer the user's question using the provided task data. Be concise and use WhatsApp-friendly formatting (bold with *text*, bullet points with •). No markdown headers.",
      });

      const prompt = `Task data:\n${statsContext}\n\nUser question: "${question}"\n\nAnswer concisely.`;
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (e: any) {
      const isQuotaError = e?.status === 429 || e?.message?.includes("quota") || e?.message?.includes("rate");
      if (isQuotaError && attempt < API_KEYS.length - 1) { continue; }
      console.error("[Gemini] answerGroupStatsQuery error:", e?.message ?? e);
      break;
    }
  }
  return "❓ Couldn't process that query right now.";
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
