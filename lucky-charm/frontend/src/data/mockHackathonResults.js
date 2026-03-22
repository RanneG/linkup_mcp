/**
 * Mock TEE results for cumulative dashboard: each file adds a "meeting" to the same project.
 * Lucky Charm story arc: no_plan → concept → goals → planning → execution → finished.
 * All 21 files map to meetings 1–6 (cycle); content matches transcript progression.
 */

const MOCK_FILES = [
  'lucky_charm_standup_01.tab',
  'lucky_charm_standup_02.tab',
  'lucky_charm_standup_03.tab',
  'lucky_charm_standup_04.tab',
  'lucky_charm_standup_05.tab',
  'lucky_charm_standup_06.tab',
  'lucky_charm_standup_07.tab',
  'lucky_charm_standup_08.tab',
  'lucky_charm_standup_09.tab',
  'lucky_charm_standup_10.tab',
  'lucky_charm_standup_11.tab',
  'lucky_charm_standup_12.tab',
  'lucky_charm_standup_13.tab',
  'lucky_charm_standup_14.tab',
  'lucky_charm_standup_15.tab',
  'lucky_charm_standup_16.tab',
  'lucky_charm_standup_17.tab',
  'lucky_charm_standup_18.tab',
  'lucky_charm_standup_19.tab',
  'lucky_charm_standup_20.tab',
  'lucky_charm_standup_21.tab',
]

function item(id, category, summary, extra = {}) {
  return { id, category, summary, reported_by: 'Team (from transcript)', ...extra }
}
function action(id, theme, summary, due, extra = {}) {
  return { id, theme, summary, due, due_distribution: { [due]: 1 }, assignee: 'Team (from transcript)', ...extra }
}
function decision(id, theme, summary, extra = {}) {
  return { id, theme, summary, date: '—', decided_by: 'Team (from transcript)', ...extra }
}

/** Meeting 1 — No plan: ideation, what to build */
const MEETING_1 = {
  blockers: [
    item('b-1', 'task', 'no / clear / idea / yet', { status: 'In progress', since: '—' }),
    item('b-2', 'resource', 'hackathon / deadline / pressure', { status: 'In progress', since: '—' }),
  ],
  action_items: [
    action('a-1', 'commitment', 'brainstorm / ideas', 'Today'),
    action('a-2', 'scoping', 'write / down / concept', 'Today'),
  ],
  decisions: [
    decision('d-1', 'topic', 'standup / meeting / tool / direction'),
    decision('d-2', 'next_steps', 'think / more / transcript / parsing'),
  ],
  velocity: { blocker_count: 2, action_item_count: 2, decision_count: 2 },
  themes: ['task', 'resource', 'commitment', 'scoping', 'topic', 'next_steps'],
}

/** Meeting 2 — Concept: Lucky Charm idea takes shape */
const MEETING_2 = {
  blockers: [],
  action_items: [
    action('a-1', 'role', 'backend / TEE / integration', 'This week'),
    action('a-2', 'role', 'frontend / dashboard', 'This week'),
    action('a-3', 'commitment', 'Props / compliant / output', 'This week'),
  ],
  decisions: [
    decision('d-1', 'scope', 'Lucky Charm / name'),
    decision('d-2', 'scope', 'capture / blockers / actions / decisions'),
    decision('d-3', 'agreement', 'privacy / first / TEE'),
    decision('d-4', 'scope', 'LLM / export / context'),
  ],
  velocity: { blocker_count: 0, action_item_count: 3, decision_count: 4 },
  themes: ['role', 'commitment', 'scope', 'agreement'],
}

/** Meeting 3 — Goals: capture blockers, actions, LLM-ready context */
const MEETING_3 = {
  blockers: [],
  action_items: [
    action('a-1', 'documentation', 'goals / doc / README', 'Tomorrow'),
    action('a-2', 'commitment', 'capture / blockers / categories', 'This week'),
    action('a-3', 'commitment', 'action / items / due / assignees', 'This week'),
    action('a-4', 'commitment', 'decisions / agreements', 'This week'),
    action('a-5', 'feature', 'Copy / for / LLM / Download / JSON', 'This week'),
  ],
  decisions: [
    decision('d-1', 'scope', 'one / bank / demo'),
    decision('d-2', 'scope', 'top / 12 / target'),
    decision('d-3', 'next_steps', 'document / goals'),
  ],
  velocity: { blocker_count: 0, action_item_count: 5, decision_count: 3 },
  themes: ['documentation', 'commitment', 'feature', 'scope', 'next_steps'],
}

