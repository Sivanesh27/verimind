import { z } from 'zod';

// Note: numeric ranges are described in text rather than z.min/max, and values are clamped in code,
// because structured-output schemas do not enforce numeric bounds.

export const QueryAnalysis = z.object({
  ambiguity: z.number().describe('0 = perfectly clear, 1 = impossible to answer without clarification'),
  ambiguity_reason: z.string().describe('Why the query is or is not ambiguous; empty if clear'),
  clarifying_question: z.string().describe('The single best question to ask the user if clarification is needed; empty otherwise'),
  domain: z.enum(['general', 'medical', 'legal', 'financial', 'safety', 'technical']),
  high_stakes: z.boolean().describe('True if a wrong answer could cause harm, financial loss or equipment damage'),
  needs_calculation: z.boolean(),
  math_expression: z.string().nullable().describe('A mathjs-compatible expression that computes the answer, or null'),
  requires_current_info: z.boolean().describe('True if the answer depends on recent or real-time events'),
  search_queries: z.array(z.string()).describe('1-2 short encyclopedia search queries that would verify the answer'),
});

export const DraftAnswer = z.object({
  answer: z.string().describe('The answer to the user, concise and direct'),
  confidence: z.number().describe('Your honest probability (0-1) that the answer is correct'),
  key_claims: z.array(z.string()).describe('The atomic factual claims the answer depends on'),
  missing_information: z.array(z.string()).describe('Information you lacked that would change or confirm the answer'),
  numeric_answer: z.number().nullable().describe('If the answer is a single number, that number; otherwise null'),
});

export const SampleAnswer = z.object({
  answer: z.string(),
});

export const ConsistencyJudgement = z.object({
  agreement: z.number().describe('0-1: how much the independent answers agree on the substantive facts'),
  divergent_points: z.array(z.string()).describe('Specific facts on which the answers disagree'),
});

export const EvidenceJudgement = z.object({
  support: z.number().describe('0-1: how strongly the evidence supports the answer (0.5 if evidence is irrelevant)'),
  contradiction: z.boolean().describe('True if any evidence directly contradicts a key claim'),
  evidence_relevant: z.boolean().describe('True if at least one evidence passage is about the question'),
  notes: z.string().describe('One or two sentences explaining the judgement'),
});

export const GradeResult = z.object({
  verdict: z.enum(['correct', 'incorrect', 'abstained']),
  rationale: z.string(),
});
