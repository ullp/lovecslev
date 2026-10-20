import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { OFFERS, optimizePurchase, SHOPPING_LIST, formatCzk } from '@slevari/shared';

/**
 * M0 scaffold — obrazovka, která ověřuje end-to-end napojení na doménové jádro.
 * Reálné obrazovky F1–F5 přijdou v M4 (spec §20).
 */
const demo = optimizePurchase({ items: SHOPPING_LIST, offers: OFFERS });

export default function App(): JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Slevaři kolem mě</Text>
      <Text style={styles.subtitle}>Demo optimalizace z referenční fixture (spec §19)</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Varianta A — jeden obchod</Text>
        <Text style={styles.chain}>{demo.variantA?.chainCode ?? '—'}</Text>
        <Text style={styles.price}>{formatCzk(demo.variantA?.totalMinor ?? 0)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Varianta B — kombinace obchodů</Text>
        {demo.variantB.chains.map((chain) => (
          <Text key={chain.chainCode} style={styles.row}>
            {chain.chainCode}: {formatCzk(chain.subtotalMinor)}
          </Text>
        ))}
        <Text style={styles.price}>{formatCzk(demo.variantB.totalMinor)}</Text>
        <Text style={styles.saving}>Úspora: {formatCzk(demo.savingsMinor)}</Text>
      </View>

      <Text style={styles.note}>
        Cena nezahrnuje cestu (D17). Varianta B je v tarifu FREE uzamčená (D18).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 72, backgroundColor: '#ffffff', gap: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280' },
  card: { padding: 16, borderRadius: 12, backgroundColor: '#f3f4f6', gap: 4 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#374151', textTransform: 'uppercase' },
  chain: { fontSize: 20, fontWeight: '700', color: '#111827' },
  price: { fontSize: 22, fontWeight: '700', color: '#047857' },
  row: { fontSize: 15, color: '#111827' },
  saving: { fontSize: 15, fontWeight: '600', color: '#b45309' },
  note: { fontSize: 12, color: '#6b7280', lineHeight: 18 },
});
