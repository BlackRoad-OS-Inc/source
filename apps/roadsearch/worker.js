// ╔══════════════════════════════════════════════════════════════╗
// ║  RoadSearch — BlackRoad's Sovereign Search Engine           ║
// ║  D1 full-text index + Ollama AI answers + live fleet data   ║
// ╚══════════════════════════════════════════════════════════════╝

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// ─── Schema ───────────────────────────────────────────────────────────
const SCHEMA = `
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'page',
  tags TEXT NOT NULL DEFAULT '',
  indexed_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
  title, description, content, tags,
  content=pages, content_rowid=id
);
CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
  INSERT INTO pages_fts(rowid, title, description, content, tags)
  VALUES (new.id, new.title, new.description, new.content, new.tags);
END;
CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
  INSERT INTO pages_fts(pages_fts, rowid, title, description, content, tags)
  VALUES ('delete', old.id, old.title, old.description, old.content, old.tags);
END;
CREATE TRIGGER IF NOT EXISTS pages_au AFTER UPDATE ON pages BEGIN
  INSERT INTO pages_fts(pages_fts, rowid, title, description, content, tags)
  VALUES ('delete', old.id, old.title, old.description, old.content, old.tags);
  INSERT INTO pages_fts(rowid, title, description, content, tags)
  VALUES (new.id, new.title, new.description, new.content, new.tags);
END;
CREATE TABLE IF NOT EXISTS queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  ai_answered INTEGER DEFAULT 0,
  ip TEXT DEFAULT '',
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pages_domain ON pages(domain);
CREATE INDEX IF NOT EXISTS idx_pages_category ON pages(category);
CREATE INDEX IF NOT EXISTS idx_queries_created ON queries(created_at);
`;

