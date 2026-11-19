
'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Milk = {
  id: number
  name: string
}

type Summary = {
  opening: number
  purchased: number
  returned: number
  online: number
  offline: number
  wastage: number
  expected: number
  onlineSales: number
  offlineSales: number
  received: number
  pending: number
  expenses: number
}

const emptySummary: Summary = {
  opening: 0,
  purchased: 0,
  returned: 0,
  online: 0,
  offline: 0,
  wastage: 0,
  expected: 0,
  onlineSales: 0,
  offlineSales: 0,
  received: 0,
  pending: 0,
  expenses: 0,
}


function money(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function litres(value: number) {
  return `${(value || 0).toFixed(2)} L`
}

function Card({
  title,
  value,
  note,
  color = 'text-slate-900',
}: {
  title: string
  value: string
  note?: string
  color?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary>(emptySummary)
  const [milks, setMilks] = useState<Milk[]>([])
  const [stockRows, setStockRows] = useState<
    { name: string; opening: number; purchased: number; returned: number;
      online: number; offline: number; wastage: number; expected: number }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [date, setDate] = useState('')
  const [openingQty, setOpeningQty] = useState<Record<number, string>>({})
  const [savingOpening, setSavingOpening] = useState(false)
  const [openingMessage, setOpeningMessage] = useState('')

  const loadDashboard = useCallback(async () => {
    if (!date) return
    setLoading(true)
    setError('')

    try {
      const [
        milkResult,
        openingResult,
        inventoryResult,
        salesResult,
        deliveryResult,
        paymentResult,
        expenseResult,
        closingResult,
      ] = await Promise.all([
        supabase.from('milk_types').select('id,name').eq('active', true).order('id'),
        supabase.from('daily_opening_stock').select('milk_type_id,qty').eq('business_date', date),
        supabase.from('inventory_transactions')
          .select('milk_type_id,category,qty')
          .eq('txn_date', date),
        supabase.from('offline_sales').select('total,milk_type_id,qty').eq('business_date', date),
        supabase.from('delivery_records')
          .select('milk_type_id,actual_qty,unit_price,status')
          .eq('delivery_date', date),
        supabase.from('payments').select('amount').eq('business_date', date),
        supabase.from('expenses').select('amount').eq('expense_date', date),
        supabase.from('daily_closing_stock')
          .select('status')
          .eq('business_date', date)
          .maybeSingle(),
      ])

      const results = [
        milkResult, openingResult, inventoryResult, salesResult,
        deliveryResult, paymentResult, expenseResult, closingResult,
      ]

      const failed = results.find((result) => result.error)
      if (failed?.error) throw new Error(failed.error.message)

      const milkData = (milkResult.data || []) as Milk[]
      const openingData = openingResult.data || []
      const inventoryData = inventoryResult.data || []
      const salesData = salesResult.data || []
      const deliveryData = deliveryResult.data || []
      const paymentData = paymentResult.data || []
      const expenseData = expenseResult.data || []

      setMilks(milkData)

      const openingInputs: Record<number, string> = {}
      for (const milk of milkData) {
        const existing = openingData.find(
          (x) => x.milk_type_id === milk.id
        )
        openingInputs[milk.id] =
          existing ? String(existing.qty) : ''
      }
      setOpeningQty(openingInputs)

      const rows = milkData.map((milk) => {
        const opening = openingData
          .filter((x) => x.milk_type_id === milk.id)
          .reduce((sum, x) => sum + Number(x.qty || 0), 0)

        const transactions = inventoryData.filter(
          (x) => x.milk_type_id === milk.id
        )

        const quantity = (category: string) =>
          transactions
            .filter((x) => x.category === category)
            .reduce((sum, x) => sum + Number(x.qty || 0), 0)

        const purchased = quantity('purchase')
        const returned = quantity('return')
        const adjustment = quantity('adjustment')
        const online = quantity('online_delivery')
        const offline = quantity('offline_sale')
        const wastage = quantity('wastage') + quantity('leakage')

        const expected =
          opening + purchased + returned + adjustment -
          online - offline - wastage

        return {
          name: milk.name,
          opening,
          purchased,
          returned,
          online,
          offline,
          wastage,
          expected,
        }
      })

      setStockRows(rows)

      const onlineSales = deliveryData.reduce(
        (sum, x) =>
          sum + Number(x.actual_qty || 0) * Number(x.unit_price || 0),
        0
      )

      const offlineSales = salesData.reduce(
        (sum, x) => sum + Number(x.total || 0),
        0
      )

      const received = paymentData.reduce(
        (sum, x) => sum + Number(x.amount || 0),
        0
      )

      const expenses = expenseData.reduce(
        (sum, x) => sum + Number(x.amount || 0),
        0
      )

      const totalSales = onlineSales + offlineSales

      const nextSummary: Summary = {
        opening: rows.reduce((s, x) => s + x.opening, 0),
        purchased: rows.reduce((s, x) => s + x.purchased, 0),
        returned: rows.reduce((s, x) => s + x.returned, 0),
        online: rows.reduce((s, x) => s + x.online, 0),
        offline: rows.reduce((s, x) => s + x.offline, 0),
        wastage: rows.reduce((s, x) => s + x.wastage, 0),
        expected: rows.reduce((s, x) => s + x.expected, 0),
        onlineSales,
        offlineSales,
        received,
        pending: Math.max(totalSales - received, 0),
        expenses,
      }

      setSummary(nextSummary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [date])

  async function saveOpeningStock() {
    if (!date) return

    const entries = milks
      .filter((milk) => openingQty[milk.id] !== undefined &&
        openingQty[milk.id].trim() !== '')
      .map((milk) => ({
        business_date: date,
        milk_type_id: milk.id,
        qty: Number(openingQty[milk.id]),
      }))

    if (entries.length === 0) {
      setOpeningMessage('Enter at least one milk quantity.')
      return
    }

    if (entries.some((entry) =>
      !Number.isFinite(entry.qty) || entry.qty < 0
    )) {
      setOpeningMessage('Enter valid quantities. Negative values are not allowed.')
      return
    }

    setSavingOpening(true)
    setOpeningMessage('')
    setError('')

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError) throw authError
      if (!authData.user) throw new Error('Please login again.')

      const { error: saveError } = await supabase
        .from('daily_opening_stock')
        .upsert(entries, {
          onConflict: 'business_date,milk_type_id',
        })

      if (saveError) throw saveError

      setOpeningMessage('Opening stock saved successfully.')
      await loadDashboard()
    } catch (err) {
      setOpeningMessage(
        err instanceof Error ? err.message : 'Unable to save opening stock.'
      )
    } finally {
      setSavingOpening(false)
    }
  }

  useEffect(() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setDate(`${year}-${month}-${day}`)
  }, [])

  useEffect(() => {
    if (date) loadDashboard()
  }, [date, loadDashboard])

  

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-green-700">SMART MILK SHOP</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Daily business overview
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
            <button
              onClick={loadDashboard}
              disabled={loading}
              className="rounded-lg bg-green-800 px-4 py-2 font-semibold text-white hover:bg-green-900 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/'
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium"
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <b>Dashboard error:</b> {error}
            <p className="mt-1">
              Check Supabase RLS permissions and table access.
            </p>
          </div>
        )}

        {loading ? (
          <div className="mt-10 rounded-xl bg-white p-8 text-center text-slate-500">
            Loading dashboard data...
          </div>
        ) : (
          <>
            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold">Opening Stock Entry</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter starting milk quantity for {date}.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {milks.map((milk) => (
                  <label key={milk.id} className="block">
                    <span className="mb-1 block text-sm font-medium">
                      {milk.name} (Litres)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingQty[milk.id] ?? ''}
                      onChange={(e) => {
                        setOpeningQty((current) => ({
                          ...current,
                          [milk.id]: e.target.value,
                        }))
                        setOpeningMessage('')
                      }}
                      placeholder="Enter litres"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveOpeningStock}
                  disabled={savingOpening || milks.length === 0}
                  className="rounded-lg bg-green-800 px-5 py-2 font-semibold text-white hover:bg-green-900 disabled:opacity-50"
                >
                  {savingOpening ? 'Saving...' : 'Save Opening Stock'}
                </button>
                {openingMessage && (
                  <p className="text-sm text-slate-600">{openingMessage}</p>
                )}
              </div>
            </section>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Milk inventory</h2>
              <span className="text-sm text-slate-500">{date}</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card title="Opening stock" value={litres(summary.opening)} />
              <Card title="Milk purchased" value={litres(summary.purchased)} />
              <Card title="Customer returns" value={litres(summary.returned)} />
              <Card title="Expected stock" value={litres(summary.expected)} color="text-green-700" />
              <Card title="Online delivered" value={litres(summary.online)} />
              <Card title="Offline sold" value={litres(summary.offline)} />
              <Card title="Wastage / leakage" value={litres(summary.wastage)} color="text-orange-600" />
            </div>

            <h2 className="mt-8 text-lg font-bold">Money overview</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card title="Online sales" value={money(summary.onlineSales)} />
              <Card title="Offline sales" value={money(summary.offlineSales)} />
              <Card title="Total expected" value={money(summary.onlineSales + summary.offlineSales)} />
              <Card title="Amount received" value={money(summary.received)} color="text-green-700" />
              <Card title="Pending payments" value={money(summary.pending)} color="text-orange-600" />
              <Card title="Today's expenses" value={money(summary.expenses)} />
              <Card title="Net collection" value={money(summary.received - summary.expenses)} color="text-green-700" />
            </div>

            <h2 className="mt-8 text-lg font-bold">Milk-wise stock details</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-green-50 text-slate-700">
                  <tr>
                    <th className="p-3">Milk type</th>
                    <th className="p-3">Opening</th>
                    <th className="p-3">Purchased</th>
                    <th className="p-3">Returned</th>
                    <th className="p-3">Online</th>
                    <th className="p-3">Offline</th>
                    <th className="p-3">Wastage</th>
                    <th className="p-3">Expected</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((row) => (
                    <tr key={row.name} className="border-t border-slate-100">
                      <td className="p-3 font-semibold">{row.name}</td>
                      <td className="p-3">{litres(row.opening)}</td>
                      <td className="p-3">{litres(row.purchased)}</td>
                      <td className="p-3">{litres(row.returned)}</td>
                      <td className="p-3">{litres(row.online)}</td>
                      <td className="p-3">{litres(row.offline)}</td>
                      <td className="p-3">{litres(row.wastage)}</td>
                      <td className="p-3 font-bold text-green-700">{litres(row.expected)}</td>
                    </tr>
                  ))}
                  {stockRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500">
                        No active milk types found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <p>
                <b>Note:</b> Stock values are calculated from opening stock
                and inventory transactions for the selected date.
              </p>
              <p className="mt-1">
                Payments are total payments recorded for this date. Pending
                is an estimated daily difference and may need adjustment
                when old customer balances are collected.
              </p>
              <p className="mt-1">
                {milks.length} active milk type(s) loaded from Supabase.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

