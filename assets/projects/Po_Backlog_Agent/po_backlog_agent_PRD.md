# PO Backlog Agent: Product Requirements Document (POC)

*Handover doc for AI coding assistance (Claude Code). This defines WHAT to build and WHY. It intentionally does not contain full implementation code. Build stage by stage using the companion BUILD_GUIDE.md.*

---

## 1. Problem Statement

Product Owners spend significant manual time turning a high-level roadmap initiative into a detailed, accurate backlog: synthesizing scattered inputs (meeting notes, tickets, business cases) into an EPIC, researching internal knowledge bases for context, and decomposing the result into Features and Stories with Acceptance Criteria. Two of these steps are well-suited to agentic automation; the rest genuinely require human judgment and are explicitly out of scope (see §4).

## 2. Goal

Build a small working multi-agent system that demonstrates a full **Retrieve → Reason → Decide → Act** agentic workflow:
1. An agent takes raw, unstructured initiative input (text) and drafts a structured EPIC.
2. A second agent retrieves relevant context from a knowledge base via RAG, then decomposes the EPIC into Features, and Features into Stories with Acceptance Criteria.
3. The system optionally writes the result to a backlog API via a tool call.

This is a proof of concept built to learn and demonstrate agentic architecture (RAG, tool/function calling, multi-agent coordination, and structured output) applied to a genuinely useful personal-productivity problem. Correctness of the demo output matters more than robustness or scale.

## 3. Users

Solo builder/owner. Primary use: personal productivity tool for backlog creation, and a reference architecture worth rebuilding against a real company's actual JIRA/Confluence once real system access exists.

## 4. Scope

### In scope
- Mock knowledge base: 2–3 short reference documents (business case, design doc, process/policy doc)
- Local RAG over that knowledge base (no external vector DB service)
- Mock backlog API with 4 endpoints (create epic, create feature, create story, list/read)
- Two-agent flow: Agent 1 (Initiative → EPIC) hands off to Agent 2 (RAG-grounded Features → Stories + AC, with an optional tool call to write back)
- Minimal Streamlit UI to run the flow and view output

### Explicitly out of scope
- Real JIRA/Confluence/AHA integration
- Any sign-off, approval, or governance workflow
- Version tracking/diffing of requirements after sign-off
- Multi-turn conversational refinement (single-pass draft per stage is sufficient)
- Authentication, multi-user support, deployment/hosting
- Automating live meetings, SME conversations, HLD/LLD authorship, these stay human-only by design (see the automation-fit analysis already produced for this project)

## 5. Functional Requirements

### FR1, Initiative → EPIC (Agent 1)
**Input:** free-text initiative description (simulating meeting notes / ticket / business case excerpt), 100–500 words.
**Output:** structured EPIC object:
```json
{
  "title": "string",
  "problem_statement": "string",
  "business_value": "string",
  "in_scope": ["string"],
  "out_of_scope": ["string"]
}
```
**Acceptance criteria:** Given a realistic messy initiative paragraph, the agent produces an EPIC with all five fields populated, non-empty, and grounded in the input (no fabricated numbers or claims not present in the input).

### FR2, Context Retrieval (RAG, used by Agent 2)
**Input:** the EPIC (or its title + problem statement).
**Output:** top-k (k=3) relevant chunks from the mock knowledge base, with source doc name.
**Acceptance criteria:** For a query clearly related to one of the seed documents, the correct document is retrieved in the top 3 results. For a query with no relevant document, the system should not force a match. It should be able to return "no strongly relevant context found."

### FR3, EPIC → Features (Agent 2)
**Input:** EPIC + retrieved context chunks.
**Output:** 2–5 Feature objects:
```json
{
  "title": "string",
  "description": "string (the Why and What)",
  "tech_notes": "string (optional, only if bug-fix/technical)"
}
```
**Acceptance criteria:** Features are grounded in both the EPIC and the retrieved context. Changing the retrieved context should visibly change the Feature output, since that's the proof RAG is actually being used, not decoration.

### FR4, Features → Stories + Acceptance Criteria (Agent 2)
**Input:** one Feature.
**Output:** 2–4 Story objects:
```json
{
  "story": "As a [role], I want [capability], so that [benefit]",
  "acceptance_criteria": ["Given/When/Then string", "..."]
}
```
**Acceptance criteria:** Each story follows the As a/I want/so that shape; each has at least 2 acceptance criteria in Given/When/Then form.