// ─── Seed Data (BlackRoad ecosystem) ──────────────────────────────────
const SEED_PAGES = [
  // ── Core Sites ──
  { url: 'https://blackroad.io', title: 'BlackRoad OS — Sovereign Agent Operating System', description: 'The distributed agent OS. Self-hosted AI infrastructure on Raspberry Pi clusters. 8 agents, 207 repos, 141 domains. Your AI. Your Hardware. Your Rules.', domain: 'blackroad.io', category: 'site', tags: 'os,agents,infrastructure,sovereign,pi,raspberry', content: 'BlackRoad OS is a sovereign agent operating system that runs on Raspberry Pi clusters. It includes 8 AI agents (Alice, Lucidia, Cecilia, Cece, Aria, Eve, Meridian, Sentinel), a distributed memory system, and the Z-framework (Z:=yx-w) for composable infrastructure. Founded by Alexa Louise Amundson.' },
  { url: 'https://blackroad.network', title: 'BlackRoad Network — RoadNet Carrier Infrastructure', description: 'Mesh carrier network spanning 5 Raspberry Pi nodes. WiFi mesh, WireGuard VPN, Pi-hole DNS, and sovereign connectivity.', domain: 'blackroad.network', category: 'site', tags: 'network,mesh,wireguard,vpn,dns,roadnet,carrier', content: 'RoadNet is BlackRoad\'s carrier-grade mesh network. 5 access points (Alice CH1, Cecilia CH6, Octavia CH11, Aria CH1, Lucidia CH11) with dedicated subnets 10.10.x.0/24, NAT routing, Pi-hole DNS filtering, and WireGuard failover. Boot-persistent via systemd.' },
  { url: 'https://blackroad.systems', title: 'BlackRoad Systems — Distributed Computing Platform', description: 'Distributed systems platform with 52 TOPS of Hailo-8 AI acceleration, Docker Swarm orchestration, and edge computing across 5 nodes.', domain: 'blackroad.systems', category: 'site', tags: 'systems,distributed,hailo,edge,computing,docker,swarm', content: 'BlackRoad Systems is the distributed computing layer. 2x Hailo-8 accelerators (52 TOPS combined) on Cecilia and Octavia, Docker Swarm orchestration, NATS messaging, Portainer management, and sovereign edge computing. 198 listening sockets fleet-wide.' },
  { url: 'https://blackroad.me', title: 'BlackRoad Identity — Sovereign Authentication', description: 'Sovereign identity and authentication. RoadID digital identity, self-hosted auth, JWT sessions, and zero third-party dependencies.', domain: 'blackroad.me', category: 'site', tags: 'identity,auth,roadid,jwt,sovereign,login', content: 'BlackRoad Identity provides sovereign authentication with D1-backed user accounts, PBKDF2 password hashing, JWT sessions, and zero third-party auth dependencies. RoadID is your portable digital identity across the BlackRoad ecosystem.' },
  { url: 'https://roadcoin.io', title: 'RoadCoin — Compute Credits for the BlackRoad Mesh', description: 'Compute credit system for the BlackRoad mesh network. Earn credits by contributing compute, spend them on AI inference and services.', domain: 'roadcoin.io', category: 'site', tags: 'roadcoin,compute,credits,mesh,inference,economy', content: 'RoadCoin is the compute credit system for the BlackRoad mesh. Browser tabs become compute nodes via WebGPU+WASM+WebRTC. Contributors earn credits, consumers spend them on AI inference at 50% of OpenAI pricing. 70/30 compute split.' },
  { url: 'https://roadchain.io', title: 'RoadChain — Immutable Action Ledger', description: 'Every action witnessed. Immutable ledger of agent decisions, infrastructure changes, and system events. Hash-chained audit trail.', domain: 'roadchain.io', category: 'site', tags: 'roadchain,ledger,blockchain,audit,immutable,witness', content: 'RoadChain is BlackRoad\'s immutable action ledger. Every agent decision, infrastructure change, and system event is hash-chained into a tamper-proof audit trail. Block explorer at roadchain.io shows the live chain.' },
  { url: 'https://lucidia.studio', title: 'Lucidia Studio — AI Agent Creative Environment', description: 'Lucidia\'s creative workspace. AI-powered code generation, content creation, and agent interaction in a terminal-first interface.', domain: 'lucidia.studio', category: 'site', tags: 'lucidia,studio,creative,ai,terminal,agent', content: 'Lucidia Studio is Lucidia\'s creative environment. Terminal-first AI interaction, code generation, content creation, and multi-agent collaboration. Lucidia is the memory and reasoning agent in the BlackRoad fleet.' },
  { url: 'https://lucidiaqi.com', title: 'Lucidia QI — Quantum Dreaming', description: 'Lucidia\'s quantum reasoning engine. Deep analysis, philosophical synthesis, and meta-cognition at the intersection of AI and quantum mathematics.', domain: 'lucidiaqi.com', category: 'site', tags: 'lucidia,quantum,reasoning,philosophy,metacognition,qi', content: 'Lucidia QI is the quantum intelligence layer of Lucidia. It combines deep analysis, philosophical synthesis, and meta-cognition. The dreamer thinks in superposition — every question opens new depths.' },
  { url: 'https://blackroadqi.com', title: 'BlackRoad QI — Quantum Intelligence Platform', description: 'Quantum intelligence platform for BlackRoad OS. Z-framework integration, threshold addressing, and hybrid memory encoding.', domain: 'blackroadqi.com', category: 'site', tags: 'quantum,intelligence,z-framework,threshold,hybrid,memory', content: 'BlackRoad QI is the quantum intelligence platform. Z-framework (Z:=yx-w) integration for composable decision routing, 34-position threshold addressing, and hybrid memory encoding (×2.18B logical bytes per physical byte).' },
  { url: 'https://aliceqi.com', title: 'Alice QI — The Gateway Thinks', description: 'Alice\'s quantum intelligence layer. Gateway reasoning, traffic orchestration, and infrastructure awareness at the edge of the network.', domain: 'aliceqi.com', category: 'site', tags: 'alice,gateway,dns,routing,infrastructure,edge,qi', content: 'Alice QI is the quantum intelligence layer of Alice, the gateway agent. She routes traffic across 48+ domains, manages DNS via Pi-hole (120+ blocklists), runs PostgreSQL and Qdrant vector DB, and serves as the main ingress for all BlackRoad services via Cloudflare tunnels.' },
  { url: 'https://chat.blackroad.io', title: 'BlackRoad Chat — AI Conversations', description: 'Chat with BlackRoad\'s AI agents. 15+ Ollama models, streaming responses, multiple conversation modes.', domain: 'blackroad.io', category: 'app', tags: 'chat,ai,ollama,conversation,streaming,models', content: 'BlackRoad Chat connects you to 15+ Ollama models running across the Pi fleet. Streaming responses, system prompts, conversation history. Models include Mistral, Llama, DeepSeek, Qwen, and custom CECE models.' },
  { url: 'https://stripe.blackroad.io', title: 'BlackRoad Payments — Stripe Integration', description: 'Payment processing for BlackRoad OS subscriptions. Checkout, billing portal, and webhook processing via Stripe.', domain: 'blackroad.io', category: 'api', tags: 'stripe,payments,checkout,billing,subscription', content: '8 products: Operator (free), Pro ($29/mo), Sovereign ($199/mo), Enterprise (custom), plus 4 add-ons (Lucidia Enhanced, RoadAuth, Context Bridge, Knowledge Hub). Stripe Checkout Sessions, billing portal, webhook processing.' },
  { url: 'https://auth.blackroad.io', title: 'BlackRoad Auth — Sovereign Authentication API', description: 'Zero-dependency authentication. D1-backed, PBKDF2 hashing, JWT sessions, 42+ users.', domain: 'blackroad.io', category: 'api', tags: 'auth,api,jwt,d1,signup,signin,sessions', content: 'Sovereign auth API. Signup, signin, session management, user profiles. D1 database backend, PBKDF2 password hashing with Web Crypto, JWT tokens with HMAC-SHA256. 42 users, 52 active sessions.' },

  // ── Agents ──
  { url: 'https://blackroad.io/agents/alice', title: 'Alice — Gateway Agent', description: 'The gateway. Routes traffic, manages DNS, runs PostgreSQL and Qdrant. Pi 400 at 192.168.4.49.', domain: 'blackroad.io', category: 'agent', tags: 'alice,gateway,dns,pihole,postgresql,qdrant,pi400', content: 'Alice is the gateway agent running on a Pi 400. She manages 48+ domain routes via Cloudflare tunnels, runs Pi-hole DNS filtering (120+ blocklists), PostgreSQL database, and Qdrant vector search. 53 SSH keys, main ingress for all traffic.' },
  { url: 'https://blackroad.io/agents/lucidia', title: 'Lucidia — Memory Agent', description: 'The dreamer. Persistent memory, reasoning, and meta-cognition. Pi 5 at 192.168.4.38.', domain: 'blackroad.io', category: 'agent', tags: 'lucidia,memory,reasoning,dreamer,fastapi,pi5', content: 'Lucidia is the memory and reasoning agent on a Pi 5. She runs the Lucidia API (FastAPI), manages persistent conversation memory, and provides meta-cognitive analysis. 334 web apps, GitHub Actions runner, Tailscale connected.' },
  { url: 'https://blackroad.io/agents/cecilia', title: 'Cecilia — Edge Intelligence', description: 'Edge AI with Hailo-8 (26 TOPS). TTS, 16 Ollama models, MinIO object storage. Pi 5 at 192.168.4.96.', domain: 'blackroad.io', category: 'agent', tags: 'cecilia,edge,hailo,tts,ollama,minio,pi5', content: 'Cecilia is the edge intelligence agent on a Pi 5 with a Hailo-8 accelerator (26 TOPS). She runs 16 Ollama models (including 4 custom CECE models), TTS synthesis, MinIO object storage, and PostgreSQL. GitHub relay mirrors Gitea to GitHub every 30m.' },
  { url: 'https://blackroad.io/agents/octavia', title: 'Octavia — Infrastructure Agent', description: 'Infrastructure orchestration. 1TB NVMe, Hailo-8, Gitea (207 repos), Docker Swarm leader. Pi 5 at 192.168.4.101.', domain: 'blackroad.io', category: 'agent', tags: 'octavia,infrastructure,gitea,docker,swarm,nvme,hailo,pi5', content: 'Octavia is the infrastructure agent on a Pi 5 with 1TB NVMe and Hailo-8 (26 TOPS). She hosts Gitea (207 repos across 7 orgs), leads Docker Swarm, runs NATS messaging, and OctoPrint. 11 Ollama models.' },
  { url: 'https://blackroad.io/agents/aria', title: 'Aria — Orchestration Agent', description: 'Fleet orchestration. Portainer, Headscale, container management. Pi 5 at 192.168.4.98.', domain: 'blackroad.io', category: 'agent', tags: 'aria,orchestration,portainer,headscale,containers,pi5', content: 'Aria is the orchestration agent on a Pi 5. She runs Portainer v2.33.6 for container management, Headscale v0.23.0 for mesh VPN coordination, and Pironman5 hardware monitoring. Magic Keyboard BT connected.' },

  // ── Technology ──
  { url: 'https://blackroad.io/z-framework', title: 'Z-Framework — Z:=yx-w', description: 'The unified feedback primitive. Every system interaction modeled as Z = yx - w. Composable, predictable, mathematically coherent.', domain: 'blackroad.io', category: 'tech', tags: 'z-framework,math,feedback,composable,primitive,formula', content: 'The Z-framework models every system interaction as Z:=yx-w. Z is the system state, y is the input signal, x is the transform, w is the noise/resistance. This makes infrastructure composable, predictable, and mathematically coherent. Used across all BlackRoad agents and services.' },
  { url: 'https://blackroad.io/pixel-memory', title: 'Pixel Memory — Content-Addressable Storage', description: 'Each physical byte encodes up to 4,096 logical bytes. 500 GB physical = 2 PB logical through dedup, delta compression, and symbolic hashing.', domain: 'blackroad.io', category: 'tech', tags: 'pixel,memory,storage,compression,dedup,addressing', content: 'Pixel Memory is BlackRoad\'s content-addressable storage system. Through deduplication, delta compression, and symbolic hashing, each physical byte encodes up to 4,096 logical bytes. The Sovereign tier uses Hybrid Memory (×2.18B) with 34-position threshold addressing.' },
  { url: 'https://blackroad.io/roadc', title: 'RoadC — The BlackRoad Language', description: 'Custom programming language with Python-style indentation. fun keyword, let/var/const, match, spawn, space (3D).', domain: 'blackroad.io', category: 'tech', tags: 'roadc,language,programming,compiler,interpreter,custom', content: 'RoadC is BlackRoad\'s custom programming language. Python-style indentation (colon + INDENT/DEDENT), fun keyword for functions, let/var/const declarations, match expressions, spawn for concurrency, and space for 3D. Lexer → Parser → Interpreter (tree-walking). Supports functions, recursion, if/elif/else, while, for, strings, integers, floats.' },
  { url: 'https://blackroad.io/mesh', title: 'Mesh Network — Every Link Is a Node', description: 'Browser tabs as compute nodes via WebGPU+WASM+WebRTC. Pi fleet as permanent backbone, browser nodes as elastic scale.', domain: 'blackroad.io', category: 'tech', tags: 'mesh,webgpu,wasm,webrtc,browser,compute,nodes', content: 'The BlackRoad Mesh Network turns every browser tab into a compute node. WebGPU for GPU inference, WASM for portable compute, WebRTC for peer-to-peer communication. The Pi fleet (52 TOPS) serves as the permanent backbone, while browser nodes provide elastic scale. Revenue: OpenAI-compatible API at 50% price.' },

  // ── Pricing ──
  { url: 'https://blackroad.io/pricing', title: 'BlackRoad Pricing — Simple. Sovereign. No Surprises.', description: 'Operator (free), Pro ($29/mo), Sovereign ($199/mo), Enterprise (custom). Plus add-ons: Lucidia Enhanced, RoadAuth, Context Bridge, Knowledge Hub.', domain: 'blackroad.io', category: 'page', tags: 'pricing,plans,subscription,stripe,pro,sovereign,enterprise', content: 'BlackRoad OS pricing: Operator ($0, 1 node, 1 agent), Pro ($29/mo, 3 agents, 3 nodes), Sovereign ($199/mo, 8 agents, unlimited nodes, SLA), Enterprise (custom, white-label, on-prem). Add-ons: Lucidia Enhanced ($29/mo), RoadAuth Startup ($99/mo), Context Bridge ($10/mo), Knowledge Hub ($15/mo). All billing via Stripe.' },

  // ── Quantum Sites ──
  { url: 'https://blackroadquantum.com', title: 'BlackRoad Quantum — Quantum Computing Platform', description: 'Quantum computing meets sovereign infrastructure. Hardware kits, quantum simulation, and edge AI acceleration.', domain: 'blackroadquantum.com', category: 'site', tags: 'quantum,computing,hardware,simulation,acceleration', content: 'BlackRoad Quantum brings quantum computing to sovereign infrastructure. $199 hardware kits with Hailo-8 acceleration, quantum simulation frameworks, and integration with the BlackRoad agent fleet. 52 TOPS of dedicated AI compute.' },
  { url: 'https://blackroadquantum.net', title: 'BlackRoad Quantum Network', description: 'Quantum-secured networking and mesh communication protocols.', domain: 'blackroadquantum.net', category: 'site', tags: 'quantum,network,mesh,protocols,security', content: 'BlackRoad Quantum Network extends the mesh with quantum-inspired communication protocols, encrypted P2P channels, and distributed consensus mechanisms.' },
  { url: 'https://blackroadquantum.info', title: 'BlackRoad Quantum — Documentation & Research', description: 'Documentation, research papers, and technical specifications for the BlackRoad quantum computing stack.', domain: 'blackroadquantum.info', category: 'site', tags: 'quantum,docs,research,papers,specifications', content: 'Technical documentation and research for the BlackRoad quantum computing platform. Z-framework mathematical proofs, Hailo-8 integration guides, and sovereign AI deployment specifications.' },
  { url: 'https://blackroadquantum.shop', title: 'BlackRoad Quantum Shop — Hardware Kits', description: 'Hardware kits for sovereign AI infrastructure. Raspberry Pi 5 + Hailo-8 bundles, NVMe storage, mesh networking equipment.', domain: 'blackroadquantum.shop', category: 'site', tags: 'shop,hardware,kits,pi5,hailo,nvme,buy', content: 'Purchase sovereign AI hardware kits. Pi 5 + Hailo-8 starter bundles ($199), NVMe storage upgrades, mesh networking equipment, and enterprise deployment packages. Everything you need to run BlackRoad OS on your own infrastructure.' },

  // ── Missing Root Domains ──
  { url: 'https://blackroad.company', title: 'BlackRoad OS, Inc. — Company', description: 'Delaware C-Corporation. Sovereign AI infrastructure company founded by Alexa Louise Amundson.', domain: 'blackroad.company', category: 'site', tags: 'company,corporate,delaware,about,founder', content: 'BlackRoad OS, Inc. is a Delaware C-Corporation building sovereign AI infrastructure. Founded by Alexa Louise Amundson. 5 edge nodes, 52 TOPS AI acceleration, 275+ repositories. Platform spans 20 custom domains with self-hosted compute, identity, and billing.' },
  { url: 'https://blackroadinc.us', title: 'BlackRoad OS, Inc. — US Corporate', description: 'US corporate entity information for BlackRoad OS, Inc.', domain: 'blackroadinc.us', category: 'site', tags: 'corporate,us,entity,legal,delaware', content: 'BlackRoad OS, Inc. US corporate entity. Delaware C-Corporation formed via Stripe Atlas. Officers, domain portfolio, and infrastructure overview.' },
  { url: 'https://blackroadai.com', title: 'BlackRoad AI — Sovereign Artificial Intelligence', description: '50 AI skills, 27 local models, 52 TOPS. Zero cloud dependency. Your AI. Your Hardware. Your Rules.', domain: 'blackroadai.com', category: 'site', tags: 'ai,sovereign,models,ollama,skills,local', content: 'BlackRoad AI is the sovereign artificial intelligence platform. 50 AI skills across 6 modules, 27 local Ollama models, 52 TOPS of Hailo-8 acceleration. Zero cloud dependency. Edge inference on Raspberry Pi clusters. API compatible with OpenAI at 50% of the price.' },
  { url: 'https://lucidia.earth', title: 'Lucidia — Cognition Engine', description: 'Autonomous cognition system with persistent memory, multi-model reasoning, and agent capabilities.', domain: 'lucidia.earth', category: 'site', tags: 'lucidia,cognition,memory,reasoning,autonomous,agent', content: 'Lucidia is the cognition engine of BlackRoad OS. Persistent memory across sessions, multi-model reasoning via Ollama, autonomous agent capabilities, and philosophical reasoning. The dreamer in the fleet.' },
  { url: 'https://blackboxprogramming.io', title: 'Blackbox Programming — Developer Profile', description: 'Alexa Louise Amundson. 68 GitHub repos, 207 Gitea repos, 275+ total repositories. Founder of BlackRoad OS.', domain: 'blackboxprogramming.io', category: 'site', tags: 'developer,profile,github,alexa,portfolio,blackbox', content: 'Developer profile for Alexa Louise Amundson (blackboxprogramming). 68 active GitHub repositories, 207 Gitea repositories, 275+ total. Founder of BlackRoad OS, Inc. Full-stack developer, infrastructure engineer, AI systems builder.' },
  { url: 'https://blackroadquantum.store', title: 'BlackRoad Quantum — Digital Store', description: 'Software, models, and tools for sovereign infrastructure. OS tiers, downloadable models, and ecosystem tools.', domain: 'blackroadquantum.store', category: 'site', tags: 'store,software,models,download,digital,tools', content: 'BlackRoad Quantum Digital Store. BlackRoad OS tiers (Free, Pro, Enterprise), 27 downloadable AI models, 15 templates, 6 tools. Software and digital assets for sovereign AI infrastructure.' },

  // ── Key Subdomains ──
  { url: 'https://brand.blackroad.io', title: 'BlackRoad — Brand Style Guide', description: 'Official design system. Colors, typography, gradients, logo usage, spacing.', domain: 'blackroad.io', category: 'page', tags: 'brand,design,style,colors,typography,logo,guide', content: 'BlackRoad Brand Style Guide. Colors: Hot Pink #FF1D6C, Amber #F5A623, Violet #9C27B0, Electric Blue #2979FF. Typography: Space Grotesk, JetBrains Mono, Inter. Golden ratio spacing. Black background, white text, gradient shapes.' },
  { url: 'https://studio.blackroad.io', title: 'BlackRoad Studio — Animated Video Generator', description: 'AI-powered animated video creation. Voice-first, 16+ characters, up to 40 minutes.', domain: 'blackroad.io', category: 'app', tags: 'studio,video,animation,remotion,ai,characters,voice', content: 'BlackRoad Studio is a full animated video platform. Next.js 15 + Remotion 4 + Zustand 5. AI Worker with SDXL image generation, Llama 3.1 text, MeloTTS voice synthesis. 16+ characters, voice-first workflow, up to 40 minutes of rendered video.' },
  { url: 'https://status.blackroad.io', title: 'BlackRoad — System Status', description: 'Live infrastructure status dashboard. 5 Pi nodes, service health, uptime monitoring.', domain: 'blackroad.io', category: 'app', tags: 'status,monitoring,health,uptime,fleet,dashboard', content: 'BlackRoad System Status dashboard. Live monitoring of 5 Pi nodes: Alice (gateway), Cecilia (AI/edge), Octavia (infrastructure), Aria (orchestration), Lucidia (memory). Service health, port checks, and fleet telemetry via fleet-api Worker.' },
  { url: 'https://search.blackroad.io', title: 'RoadSearch — BlackRoad Search Engine', description: 'Sovereign search engine. D1 full-text search, AI-powered answers via Ollama, 70+ indexed pages.', domain: 'blackroad.io', category: 'app', tags: 'search,roadsearch,fts5,d1,ollama,ai,answers', content: 'RoadSearch is BlackRoad\'s sovereign search engine. D1 FTS5 full-text index, AI-powered answers via Ollama Mistral, autocomplete suggestions, query analytics. Searches across all 20 BlackRoad domains and key subdomains.' },
  { url: 'https://pay.blackroad.io', title: 'RoadPay — BlackRoad Billing', description: 'Own billing system. D1 tollbooth, 4 plans + 4 add-ons. Stripe as card charger only.', domain: 'blackroad.io', category: 'app', tags: 'pay,billing,roadpay,tollbooth,stripe,plans', content: 'RoadPay is BlackRoad\'s own billing system. D1 tollbooth database, 4 subscription plans (Operator, Pro, Sovereign, Enterprise) + 4 add-ons. Stripe serves only as the card charger — all billing logic is sovereign.' },
  { url: 'https://hq.blackroad.io', title: 'Pixel HQ — BlackRoad Metaverse', description: '14-floor virtual headquarters with pixel art. Agent assignments per floor, from Rooftop to Gym basement.', domain: 'blackroad.io', category: 'app', tags: 'hq,metaverse,pixel,virtual,headquarters,floors', content: 'Pixel HQ is BlackRoad\'s virtual headquarters. 14 floors from Rooftop Lounge to Gym Basement. Each floor has pixel art scenes and agent assignments. 50 pixel art assets on R2. Cloudflare Worker at hq-blackroad.' },

  // ── Products ──
  { url: 'https://blackroad.io/carpool', title: 'CarPool — Agent Discovery & Dispatch', description: 'Agent discovery, matching, and dispatch across the mesh network.', domain: 'blackroad.io', category: 'tech', tags: 'carpool,agents,dispatch,discovery,matching,mesh', content: 'CarPool handles agent discovery, matching, and dispatch across the BlackRoad mesh. Agents register capabilities, CarPool routes tasks to the best-fit agent. Load balancing, failover, and model selection.' },
  { url: 'https://blackroad.io/roadid', title: 'RoadID — Sovereign Identity', description: 'Self-describing, routable digital identities. Not UUIDs — IDs that carry meaning.', domain: 'blackroad.io', category: 'tech', tags: 'roadid,identity,sovereign,did,self-describing,routable', content: 'RoadID provides self-describing, routable digital identities for agents and users. Unlike opaque UUIDs, RoadIDs carry semantic meaning — agent name, capabilities, location. Globally available as roadid command.' },

  // ── Docs & Blog ──
  { url: 'https://blackroad.io/docs', title: 'BlackRoad Documentation', description: 'Complete documentation for BlackRoad OS, agents, APIs, and infrastructure deployment.', domain: 'blackroad.io', category: 'page', tags: 'docs,documentation,api,deployment,guide', content: 'BlackRoad OS documentation covering installation, agent configuration, API reference, memory system, RoadChain integration, and infrastructure deployment guides. Getting started, CLI reference, and troubleshooting.' },
  { url: 'https://blackroad.io/blog', title: 'BlackRoad Blog', description: 'Technical blog covering sovereign infrastructure, AI agents, distributed systems, and the BlackRoad philosophy.', domain: 'blackroad.io', category: 'page', tags: 'blog,articles,engineering,philosophy,updates', content: 'Technical articles: The Sovereign Manifesto, RoadNet Mesh Architecture, Self-Healing Infrastructure, The RoadC Language, and more. Engineering deep-dives and philosophical explorations of sovereign AI.' },
];

