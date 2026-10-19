# COBRA: Operational Early Warning & Simulation Platform
## Comprehensive Architectural Specification, Data Contracts, and Implementation Guide

> **Document Status:** Authoritative Architectural Baseline & Foundational Specification  
> **Target Audience:** Systems Architects, Full-Stack Engineers, DevOps/Data Engineers, and AI Coding Assistants  
> **Source Baseline:** Departmental OSINT Sensing Center Documentation, DataForge Schema Specifications, and Cobra Engineering Plans  

---

## 1. Project Overview

### 1.1 Executive Summary
**COBRA** (**מערכת אימונים וסימולציה סינתטית**) is an automated synthetic injection and training simulation platform designed for an operational Open-Source Intelligence (OSINT) and real-time operational sensing center.

The operational unit monitors high-velocity public digital streams—such as open social media platforms, encrypted messaging channels, breaking news tickers, and public web sources—to detect critical, high-impact crises at their earliest inception. The unit's primary mission spans:
- **Rapid Detection of Critical Threats:** Mass-casualty incidents (MCI / אר"ן), hostile terror attacks, natural disasters, industrial explosions, and violent civilian unrest.
- **Sensemaking from Digital Chaos:** Transforming unstructured, noisy, multilingual open-source chatter into high-fidelity, verified situational awareness.
- **Life-Saving Early Warnings:** Enabling command echelons and civil defense authorities to issue actionable alerts to populations under threat and emergency first responders, closing the critical latency gap between incident emergence and tactical response.

### 1.2 The Operational Problem
Under routine steady-state conditions (**בט"ש - Batash**), the rate of genuine high-threat incidents and anomalous signals is low. Conversely, during sudden operational escalations and complex crises, operations rooms are inundated by severe data avalanches, high volumes of deceptive background noise, viral rumors, coordinated disinformation, and stringent operational response service-level agreements (SLAs).

Historically, operational drills relied on cumbersome, manual data entry or static inject lists. These exercises failed to reproduce the chaotic tempo, volume, and fog-of-war characteristic of live events. **COBRA** eliminates these limitations by serving as an automated, reproducible exercise engine capable of generating and dispatching synthetic data streams, dynamic incident timelines, and realistic noise ratios directly into operational downstream systems.

### 1.3 Target Systems and User Personas
COBRA bridges the gap between training directors and operational personnel across two primary downstream platforms:

| System Name | Hebrew Persona | English Role | Operational Responsibility |
| :--- | :--- | :--- | :--- |
| **Specter** | **מב"ר (MABAR)** | Intelligence / Ingestion Analyst | Ingests discrete raw/enriched reports, filters ambient noise and disinformation, and clusters disparate reports into bounded intelligence **Events (אירועים)**. |
| **COMBAT** | **מנל"ח (MANLACH)** | Battle Operations Supervisor (*מנהל לחימה*) | Manages the Common Operational Picture (**תמ"צ**), evaluates threat urgency, coordinates civil protection alerts, and enforces room-wide response SLAs. |
| **Cobra** | **קצין אימונים** | Training Officer / Exercise Director | Designs scenarios, manages template libraries, configures exercise timelines and difficulty parameters, and controls automated scenario injections. |

---

## 2. Project Goals and Scope

### 2.1 Primary Objectives
1. **Automated Incident Playback:** Deliver high-precision, scheduled injection of synthetic reports and events to simulate realistic operational crises.
2. **Deterministic & Realistic Noise Simulation:** Expose analysts to tunable levels of background clutter, duplicate reporting, conflicting accounts, and adversarial disinformation.
3. **Absolute Operational Segregation:** Ensure synthetic simulation payloads run concurrently through shared enterprise pipelines without contaminating real-world operational intelligence or triggering false civil alerts.
4. **Flexible Authoring:** Enable scenario construction through pre-built templates, tabular CSV ingestion, manual UI timeline assembly, and AI-assisted prompt generation.

### 2.2 System Scope & Functional Phasing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COBRA FUNCTIONAL SCOPE                            │
├──────────────────────────────────────────┬──────────────────────────────────┤
│           MVP SCOPE (Active Target)      │       POST-MVP / FUTURE SCOPE    │
├──────────────────────────────────────────┼──────────────────────────────────┤
│ • Full PostgreSQL DB schema & migrations │ • Direct COMBAT Mode event pipe  │
│ • Monorepo foundations (Express + React) │ • Report variable templating     │
│ • Specter Pipe (Kafka reports.enriched)  │ • AI Scenario Builder (DS API)   │
│ • CSV Scenario Import (Schema v2)        │ • Difficulty Wizard              │
│ • Manual Scenario Builder UI & API       │ • Five-Role RBAC (Mirage API)    │
│ • Category & Subcategory Management      │ • Map-based Geo-Picker (polygon) │
│ • Precision Dispatch Scheduler           │ • Automated Retry Engine         │
│ • Run Management & Single Active Lock    │ • Dispatch Metrics & Grafana     │
│ • Baseline Keycloak SSO Integration      │ • Mid-exercise Operator Controls │
└──────────────────────────────────────────┴──────────────────────────────────┘
```

### 2.3 Explicitly Out of Scope (MVP & Boundaries)
- **Trainee Terminal Launching:** Trainees (*מתרגלים*) cannot launch, configure, or view simulations from within their operational interfaces (Specter or COMBAT). Exercises are strictly initiated and controlled remotely by the Training Officer.
- **Automated Trainee Scoring/Grading:** Scoring algorithms, analyst response-time grading, and performance evaluation metrics are excluded from the initial release (focus is strictly on delivery and injection reliability).
- **Direct Historical Classified Ingestion:** Automated scraping or automated ingestion of historical classified operational records directly into the template catalog is deferred.
- **Multi-Tenant Kafka Separation:** Cobra does not provision dedicated "simulation-only" Kafka clusters or isolated simulation topics; architectural segregation is enforced via data attributes (see Section 3.2).

---

## 3. System Architecture

### 3.1 High-Level Architecture Overview
COBRA is structured as a full-stack Node.js/React application within a monorepo, backed by a PostgreSQL database and integrated into an enterprise Apache Kafka event streaming bus.

```mermaid
flowchart TB
    subgraph COBRA["COBRA Simulation Platform"]
        UI["React Web Application<br/>(Builder, Catalog, Run Console)"]
        API["Node.js / Express.js Backend API<br/>(Business Logic, Auth, Ingestion)"]
        SCHED["Precision Scheduler Engine<br/>(Temporal Offset Queue & Dispatcher)"]
        DB[(PostgreSQL Database<br/>Templates, Realities, Runs)]
        
        UI <-->|HTTP / REST| API
        API <-->|SQL / Transactions| DB
        SCHED <-->|Polling / Status Lock| DB
    end

    subgraph BROKER["Enterprise Message Bus (Apache Kafka)"]
        TOPIC_ENRICHED["Topic: reports.enriched<br/>(Key: reality_id:report_id)"]
        TOPIC_STATE["Topic: events.state<br/>(Key: reality_id:event_id)"]
    end

    subgraph DOWNSTREAM["Operational Ecosystem Systems"]
        SPECTER["SPECTER (Sensemaking & Clustering)<br/>Operated by MABAR"]
        COMBAT["COMBAT (Battle Management & C2)<br/>Operated by MANLACH"]
        LAKE["Data Lake (S3 + Parquet)<br/>Kafka Connect Sink"]
        EMBED["Embedding Service & DataForge DB<br/>(pgvector + Scope RAG)"]
    end

    SCHED -->|"Produce (reality_id != 0)"| TOPIC_ENRICHED
    SCHED -.->|"Post-MVP Produce (reality_id != 0)"| TOPIC_STATE

    TOPIC_ENRICHED -->|Consume| SPECTER
    TOPIC_ENRICHED -->|Consume| LAKE
    TOPIC_ENRICHED -->|Consume| EMBED

    TOPIC_STATE -->|Consume| COMBAT
    TOPIC_STATE -->|Consume| LAKE
    TOPIC_STATE -->|Consume| EMBED

    classDef cobra fill:#eef2ff,stroke:#4338ca,stroke-width:2px;
    classDef broker fill:#fef3c7,stroke:#b45309,stroke-width:2px;
    classDef downstream fill:#ecfdf5,stroke:#047857,stroke-width:2px;
    class UI,API,SCHED,DB cobra;
    class TOPIC_ENRICHED,TOPIC_STATE broker;
    class SPECTER,COMBAT,LAKE,EMBED downstream;
```

### 3.2 The Reality Isolation Principle (Zero-Contamination)
A foundational architectural mandate is **strict operational isolation**. To prevent catastrophic real-world false alarms (such as siren activation or tactical force dispatch triggered by a drill), the ecosystem enforces the **Reality Model**:

1. **Shared Topics, Attribute Partitioning:** There are no physically distinct "real" and "simulated" Kafka topics. Both real-world OSINT and synthetic exercise data flow through `reports.enriched` and `events.state`.
2. **The `reality_id` Key:** Every message produced on Kafka and every entity stored in databases carries an integer field: `reality_id`.
   - `reality_id = 0`: Real-world operational intelligence (produced exclusively by real collectors like Blitz/Atlas and enriched by the DE Enricher).
   - `reality_id = 1`: Default simulated reality (used for standard drills).
   - `reality_id > 1`: Isolated exercise environments or specialized sandbox realities.
3. **Database Constraints:** 
   - Table `realities` seeds `0` (Real) and `1` (Simulation).
   - Simulations in Cobra are constrained by a SQL CHECK constraint: `reality_id != 0`.
   - Reports produced by Cobra must never emit `reality_id = 0`.
4. **Consumer Responsibilities:** Downstream systems (Specter and COMBAT) partition their operational views, alerting filters, and persistent state machines by `reality_id`, ensuring operators in a training session see only simulated realities, while live shifts filter for `reality_id = 0`.

---

## 4. Core Components and Responsibilities

### 4.1 Frontend Application (React)
The frontend serves as the Training Officer's administrative command center:
- **Scenario Timeline Builder:** Interactive visual tool allowing instructors to arrange incident sequences, inspect temporal offsets, adjust casualty metrics, and modify geographical tags.
- **Content & Template Catalog:** Two-level hierarchical navigation interface for browsing, searching, and managing pre-configured scenario templates.
- **CSV Ingestion Wizard:** Drag-and-drop parsing tool for bulk scenario imports supporting versioned DataForge CSV specifications.
- **Exercise Execution Monitor:** Live dashboard displaying active exercise state (`started`, `completed`, `stopped`, `failed`), elapsed run time, upcoming dispatch queues, and system health.
- **Post-MVP Modules:**
  - *COMBAT Mode Switcher:* Toggle targeting between raw report streams and aggregated operational events.
  - *Difficulty Wizard & AI Generator:* Natural language prompt console and slider-based difficulty controls (disinformation ratio, burst density).
  - *Map-Based Geo-Picker:* Interactive GIS map interface to select coordinate points and bounding polygons.

### 4.2 Backend Server (Node.js & Express.js)
- **API & Entity Controllers:** Exposes RESTful endpoints conforming to the internal OpenAPI contract for managing simulations, templates, categories, and runs.
- **Ingestion & Validation Engine:** Validates uploaded CSVs and manual inputs against strict field boundaries, UTC timestamp requirements, and data normalization rules.
- **Auth Middleware:** Validates JWT access tokens issued by Keycloak SSO, extracts user identity, and enforces role-based authorization in coordination with Mirage.
- **Database Abstraction:** Manages connection pooling, relational schema migrations, transaction lifecycles, and referential integrity enforcement.

### 4.3 Precision Scheduler & Dispatch Engine
The Scheduler is the heartbeat of COBRA's runtime execution:
- **Offset Resolution:** Given an active simulation run started at timestamp $T_{\text{start}}$, each assigned report is scheduled for dispatch at:
  $$T_{\text{dispatch}} = T_{\text{start}} + \text{dispatch\_offset\_s}$$
- **Execution State Lock:** Enforces the critical operational constraint that **only one run may be in `started` state per simulation**.
- **Kafka Producer Client:** Constructs compliant `ENRICHED_REPORT` (or `EVENT`) payloads, connects to the configured Kafka brokers, and publishes messages to the appropriate topic.
- **Run Finalization:** Automatically transitions run status to `completed` once all dispatched offsets have expired, or flags `failed` upon persistent delivery failure.

### 4.4 PostgreSQL Storage Engine
Persists relational state with strict referential constraints, plain UTC timestamp formatting (`timestamp without time zone`), and deterministic identity generation (see Section 8 for complete schema).

---

## 5. Project Ecosystem and Integrations

COBRA is situated within a broader departmental intelligence ecosystem. Understanding the boundaries and responsibilities of external systems is mandatory:

```mermaid
flowchart LR
    BLITZ["Blitz & Atlas<br/>(OSINT Collectors)"] -->|reports.raw| ENRICH["DE Enricher<br/>(Data Engineering)"]
    FASTBREAK["Fastbreak AI Pods<br/>(Translation, Laya, NER)"] <-->|REST| ENRICH
    
    ENRICH -->|"reports.enriched (reality_id = 0)"| KAFKA{{"Apache Kafka Bus"}}
    
    COBRA["COBRA Simulator<br/>(Training Platform)"] -->|"reports.enriched (reality_id != 0)"| KAFKA
    COBRA -.->|"events.state (reality_id != 0) [Post-MVP]"| KAFKA
    
    KAFKA -->|reports.enriched| SPECTER["Specter (MABAR)<br/>Sensemaking App"]
    KAFKA -->|events.state| COMBAT["COMBAT (MANLACH)<br/>Battle Management"]
    
    SPECTER & COMBAT <-->|Shared App DB| RELAY["Outbox Relay"]
    RELAY -->|events.state / event_reports| KAFKA
    
    KAFKA --> S3["S3 Data Lake<br/>(Kafka Connect Parquet)"]
    KAFKA --> EMBED["Embedding Service<br/>(DataForge Vector DB)"]
    
    EMBED --> SCOPE["Scope RAG Chatbot"]
    EMBED --> DA["DA Research (Horowitz)"]

    classDef collector fill:#f3f4f6,stroke:#4b5563;
    classDef de fill:#dbeafe,stroke:#1d4ed8;
    classDef cobra fill:#e0e7ff,stroke:#4338ca;
    classDef apps fill:#d1fae5,stroke:#047857;
    classDef sinks fill:#fef3c7,stroke:#b45309;
    class BLITZ collector;
    class ENRICH,FASTBREAK de;
    class COBRA cobra;
    class SPECTER,COMBAT,RELAY apps;
    class S3,EMBED,SCOPE,DA sinks;
```

### 5.1 Ecosystem System Roster

| System / Component | Owner / Team | Operational Function | Direct COBRA Interface |
| :--- | :--- | :--- | :--- |
| **Specter** | Specter Team | Operational event-building system operated by the **MABAR**. Clusters raw reports into intelligence events. | **Consumer:** Reads `reports.enriched` published by Cobra. |
| **COMBAT** | COMBAT Team | Operational battle management system operated by the **MANLACH**. Coordinates alert dissemination and Common Operational Picture. | **Consumer (Post-MVP):** Reads `events.state` published by Cobra. |
| **DataForge (DE)** | Data Engineering | Core data pipeline. Ingests raw collector data, runs normalization and enrichment, and manages schema governance. | **Contract Authority:** Cobra strictly mirrors DataForge payload schemas. |
| **Fastbreak** | Fastbreak / Data Science | Hosts ML/NLP models: 1. Translation Pod, 2. Laya Pod (Threat Level), 3. NER Pod (Location, Casualties, Happened-at). | **Reference:** Cobra synthetic payloads mimic Fastbreak output fields without calling live Fastbreak pods. |
| **Mirage** | Mirage / SecOps | Central identity management and role authorization service. | **Auth Provider:** Issues Keycloak SSO tokens and governs operator access roles. |
| **DS Scenario Service** | Data Science Team | Generates synthetic incident scenarios via LLMs based on instructor parameters. | **Provider (Post-MVP):** Cobra calls DS endpoint to generate procedural drills. |
| **Data Lake** | Infra / DE | S3-based Parquet archive written via Kafka Connect for immutable historical storage and replay. | **Passive Observer:** Automatically archives all Cobra Kafka payloads. |
| **DataForge DB** | Data Engineering | PostgreSQL + `pgvector` store serving the Scope RAG bot and analytical research. | **Passive Observer:** Consumes Cobra payloads via Embedding Service. |

---

## 6. Integration and Communication Flows

### 6.1 Flow 1: Scenario Creation and Storage (CSV & Manual)
Instructors define training exercises either by uploading a pre-compiled CSV or through the manual builder UI.

```mermaid
sequenceDiagram
    autonumber
    actor Instructor as Training Officer
    participant FE as Cobra React UI
    participant BE as Cobra Express API
    participant DB as PostgreSQL DB

    Instructor->>FE: Upload CSV (enriched_reports_schema-v2) or Define in UI
    FE->>BE: POST /api/simulations (Payload / CSV stream)
    Note over BE: Validate schema version, UTC times, and casualty nullability
    BE->>BE: Calculate report_id = xxhash64(reality_id + platform + canonical_url)
    BE->>DB: BEGIN TRANSACTION
    BE->>DB: INSERT INTO simulations (id, name, reality_id != 0, length_s, ...)
    BE->>DB: INSERT INTO reports (report_id, reality_id, platform, content, ...)
    BE->>DB: INSERT INTO report_in_simulation (simulation_id, report_id, dispatch_offset_s)
    BE->>DB: COMMIT TRANSACTION
    BE-->>FE: HTTP 201 Created (simulation_id, report_count)
    FE-->>Instructor: Display Scenario Confirmation & Timeline Preview
```

### 6.2 Flow 2: Simulation Execution and Timed Dispatch (MVP Specter Pipe)
When an exercise is triggered, Cobra's Scheduler initiates the dispatch sequence.

```mermaid
sequenceDiagram
    autonumber
    actor Instructor as Training Officer
    participant FE as Cobra React UI
    participant BE as Cobra Express API
    participant SCHED as Scheduler Engine
    participant DB as PostgreSQL DB
    participant KAFKA as Apache Kafka (reports.enriched)
    participant SPECTER as Specter System (MABAR)

    Instructor->>FE: Click "Start Simulation"
    FE->>BE: POST /api/simulations/:id/runs
    BE->>DB: Check active runs (WHERE simulation_id = :id AND status = 'started')
    alt Run Already Active
        BE-->>FE: HTTP 409 Conflict ("Simulation already running")
    else No Active Run
        BE->>DB: INSERT INTO simulation_runs (id, simulation_id, started_at, status='started')
        BE->>SCHED: Register Run Execution (run_id, started_at)
        BE-->>FE: HTTP 200 OK (run_id, status='started')
    end

    loop Dispatch Lifecycle (Ordered by dispatch_offset_s)
        SCHED->>SCHED: Evaluate Clock: current_time >= started_at + dispatch_offset_s
        SCHED->>DB: Fetch Report Payload (report_id)
        SCHED->>KAFKA: Publish ENRICHED_REPORT (Key: reality_id:report_id, reality_id != 0)
        KAFKA-->>SPECTER: Stream message to MABAR analyst terminal
    end

    opt All Reports Dispatched
        SCHED->>DB: UPDATE simulation_runs SET status='completed', completed_at=now()
        SCHED-->>FE: WebSocket / SSE Event: Run Completed
    end
```

### 6.3 Flow 3: COMBAT Mode Event Injection (Post-MVP)
In COMBAT mode, report clustering is bypassed. Pre-built synthetic operational events are injected directly to train the Shift Supervisor (MANLACH).

```mermaid
sequenceDiagram
    autonumber
    participant SCHED as Cobra Scheduler
    participant KAFKA as Apache Kafka (events.state)
    participant COMBAT as COMBAT System (MANLACH)

    Note over SCHED: Simulation target_system = 'combat'
    SCHED->>SCHED: Reached dispatch offset for synthetic Event
    SCHED->>KAFKA: Publish EVENT Payload<br/>(Key: reality_id:event_id, reality_id != 0, status='open')
    KAFKA->>COMBAT: Deliver to MANLACH Common Operational Picture
    Note over COMBAT: Room Supervisor manages triage, threat urgency, and alert workflow
```

---

## 7. Data Flow and Processing Lifecycle

### 7.1 Report Lifecycle State Machine
Within Cobra, intelligence reports progress through four distinct lifecycle phases:

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│ 1. Catalog / CSV │ ----> │   2. Staged in   │ ----> │ 3. Active Run    │ ----> │ 4. Dispatched to │
│    Definition    │       │     Database     │       │    Queueing      │       │      Kafka       │
└──────────────────┘       └──────────────────┘       └──────────────────┘       └──────────────────┘
  • Staged in CSV            • Copied into              • Simulation run           • Produced to
    or Template table          `reports` table            status = 'started'         reports.enriched
  • No report_id yet         • Assigned                 • Clock reaches            • reality_id != 0
  • dispatch_offset_s          xxhash64 ID                dispatch_offset_s          strictly enforced
    configured               • Linked in junction       • Single-run lock          • Ingested by
                               table                      active                     Specter MABAR
```

### 7.2 Run Execution State Machine
Every execution instance of a simulation is tracked in `simulation_runs`:

```mermaid
stateDiagram-v2
    [*] --> started: Operator clicks "Start Run"
    started --> completed: All reports dispatched successfully (T_elapsed >= max_offset)
    started --> stopped: Operator manually triggers "Stop Run"
    started --> failed: Unrecoverable broker failure / fatal worker error
    
    completed --> [*]
    stopped --> [*]
    failed --> [*]

    note right of started
        STRICT CONSTRAINT:
        Only ONE run per simulation
        can have status = 'started'
        at any given time.
    end note
```

---

## 8. Interfaces and Contracts

### 8.1 Kafka Payload Contract: `ENRICHED_REPORT`
- **Kafka Topic:** `reports.enriched`  
- **Production Key:** `reality_id:report_id` (Composite string or numeric hash)  
- **Governing Schema Owner:** Data Engineering (DE Team) / Central Schema Registry  

| Field Name | Type | Key | Nullable | Operational Description & Contract Rules |
| :--- | :--- | :--- | :--- | :--- |
| `report_id` | `bigint` | PK | No | Unique report identifier. In Cobra: `xxhash64(reality_id + platform + canonical report_url)`. |
| `reality_id` | `integer` | PK | No | **Mandatory segregation field.** Cobra MUST publish non-zero (`>= 1`). Real pipeline is `0`. |
| `schema_version` | `integer` | | No | Enriched contract schema version (checked by Schema Registry). |
| `is_official` | `boolean` | | No | Source authenticity tag (`true` = Atlas / formal news; `false` = Blitz / social channels). |
| `platform` | `string` | UK | No | Source platform enum (`telegram`, `web`, `twitter`, etc.). Unique with `report_url` & `reality_id`. |
| `account_name` | `string` | | Yes | Publishing account identifier or handle. |
| `channel_name` | `string` | | Yes | Specific feed, channel, or broadcast group name. |
| `report_url` | `string` | UK | No | Canonical URL of the source posting. |
| `report_title` | `string` | | Yes | Headline or title (`NULL` if absent). |
| `original_language` | `string` | | No | ISO 639-1 two-letter language code (e.g., `ar`, `he`, `en`). |
| `matches` | `string[]` | | No | Array of trigger alert keywords matched during parsing. |
| `published_at` | `timestamp`| | Yes | ISO 8601 UTC timestamp of online publication. |
| `collected_at` | `timestamp`| | No | ISO 8601 UTC timestamp when ingested. |
| `happened_at` | `timestamp`| | Yes | ISO 8601 UTC timestamp when the reported incident took place (extracted by NER). |
| `original_content` | `text` | | No | Raw parsed text content (cleaned, normalized plain text; no HTML). |
| `translated_content`| `text` | | Yes | Translated text into departmental operational language (`NULL` if original is in target language). |
| `threat_level` | `smallint` | | No | Numerical assessment scale (defined by Fastbreak Laya model). |
| `country` | `string` | | Yes | ISO 3166-1 alpha-2 country code (e.g., `IL`, `SY`, `LB`). |
| `city` | `string` | | Yes | Identified city or locality name. |
| `lat` | `double` | | Yes | Geographical latitude (WGS 84 coordinate system). |
| `long` | `double` | | Yes | Geographical longitude (WGS 84 coordinate system). |
| `red_injured_count` | `integer` | | Yes | **CRITICAL:** `NULL` = unknown; `0` = reported zero. Never coerce `NULL` to `0`! |
| `red_death_count` | `integer` | | Yes | **CRITICAL:** `NULL` = unknown; `0` = reported zero. Hostile/red casualties. |
| `blue_injured_count`| `integer` | | Yes | **CRITICAL:** `NULL` = unknown; `0` = reported zero. Friendly/civilian casualties. |
| `blue_death_count` | `integer` | | Yes | **CRITICAL:** `NULL` = unknown; `0` = reported zero. Friendly/civilian fatalities. |
| `fastbreak_model_version` | `string` | | No | Semantic version of AI model tag (e.g., `fastbreak-v2.4.1`). |

### 8.2 Kafka Payload Contract: `EVENT` (Post-MVP COMBAT Mode)
- **Kafka Topic:** `events.state`  
- **Compacted Key:** `reality_id:event_id`  
- **Governing Schema Owner:** Specter + COMBAT Shared Outbox Relay / Schema Registry  

| Field Name | Type | Key | Nullable | Operational Description & Contract Rules |
| :--- | :--- | :--- | :--- | :--- |
| `event_id` | `string` | PK | No | Compacted topic message key. UUID format string. |
| `reality_id` | `integer` | PK | No | **0 = real world**; Cobra publishes non-zero integer. |
| `version` | `integer` | | No | Incremented monotonically on every modification (+1). |
| `status` | `string` | | No | Avro enum: `open`, `in_progress`, `closed`. |
| `event_type` | `string` | | No | Tactical categorization agreed with COMBAT team. |
| `is_deleted` | `boolean` | | No | Logical deletion flag. Never hard-delete events; set `is_deleted = true`. Default `false`. |
| `title` | `string` | | No | Event operational summary headline. |
| `description` | `string` | | Yes | Extended descriptive narrative of the operational incident. |
| `notes` | `string` | | Yes | Operator annotations and tactical remarks. |
| `sector` | `string` | | Yes | Operational command sector or territorial boundary. |
| `sector_description`| `string`| | Yes | Textual detail of operational sector boundaries. |
| `start_time` | `timestamp`| | No | ISO 8601 UTC timestamp of incident inception. |
| `red_injured_count` | `integer` | | Yes | Hostile injured count (`NULL` = unknown, `0` = zero). |
| `red_death_count` | `integer` | | Yes | Hostile death count (`NULL` = unknown, `0` = zero). |
| `blue_injured_count`| `integer` | | Yes | Friendly/civilian injured count (`NULL` = unknown, `0` = zero). |
| `blue_death_count` | `integer` | | Yes | Friendly/civilian death count (`NULL` = unknown, `0` = zero). |
| `threat_level` | `number` | | Yes | Calculated event threat index. |
| `deployed_forces` | `number` | | Yes | Tally of dispatched emergency or tactical units. |
| `created_at` | `timestamp`| | No | ISO 8601 UTC timestamp of event creation. |
| `updated_at` | `timestamp`| | No | ISO 8601 UTC timestamp of most recent version update. |

### 8.3 Tabular Ingestion Specification (`enriched_reports_schema-v2.csv`)
Cobra supports direct simulation loading via CSV files. The CSV must match the following header specification:

```csv
schema_version,is_official,platform,account_name,channel_name,report_url,report_title,original_language,matches,published_at,collected_at,dispatch_offset_s,original_content,translated_content,threat_level,happened_at,country,city,lat,long,red_injured_count,red_death_count,blue_injured_count,blue_death_count,fastbreak_model_version
```

- **Special Column:** `dispatch_offset_s` (Integer $\ge 0$): Denotes the exact number of seconds elapsed from simulation start ($T_{\text{start}}$) until this specific report is pushed to Kafka.
- **Delimiter Rules:** Semicolon `;` is used as an array delimiter for multi-value strings such as `matches` (e.g., `alert;strike;incident`).
- **Null Values:** Empty fields between commas `,` represent `NULL` values. For count columns, an empty field parses to `NULL` (unknown), whereas literal `0` parses to integer zero.

### 8.4 PostgreSQL Relational Database Schema
The complete relational schema for Cobra as defined in the architectural ERD:

```mermaid
erDiagram
    realities ||--o{ reports : "reality_id"
    realities ||--o{ simulations : "reality_id"
    simulations ||--o{ report_in_simulation : "simulation_id"
    reports ||--o{ report_in_simulation : "report_id"
    simulations ||--o{ simulation_runs : "simulation_id"
    simulation_difficulty ||--o{ simulations : "difficulty"
    simulation_target_system ||--o{ simulations : "target_system"
    simulation_run_status ||--o{ simulation_runs : "status"
    template_categories ||--o{ template_sub_categories : "category_id"
    template_categories ||--o{ report_templates : "category_id"
    template_sub_categories |o--o{ report_templates : "sub_category_id"
    report_templates |o--o{ reports : "template_id"

    realities {
        integer id PK "0 = real, 1 = simulation (default)"
        text name UK "Seeded: 'real', 'simulation'"
    }

    template_categories {
        uuid id PK "gen_random_uuid()"
        text name UK "Category name (e.g. Natural Disasters)"
    }

    template_sub_categories {
        uuid id PK "gen_random_uuid()"
        uuid category_id FK "Parent category reference"
        text name "Unique within category_id"
    }

    report_templates {
        uuid id PK "gen_random_uuid()"
        uuid category_id FK "Required category"
        uuid sub_category_id FK "Nullable, must match category"
        timestamp template_created_at "UTC without tz"
        timestamp template_updated_at "UTC without tz"
        integer schema_version
        boolean is_official
        text platform
        text account_name
        text channel_name
        text report_url
        text report_title "Nullable"
        text original_language "ISO 639-1"
        text_array matches "Trigger keywords"
        timestamp published_at "Nullable"
        timestamp happened_at "Nullable"
        timestamp collected_at
        text original_content
        text translated_content "Nullable"
        smallint threat_level
        text country "ISO 3166-1 alpha-2"
        text city
        double_precision lat
        double_precision long
        integer red_injured_count "NULL=unknown, 0=zero"
        integer red_death_count
        integer blue_injured_count
        integer blue_death_count
        text fastbreak_model_version
    }

    reports {
        bigint report_id PK "xxhash64(reality + platform + url)"
        integer reality_id FK, UK "default 1. Unique with platform + report_url"
        uuid template_id FK "Nullable, reference to source template"
        integer schema_version
        boolean is_official
        text platform UK
        text account_name
        text channel_name
        text report_url UK "Canonical form"
        text report_title "Nullable"
        text original_language "ISO 639-1"
        text_array matches
        timestamp published_at "Nullable"
        timestamp happened_at "Nullable"
        timestamp collected_at
        text original_content
        text translated_content "Nullable"
        smallint threat_level
        text country "ISO 3166-1 alpha-2"
        text city
        double_precision lat
        double_precision long
        integer red_injured_count "NULL=unknown, 0=zero"
        integer red_death_count
        integer blue_injured_count
        integer blue_death_count
        text fastbreak_model_version
    }

    simulations {
        uuid id PK "gen_random_uuid()"
        text name
        text description
        timestamp created_at "now() AT TIME ZONE 'utc'"
        timestamp updated_at "now() AT TIME ZONE 'utc'"
        simulation_difficulty difficulty "easy, medium, hard"
        integer length_s "Set by user, exercise duration"
        boolean ai_generated "false for manual, true for AI"
        simulation_target_system target_system "specter, combat"
        integer reality_id FK "default 1, CHECK (reality_id != 0)"
    }

    report_in_simulation {
        uuid simulation_id PK, FK
        bigint report_id PK, FK
        integer dispatch_offset_s PK "Seconds from start"
    }

    simulation_runs {
        uuid id PK "gen_random_uuid()"
        uuid simulation_id FK
        timestamp started_at "now() AT TIME ZONE 'utc'"
        timestamp completed_at "Nullable until finished"
        simulation_run_status status "started, completed, stopped, failed"
    }
```

#### Detailed Database Design Notes & Constraints
1. **Timestamp Representation:** All database timestamps are plain PostgreSQL `timestamp` (without time zone) holding explicit UTC values. Default values use `now() AT TIME ZONE 'utc'`. Backend application connections must serialize and read dates exclusively in UTC.
2. **Deterministic `report_id` Construction:** Table `reports` enforces a primary key on `report_id`. To allow identical URLs across differing simulation realities without collision, `report_id` is computed as an `xxhash64` hash of `reality_id + platform + canonical report_url`. The natural uniqueness constraint is `(reality_id, platform, report_url)`.
3. **Template Dissociation on Delete:** When a template is removed from `report_templates`, `ON DELETE SET NULL` applies to `reports.template_id`. This prevents active or historical simulations from losing their underlying report records.
4. **Hierarchical Category Rules:** The composite foreign key `(category_id, sub_category_id)` on `report_templates` guarantees that a referenced sub-category strictly belongs to the specified parent category. Sub-categories cannot be orphaned.
5. **Simulation Safety Constraint:** The table `simulations` contains a hard CHECK constraint: `CHECK (reality_id != 0)`. Simulations are structurally forbidden from writing to reality `0`.
6. **Deletion Protections:** Deleting a simulation cascades to `report_in_simulation`, but is blocked by a foreign key constraint if active records exist in `simulation_runs`. A report cannot be dropped if it is linked into an active simulation.

---

## 9. Dependencies and External Services

### 9.1 Infrastructure and Service Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INFRASTRUCTURE TOPOLOGY                            │
├─────────────────────┬──────────────────────────────┬────────────────────────┤
│ Layer               │ Technology / Vendor          │ Environment Role       │
├─────────────────────┼──────────────────────────────┼────────────────────────┤
│ Application Runtime │ Node.js (v20+ LTS), React 18 │ Full-stack execution   │
│ Primary Datastore   │ PostgreSQL (v13+)            │ Relational persistence │
│ Message Broker      │ Apache Kafka (v3.x+)         │ Scenario event stream  │
│ Authentication/SSO  │ Keycloak / Mirage Gateway    │ OpenID Connect / OAuth │
│ Cloud Infrastructure│ Amazon Web Services (AWS)    │ Compute & network tier │
│ CI/CD Pipeline      │ GitLab CI/CD                 │ Build, test, container │
│ Telemetry & Metrics │ Prometheus & Grafana         │ Dispatch observability │
└─────────────────────┴──────────────────────────────┴────────────────────────┘
```

### 9.2 External Team Dependencies & Fallback Strategy

| Dependency | Provider Team | Critical By | Primary Purpose | Development Fallback Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL & Kafka** | Infrastructure | Sunday (Dev) | Core datastore and event streaming broker. | Run local Docker containers (`docker-compose` with Postgres 15 & Kafka KRaft). |
| **Specter Report Schema**| Data Team (DE) | Sunday | Schema registry approval for `reports.enriched`.| Use documented DataForge Post Schemas specification. |
| **Keycloak Realm & Roles**| Mirage Team | Before Auth slice | SSO token issuance & role verification. | Mock JWT verification middleware & mock header injection. |
| **Active Specter Consumer**| Specter Team | Tuesday Morning | Verification of end-to-end ingestion in test room. | Deploy internal mock consumer CLI logging received Kafka offsets. |
| **COMBAT Event Contract**| COMBAT Team | Tuesday (Post-MVP)| Schema alignment for `events.state`. | Use documented DataForge `EVENT` table schema. |
| **AI LLM API Endpoint** | Data Science (DS)| Tuesday Night | Natural language scenario generator API. | AI Stub returning pre-seeded synthetic scenarios. |
| **Library Seed Content** | Training Officer | Tuesday Demo | Initial operational categories and templates. | Ship mock civilian unrest and explosion scenario drafts. |

---

## 10. Configuration and Environment

### 10.1 Environment Variables Specification
The backend service requires configuration via standard environment variables:

```ini
# --- Core Application Environment ---
NODE_ENV=development                 # 'development' | 'test' | 'production'
PORT=5000                            # Express HTTP API listening port
LOG_LEVEL=info                       # 'debug' | 'info' | 'warn' | 'error'
CORS_ORIGIN=http://localhost:3000    # Authorized frontend origin URL

# --- PostgreSQL Connection Parameters ---
DATABASE_URL=postgresql://cobra_app:secure_pwd@localhost:5432/cobra_db
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_TIMEOUT_MS=5000

# --- Apache Kafka Streaming Configuration ---
KAFKA_BROKERS=localhost:9092,localhost:9093
KAFKA_CLIENT_ID=cobra-simulation-engine
KAFKA_TOPIC_ENRICHED_REPORTS=reports.enriched
KAFKA_TOPIC_EVENT_STATE=events.state
KAFKA_PRODUCER_ACKS=-1               # Wait for all in-sync replicas (all)
KAFKA_PRODUCER_RETRIES=5

# --- Security, Identity, and Mirage Auth ---
KEYCLOAK_REALM_URL=https://auth.internal.unit/realms/operational-corp
KEYCLOAK_CLIENT_ID=cobra-portal
KEYCLOAK_CLIENT_SECRET=sample_client_secret
MIRAGE_ROLES_ENDPOINT=https://mirage.internal.unit/api/v1/user-roles
BYPASS_AUTH_IN_DEV=false             # Must NEVER be enabled in production

# --- External AI Generation Engine (Post-MVP) ---
DS_SCENARIO_API_URL=https://ds-engine.internal.unit/api/v2/generate-scenario
DS_SCENARIO_API_TIMEOUT_MS=15000
```

### 10.2 Seed Realities Requirement
Prior to application launch, database migrations must guarantee the presence of two fundamental records in table `realities`:

```sql
INSERT INTO realities (id, name) VALUES 
  (0, 'real'),
  (1, 'simulation')
ON CONFLICT (id) DO NOTHING;
```

---

## 11. Error Handling and Failure Scenarios

### 11.1 Scheduling Engine Resilience & Clock Skew
- **Missed Dispatch Detection:** If the Scheduler process halts or suffers CPU throttling, subsequent loops must evaluate:
  $$\text{Current\_Time} \ge \text{started\_at} + \text{dispatch\_offset\_s}$$
  Any un-dispatched messages whose temporal threshold has passed must be dispatched immediately in chronologically ordered micro-batches, preventing lost reports.
- **Run Timeout Watchdog:** If an active run exceeds its defined `length_s` by a configurable safety threshold without achieving clean completion, the run is flagged as `failed` with an internal alert log.

### 11.2 Kafka Delivery Failure & Idempotency
- **Broker Disconnection:** Kafka producer initialization must configure `acks=all` (`-1`) and retry backoff.
- **Idempotent Writes:** Network interruptions during message acknowledgment must not duplicate reports downstream. Message keys (`reality_id:report_id`) enable downstream deduplication in Specter and DataForge.
- **Persistent Failure Handling:** In the event of catastrophic broker unavailability exceeding retry thresholds, the Scheduler aborts the run, transitions `simulation_runs.status` to `failed`, logs the dispatch offset index at failure, and alerts the operator interface.

### 11.3 Casualty Count Integrity Constraints
A critical data-integrity pitfall identified across departmental systems is the conflation of missing data with explicit zero values:
- `NULL`: Denotes **Unknown** / unreported casualty metrics.
- `0`: Denotes an **explicitly confirmed zero casualty** count.
- **Rule of Non-Coercion:** Application serialization layers, CSV import parsers, and UI form validators must strictly preserve this distinction. Coercing `NULL` into `0` breaks Data Analysis (DA) algorithms and invalidates operational triage reporting.

---

## 12. Security and Permissions

### 12.1 Authentication via Keycloak SSO
Users authenticate via the centralized Keycloak SSO realm. The React UI exchanges user credentials for an OpenID Connect (OIDC) JWT Bearer token, which is transmitted in the HTTP `Authorization` header (`Bearer <token>`) to the Express API.

### 12.2 Role-Based Access Control (RBAC) Matrix
Permissions are governed via five enterprise Mirage roles:

| Role Identifier | System | Granted Privileges & Operational Boundaries |
| :--- | :--- | :--- |
| **Admin** | Global | Full administrative authority. Manage system settings, purge test data, configure realities, assign user permissions. |
| **Specter Editor** | Cobra (Specter) | Full authoring rights for Specter simulations: create/edit report templates, upload CSVs, configure schedules, launch Specter runs. |
| **Specter User** | Cobra (Specter) | Read-only access to Specter simulations and report templates. Cannot trigger or alter active runs. |
| **COMBAT Editor** | Cobra (COMBAT) | Full authoring rights for COMBAT operational event scenarios, event templates, and COMBAT mode run execution. |
| **COMBAT User** | Cobra (COMBAT) | Read-only access to COMBAT event templates and execution history. Cannot trigger or modify COMBAT runs. |

---

## 13. Development Conventions and Constraints

### 13.1 Monorepo Engineering Standards
- **Directory Topology:**
  - `/backend`: Node.js, Express.js, PostgreSQL migration scripts, Kafka publisher workers.
  - `/frontend`: React SPA, modern CSS design tokens, state management.
  - `/shared`: Shared TypeScript types, data contracts, and OpenAPI specifications.
- **Zero Schema Drift:** No developer may introduce fields or modify properties on `ENRICHED_REPORT` or `EVENT` payloads without formal synchronization with DataForge DE and Schema Registry contracts.

### 13.2 Temporal and Time-Zone Standards
- **Universal UTC Mandate:** Every timestamp in the database, API transport, and Kafka message must be normalized to UTC.
- **Database Datatype:** Plain `timestamp` without time zone in PostgreSQL. Never use `timestamptz`, as implicit server time-zone conversions corrupt chronological dispatch sorting.
- **Display Conversion:** Time-zone conversions to Israeli Standard Time (IST / IDT) occur exclusively at the presentation layer in the React frontend.

### 13.3 Hashing and Entity Identity Standards
- **Deterministic ID Generation:** Report IDs must be deterministically generated using the 64-bit non-cryptographic hash function `xxhash64` over:
  $$\text{Payload} = \text{String}(\text{reality\_id}) + \text{platform} + \text{canonical\_url}$$
- **UUID Standards:** Simulation IDs, template IDs, category IDs, and run IDs must use version-4 UUIDs generated via PostgreSQL's native `gen_random_uuid()` or backend libraries.

---

## 14. Current Project Status

### 14.1 Status Summary
- **Architecture & System Design:** Complete and baseline approved.
- **Database Relational Design:** Schema fully specified (PostgreSQL 13+ compliant).
- **External Integration Specifications:** DataForge schema contracts verified for `RAW_REPORT`, `ENRICHED_REPORT`, and `EVENT`.
- **Implementation State:** Preparing for baseline repository scaffolding and MVP feature slices.

### 14.2 Feature Dependency Roadmap

```
MVP CRITICAL PATH (Pre-Demo Milestone):
[DB Migrations (M02)] + [Monorepo Scaffold (M01, M13, M03)]
         │
         ├───> [Simulation from CSV (New)] ───> [Manual Builder (M06, M16, M17)]
         │                                              │
         ├───> [Basic Library (M04, M05, M15)]          └───> [Scheduler (M10)]
         │               │                                          │
         │               └───> [Category Edit (M20, M21)]           │
         │                                                          │
         └───> [Specter Pipe (M08, M09)] ───────────────────────────┤
         │                                                          ▼
         └───> [SSO & Mirage Auth (M07, M14, M22)] ─────────> [Run & Status (M11, M18)]
                                                                    │
                                                                    ▼
                                                             [MVP Test (M19)]

POST-MVP ROADMAP (Independent Feature Tracks):
Track 1: Report Templates (P05) ────> Report Variables (P06)
Track 2: Difficulty Wizard (P08) ───> AI Scenario Builder (P10)
Track 3: COMBAT Backend (P09) ──────> COMBAT UI Switcher
Track 4: RBAC Hardening (P03) ──────> Retries (P01) ───> Map Picker (P07)
                                          │
                                          ▼
                               [Final Integration (P13)]
```

### 14.3 Feature Slice Status Table

| Slice ID | Functional Area | Target Phase | Dependencies | Scope & Description | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **M02** | DB Schema | MVP | None | Core PostgreSQL migrations, seed realities, tables, indexes. | Designed |
| **M01/M13/M03**| Monorepo Foundations | MVP | None | Backend/frontend scaffold, OpenAPI contract definitions. | Designed |
| **CSV** | Ingestion Engine | MVP | M02, M01 | Parse schema-v2 CSV into database simulations and reports. | Designed |
| **M08/M09** | Specter Pipe | MVP | M01, Kafka | Kafka producer publishing `ENRICHED_REPORT` payloads. | Designed |
| **M06/M16/M17**| Manual Builder | MVP | CSV | UI and API for custom timeline assembly and configuration. | Designed |
| **M10** | Scheduler Engine | MVP | M06, M08 | Chronological dispatch queue resolving $T_{\text{dispatch}}$ offsets. | Designed |
| **M11/M18** | Run & Monitor | MVP | M10, Auth | State machine execution, single-run lock, run monitor UI. | Designed |
| **M07/M14/M22**| Auth & SSO | MVP | Monorepo | Keycloak JWT validation and user identity parsing. | Designed |
| **M04/M05/M15**| Basic Library | MVP (Off-path)| DB, Monorepo| Template catalog browsing and basic management. | Designed |
| **M20/M21** | Category Editing | MVP (Off-path)| Basic Library| Two-level hierarchical category and sub-category editor. | Designed |
| **M19** | MVP Validation | MVP Milestone| All MVP | End-to-end integration test with live Specter consumer. | Planned |
| **P05/P06** | Template Engine | Post-MVP | MVP | Parameterized templates and runtime variable replacement. | Planned |
| **P08/P10** | AI Scenario Builder | Post-MVP | DS Team API | Prompt-driven generation and difficulty tuning sliders. | Planned |
| **P09** | COMBAT Pipeline | Post-MVP | COMBAT Team | Direct synthetic `EVENT` injection to `events.state`. | Planned |
| **P03/P01/P07**| Governance & Map | Post-MVP | Mirage API | Full 5-role RBAC enforcement, Kafka retries, map picker. | Planned |
| **P02/P11/P12**| Telemetry & Control| Nice-to-Have | MVP + Post | Dispatch metrics, mid-run pause/inject, history log. | Backlog |

---

## 15. Known Gaps and Open Questions

The following technical interfaces and operational details are currently undocumented or pending external team deliverables:

1. **DS Scenario Generation API Contract (Post-MVP):** The exact REST payload schema, required request headers, latency SLA, and token limits for the Data Science team's LLM generation endpoint remain unfinalized. (Fallback: AI stub returning pre-defined incident templates).
2. **COMBAT Event Ingestion Endpoint / Partitioning:** While the `EVENT` schema in DataForge is specified, confirmation is required from the COMBAT team regarding consumer offset handling and group partitioning for simulated events on `events.state`.
3. **Mirage Role Provisioning Endpoint:** The exact HTTP path and JSON structure for querying user roles and organizational hierarchy from Mirage is pending delivery from the Mirage team. (Fallback: Inject mock user roles in authentication token payload).
4. **Kafka Production Retention Policies:** Specific log retention periods, compaction policies, and partition strategies on topic `reports.enriched` for simulated realities require infrastructure sign-off.
5. **Operational Template Library Content:** Formal approval from the Training Officer regarding baseline scenario templates (e.g., standard MCI drills, rocket alerts, cyber/disinformation storms) is scheduled for Tuesday morning.

---

## 16. AI Coding Assistant Instructions

When working on the COBRA codebase, all AI coding assistants must strictly adhere to the following behavioral rules and engineering guardrails:

> [!IMPORTANT]
> ### Critical AI Coding Rules
> 1. **Consult This Document First:** Always reference `COBRA.md` before proposing architectural modifications, creating new tables, or establishing external integrations.
> 2. **Never Violate Reality Isolation:** Every database query, API contract, and Kafka producer routine involving synthetic data MUST enforce `reality_id != 0`. Never emit or allow `reality_id = 0` on simulation payloads.
> 3. **Preserve Casualty Count Semantics:** NEVER convert `NULL` to `0` for `red_injured_count`, `red_death_count`, `blue_injured_count`, or `blue_death_count`. `NULL` signifies *unknown*; `0` signifies *confirmed zero*. Coercion corrupts analytics.
> 4. **No Schema Inventions:** Do not add speculative fields, invent phantom REST endpoints, or alter the DataForge contracts (`reports.enriched`, `events.state`). If an interface detail is missing, query the developer or consult Section 8.
> 5. **Enforce Plain UTC Timestamps:** Ensure database timestamp definitions use `timestamp` without time zone. Never use `timestamptz`. Always generate and serialize timestamps in UTC using `now() AT TIME ZONE 'utc'` or `.toISOString()`.
> 6. **Adhere to `report_id` Formula:** When creating reports, generate the primary key via `xxhash64(reality_id + platform + canonical_report_url)`. Never assign autoincrementing integers or unhashed UUIDs to `report_id`.
> 7. **Respect Single-Run Invariant:** Guarantee that no simulation can have more than one run record in the `started` status concurrently.
> 8. **Verify Physical Implementation:** Inspect existing files in the workspace before assuming directories or modules have already been generated. Distinguish clearly between planned architecture and implemented code.
> 9. **Protect Downstream Systems:** Never modify message publication formats without analyzing the cascading impact on Specter, COMBAT, the S3 Data Lake, and the DataForge Embedding Service.
> 10. **Keep Documentation Synchronized:** If an approved implementation decision alters an interface, schema, or configuration variable, immediately update the corresponding section in `COBRA.md`.

---

## 17. Source Documents and References

This specification was synthesized directly from primary technical assets and operational documentation within the departmental repository:

| Document / Asset | Format | Repository Path / Reference | Primary Architectural Context Provided |
| :--- | :--- | :--- | :--- |
| `system_overview_architecture.md` | Markdown | `source_materials/system_overview_architecture.md` | Departmental mission, operational challenges, MABAR/MANLACH roles, ecosystem architecture, technology stack, operational glossary. |
| `cobra_erd.md` | Markdown | `source_materials/cobra_erd.md` | Complete PostgreSQL schema, ER diagram, realities, report templates, simulation runs, table constraints, identity generation rules. |
| `cobra_feature_plan.md` | Markdown | `source_materials/cobra_feature_plan.md` | Feature slice dependencies, critical path analysis, MVP vs Post-MVP roadmaps, external blockers, fallback strategies. |
| `DataForge Post Schemas (1).md` | Markdown | `source_materials/DataForge Post Schemas (1).md` | Authoritative contracts for `RAW_REPORT`, `ENRICHED_REPORT`, `EVENT`, and `EVENT_REPORTS`. |
| `dataforge-data-flow.html` / `.docx`| HTML / Word| `source_materials/dataforge-data-flow.html` | High-level data flow diagram, horizontal Kafka broker, DE 7-step enrichment stack, S3 lake, Fastbreak pods, DataForge pgvector DB. |
| `enriched_reports_schema-v2.csv` | CSV | `source_materials/enriched_reports_schema-v2.csv` | Canonical tabular specification for simulation report ingestion and temporal dispatch offsets. |
| `cobra_logo_transparent.png` | Asset | `source_materials/cobra_logo_transparent.png` | Official project graphical identity and visual badge. |

---
*COBRA Specification Document · Approved for Departmental Simulation Architecture Baseline*
