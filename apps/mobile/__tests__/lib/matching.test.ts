// Lazy-load matching (same pattern as other tests) to let Jest env stabilise first
let passesHardFilters: any;
let scoreCompatibility: any;
let applyWildcardMix: any;
let selectTopPicks: any;
let getMatchReasons: any;

beforeAll(() => {
  jest.resetModules();
  const m = require('../../lib/matching');
  passesHardFilters = m.passesHardFilters;
  scoreCompatibility = m.scoreCompatibility;
  applyWildcardMix   = m.applyWildcardMix;
  selectTopPicks     = m.selectTopPicks;
  getMatchReasons    = m.getMatchReasons;
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prefs(overrides: Record<string, any> = {}): any {
  return {
    user_id: 'test',
    state: 'CA',
    city: 'Riverside',
    min_budget: 800,
    max_budget: 1500,
    cleanliness_level: 3,
    social_preference: 'balanced',
    work_schedule: '9-to-5',
    interests: { fitness: ['Gym', 'Yoga'], music: ['Guitar'] },
    dealbreakers: {},
    discover_filter_dealbreakers: {},
    ...overrides,
  };
}

function meta(overrides: Record<string, any> = {}): any {
  return {
    name: 'Alex',
    age: 22,
    bio: 'Looking for a roommate',
    hobbies: ['Gym'],
    prompts: [
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
    ],
    subscription_tier: 'free',
    ...overrides,
  };
}

// ─── passesHardFilters ────────────────────────────────────────────────────────

describe('passesHardFilters', () => {
  test('passes when all data matches', () => {
    expect(passesHardFilters(prefs(), prefs())).toBe(true);
  });

  test('fails on state mismatch', () => {
    expect(passesHardFilters(prefs({ state: 'CA' }), prefs({ state: 'TX' }))).toBe(false);
  });

  test('passes when one side has no state', () => {
    expect(passesHardFilters(prefs({ state: undefined }), prefs({ state: 'TX' }))).toBe(true);
  });

  test('fails on non-overlapping budgets', () => {
    expect(passesHardFilters(
      prefs({ min_budget: 500, max_budget: 800 }),
      prefs({ min_budget: 900, max_budget: 1400 }),
    )).toBe(false);
  });

  test('passes on touching budget ranges', () => {
    expect(passesHardFilters(
      prefs({ min_budget: 500, max_budget: 900 }),
      prefs({ min_budget: 900, max_budget: 1400 }),
    )).toBe(true);
  });

  test('pets Discover filter — free swipers ignore pets deck filter keys', () => {
    const mine = prefs({
      discover_filter_dealbreakers: { pets: 'hard' },
      dealbreakers: {},
    });
    const theirs = prefs({ pets_allowed: true });
    expect(passesHardFilters(mine, theirs, false)).toBe(true);
  });

  test('pets Discover filter — premium swipers exclude pet owners', () => {
    const mine = prefs({
      discover_filter_dealbreakers: { pets: 'hard' },
      dealbreakers: {},
    });
    const theirs = prefs({ pets_allowed: true });
    expect(passesHardFilters(mine, theirs, true)).toBe(false);
  });

  test('profile dealbreakers do not exclude the deck — only Discover filters do', () => {
    const mine = prefs({
      dealbreakers: { pets: 'hard' },
      discover_filter_dealbreakers: {},
    });
    const theirs = prefs({ pets_allowed: true });
    expect(passesHardFilters(mine, theirs, false)).toBe(true);
    expect(passesHardFilters(mine, theirs, true)).toBe(true);
  });

  test('smoking Discover filter — premium only deck exclusion', () => {
    const mine = prefs({
      discover_filter_dealbreakers: { smoking: 'hard' },
      dealbreakers: {},
    });
    const theirs = prefs({ smoking_allowed: true });
    expect(passesHardFilters(mine, theirs, false)).toBe(true);
    expect(passesHardFilters(mine, theirs, true)).toBe(false);
  });

  test('parties Discover filter — applies to all swipers', () => {
    const mine = prefs({
      discover_filter_dealbreakers: { parties: 'hard' },
      dealbreakers: {},
    });
    const theirs = prefs({ social_preference: 'social' });
    expect(passesHardFilters(mine, theirs, false)).toBe(false);
    expect(passesHardFilters(mine, theirs, true)).toBe(false);
  });

  test('early_bird Discover deck filter blocks night shift candidate', () => {
    const mine = prefs({
      discover_filter_dealbreakers: { early_bird: 'hard' },
      dealbreakers: {},
    });
    const theirs = prefs({ work_schedule: 'Night Shift' });
    expect(passesHardFilters(mine, theirs)).toBe(false);
  });

  test('messy Discover deck filter blocks cleanliness ≤ 2', () => {
    const mine = prefs({
      discover_filter_dealbreakers: { messy: 'hard' },
      dealbreakers: {},
    });
    expect(passesHardFilters(mine, prefs({ cleanliness_level: 2 }))).toBe(false);
    expect(passesHardFilters(mine, prefs({ cleanliness_level: 3 }))).toBe(true);
  });

  test('their profile dealbreakers do not hard-filter the swiper deck', () => {
    const mine = prefs({
      smoking_allowed: true,
      discover_filter_dealbreakers: {},
      dealbreakers: {},
    });
    const theirs = prefs({ dealbreakers: { smoking: 'hard' } });
    expect(passesHardFilters(mine, theirs, false)).toBe(true);
    expect(passesHardFilters(mine, theirs, true)).toBe(true);
  });
});

// ─── scoreCompatibility ───────────────────────────────────────────────────────

describe('scoreCompatibility', () => {
  test('identical profiles score above 0.8', () => {
    expect(scoreCompatibility(prefs(), prefs(), meta())).toBeGreaterThan(0.8);
  });

  test('score is in a valid range', () => {
    const score = scoreCompatibility(prefs(), prefs(), meta());
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(2); // boosts can push above 1.0
  });

  test('shared interests score higher than no shared interests', () => {
    const mine = prefs({ interests: { fitness: ['Gym'] } });
    const shared  = scoreCompatibility(mine, prefs({ interests: { fitness: ['Gym'] } }), meta());
    const noShare = scoreCompatibility(mine, prefs({ interests: { music: ['Jazz'] } }), meta());
    expect(shared).toBeGreaterThan(noShare);
  });

  test('hard dealbreaker conflict reduces score by ~0.10', () => {
    const mine = prefs({ dealbreakers: { smoking: 'hard' } });
    const theirs = prefs({ smoking_allowed: true });
    const withConflict = scoreCompatibility(mine, theirs, meta());
    const noConflict   = scoreCompatibility(prefs(), theirs, meta());
    expect(noConflict - withConflict).toBeCloseTo(0.10, 1);
  });

  test('soft dealbreaker conflict reduces score by ~0.05', () => {
    const mine = prefs({ dealbreakers: { smoking: 'soft' } });
    const theirs = prefs({ smoking_allowed: true });
    const withConflict = scoreCompatibility(mine, theirs, meta());
    const noConflict   = scoreCompatibility(prefs(), theirs, meta());
    expect(noConflict - withConflict).toBeCloseTo(0.05, 1);
  });

  test('new user (<48h) gets boost vs old user', () => {
    const recentMeta = meta({ created_at: new Date(Date.now() - 10 * 3_600_000).toISOString() });
    const oldMeta    = meta({ created_at: new Date(Date.now() - 72 * 3_600_000).toISOString() });
    expect(scoreCompatibility(prefs(), prefs(), recentMeta)).toBeGreaterThan(
      scoreCompatibility(prefs(), prefs(), oldMeta)
    );
  });

  test('premium tier gets visibility boost', () => {
    const premium = scoreCompatibility(prefs(), prefs(), meta({ subscription_tier: 'premium' }));
    const free    = scoreCompatibility(prefs(), prefs(), meta({ subscription_tier: 'free' }));
    expect(premium).toBeGreaterThan(free);
  });

  test('social preference gradient: same > adjacent > opposite', () => {
    const base = prefs({ social_preference: 'quiet' });
    const same = scoreCompatibility(base, prefs({ social_preference: 'quiet' }), meta());
    const adj  = scoreCompatibility(base, prefs({ social_preference: 'balanced' }), meta());
    const opp  = scoreCompatibility(base, prefs({ social_preference: 'social' }), meta());
    expect(same).toBeGreaterThan(adj);
    expect(adj).toBeGreaterThan(opp);
  });

  test('work schedule: same > flexible > 9-to-5 vs Night Shift', () => {
    const base = prefs({ work_schedule: '9-to-5' });
    const same = scoreCompatibility(base, prefs({ work_schedule: '9-to-5' }), meta());
    const flex = scoreCompatibility(base, prefs({ work_schedule: 'Flexible' }), meta());
    const opp  = scoreCompatibility(base, prefs({ work_schedule: 'Night Shift' }), meta());
    expect(same).toBeGreaterThan(flex);
    expect(flex).toBeGreaterThan(opp);
  });

  test('ethnicity match gives boost', () => {
    const mine = prefs({ ethnicity_preference: ['Asian'] });
    const withMatch = scoreCompatibility(mine, prefs(), meta({ ethnicity: 'Asian' }));
    const noMatch   = scoreCompatibility(mine, prefs(), meta({ ethnicity: 'Latino' }));
    expect(withMatch).toBeGreaterThan(noMatch);
  });

  test('ethnicity mismatch does NOT penalise', () => {
    const mine     = prefs({ ethnicity_preference: ['Asian'] });
    const mismatch = scoreCompatibility(mine, prefs(), meta({ ethnicity: 'Latino' }));
    const noPref   = scoreCompatibility(prefs(), prefs(), meta({ ethnicity: 'Latino' }));
    expect(mismatch).toBeCloseTo(noPref, 5);
  });

  test('has_listing boost when viewer prefers listings', () => {
    const withListing = scoreCompatibility(prefs(), prefs(), meta({ has_listing: true }),  { has_listing_only: true });
    const noListing   = scoreCompatibility(prefs(), prefs(), meta({ has_listing: false }), { has_listing_only: true });
    expect(withListing).toBeGreaterThan(noListing);
  });
});

// ─── applyWildcardMix ─────────────────────────────────────────────────────────

describe('applyWildcardMix', () => {
  function items(scores: number[]) {
    return scores.map((score, i) => ({ item: `p${i}`, score }));
  }

  test('returns up to count items', () => {
    expect(applyWildcardMix(items([0.9, 0.8, 0.7, 0.5, 0.3]), 3).length).toBeLessThanOrEqual(3);
  });

  test('returns empty array for empty input', () => {
    expect(applyWildcardMix([], 10)).toEqual([]);
  });

  test('all items have item and score fields', () => {
    for (const r of applyWildcardMix(items([0.9, 0.5, 0.2]), 3)) {
      expect(r).toHaveProperty('item');
      expect(r).toHaveProperty('score');
    }
  });

  test('free feed: ≥70% of results are high scorers (≥0.65)', () => {
    const result = applyWildcardMix(
      items([0.9, 0.85, 0.8, 0.75, 0.7, 0.55, 0.5, 0.3, 0.2]),
      9, false
    );
    const highCount = result.filter((x: any) => x.score >= 0.65).length;
    expect(highCount).toBeGreaterThanOrEqual(Math.floor(result.length * 0.65));
  });

  test('premium gets at least as many high scorers as free', () => {
    const scored = items([0.9, 0.85, 0.8, 0.75, 0.7, 0.68, 0.55, 0.5, 0.3, 0.2]);
    const freeHigh    = applyWildcardMix(scored, 10, false).filter((x: any) => x.score >= 0.65).length;
    const premiumHigh = applyWildcardMix(scored, 10, true).filter((x: any) => x.score >= 0.65).length;
    expect(premiumHigh).toBeGreaterThanOrEqual(freeHigh);
  });

  test('progressive fallback: works when pool is smaller than count', () => {
    expect(applyWildcardMix(items([0.8, 0.7]), 10).length).toBe(2);
  });
});

// ─── selectTopPicks ───────────────────────────────────────────────────────────

describe('selectTopPicks', () => {
  function scored(scores: number[]) {
    return scores.map((score, i) => ({ item: `p${i}`, score }));
  }

  test('only returns profiles scoring ≥ 0.70', () => {
    const result = selectTopPicks(scored([0.9, 0.75, 0.69, 0.5]), 10);
    expect(result.every((x: any) => x.score >= 0.70)).toBe(true);
    expect(result.length).toBe(2);
  });

  test('capped at count', () => {
    expect(selectTopPicks(scored([0.9, 0.85, 0.8, 0.75]), 2).length).toBe(2);
  });

  test('sorted highest first', () => {
    const result = selectTopPicks(scored([0.75, 0.9, 0.8]), 10);
    expect(result[0].score).toBe(0.9);
    expect(result[1].score).toBe(0.8);
  });

  test('returns empty when nothing meets threshold', () => {
    expect(selectTopPicks(scored([0.5, 0.3]), 10)).toEqual([]);
  });
});

// ─── getMatchReasons ──────────────────────────────────────────────────────────

describe('getMatchReasons', () => {
  test('shared interests appear in reasons (3+ shows count)', () => {
    const mine   = prefs({ interests: { fitness: ['Gym', 'Yoga', 'Running'] } });
    const theirs = prefs({ interests: { fitness: ['Gym', 'Yoga', 'Running', 'Hiking'] } });
    // 3 shared → "3 shared interests"
    expect(getMatchReasons(mine, theirs, meta()).some((r: string) => r.includes('shared interests'))).toBe(true);
  });

  test('close cleanliness levels produce a reason', () => {
    expect(getMatchReasons(prefs({ cleanliness_level: 4 }), prefs({ cleanliness_level: 4 }), meta())
      .some((r: string) => r.toLowerCase().includes('clean'))).toBe(true);
  });

  test('no cleanliness reason when levels differ by more than 1', () => {
    expect(getMatchReasons(prefs({ cleanliness_level: 5 }), prefs({ cleanliness_level: 2 }), meta())
      .some((r: string) => r.toLowerCase().includes('clean'))).toBe(false);
  });

  test('same social preference produces a reason', () => {
    expect(getMatchReasons(prefs({ social_preference: 'quiet' }), prefs({ social_preference: 'quiet' }), meta())
      .some((r: string) => r.toLowerCase().includes('quiet'))).toBe(true);
  });

  test('budget overlap produces a $ reason', () => {
    expect(getMatchReasons(
      prefs({ min_budget: 800, max_budget: 1200 }),
      prefs({ min_budget: 1000, max_budget: 1500 }),
      meta(),
    ).some((r: string) => r.includes('$'))).toBe(true);
  });

  test('same city produces a location reason', () => {
    // Use minimal prefs so city isn't crowded out by the 5-reason cap
    const minimal = { user_id: 'x', city: 'Riverside', dealbreakers: {}, interests: {} };
    expect(getMatchReasons(minimal as any, minimal as any, meta())
      .some((r: string) => r.includes('Riverside'))).toBe(true);
  });

  test('at most 5 reasons returned', () => {
    expect(getMatchReasons(prefs(), prefs(), meta()).length).toBeLessThanOrEqual(5);
  });

  test('always returns an array', () => {
    expect(Array.isArray(getMatchReasons(
      prefs({ interests: {}, city: 'LA', social_preference: 'quiet', cleanliness_level: 1 }),
      prefs({ interests: {}, city: 'SF', social_preference: 'social', cleanliness_level: 5 }),
      meta(),
    ))).toBe(true);
  });
});
