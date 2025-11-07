import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from './theme/ThemeProvider'
import { login, logout, onUser, auth, db } from './lib/firebase'
import { useAdaptiveTest, Item } from './hooks/useAdaptiveTest'
import { collection, addDoc, getDocs, query, where, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { AttemptTable } from './components/AttemptTable'
import { LevelHistogram } from './components/LevelHistogram'
import { SubjectSelector } from './components/SubjectSelector'
import { BankSelector } from './components/BankSelector'
import { BankEditor } from './components/BankEditor'
import { ItemManager } from './components/ItemManager'
import { AdminPanel } from './components/AdminPanel'
import { AIGenerator } from './components/AIGenerator'
import { ModeSelector } from './components/ModeSelector'
import { AdaptativeExamGenerator } from './components/AdaptativeExamGenerator'
import { LoginScreen } from './components/LoginScreen'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { ThemeToggle } from './ui/ThemeToggle'
import { useToast } from './ui/toast'

type Role = 'student' | 'teacher' | 'admin'
type ExamMode = 'adaptive' | 'adapted' | null

const policy = { minItems: 8, maxItems: 18, stabilizationDelta: 0.25, stabilizationWindow: 3, startLevel: 3 as const }

async function ensureUserDoc() {
  const u = auth.currentUser
  if (!u) return null
  const ref = doc(db, 'users', u.uid)
  const snap = await getDoc(ref)
  // Determina rol por allowlist (roles/{email}) o por dominio
  let allowRole: Role = 'student'
  if (u.email) {
    const allowSnap = await getDoc(doc(db, 'roles', u.email))
    if (allowSnap.exists()) {
      const rr = (allowSnap.data() as any).role
      if (rr === 'teacher' || rr === 'admin') allowRole = rr
    }
  }
  if (!snap.exists()) {
    const newRole: Role = allowRole || (u.email?.endsWith('@colegiovicentepaul.es') ? 'teacher' : 'student')
    await setDoc(ref, { role: newRole, displayName: u.displayName || '', email: u.email || '', createdAt: serverTimestamp() })
    return newRole
  } else {
    const data = snap.data() as any
    const storedRole: Role = (data.role || 'student') as Role
    const desiredRole: Role = allowRole || (u.email?.endsWith('@colegiovicentepaul.es') ? 'teacher' : 'student')
    if (storedRole !== desiredRole || data.displayName !== (u.displayName || '') || data.email !== (u.email || '')) {
      await setDoc(ref, { role: desiredRole, displayName: u.displayName || '', email: u.email || '' }, { merge: true })
      return desiredRole
    }
    return storedRole
  }
}

async function seedDemoBank() {
  const bank = await addDoc(collection(db, 'banks'), {
    name: 'Banco demo — Matemáticas',
    subject: 'math',
    scale: { min: 1, max: 5 },
    policy
  })
  const bankId = bank.id
  const items: Item[] = [
    { id:'', stem:'2 + 2 = ?', options:[{key:'A',text:'3'},{key:'B',text:'4'},{key:'C',text:'5'},{key:'D',text:'2'}], correctKey:'B', level:1 },
    { id:'', stem:'5 × 6 = ?', options:[{key:'A',text:'11'},{key:'B',text:'35'},{key:'C',text:'30'},{key:'D',text:'56'}], correctKey:'C', level:2 },
    { id:'', stem:'Raíz cuadrada de 81', options:[{key:'A',text:'8'},{key:'B',text:'9'},{key:'C',text:'7'},{key:'D',text:'6'}], correctKey:'B', level:3 },
    { id:'', stem:'Derivada de x^2', options:[{key:'A',text:'x'},{key:'B',text:'2x'},{key:'C',text:'x^3'},{key:'D',text:'2'}], correctKey:'B', level:4 },
    { id:'', stem:'Límite de (sin x)/x cuando x→0', options:[{key:'A',text:'0'},{key:'B',text:'1'},{key:'C',text:'No existe'},{key:'D',text:'∞'}], correctKey:'B', level:5 },
  ]
  for (const it of items) {
    await addDoc(collection(db, 'items'), {
      bankId,
      stem: it.stem,
      options: it.options,
      correctKey: it.correctKey,
      level: it.level,
      tags: []
    })
  }
  return bankId
}

async function fetchItems(bankId:string) {
  const qRef = query(collection(db, 'items'), where('bankId','==', bankId))
  const snap = await getDocs(qRef)
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any[]
}

export default function App() {
  const { isDarkMode, toggleTheme } = useTheme()
  const { show } = useToast()
  const [user, setUser] = useState<any>(null)
  const [role, setRole] = useState<Role>('student')
  const [tab, setTab] = useState<'test'|'dashboard'|'admin'>('test')
  const [examMode, setExamMode] = useState<ExamMode>(null)

  const [started, setStarted] = useState(false)
  const [subject, setSubject] = useState<string>('')
  const [bankId, setBankId] = useState<string>('')
  const [items, setItems] = useState<Item[]>([])
  const test = useAdaptiveTest(items, policy)
  const hasStartedRef = useRef(false)

  useEffect(() => onUser(async (u)=>{
    setUser(u)
    if (u) {
      const r = await ensureUserDoc()
      if (r) setRole(r)
    } else {
      setRole('student')
      setExamMode(null) // Resetear modo al desloguearse
    }
  }), [])

  // Resetear modo al cambiar de pestaña
  useEffect(() => {
    if (tab !== 'dashboard') {
      setExamMode(null)
    }
  }, [tab])

  async function startWithBank(id:string) {
    // Reinicia el estado del test al cambiar de banco
    test.reset()
    hasStartedRef.current = false
    setBankId(id)
    const loaded = await fetchItems(id)
    const normalized: Item[] = loaded.map((it:any) => ({
      id: it.id,
      stem: it.stem,
      options: it.options,
      correctKey: it.correctKey,
      level: it.level
    }))
    setItems(normalized)
    setStarted(true)
    setTab('test')
  }

  async function seedAndStart() {
    const id = await seedDemoBank()
    await startWithBank(id)
    show('Banco demo creado y cargado', 'success')
  }

  async function saveAttemptFinished() {
    if (!user) return
    await addDoc(collection(db, 'attempts'), {
      userId: user.uid,
      bankId,
      startAt: new Date().toISOString(),
      status: 'active',
      history: test.history,
      thetaEstimate: test.estimate,
      levelEstimate: Math.round(test.estimate)
    })
    show('Intento guardado', 'success')
  }

  // Arranca el test de forma segura cuando los ítems están listos
  // Evita dobles arranques en StrictMode con una ref
  useEffect(() => {
    if (started && items.length > 0 && !hasStartedRef.current) {
      test.start()
      hasStartedRef.current = true
    }
  }, [started, items])

  function restartTest() {
    test.reset()
    hasStartedRef.current = false
    // Reiniciar el ciclo de arranque de forma explícita
    setStarted(false)
    setTimeout(() => {
      setStarted(true)
    }, 0)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--secondary-bg)' }}>
      <header className="p-4 border-b bg-blue-600 text-white flex items-center justify-between">
        <h1 className="font-semibold">ExAdapta — Exámenes Adaptativos y Adaptados</h1>
        <div className="flex items-center gap-3">
          <nav className="hidden sm:flex gap-2 mr-4">
            <Button onClick={()=>setTab('test')} variant={tab==='test'?'ghost':'outline'} size="sm" className="text-white border-white/50 hover:bg-white/10">Estudiante</Button>
            {(role==='teacher' || role==='admin') && (
              <Button onClick={()=>setTab('dashboard')} variant={tab==='dashboard'?'ghost':'outline'} size="sm" className="text-white border-white/50 hover:bg-white/10">Panel docente</Button>
            )}
            {role==='admin' && (
              <Button onClick={()=>setTab('admin')} variant={tab==='admin'?'ghost':'outline'} size="sm" className="text-white border-white/50 hover:bg-white/10">Admin</Button>
            )}
          </nav>
          {user && <span className="text-sm opacity-90">{user.email} · <em>{role}</em></span>}
          <ThemeToggle />
          {user ? (
            <Button onClick={logout} variant="outline" size="sm" className="text-white border-white/50 hover:bg-white/10">Salir</Button>
          ) : (
            <Button onClick={login} variant="outline" size="sm" className="text-white border-white/50 hover:bg-white/10">Entrar con Google</Button>
          )}
        </div>
      </header>

      <main className="p-6 grid place-items-center">
        {!user ? (
          <LoginScreen />
        ) : (
          <Card className="w-full max-w-5xl">
            {tab === 'dashboard' && (role === 'teacher' || role === 'admin') ? (
            // Mostrar selector de modo si no se ha seleccionado uno
            examMode === null ? (
              <ModeSelector onSelect={(mode) => {
                setExamMode(mode)
                if (mode === 'adaptive') {
                  // Si selecciona adaptativo, mostrar el dashboard existente
                } else {
                  // Si selecciona adaptado, mostrar el generador
                }
              }} />
            ) : examMode === 'adaptive' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Exámenes Adaptativos</h2>
                  <Button onClick={() => setExamMode(null)} variant="outline" size="sm">
                    Cambiar modo
                  </Button>
                </div>
                <TeacherDashboard onSeedAndStart={seedAndStart} onStartWithBank={startWithBank} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Exámenes Adaptados</h2>
                  <Button onClick={() => setExamMode(null)} variant="outline" size="sm">
                    Cambiar modo
                  </Button>
                </div>
                <AdaptativeExamGenerator />
              </div>
            )
          ) : tab === 'admin' && role === 'admin' ? (
            <AdminPanel />
          ) : (
            <div className="space-y-6">
              {!started && (
                <div className="rounded-xl border bg-blue-50/40 p-4">
                  <h2 className="text-base font-semibold text-blue-900">Configura tu examen</h2>
                  <p className="text-sm text-blue-900/80 mt-1">Elige asignatura y banco de preguntas.</p>
                  <div className="mt-4 flex flex-wrap gap-4 items-center">
                    <SubjectSelector value={subject} onChange={(s)=>{ setSubject(s); setBankId('') }} />
                    <BankSelector value={bankId} onChange={setBankId} subject={subject || undefined} />
                    <Button disabled={!bankId} onClick={()=>startWithBank(bankId)} variant={bankId? 'primary':'ghost'}>Empezar examen</Button>
                  </div>
                </div>
              )}
              <TestView policy={policy} started={started} level={test.level} estimate={test.estimate} finished={test.finished} current={test.current} history={test.history} answer={test.answer} onBegin={()=>setStarted(true)} onSave={saveAttemptFinished} onReset={restartTest} />
            </div>
          )}
          </Card>
        )}
      </main>
    </div>
  )
}

