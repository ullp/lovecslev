'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { describeError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { StoreNearby } from '@/lib/types';

const PRAGUE_CENTER = { lat: 50.081, lng: 14.427, label: 'Praha (Václavské náměstí)' };

export default function StoresPage(): JSX.Element {
  const [position, setPosition] = useState(PRAGUE_CENTER);
  const [stores, setStores] = useState<readonly StoreNearby[]>([]);
  const [radiusKm, setRadiusKm] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      try {
        const data = await api.storesNearby({ lat: position.lat, lng: position.lng, radiusKm });
        if (!cancelled) {
          setStores(data);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) setError(describeError(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [position, radiusKm]);

  const bbox = useMemo(() => {
    if (stores.length === 0) {
      const delta = 0.02;
      return `${position.lng - delta},${position.lat - delta},${position.lng + delta},${position.lat + delta}`;
    }
    const lats = stores.map((store) => store.latitude);
    const lngs = stores.map((store) => store.longitude);
    const pad = 0.005;
    return `${Math.min(...lngs) - pad},${Math.min(...lats) - pad},${Math.max(...lngs) + pad},${Math.max(...lats) + pad}`;
  }, [position, stores]);

  function useMyLocation(): void {
    if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
      setError('Prohlížeč nepodporuje určení polohy.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude, label: 'Moje poloha' });
        setLocating(false);
      },
      () => {
        setError('Polohu se nepodařilo získat — používám Prahu.');
        setLocating(false);
      },
      { timeout: 8000 },
    );
  }

  return (
    <div>
      <h1>Obchody v okolí</h1>
      <p className="subtitle">
        {position.label} · {radiusKm} km · {stores.length} prodejen
      </p>

      {error !== null && <p className="error">{error}</p>}

      <div className="row" style={{ marginBottom: 12 }}>
        <button onClick={useMyLocation} disabled={locating}>
          {locating ? 'Zjišťuji polohu…' : 'Použít moji polohu'}
        </button>
        <label className="muted">
          Radius{' '}
          <select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
            {[1, 3, 5, 10, 25].map((value) => (
              <option key={value} value={value}>
                {value} km
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <iframe
          title="Mapa obchodů"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${position.lat},${position.lng}`}
          style={{ width: '100%', height: 360, border: 0 }}
          loading="lazy"
        />
      </div>
      <p className="muted">
        Mapa: OpenStreetMap. Marker ukazuje zvolený střed; prodejny jsou v seznamu níže (každá s odkazem do mapy).
      </p>

      {loading && <p className="muted">Načítám prodejny…</p>}

      <ul className="list">
        {stores.map((store) => (
          <li key={store.id} className="list-item">
            <span>
              <span className="row" style={{ gap: 6 }}>
                <span className="dot" style={{ background: store.colorHex }} />
                <strong>{store.chainName}</strong>
              </span>
              <span className="muted">
                {' '}
                · {store.name} · {store.address}, {store.city} · {(store.distanceMeters / 1000).toFixed(1)} km
              </span>
            </span>
            <span className="row" style={{ gap: 8 }}>
              <span className={`chip ${store.hasActiveLeaflet ? '' : 'chip-muted'}`}>
                {store.hasActiveLeaflet ? 'leták' : 'bez letáku'}
              </span>
              <a
                className="nav-link"
                href={`https://www.openstreetmap.org/?mlat=${store.latitude}&mlon=${store.longitude}#map=17/${store.latitude}/${store.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                Mapa
              </a>
            </span>
          </li>
        ))}
      </ul>

      {!loading && stores.length === 0 && (
        <p className="notice">V tomto okruhu nejsou žádné prodejny. Zvětšete radius.</p>
      )}

      <p className="muted">Platnost letáků ověřena k {formatDate(new Date().toISOString().slice(0, 10))}.</p>
    </div>
  );
}
