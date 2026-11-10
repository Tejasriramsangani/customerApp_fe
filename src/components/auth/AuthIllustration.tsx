import Image from 'next/image';
import styles from './Authentication.module.css';
export function AuthIllustration({ kind }: {
    kind: 'login' | 'otp' | 'avatar';
}) {
    if (kind === 'otp')
        return <div className={styles.otpHero}>
    <svg className={styles.otpArt} viewBox="0 0 280 280" role="img" aria-label="A phone with a verification message and green leaves">
      <circle cx="140" cy="140" r="112" fill="#e8efce"/>
      <path d="M84 236C25 199 25 135 41 104c42 22 56 71 43 132M83 235c-42-6-65-29-70-63 40 1 63 21 70 63M202 235c39-29 54-64 45-94-30 14-43 44-45 94" fill="#74a94a"/>
      <g transform="rotate(-8 140 140)"><rect x="84" y="31" width="118" height="211" rx="20" fill="#1B5E3A" stroke="#0c422d" strokeWidth="5"/><rect x="94" y="42" width="98" height="187" rx="12" fill="#FFFEF8"/><path d="M120 42h47v10q0 6-7 6h-33q-7 0-7-6Z" fill="#1B5E3A"/></g>
      <path d="M118 111h112q12 0 12 12v49q0 12-12 12h-65l-23 17v-17h-24q-12 0-12-12v-49q0-12 12-12Z" fill="#1B5E3A" stroke="#0c422d" strokeWidth="2"/>
      {[124, 144, 164, 184, 204, 224].map(cx => <circle key={cx} cx={cx} cy="147" r="4" fill="#FEFEFE"/>)}
      <path d="m226 69 11-25m5 43 19-10" stroke="#FFC615" strokeWidth="10" strokeLinecap="round"/>
    </svg>
  </div>;
    return <div className={kind === 'avatar' ? styles.avatar : styles.hero}>
    <Image src={kind === 'avatar' ? '/onboarding/Trusted Recycling Collection Crew.png' : '/onboarding/Payment Received_ Recycling Made Easy.png'} alt={kind === 'avatar' ? 'Friendly ASLI KAATA collection professional' : 'A customer using her phone beside an ASLI KAATA pickup vehicle'} fill sizes="(max-width: 430px) 100vw, 430px" loading="eager" className={kind === 'avatar' ? styles.avatarImage : styles.heroImage}/>
  </div>;
}
