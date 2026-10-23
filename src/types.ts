export type TaskType =
  | 'research'
  | 'writing'
  | 'correspondence'
  | 'coding'
  | 'analysis'
  | 'data-extraction'
  | 'agentic-workflow'
  | 'creative'
  | 'business'
  | 'education'
  | 'general';

export type OutputMode = 'final_only' | 'compact' | 'standard' | 'diagnostic';

export type TokenBudget = 'minimal' | 'balanced' | 'generous';

export type ClarificationPolicy = 'auto' | 'always' | 'never';

export interface PromptImproverOptions {
  originalPrompt: string;
  targetModel?: string;
  targetAgent?: string;
  taskType?: TaskType;
  outputMode?: OutputMode;
  language?: 'it' | 'en';
  audience?: string;
  constraints?: string[];
  tokenBudget?: TokenBudget;
  askClarifyingQuestions?: ClarificationPolicy;
}

export interface RubricCategoryScore {
  id: RubricCategoryId;
  label: string;
  max: number;
  score: number;
  rationale: string;
}

export type RubricCategoryId =
  | 'intent_clarity'
  | 'context_sufficiency'
  | 'task_decomposition'
  | 'constraint_specificity'
  | 'output_format_clarity'
  | 'tool_source_instructions'
  | 'robustness_hallucination'
  | 'token_efficiency'
  | 'evaluation_criteria';

export interface RubricScore {
  total: number;
  max: number;
  categories: RubricCategoryScore[];
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  why?: string;
  options?: string[];
}

export interface ImprovementChange {
  type:
    | 'added_section'
    | 'dropped_section'
    | 'removed_padding'
    | 'normalized_whitespace'
    | 'wrapped_xml'
    | 'extracted_constraint'
    | 'inferred_role'
    | 'inferred_task_type'
    | 'inferred_output_format'
    | 'preserved_user_text';
  detail: string;
}

export interface ImprovementResult {
  original: string;
  improved: string;
  mode: OutputMode;
  language: 'it' | 'en';
  taskType: TaskType;
  scores: {
    before: RubricScore;
    after: RubricScore;
    delta: number;
  };
  assumptions: string[];
  changes: ImprovementChange[];
  clarifications: ClarificationQuestion[];
  needsClarification: boolean;
}

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail?: string;
  fix?: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: DoctorCheck[];
  nodeVersion: string;
  packageVersion: string;
}