function TestView({ policy, started, level, estimate, finished, current, history, answer, onBegin, onSave, onReset } : any) {
  return (
    <div>
      {!started ? (
        <div>
          <p className="text-gray-600">Responde a cada pregunta. El nivel se ajusta automáticamente.</p>
          <div className="mt-6">
            <Button variant="primary" onClick={onBegin}>Comenzar</Button>
          </div>
        </div>
      ) : finished ? (
        <div>
          <h2 className="text-xl font-semibold">Completado</h2>
          <p className="mt-2">Nivel estimado: <strong>{estimate.toFixed(2)}</strong></p>
          <div className="mt-4 flex gap-2">
            <Button onClick={onSave} variant="outline" size="sm">Guardar intento</Button>
            <Button onClick={onReset} variant="ghost" size="sm">Reiniciar test</Button>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600">Ver trazas</summary>
            <pre className="mt-2 text-xs bg-gray-100 p-3 rounded-xl overflow-auto">{JSON.stringify(history, null, 2)}</pre>
          </details>
        </div>
      ) : !current ? (
        <div>Cargando ítem…</div>
      ) : (
        <div>
          <div className="flex justify-end mb-2">
            <Button onClick={onReset} size="sm" variant="ghost" className="text-xs">Reiniciar</Button>
          </div>
          <div className="mb-2">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Progreso</span>
              <span>{history.length + 1} / {policy.maxItems}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded">
              <div className="h-2 bg-blue-500 rounded" style={{ width: `${Math.min(((history.length + 1) / policy.maxItems) * 100, 100)}%` }} />
            </div>
          </div>
          <div className="text-sm text-gray-500">Nivel actual: L{level}</div>
          <h2 className="text-lg font-semibold mt-2">{current.stem}</h2>
          <div className="mt-4 grid gap-2">
              {current.options.map((opt:any) => (
                <Button key={opt.key} onClick={()=>answer(opt.key)} variant="outline" className="w-full text-left">
                  <span className="font-mono mr-2">{opt.key}.</span> {opt.text}
                </Button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TeacherDashboard({ onSeedAndStart, onStartWithBank } : any) {
  const [selected, setSelected] = useState<string>('')
  const [banks, setBanks] = useState<any[]>([])
  const [attempts, setAttempts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'banks'))
      setBanks(snap.docs.map(d => ({ id: d.id, ...(d.data() as any)})))
    })()
  }, [])

  useEffect(() => {
    if (!selected) return
    ;(async () => {
      setLoading(true)
      const qRef = query(collection(db, 'attempts'), where('bankId','==', selected))
      const snap = await getDocs(qRef)
      setAttempts(snap.docs.map(d => ({ id: d.id, ...(d.data() as any)})))
      setLoading(false)
    })()
  }, [selected])

  const distribution = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of attempts) {
      const lvl = String(a.levelEstimate ?? '?')
      counts[lvl] = (counts[lvl] ?? 0) + 1
    }
    return Object.entries(counts)
      .filter(([k]) => k !== '?')
      .map(([k,v]) => ({ level: k, count: v as number }))
      .sort((a,b)=> Number(a.level)-Number(b.level))
  }, [attempts])

  function exportCSV() {
    if (!attempts.length) return
    const headers = ['id','userId','bankId','thetaEstimate','levelEstimate','status','startAt']
    const rows = attempts.map(a => [a.id, a.userId, a.bankId, a.thetaEstimate, a.levelEstimate, a.status, a.startAt])
    const escape = (x:any) => {
      const s = (x===undefined||x===null)?'':String(x)
      return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s
    }
    const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attempts_${selected}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onSeedAndStart} variant="primary">Sembrar banco demo y empezar</Button>
        <div className="h-6 w-px bg-gray-200" />
        <label className="text-sm text-gray-600">Seleccionar banco:</label>
        <select value={selected} onChange={(e)=>setSelected(e.target.value)} className="border rounded-lg px-3 py-2">
          <option value="">— Selecciona —</option>
          {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <Button disabled={!selected} onClick={()=>onStartWithBank(selected)} variant={selected? 'outline':'ghost'} size="sm">Comenzar test con este banco</Button>
        <Button disabled={!attempts.length} onClick={exportCSV} variant={attempts.length? 'outline':'ghost'} size="sm">Exportar CSV</Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <AIGenerator onCreated={(id)=>{ setBanks(b=>[{ id, name: 'Banco IA', subject: '', policy: {}, scale:{} }, ...b]); setSelected(id) }} />
          <BankEditor onCreated={(id)=>{ setBanks(b=>[{ id, name: 'Nuevo banco', subject: '', policy: {}, scale:{} }, ...b]); setSelected(id) }} />
          {selected && <BankEditor bankId={selected} onUpdated={()=>{ /* refresh banks label */ }} />}
        </div>
        <div>
          {selected ? (
            <ItemManager bankId={selected} />
          ) : (
            <div className="rounded-xl border p-4 text-sm text-gray-600">Selecciona o crea un banco para gestionar sus preguntas.</div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Resultados</h3>
        {loading ? <p>Cargando intentos…</p> : (
          <>
            <LevelHistogram entries={distribution} />
            <AttemptTable attempts={attempts} />
          </>
        )}
      </div>
    </div>
  )
}
