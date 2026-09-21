-- Additional skills/aliases for the AI-stack side of the talent pool
-- (API integration, RAG/agentic tooling, MLOps/LLMOps, general backend)
-- — on top of the general-purpose starter list seeded in
-- 20260921120000_ats_features_step1_schema.sql. Same idempotent
-- ON CONFLICT DO NOTHING pattern as that seed, so re-running this
-- migration is harmless and it can be applied independently of any
-- other pending migration.

insert into skills (org_id, name) values
  ('00000000-0000-0000-0000-000000000001', 'API Integration'),
  ('00000000-0000-0000-0000-000000000001', 'Prompt Engineering'),
  ('00000000-0000-0000-0000-000000000001', 'Orchestration Frameworks'),
  ('00000000-0000-0000-0000-000000000001', 'Agentic Workflows'),
  ('00000000-0000-0000-0000-000000000001', 'Open-Source Model Deployment'),
  ('00000000-0000-0000-0000-000000000001', 'Vector Database Management'),
  ('00000000-0000-0000-0000-000000000001', 'Data Chunking & Embedding'),
  ('00000000-0000-0000-0000-000000000001', 'Advanced Retrieval Techniques'),
  ('00000000-0000-0000-0000-000000000001', 'Data Pipeline Development'),
  ('00000000-0000-0000-0000-000000000001', 'Backend Development'),
  ('00000000-0000-0000-0000-000000000001', 'Asynchronous Programming'),
  ('00000000-0000-0000-0000-000000000001', 'API Design'),
  ('00000000-0000-0000-0000-000000000001', 'Database Management'),
  ('00000000-0000-0000-0000-000000000001', 'AI Evaluation (Evals)'),
  ('00000000-0000-0000-0000-000000000001', 'LLM Observability'),
  ('00000000-0000-0000-0000-000000000001', 'Guardrails & Safety'),
  ('00000000-0000-0000-0000-000000000001', 'Containerization'),
  ('00000000-0000-0000-0000-000000000001', 'Cloud Infrastructure'),
  ('00000000-0000-0000-0000-000000000001', 'CI/CD Pipelines'),
  ('00000000-0000-0000-0000-000000000001', 'Cache Management'),
  ('00000000-0000-0000-0000-000000000001', 'Git / Version Control'),
  ('00000000-0000-0000-0000-000000000001', 'Workflow Automation'),
  ('00000000-0000-0000-0000-000000000001', 'Model Fine-Tuning'),
  ('00000000-0000-0000-0000-000000000001', 'Data Privacy & Compliance')
on conflict (org_id, name) do nothing;

insert into skill_aliases (org_id, skill_id, alias)
select '00000000-0000-0000-0000-000000000001', s.id, a.alias
from skills s
join (values
  ('API Integration', 'api integration'),
  ('API Integration', 'apis'),
  ('Prompt Engineering', 'prompt eng'),
  ('Orchestration Frameworks', 'orchestration'),
  ('Agentic Workflows', 'agentic ai'),
  ('Agentic Workflows', 'ai agents'),
  ('Agentic Workflows', 'agents'),
  ('Open-Source Model Deployment', 'oss model deployment'),
  ('Open-Source Model Deployment', 'self-hosted llms'),
  ('Open-Source Model Deployment', 'local llm deployment'),
  ('Vector Database Management', 'vector db'),
  ('Vector Database Management', 'vector databases'),
  ('Vector Database Management', 'vectordb'),
  ('Data Chunking & Embedding', 'embeddings'),
  ('Data Chunking & Embedding', 'chunking'),
  ('Data Chunking & Embedding', 'text embedding'),
  ('Advanced Retrieval Techniques', 'rag'),
  ('Advanced Retrieval Techniques', 'retrieval augmented generation'),
  ('Advanced Retrieval Techniques', 'retrieval'),
  ('Data Pipeline Development', 'data pipelines'),
  ('Data Pipeline Development', 'etl'),
  ('Backend Development', 'backend'),
  ('Backend Development', 'back-end development'),
  ('Asynchronous Programming', 'async'),
  ('Asynchronous Programming', 'async programming'),
  ('API Design', 'rest api design'),
  ('API Design', 'api architecture'),
  ('Database Management', 'databases'),
  ('Database Management', 'db management'),
  ('Database Management', 'sql'),
  ('AI Evaluation (Evals)', 'evals'),
  ('AI Evaluation (Evals)', 'ai evals'),
  ('AI Evaluation (Evals)', 'model evaluation'),
  ('LLM Observability', 'observability'),
  ('LLM Observability', 'llm monitoring'),
  ('LLM Observability', 'tracing'),
  ('Guardrails & Safety', 'ai safety'),
  ('Guardrails & Safety', 'guardrails'),
  ('Guardrails & Safety', 'content moderation'),
  ('Containerization', 'docker'),
  ('Containerization', 'containers'),
  -- Deliberately NOT aliasing aws/gcp/azure here — those are distinct
  -- skills, not synonyms for "cloud infrastructure" in general, and
  -- collapsing them into this alias would create false matches (a
  -- candidate who only knows AWS would incorrectly match a role asking
  -- for general "cloud infrastructure" experience via a different
  -- provider, or vice versa).
  ('Cloud Infrastructure', 'cloud'),
  ('Cloud Infrastructure', 'cloud computing'),
  ('CI/CD Pipelines', 'cicd'),
  ('CI/CD Pipelines', 'ci/cd'),
  ('CI/CD Pipelines', 'continuous integration'),
  ('CI/CD Pipelines', 'continuous deployment'),
  ('Cache Management', 'caching'),
  ('Cache Management', 'cache'),
  ('Git / Version Control', 'git'),
  ('Git / Version Control', 'github'),
  ('Git / Version Control', 'gitlab'),
  ('Git / Version Control', 'version control'),
  ('Workflow Automation', 'automation'),
  ('Workflow Automation', 'zapier'),
  ('Workflow Automation', 'make.com'),
  ('Workflow Automation', 'n8n'),
  ('Model Fine-Tuning', 'fine-tuning'),
  ('Model Fine-Tuning', 'finetuning'),
  ('Model Fine-Tuning', 'lora'),
  ('Data Privacy & Compliance', 'data privacy'),
  ('Data Privacy & Compliance', 'compliance'),
  ('Data Privacy & Compliance', 'gdpr')
) as a(skill_name, alias) on a.skill_name = s.name
where s.org_id = '00000000-0000-0000-0000-000000000001'
on conflict (org_id, alias) do nothing;