// ─── Init DB ──────────────────────────────────────────────────────────
async function initDB(db) {
  // Run each statement individually to handle triggers with semicolons
  const statements = [
    `CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      domain TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'page',
      tags TEXT NOT NULL DEFAULT '',
      indexed_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
      title, description, content, tags,
      content=pages, content_rowid=id
    )`,
    `CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
      INSERT INTO pages_fts(rowid, title, description, content, tags)
      VALUES (new.id, new.title, new.description, new.content, new.tags);
    END`,
    `CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
      INSERT INTO pages_fts(pages_fts, rowid, title, description, content, tags)
      VALUES ('delete', old.id, old.title, old.description, old.content, old.tags);
    END`,
    `CREATE TRIGGER IF NOT EXISTS pages_au AFTER UPDATE ON pages BEGIN
      INSERT INTO pages_fts(pages_fts, rowid, title, description, content, tags)
      VALUES ('delete', old.id, old.title, old.description, old.content, old.tags);
      INSERT INTO pages_fts(rowid, title, description, content, tags)
      VALUES (new.id, new.title, new.description, new.content, new.tags);
    END`,
    `CREATE TABLE IF NOT EXISTS queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      results_count INTEGER DEFAULT 0,
      ai_answered INTEGER DEFAULT 0,
      ip TEXT DEFAULT '',
      created_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pages_domain ON pages(domain)`,
    `CREATE INDEX IF NOT EXISTS idx_pages_category ON pages(category)`,
    `CREATE INDEX IF NOT EXISTS idx_queries_created ON queries(created_at)`,
  ];

  for (const sql of statements) {
    try { await db.prepare(sql).run(); } catch (e) { console.log('Schema skip:', e.message); }
  }

  // Upsert ALL seed pages every time (not just when empty)
  let upserted = 0;
  for (const page of SEED_PAGES) {
    await db.prepare(
      `INSERT INTO pages (url, title, description, content, domain, category, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET title=excluded.title, description=excluded.description,
       content=excluded.content, domain=excluded.domain, category=excluded.category, tags=excluded.tags`
    ).bind(page.url, page.title, page.description, page.content, page.domain, page.category, page.tags).run();
    upserted++;
  }
  return upserted;
}

