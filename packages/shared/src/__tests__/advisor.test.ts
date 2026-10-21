
describe('advisor — parser a šablona (spec §6 P1)', () => {
  it('parseAdvisorResponse přijme jen produkty z katalogu a platná množství', async () => {
    const { parseAdvisorResponse } = await import('@lovecslev/shared');
    const catalog = [
      { productId: 'prd_mleko', name: 'Mléko polotučné', baseUnit: 'ML' as const, category: 'Mléčné' },
      { productId: 'prd_maslo', name: 'Máslo', baseUnit: 'G' as const, category: 'Mléčné' },
    ];

    const draft = parseAdvisorResponse(
      JSON.stringify({
        items: [
          { productId: 'prd_mleko', quantity: 6000 },
          { productId: 'prd_maslo', quantity: -5 },
          { productId: 'prd_halucinace', quantity: 1 },
          { productId: 'prd_mleko', quantity: 1 },
        ],
        explanation: 'Týdenní nákup',
      }),
      catalog,
    );

    expect(draft.source).toBe('LLM');
    expect(draft.items).toEqual([
      { productId: 'prd_mleko', name: 'Mléko polotučné', quantityBase: 6000, baseUnit: 'ML' },
    ]);
    expect(draft.explanation).toBe('Týdenní nákup');
  });

  it('parseAdvisorResponse odmítne nevalidní JSON i prázdný výběr', async () => {
    const { parseAdvisorResponse, AdvisorParseError } = await import('@lovecslev/shared');
    const catalog = [
      { productId: 'prd_mleko', name: 'Mléko polotučné', baseUnit: 'ML' as const, category: 'Mléčné' },
    ];

    expect(() => parseAdvisorResponse('tohle není json', catalog)).toThrow(AdvisorParseError);
    expect(() => parseAdvisorResponse('{"items":[]}', catalog)).toThrow(/žádnou/);
    expect(() => parseAdvisorResponse('{"items":[{"productId":"x","quantity":1}]}', catalog)).toThrow(
      /žádnou/,
    );
  });

  it('buildTemplateDraft vybere základní koš deterministicky', async () => {
    const { buildTemplateDraft } = await import('@lovecslev/shared');
    const catalog = [
      { productId: 'p_mleko', name: 'Mléko polotučné', baseUnit: 'ML' as const, category: 'Mléčné' },
      { productId: 'p_maslo', name: 'Máslo', baseUnit: 'G' as const, category: 'Mléčné' },
      { productId: 'p_papir', name: 'Toaletní papír 8 rolí', baseUnit: 'PCS' as const, category: 'Drogerie' },
    ];

    const draft = buildTemplateDraft({ freeText: 'nákup na týden', budgetMinor: 250000 }, catalog);

    expect(draft.source).toBe('TEMPLATE');
    expect(draft.items.map((item) => item.productId)).toEqual(['p_mleko', 'p_maslo', 'p_papir']);
    expect(draft.items.find((item) => item.productId === 'p_papir')?.quantityBase).toBe(8);
    expect(draft.explanation).toContain('šablona');
  });

  it('buildAdvisorPrompt zakazuje vymýšlení produktů i cen', async () => {
    const { buildAdvisorPrompt } = await import('@lovecslev/shared');
    const prompt = buildAdvisorPrompt(
      { freeText: 'nákup pro 4 lidi do 2500 Kč', budgetMinor: 250000 },
      [{ productId: 'prd_mleko', name: 'Mléko polotučné', baseUnit: 'ML', category: 'Mléčné' }],
    );

    expect(prompt).toContain('POUZE z nabídnutého katalogu');
    expect(prompt).toContain('prd_mleko');
    expect(prompt).toContain('2500.00 Kč');
    expect(prompt).toContain('Ceny neuváděj');
  });
});
