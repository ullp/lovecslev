import { ApiError, apiRequest, buildUrl } from '../lib/api';

describe('buildUrl', () => {
  it('sestaví URL s query parametry a přeskočí undefined', () => {
    expect(buildUrl('/v1/leaflets', { activeOn: '2026-10-20', chainCode: undefined }, 'http://api.test')).toBe(
      'http://api.test/v1/leaflets?activeOn=2026-10-20',
    );
  });

  it('odstraní trailing slash z base URL', () => {
    expect(buildUrl('/health', undefined, 'http://api.test/')).toBe('http://api.test/health');
  });
});

describe('apiRequest', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('rozbalí envelope { data }', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: 'x' }], meta: { total: 1 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    await expect(apiRequest('/v1/lists')).resolves.toEqual([{ id: 'x' }]);
  });

  it('přeloží doménovou chybu na ApiError s kódem (spec §13.5)', async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({ error: { code: 'PREMIUM_REQUIRED', message: 'Jen Premium', details: { requiredPlan: 'PREMIUM' } } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    await expect(apiRequest('/v1/lists/1/optimize', { method: 'POST', body: {} })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'PREMIUM_REQUIRED',
      status: 403,
    });
  });

  it('pošle Authorization hlavičku, když je token', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await apiRequest('/v1/lists', { token: 'abc' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer abc');
  });

  it('prázdná odpověď (204) nespadne', async () => {
    global.fetch = jest.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    await expect(apiRequest('/v1/lists/1', { method: 'DELETE' })).resolves.toBeNull();
  });

  it('ApiError má výchozí details', () => {
    const error = new ApiError('NOT_FOUND', 'Není', 404);
    expect(error.details).toEqual({});
  });
});
