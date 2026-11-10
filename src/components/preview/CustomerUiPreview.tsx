'use client';
import { useEffect, useState } from 'react';
import { AuthProvider } from '../../context/AuthContext';
import { LocationProvider, useLocation } from '../../context/LocationContext';
import { PickupBookingProvider } from '../../context/PickupBookingContext';
import { apiClient } from '../../lib/api-client';
import { createPreviewTransport, previewUser, previewPlace } from '../../lib/ui-preview-data';
import { TopAppBar } from '../layout/TopAppBar';
import { BottomNavbar, NavTab } from '../layout/BottomNavbar';
import { HeroPromoCarousel } from '../home/HeroPromoCarousel';
import { TodayScrapRatesPreview } from '../home/TodayScrapRatesPreview';
import { OurApproachSection } from '../home/OurApproachSection';
import { ScrapRatesScreen } from '../catalog/ScrapRatesScreen';
import { MyPickupsScreen } from '../pickups/MyPickupsScreen';
import { ProfileScreen } from '../profile/ProfileScreen';
import { AddAddressForm } from '../profile/AddAddressForm';
import { BookingWizardModal } from '../booking/BookingWizardModal';
import { LoginScreen } from '../auth/LoginScreen';
import { OtpVerificationScreen } from '../auth/OtpVerificationScreen';
import { PersonalizationScreen } from '../auth/PersonalizationScreen';
import { OnboardingCarousel } from '../onboarding/OnboardingCarousel';

function Screens({ screen, change }: { screen: string; change: (screen: string) => void }) {
  const [tab, setTab] = useState<NavTab>('home');
  const { setLocation } = useLocation();
  useEffect(() => { setLocation({ ...previewPlace, source: 'manual', addressId: '640000000000000000000004' }); }, [setLocation]);
  const home = () => change('app');
  if (screen === 'login') return <LoginScreen onBack={home} onOtpSent={() => change('otp')} />;
  if (screen === 'otp') return <OtpVerificationScreen mobileNumber={previewUser.mobile} onBack={() => change('login')} onEditMobile={() => change('login')} onSuccess={home} />;
  if (screen === 'personalize') return <PersonalizationScreen onBack={home} onComplete={home} />;
  if (screen === 'onboarding') return <OnboardingCarousel onComplete={home} />;
  if (screen === 'address') return <div className="customer-main p-4"><AddAddressForm initialPlace={previewPlace} onSaved={home} onCancel={home} /></div>;
  return <div className="customer-screen flex flex-col min-h-0"><TopAppBar onNotificationClick={() => {}} />
    <main className="customer-main px-4 py-4">
      {tab === 'home' && <div className="space-y-4"><HeroPromoCarousel areaName={previewPlace.areaName} onBookPickup={() => setTab('request')} /><TodayScrapRatesPreview onViewAll={() => setTab('rates')} /><OurApproachSection /></div>}
      {tab === 'rates' && <ScrapRatesScreen areaName={previewPlace.areaName} onBookPickup={() => setTab('request')} />}
      {tab === 'pickups' && <MyPickupsScreen onOpenPickupDetails={() => {}} onRequestNewPickup={() => setTab('request')} />}
      {tab === 'profile' && <ProfileScreen onEditName={() => change('personalize')} onLogout={() => change('login')} />}
      {tab === 'request' && <BookingWizardModal onClose={() => setTab('home')} onGoToPickups={() => setTab('pickups')} onGoToHome={() => setTab('home')} />}
    </main><BottomNavbar activeTab={tab} onTabChange={setTab} /></div>;
}
export function CustomerUiPreview() {
  const [ready, setReady] = useState(false), [screen, setScreen] = useState('app');
  useEffect(() => {
    let active = true;
    if (process.env.NODE_ENV !== 'development' || window.location.origin !== 'http://127.0.0.1:3010') return;
    void fetch('/__ui-preview/session', { cache: 'no-store' }).then(async response => {
      if (!response.ok || !(await response.json()).preview || !active) return;
      apiClient.installUiPreview(createPreviewTransport()); setReady(true);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!ready) return <p>Preview locked. Use the isolated local preview server.</p>;
  return <div className="flex flex-col flex-1 min-h-0">
    <aside aria-label="UI preview controls" style={{ background: '#fff3cd', color: '#422006', padding: '8px', fontSize: '12px', position: 'relative', zIndex: 100000, flexShrink: 0 }}>
      <strong>UI PREVIEW — synthetic customer, not authenticated.</strong><br />No OTP delivery, backend, live Maps, GPS or uploads. Edits reset on refresh.<br />
      <label>Screen <select aria-label="Preview screen" value={screen} onChange={event => setScreen(event.target.value)}>
        {['app', 'login', 'otp', 'personalize', 'onboarding', 'address'].map(value => <option key={value}>{value}</option>)}
      </select></label>{' '}<button onClick={async () => { await fetch('/__ui-preview/session', { method: 'DELETE' }); window.location.replace('/'); }}>Lock preview</button>
    </aside><AuthProvider previewUser={previewUser}><LocationProvider><PickupBookingProvider><Screens key={screen} screen={screen} change={setScreen} /></PickupBookingProvider></LocationProvider></AuthProvider>
  </div>;
}
