#!/usr/bin/env node

/**
 * flovia CLI
 *
 * Shares the same AI provider, model, and prompts as the desktop app.
 * Reads ai-settings.json and prompt-settings.json from the Electron
 * userData directory — configure once in the UI, use everywhere.
 *
 * Usage:
 *   flovia "explain the auth flow"
 *   flovia ask "what does this project do"
 *   flovia agent "add dark mode support"
 *   flovia agent -w ./my-project "refactor the utils folder"
 *   echo "fix the bug" | flovia agent
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import {
  type ChatMessage,
  type FileActionPlan,
  stripMarkdownFences,
  parseSearchReplaceBlocks,
  applySearchReplaceBlocks,
  buildSystemContext,
  buildResearchPrompt,
  parseResearchResponse,
  buildActionPlanPrompt,
  parseActionPlanResponse,
  buildFileChangePrompt,
  buildVerifyPrompt,
  parseVerifyResponse,
} from '@flovia/core/chat';
import { getUserDataDir } from '@flovia/core/dataDir';
import { loadAISettings, loadPromptSettings } from '@flovia/main/storage';
import type { AISettings } from '@flovia/main/ai';
import type { PromptSettings } from '@flovia/main/prompts';

// ─── Argument Parsing ───

interface CliArgs {
  message: string;
  mode: 'ask' | 'agent' | 'chat';
  workspace: string;
  modelOverride: string;
  baseUrlOverride: string;
  apiKeyOverride: string;
  stream: boolean;
  showHelp: boolean;
  showVersion: boolean;
  listModels: boolean;
  output: string | null;
  verbose: boolean;
  systemPrompt: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    message: '',
    mode: 'ask',
    workspace: process.cwd(),
    modelOverride: '',
    baseUrlOverride: '',
    apiKeyOverride: '',
    stream: true,
    showHelp: false,
    showVersion: false,
    listModels: false,
    output: null,
    verbose: false,
    systemPrompt: null,
  };

  const positional: string[] = [];
  let i = 0;
  let subcommandParsed = false;

  while (i < argv.length) {
    const arg = argv[i];

    // Support subcommand-style: flovia ask, flovia agent, flovia chat
    if (!subcommandParsed && !arg.startsWith('-') && ['ask', 'agent', 'chat'].includes(arg)) {
      args.mode = arg as CliArgs['mode'];
      subcommandParsed = true;
      i++;
      continue;
    }

    switch (arg) {
      case '-h': case '--help':
        args.showHelp = true; break;
      case '-v': case '--version':
        args.showVersion = true; break;
      case '-m': case '--mode':
        args.mode = (argv[++i] || 'ask') as CliArgs['mode']; break;
      case '--model':
        args.modelOverride = argv[++i] || ''; break;
      case '-w': case '--workspace':
        args.workspace = path.resolve(argv[++i] || '.'); break;
      case '--base-url':
        args.baseUrlOverride = argv[++i] || ''; break;
      case '--api-key':
        args.apiKeyOverride = argv[++i] || ''; break;
      case '--no-stream':
        args.stream = false; break;
      case '--list-models':
        args.listModels = true; break;
      case '-o': case '--output':
        args.output = argv[++i] || null; break;
      case '--verbose':
        args.verbose = true; break;
      case '-s': case '--system':
        args.systemPrompt = argv[++i] || null; break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
        positional.push(arg);
    }
    i++;
  }

  args.message = positional.join(' ');
  return args;
}

// ─── Help / Version ───

function showHelp(): void {
  const settings = loadAISettings();
  console.log(`
\x1b[1mflovia\x1b[0m — AI-powered developer assistant CLI (flovia.io)

  Uses the same AI provider, model, and prompts configured in the desktop app.

\x1b[1mUSAGE\x1b[0m
  flovia ask [options] "your message"
  flovia agent [options] "your message"
  flovia chat [options] "your message"
  echo "your message" | flovia agent [options]

\x1b[1mCOMMANDS\x1b[0m
  \x1b[36mask\x1b[0m     Answer questions about the codebase (default)
  \x1b[36magent\x1b[0m   Plan and apply file changes (SEARCH/REPLACE)
  \x1b[36mchat\x1b[0m    General conversation (no workspace context)

\x1b[1mOPTIONS\x1b[0m
  -w, --workspace <path>  Path to workspace directory (default: cwd)
      --model <name>      Override model (default: from app settings)
      --base-url <url>    Override API base URL
      --api-key <key>     Override API key
  -s, --system <prompt>   Override system prompt
      --no-stream         Wait for full response instead of streaming
      --list-models       List available models and exit
  -o, --output <file>     Write response to a file
      --verbose           Show debug info (model, timing, config path)
  -h, --help              Show this help
  -v, --version           Show version

\x1b[1mCURRENT CONFIG\x1b[0m  (from desktop app)
  Provider:  ${settings.provider}
  Base URL:  ${settings.baseUrl}
  Model:     ${settings.selectedModel || '\x1b[33m(not set — configure in desktop app or use --model)\x1b[0m'}
  Config:    ${getUserDataDir()}

\x1b[1mEXAMPLES\x1b[0m
  flovia ask "explain the auth flow"
  flovia agent "add input validation to the signup form"
  flovia ask -w ./my-project "what testing framework is used?"
  echo "summarize this project" | flovia agent
  flovia --list-models
`);
}

function showVersion(): void {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    console.log(`flovia v${pkg.version}`);
  } catch {
    console.log('flovia v1.0.0');
  }
}

// ─── Workspace Scanning ───

const SKIP_DIRS = new Set([
  'node_modules', '.git', '__pycache__', 'dist', 'build',
  '.next', '.nuxt', 'coverage', '.cache', 'dist-main', 'dist-cli', 'dist-server', 'out',
]);

function scanWorkspaceFiles(dir: string, base?: string): string[] {
  base = base ?? dir;
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...scanWorkspaceFiles(full, base));
      } else {
        files.push(path.relative(base, full));
      }
    }
  } catch { /* ignore unreadable dirs */ }
  return files;
}

