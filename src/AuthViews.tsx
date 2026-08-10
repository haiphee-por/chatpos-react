import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Building2, CheckCircle2, Eye, EyeOff, LayoutDashboard, ShieldCheck, Store, UsersRound } from 'lucide-react'
import './AuthViews.css'

type Role = 'admin' | 'pd' | 'agent' | 'merchant'
const roles: { id: Role; label: string; description: string; icon: typeof LayoutDashboard; path: string }[] = [
  { id: 'admin', label: 'Admin', description: 'จัดการระบบและ workflow ทั้งหมด', icon: LayoutDashboard, path: '/login' },
  { id: 'pd', label: 'PD', description: 'ตรวจ KYC และดูแล Agent ในสาย', icon: Building2, path: '/pd/login' },
  { id: 'agent', label: 'Agent', description: 'ดูแลร้านค้าและส่งงาน KYC', icon: UsersRound, path: '/agent/login' },
  { id: 'merchant', label: 'Merchant', description: 'บริหารร้านค้า POS ออเดอร์ และยอดขาย', icon: Store, path: '/merchant/login' },
]
const copy: Record<Role, { eyebrow: string; title: string; subtitle: string; email: string; password: string }> = {
  admin: { eyebrow: 'CONTROL CENTER', title: 'เข้าสู่ระบบ Admin', subtitle: 'จัดการ PD, Agent, KYC และการปฏิบัติงานของ ChatPOS', email: 'admin@chatpos.biz', password: 'รหัสผ่าน Admin' },
  pd: { eyebrow: 'PD OPERATIONS', title: 'เข้าสู่ระบบ PD', subtitle: 'ตรวจ KYC ขั้นสุดท้ายและดูแล Agent ในพื้นที่ของคุณ', email: 'pd@chatpos.biz', password: 'รหัสผ่าน PD' },
  agent: { eyebrow: 'AGENT PORTAL', title: 'เข้าสู่ระบบ Agent', subtitle: 'จัดการร้านค้า รับคำขอ และดำเนินการ KYC', email: 'agent@chatpos.biz', password: 'รหัสผ่าน Agent' },
  merchant: { eyebrow: 'MERCHANT PORTAL', title: 'เข้าสู่ระบบร้านค้า', subtitle: 'บริหารร้านค้า POS ออเดอร์ สต็อก และยอดขายของคุณ', email: 'owner@store.com', password: 'รหัสผ่านร้านค้า' },
}

export function LoginView({ role }: { role: Role }) {
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const content = copy[role]
  const currentRole = roles.find((item) => item.id === role) ?? roles[0]
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); window.location.href = role === 'admin' ? '/admin' : `/${role}` }
  return <div className="auth-shell"><div className="auth-brand"><div className="brand-mark">CP</div><div><strong>ChatPOS</strong><span>CONTROL CENTER</span></div></div><main className="auth-layout"><section className="auth-intro"><p className="auth-kicker">{content.eyebrow}</p><h1>{content.title}</h1><p>{content.subtitle}</p><div className="auth-trust"><ShieldCheck size={18} /><span>ระบบปลอดภัยสำหรับทีม ChatPOS</span></div><div className="auth-preview"><div className="preview-top"><span /><span /><span /></div><div className="preview-grid"><div /><div /><div /><div /><div /><div /></div></div></section><section className="auth-card"><div className="auth-card-heading"><div><p className="auth-kicker">WELCOME BACK</p><h2>ยินดีต้อนรับกลับมา</h2><p>เลือก role และกรอกข้อมูลเพื่อเข้าสู่ระบบ</p></div><div className="auth-check"><CheckCircle2 size={16} /></div></div><div className="role-switcher" aria-label="เลือก role">{roles.map(({ id, label, icon: RoleIcon, path }) => <button className={role === id ? 'selected' : ''} key={id} onClick={() => { window.location.href = path }} type="button"><RoleIcon size={17} /><span>{label}</span></button>)}</div><p className="role-description">{currentRole.description}</p><form onSubmit={submit}><label>อีเมลหรือรหัส Agent<input defaultValue={content.email} name="email" type="email" autoComplete="username" /></label><label>รหัสผ่าน<div className="password-input"><input name="password" placeholder={content.password} type={showPassword ? 'text' : 'password'} autoComplete="current-password" /><button aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} onClick={() => setShowPassword((visible) => !visible)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label><div className="form-options"><label className="remember"><input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" /> จดจำการเข้าสู่ระบบ</label><button className="forgot" onClick={() => setError('กรุณาติดต่อผู้ดูแลระบบเพื่อ reset รหัสผ่าน')} type="button">ลืมรหัสผ่าน?</button></div>{error && <p className="auth-error">{error}</p>}<button className="login-submit" type="submit">เข้าสู่ระบบ <ArrowRight size={17} /></button></form><p className="auth-help">มีปัญหาในการเข้าสู่ระบบ? ติดต่อ <a href="mailto:support@chatpos.biz">Support ChatPOS</a></p></section></main><footer className="auth-footer"><span>© 2026 ChatPOS</span><span>Privacy · Security · Status</span></footer></div>
}
