#!/usr/bin/env node
// Advisory near-duplicate finder for Triviador's trivia question bank. Dependency-free Node,
// matching tools/mapgen/generate-map.mjs's house style.
//
// Reads every JSON file under both src/UI/Triviador.Web/Data/questions/choice/ and
// .../tip/, normalizes each question's bilingual-English text into a token set (lowercase, strip
// punctuation, split on whitespace, drop a small stopword list), then computes Jaccard similarity
// across *all* pairs globally - cross-kind included, since a tip and a choice question can share
// subject matter even though one asks multiple-choice and the other asks for a number. Pairs at or
// above --threshold (default 0.5) are printed for a human to judge; this script never deletes or
// rewrites anything and is not wired into any build - see
// openspec/changes/expand-question-bank-2000/design.md for why a heuristic dedup check stays
// advisory-only in this project.
//
// Usage:
//   node tools/question-authoring/find-duplicates.mjs [--threshold 0.5]
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or',
  'by', 'with', 'what', 'which', 'who', 'how', 'does', 'do', 'did', 'has', 'have', 'had', 'its',
  'as', 'it', 'be', 'this', 'that', 'known',
]);

function parseArgs(argv) {
  let threshold = 0.5;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--threshold' && argv[i + 1] !== undefined) {
      threshold = Number(argv[i + 1]);
      i++;
    }
  }
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    throw new Error(`--threshold must be a number in (0, 1], got '${threshold}'`);
  }
  return { threshold };
}

function tokenize(text) {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !STOPWORDS.has(word));
  return new Set(normalized);
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection++;
    }
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function loadQuestions(dir, kind) {
  const entries = [];
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return entries;
  }
  for (const file of files) {
    const path = resolve(dir, file);
    const questions = JSON.parse(readFileSync(path, 'utf8'));
    for (const q of questions) {
      entries.push({
        id: q.id,
        kind,
        category: q.category,
        file,
        text: q.text,
        tokens: tokenize(q.text ?? ''),
      });
    }
  }
  return entries;
}

function main() {
  const { threshold } = parseArgs(process.argv.slice(2));

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const questionsRoot = resolve(scriptDir, '../../src/UI/Triviador.Web/Data/questions');
  const choiceDir = resolve(questionsRoot, 'choice');
  const tipDir = resolve(questionsRoot, 'tip');

  const all = [...loadQuestions(choiceDir, 'choice'), ...loadQuestions(tipDir, 'tip')];

  console.log(`Loaded ${all.length} questions (${all.filter((q) => q.kind === 'choice').length} choice, ${all.filter((q) => q.kind === 'tip').length} tip).`);
  console.log(`Comparing all pairs at threshold >= ${threshold}...`);

  const flagged = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      const similarity = jaccard(a.tokens, b.tokens);
      if (similarity >= threshold) {
        flagged.push({ a, b, similarity });
      }
    }
  }

  flagged.sort((x, y) => y.similarity - x.similarity);

  if (flagged.length === 0) {
    console.log('No near-duplicate pairs found above threshold.');
    return;
  }

  console.log(`\nFound ${flagged.length} candidate pair(s):\n`);
  for (const { a, b, similarity } of flagged) {
    console.log(`similarity ${similarity.toFixed(2)}`);
    console.log(`  [${a.kind}/${a.category}] ${a.id}: "${a.text}"`);
    console.log(`  [${b.kind}/${b.category}] ${b.id}: "${b.text}"`);
    console.log('');
  }
}

main();
