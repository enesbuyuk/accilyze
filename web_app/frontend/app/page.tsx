'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  CloudRain,
  Clock,
  Car,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Gauge,
  Signpost,
  Building
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import dynamic from 'next/dynamic';
const MapPicker = dynamic(() => import('../components/MapPicker'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-800 animate-pulse rounded-2xl flex items-center justify-center text-slate-500">Loading Map...</div>
});

import Image from 'next/image';

export default function Home() {
  const [formData, setFormData] = useState({
    // Numerical
    num_lanes: 2,
    curvature: 0.0,
    speed_limit: 50,
    num_reported_accidents: 0,

    // Booleans
    road_signs_present: 0,
    public_road: 1,
    holiday: 0,
    school_season: 0,

    // Categorical Selections for UI (mapped to OHE later)
    weather: 'clear',      // clear, fog, rain
    lighting: 'day',       // day, dim, night
    road_type: 'urban',    // urban, rural
    time_of_day: 'day'     // day, morning, evening
  });

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    let val: any = value;
    if (type === 'number') val = Number(value);
    // For selects that mimic booleans (0/1)
    if (name === 'road_signs_present' || name === 'public_road' || name === 'holiday' || name === 'school_season') {
      val = Number(value);
    }

    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const handleLocationSelect = (data: any) => {
    setFormData(prev => ({
      ...prev,
      speed_limit: data.speed_limit,
      num_lanes: data.num_lanes,
      road_type: data.road_type,
      curvature: data.curvature,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    await new Promise(r => setTimeout(r, 500));

    try {
      // Map UI state to One-Hot Encoded Backend format
      const payload = {
        num_lanes: formData.num_lanes,
        curvature: formData.curvature,
        speed_limit: formData.speed_limit,
        num_reported_accidents: formData.num_reported_accidents,

        road_signs_present: formData.road_signs_present,
        public_road: formData.public_road,
        holiday: formData.holiday,
        school_season: formData.school_season,

        // One-Hot Logic
        road_type_rural: formData.road_type === 'rural' ? 1 : 0,
        road_type_urban: formData.road_type === 'urban' ? 1 : 0,

        lighting_dim: formData.lighting === 'dim' ? 1 : 0,
        lighting_night: formData.lighting === 'night' ? 1 : 0,

        weather_foggy: formData.weather === 'fog' ? 1 : 0,
        weather_rainy: formData.weather === 'rain' ? 1 : 0,

        time_of_day_evening: formData.time_of_day === 'evening' ? 1 : 0,
        time_of_day_morning: formData.time_of_day === 'morning' ? 1 : 0
      };

      const response = await fetch(process.env.NEXT_PUBLIC_API_URL + '/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.detail || 'Failed to fetch prediction');
      }

      const data = await response.json();
      setResult(data.prediction);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getRiskBg = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'high': return 'bg-rose-500/10 border-rose-200';
      case 'medium': return 'bg-amber-500/10 border-amber-200';
      case 'low': return 'bg-emerald-500/10 border-emerald-200';
      default: return 'bg-gray-100 border-gray-200';
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-6 flex justify-center py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-7xl"
      >
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo.png"
              alt="Road Risk AI Logo"
              width={360}
              height={360}
              className="drop-shadow-2xl"
            />
          </div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-orange-300">
            Accident Risk AI
          </h1>
          <p className="text-slate-400 mt-2">Enter road conditions or select on map to predict safety score.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* MAP SECTION */}
          <div className="lg:col-span-3 h-[500px] lg:h-auto min-h-[500px]">
            <MapPicker onLocationSelect={handleLocationSelect} />
          </div>

          {/* FORM SECTION */}
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Section 1: Road Stats */}
              <div>
                <h3 className="text-lg font-semibold text-rose-300 mb-4 flex items-center gap-2">
                  <Gauge className="w-5 h-5" /> Road Statistics
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Speed Limit (km/h)</label>
                    <input type="number" name="speed_limit" value={formData.speed_limit} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 outline-none focus:border-rose-500" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Num Lanes</label>
                    <input type="number" name="num_lanes" value={formData.num_lanes} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 outline-none focus:border-rose-500" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Curvature (0-1)</label>
                    <input type="number" step="0.000000001" max="1" min="0" name="curvature" value={formData.curvature} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 outline-none focus:border-rose-500" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Hist. Accidents</label>
                    <input type="number" name="num_reported_accidents" value={formData.num_reported_accidents} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 outline-none focus:border-rose-500" required />
                  </div>
                </div>
              </div>

              {/* Section 2: Environment */}
              <div>
                <h3 className="text-lg font-semibold text-rose-300 mb-4 flex items-center gap-2 mt-4">
                  <CloudRain className="w-5 h-5" /> Environment
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Weather</label>
                    <select name="weather" value={formData.weather} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 outline-none focus:border-rose-500">
                      <option value="clear">Clear</option>
                      <option value="rain">Rainy</option>
                      <option value="fog">Foggy</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Lighting</label>
                    <select name="lighting" value={formData.lighting} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 outline-none focus:border-rose-500">
                      <option value="day">Daylight</option>
                      <option value="dim">Dim</option>
                      <option value="night">Night</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Time of Day</label>
                    <select name="time_of_day" value={formData.time_of_day} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 outline-none focus:border-rose-500">
                      <option value="day">Day</option>
                      <option value="morning">Morning</option>
                      <option value="evening">Evening</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Road Type</label>
                    <select name="road_type" value={formData.road_type} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 outline-none focus:border-rose-500">
                      <option value="urban">Urban</option>
                      <option value="rural">Rural</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Context Flags */}
              <div>
                <h3 className="text-lg font-semibold text-rose-300 mb-4 flex items-center gap-2 mt-4">
                  <Signpost className="w-5 h-5" /> Context
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { k: 'road_signs_present', l: 'Signs' },
                    { k: 'public_road', l: 'Public' },
                    { k: 'holiday', l: 'Holiday' },
                    { k: 'school_season', l: 'School' }
                  ].map(({ k, l }) => (
                    <div key={k} className="flex items-center gap-2 bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 bg-slate-700 border-slate-600"
                        checked={!!(formData as any)[k]}
                        onChange={(e) => setFormData(p => ({ ...p, [k]: e.target.checked ? 1 : 0 }))}
                      />
                      <label className="text-sm text-slate-300">{l}</label>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full py-4 rounded-xl bg-rose-500 hover:bg-rose-400 hover:cursor-pointer font-bold transition-all disabled:opacity-50">
                {loading ? 'Analyzing...' : 'Predict Risk Score'}
              </button>
            </form>
          </div>

          {/* RESULT SECTION */}
          <div className="lg:col-span-5 space-y-4">
            <AnimatePresence>
              {result ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn("p-6 rounded-2xl border backdrop-blur-md h-full flex flex-col justify-center items-center text-center", getRiskBg(result.risk_level))}
                >
                  <div className="mb-4">
                    {result.risk_level === 'High' ? <AlertTriangle className="w-16 h-16 text-rose-500" /> :
                      result.risk_level === 'Medium' ? <AlertTriangle className="w-16 h-16 text-amber-500" /> :
                        <ShieldCheck className="w-16 h-16 text-emerald-500" />}
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">{result.risk_level} Risk</h2>
                  <div className="text-6xl font-black text-white my-4">
                    {(result.risk_score * 100).toFixed(0)}%
                  </div>
                  <p className="text-sm text-gray-200">Based on XGBoost Analysis</p>
                </motion.div>
              ) : (
                <div className="h-full border border-white/10 rounded-2xl bg-white/5 flex flex-col items-center justify-center text-slate-500 p-8 text-center border-dashed">
                  <Activity className="w-12 h-12 mb-2 opacity-50" />
                  <p>Fill the form to see AI prediction.</p>
                </div>
              )}
            </AnimatePresence>

            {error && (
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </main>
  );
}
