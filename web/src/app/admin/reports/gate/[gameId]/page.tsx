'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface TicketTypeBreakdown {
  ticketTypeId: string;
  ticketType: string;
  sold: number;
  scanned: number;
  noShows: number;
}

interface GateReport {
  gameId: string;
  game: string;
  venue: string;
  gameDate: string;
  totalSold: number;
  totalScanned: number;
  noShows: number;
  invalidScans: number;
  duplicateScans: number;
  byTicketType: TicketTypeBreakdown[];
}

export default function GateReconciliationPage() {
  const router = useRouter();
  const { gameId } = useParams<{ gameId: string }>();

  const [report, setReport] = useState<GateReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

  const fetchReport = useCallback(async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) { router.replace('/admin/login'); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/admin/reports/gate/${gameId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        router.replace('/admin/login');
        return;
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      setReport(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [API_URL, gameId, router]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  async function handleExport() {
    const token = localStorage.getItem('adminToken');
    if (!token) { router.replace('/admin/login'); return; }

    setExporting(true);
    try {
      const res = await fetch(`${API_URL}/admin/reports/gate/${gameId}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        router.replace('/admin/login');
        return;
      }

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message);
      }

      const blob     = await res.blob();
      const url      = URL.createObjectURL(blob);
      const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1]
        ?? `gate-scan-log-${gameId}.csv`;

      const a = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-danger font-semibold mb-2">Failed to load report</p>
          <p className="text-sm text-offblack/50 mb-4">{error}</p>
          <button onClick={fetchReport} className="text-primary text-sm font-bold hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const scanRate = report.totalSold > 0
    ? Math.round((report.totalScanned / report.totalSold) * 100)
    : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

        {/* ── Page heading + game info ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-offblack/40 mb-1">
              Gate Reconciliation Report
            </p>
            <h1 className="text-2xl font-black text-offblack">{report.game}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-offblack/50">
              <span>
                {new Date(report.gameDate).toLocaleDateString('en-PH', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </span>
              <span className="hidden sm:inline text-offblack/20">·</span>
              <span>{report.venue}</span>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="shrink-0 flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all active:scale-[0.98]"
          >
            {exporting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
            )}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Tickets Sold"
            value={report.totalSold.toLocaleString()}
            color="bg-offblack"
          />
          <StatCard
            label="Tickets Scanned"
            value={report.totalScanned.toLocaleString()}
            sub={`${scanRate}% attendance`}
            color="bg-primary"
          />
          <StatCard
            label="No Shows"
            value={report.noShows.toLocaleString()}
            color={report.noShows > 0 ? 'bg-accent' : 'bg-offblack'}
            light={report.noShows > 0}
          />
          <StatCard
            label="Invalid Scans"
            value={report.invalidScans.toLocaleString()}
            sub="Unknown ticket IDs"
            color={report.invalidScans > 0 ? 'bg-danger' : 'bg-offblack'}
          />
          <StatCard
            label="Duplicate Scans"
            value={report.duplicateScans.toLocaleString()}
            sub="Already-used tickets"
            color={report.duplicateScans > 0 ? 'bg-danger' : 'bg-offblack'}
          />

          {/* Attendance progress */}
          <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5 flex flex-col justify-between">
            <p className="text-xs text-offblack/40 font-medium uppercase tracking-wide mb-3">
              Attendance Rate
            </p>
            <div>
              <p className="text-2xl font-black text-offblack leading-tight mb-2">{scanRate}%</p>
              <div className="w-full h-2 bg-black/8 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    scanRate >= 75 ? 'bg-primary' : scanRate >= 40 ? 'bg-accent' : 'bg-danger'
                  }`}
                  style={{ width: `${scanRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Per-ticket-type table ── */}
        <div className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-black/8">
            <h2 className="font-bold text-offblack">Breakdown by Ticket Type</h2>
            <p className="text-xs text-offblack/40 mt-0.5">
              {report.byTicketType.length} ticket type{report.byTicketType.length !== 1 ? 's' : ''}
            </p>
          </div>

          {report.byTicketType.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-offblack/40 text-sm">No ticket data available for this game.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/6 bg-offwhite/60">
                    <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">
                      Ticket Type
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">
                      Sold
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">
                      Scanned
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">
                      No Shows
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-black/5">
                  {report.byTicketType.map((row) => {
                    const rowScanRate = row.sold > 0
                      ? Math.round((row.scanned / row.sold) * 100)
                      : 0;

                    return (
                      <tr key={row.ticketTypeId} className="hover:bg-offwhite/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-offblack">{row.ticketType}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="w-20 h-1 bg-black/8 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  rowScanRate >= 75 ? 'bg-primary' : rowScanRate >= 40 ? 'bg-accent' : 'bg-danger'
                                }`}
                                style={{ width: `${rowScanRate}%` }}
                              />
                            </div>
                            <span className="text-xs text-offblack/40">{rowScanRate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-offblack">
                          {row.sold.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-primary">
                          {row.scanned.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-semibold ${row.noShows > 0 ? 'text-danger' : 'text-offblack/40'}`}>
                            {row.noShows.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals footer */}
                {report.byTicketType.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 border-black/10 bg-offwhite/60">
                      <td className="px-6 py-3 text-xs font-bold uppercase tracking-wide text-offblack/40">
                        Total
                      </td>
                      <td className="px-4 py-3 text-right font-black text-offblack">
                        {report.totalSold.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-primary">
                        {report.totalScanned.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right font-black text-danger">
                        {report.noShows.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* ── Refresh ── */}
        <div className="mt-4 text-center">
          <button
            onClick={fetchReport}
            className="text-xs text-offblack/40 hover:text-offblack transition-colors font-medium"
          >
            Refresh report
          </button>
        </div>
    </div>
  );
}

// ── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, light = false }: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  light?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-black/8 shadow-sm p-5">
      <div className={`inline-flex items-center justify-center w-2 h-2 rounded-full ${color} mb-3`} />
      <p className={`text-2xl font-black leading-tight ${light ? 'text-offblack' : 'text-offblack'}`}>
        {value}
      </p>
      <p className="text-xs text-offblack/40 font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs text-offblack/30 mt-0.5">{sub}</p>}
    </div>
  );
}
