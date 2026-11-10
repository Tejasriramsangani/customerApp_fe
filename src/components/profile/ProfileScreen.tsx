"use client";

import { Button, DialogSurface } from '../ui';
import React, { useState, useEffect } from 'react';
import {
  MapPin,
  CreditCard,
  Bell,
  HelpCircle,
  Info,
  Globe,
  LogOut,
  ChevronRight,
  Edit2,
  ShieldCheck,
  Plus,
  Trash2,
  X,
  Check,
  Phone,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { apiClient } from '../../lib/api-client';
import { AddAddressForm } from './AddAddressForm';
import {
  MAX_SAVED_ADDRESSES,
  SavedAddress,
  addressIdOf,
  addressLine,
  addressTitle,
  fetchSavedAddresses,
  nextAddressLabel,
} from '../../lib/address-helpers';

interface ProfileScreenProps {
  onEditName: () => void;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onEditName,
  onLogout,
}) => {
  const { user, updateUser } = useAuth();
  const { location } = useLocation();

  // Sub-modal states
  const [activeModal, setActiveModal] = useState<
    'addresses' | 'payment' | 'notifications' | 'help' | 'about' | 'language' | null
  >(null);

  // Addresses state
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  // Payment preference
  const [paymentPref, setPaymentPref] = useState<'CASH' | 'UPI'>('CASH');

  // Notifications toggles
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);

  // Language
  const [language, setLanguage] = useState<'en' | 'te'>('en');

  // Load addresses from backend
  useEffect(() => {
    const fetchAddresses = async () => {
      try {
        const [profileRes, addressRes] = await Promise.all([
          apiClient.getProfile<any>(),
          apiClient.get<SavedAddress[]>('/customer/addresses'),
        ]);
        if (profileRes.success) updateUser({ fullName: profileRes.data?.fullName });
        if (addressRes.success && Array.isArray(addressRes.data)) setAddresses(addressRes.data);
      } catch {}
    };
    fetchAddresses();
  }, []);

  // Reload from the server: primary flags and labels are decided there (a new address may become primary,
  // deleting the primary promotes another).
  const reloadAddresses = async () => setAddresses(await fetchSavedAddresses());

  const handleAddressSaved = async () => {
    setIsAddingAddress(false);
    await reloadAddresses();
  };

  const makePrimary = async (addr: SavedAddress) => {
    try {
      await apiClient.put(`/customer/addresses/${addressIdOf(addr)}/primary`);
    } catch {}
    await reloadAddresses();
  };

  const handleDeleteAddress = async (id?: string) => {
    if (!id) return;
    try {
      const res = await apiClient.delete(`/customer/addresses/${id}`);
      if (res.success) await reloadAddresses();
    } catch {}
  };

  const userName = user?.fullName || '—';
  const userInitial = userName === '—' ? '?' : userName.charAt(0).toUpperCase();
  const userMobile = user?.mobile ? `+91 ${user.mobile}` : '—';

  return (
    <div className="w-full flex flex-col space-y-4 animate-in fade-in">
      {/* 1. Profile Header Card (Screen 10) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-linear-to-br from-brand to-brand text-white flex items-center justify-center font-bold text-2xl shadow-md border-2 border-emerald-100">
              {userInitial}
            </div>
            <Button aria-label="Edit Profile"
              onClick={onEditName}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-xs text-slate-700 hover:text-emerald-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Edit Profile"
            >
              <Edit2 className="w-3 h-3 stroke-[2.5]" />
            </Button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight truncate">
                {userName}
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                <ShieldCheck className="w-3 h-3 text-emerald-700" />
                Verified
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {userMobile}
            </p>

            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-1 truncate">
              <MapPin className="w-3 h-3 text-emerald-700 shrink-0" />
              <span>{location.areaName}, {location.city}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 2. Menu Options List (Screen 10) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 divide-y divide-slate-100 shadow-xs overflow-hidden">
        {/* Item 1: My Addresses */}
        <Button aria-label="Next"
          onClick={() => setActiveModal('addresses')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <MapPin className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-900">My Addresses</p>
              <p className="text-[11px] text-slate-400">Manage pickup locations & landmarks</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Button>

        {/* Item 2: Payment Methods */}
        <Button aria-label="Next"
          onClick={() => setActiveModal('payment')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
              <CreditCard className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-900">Payment Preferences</p>
              <p className="text-[11px] text-slate-400">
                Device preference: {paymentPref === 'CASH' ? 'Cash on pickup' : 'Instant UPI'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Button>

        {/* Item 3: Notifications */}
        <Button aria-label="Next"
          onClick={() => setActiveModal('notifications')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
              <Bell className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-900">Notifications</p>
              <p className="text-[11px] text-slate-400">Device preferences for push updates & SMS</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Button>

        {/* Item 4: Help & Support */}
        <Button aria-label="Next"
          onClick={() => setActiveModal('help')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center">
              <HelpCircle className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-900">Help & Support</p>
              <p className="text-[11px] text-slate-400">FAQs & WhatsApp assistance</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Button>

        {/* Item 5: About Us */}
        <Button aria-label="Next"
          onClick={() => setActiveModal('about')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center">
              <Info className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-900">About ASLI KAATA</p>
              <p className="text-[11px] text-slate-400">Real Weight. Real Value. Mission</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Button>

        {/* Item 6: Language */}
        <Button aria-label="Next"
          onClick={() => setActiveModal('language')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Globe className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-900">Language</p>
              <p className="text-[11px] text-slate-400">
                Device preference: {language === 'en' ? 'English' : 'తెలుగు (Telugu)'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Button>
      </div>

      {/* 3. Logout Button Card */}
      <div className="bg-white rounded-3xl p-4 border border-rose-100 shadow-2xs">
        <Button aria-label="Sign out"
          onClick={onLogout}
          className="w-full py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 active:scale-[0.99] text-rose-600 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out of Account</span>
        </Button>
      </div>

      {/* SUB-MODAL 1: My Addresses */}
      {activeModal === 'addresses' && (
        <div className="fixed inset-0 z-50 bg-black/60  flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <DialogSurface onClose={() => setActiveModal(null)} label="Saved Addresses" className="customer-modal-panel bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Saved Addresses</h3>
              <Button aria-label="Close"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="overflow-y-auto my-3 space-y-2 flex-1 pr-1">
              {addresses.map((addr) => (
                <div
                  key={addr._id || addr.id}
                  className="p-3 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">{addressTitle(addr)}</span>
                      {addr.isDefault && (
                        <span className="text-[11px] font-bold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-800">{addressLine(addr)}</p>
                    {addr.landmark && (
                      <p className="text-[11px] text-slate-500">Landmark: {addr.landmark}</p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      {addr.city}, {addr.state} - {addr.pincode}
                    </p>
                    {!addr.isDefault && (
                      <Button
                        type="button"
                        onClick={() => makePrimary(addr)}
                        className="text-[11px] font-bold text-emerald-800 hover:underline pt-1 cursor-pointer"
                      >
                        Make primary
                      </Button>
                    )}
                  </div>
                  {addresses.length > 1 && (
                    <Button aria-label="Delete"
                      onClick={() => handleDeleteAddress(addr._id || addr.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}

              {isAddingAddress ? (
                <AddAddressForm
                  onSaved={handleAddressSaved}
                  onCancel={() => setIsAddingAddress(false)}
                  defaultLabel={nextAddressLabel(addresses)}
                />
              ) : addresses.length < MAX_SAVED_ADDRESSES ? (
                <Button aria-label="Add"
                  onClick={() => setIsAddingAddress(true)}
                  className="w-full py-2.5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-600 text-xs font-bold text-slate-600 hover:text-emerald-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{addresses.length === 0 ? 'Add Address' : 'Add Another Address'}</span>
                </Button>
              ) : (
                <p className="text-[11px] text-slate-400 text-center py-1">
                  You can save up to {MAX_SAVED_ADDRESSES} addresses. Delete one to add another.
                </p>
              )}
            </div>
          </DialogSurface>
        </div>
      )}

      {/* SUB-MODAL 2: Payment Preferences */}
      {activeModal === 'payment' && (
        <div className="fixed inset-0 z-50 bg-black/60  flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <DialogSurface onClose={() => setActiveModal(null)} label="Payment Preferences" className="customer-modal-panel bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Payment Preferences</h3>
              <Button aria-label="Close"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="my-4 space-y-2">
              <label
                onClick={() => setPaymentPref('CASH')}
                className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer ${
                  paymentPref === 'CASH'
                    ? 'border-brand bg-emerald-50 text-brand font-bold'
                    : 'border-slate-200 bg-white text-slate-700 font-medium'
                }`}
              >
                <div>
                  <p className="text-xs">Cash (Pay on Doorstep)</p>
                  <p className="text-[11px] text-slate-400">Receive cash in hand after weigh-in</p>
                </div>
                {paymentPref === 'CASH' && <Check className="w-4 h-4" />}
              </label>

              <label
                onClick={() => setPaymentPref('UPI')}
                className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer ${
                  paymentPref === 'UPI'
                    ? 'border-brand bg-emerald-50 text-brand font-bold'
                    : 'border-slate-200 bg-white text-slate-700 font-medium'
                }`}
              >
                <div>
                  <p className="text-xs">Instant UPI Transfer</p>
                  <p className="text-[11px] text-slate-400">Transferred directly to your phone number / VPA</p>
                </div>
                {paymentPref === 'UPI' && <Check className="w-4 h-4" />}
              </label>
            </div>

            <Button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-brand text-white text-xs font-bold"
            >
              Done
            </Button>
          </DialogSurface>
        </div>
      )}

      {/* SUB-MODAL 3: Help & Support */}
      {activeModal === 'help' && (
        <div className="fixed inset-0 z-50 bg-black/60  flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <DialogSurface onClose={() => setActiveModal(null)} label="Help & Support" className="customer-modal-panel bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Help & Support</h3>
              <Button aria-label="Close"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="font-medium text-slate-900">How does weigh-in work?</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Our executive brings an ISO-certified digital weighing scale. The weight is visible to you, and rates are locked transparently.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="font-medium text-slate-900">What if I have bulk scrap?</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Orders over bulk thresholds get dedicated pickers assigned directly with higher transport capacity.
                </p>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </a>
              <a
                href="tel:9876543210"
                className="flex-1 py-2.5 rounded-xl bg-brand text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Phone className="w-3.5 h-3.5" />
                Call Helpline
              </a>
            </div>
          </DialogSurface>
        </div>
      )}

      {/* SUB-MODAL 4: About Us */}
      {activeModal === 'about' && (
        <div className="fixed inset-0 z-50 bg-black/60  flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <DialogSurface onClose={() => setActiveModal(null)} label="About ASLI KAATA" className="customer-modal-panel bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">About ASLI KAATA</h3>
              <Button aria-label="Close"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                <strong>ASLI KAATA</strong> represents transparency and honesty in doorstep scrap collection.
              </p>
              <p>
                <strong className="data-value">Real Weight. Real Value:</strong> We eliminate faulty mechanical scales by mandating digital precision scales and itemized receipt vouchers.
              </p>
              <p className="text-[11px] text-slate-400">
                Operating proudly across Vijayawada and Krishna District.
              </p>
            </div>

            <Button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-brand text-white text-xs font-bold mt-2"
            >
              Close
            </Button>
          </DialogSurface>
        </div>
      )}

      {/* SUB-MODAL 5: Language */}
      {activeModal === 'language' && (
        <div className="fixed inset-0 z-50 bg-black/60  flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <DialogSurface onClose={() => setActiveModal(null)} label="Select Language" className="customer-modal-panel bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Select Language</h3>
              <Button aria-label="Close"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2 my-2">
              <Button
                onClick={() => {
                  setLanguage('en');
                  setActiveModal(null);
                }}
                className={`w-full p-3 rounded-2xl border flex items-center justify-between ${
                  language === 'en' ? 'border-brand bg-emerald-50 text-brand font-bold' : 'border-slate-200'
                }`}
              >
                <span className="text-xs">English</span>
                {language === 'en' && <Check className="w-4 h-4" />}
              </Button>

              <Button
                onClick={() => {
                  setLanguage('te');
                  setActiveModal(null);
                }}
                className={`w-full p-3 rounded-2xl border flex items-center justify-between ${
                  language === 'te' ? 'border-brand bg-emerald-50 text-brand font-bold' : 'border-slate-200'
                }`}
              >
                <span className="text-xs">తెలుగు (Telugu)</span>
                {language === 'te' && <Check className="w-4 h-4" />}
              </Button>
            </div>
          </DialogSurface>
        </div>
      )}
    </div>
  );
};
