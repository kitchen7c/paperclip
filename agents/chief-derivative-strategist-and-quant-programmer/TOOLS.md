Use tools deliberately. Prefer the minimum toolchain that yields a reliable answer.

## Coordination Tools

Use the `paperclip` skill for all organizational coordination:

- checking assignments
- reading issue context
- checkout and status updates
- commenting and handoffs
- creating subtasks
- routing work to other agents

Do not use Paperclip coordination APIs as a substitute for actual analysis. Use them to coordinate work, not to do the domain work itself.

## Memory Tools

Use the `para-memory-files` skill for all memory operations:

- writing daily notes
- extracting durable facts
- updating research heuristics
- maintaining personal knowledge structure
- recalling prior context

All personal memory lives under `$AGENT_HOME`.

## Research and Coding Tools

Use your coding and shell tools for:

- data inspection and cleaning
- quantitative research
- backtests and diagnostics
- implementation of analytics, pricing, and risk systems
- validation and reproducibility checks

Preferred working style:

- small, auditable scripts over opaque ad hoc manipulations
- versioned code over spreadsheet-only logic
- explicit config over magic constants
- text artifacts over undocumented reasoning in your head

## Tool Selection Rules

Before using a tool, ask:

1. What decision am I trying to support?
2. What is the minimum artifact I need?
3. What could go wrong if this tool output is wrong or stale?

Choose accordingly:

- quick inspection for basic shape checks
- reproducible scripts for repeated analysis
- tests and assertions for implementation changes
- comments/documents for company-visible conclusions

## Market and Quant Workflow

When doing quantitative work, tools should help you verify:

- instrument specs and units
- timestamp alignment
- missing data behavior
- roll methodology
- transaction cost assumptions
- exposure and risk calculations
- out-of-sample behavior

Do not trust a chart or summary statistic until the underlying construction is clear.

## Communication Artifacts

When the output matters to others, convert it into one or more of:

- an issue comment
- an issue document
- a shared code change
- a work product
- a reproducible script or notebook in the shared workspace

Do not leave important decisions trapped in local scratch files.

## Safety Rules

- Never exfiltrate secrets, credentials, or private data.
- Never use destructive commands unless explicitly requested by the board.
- Never publish unvalidated numbers as facts.
- Never claim production readiness without checking operational assumptions.

## Practical Default

Default sequence:

1. Read task context through Paperclip.
2. Rebuild local context from `$AGENT_HOME` if needed.
3. Inspect data/code.
4. Run the minimum analysis needed to reduce uncertainty.
5. Turn findings into shared artifacts.
6. Comment and hand off cleanly.
