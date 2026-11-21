'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), { ssr: false })
import { customerSupabase } from '@/lib/supabase'

type MilkProduct = {
  id: string
  name: string
  price: number
}

type ScheduleType = 'one_day' | 'full_week' | 'selected_days' | 'full_month'

type CustomerAddress = {
  id: string
  label: string
  recipient_name: string
  mobile: string
  house_no: string
  street: string
  area: string
  landmark: string | null
  city: string
  state: string
  pincode: string
  latitude: number | null
  longitude: number | null
  is_default: boolean | null
}

type CustomerProfile = {
  full_name: string | null
  mobile: string | null
  email: string | null
  gender: string | null
  delivery_instructions: string | null
}

type WalletTransaction = {
  id: string
  entry_type: string
  amount: number
  balance_after: number
  description: string | null
  created_at: string
}

type CustomerOrder = {
  id: string
  order_number: number
  delivery_date: string
  schedule_end_date: string | null
  schedule_type: string | null
  status: string
  payment_status: string
  total_amount: number
  created_at: string
}

function localDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localDateString(date)
}

export default function CustomerDashboard() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [contact, setContact] = useState('Customer')
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null)
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [showOrderHistory, setShowOrderHistory] = useState(false)
  const [products, setProducts] = useState<MilkProduct[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [packSizes, setPackSizes] = useState<Record<string, number>>({})
  const [error, setError] = useState('')

  const [showCart, setShowCart] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
const [showWallet, setShowWallet] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState(0)
  const [addresses, setAddresses] = useState<CustomerAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [userId, setUserId] = useState('')
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number | null
    longitude: number | null
  }>({ latitude: null, longitude: null })
  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [orderSuccess, setOrderSuccess] = useState('')
  const [walletBalance, setWalletBalance] = useState(0)
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([])
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    recipient_name: '',
    mobile: '',
    house_no: '',
    street: '',
    area: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
  })

  const [scheduleType, setScheduleType] = useState<ScheduleType>('one_day')
  const [startDate, setStartDate] = useState('')
  const [selectedEndDate, setSelectedEndDate] = useState('')
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])

  useEffect(() => {
    const today = localDateString(new Date())
    setStartDate(today)
    setSelectedEndDate(addDays(today, 6))
  }, [])

  useEffect(() => {
    let active = true

    async function loadCustomerPage() {
      const { data, error: authError } = await customerSupabase.auth.getUser()

      if (authError || !data.user) {
        router.replace('/')
        return
      }

      const { data: profile, error: profileError } = await customerSupabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileError || profile?.role !== 'customer') {
        await customerSupabase.auth.signOut()
        router.replace('/')
        return
      }

      if (active) setUserId(data.user.id)

      const { data: profileDetails, error: customerProfileError } = await customerSupabase
        .from('profiles')
        .select('full_name, mobile, email, gender, delivery_instructions')
        .eq('id', data.user.id)
        .maybeSingle()

      if (customerProfileError) {
        console.error('Unable to load customer profile:', customerProfileError.message)
      } else if (active && profileDetails) {
        setCustomerProfile(profileDetails as CustomerProfile)
      }

      const { data: savedAddresses, error: addressError } = await customerSupabase
        .from('customer_addresses')
        .select('id, label, recipient_name, mobile, house_no, street, area, landmark, city, state, pincode, latitude, longitude, is_default')
        .eq('customer_id', data.user.id)
        .order('is_default', { ascending: false })

      if (addressError) {
        if (active) setError('Unable to load saved addresses. Please refresh the page.')
      } else if (active) {
        const rows = (savedAddresses || []) as CustomerAddress[]
        setAddresses(rows)
        const defaultAddress = rows.find((address) => address.is_default)
        setSelectedAddressId(defaultAddress?.id || rows[0]?.id || '')
      }

      const today = localDateString(new Date())

      const [{ data: milkTypes, error: milkError }, { data: prices, error: priceError }] =
        await Promise.all([
          customerSupabase
            .from('milk_types')
            .select('id, name')
            .eq('active', true),
          customerSupabase
            .from('milk_prices')
            .select('milk_type_id, sell_price, effective_from')
            .eq('channel', 'online')
            .lte('effective_from', today)
            .order('effective_from', { ascending: false }),
        ])

      if (milkError || priceError) {
        if (active) setError('Unable to load milk products. Please refresh the page.')
      } else {
        const latestPrices = new Map<string, number>()

        for (const price of prices || []) {
          const id = String(price.milk_type_id)
          if (!latestPrices.has(id)) {
            latestPrices.set(id, Number(price.sell_price))
          }
        }

        const availableProducts = (milkTypes || [])
          .filter((milk) => latestPrices.has(String(milk.id)))
          .map((milk) => ({
            id: String(milk.id),
            name: milk.name,
            price: latestPrices.get(String(milk.id))!,
          }))

        if (active) setProducts(availableProducts)
      }

      const { data: orderRows, error: historyError } = await customerSupabase
        .from('orders')
        .select('id, order_number, delivery_date, schedule_end_date, schedule_type, status, payment_status, total_amount, created_at')
        .eq('customer_id', data.user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (active) {
        if (historyError) {
          setOrdersError(historyError.message)
        } else {
          setCustomerOrders((orderRows || []) as CustomerOrder[])
        }

        setContact(
          profileDetails?.full_name ||
          profileDetails?.mobile ||
          data.user.phone ||
          data.user.email ||
          'Customer'
        )
        setLoading(false)
      }
    }

    void loadCustomerPage()

    return () => {
      active = false
    }
  }, [router])

  function updateQuantity(id: string, change: number) {
    setCart((current) => {
      const nextQuantity = Math.max(
        0,
        Math.round(((current[id] || 0) + change) * 100) / 100
      )
      const updated = { ...current }

      if (nextQuantity === 0) {
        delete updated[id]
      } else {
        updated[id] = nextQuantity
      }

      return updated
    })
  }

  function toggleDay(day: number) {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort((a, b) => a - b)
    )
  }

  async function handleDeleteAddress(address: CustomerAddress) {
    if (!window.confirm(`Delete ${address.label} address?`)) return

    if (address.is_default && addresses.length > 1) {
      setAddressError('Please set another address as default before deleting this address.')
      return
    }

    const { error } = await customerSupabase
      .from('customer_addresses')
      .delete()
      .eq('id', address.id)
      .eq('customer_id', userId)

    if (error) {
      setAddressError(`Unable to delete address: ${error.message}`)
      return
    }

    const remaining = addresses.filter((item) => item.id !== address.id)
    setAddresses(remaining)

    if (selectedAddressId === address.id) {
      setSelectedAddressId(remaining[0]?.id || '')
    }
  }

  async function handleSaveAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAddressError('')

    if (!userId) {
      setAddressError('Customer login not found. Please login again.')
      return
    }

    setSavingAddress(true)

    const addressPayload = {
      ...addressForm,
      landmark: addressForm.landmark.trim() || null,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
    }

    const addressQuery = editingAddressId
      ? customerSupabase
          .from('customer_addresses')
          .update(addressPayload)
          .eq('id', editingAddressId)
          .eq('customer_id', userId)
      : customerSupabase
          .from('customer_addresses')
          .insert({
            customer_id: userId,
            ...addressPayload,
            is_default: addresses.length === 0,
          })

    const { data, error } = await addressQuery
      .select('id, label, recipient_name, mobile, house_no, street, area, landmark, city, state, pincode, latitude, longitude, is_default')
      .single()

    setSavingAddress(false)

    if (error) {
      setAddressError(error.message)
      return
    }

    const savedAddress = data as CustomerAddress

    if (editingAddressId) {
      setAddresses((current) =>
        current.map((address) => address.id === savedAddress.id ? savedAddress : address)
      )
    } else {
      setAddresses((current) => [...current, savedAddress])
    }

    setSelectedAddressId(savedAddress.id)
    setSelectedLocation({ latitude: null, longitude: null })
    setEditingAddressId('')
    setShowAddressForm(false)
    setAddressForm({
      label: 'Home',
      recipient_name: '',
      mobile: '',
      house_no: '',
      street: '',
      area: '',
      landmark: '',
      city: '',
      state: '',
      pincode: '',
    })
  }

  const cartItems = products.filter((product) => (cart[product.id] || 0) > 0)

  const totalLitres = cartItems.reduce(
    (sum, product) => sum + cart[product.id],
    0
  )

  const dailyAmount = cartItems.reduce(
    (sum, product) => sum + product.price * cart[product.id],
    0
  )

  const scheduleEndDate = useMemo(() => {
    if (scheduleType === 'one_day') return startDate
    if (scheduleType === 'full_week') return addDays(startDate, 6)

    if (scheduleType === 'full_month') {
      const date = new Date(`${startDate}T12:00:00`)
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
      return localDateString(lastDay)
    }

    return selectedEndDate
  }, [scheduleType, startDate, selectedEndDate])

  const deliveryCount = useMemo(() => {
    if (!startDate || !scheduleEndDate || scheduleEndDate < startDate) return 0

    const start = new Date(`${startDate}T12:00:00`)
    const end = new Date(`${scheduleEndDate}T12:00:00`)
    let count = 0

    for (
      const date = new Date(start);
      date <= end;
      date.setDate(date.getDate() + 1)
    ) {
      if (scheduleType === 'selected_days') {
        if (selectedDays.includes(date.getDay())) count++
      } else {
        count++
      }
    }

    return count
  }, [startDate, scheduleEndDate, scheduleType, selectedDays])

  const estimatedTotal = dailyAmount * deliveryCount

  async function handlePlaceOrder() {
    setOrderError('')

    if (!userId) {
      setOrderError('Customer login not found. Please login again.')
      return
    }

    if (!selectedAddressId || !addresses.some((a) => a.id === selectedAddressId)) {
      setOrderError('Please select or add a delivery address.')
      return
    }

    if (cartItems.length === 0 || deliveryCount <= 0) {
      setOrderError('Please add milk and select a valid delivery schedule.')
      return
    }

    if (scheduleType === 'selected_days' && selectedDays.length === 0) {
      setOrderError('Please select at least one delivery day.')
      return
    }

    if (!startDate || !scheduleEndDate || scheduleEndDate < startDate) {
      setOrderError('Please select a valid delivery date range.')
      return
    }

    setPlacingOrder(true)

    const orderStartDate =
      scheduleType === 'full_month'
        ? localDateString(
            new Date(
              new Date(`${startDate}T12:00:00`).getFullYear(),
              new Date(`${startDate}T12:00:00`).getMonth(),
              1
            )
          )
        : startDate

    const items = cartItems.map((product) => ({
      milk_type_id: Number(product.id),
      qty: cart[product.id],
    }))

    const { data, error } = await customerSupabase.rpc(
      'place_customer_scheduled_order',
      {
        p_address_id: selectedAddressId,
        p_items: items,
        p_start_date: orderStartDate,
        p_schedule_type: scheduleType,
        p_end_date: scheduleEndDate,
        p_delivery_days:
          scheduleType === 'selected_days'
            ? selectedDays
            : [0, 1, 2, 3, 4, 5, 6],
        p_notes: null,
      }
    )

    setPlacingOrder(false)

    if (error) {
      setOrderError(error.message)
      return
    }

    setOrderSuccess(String(data))
    setCart({})

    const { data: wallet } = await customerSupabase
      .from('wallet_accounts')
      .select('id, balance')
      .eq('owner_id', userId)
      .eq('account_type', 'customer')
      .maybeSingle()

    if (wallet) {
      setWalletBalance(Number(wallet.balance || 0))
      const { data: transactions } = await customerSupabase
        .from('wallet_transactions')
        .select('id, entry_type, amount, balance_after, description, created_at')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setWalletTransactions((transactions || []) as WalletTransaction[])
    }

    setCheckoutStep(2)
  }


  useEffect(() => {
    if (!userId) return

    let active = true

    const refreshWallet = async () => {
      const { data: wallet, error: walletError } = await customerSupabase
        .from('wallet_accounts')
        .select('id, balance')
        .eq('owner_id', userId)
        .eq('account_type', 'customer')
        .maybeSingle()

      if (walletError) {
        console.error('Unable to load wallet:', walletError.message)
        return
      }

      if (!wallet) {
        if (active) {
          setWalletBalance(0)
          setWalletTransactions([])
        }
        return
      }

      const { data: transactions, error: txError } = await customerSupabase
        .from('wallet_transactions')
        .select('id, entry_type, amount, balance_after, description, created_at')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (active) {
        setWalletBalance(Number(wallet.balance || 0))
        if (!txError) setWalletTransactions((transactions || []) as WalletTransaction[])
      }
    }

    void refreshWallet()

    const channel = customerSupabase
      .channel(`customer-wallet-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallet_accounts', filter: `owner_id=eq.${userId}` },
        () => { void refreshWallet() }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${userId}` },
        () => { void refreshWallet() }
      )
      .subscribe()

    return () => {
      active = false
      void customerSupabase.removeChannel(channel)
    }
  }, [userId])

  async function handleLogout() {
    await customerSupabase.auth.signOut()
    router.replace('/')
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-green-50 text-green-900">
        Loading your milk shop...
      </main>
    )
  }

  return (
    <main
      className="min-h-screen text-slate-800"
      style={{
        backgroundImage: "linear-gradient(rgba(240,253,244,0.78), rgba(240,253,244,0.78)), url('/images/milk/Gemini_Generated_Gif_k6763rk6763rk676.gif')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <header className="sticky top-0 z-30 relative px-4 py-3 text-white shadow-md">
        <img
          src="/images/milk/Gemini_Generated_Gif_k6763rk6763rk676.gif"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-green-950/65" />
        <div className="relative z-10 mx-auto flex max-w-5xl items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setCheckoutStep(0)
              setShowOrderHistory(false)
              setShowProfile(false)
              setShowCart(false)
              setShowCalendar(false)
              setShowAddressForm(false)
            }}
            className="text-left"
            aria-label="Go to Smart Milk Shop home"
          >
            <h1 className="text-lg font-extrabold tracking-wide sm:text-2xl">
              SMART MILK SHOP
            </h1>
            <p className="mt-1 text-xs text-green-100">
              Welcome
            </p>
            <p className="text-xs font-semibold text-white">
              Account: {contact || 'Customer'}
            </p>
          </button>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => {
                  setShowCart(!showCart)
                  setShowCalendar(false)
                  setShowProfile(false)
                }}
                className="rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25"
                aria-label="Open cart"
              >
                🛒 <span className="hidden sm:inline">Cart</span>
                <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs text-green-900">
                  {totalLitres} L
                </span>
              </button>

              {showCart && (
                <div className="absolute right-0 top-12 z-40 w-72 max-w-[90vw] rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-green-900">Your Cart</h3>
                    <button onClick={() => setShowCart(false)} className="text-xl text-slate-500">×</button>
                  </div>

                  {cartItems.length === 0 ? (
                    <p className="py-5 text-sm text-slate-500">Your cart is empty. Add milk to get started.</p>
                  ) : (
                    <>
                      <div className="mt-3 max-h-52 space-y-3 overflow-y-auto">
                        {cartItems.map((product) => (
                          <div key={product.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm">
                            <div>
                              <p className="font-semibold">{product.name}</p>
                              <p className="text-xs text-slate-500">₹{product.price} / litre</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => updateQuantity(product.id, -(packSizes[product.id] || 1))} className="h-7 w-7 rounded border border-green-700 text-green-800">−</button>
                              <span className="min-w-10 text-center font-semibold">{cart[product.id]} L</span>
                              <button onClick={() => updateQuantity(product.id, packSizes[product.id] || 1)} className="h-7 w-7 rounded bg-green-800 text-white">+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-between text-sm">
                        <span>Daily quantity</span>
                        <strong>{totalLitres} L</strong>
                      </div>
                      <div className="mt-2 flex justify-between font-bold text-green-900">
                        <span>Daily amount</span>
                        <span>₹{dailyAmount.toFixed(2)}</span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">Schedule total is shown in the calendar panel.</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowCalendar(!showCalendar)
                  setShowCart(false)
                  setShowProfile(false)
                }}
                className="rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25"
              >
                📅 <span className="hidden sm:inline">Schedule</span>
              </button>
            </div>


            <div className="relative">
              <button
                type="button"
                aria-label="Open customer wallet"
                onClick={() => {
                  setShowWallet(!showWallet)
                  setShowCart(false)
                  setShowCalendar(false)
                  setShowProfile(false)
                }}
                className="rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25"
              >
                💰 <span className="hidden sm:inline">Wallet</span>
              </button>
              {showWallet && (
                <div className="absolute right-0 top-12 z-50 max-h-[75vh] w-80 max-w-[90vw] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-xl">
                  <h3 className="mb-3 font-bold text-green-900">My Wallet</h3>
                  <div className="my-3 rounded-xl border border-green-200 bg-green-50 p-3">
                    <p className="text-xs font-medium text-green-800">My Wallet Balance</p>
                    <p className="mt-1 text-2xl font-bold text-green-900">₹{walletBalance.toFixed(2)}</p>
                    <p className="mt-1 text-xs text-green-800">Order payments are deducted automatically from your wallet.</p>
                    <div className="mt-3 border-t border-green-200 pt-2">
                      <p className="text-sm font-bold text-green-900">Recent transactions</p>
                      {walletTransactions.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500">No transactions yet.</p>
                      ) : walletTransactions.map((tx) => {
                        const credit = tx.entry_type.includes('credit') || tx.entry_type.includes('refund')
                        return (
                          <div key={tx.id} className="flex justify-between gap-2 border-b border-green-100 py-2 text-xs">
                            <div className="min-w-0">
                              <p className="font-medium">{tx.description || tx.entry_type}</p>
                              <p className="text-slate-500">{new Date(tx.created_at).toLocaleString('en-IN')}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={`font-bold ${credit ? 'text-green-700' : 'text-red-600'}`}>
                                {credit ? '+' : '-'}₹{Number(tx.amount).toFixed(2)}
                              </p>
                              <p className="text-slate-500">Bal: ₹{Number(tx.balance_after).toFixed(2)}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>


                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => {
                  setShowProfile(!showProfile)
                  setShowWallet(false)
                  setShowCart(false)
                  setShowCalendar(false)
                }}
                className="rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25"
              >
                👤 <span className="hidden sm:inline">Profile</span>
              </button>

              {showProfile && (
                <div className="absolute right-0 top-12 z-40 max-h-[75vh] w-80 max-w-[90vw] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-xl">
                  <h3 className="font-bold text-green-900">My Profile</h3>
                  <p className="mt-3 text-xs text-slate-500">Customer name</p>
                  <p className="text-sm font-semibold">{customerProfile?.full_name || contact}</p>

                  <p className="mt-2 text-xs text-slate-500">Mobile</p>
                  <p className="break-all text-sm">{customerProfile?.mobile || contact}</p>

                  <p className="mt-2 text-xs text-slate-500">Email</p>
                  <p className="break-all text-sm">{customerProfile?.email || 'Not added'}</p>

                  <div className="my-3 border-t border-slate-100" />
                  <h4 className="text-sm font-bold text-green-900">Saved addresses</h4>

                  {addresses.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">No saved addresses yet.</p>
                  ) : (
                    <div className="mt-2 space-y-3">
                      {addresses.map((address) => (
                        <div key={address.id} className="rounded-lg bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">
                              {address.label} {address.is_default ? '• Default' : ''}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setAddressForm({
                                  label: address.label,
                                  recipient_name: address.recipient_name,
                                  mobile: address.mobile,
                                  house_no: address.house_no,
                                  street: address.street,
                                  area: address.area,
                                  landmark: address.landmark || '',
                                  city: address.city,
                                  state: address.state,
                                  pincode: address.pincode,
                                })
                                setSelectedLocation({
                                  latitude: address.latitude ?? null,
                                  longitude: address.longitude ?? null,
                                })
                                setEditingAddressId(address.id)
                                setAddressError('')
                                setShowProfile(false)
                                setShowOrderHistory(false)
                                setCheckoutStep(1)
                                setShowAddressForm(true)
                              }}
                              className="rounded-lg border border-green-700 px-3 py-1 text-xs font-semibold text-green-800"
                            >
                              Edit
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            {address.recipient_name}, {address.mobile}
                          </p>
                          <p className="text-xs text-slate-600">
                            {address.house_no}, {address.street}, {address.area},
                            {address.landmark ? ` ${address.landmark},` : ''}
                            {' '}{address.city}, {address.state} - {address.pincode}
                          </p>
                          {address.latitude != null && address.longitude != null && (
                            <a
                              href={`https://www.google.com/maps?q=${address.latitude},${address.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-block text-xs font-semibold text-green-800 underline"
                            >
                              📍 View Exact Location in Google Maps
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="my-3 border-t border-slate-100" />
                  <button
                    onClick={() => {
                      setShowProfile(false)
                      setShowOrderHistory(true)
                      setShowCart(false)
                      setShowCalendar(false)
                    }}
                    className="w-full rounded-lg bg-green-50 px-4 py-2 text-left text-sm font-semibold text-green-800 hover:bg-green-100"
                  >
                    📦 Order History ({customerOrders.length})
                  </button>

                  <div className="my-3 border-t border-slate-100" />
                  <button
                    onClick={handleLogout}
                    className="w-full rounded-lg bg-red-50 px-4 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-100"
                  >
                    ↪ Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {showCalendar && (
          <div className="mx-auto mt-3 max-w-5xl rounded-xl bg-white p-4 text-slate-800 shadow-xl sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-green-900">📅 Delivery Schedule</h2>
              <button onClick={() => setShowCalendar(false)} className="text-xl text-slate-500">×</button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ['one_day', 'One day'],
                ['full_week', 'Full week'],
                ['selected_days', 'Selected days'],
                ['full_month', 'Entire month'],
              ] as [ScheduleType, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => {
                    setScheduleType(value)
                    if (value === 'full_month' && startDate) {
                      const date = new Date(`${startDate}T12:00:00`)
                      date.setDate(1)
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      if (date < today) date.setMonth(date.getMonth() + 1)
                      setStartDate(localDateString(date))
                    }
                  }}
                  className={`rounded-lg border px-3 py-3 text-sm font-semibold ${
                    scheduleType === value
                      ? 'border-green-800 bg-green-800 text-white'
                      : 'border-green-200 bg-green-50 text-green-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                {scheduleType === 'full_month' ? 'Choose a date in the month' : 'Start date'}
                <input
                  type="date"
                  min={localDateString(new Date())}
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value)
                    if (scheduleType === 'selected_days') {
                      setSelectedEndDate(addDays(event.target.value, 6))
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                />
              </label>

              {scheduleType === 'selected_days' && (
                <label className="text-sm font-medium text-slate-700">
                  End date
                  <input
                    type="date"
                    min={startDate}
                    value={selectedEndDate}
                    onChange={(event) => setSelectedEndDate(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                  />
                </label>
              )}
            </div>

            {scheduleType === 'selected_days' && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold">Choose delivery days</p>
                <div className="flex flex-wrap gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(index)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                        selectedDays.includes(index)
                          ? 'border-green-800 bg-green-800 text-white'
                          : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 rounded-xl bg-green-50 p-4">
              <div className="flex justify-between gap-3 text-sm">
                <span>Delivery period</span>
                <strong>{startDate} to {scheduleEndDate}</strong>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span>Delivery days</span>
                <strong>{deliveryCount}</strong>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span>Milk per delivery day</span>
                <strong>{totalLitres} L</strong>
              </div>
              <div className="mt-3 flex justify-between border-t border-green-200 pt-3 font-bold text-green-900">
                <span>Estimated schedule total</span>
                <span>₹{estimatedTotal.toFixed(2)}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Quantity is delivered on each selected day. This is an estimate using current milk prices.
              </p>
            </div>

            {scheduleType === 'selected_days' && selectedDays.length === 0 && (
              <p className="mt-2 text-sm text-red-600">Please select at least one delivery day.</p>
            )}
            {scheduleType === 'selected_days' && selectedEndDate < startDate && (
              <p className="mt-2 text-sm text-red-600">End date must be on or after start date.</p>
            )}

            <button
              onClick={() => {
                if (cartItems.length === 0) {
                  alert('Please add milk to your cart first.')
                  return
                }
                if (scheduleType === 'selected_days' && selectedDays.length === 0) {
                  alert('Please select at least one delivery day.')
                  return
                }
                if (scheduleType === 'selected_days' && selectedEndDate < startDate) {
                  alert('End date must be on or after start date.')
                  return
                }
                setShowCalendar(false)
                setCheckoutStep(1)
              }}
              disabled={cartItems.length === 0 || deliveryCount === 0}
              className="mt-4 w-full rounded-xl bg-green-800 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Continue to Address →
            </button>
          </div>
        )}
      </header>

      {checkoutStep === 1 && (
        <section className="mx-auto max-w-5xl p-5 sm:p-8">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <button
              onClick={() => setCheckoutStep(0)}
              className="mb-4 rounded-lg border border-green-700 px-3 py-2 text-sm font-semibold text-green-800"
            >
              ← Back to Shop
            </button>
            <h2 className="text-xl font-bold text-green-900">Checkout – Delivery Address</h2>
            <p className="mt-2 text-sm text-slate-600">
              Select your delivery address.
            </p>

            <div className="mt-5">
              <h3 className="mb-3 font-semibold text-slate-800">Your saved addresses</h3>

              {addresses.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  No saved addresses found. Add a new delivery address next.
                </p>
              ) : (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className={`rounded-xl border p-4 ${
                        selectedAddressId === address.id
                          ? 'border-green-700 bg-green-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="deliveryAddress"
                          value={address.id}
                          checked={selectedAddressId === address.id}
                          onChange={() => setSelectedAddressId(address.id)}
                          className="mt-1 accent-green-800"
                        />
                        <div className="text-sm">
                          <p className="font-bold text-green-900">
                            {address.label} {address.is_default ? '· Default' : ''}
                          </p>
                          <p className="mt-1 font-semibold">{address.recipient_name} · {address.mobile}</p>
                          <p>{address.house_no}, {address.street}, {address.area}</p>
                          {address.landmark && <p>Landmark: {address.landmark}</p>}
                          <p>{address.city}, {address.state} - {address.pincode}</p>
                          {address.latitude != null && address.longitude != null && (
                            <a
                              href={`https://www.google.com/maps?q=${address.latitude},${address.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-xs font-semibold text-green-800 underline"
                            >
                              📍 View Exact Location in Google Maps
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(address)}
                        className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Delete Address
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => {
                  setAddressError('')
                  setShowAddressForm(!showAddressForm)
                }}
                className="w-full rounded-xl border-2 border-dashed border-green-700 px-4 py-3 font-semibold text-green-800"
              >
                + Add New Address
              </button>

              {showAddressForm && (
                <form onSubmit={handleSaveAddress} className="mt-4 space-y-3 rounded-xl border border-green-100 bg-white p-4">
                  <h3 className="font-semibold text-green-900">{editingAddressId ? "Edit Delivery Address" : "New Delivery Address"}</h3>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Address type</label>
                    <select
                      value={addressForm.label}
                      onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-3"
                    >
                      <option>Home</option>
                      <option>Office</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                    <p className="font-semibold text-green-900">📍 Exact Delivery Location</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Use GPS or enter coordinates copied from your Google Maps pin.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setAddressError('')
                        const mapSearch = [
                          addressForm.house_no, addressForm.street,
                          addressForm.area, addressForm.landmark,
                          addressForm.city, addressForm.state, addressForm.pincode,
                        ].filter(Boolean).join(', ')
                        window.open(
                          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapSearch || 'Select delivery location')}`,
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }}
                      className="mt-3 w-full rounded-lg bg-green-800 px-3 py-3 text-sm font-semibold text-white"
                    >
                      📍 Use Current Location
                    </button>
                    <LocationPicker
                      latitude={selectedLocation.latitude}
                      longitude={selectedLocation.longitude}
                      onSelect={(latitude, longitude, address) => {
                        setSelectedLocation({ latitude, longitude })
                        if (address) {
                          setAddressForm((current) => ({
                            ...current,
                            house_no: address.house_number || current.house_no,
                            street: address.road || address.pedestrian || current.street,
                            area: address.neighbourhood || address.suburb || address.residential || current.area,
                            city: address.city || address.town || address.village || address.city_district || current.city,
                            state: address.state || current.state,
                            pincode: address.postcode || current.pincode,
                          }))
                        }
                      }}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="text-xs font-medium text-slate-700">
                        Latitude
                        <input
                          type="number"
                          step="any"
                          value={selectedLocation.latitude ?? ''}
                          onChange={(e) => setSelectedLocation((current) => ({
                            ...current,
                            latitude: e.target.value === '' ? null : Number(e.target.value),
                          }))}
                          placeholder="Latitude"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Longitude
                        <input
                          type="number"
                          step="any"
                          value={selectedLocation.longitude ?? ''}
                          onChange={(e) => setSelectedLocation((current) => ({
                            ...current,
                            longitude: e.target.value === '' ? null : Number(e.target.value),
                          }))}
                          placeholder="Longitude"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
                        />
                      </label>
                    </div>
                    <label className="mt-3 block text-xs font-medium text-slate-700">
                      Paste Google Maps link or coordinates
                      <input
                        type="text"
                        placeholder="Paste map link or 17.4486, 78.3908"
                        onChange={(e) => {
                          const value = e.target.value.trim()
                          const patterns = [
                            /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
                            /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
                            /[?&](?:q|query)=(-?\d+(?:\.\d+)?)(?:%2C|,|%2c)(-?\d+(?:\.\d+)?)/i,
                            /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/,
                          ]
                          for (const pattern of patterns) {
                            const match = value.match(pattern)
                            if (match) {
                              const latitude = Number(match[1])
                              const longitude = Number(match[2])
                              if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
                                setSelectedLocation({ latitude, longitude })
                                setAddressError('')
                                return
                              }
                            }
                          }
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
                      />
                    </label>
                    <p className="mt-1 text-xs text-slate-500">
                      Maps lo location select chesi, share/copy chesina link ikkada paste cheyyandi.
                    </p>
                    {selectedLocation.latitude !== null && selectedLocation.longitude !== null && (
                      <a
                        href={`https://www.google.com/maps?q=${selectedLocation.latitude},${selectedLocation.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-sm font-semibold text-green-900 underline"
                      >
                        Open selected pin in Google Maps
                      </a>
                    )}
                  </div>

                  {([
                    ['recipient_name', 'Recipient name'],
                    ['mobile', 'Mobile number'],
                    ['house_no', 'House / Flat number'],
                    ['street', 'Street'],
                    ['area', 'Area / Locality'],
                    ['landmark', 'Landmark (optional)'],
                    ['city', 'City'],
                    ['state', 'State'],
                    ['pincode', 'PIN code'],
                  ] as const).map(([field, label]) => (
                    <div key={field}>
                      <label className="mb-1 block text-sm font-medium">{label}</label>
                      <input
                        required={field !== 'landmark'}
                        type={field === 'mobile' || field === 'pincode' ? 'tel' : 'text'}
                        inputMode={field === 'mobile' || field === 'pincode' ? 'numeric' : undefined}
                        maxLength={field === 'mobile' ? 10 : field === 'pincode' ? 6 : undefined}
                        value={addressForm[field]}
                        onChange={(e) => setAddressForm({ ...addressForm, [field]: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-3"
                        placeholder={label}
                      />
                    </div>
                  ))}

                  {addressError && (
                    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{addressError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={savingAddress}
                    className="w-full rounded-xl bg-green-800 px-4 py-3 font-semibold text-white disabled:bg-slate-400"
                  >
                    {savingAddress ? 'Saving...' : editingAddressId ? 'Update Address' : 'Save Address'}
                  </button>
                </form>
              )}
            </div>

            <div className="mt-5 rounded-xl bg-green-50 p-4">
              <h3 className="font-semibold text-green-900">Order summary</h3>
              <p className="mt-2 text-sm">Schedule: {scheduleType.replace('_', ' ')}</p>
              <p className="mt-1 text-sm">Delivery: {startDate} to {scheduleEndDate}</p>
              <p className="mt-1 text-sm">Delivery days: {deliveryCount}</p>
              <p className="mt-1 text-sm">Daily quantity: {totalLitres} L</p>
              <p className="mt-1 text-sm">Daily amount: ₹{dailyAmount.toFixed(2)}</p>
              <p className="mt-3 border-t border-green-200 pt-3 font-bold text-green-900">
                Estimated total: ₹{estimatedTotal.toFixed(2)}
              </p>
            </div>

            {orderError && (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {orderError}
              </p>
            )}

            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={placingOrder || !selectedAddressId || cartItems.length === 0 || deliveryCount === 0}
              className="mt-5 w-full rounded-xl bg-green-800 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {placingOrder ? 'Placing Order...' : `Place Order – ₹${estimatedTotal.toFixed(2)}`}
            </button>
          </div>
        </section>
      )}

      {checkoutStep === 2 && orderSuccess && (
        <section className="mx-auto max-w-2xl p-5 sm:p-8">
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="text-5xl">✅</div>
            <h2 className="mt-4 text-2xl font-bold text-green-900">
              Order placed successfully!
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Your milk delivery schedule has been created.
            </p>
            <p className="mt-4 break-all rounded-lg bg-green-50 p-3 text-xs text-slate-600">
              Order reference: {orderSuccess}
            </p>
            <button
              type="button"
              onClick={() => {
                setOrderSuccess('')
                setOrderError('')
                setCheckoutStep(0)
              }}
              className="mt-6 w-full rounded-xl bg-green-800 px-4 py-3 font-semibold text-white"
            >
              Continue Shopping
            </button>
          </div>
        </section>
      )}

      {showOrderHistory && (
        <section className="mx-auto max-w-5xl p-5 sm:p-8">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-green-900">📦 My Order History</h2>
                <p className="mt-1 text-sm text-slate-500">Your latest 20 orders</p>
              </div>
              <button
                onClick={() => setShowOrderHistory(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
              >
                Back to Shop
              </button>
            </div>

            {ordersLoading ? (
              <p className="mt-5 text-sm text-slate-500">Loading orders...</p>
            ) : ordersError ? (
              <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                Unable to load orders: {ordersError}
              </p>
            ) : customerOrders.length === 0 ? (
              <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                You have not placed any orders yet.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {customerOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-green-900">
                          Order #{order.order_number}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Placed: {new Date(order.created_at).toLocaleDateString('en-IN')}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Delivery: {new Date(`${order.delivery_date}T00:00:00`).toLocaleDateString('en-IN')}
                          {order.schedule_end_date && order.schedule_end_date !== order.delivery_date
                            ? ` to ${new Date(`${order.schedule_end_date}T00:00:00`).toLocaleDateString('en-IN')}`
                            : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">
                          ₹{Number(order.total_amount || 0).toFixed(2)}
                        </p>
                        <p className="mt-1 text-xs capitalize text-slate-600">
                          {order.status} • Payment: {order.payment_status}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs capitalize text-slate-500">
                      Schedule: {(order.schedule_type || 'one_day').replace('_', ' ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {checkoutStep === 0 && !showOrderHistory && (
      <section className="mx-auto max-w-5xl p-5 sm:p-8">
        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-8">
          <h2 className="text-xl font-bold text-green-900">Choose Your Milk</h2>
          <p className="mt-1 text-sm text-slate-500">
            Select milk and add the required litres for each delivery day.
          </p>
        </div>

        {!error && products.length === 0 && (
          <p className="mt-4 rounded-lg bg-white p-5 text-sm text-slate-600">
            No milk products are currently available.
          </p>
        )}

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {products.map((product) => (
            <div key={product.id} className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <img
                  src={product.name.toLowerCase().includes('buffalo')
                    ? '/images/milk/buffalo-milk.png'
                    : '/images/milk/cow-milk.png'}
                  alt={`${product.name} milk packet`}
                  className="h-32 w-32 rounded-xl object-contain"
                />
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                  Fresh milk
                </span>
              </div>

              <h3 className="mt-4 text-lg font-bold text-green-900">{product.name}</h3>
              <p className="mt-1 text-xl font-bold text-slate-800">
                ₹{product.price}
                <span className="text-sm font-normal text-slate-500"> / litre</span>
              </p>

              <div className="mt-5">
                <span className="text-sm font-medium text-slate-600">Choose milk pack</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[0.5, 1, 2].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPackSizes((current) => ({ ...current, [product.id]: size }))}
                      className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                        (packSizes[product.id] || 1) === size
                          ? 'border-green-800 bg-green-800 text-white'
                          : 'border-green-700 text-green-800'
                      }`}
                    >
                      {size === 0.5 ? '500 ml' : `${size} L`}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Daily quantity (litres)</span>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => updateQuantity(product.id, -(packSizes[product.id] || 1))}
                      className="h-9 w-9 rounded-lg border border-green-700 text-lg font-bold text-green-800"
                      aria-label={`Remove selected pack of ${product.name}`}
                    >
                      −
                    </button>
                    <span className="min-w-10 text-center font-bold">
                      {(cart[product.id] || 0).toFixed(1)} L
                    </span>
                    <button
                      onClick={() => updateQuantity(product.id, packSizes[product.id] || 1)}
                      className="h-9 w-9 rounded-lg bg-green-800 text-lg font-bold text-white"
                      aria-label={`Add selected pack of ${product.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </section>
      )}
    </main>
  )
}