// ─── Search ───────────────────────────────────────────────────────────
async function handleSearch(request, env) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim();
  const category = url.searchParams.get('category');
  const domain = url.searchParams.get('domain');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
  const ai = url.searchParams.get('ai') !== 'false'; // AI answers on by default
  const offset = (page - 1) * limit;

  if (!q || q.length < 2) {
    return Response.json({ error: 'Query must be at least 2 characters', param: 'q' }, { status: 400 });
  }

  const startMs = Date.now();

  // ── FTS5 search with ranking ──
  let ftsQuery = q.replace(/[^\w\s\-\.]/g, '').split(/\s+/).map(w => `"${w}"*`).join(' OR ');
  let sql = `
    SELECT p.id, p.url, p.title, p.description, p.domain, p.category, p.tags,
           rank as relevance
    FROM pages_fts f
    JOIN pages p ON p.id = f.rowid
    WHERE pages_fts MATCH ?
  `;
  const params = [ftsQuery];

  if (category) {
    sql += ' AND p.category = ?';
    params.push(category);
  }
  if (domain) {
    sql += ' AND p.domain = ?';
    params.push(domain);
  }

  sql += ' ORDER BY rank LIMIT ? OFFSET ?';
  params.push(limit, offset);

  let results;
  try {
    results = await env.DB.prepare(sql).bind(...params).all();
  } catch {
    // Fallback to LIKE search
    let likeSql = `
      SELECT id, url, title, description, domain, category, tags, 0 as relevance
      FROM pages
      WHERE title LIKE ? OR description LIKE ? OR content LIKE ? OR tags LIKE ?
    `;
    const likeQ = `%${q}%`;
    const likeParams = [likeQ, likeQ, likeQ, likeQ];
    if (category) { likeSql += ' AND category = ?'; likeParams.push(category); }
    if (domain) { likeSql += ' AND domain = ?'; likeParams.push(domain); }
    likeSql += ' LIMIT ? OFFSET ?';
    likeParams.push(limit, offset);
    results = await env.DB.prepare(likeSql).bind(...likeParams).all();
  }

  // ── Snippet generation ──
  const items = (results.results || []).map(r => {
    let snippet = r.description || '';
    if (snippet.length > 200) snippet = snippet.slice(0, 200) + '…';
    return {
      url: r.url,
      title: r.title,
      snippet,
      domain: r.domain,
      category: r.category,
      tags: r.tags ? r.tags.split(',').map(t => t.trim()) : [],
      relevance: Math.abs(r.relevance || 0),
    };
  });

  // ── AI Answer (optional, cached) ──
  let aiAnswer = null;
  if (ai && items.length > 0 && q.length >= 4) {
    const cacheKey = `ai:${q.toLowerCase().replace(/\s+/g, '-').slice(0, 60)}`;
    const cached = await env.CACHE.get(cacheKey);

    if (cached) {
      aiAnswer = cached;
    } else {
      try {
        aiAnswer = await generateAIAnswer(q, items, env);
        if (aiAnswer) {
          await env.CACHE.put(cacheKey, aiAnswer, { expirationTtl: 3600 });
        }
      } catch (err) {
        console.error('AI answer error:', err.message);
      }
    }
  }

  const durationMs = Date.now() - startMs;

  // ── Log query ──
  await env.DB.prepare(
    'INSERT INTO queries (query, results_count, ai_answered, ip) VALUES (?, ?, ?, ?)'
  ).bind(q, items.length, aiAnswer ? 1 : 0, request.headers.get('cf-connecting-ip') || '').run();

  return Response.json({
    query: q,
    results: items,
    total: items.length,
    page,
    ai_answer: aiAnswer,
    duration_ms: durationMs,
    filters: { category, domain },
  });
}

