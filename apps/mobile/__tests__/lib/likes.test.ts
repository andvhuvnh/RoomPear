const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockUpdateEq = jest.fn();
const mockUpdate = jest.fn();
const mockUpsert = jest.fn();
const mockDeleteEqLiker = jest.fn();
const mockDeleteEqUser = jest.fn();
const mockDelete = jest.fn();
const mockFrom = jest.fn();

function loadLikesModule() {
  jest.resetModules();
  jest.doMock('../../lib/supabase', () => ({
    supabase: {
      from: (...args: unknown[]) => mockFrom(...args),
    },
  }));
  jest.doMock('../../lib/storage', () => ({
    getProfileImageUrls: jest.fn(),
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../lib/likes');
}

describe('likes integration behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockSingle.mockReset();
    mockEq.mockReset();
    mockSelect.mockReset();
    mockUpdateEq.mockReset();
    mockUpdate.mockReset();
    mockUpsert.mockReset();
    mockDeleteEqUser.mockReset();
    mockDeleteEqLiker.mockReset();
    mockDelete.mockReset();
    mockFrom.mockReset();

    mockEq.mockImplementation(() => ({ single: mockSingle }));
    mockSelect.mockImplementation(() => ({ eq: mockEq }));
    mockUpdateEq.mockResolvedValue({ error: null });
    mockUpdate.mockImplementation(() => ({ eq: mockUpdateEq }));
    mockUpsert.mockResolvedValue({ error: null });
    mockDeleteEqLiker.mockResolvedValue({ error: null });
    mockDeleteEqUser.mockImplementation(() => ({ eq: mockDeleteEqLiker }));
    mockDelete.mockImplementation(() => ({ eq: mockDeleteEqUser }));

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      if (table === 'like_reveals') {
        return {
          select: mockSelect,
          upsert: mockUpsert,
          delete: mockDelete,
        };
      }
      return {
        select: mockSelect,
      };
    });
  });

  it('consumeReveal spends daily reveal when available', async () => {
    const likes = loadLikesModule();
    mockSingle.mockResolvedValueOnce({
      data: { last_free_reveal_at: null, bonus_reveal_balance: 3 },
      error: null,
    });

    const result = await likes.consumeReveal('user-1');

    expect(result).toEqual({ success: true, usedBonus: false });
    expect(mockUpdate).toHaveBeenCalledWith({ last_free_reveal_at: expect.any(String) });
  });

  it('consumeReveal spends bonus reveal when daily already used', async () => {
    const likes = loadLikesModule();
    mockSingle.mockResolvedValueOnce({
      data: { last_free_reveal_at: new Date().toISOString(), bonus_reveal_balance: 2 },
      error: null,
    });

    const result = await likes.consumeReveal('user-1');

    expect(result).toEqual({ success: true, usedBonus: true });
    expect(mockUpdate).toHaveBeenCalledWith({ bonus_reveal_balance: 1 });
  });

  it('loads persisted revealed ids', async () => {
    const likes = loadLikesModule();
    mockEq.mockResolvedValueOnce({
      data: [{ liker_id: 'a' }, { liker_id: 'b' }],
      error: null,
    });

    const ids = await likes.fetchPersistedRevealedIds('user-1');

    expect(ids).toEqual(new Set(['a', 'b']));
  });

  it('persists a revealed liker with upsert', async () => {
    const likes = loadLikesModule();
    const ok = await likes.persistRevealedLiker('user-1', 'liker-1');

    expect(ok).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      { user_id: 'user-1', liker_id: 'liker-1' },
      { onConflict: 'user_id,liker_id' }
    );
  });

  it('unpersists a revealed liker', async () => {
    const likes = loadLikesModule();
    await likes.unpersistRevealedLiker('user-1', 'liker-1');

    expect(mockDeleteEqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockDeleteEqLiker).toHaveBeenCalledWith('liker_id', 'liker-1');
  });
});