// ─── Helper: AI call ───

async function aiChat(
  client: OpenAI,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const response = await client.chat.completions.create({ model, messages });
  return response.choices[0]?.message?.content ?? '';
}

// ─── Stdin ───

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
  });
}

// ─── Spinner helper ───

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
function startSpinner(label: string): { stop: (final?: string) => void } {
  let i = 0;
  const id = setInterval(() => {
    process.stderr.write(`\r${SPINNER[i++ % SPINNER.length]} ${label}`);
  }, 80);
  return {
    stop(final?: string) {
      clearInterval(id);
      process.stderr.write(`\r${' '.repeat(label.length + 4)}\r`);
      if (final) process.stderr.write(`${final}\n`);
    },
  };
}

// ─── Agent Mode Pipeline (uses same prompts as the desktop app via core/chat.ts) ───

async function runAgentMode(
  client: OpenAI,
  model: string,
  message: string,
  workspace: string,
  files: string[],
  verbose: boolean,
): Promise<void> {
  const fileSet = new Set(files);

  // ── Step 1: Research Agent — pick relevant files ──
  const sp1 = startSpinner('Researching codebase…');
  let researchedFiles: { relativePath: string; content: string }[] = [];
  try {
    const researchMessages = buildResearchPrompt(message, workspace, files);
    const researchReply = await aiChat(client, model, researchMessages);
    const chosenFiles = parseResearchResponse(researchReply, fileSet);

    if (chosenFiles.length > 0) {
      sp1.stop(`📂 Reading ${chosenFiles.length} relevant file${chosenFiles.length > 1 ? 's' : ''}…`);
      for (const rel of chosenFiles) {
        try {
          const content = fs.readFileSync(path.join(workspace, rel), 'utf-8');
          researchedFiles.push({ relativePath: rel, content });
        } catch { /* skip unreadable */ }
      }
      if (verbose) {
        for (const f of researchedFiles) process.stderr.write(`  📎 ${f.relativePath}\n`);
      }
    } else {
      sp1.stop('📂 No specific files matched — using workspace tree.');
    }
  } catch (err) {
    sp1.stop('⚠️  Research step failed, continuing with workspace tree.');
    if (verbose) process.stderr.write(`  ${(err as Error).message}\n`);
  }

  // ── Step 2: Action Plan Agent — decide which files to create/update/delete ──
  const sp2 = startSpinner('Planning file changes…');
  let actionPlan: FileActionPlan[] = [];
  try {
    const planMessages = buildActionPlanPrompt(
      message,
      [],  // no chat history in CLI (single-shot)
      workspace,
      files,
      researchedFiles.map(f => ({ path: f.relativePath, content: f.content })),
    );
    const planReply = await aiChat(client, model, planMessages);
    actionPlan = parseActionPlanResponse(planReply);
    sp2.stop(`📋 Plan: ${actionPlan.length} file${actionPlan.length !== 1 ? 's' : ''} to change`);
    for (const a of actionPlan) {
      const icon = a.action === 'create' ? '🆕' : a.action === 'delete' ? '🗑️ ' : '✏️ ';
      process.stderr.write(`  ${icon} ${a.action.toUpperCase()} ${a.file} — ${a.description}\n`);
    }
  } catch (err) {
    sp2.stop(`\x1b[31m✗\x1b[0m Failed to generate action plan: ${(err as Error).message}`);
    process.exit(1);
  }

  if (actionPlan.length === 0) {
    process.stderr.write('\n⚠️  No file changes needed. Falling back to a normal reply:\n\n');
    const ctx = buildSystemContext(workspace, files);
    const stream = await client.chat.completions.create({
      model,
      messages: [ctx, { role: 'user', content: message }],
      stream: true,
    });
    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content;
      if (delta) process.stdout.write(delta);
    }
    process.stdout.write('\n');
    return;
  }

  // ── Step 3: Execute — read each file, call code editor, apply changes ──
  const MAX_ATTEMPTS = 3;
  let currentPlan = actionPlan;
  let allResults: { file: string; action: string; status: string; diff?: { before: string; after: string }; error?: string }[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && currentPlan.length > 0; attempt++) {
    if (attempt > 1) {
      process.stderr.write(`\n🔄 Retry attempt ${attempt}/${MAX_ATTEMPTS}…\n`);
    }

    const attemptResults: typeof allResults = [];

    for (let i = 0; i < currentPlan.length; i++) {
      const plan = currentPlan[i];
      const fullPath = path.join(workspace, plan.file);
      const label = `[${i + 1}/${currentPlan.length}] ${plan.action.toUpperCase()} ${plan.file}`;

      let currentContent: string | null = null;
      if (plan.action !== 'create') {
        try { currentContent = fs.readFileSync(fullPath, 'utf-8'); } catch { /* may not exist */ }
      }

      const sp = startSpinner(`${label}…`);
      try {
        const changeMessages = buildFileChangePrompt(plan, currentContent, message);
        const changeReply = await aiChat(client, model, changeMessages);

        if (plan.action === 'delete') {
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          sp.stop(`\x1b[32m✓\x1b[0m ${label}`);
          attemptResults.push({ file: plan.file, action: plan.action, status: 'done', diff: { before: currentContent ?? '', after: '(deleted)' } });
          continue;
        }

        let newContent: string;
        if (plan.action === 'create') {
          newContent = stripMarkdownFences(changeReply);
        } else {
          const blocks = parseSearchReplaceBlocks(changeReply);
          if (blocks.length > 0 && currentContent !== null) {
            newContent = applySearchReplaceBlocks(currentContent, blocks);
          } else {
            newContent = stripMarkdownFences(changeReply);
          }
        }

        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, newContent, 'utf-8');

        sp.stop(`\x1b[32m✓\x1b[0m ${label}`);
        attemptResults.push({ file: plan.file, action: plan.action, status: 'done', diff: { before: currentContent ?? '', after: newContent } });
      } catch (err) {
        sp.stop(`\x1b[31m✗\x1b[0m ${label} — ${(err as Error).message}`);
        attemptResults.push({ file: plan.file, action: plan.action, status: 'error', error: (err as Error).message });
      }
    }

    allResults = [...allResults.filter(r => !currentPlan.some(p => p.file === r.file)), ...attemptResults];

    // ── Step 4: Verification Agent ──
    const changedForVerify = attemptResults
      .filter(r => r.status === 'done')
      .map(r => ({ file: r.file, action: r.action, diff: r.diff }));

    if (changedForVerify.length === 0) break;

    const sp3 = startSpinner(`Verifying changes (attempt ${attempt}/${MAX_ATTEMPTS})…`);
    try {
      const verifyMessages = buildVerifyPrompt(message, changedForVerify);
      const verifyReply = await aiChat(client, model, verifyMessages);
      const verification = parseVerifyResponse(verifyReply);

      if (verification.satisfied || verification.missingChanges.length === 0) {
        sp3.stop(`\x1b[32m✓\x1b[0m Verification passed${verification.reason ? ` — ${verification.reason}` : ''}`);
        break;
      } else {
        sp3.stop(`⚠️  Verification: ${verification.reason}`);
        currentPlan = verification.missingChanges;
        for (const mc of currentPlan) {
          process.stderr.write(`  → ${mc.action.toUpperCase()} ${mc.file}: ${mc.description}\n`);
        }
      }
    } catch {
      sp3.stop('⚠️  Verification step failed, assuming done.');
      break;
    }
  }

  // ── Summary ──
  const successes = allResults.filter(r => r.status === 'done');
  const errors = allResults.filter(r => r.status === 'error');
  process.stderr.write('\n');
  process.stderr.write(`\x1b[32m✅ Applied ${successes.length} file change${successes.length !== 1 ? 's' : ''}\x1b[0m`);
  if (errors.length > 0) process.stderr.write(` \x1b[31m(${errors.length} error${errors.length !== 1 ? 's' : ''})\x1b[0m`);
  process.stderr.write('\n');

  for (const r of successes) {
    const icon = r.action === 'create' ? '🆕' : r.action === 'delete' ? '🗑️ ' : '✏️ ';
    process.stderr.write(`  ${icon} ${r.file}\n`);
  }
  for (const r of errors) {
    process.stderr.write(`  \x1b[31m✗\x1b[0m ${r.file}: ${r.error}\n`);
  }
}

