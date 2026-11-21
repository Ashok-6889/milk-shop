'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { adminSupabase, customerSupabase } from '@/lib/supabase'

type LoginMode = 'customer' | 'admin'

export default function LoginPage() {
  const router = useRouter()

  const [mode, setMode] = useState<LoginMode>('customer')
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPassword, setCustomerPassword] = useState('')
  const [customerSignup, setCustomerSignup] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'error' | 'success'>('error')

  function showMessage(text: string, type: 'error' | 'success' = 'error') {
    setMessage(text)
    setMessageType(type)
  }

  function changeMode(nextMode: LoginMode) {
    if (loading) return
    setMode(nextMode)
    setMessage('')
  }

  async function handleCustomerSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (customerSignup) {
        if (!customerName.trim()) {
          throw new Error('Please enter your name.')
        }

        const { data, error } = await customerSupabase.auth.signUp({
          email: customerEmail.trim(),
          password: customerPassword,
          options: {
            data: { full_name: customerName.trim() },
          },
        })

        if (error) throw error

        if (data.session && data.user) {
          await customerSupabase.from('profiles').update({
            full_name: customerName.trim(),
          }).eq('id', data.user.id)

          router.replace('/customer')
        } else {
          showMessage(
            'Account created. Please verify your email using the link sent to your inbox.',
            'success'
          )
        }
      } else {
        const { data, error } = await customerSupabase.auth.signInWithPassword({
          email: customerEmail.trim(),
          password: customerPassword,
        })

        if (error) throw error
        if (!data.user) throw new Error('Login failed.')

        const { data: profile, error: profileError } = await customerSupabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle()

        if (profileError || !profile) {
          await customerSupabase.auth.signOut()
          throw new Error('Customer profile not found. Please contact the shop admin.')
        }

        if (profile.role !== 'customer') {
          await customerSupabase.auth.signOut()
          throw new Error('This account is not a customer account. Please use the correct login.')
        }

        router.replace('/customer')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ''

      if (
        customerSignup &&
        /already registered|already been registered|user already exists/i.test(errorMessage)
      ) {
        showMessage('This email is already registered. Please login instead.')
      } else {
        showMessage(errorMessage || 'Unable to continue.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleAdminLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await adminSupabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) throw error
      if (!data.user) throw new Error('Login failed.')

      const { data: profile, error: profileError } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileError || !profile) {
        await adminSupabase.auth.signOut()
        throw new Error('User profile not found. Admin access denied.')
      }

      if (profile.role !== 'admin') {
        await adminSupabase.auth.signOut()
        throw new Error('Admin access only. This account is not an admin.')
      }

      router.replace('/dashboard')
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : 'Unable to login.'
      )
    } finally {
      setLoading(false)
    }
  }

  function changeMobile() {
    if (loading) return
    setOtpSent(false)
    setOtp('')
    setMessage('')
  }

  return (
    <main className="login-page">
      <div className="login-layout">

        {/* Animated dairy farm */}
        <section className="visual-panel">
          <div className="brand-mark">🥛 SMART MILK SHOP</div>

          <div className="visual-heading">
            <h1>Pure Milk. Pure Trust.</h1>
            <p>Fresh from Our Dairy, Delivered to Your Doorstep.</p>
          </div>

          
          <div className="farm-scene">
            <img
              className="farm-image"
              src="/farm-milk-login.webp"
              alt="Fresh milk from a dairy farm"
            />
          </div>

          <div className="farm-footer">
            <span>🌱 Farm fresh</span>
            <span>🥛 Quality milk</span>
            <span>🚚 Daily delivery</span>
          </div>
        </section>

        {/* Login area */}
        <section className="auth-panel">
          <div className="login-card">
            <div className="card-brand">🥛 SMART MILK SHOP</div>
            <h2>Welcome back!</h2>
            <p className="card-subtitle">Sign in to continue to your dashboard.</p>

            <div className="login-tabs">
              <button
                type="button"
                className={mode === 'customer' ? 'active' : ''}
                onClick={() => changeMode('customer')}
                disabled={loading}
              >
                👤 Customer Login
              </button>
              <button
                type="button"
                className={mode === 'admin' ? 'active' : ''}
                onClick={() => changeMode('admin')}
                disabled={loading}
              >
                🛡️ Admin Login
              </button>
            </div>

            {mode === 'customer' ? (
              <form onSubmit={handleCustomerSubmit}>
                {customerSignup && (
                  <>
                    <label htmlFor="customerName">Full name</label>
                    <input
                      id="customerName"
                      type="text"
                      placeholder="Enter your full name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                    />
                  </>
                )}

                <label htmlFor="customerEmail">Email address</label>
                <input
                  id="customerEmail"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                />

                <label htmlFor="customerPassword">Password</label>
                <input
                  id="customerPassword"
                  type="password"
                  autoComplete={customerSignup ? 'new-password' : 'current-password'}
                  placeholder="Enter password"
                  minLength={6}
                  value={customerPassword}
                  onChange={(e) => setCustomerPassword(e.target.value)}
                  required
                />

                <button className="submit-button" type="submit" disabled={loading}>
                  {loading
                    ? 'Please wait...'
                    : customerSignup
                      ? 'Create Customer Account'
                      : 'Login as Customer'}
                </button>

                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setCustomerSignup(!customerSignup)
                    setMessage('')
                  }}
                  disabled={loading}
                >
                  {customerSignup
                    ? 'Already have an account? Login'
                    : 'New customer? Create an account'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAdminLogin}>
                <label htmlFor="email">Admin email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="Enter admin email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <button className="submit-button" type="submit" disabled={loading}>
                  {loading ? 'Logging in...' : 'Login as Admin'}
                </button>
              </form>
            )}

            {message && (
              <div className={`login-message ${messageType}`}>
                {message}
              </div>
            )}

            <p className="security-note">
              Secure login · Your account role is verified before dashboard access.
            </p>
          </div>

          <p className="copyright">© 2026 Smart Milk Shop</p>
        </section>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; }

        .login-page {
          min-height: 100vh;
          background: #f3f8f1;
          color: #183322;
          font-family: Arial, Helvetica, sans-serif;
        }

        .login-layout {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1.08fr 0.92fr;
        }

        .visual-panel {
          min-height: 100vh;
          padding: 32px 5%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          background: linear-gradient(145deg, #e4f3df, #f7f8e9 65%, #d8ebd2);
        }

        .brand-mark {
          align-self: flex-start;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 2px;
          color: #245d37;
        }

        .visual-heading {
          text-align: center;
          margin: 30px 0 8px;
        }

        .visual-heading h1 {
          margin: 0;
          color: #1d5431;
          font-size: clamp(26px, 3vw, 42px);
          font-weight: 800;
          line-height: 1.15;
        }

        .visual-heading p {
          color: #58745d;
          margin-top: 10px;
          font-size: 15px;
        }

        .farm-scene {
          width: 100%;
          max-width: 760px;
          margin-top: 12px;
          filter: drop-shadow(0 18px 22px rgba(40, 78, 42, .12));
        }

        .farm-svg {
          display: block;
          width: 100%;
          height: auto;
        }


        .farm-image {
          display: block;
          width: 100%;
          height: auto;
          aspect-ratio: 3 / 2;
          object-fit: cover;
          border-radius: 28px;
          box-shadow: 0 18px 22px rgba(40, 78, 42, .12);
        }

        .milk-glass-left {
          transform-box: fill-box;
          transform-origin: center bottom;
          animation: glass-float 3s ease-in-out infinite;
        }

        .milk-glass-right {
          transform-box: fill-box;
          transform-origin: center bottom;
          animation: glass-float 3s ease-in-out infinite 1.2s;
        }

        @keyframes glass-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }

        .sun-glow {
          transform-origin: center;
          animation: sun-pulse 3s ease-in-out infinite;
        }

        .buffalo-motion {
          animation: buffalo-walk 3.5s ease-in-out infinite alternate;
        }

        .buffalo-tail {
          transform-box: fill-box;
          transform-origin: right center;
          animation: tail-swish 1.3s ease-in-out infinite alternate;
        }

        .buffalo-leg {
          transform-box: fill-box;
          transform-origin: top center;
        }

        .buffalo-leg.leg-one,
        .farmer-leg.leg-one {
          animation: leg-step 0.75s ease-in-out infinite alternate;
        }

        .buffalo-leg.leg-two,
        .farmer-leg.leg-two {
          animation: leg-step 0.75s ease-in-out infinite alternate-reverse;
        }

        .buffalo-leg.leg-three {
          animation: leg-step 0.75s ease-in-out infinite alternate-reverse;
        }

        .buffalo-leg.leg-four {
          animation: leg-step 0.75s ease-in-out infinite alternate;
        }

        .farmer-motion {
          animation: farmer-bob 0.75s ease-in-out infinite alternate;
        }

        .farmer-leg {
          transform-box: fill-box;
          transform-origin: top center;
        }

        .milk-can {
          transform-box: fill-box;
          transform-origin: top center;
          animation: can-swing 0.75s ease-in-out infinite alternate;
        }

        .farm-footer {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px 25px;
          margin-top: 12px;
          color: #3b6945;
          font-weight: 700;
          font-size: 13px;
        }

        .auth-panel {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 32px;
          background: #fbfdf9;
        }

        .login-card {
          width: 100%;
          max-width: 430px;
          padding: 34px;
          border: 1px solid #e0eade;
          border-radius: 22px;
          background: #fff;
          box-shadow: 0 18px 55px rgba(30, 72, 42, .10);
        }

        .card-brand {
          color: #347345;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.5px;
          margin-bottom: 22px;
        }

        .login-card h2 {
          margin: 0;
          font-size: 29px;
          color: #183c25;
          font-weight: 800;
        }

        .card-subtitle {
          margin: 8px 0 22px;
          color: #718174;
          font-size: 14px;
        }

        .login-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px;
          padding: 5px;
          border-radius: 12px;
          background: #edf5ec;
          margin-bottom: 24px;
        }

        .login-tabs button {
          min-height: 44px;
          border: 0;
          border-radius: 9px;
          padding: 9px 5px;
          background: transparent;
          color: #49634e;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .login-tabs button.active {
          color: #fff;
          background: #21633a;
          box-shadow: 0 3px 8px rgba(33, 99, 58, .18);
        }

        .login-tabs button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .login-card label {
          display: block;
          color: #506454;
          font-size: 13px;
          font-weight: 700;
          margin: 14px 0 7px;
        }

        .login-card input {
          display: block;
          width: 100%;
          min-height: 48px;
          border: 1px solid #d8e3d8;
          border-radius: 10px;
          padding: 11px 13px;
          color: #173622;
          background: #fff;
          font-size: 15px;
          outline: none;
        }

        .login-card input:focus {
          border-color: #39804d;
          box-shadow: 0 0 0 3px rgba(57, 128, 77, .12);
        }

        .phone-field {
          display: flex;
          gap: 8px;
        }

        .phone-field span {
          display: flex;
          align-items: center;
          padding: 0 13px;
          border: 1px solid #d8e3d8;
          border-radius: 10px;
          color: #506454;
          background: #f8fbf7;
          font-weight: 700;
        }

        .phone-field input {
          flex: 1;
          min-width: 0;
        }

        .submit-button {
          width: 100%;
          min-height: 49px;
          margin-top: 20px;
          border: 0;
          border-radius: 10px;
          background: #21633a;
          color: #fff;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          transition: background .2s, transform .2s;
        }

        .submit-button:hover {
          background: #174d2d;
          transform: translateY(-1px);
        }

        .submit-button:disabled {
          opacity: .6;
          cursor: wait;
          transform: none;
        }

        .text-button {
          display: inline-block;
          border: 0;
          background: transparent;
          color: #236b3b;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          padding: 10px 8px 0 0;
        }

        .text-button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .otp-destination {
          margin: 0;
          padding: 10px;
          border-radius: 9px;
          background: #edf6ed;
          color: #2d663b;
          font-size: 13px;
        }

        .login-message {
          margin-top: 16px;
          padding: 12px;
          border-radius: 9px;
          font-size: 13px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .login-message.error {
          color: #a52525;
          background: #fff0ef;
          border: 1px solid #f4ceca;
        }

        .login-message.success {
          color: #21633a;
          background: #edf8ed;
          border: 1px solid #d2ead3;
        }

        .security-note {
          margin: 22px 0 0;
          color: #819083;
          text-align: center;
          font-size: 11px;
          line-height: 1.5;
        }

        .copyright {
          margin: 25px 0 0;
          color: #8a998b;
          font-size: 12px;
        }

        @keyframes leg-step {
          from { transform: rotate(-12deg); }
          to { transform: rotate(12deg); }
        }

        @keyframes buffalo-walk {
          from { transform: translateX(0); }
          to { transform: translateX(9px); }
        }

        @keyframes tail-swish {
          from { transform: rotate(-12deg); }
          to { transform: rotate(13deg); }
        }

        @keyframes farmer-bob {
          from { transform: translateY(0); }
          to { transform: translateY(-4px); }
        }

        @keyframes can-swing {
          from { transform: rotate(-3deg); }
          to { transform: rotate(3deg); }
        }

        @keyframes sun-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .8; transform: scale(1.08); }
        }

        @media (max-width: 850px) {
          .login-layout {
            grid-template-columns: 1fr;
          }

          .visual-panel {
            min-height: auto;
            padding: 22px 18px 12px;
          }

          .brand-mark {
            align-self: center;
          }

          .visual-heading {
            margin: 19px 0 4px;
          }

          .visual-heading h1 {
            font-size: 25px;
          }

          .visual-heading p {
            font-size: 13px;
            margin-top: 6px;
          }

          .farm-scene {
            max-width: 570px;
            margin-top: 3px;
          }

          .farm-footer {
            margin-top: 4px;
            gap: 8px 15px;
            font-size: 11px;
          }

          .auth-panel {
            min-height: auto;
            padding: 22px 16px 28px;
          }

          .login-card {
            max-width: 470px;
            padding: 26px 22px;
          }

          .copyright {
            margin-top: 18px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .buffalo-motion,
          .buffalo-tail,
          .buffalo-leg,
          .farmer-motion,
          .farmer-leg,
          .milk-can,
          .sun-glow,\n          .milk-glass-left,\n          .milk-glass-right {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  )
}
