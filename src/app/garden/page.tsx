'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, X, Droplets } from 'lucide-react';
import { Button, Skeleton, EmptyState, rise } from '@/components/ui/kit';

interface Plant {
  id: string;
  name: string;
  emoji: string;
  location: 'indoor' | 'outdoor';
  waterSchedule: string;
  waterDays: number[];
  img?: string;
  tip?: string;
  addedBy?: string;
  addedAt?: string;
}

interface GardenBlob {
  version: number;
  lastUpdated: string;
  plants: Plant[];
}

const EMPTY_FORM: Omit<Plant, 'id'> = {
  name: '', emoji: '🌿', location: 'indoor', waterSchedule: '', waterDays: [], img: '', tip: '', addedBy: '',
};

const inputCls =
  'bg-[var(--surface-2)] border border-[var(--line)] rounded-[var(--r-sm)] px-3 py-2 text-[14px] text-[var(--text)] placeholder:text-[var(--text-3)] focus:outline-none focus:border-[var(--line-strong)] transition-colors';

export default function GardenPage() {
  const [blob, setBlob] = useState<GardenBlob | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState<string | null>(null);
  const lastUpdatedRef = useRef<string | null>(null);

  async function fetchGarden(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/garden');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Garden API error (${res.status})`);
      }
      const data: GardenBlob = await res.json();
      if (!data || !Array.isArray(data.plants)) throw new Error('Unexpected data format from garden storage');
      if (data.lastUpdated !== lastUpdatedRef.current) {
        lastUpdatedRef.current = data.lastUpdated;
        setBlob(data);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load garden');
    }
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    fetchGarden();
    const interval = setInterval(() => fetchGarden(true), 30000);
    return () => clearInterval(interval);
  }, []);

  async function removePlant(id: string) {
    if (!blob) return;
    const updated: GardenBlob = {
      ...blob,
      lastUpdated: new Date().toISOString(),
      plants: blob.plants.filter(p => p.id !== id),
    };
    setSaving(true);
    const res = await fetch('/api/garden', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    if (res.ok) {
      const saved: GardenBlob = await res.json();
      setBlob(saved);
      lastUpdatedRef.current = saved.lastUpdated;
    } else {
      setError('Failed to save — please try again');
    }
    setSaving(false);
  }

  async function addPlant() {
    if (!blob || !form.name.trim()) return;
    const newPlant: Plant = {
      ...form,
      id: `plant-${Date.now()}`,
      addedAt: new Date().toISOString().split('T')[0],
    };
    const updated: GardenBlob = {
      ...blob,
      lastUpdated: new Date().toISOString(),
      plants: [...blob.plants, newPlant],
    };
    setSaving(true);
    const res = await fetch('/api/garden', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    if (res.ok) {
      const saved: GardenBlob = await res.json();
      setBlob(saved);
      lastUpdatedRef.current = saved.lastUpdated;
    } else {
      setError('Failed to save — please try again');
    }
    setForm({ ...EMPTY_FORM });
    setShowForm(false);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="w-full mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-56" />
          </div>
          <Skeleton className="h-9 w-28 !rounded-full" />
        </div>
        <div className="grid grid-cols-7 gap-2 mb-8">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (error || !blob || !Array.isArray(blob.plants)) {
    return (
      <div className="w-full mx-auto p-6">
        <EmptyState
          title={error ?? 'Unexpected data format — please reload.'}
          hint="Couldn't reach the garden storage. Check the database connection and try again."
        />
      </div>
    );
  }

  const indoor  = blob.plants.filter(p => p.location === 'indoor');
  const outdoor = blob.plants.filter(p => p.location === 'outdoor');

  // Watering calendar — next 7 days
  const today = new Date();
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayIdx = d.getDay();
    const plants = blob.plants.filter(p => p.waterDays.includes(dayIdx));
    return { date: d, dayIdx, label: i === 0 ? 'Today' : DAY_NAMES[dayIdx], dateNum: d.getDate(), plants };
  });

  return (
    <div className="w-full mx-auto p-6 pb-16">
      {/* Header */}
      <div className="hq-rise flex items-end justify-between gap-4 pt-2 pb-8" style={rise(0)}>
        <div>
          <div className="eyebrow mb-2.5">🌿 Shared Garden</div>
          <h1 className="text-[32px] font-semibold tracking-[-0.025em] leading-none text-[var(--text)]">Our Garden</h1>
          <p className="num text-[var(--text-4)] text-[12px] mt-3">
            Auto-saves · {blob.plants.length} plants
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          Add plant
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="hq-rise panel p-6 mb-8" style={rise(1)}>
          <span className="eyebrow">New plant</span>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_1fr] gap-3 mt-4 mb-3">
            <input placeholder="Plant name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
            <input placeholder="🌿" value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} className={`${inputCls} text-center text-[20px]`} />
            <select value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value as 'indoor' | 'outdoor' }))} className={inputCls}>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input placeholder="Water schedule (e.g. Sunday)" value={form.waterSchedule} onChange={e => setForm(f => ({ ...f, waterSchedule: e.target.value }))} className={inputCls} />
            <input placeholder="Image URL (optional)" value={form.img} onChange={e => setForm(f => ({ ...f, img: e.target.value }))} className={inputCls} />
          </div>
          <input placeholder="Care tip (optional)" value={form.tip} onChange={e => setForm(f => ({ ...f, tip: e.target.value }))} className={`${inputCls} w-full mb-4`} />
          <div className="flex gap-2">
            <Button variant="primary" onClick={addPlant} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : 'Add'}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Watering Calendar */}
      <div className="mb-10">
        <div className="eyebrow flex items-center gap-1.5 mb-4">
          <Droplets className="w-3.5 h-3.5" style={{ color: 'var(--up)' }} />
          Watering This Week
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(({ label, dateNum, plants }, i) => {
            const isToday = i === 0;
            return (
              <div
                key={i}
                className="rounded-[var(--r-md)] p-2.5 min-h-[90px] border transition-colors"
                style={{
                  background: isToday ? 'color-mix(in srgb, var(--up) 8%, var(--surface-1))' : 'var(--surface-1)',
                  borderColor: isToday
                    ? 'color-mix(in srgb, var(--up) 32%, transparent)'
                    : plants.length > 0 ? 'var(--line-strong)' : 'var(--line)',
                }}
              >
                <p className="eyebrow !text-[9.5px]" style={isToday ? { color: 'var(--up)' } : undefined}>{label}</p>
                <p className="num text-[18px] font-semibold text-[var(--text-2)] mt-0.5 mb-2">{dateNum}</p>
                {plants.length === 0
                  ? <p className="text-[var(--text-4)] text-[11px]">—</p>
                  : plants.map(p => (
                      <div key={p.id} className="flex items-center gap-1 mb-1">
                        <span className="text-[13px]">{p.emoji}</span>
                        <span className="text-[var(--text-2)] text-[11px] leading-tight">{p.name.split(' ')[0]}</span>
                      </div>
                    ))
                }
              </div>
            );
          })}
        </div>
      </div>

      {/* Plant grid helper */}
      {[{ title: 'Indoor', emoji: '🪴', plants: indoor }, { title: 'Outdoor', emoji: '🌳', plants: outdoor }].map(group => (
        group.plants.length === 0 ? null :
        <div key={group.title} className="mb-9">
          <div className="eyebrow mb-4">{group.emoji} {group.title}</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">
            {group.plants.map(plant => (
              <div key={plant.id} className="panel overflow-hidden">
                {plant.img && (
                  <div className="h-[120px] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={plant.img} alt={plant.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="px-3 pt-3 pb-3.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[20px]">{plant.emoji}</span>
                      <p className="font-semibold text-[14px] text-[var(--text)] mt-1 mb-0.5">{plant.name}</p>
                    </div>
                    <button
                      onClick={() => removePlant(plant.id)}
                      className="text-[var(--text-4)] hover:text-[var(--text-2)] transition-colors p-0.5 leading-none"
                      aria-label="Remove plant"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[12px] mt-1 mb-0.5 flex items-center gap-1" style={{ color: 'var(--up)' }}>
                    <Droplets className="w-3 h-3" /> {plant.waterSchedule || 'No schedule'}
                  </p>
                  {plant.tip && <p className="text-[var(--text-3)] text-[11px] mt-1 leading-relaxed">{plant.tip}</p>}
                  {plant.addedBy && <p className="text-[var(--text-4)] text-[10px] num mt-2">Added by {plant.addedBy}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