// ─── Main ───

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.showHelp) { showHelp(); return; }
  if (args.showVersion) { showVersion(); return; }

  const settings = loadAISettings();
  const prompts = loadPromptSettings();

  const baseUrl = args.baseUrlOverride || settings.baseUrl;
  const apiKey = args.apiKeyOverride || settings.apiKey;
  const model = args.modelOverride || settings.selectedModel;

  const client = new OpenAI({ baseURL: baseUrl, apiKey });

  // --list-models
  if (args.listModels) {
    try {
      const list = await client.models.list();
      const models: string[] = [];
      for await (const m of list) models.push(m.id);
      if (models.length === 0) { console.log('No models found.'); return; }
      console.log(`\x1b[1mAvailable models\x1b[0m  (active: \x1b[36m${model || 'none'}\x1b[0m)\n`);
      for (const m of models.sort()) {
        const marker = m === model ? '  \x1b[32m← active\x1b[0m' : '';
        console.log(`  ${m}${marker}`);
      }
      console.log(`\n${models.length} models total.`);
    } catch (err) {
      console.error(`\x1b[31mError:\x1b[0m Failed to list models: ${(err as Error).message}`);
      process.exit(1);
    }
    return;
  }

  // Read message
  let message = args.message;
  if (!message) message = await readStdin();
  if (!message) {
    console.error('\x1b[31mError:\x1b[0m No message provided.\n');
    console.error('Usage: flovia ask "your message"');
    console.error('       echo "your message" | flovia agent\n');
    console.error('Run \x1b[36mflovia --help\x1b[0m for all options.');
    process.exit(1);
  }

  if (!['ask', 'agent', 'chat'].includes(args.mode)) {
    console.error(`\x1b[31mError:\x1b[0m Invalid mode "${args.mode}". Use: ask, agent, chat\n`);
    process.exit(1);
  }

  if (!model) {
    console.error(`\x1b[31mError:\x1b[0m No model configured.`);
    console.error(`Configure one in the desktop app, or pass --model <name>.\n`);
    console.error(`Run \x1b[36mflovia --list-models\x1b[0m to see available models.`);
    process.exit(1);
  }

  if (args.verbose) {
    console.error(`\x1b[2m── flovia CLI ──\x1b[0m`);
    console.error(`\x1b[2mConfig:    ${getUserDataDir()}\x1b[0m`);
    console.error(`\x1b[2mProvider:  ${settings.provider}\x1b[0m`);
    console.error(`\x1b[2mBase URL:  ${baseUrl}\x1b[0m`);
    console.error(`\x1b[2mModel:     ${model}\x1b[0m`);
    console.error(`\x1b[2mMode:      ${args.mode}\x1b[0m`);
    console.error(`\x1b[2mWorkspace: ${args.workspace}\x1b[0m`);
    console.error(`\x1b[2m───────────────\x1b[0m\n`);
  }

  const startTime = Date.now();

  // ── Agent Mode — full pipeline (both 'agent' and 'ask' now use the full agentic pipeline) ──
  if (args.mode === 'agent' || args.mode === 'ask') {
    if (!fs.existsSync(args.workspace)) {
      console.error(`\x1b[31mError:\x1b[0m Workspace not found: ${args.workspace}\n`);
      process.exit(1);
    }
    const files = scanWorkspaceFiles(args.workspace);

    try {
      await runAgentMode(client, model, message, args.workspace, files, args.verbose);
    } catch (err) {
      const errMsg = (err as Error).message;
      if (errMsg.includes('ECONNREFUSED')) {
        console.error(`\x1b[31mError:\x1b[0m Cannot connect to ${baseUrl}`);
        console.error(`Make sure your AI provider is running (e.g., Ollama).`);
      } else {
        console.error(`\x1b[31mError:\x1b[0m ${errMsg}`);
      }
      process.exit(1);
    }

    if (args.verbose) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`\n\x1b[2m── ${elapsed}s · ${model} ──\x1b[0m`);
    }
    return;
  }

  // ── Ask / Chat Mode — streaming response ──
  let systemContent: string;
  if (args.systemPrompt) {
    systemContent = args.systemPrompt;
  } else if (args.mode === 'chat') {
    systemContent = prompts.systemPrompt;
  } else {
    if (!fs.existsSync(args.workspace)) {
      console.error(`\x1b[31mError:\x1b[0m Workspace not found: ${args.workspace}\n`);
      process.exit(1);
    }
    const files = scanWorkspaceFiles(args.workspace);
    systemContent = buildSystemContext(args.workspace, files).content;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    { role: 'user', content: message },
  ];

  let fullResponse = '';

  try {
    if (args.stream && !args.output) {
      const stream = await client.chat.completions.create({ model, messages, stream: true });
      for await (const part of stream) {
        const delta = part.choices[0]?.delta?.content;
        if (delta) {
          process.stdout.write(delta);
          fullResponse += delta;
        }
      }
      if (!fullResponse.endsWith('\n')) process.stdout.write('\n');
    } else {
      const response = await client.chat.completions.create({ model, messages });
      fullResponse = response.choices[0]?.message?.content ?? '';
      process.stdout.write(fullResponse);
      if (!fullResponse.endsWith('\n')) process.stdout.write('\n');
    }

    if (args.output) {
      fs.writeFileSync(args.output, fullResponse, 'utf-8');
      console.error(`\x1b[32m✓\x1b[0m Response written to ${args.output}`);
    }

    if (args.verbose) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`\n\x1b[2m── ${elapsed}s · ${model} ──\x1b[0m`);
    }
  } catch (err) {
    const errMsg = (err as Error).message;
    if (errMsg.includes('ECONNREFUSED')) {
      console.error(`\x1b[31mError:\x1b[0m Cannot connect to ${baseUrl}`);
      console.error(`Make sure your AI provider is running (e.g., Ollama).`);
    } else {
      console.error(`\x1b[31mError:\x1b[0m ${errMsg}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\x1b[31mFatal:\x1b[0m ${(err as Error).message}`);
  process.exit(1);
});