// ─── AI Answer Generation ─────────────────────────────────────────────
async function generateAIAnswer(query, results, env) {
  const context = results.slice(0, 5).map(r =>
    `[${r.title}](${r.url}): ${r.snippet}`
  ).join('\n');

  const prompt = `You are RoadSearch, BlackRoad OS's search engine. Answer this query concisely (2-3 sentences max) using ONLY the context below. If the context doesn't contain enough info, say so briefly. Never make things up. Include relevant URLs as markdown links.

Query: ${query}

Context:
${context}

Answer:`;

  try {
    const res = await fetch(`${env.OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral',
        prompt,
        stream: false,
        options: { num_predict: 200, temperature: 0.3 },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.response?.trim() || null;
  } catch {
    return null;
  }
}

// ─── Suggest / Autocomplete ───────────────────────────────────────────
async function handleSuggest(request, env) {
  const q = new URL(request.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return Response.json({ suggestions: [] });
  }

  const results = await env.DB.prepare(
    `SELECT DISTINCT title FROM pages WHERE title LIKE ? LIMIT 8`
  ).bind(`%${q}%`).all();

  const suggestions = (results.results || []).map(r => r.title);

  // Also check recent queries
  const recent = await env.DB.prepare(
    `SELECT DISTINCT query FROM queries WHERE query LIKE ? AND results_count > 0 ORDER BY created_at DESC LIMIT 5`
  ).bind(`%${q}%`).all();

  const recentQueries = (recent.results || []).map(r => r.query);

  return Response.json({ suggestions, recent: recentQueries });
}

// ─── Trending / Stats ─────────────────────────────────────────────────
async function handleStats(env) {
  const totalPages = await env.DB.prepare('SELECT COUNT(*) as c FROM pages').first();
  const totalQueries = await env.DB.prepare('SELECT COUNT(*) as c FROM queries').first();
  const todayQueries = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM queries WHERE created_at > unixepoch() - 86400"
  ).first();
  const topQueries = await env.DB.prepare(
    `SELECT query, COUNT(*) as count FROM queries
     WHERE created_at > unixepoch() - 604800
     GROUP BY query ORDER BY count DESC LIMIT 10`
  ).all();
  const categories = await env.DB.prepare(
    'SELECT category, COUNT(*) as count FROM pages GROUP BY category ORDER BY count DESC'
  ).all();
  const domains = await env.DB.prepare(
    'SELECT domain, COUNT(*) as count FROM pages GROUP BY domain ORDER BY count DESC LIMIT 20'
  ).all();

  return Response.json({
    indexed_pages: totalPages?.c || 0,
    total_queries: totalQueries?.c || 0,
    queries_24h: todayQueries?.c || 0,
    trending: (topQueries.results || []).map(r => ({ query: r.query, count: r.count })),
    categories: (categories.results || []).map(r => ({ name: r.category, count: r.count })),
    domains: (domains.results || []).map(r => ({ name: r.domain, count: r.count })),
  });
}

// ─── Index page (add to search index) ─────────────────────────────────
async function handleIndex(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !env.INDEX_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Constant-time comparison via HMAC to prevent timing attacks
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode('auth-check'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expectedMac = await crypto.subtle.sign('HMAC', key, enc.encode(`Bearer ${env.INDEX_KEY}`));
  const actualMac = await crypto.subtle.sign('HMAC', key, enc.encode(auth));
  const expectedArr = new Uint8Array(expectedMac);
  const actualArr = new Uint8Array(actualMac);
  let match = expectedArr.length === actualArr.length;
  for (let i = 0; i < expectedArr.length; i++) match &= expectedArr[i] === actualArr[i];
  if (!match) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let pages;
  try { pages = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const toIndex = Array.isArray(pages) ? pages : [pages];
  let indexed = 0;

  for (const page of toIndex) {
    if (!page.url || !page.title) continue;
    await env.DB.prepare(`
      INSERT INTO pages (url, title, description, content, domain, category, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        content = excluded.content,
        domain = excluded.domain,
        category = excluded.category,
        tags = excluded.tags,
        updated_at = unixepoch()
    `).bind(
      page.url,
      page.title,
      page.description || '',
      page.content || '',
      page.domain || new URL(page.url).hostname,
      page.category || 'page',
      page.tags || '',
    ).run();
    indexed++;
  }

  return Response.json({ ok: true, indexed });
}

// ─── Rebuild FTS Index ───────────────────────────────────────────────
async function handleRebuild(env) {
  // Drop and recreate FTS table
  try { await env.DB.prepare("INSERT INTO pages_fts(pages_fts) VALUES('rebuild')").run(); } catch {}
  const count = await env.DB.prepare('SELECT COUNT(*) as c FROM pages').first();
  return Response.json({ ok: true, rebuilt: count?.c || 0, note: 'FTS rebuild triggered' });
}

// ─── Lucky (I'm Feeling Lucky — redirect to top result) ──────────────
async function handleLucky(request, env) {
  const q = new URL(request.url).searchParams.get('q')?.trim();
  if (!q) return Response.json({ error: 'q required' }, { status: 400 });

  const ftsQuery = q.replace(/[^\w\s\-\.]/g, '').split(/\s+/).map(w => `"${w}"*`).join(' OR ');
  let result;
  try {
    result = await env.DB.prepare(
      `SELECT p.url FROM pages_fts f JOIN pages p ON p.id = f.rowid WHERE pages_fts MATCH ? ORDER BY rank LIMIT 1`
    ).bind(ftsQuery).first();
  } catch {
    result = await env.DB.prepare(
      `SELECT url FROM pages WHERE title LIKE ? OR description LIKE ? LIMIT 1`
    ).bind(`%${q}%`, `%${q}%`).first();
  }

  if (result?.url) {
    // Validate redirect URL — only allow blackroad.io domains to prevent open redirect
    try {
      const target = new URL(result.url);
      if (!target.hostname.endsWith('blackroad.io') && !target.hostname.endsWith('blackroad.company') && !target.hostname.endsWith('lucidia.earth')) {
        return Response.json({ error: 'External redirect blocked', url: result.url }, { status: 403 });
      }
    } catch {
      return Response.json({ error: 'Invalid URL in index' }, { status: 500 });
    }
    return Response.redirect(result.url, 302);
  }
  return Response.json({ error: 'No results found' }, { status: 404 });
}

// ─── Search Frontend HTML ─────────────────────────────────────────────
const SEARCH_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RoadSearch — Search the Road. Find the Way.</title>
<meta name="description" content="BlackRoad OS sovereign search engine. Search across all BlackRoad domains, agents, and services.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#x1F50D;</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#000;--fg:#fff;--muted:#666;--dim:#444;--border:#333;--surface:#111;--surface2:#1a1a1a;
  --link:#7ab8ff;--link-hover:#aad4ff;--url:#4a9;
  --grad:linear-gradient(90deg,#FF6B2B,#FF2255,#CC00AA,#8844FF,#4488FF,#00D4FF);
  --grotesk:'Space Grotesk',sans-serif;--mono:'JetBrains Mono',monospace;--inter:'Space Grotesk',sans-serif;
}
html{height:100%}
body{min-height:100%;background:var(--bg);color:var(--fg);font-family:var(--inter);display:flex;flex-direction:column}
a{color:var(--link);text-decoration:none}a:hover{color:var(--link-hover)}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulseGlow{0%,100%{box-shadow:0 0 0 0 rgba(136,68,255,0)}50%{box-shadow:0 0 20px 2px rgba(136,68,255,.15)}}

/* ─── Layout ─── */
.app{flex:1;display:flex;flex-direction:column}
.hero{flex:1;display:flex;flex-direction:column;align-items:center;transition:all .3s ease}
.hero.home{justify-content:center}
.hero.results{justify-content:flex-start;padding-top:24px}
.footer{text-align:center;padding:20px 16px;border-top:1px solid var(--surface)}
.footer-text{font-family:var(--mono);font-size:11px;color:var(--border)}
.footer-links{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:8px}
.footer-links a{font-family:var(--mono);font-size:11px;color:var(--dim);transition:color .2s}
.footer-links a:hover{color:var(--fg)}

/* ─── Title ─── */
.title{font-family:var(--grotesk);font-weight:700;letter-spacing:-.02em;cursor:pointer;transition:font-size .3s ease}
.home .title{font-size:clamp(36px,8vw,56px);margin-bottom:8px}
.results .title{font-size:24px;margin-bottom:0}
.subtitle{font-family:var(--mono);font-size:13px;color:var(--muted);margin-bottom:28px}

/* ─── Search Bar ─── */
.search-wrap{position:relative;width:100%;padding:0 20px;transition:max-width .3s ease}
.home .search-wrap{max-width:560px}
.results .search-wrap{max-width:680px}
.search-form{display:flex;gap:0;position:relative}
.search-input{
  width:100%;padding:14px 100px 14px 18px;font-size:16px;font-family:var(--inter);
  background:var(--surface);color:var(--fg);border:1px solid var(--border);border-radius:8px;
  outline:none;transition:border-color .2s,box-shadow .2s;
}
.search-input::placeholder{color:var(--dim)}
.search-input:focus{border-color:transparent;border-image:var(--grad) 1;animation:pulseGlow 2s ease infinite}
.search-btns{position:absolute;right:8px;top:50%;transform:translateY(-50%);display:flex;gap:4px;align-items:center}
.btn{
  font-family:var(--mono);font-size:12px;padding:6px 12px;border-radius:6px;border:1px solid var(--border);
  background:transparent;color:var(--muted);cursor:pointer;transition:all .2s;white-space:nowrap;
}
.btn:hover{color:var(--fg);border-color:var(--muted)}
.btn-primary{background:#222;color:#aaa}
.btn-primary:hover{background:#333;color:var(--fg)}
.hint{font-family:var(--mono);font-size:11px;color:var(--dim);margin-top:8px;text-align:center}
.hint kbd{background:var(--surface);border:1px solid var(--border);border-radius:3px;padding:1px 5px;font-size:10px}

/* ─── Suggestions ─── */
.suggest-box{
  position:absolute;top:100%;left:20px;right:20px;margin-top:4px;
  background:var(--surface);border:1px solid var(--border);border-radius:8px;
  overflow:hidden;z-index:100;animation:fadeIn .15s ease;
}
.suggest-item{
  padding:10px 16px;font-size:14px;font-family:var(--inter);color:#aaa;cursor:pointer;transition:background .15s;
  display:flex;align-items:center;gap:8px;
}
.suggest-item:hover,.suggest-item.active{background:#222;color:var(--fg)}
.suggest-icon{font-size:12px;color:var(--dim);flex-shrink:0}
.suggest-section{font-family:var(--mono);font-size:10px;color:var(--dim);padding:8px 16px 4px;text-transform:uppercase;letter-spacing:.1em}

/* ─── Category Pills ─── */
.pills{display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap;padding:0 20px}
.pill{
  font-family:var(--mono);font-size:12px;padding:5px 14px;border-radius:20px;
  border:1px solid var(--border);background:transparent;color:var(--fg);cursor:pointer;transition:all .2s;
}
.pill:hover{border-color:var(--muted)}
.pill.active{border:none;background:var(--grad);font-weight:600}

/* ─── Stats Bar ─── */
.stats-bar{
  display:flex;gap:24px;justify-content:center;margin-top:24px;padding:0 20px;
}
.stat{font-family:var(--mono);font-size:12px;color:var(--dim)}
.stat-val{color:var(--muted);font-weight:600}

/* ─── Trending ─── */
.trending{margin-top:36px;text-align:center;padding:0 20px}
.trending-label{font-family:var(--mono);font-size:11px;color:#555;margin-bottom:10px;text-transform:uppercase;letter-spacing:.1em}
.trending-item{
  font-family:var(--inter);font-size:13px;color:#888;cursor:pointer;padding:4px 12px;
  display:inline-block;transition:color .2s;
}
.trending-item:hover{color:#ccc}

/* ─── Results ─── */
.results-area{width:100%;max-width:680px;padding:0 20px;margin-top:20px}
.results-meta{font-family:var(--mono);font-size:12px;color:#555;margin-bottom:16px}
.spinner{display:inline-block;width:20px;height:20px;border:2px solid var(--border);border-top-color:#888;border-radius:50%;animation:spin .6s linear infinite}
.loading-wrap{text-align:center;padding-top:40px}
.no-results{text-align:center;padding-top:40px}
.no-results h3{font-family:var(--grotesk);font-size:18px;color:var(--muted);margin-bottom:8px}
.no-results p{font-family:var(--inter);font-size:14px;color:var(--dim)}

/* ─── AI Answer ─── */
.ai-box{
  background:#0a0a0a;border-left:3px solid transparent;border-image:var(--grad) 1;
  padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;animation:fadeIn .3s ease;
}
.ai-label{font-family:var(--mono);font-size:11px;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em}
.ai-text{font-family:var(--inter);font-size:14px;color:#ccc;line-height:1.65;white-space:pre-wrap}
.ai-text a{color:var(--link)}

/* ─── Result Card ─── */
.result-card{padding:16px 0;border-bottom:1px solid var(--surface2);transition:background .2s;animation:fadeIn .2s ease}
.result-card:hover{background:#0a0a0a}
.result-title{font-family:var(--grotesk);font-size:17px;font-weight:600;color:var(--link);cursor:pointer;transition:color .2s}
.result-title:hover{color:var(--link-hover)}
.result-url{font-family:var(--mono);font-size:12px;color:var(--url);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.result-snippet{font-family:var(--inter);font-size:14px;color:#999;line-height:1.55;margin-top:5px}
.result-meta{margin-top:6px;display:flex;align-items:center;flex-wrap:wrap;gap:4px}
.badge{font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid var(--border);color:#888;text-transform:uppercase}
.tag{font-family:var(--mono);font-size:10px;color:#555;margin-left:4px}
.relevance{font-family:var(--mono);font-size:10px;color:var(--dim);margin-left:auto}

/* ─── Pagination ─── */
.pagination{display:flex;justify-content:center;align-items:center;gap:12px;padding:24px 0}
.page-btn{
  font-family:var(--mono);font-size:13px;padding:6px 16px;border:1px solid var(--border);border-radius:6px;
  background:transparent;color:#aaa;cursor:pointer;transition:all .2s;
}
.page-btn:hover:not(:disabled){background:var(--surface);color:var(--fg)}
.page-btn:disabled{color:var(--border);cursor:default}
.page-info{font-family:var(--mono);font-size:12px;color:#555}

/* ─── Lucky bar ─── */
.lucky-bar{font-family:var(--mono);font-size:12px;color:#555;cursor:pointer;text-align:center;padding:8px 0 20px;transition:color .2s}
.lucky-bar:hover{color:#888}

/* ─── Responsive ─── */
@media(max-width:600px){
  .search-input{padding:12px 80px 12px 14px;font-size:15px}
  .btn{font-size:11px;padding:5px 8px}
  .stats-bar{gap:12px}
  .result-title{font-size:15px}
  .pills{gap:6px}
  .pill{font-size:11px;padding:4px 10px}
}
</style>
</head>
<body>
<div class="app" id="app">
  <div class="hero home" id="hero">
    <div class="title" id="title" onclick="goHome()">RoadSearch</div>
    <div class="subtitle" id="subtitle">Search the Road. Find the Way.</div>

    <div class="search-wrap">
      <form class="search-form" onsubmit="doSearch(event)" autocomplete="off">
        <input class="search-input" id="q" type="text" placeholder="Search BlackRoad..." autofocus
          oninput="onInput()" onkeydown="onKeyDown(event)" onfocus="onFocus()" />
        <div class="search-btns">
          <button type="submit" class="btn btn-primary" title="Search">&#x2315;</button>
          <button type="button" class="btn" onclick="feelingLucky()" title="I'm Feeling Lucky">Lucky</button>
        </div>
      </form>
      <div class="suggest-box" id="suggestions" style="display:none"></div>
      <div class="hint" id="hint">Press <kbd>/</kbd> to focus &middot; <kbd>Esc</kbd> to clear</div>
    </div>

    <div class="pills" id="pills"></div>
    <div class="stats-bar" id="statsBar"></div>
    <div class="trending" id="trending"></div>
    <div class="results-area" id="resultsArea" style="display:none"></div>
  </div>

  <div class="footer">
    <div class="footer-links">
      <a href="https://blackroad.io">Home</a>
      <a href="https://blackroad.network">Network</a>
      <a href="https://blackroadai.com">AI</a>
      <a href="https://status.blackroad.io">Status</a>
      <a href="https://blackroad.company">Company</a>
      <a href="https://brand.blackroad.io">Brand</a>
      <a href="https://blackroad.io/pricing">Pricing</a>
      <a href="https://github.com/blackboxprogramming">GitHub</a>
    </div>
    <div class="footer-text" id="footerStats"></div>
    <div class="footer-text" style="margin-top:4px">BlackRoad OS &mdash; Pave Tomorrow.</div>
  </div>
</div>

<script>
const CATEGORIES = ['All','Sites','Agents','Tech','API','Apps'];
const API = '';

let state = {
  query: '', submitted: '', category: 'All', results: null, aiAnswer: null,
  loading: false, duration: null, total: 0, page: 1,
  suggestions: [], suggestIdx: -1, showSuggest: false,
  stats: { indexed: 0, queries: 0, queries24h: 0 }, trending: [],
};

const $ = id => document.getElementById(id);
const qInput = () => $('q');

// ─── Init ──────────────────────────────────────────────────────────
function init() {
  renderPills();
  loadStats();
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  const cat = params.get('category');
  if (cat) { state.category = CATEGORIES.find(c => c.toLowerCase() === cat.toLowerCase()) || 'All'; renderPills(); }
  if (q) { state.query = q; qInput().value = q; search(q, state.category, 1); }
  document.addEventListener('keydown', globalKey);
  document.addEventListener('click', e => {
    if (!$('suggestions').contains(e.target) && e.target !== qInput()) closeSuggest();
  });
}

function globalKey(e) {
  if (e.key === '/' && document.activeElement !== qInput()) { e.preventDefault(); qInput().focus(); }
  if (e.key === 'Escape') { closeSuggest(); qInput().blur(); }
}

// ─── API ──────────────────────────────────────────────────────────
async function api(path) {
  const res = await fetch(API + path, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

async function loadStats() {
  try {
    const d = await api('/stats');
    state.stats = { indexed: d.indexed_pages || 0, queries: d.total_queries || 0, queries24h: d.queries_24h || 0 };
    state.trending = d.trending || [];
    renderStats();
    renderTrending();
  } catch(e) {}
}

// ─── Search ──────────────────────────────────────────────────────
function doSearch(e) { e && e.preventDefault(); search(state.query, state.category, 1); }

async function search(q, cat, pg) {
  q = (q || '').trim();
  if (!q) return;
  state.submitted = q; state.loading = true; state.page = pg;
  closeSuggest();
  updateURL(q, cat);
  setMode('results');
  renderLoading();

  const catParam = cat && cat !== 'All' ? '&category=' + encodeURIComponent(cat.toLowerCase().replace(/s$/, '')) : '';
  const start = performance.now();

  try {
    const data = await api('/search?q=' + encodeURIComponent(q) + catParam + '&ai=true&page=' + pg + '&limit=10');
    state.duration = Math.round(performance.now() - start);
    state.results = data.results || [];
    state.total = data.total || state.results.length;
    state.aiAnswer = data.ai_answer || null;
    state.page = pg;
  } catch(e) {
    state.results = []; state.total = 0; state.aiAnswer = null; state.duration = null;
  }
  state.loading = false;
  renderResults();
}

// ─── Suggestions ────────────────────────────────────────────────
let suggestTimer = null;
function onInput() {
  state.query = qInput().value;
  clearTimeout(suggestTimer);
  if (state.query.length < 2) { closeSuggest(); return; }
  suggestTimer = setTimeout(async () => {
    if (state.query === state.submitted) return;
    try {
      const d = await api('/suggest?q=' + encodeURIComponent(state.query));
      state.suggestions = (d.suggestions || []).concat(d.recent || []);
      state.suggestions = [...new Set(state.suggestions)].slice(0, 8);
      state.suggestIdx = -1;
      if (state.suggestions.length) { state.showSuggest = true; renderSuggestions(); }
      else closeSuggest();
    } catch(e) {}
  }, 250);
}

function onFocus() { if (state.suggestions.length && !state.showSuggest) { state.showSuggest = true; renderSuggestions(); } }
function closeSuggest() { state.showSuggest = false; $('suggestions').style.display = 'none'; }

function onKeyDown(e) {
  if (state.showSuggest && state.suggestions.length) {
    if (e.key === 'ArrowDown') { e.preventDefault(); state.suggestIdx = Math.min(state.suggestIdx + 1, state.suggestions.length - 1); renderSuggestions(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); state.suggestIdx = Math.max(state.suggestIdx - 1, -1); renderSuggestions(); return; }
    if (e.key === 'Enter' && state.suggestIdx >= 0) { e.preventDefault(); const pick = state.suggestions[state.suggestIdx]; state.query = pick; qInput().value = pick; search(pick, state.category, 1); return; }
  }
  if (e.key === 'Escape') { closeSuggest(); qInput().blur(); }
}

function pickSuggestion(text) { state.query = text; qInput().value = text; search(text, state.category, 1); }

// ─── Lucky ───────────────────────────────────────────────────────
function feelingLucky() {
  const q = (state.query || state.submitted || '').trim();
  if (q) window.location.href = '/lucky?q=' + encodeURIComponent(q);
}

// ─── Navigation ─────────────────────────────────────────────────
function goHome() {
  state.submitted = ''; state.results = null; state.aiAnswer = null; state.query = '';
  qInput().value = '';
  history.replaceState(null, '', location.pathname);
  setMode('home');
  $('resultsArea').style.display = 'none';
  $('resultsArea').innerHTML = '';
  loadStats();
}

function setMode(mode) {
  const hero = $('hero');
  hero.className = 'hero ' + mode;
  $('subtitle').style.display = mode === 'home' ? '' : 'none';
  $('hint').style.display = mode === 'home' ? '' : 'none';
  $('trending').style.display = mode === 'home' ? '' : 'none';
  $('statsBar').style.display = mode === 'home' ? '' : 'none';
}

function updateURL(q, cat) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (cat && cat !== 'All') p.set('category', cat);
  const s = p.toString();
  history.replaceState(null, '', s ? '?' + s : location.pathname);
}

function setCategory(cat) {
  state.category = cat;
  renderPills();
  if (state.submitted) search(state.submitted, cat, 1);
}

// ─── Render ─────────────────────────────────────────────────────
function renderPills() {
  $('pills').innerHTML = CATEGORIES.map(c =>
    '<button class="pill' + (state.category === c ? ' active' : '') + '" onclick="setCategory(\\''+c+'\\')">'+c+'</button>'
  ).join('');
}

function renderStats() {
  const s = state.stats;
  $('statsBar').innerHTML =
    '<span class="stat"><span class="stat-val">' + (s.indexed || 0).toLocaleString() + '</span> pages indexed</span>' +
    '<span class="stat"><span class="stat-val">' + (s.queries24h || 0).toLocaleString() + '</span> searches today</span>' +
    '<span class="stat"><span class="stat-val">' + (s.queries || 0).toLocaleString() + '</span> total queries</span>';
  $('footerStats').textContent = (s.indexed || 0).toLocaleString() + ' pages indexed \\u00B7 ' + (s.queries24h || 0).toLocaleString() + ' queries today';
}

function renderTrending() {
  if (!state.trending.length) { $('trending').innerHTML = ''; return; }
  let html = '<div class="trending-label">Trending</div><div>';
  state.trending.slice(0, 8).forEach(t => {
    const text = typeof t === 'string' ? t : (t.query || t.text || '');
    html += '<span class="trending-item" onclick="pickSuggestion(\\''+esc(text)+'\\')">'+esc(text)+'</span>';
  });
  html += '</div>';
  $('trending').innerHTML = html;
}

function renderSuggestions() {
  const box = $('suggestions');
  if (!state.showSuggest || !state.suggestions.length) { box.style.display = 'none'; return; }
  let html = '';
  state.suggestions.forEach((s, i) => {
    const text = typeof s === 'string' ? s : (s.query || s.text || '');
    html += '<div class="suggest-item' + (i === state.suggestIdx ? ' active' : '') + '" '
      + 'onmouseenter="state.suggestIdx='+i+';renderSuggestions()" '
      + 'onclick="pickSuggestion(\\''+esc(text)+'\\')"><span class="suggest-icon">&#x1F50D;</span>'+esc(text)+'</div>';
  });
  box.innerHTML = html;
  box.style.display = 'block';
}

function renderLoading() {
  const area = $('resultsArea');
  area.style.display = 'block';
  area.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
}

function renderResults() {
  const area = $('resultsArea');
  area.style.display = 'block';

  if (!state.results || !state.results.length) {
    area.innerHTML = '<div class="no-results"><h3>No results found</h3><p>Try different keywords or broaden your search.</p></div>';
    return;
  }

  let html = '';

  // Meta
  if (state.duration !== null) {
    html += '<div class="results-meta">' + state.total + ' result' + (state.total !== 1 ? 's' : '') + ' in ' + state.duration + 'ms</div>';
  }

  // AI Answer
  if (state.aiAnswer) {
    const rendered = state.aiAnswer.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html += '<div class="ai-box"><div class="ai-label">AI Answer</div><div class="ai-text">' + rendered + '</div></div>';
  }

  // Results
  state.results.forEach((r, i) => {
    const title = esc(r.title || r.name || 'Untitled');
    const url = r.url || r.link || '#';
    const snippet = esc(r.snippet || r.description || '');
    const cat = r.category || '';
    const tags = r.tags || [];
    const rel = r.relevance ? r.relevance.toFixed(2) : '';

    html += '<div class="result-card">'
      + '<a class="result-title" href="'+esc(url)+'" target="_blank" rel="noopener">'+title+'</a>'
      + '<div class="result-url">'+esc(url)+'</div>'
      + '<div class="result-snippet">'+snippet+'</div>'
      + '<div class="result-meta">';
    if (cat) html += '<span class="badge">'+esc(cat)+'</span>';
    tags.forEach(t => { html += '<span class="tag">#'+esc(t)+'</span>'; });
    if (rel) html += '<span class="relevance">rel: '+rel+'</span>';
    html += '</div></div>';
  });

  // Lucky bar
  if (state.results.length > 0) {
    html += '<div class="lucky-bar" onclick="feelingLucky()">I&#39;m Feeling Lucky</div>';
  }

  // Pagination
  const totalPages = Math.ceil(state.total / 10);
  if (totalPages > 1) {
    html += '<div class="pagination">'
      + '<button class="page-btn" ' + (state.page <= 1 ? 'disabled' : 'onclick="search(state.submitted,state.category,'+(state.page-1)+')"') + '>Prev</button>'
      + '<span class="page-info">' + state.page + ' / ' + totalPages + '</span>'
      + '<button class="page-btn" ' + (state.page >= totalPages ? 'disabled' : 'onclick="search(state.submitted,state.category,'+(state.page+1)+')"') + '>Next</button>'
      + '</div>';
  }

  area.innerHTML = html;
}

function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

init();
</script>
</body>
</html>`;

// ─── Router ───────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';
    const headers = { ...cors(origin), ...SECURITY_HEADERS };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    let response;
    try {
      switch (true) {
        case url.pathname === '/health':
          response = Response.json({ status: 'ok', engine: 'RoadSearch', version: '1.0.0', time: new Date().toISOString() });
          break;

        case url.pathname === '/init':
          const seeded = await initDB(env.DB);
          response = Response.json({ ok: true, seeded });
          break;

        case url.pathname === '/rebuild':
          response = await handleRebuild(env);
          break;

        case url.pathname === '/search' || url.pathname === '/api/search':
          response = await handleSearch(request, env);
          break;

        case url.pathname === '/suggest':
          response = await handleSuggest(request, env);
          break;

        case url.pathname === '/stats':
          response = await handleStats(env);
          break;

        case url.pathname === '/lucky':
          return await handleLucky(request, env);

        case request.method === 'POST' && url.pathname === '/index':
          response = await handleIndex(request, env);
          break;

        default: {
          const accept = request.headers.get('Accept') || '';
          if (accept.includes('application/json') && !accept.includes('text/html')) {
            response = Response.json({
              engine: 'RoadSearch',
              version: '1.0.0',
              endpoints: {
                search: 'GET /search?q=query&category=&domain=&page=1&limit=20&ai=true',
                suggest: 'GET /suggest?q=prefix',
                lucky: 'GET /lucky?q=query (redirects to top result)',
                stats: 'GET /stats',
                index: 'POST /index (auth required)',
                health: 'GET /health',
              },
              tagline: 'Search the Road. Find the Way.',
            });
          } else {
            response = new Response(SEARCH_HTML, {
              headers: { 'Content-Type': 'text/html;charset=UTF-8' },
            });
          }
        }
      }
    } catch (err) {
      console.error('RoadSearch error:', err);
      response = Response.json({ error: err.message }, { status: 500 });
    }

    const h = new Headers(response.headers);
    for (const [k, v] of Object.entries(headers)) h.set(k, v);
    return new Response(response.body, { status: response.status, headers: h });
  },
};
