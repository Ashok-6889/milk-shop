
'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminSupabase } from '@/lib/supabase'

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
    { id: number; name: string; opening: number; purchased: number; returned: number;
      online: number; offline: number; wastage: number; expected: number;
      orderCount: number; orderAmount: number; onlineOrdered: number }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [date, setDate] = useState('')
  const [openingQty, setOpeningQty] = useState<Record<number, string>>({})
  const [savingOpening, setSavingOpening] = useState(false)
  const [openingMessage, setOpeningMessage] = useState('')
  const [pendingResetMilk, setPendingResetMilk] = useState<number | null>(null)
  const [purchaseMilkId, setPurchaseMilkId] = useState('')
  const [purchaseQty, setPurchaseQty] = useState('')
  const [purchaseUnitCost, setPurchaseUnitCost] = useState('')
  const [purchaseNotes, setPurchaseNotes] = useState('')
  const [savingPurchase, setSavingPurchase] = useState(false)
  const [purchaseMessage, setPurchaseMessage] = useState('')
  const [purchaseRows, setPurchaseRows] = useState<any[]>([])

  const [pendingOrderCount, setPendingOrderCount] = useState(0)
  const [orderNotice, setOrderNotice] = useState('')
  const [adminOrders, setAdminOrders] = useState<any[]>([])
  const [showOnlineOrders, setShowOnlineOrders] = useState(false)
  const [showPendingOrders, setShowPendingOrders] = useState(false)
  const [adminWalletBalance, setAdminWalletBalance] = useState(0)
  const [showWalletTransactions, setShowWalletTransactions] = useState(false)
  const [showCreditWalletPanel, setShowCreditWalletPanel] = useState(false)
  const [adminWalletTransactions, setAdminWalletTransactions] = useState<any[]>([])
  const [adminCustomers, setAdminCustomers] = useState<any[]>([])
  const [creditCustomerId, setCreditCustomerId] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [creditNote, setCreditNote] = useState('')
  const [creditBusy, setCreditBusy] = useState(false)
  const [adminDataLoading, setAdminDataLoading] = useState(false)
  const [adminDataError, setAdminDataError] = useState('')
  const [statusBusyId, setStatusBusyId] = useState('')
  const [deliveryRows, setDeliveryRows] = useState<any[]>([])
  const [deliveryQty, setDeliveryQty] = useState<Record<string, string>>({})
  const [deliveryBusyId, setDeliveryBusyId] = useState('')
  const [deliveryMessage, setDeliveryMessage] = useState('')


  const loadDashboard = useCallback(async (showLoader = true, refreshInputs = true) => {
    if (!date) return
    if (showLoader) setLoading(true)
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
        ordersResult,
      ] = await Promise.all([
        adminSupabase.from('milk_types').select('id,name').eq('active', true).order('id'),
        adminSupabase.from('daily_opening_stock').select('milk_type_id,qty').eq('business_date', date),
        adminSupabase.from('inventory_transactions')
          .select('id,milk_type_id,category,qty,txn_time,unit_cost,notes')
          .eq('txn_date', date),
        adminSupabase.from('offline_sales').select('total,milk_type_id,qty').eq('business_date', date),
        adminSupabase.from('delivery_records')
          .select('id,customer_id,milk_type_id,delivery_date,scheduled_qty,actual_qty,unit_price,status,notes,customer:profiles!delivery_records_customer_id_fkey(full_name,mobile)')
          .eq('delivery_date', date)
          .order('status')
          .order('id'),
        adminSupabase.from('payments').select('amount').eq('business_date', date),
        adminSupabase.from('expenses').select('amount').eq('expense_date', date),
        adminSupabase.from('daily_closing_stock')
          .select('status')
          .eq('business_date', date)
          .maybeSingle(),
        adminSupabase.from('orders')
          .select('id,status,delivery_date')
          .eq('delivery_date', date)
          .neq('status', 'cancelled'),
      ])

      const results = [
        milkResult, openingResult, inventoryResult, salesResult,
        deliveryResult, paymentResult, expenseResult, closingResult, ordersResult,
      ]

      const failed = results.find((result) => result.error)
      if (failed?.error) throw new Error(failed.error.message)

      const milkData = (milkResult.data || []) as Milk[]
      const openingData = openingResult.data || []
      const inventoryData = inventoryResult.data || []
      setPurchaseRows(
        inventoryData
          .filter((x: any) => x.category === 'purchase')
          .sort((a: any, b: any) =>
            new Date(b.txn_time).getTime() - new Date(a.txn_time).getTime()
          )
      )

      const salesData = salesResult.data || []
      const deliveryData = deliveryResult.data || []
      setDeliveryRows(deliveryData)
      setDeliveryQty((current) => {
        const next = { ...current }
        for (const row of deliveryData) {
          if (next[row.id] === undefined) {
            next[row.id] = row.actual_qty == null ? '' : String(row.actual_qty)
          }
        }
        return next
      })
      const paymentData = paymentResult.data || []
      const expenseData = expenseResult.data || []
      const orderIds = (ordersResult.data || []).map((order: any) => order.id)
      const deliveredOrderIds = new Set(
        (ordersResult.data || [])
          .filter((order: any) => order.status === 'delivered')
          .map((order: any) => String(order.id))
      )
      let orderItemsData: any[] = []

      if (orderIds.length > 0) {
        const { data, error: orderItemsError } = await adminSupabase
          .from('order_items')
          .select('id,order_id,milk_type_id,qty,unit_price,line_total')
          .in('order_id', orderIds)

        if (orderItemsError) throw new Error(orderItemsError.message)
        orderItemsData = data || []
      }

      const orderStats = new Map<number, { ids: Set<string>; amount: number; qty: number; deliveredQty: number }>()
      for (const item of orderItemsData) {
        const milkId = Number(item.milk_type_id)
        if (!orderStats.has(milkId)) {
          orderStats.set(milkId, { ids: new Set<string>(), amount: 0, qty: 0, deliveredQty: 0 })
        }
        const stat = orderStats.get(milkId)!
        stat.ids.add(String(item.order_id))
        stat.amount += Number(item.line_total || 0)
        stat.qty += Number(item.qty || 0)
        if (deliveredOrderIds.has(String(item.order_id))) {
          stat.deliveredQty += Number(item.qty || 0)
        }
      }

      setMilks(milkData)

      const openingInputs: Record<number, string> = {}
      for (const milk of milkData) {
        const existing = openingData.find(
          (x) => x.milk_type_id === milk.id
        )
        openingInputs[milk.id] =
          existing ? String(existing.qty) : ''
      }
      if (refreshInputs) setOpeningQty(openingInputs)

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
        const orderStat = orderStats.get(milk.id)
        const online = orderStat?.deliveredQty || 0
        const offline = quantity('offline_sale')
        const wastage = quantity('wastage') + quantity('leakage')

        const expected =
          opening + purchased + returned + adjustment -
          online - offline - wastage

        return {
          id: milk.id,
          name: milk.name,
          opening,
          purchased,
          onlineOrdered: orderStat?.qty || 0,
          returned,
          online,
          offline,
          wastage,
          expected,
          orderCount: orderStat?.ids.size || 0,
          orderAmount: orderStat?.amount || 0,
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
      if (showLoader) setLoading(false)
    }
  }, [date])

  async function saveDeliveryRecord(record: any) {
    const qtyText = deliveryQty[record.id] ?? ''
    const qty = Number(qtyText)
    const scheduled = Number(record.scheduled_qty || 0)

    if (qtyText.trim() === '' || !Number.isFinite(qty) || qty < 0 || qty > scheduled) {
      setDeliveryMessage(`Enter actual litres between 0 and ${scheduled}.`)
      return
    }

    const status = qty >= scheduled ? 'delivered' : qty > 0 ? 'partially_delivered' : 'pending'

    setDeliveryBusyId(record.id)
    setDeliveryMessage('')

    try {
      const { error } = await adminSupabase
        .from('delivery_records')
        .update({
          actual_qty: qty,
          status,
        })
        .eq('id', record.id)

      if (error) throw error

      setDeliveryMessage('Delivery updated successfully.')
      await loadDashboard(false, false)
    } catch (err) {
      setDeliveryMessage(
        err instanceof Error ? err.message : 'Unable to update delivery.'
      )
    } finally {
      setDeliveryBusyId('')
    }
  }

  async function saveOpeningStock(milkId: number) {
    if (!date) return

    const qtyText = openingQty[milkId] ?? ''
    const entries = qtyText.trim() === '' ? [] : [{
      business_date: date,
      milk_type_id: milkId,
      qty: Number(qtyText),
    }]

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
        await adminSupabase.auth.getUser()

      if (authError) throw authError
      if (!authData.user) throw new Error('Please login again.')

      const { error: saveError } = await adminSupabase
        .rpc('admin_add_opening_stock', {
          p_business_date: date,
          p_milk_type_id: milkId,
          p_qty: Number(qtyText),
        })

      if (saveError) throw saveError

      setOpeningQty((current) => ({ ...current, [milkId]: '' }))
      setOpeningMessage('Opening stock saved successfully.')
      await loadDashboard(false, false)
    } catch (err) {
      const details = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as any).message)
          : JSON.stringify(err)
      setOpeningMessage(`Unable to save opening stock: ${details}`)
    } finally {
      setSavingOpening(false)
    }
  }


  async function resetOpeningStock(milkId: number) {
    if (!date) return

    const milkName = stockRows.find((row) => row.id === milkId)?.name || 'Milk'

    setSavingOpening(true)
    setOpeningMessage('')
    setError('')

    try {
      const { error: resetError } = await adminSupabase.rpc(
        'admin_reset_opening_stock',
        {
          p_business_date: date,
          p_milk_type_id: milkId,
        }
      )

      if (resetError) throw resetError

      setOpeningQty((current) => ({ ...current, [milkId]: '' }))
      setOpeningMessage(`${milkName} opening stock reset to 0 for ${date}.`)
      await loadDashboard(false, false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setOpeningMessage(`Unable to reset opening stock: ${message}`)
    } finally {
      setSavingOpening(false)
    }
  }


  async function saveMilkPurchase() {
    const milkId = Number(purchaseMilkId)
    const qty = Number(purchaseQty)
    const unitCost = purchaseUnitCost.trim() === ''
      ? null
      : Number(purchaseUnitCost)

    if (!date || !milkId || !Number.isFinite(qty) || qty <= 0) {
      setPurchaseMessage('Select milk type and enter a valid quantity greater than zero.')
      return
    }

    if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
      setPurchaseMessage('Enter a valid unit cost or leave it empty.')
      return
    }

    setSavingPurchase(true)
    setPurchaseMessage('')
    try {
      const { data: authData, error: authError } =
        await adminSupabase.auth.getUser()
      if (authError) throw authError
      if (!authData.user) throw new Error('Admin session not found. Please login again.')

      const { error: insertError } = await adminSupabase
        .from('inventory_transactions')
        .insert({
          idempotency_key: crypto.randomUUID(),
          txn_date: date,
          milk_type_id: milkId,
          category: 'purchase',
          qty,
          unit_cost: unitCost,
          notes: purchaseNotes.trim() || null,
          recorded_by: authData.user.id,
        })

      if (insertError) throw insertError

      setPurchaseQty('')
      setPurchaseUnitCost('')
      setPurchaseNotes('')
      setPurchaseMessage('Milk purchase saved successfully.')
      await loadDashboard()
    } catch (err) {
      setPurchaseMessage(
        err instanceof Error ? err.message : 'Unable to save milk purchase.'
      )
    } finally {
      setSavingPurchase(false)
    }
  }

  async function loadAdminData() {
    setAdminDataLoading(true)
    setAdminDataError('')

    try {
      const { data: authData, error: authError } = await adminSupabase.auth.getUser()
      if (authError) throw authError
      if (!authData.user) throw new Error('Please login again.')

      const [walletResult, ordersResult, customersResult] = await Promise.all([
        adminSupabase.from('wallet_accounts')
          .select('id, balance')
          .eq('owner_id', authData.user.id)
          .eq('account_type', 'admin')
          .maybeSingle(),
        adminSupabase.from('orders')
          .select('id, order_number, customer_id, address_id, delivery_date, schedule_end_date, schedule_type, status, payment_status, payment_method, subtotal, total_amount, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
        adminSupabase.from('profiles')
          .select('id, full_name, mobile, email')
          .eq('role', 'customer')
          .order('full_name'),
      ])

      if (walletResult.error) throw walletResult.error
      if (ordersResult.error) throw ordersResult.error
      if (customersResult.error) throw customersResult.error

      setAdminWalletBalance(Number(walletResult.data?.balance || 0))
      setAdminCustomers(customersResult.data || [])

      const orders = ordersResult.data || []
      const customerIds = [...new Set(orders.map((o: any) => o.customer_id).filter(Boolean))]
      const addressIds = [...new Set(orders.map((o: any) => o.address_id).filter(Boolean))]
      const orderIds = orders.map((o: any) => o.id)

      const [profilesResult, addressesResult, itemsResult, txResult] = await Promise.all([
        customerIds.length
          ? adminSupabase.from('profiles').select('id, full_name, mobile, email').in('id', customerIds)
          : Promise.resolve({ data: [], error: null } as any),
        addressIds.length
          ? adminSupabase.from('customer_addresses')
              .select('id, recipient_name, mobile, house_no, street, area, landmark, city, state, pincode, latitude, longitude')
              .in('id', addressIds)
          : Promise.resolve({ data: [], error: null } as any),
        orderIds.length
          ? adminSupabase.from('order_items')
              .select('id, order_id, milk_type_id, qty, unit_price, line_total')
              .in('order_id', orderIds)
          : Promise.resolve({ data: [], error: null } as any),
        walletResult.data?.id
          ? adminSupabase.from('wallet_transactions')
              .select('id, entry_type, amount, balance_after, description, created_at')
              .eq('wallet_id', walletResult.data.id)
              .order('created_at', { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [], error: null } as any),
      ])

      if (txResult.error) throw txResult.error

      const milkIds = [...new Set((itemsResult.data || []).map((i: any) => i.milk_type_id))]
      const milkResult = milkIds.length
        ? await adminSupabase.from('milk_types').select('id, name').in('id', milkIds)
        : { data: [], error: null } as any

      const profileMap = new Map((profilesResult.data || []).map((p: any) => [p.id, p]))
      const addressMap = new Map((addressesResult.data || []).map((x: any) => [x.id, x]))
      const milkMap = new Map<number, any>((milkResult.data || []).map((x: any) => [Number(x.id), x]))

      setAdminOrders(orders.map((order: any) => ({
        ...order,
        customer: profileMap.get(order.customer_id) || null,
        address: addressMap.get(order.address_id) || null,
        items: (itemsResult.data || [])
          .filter((item: any) => item.order_id === order.id)
          .map((item: any) => ({
            ...item,
            milk_name: milkMap.get(item.milk_type_id)?.name || `Milk #${item.milk_type_id}`,
          })),
      })))

      setAdminWalletTransactions(txResult.data || [])
    } catch (err) {
      setAdminDataError(err instanceof Error ? err.message : 'Unable to load orders and wallet.')
    } finally {
      setAdminDataLoading(false)
    }
  }

  async function updateAdminOrderStatus(orderId: string, status: string) {
    if (status === 'cancelled' && !window.confirm('Cancel this order? Any eligible wallet payment will be refunded.')) {
      return
    }

    setStatusBusyId(orderId)
    setAdminDataError('')

    const { data: authCheck, error: authCheckError } = await adminSupabase.auth.getUser()
    if (authCheckError || !authCheck.user) {
      setStatusBusyId('')
      setAdminDataError('Session check failed. Please logout and login again.')
      return
    }

    const { data: profileCheck, error: profileCheckError } = await adminSupabase
      .from('profiles')
      .select('role,email')
      .eq('id', authCheck.user.id)
      .maybeSingle()

    if (profileCheckError || profileCheck?.role !== 'admin') {
      setStatusBusyId('')
      setAdminDataError(
        `Admin session mismatch. Login: ${authCheck.user.email || 'unknown'} | Profile email: ${profileCheck?.email || 'not found'} | Role: ${profileCheck?.role || 'not found'} | User ID: ${authCheck.user.id}`
      )
      return
    }

    const { error: statusError } = await adminSupabase.rpc('admin_set_order_status', {
      p_order_id: orderId,
      p_status: status,
    })
    setStatusBusyId('')

    if (statusError) {
      setAdminDataError(
        `${statusError.message} | Verified admin: ${profileCheck.email || authCheck.user.email} | User ID: ${authCheck.user.id}`
      )
      return
    }

    await loadAdminData()
    await loadDashboard()
  }

  async function creditCustomerWallet() {
    const amount = Number(creditAmount)
    if (!creditCustomerId || !Number.isFinite(amount) || amount <= 0) {
      setAdminDataError('Select a customer and enter a valid amount.')
      return
    }

    if (!window.confirm(`Credit ₹${amount.toFixed(2)} to this customer wallet? Confirm only after receiving the actual payment.`)) {
      return
    }

    setCreditBusy(true)
    setAdminDataError('')

    const { data: authCheck, error: authCheckError } = await adminSupabase.auth.getUser()
    if (authCheckError || !authCheck.user) {
      setCreditBusy(false)
      setAdminDataError('Session check failed. Please logout and login again.')
      return
    }

    const { data: roleCheck, error: roleCheckError } = await adminSupabase
      .from('profiles')
      .select('role, email')
      .eq('id', authCheck.user.id)
      .maybeSingle()

    if (roleCheckError || roleCheck?.role !== 'admin') {
      setCreditBusy(false)
      setAdminDataError(
        `Admin session mismatch. Login: ${authCheck.user.email || 'unknown'} | Profile email: ${roleCheck?.email || 'not found'} | Role: ${roleCheck?.role || 'not found'} | User ID: ${authCheck.user.id}`
      )
      return
    }

    const { error: creditError } = await adminSupabase.rpc('admin_credit_customer_wallet', {
      p_customer_id: creditCustomerId,
      p_amount: amount,
      p_note: creditNote.trim() || 'Admin wallet credit',
    })
    setCreditBusy(false)

    if (creditError) {
      setAdminDataError(
        `${creditError.message} | Verified admin: ${roleCheck.email} | User ID: ${authCheck.user.id}`
      )
      return
    }

    setCreditAmount('')
    setCreditNote('')
    await loadAdminData()
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

  useEffect(() => {
    void loadAdminData()
  }, [])

  

  useEffect(() => {
    let active = true
    let refreshTimer: ReturnType<typeof setTimeout> | undefined

    const refreshPendingOrders = async () => {
      const { count, error } = await adminSupabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (!error && active) setPendingOrderCount(count || 0)
      else if (error) console.error('Pending orders refresh failed:', error.message)
    }

    const refreshDashboardData = () => {
      if (!active) return
      if (refreshTimer) clearTimeout(refreshTimer)

      refreshTimer = setTimeout(() => {
        if (!active) return
        void refreshPendingOrders()
        void loadAdminData()
        void loadDashboard(false, false)
      }, 700)
    }

    void refreshPendingOrders()
    void loadAdminData()

    const channel = adminSupabase
      .channel('admin-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        refreshDashboardData()

        if (payload.eventType === 'INSERT') {
          const order = payload.new as { order_number?: string }
          setOrderNotice(
            order.order_number
              ? `New order received: ${order.order_number}`
              : 'New customer order received!'
          )
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, refreshDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_transactions' }, refreshDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_opening_stock' }, refreshDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_accounts' }, refreshDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions' }, refreshDashboardData)
      .subscribe((status, error) => {
        console.log('Admin Realtime status:', status, error || '')
      })

    return () => {
      active = false
      if (refreshTimer) clearTimeout(refreshTimer)
      void adminSupabase.removeChannel(channel)
    }
  }, [loadDashboard])

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
              onClick={() => loadDashboard()}
              disabled={loading}
              className="rounded-lg bg-green-800 px-4 py-2 font-semibold text-white hover:bg-green-900 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              onClick={async () => {
                await adminSupabase.auth.signOut()
                window.location.href = '/'
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium"
            >
              Logout
            </button>
          </div>
        </div>

                  {orderNotice && (
            <div className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <span><b>New order alert:</b> {orderNotice}</span>
              <button
                onClick={() => setOrderNotice('')}
                className="font-bold"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}

        <section className="mt-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

            <button
              type="button"
              onClick={() => setShowPendingOrders((v) => !v)}
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left transition hover:shadow-md"
            >
              <div className="flex flex-col items-center gap-2 text-amber-800">
                <span className="text-3xl">⏳</span>
                <span className="font-bold">Pending Orders</span>
                <span className="text-xs">{pendingOrderCount} pending · {showPendingOrders ? 'Hide' : 'View'}</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setShowOnlineOrders((v) => !v)}
              className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left transition hover:shadow-md"
            >
              <div className="flex flex-col items-center gap-2 text-blue-800">
                <span className="text-3xl">🛒</span>
                <span className="font-bold">Online Orders</span>
                <span className="text-xs">{adminOrders.length} orders · {showOnlineOrders ? 'Hide' : 'View'}</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setShowWalletTransactions((v) => !v)}
              className="rounded-xl border border-green-200 bg-green-50 p-4 text-left transition hover:shadow-md"
            >
              <div className="flex flex-col items-center gap-2 text-green-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="6" width="18" height="15" rx="2"/>
                  <path d="M3 10h18M16 15h2M7 6V4a2 2 0 0 1 2-2h8"/>
                </svg>
                <span className="font-bold">Shop Wallet</span>
                <span className="text-xs">{showWalletTransactions ? 'Hide details' : 'View balance'}</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setShowCreditWalletPanel((v) => !v)}
              className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-left transition hover:shadow-md"
            >
              <div className="flex flex-col items-center gap-2 text-purple-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 8v8M8 12h8"/>
                </svg>
                <span className="font-bold">Credit Wallet</span>
                <span className="text-xs">{showCreditWalletPanel ? 'Hide form' : 'Add credit'}</span>
              </div>
            </button>
          </div>

          {orderNotice && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <span><b>New order alert:</b> {orderNotice}</span>
              <button onClick={() => setOrderNotice('')} className="font-bold" aria-label="Dismiss notification">×</button>
            </div>
          )}

          {showWalletTransactions && (
            <div className="mt-4 rounded-xl border border-green-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-green-100 p-3 text-green-800">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="6" width="18" height="15" rx="2"/>
                    <path d="M3 10h18M16 15h2M7 6V4a2 2 0 0 1 2-2h8"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Shop Wallet Balance</p>
                  <p className="text-3xl font-bold text-green-900">{money(adminWalletBalance)}</p>
                </div>
              </div>
              <div className="mt-5 border-t border-green-100 pt-3">
                <h2 className="font-bold">Recent shop wallet transactions</h2>
                {adminWalletTransactions.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No wallet transactions yet.</p>
                ) : adminWalletTransactions.map((tx) => {
                  const credit = tx.entry_type.includes('credit')
                  return (
                    <div key={tx.id} className="flex justify-between gap-3 border-b py-2 text-sm">
                      <div>
                        <p className="font-medium">{tx.description || tx.entry_type}</p>
                        <p className="text-xs text-slate-500">{new Date(tx.created_at).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${credit ? 'text-green-700' : 'text-red-600'}`}>
                          {credit ? '+' : '-'}{money(Number(tx.amount))}
                        </p>
                        <p className="text-xs text-slate-500">Balance {money(Number(tx.balance_after))}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {showCreditWalletPanel && (
            <div className="mt-4 rounded-xl border border-purple-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-purple-900">Credit Customer Wallet</h2>
              <p className="mt-1 text-sm text-slate-500">Credit only after receiving cash or another actual payment.</p>
              <label className="mt-4 block text-sm font-medium">Customer</label>
              <select
                value={creditCustomerId}
                onChange={(e) => setCreditCustomerId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
              >
                <option value="">Select customer</option>
                {adminCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.full_name || 'Customer'} - {customer.email || 'Email not added'} {customer.mobile ? `- ${customer.mobile}` : ''}
                  </option>
                ))}
              </select>
              <label className="mt-3 block text-sm font-medium">Amount (₹)</label>
              <input
                type="number" min="0.01" step="0.01" value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Enter amount"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
              />
              <label className="mt-3 block text-sm font-medium">Payment note</label>
              <input
                value={creditNote} onChange={(e) => setCreditNote(e.target.value)}
                placeholder="Cash received / UPI received"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
              />
              <button
                type="button" onClick={creditCustomerWallet} disabled={creditBusy}
                className="mt-4 w-full rounded-lg bg-purple-800 px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {creditBusy ? 'Crediting...' : 'Credit Customer Wallet'}
              </button>
            </div>
          )}
        </section>

        {showPendingOrders && (
          <section className="mt-6 rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">Pending Orders</h2>
            <p className="mt-1 text-sm text-slate-500">Orders waiting for delivery</p>
            {adminOrders.filter((order) => order.status === 'pending').length === 0 ? (
              <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No pending orders.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {adminOrders.filter((order) => order.status === 'pending').map((order) => (
                  <article key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4">
                    <div>
                      <p className="font-bold text-green-900">Order #{order.order_number}</p>
                      <p className="text-sm">{order.customer?.full_name || 'Customer'}</p>
                      <p className="text-sm text-slate-500">Delivery: {order.delivery_date}</p>
                      <p className="font-semibold">₹{Number(order.total_amount || 0).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={order.status}
                        disabled={statusBusyId === order.id}
                        onChange={(e) => void updateAdminOrderStatus(order.id, e.target.value)}
                        className="rounded-lg border border-slate-300 p-2 text-sm"
                      >
                        {['pending', 'delivered', 'cancelled'].map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      {statusBusyId === order.id && <span className="text-xs text-slate-500">Saving...</span>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {showOnlineOrders && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Online Orders</h2>
              <p className="mt-1 text-sm text-slate-500">Latest 50 orders · Live updates enabled</p>
            </div>
            <button
              type="button" onClick={loadAdminData} disabled={adminDataLoading}
              className="rounded-lg border border-green-700 px-4 py-2 text-sm font-semibold text-green-800"
            >
              {adminDataLoading ? 'Loading...' : 'Refresh Orders'}
            </button>
          </div>

          {adminDataError && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{adminDataError}</p>
          )}

          {adminOrders.length === 0 ? (
            <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              {adminDataLoading ? 'Loading orders...' : 'No orders found.'}
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {adminOrders.map((order) => {
                const address = order.address
                const addressText = address
                  ? [address.house_no, address.street, address.area, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(', ')
                  : 'Delivery address unavailable'
                const mapQuery = address && address.latitude != null && address.longitude != null
                  ? `${address.latitude},${address.longitude}`
                  : addressText

                return (
                  <article key={order.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-green-900">Order #{order.order_number}</h3>
                        <p className="mt-1 text-sm font-semibold">{order.customer?.full_name || address?.recipient_name || 'Customer'}</p>
                        <p className="text-sm text-slate-600">{order.customer?.mobile || address?.mobile || 'Mobile unavailable'}</p>
                        <p className="mt-2 text-sm text-slate-600">{addressText}</p>
                        {address && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                            target="_blank" rel="noreferrer"
                            className="mt-2 inline-block text-sm font-semibold text-blue-700 underline"
                          >
                            Open delivery location in Google Maps
                          </a>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{money(Number(order.total_amount || 0))}</p>
                        <p className="mt-1 text-xs capitalize text-slate-500">
                          {order.payment_method || 'Method not set'} · {order.payment_status || 'unpaid'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{new Date(order.created_at).toLocaleString('en-IN')}</p>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="text-sm font-semibold">Milk items</p>
                      {order.items.length ? order.items.map((item: any) => (
                        <div key={item.id} className="flex flex-wrap justify-between gap-2 py-1 text-sm">
                          <span>{item.milk_name} · {Number(item.qty).toFixed(2)} L × {money(Number(item.unit_price))}/L</span>
                          <b>{money(Number(item.line_total))}</b>
                        </div>
                      )) : <p className="mt-1 text-sm text-slate-500">No items found.</p>}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <div>
                        <p className="text-sm">Delivery: {order.delivery_date}{order.schedule_end_date && order.schedule_end_date !== order.delivery_date ? ` to ${order.schedule_end_date}` : ''}</p>
                        <p className="text-xs capitalize text-slate-500">Schedule: {(order.schedule_type || 'one_day').replaceAll('_', ' ')}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold capitalize">{order.status}</span>
                        <select
                          value={order.status}
                          disabled={statusBusyId === order.id}
                          onChange={(e) => void updateAdminOrderStatus(order.id, e.target.value)}
                          className="rounded-lg border border-slate-300 p-2 text-sm"
                        >
                          {['pending', 'delivered', 'cancelled'].map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        {statusBusyId === order.id && <span className="text-xs text-slate-500">Saving...</span>}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
        )}

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
            

                        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Cow & Buffalo Milk</h2>
              <span className="text-sm text-slate-500">{date}</span>
            </div>

            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {stockRows.map((row) => (
                <section key={row.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-bold text-green-900">{row.name}</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Card title="Opening Stock" value={litres(row.opening)} />
                    <Card title="Milk Purchased" value={litres(row.onlineOrdered)} note="Online customer orders" />
                    <Card title="Online Delivered" value={litres(row.online)} />
                    <Card title="Online Orders" value={String(row.orderCount)} />
                    <Card title="Online Order Amount" value={money(row.orderAmount)} />
                  </div>

                  <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                    <label className="block text-sm font-semibold">
                      {row.name} Opening Stock (Litres)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={openingQty[row.id] ?? ''}
                        onChange={(e) => {
                          setOpeningQty((current) => ({
                            ...current,
                            [row.id]: e.target.value,
                          }))
                          setOpeningMessage('')
                        }}
                        placeholder="Enter opening litres"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => saveOpeningStock(row.id)}
                        disabled={savingOpening || (openingQty[row.id] ?? '').trim() === ''}
                        className="rounded-lg bg-green-800 px-4 py-2 font-semibold text-white hover:bg-green-900 disabled:opacity-50"
                      >
                        {savingOpening ? 'Saving...' : 'Save Opening Stock'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingResetMilk(row.id)}
                        disabled={savingOpening}
                        className="rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Reset to 0
                      </button>
                      {openingMessage && (
                        <p className="text-sm text-slate-700">{openingMessage}</p>
                      )}
                    </div>
                  </div>

                </section>
              ))}
              {stockRows.length === 0 && (
                <p className="rounded-xl bg-white p-5 text-sm text-slate-500">No active milk types found.</p>
              )}
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

        {pendingResetMilk !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-stock-title"
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-700">
                !
              </div>
              <h2 id="reset-stock-title" className="text-xl font-bold text-slate-900">
                Confirm Opening Stock Reset
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Are you sure you want to reset{' '}
                <b>{stockRows.find((row) => row.id === pendingResetMilk)?.name || 'Milk'}</b>
                {' '}opening stock to <b>0.00 L</b> for <b>{date}</b>?
                Previous dates will not be affected.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPendingResetMilk(null)}
                  disabled={savingOpening}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const milkId = pendingResetMilk
                    setPendingResetMilk(null)
                    if (milkId !== null) await resetOpeningStock(milkId)
                  }}
                  disabled={savingOpening}
                  className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {savingOpening ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </div>
          </div>
        )}
    </main>
  )
}

