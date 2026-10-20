import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatCzk } from '@slevari/shared';
import { api, type LeafletSummary, type NearbyStore, type SearchMeta, type SearchProduct } from './src/api';

type Tab = 'leaflets' | 'search' | 'stores';

const PRAGUE = { lat: 50.081, lng: 14.427 };

/**
 * Expo klient napojený na API (F1 letáky, F2 hledání, F5 prodejny).
 * Přihlášení a seznamy (JWT) zůstávají ve webu — viz spec §20.1.
 */
export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('leaflets');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Slevaři kolem mě</Text>
        <Text style={styles.subtitle}>
          {tab === 'leaflets' ? 'Aktuální letáky' : tab === 'search' ? 'Hledání produktu' : 'Obchody v okolí'}
        </Text>
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['leaflets', 'Letáky'],
            ['search', 'Hledat'],
            ['stores', 'Mapa'],
          ] as const
        ).map(([value, label]) => (
          <Pressable key={value} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.tabActive]}>
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'leaflets' && <LeafletsScreen />}
      {tab === 'search' && <SearchScreen />}
      {tab === 'stores' && <StoresScreen />}
    </SafeAreaView>
  );
}

function useAsync<T>(load: () => Promise<T>): { data: T | null; error: string | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await load());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Neznámá chyba');
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void run();
  }, [run]);

  return { data, error, loading };
}

function LeafletsScreen(): JSX.Element {
  const { data, error, loading } = useAsync<readonly LeafletSummary[]>(useCallback(() => api.leaflets(), []));

  if (loading) return <ActivityIndicator style={styles.loading} />;
  if (error !== null) return <Text style={styles.error}>{error}</Text>;

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.muted}>Žádné aktivní letáky.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: item.colorHex }]} />
            <Text style={styles.cardTitle}>{item.chainName}</Text>
          </View>
          <Text style={styles.muted}>
            {item.promotionCount} akcí · {item.productCount} produktů
          </Text>
          <View style={styles.row}>
            {item.topDiscounts.map((discount) => (
              <Text key={discount} style={styles.chip}>
                −{discount} %
              </Text>
            ))}
          </View>
        </View>
      )}
    />
  );
}

function SearchScreen(): JSX.Element {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<readonly SearchProduct[]>([]);
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    if (query.trim().length < 2) {
      setError('Zadejte alespoň 2 znaky.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api.search(query.trim());
      setProducts(response.products);
      setMeta(response.meta);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Neznámá chyba');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.list}>
      <View style={styles.row}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="kuřecí prsa, mléko…"
          autoCapitalize="none"
          style={[styles.input, styles.flex]}
          onSubmitEditing={() => void submit()}
        />
        <Pressable style={styles.button} onPress={() => void submit()} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? '…' : 'Hledat'}</Text>
        </Pressable>
      </View>

      {error !== null && <Text style={styles.error}>{error}</Text>}

      {meta !== null && (
        <Text style={styles.muted}>
          Shoda: {meta.match.method} ({Math.round(meta.match.confidence * 100)} %) · {meta.driver}
        </Text>
      )}

      <FlatList
        data={products}
        keyExtractor={(item) => item.productId}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            {item.offers.length === 0 ? (
              <Text style={styles.muted}>Momentálně bez akce.</Text>
            ) : (
              item.offers.map((offer) => (
                <View key={`${item.productId}-${offer.chainCode}`} style={styles.rowBetween}>
                  <Text>
                    {offer.chainName} · {formatCzk(offer.priceMinor)}
                  </Text>
                  <Text style={styles.muted}>
                    {formatCzk(offer.unitPriceMinor)} / {offer.unitLabel.replace(/^Kč\//, '')}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      />
    </View>
  );
}

function StoresScreen(): JSX.Element {
  const load = useCallback(() => api.nearby(PRAGUE.lat, PRAGUE.lng, 5), []);
  const { data, error, loading } = useAsync<readonly NearbyStore[]>(load);

  if (loading) return <ActivityIndicator style={styles.loading} />;
  if (error !== null) return <Text style={styles.error}>{error}</Text>;

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.muted}>5 km kolem Prahy (v demu pevná poloha).</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: item.colorHex }]} />
              <Text style={styles.cardTitle}>{item.chainName}</Text>
            </View>
            <Text style={styles.muted}>{(item.distanceMeters / 1000).toFixed(1)} km</Text>
          </View>
          <Text style={styles.muted}>
            {item.name} · {item.address}
          </Text>
          <Text style={item.hasActiveLeaflet ? styles.chip : styles.chipMuted}>
            {item.hasActiveLeaflet ? 'aktuální leták' : 'bez letáku'}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8, padding: 16 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#e2e8f0' },
  tabActive: { backgroundColor: '#047857' },
  tabText: { color: '#334155', fontWeight: '600' },
  tabTextActive: { color: '#ffffff' },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 999 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  muted: { fontSize: 13, color: '#64748b' },
  chip: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  chipMuted: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#ffffff',
  },
  flex: { flex: 1 },
  button: { backgroundColor: '#047857', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  buttonText: { color: '#ffffff', fontWeight: '700' },
  error: { color: '#b91c1c', paddingHorizontal: 16 },
  loading: { marginTop: 24 },
});