### FR5, Optional write-back (tool call)
**Input:** completed EPIC → Features → Stories tree.
**Output:** `POST` calls to the mock backlog API creating the EPIC, then its Features, then their Stories, preserving parent-child IDs.
**Acceptance criteria:** After running, `GET /epics/{id}` returns the full nested structure that matches what was displayed in the UI.

## 6. Agent Design

| | Agent 1: Synthesizer | Agent 2: Decomposer |
|---|---|---|
| Responsibility | Turn raw unstructured input into a structured EPIC | Retrieve context, then decompose EPIC → Features → Stories, optionally write back |
| Input | Raw initiative text | EPIC (from Agent 1) |
| Tools available | None (pure generation) | `retrieve_context()`, `create_backlog_item()` |
| Output | EPIC object | Features + Stories tree, optionally persisted |

Two agents rather than one because each has a distinct responsibility and a distinct (small) toolset. This keeps prompts focused and makes it easy to reason about and demo each stage independently. Stretch goal (optional, time-permitting): give Agent 2 its tools as genuine function-calling choices rather than a fixed code sequence, so it decides for itself when to retrieve and when to write back, rather than the orchestration code deciding for it.

## 7. Mock Backlog API Contract

Base: `http://localhost:8000`

| Method | Path | Purpose |
|---|---|---|
| POST | `/epics` | Create an EPIC. Returns `{id, ...epic fields}` |
| POST | `/epics/{epic_id}/features` | Create a Feature under an EPIC |
| POST | `/features/{feature_id}/stories` | Create a Story under a Feature |
| GET | `/epics/{epic_id}` | Return the EPIC with nested Features and Stories |

Storage: in-memory Python dict or a local JSON file. No real database needed for a POC.

## 8. Knowledge Base (RAG corpus)

Three short markdown/text files (300–600 words each), written by hand, e.g.:
- `business_case_example.md`, a short fictional business case (any plausible product domain, e.g. a customer self-service portal or reporting feature)
- `design_doc_example.md`, a short fictional design note with technical constraints
- `process_policy_example.md`, a short internal process/policy doc (e.g. "all customer-facing features require a rollback plan")

These stand in for Confluence/SharePoint. Content should be specific enough that retrieval is clearly meaningful (i.e., a question about "rollback" should retrieve the policy doc, not the design doc).

## 9. Technology Stack & Rationale

| Component | Choice | Why |
|---|---|---|
| LLM (reasoning, generation, tool calling) | **Groq API** (`llama-3.3-70b-versatile` or `openai/gpt-oss-120b`) | Free tier, no credit card, OpenAI-compatible SDK, supports tool/function calling, ~30 requests/min and ~1,000 requests/day, comfortably enough for iterative building. |
| Embeddings | **Local `sentence-transformers` model** (e.g. `all-MiniLM-L6-v2`) | Runs locally, no API key, no rate limit, no external dependency. |
| Vector store | **Chroma** (local, embedded, file-backed) | No cloud signup, no quota, trivial to set up (`pip install chromadb`), sufficient for a 3-document corpus. |
| Mock backlog API | **FastAPI** | Lightweight, gives real API-contract design practice, auto-generates Swagger docs for easy manual testing. |
| UI | **Streamlit** | Fastest path to a demoable screen; not the point of the POC. |
| Structured output | JSON mode / function-calling via Groq's OpenAI-compatible tool-calling | Keeps EPIC/Feature/Story shapes predictable and parseable. |

This stack has **zero paid dependencies and zero fragile external quotas**. Everything except the LLM call itself runs locally, which is a deliberate resilience choice against third-party quota changes.

## 10. Non-Functional Requirements
- Runs entirely on local machine (Python 3.11+), no deployment needed for the POC.
- No secrets committed to git. Groq API key via `.env` file, gitignored.
- Each stage independently testable (see BUILD_GUIDE.md). No "big bang" integration.
- Total external cost: $0.

## 11. Success Criteria for the POC Demo
Given a single pasted initiative paragraph in the Streamlit UI, within ~15–30 seconds the app displays:
1. A structured EPIC (Agent 1's output)
2. The retrieved context chunks (visible, so grounding is inspectable)
3. 2–5 Features (Agent 2's output)
4. Stories + Acceptance Criteria under each Feature
5. Confirmation that the tree was written to the mock backlog API (optional button)

## 12. What This Project Demonstrates
- Retrieval-Augmented Generation grounded in a real (if small) knowledge base
- Multi-agent coordination with a clean handoff between a synthesis agent and a decomposition agent
- Tool/function calling for both retrieval and write-back actions
- Structured output generation with validation
- Deliberate scoping: recognizing which steps of a real workflow are good candidates for agentic automation and which require human judgment
