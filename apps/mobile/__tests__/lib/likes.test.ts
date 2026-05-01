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
const mockRpc = jest.fn();

function loadLikesModule() {
  jest.resetModules();
  jest.doMock('../../lib/supabase', () => ({
    supabase: {
      from: (...args: unknown[]) => mockFrom(...args),
      rpc: (name: string, params?: unknown) => mockRpc(name, params),
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
    mockRpc.mockReset();

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

  it('consumeReveal maps RPC daily success', async () => {
    const likes = loadLikesModule();
    mockRpc.mockResolvedValueOnce({
      data: { success: true, used_bonus: false },
      error: null,
    });

    const result = await likes.consumeReveal();

    expect(result).toEqual({ success: true, usedBonus: false });
    expect(mockRpc).toHaveBeenCalledWith('consume_like_reveal_quota', undefined);
  });

  it('consumeReveal maps RPC bonus success', async () => {
    const likes = loadLikesModule();
    mockRpc.mockResolvedValueOnce({
      data: { success: true, used_bonus: true },
      error: null,
    });

    const result = await likes.consumeReveal();

    expect(result).toEqual({ success: true, usedBonus: true });
  });

  it('consumeReveal maps RPC failure', async () => {
    const likes = loadLikesModule();
    mockRpc.mockResolvedValueOnce({
      data: { success: false, reason: 'already_used' },
      error: null,
    });

    const result = await likes.consumeReveal();

    expect(result).toEqual({ success: false, reason: 'already_used' });
  });

  it('consumeReveal maps RPC transport error', async () => {
    const likes = loadLikesModule();
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Could not find the function' },
    });

    const result = await likes.consumeReveal();

    expect(result).toMatchObject({
      success: false,
      reason: 'rpc_failed',
      rpcErrorMessage: 'Could not find the function',
    });
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