/** Meeting 4 — Planning: integration points, docs, staging */
const MEETING_4 = {
  blockers: [],
  action_items: [
    action('a-1', 'documentation', 'OpenAPI / transcript / endpoint', 'Tomorrow'),
    action('a-2', 'integration', 'attestation / Phala / flow', 'This week'),
    action('a-3', 'environment', 'staging / nightly / deploys', 'This week'),
    action('a-4', 'documentation', 'onboarding / privacy / attestation', 'This week'),
    action('a-5', 'review', 'Props / filter / PR', 'Today'),
    action('a-6', 'documentation', 'TEE / runbook', 'This week'),
    action('a-7', 'commitment', 'demo / script / sponsor', 'Friday'),
    action('a-8', 'coordination', 'API / auth / handoff', 'Tomorrow'),
  ],
  decisions: [
    decision('d-1', 'scope', 'OpenAPI / first'),
    decision('d-2', 'scope', 'attestation / optional / MVP'),
  ],
  velocity: { blocker_count: 0, action_item_count: 8, decision_count: 2 },
  themes: ['documentation', 'integration', 'environment', 'review', 'commitment', 'coordination', 'scope'],
}

/** Meeting 5 — Execution: blockers emerge */
const MEETING_5 = {
  blockers: [
    item('b-1', 'integration', 'Phala / attestation / enclave / verification', { status: 'In progress', since: '2 days' }),
    item('b-2', 'integration', 'sandbox / rate / limit', { status: 'In progress', since: '2 days' }),
    item('b-3', 'environment', 'staging / nightly / flaky', { status: 'In progress', since: '1 day' }),
    item('b-4', 'resource', 'design / tokens / mobile', { status: 'In progress', since: '3 days' }),
    item('b-5', 'integration', 'Plaid / webhook / credentials', { status: 'In progress', since: '1 day' }),
    item('b-6', 'task', 'documentation / onboarding / gap', { status: 'In progress', since: '—' }),
  ],
  action_items: [
    action('a-1', 'documentation', 'OpenAPI / spec', 'Tomorrow'),
    action('a-2', 'review', 'Props / filter / PR / 142', 'Today'),
    action('a-3', 'documentation', 'TEE / runbook', 'This week'),
    action('a-4', 'commitment', 'attestation / spike', 'Today'),
  ],
  decisions: [],
  velocity: { blocker_count: 6, action_item_count: 4, decision_count: 0 },
  themes: ['integration', 'environment', 'resource', 'task', 'documentation', 'review', 'commitment'],
}

/** Meeting 6 — Finished: decisions, wrap-up */
const MEETING_6 = {
  blockers: [],
  action_items: [
    action('a-1', 'commitment', 'demo / script / sponsor / Friday', 'Friday'),
    action('a-2', 'documentation', 'docs / README / privacy', 'Friday'),
    action('a-3', 'next_steps', 'DevPost / submit', 'Today'),
  ],
  decisions: [
    decision('d-1', 'scope', 'REST / transcript / WebSocket / live'),
    decision('d-2', 'agreement', 'blur / speaker / privacy'),
    decision('d-3', 'scope', 'MVP / mock / Live / TEE / toggle'),
    decision('d-4', 'scope', 'one / bank / demo'),
  ],
  velocity: { blocker_count: 0, action_item_count: 3, decision_count: 4 },
  themes: ['commitment', 'documentation', 'next_steps', 'scope', 'agreement'],
}

const MEETINGS = [MEETING_1, MEETING_2, MEETING_3, MEETING_4, MEETING_5, MEETING_6]

/**
 * Returns Lucky Charm project data for the given mock filename.
 * Each file adds a meeting — content follows story arc (no plan → concept → goals → planning → execution → finished).
 */
export function getMockResultForFile(filename) {
  if (!filename) return MEETING_1
  const idx = MOCK_FILES.indexOf(filename.trim())
  return MEETINGS[idx >= 0 ? idx % MEETINGS.length : 0]
}
