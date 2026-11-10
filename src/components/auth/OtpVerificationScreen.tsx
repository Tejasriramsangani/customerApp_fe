"use client";
import { Button } from '../ui';
import { AuthIllustration } from './AuthIllustration';
import styles from './Authentication.module.css';
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Edit2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { apiClient, getApiErrorMessage, normalizeMobile } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';
interface OtpVerificationScreenProps {
    mobileNumber: string;
    /** OTP returned by the backend when SMS_PROVIDER=mock; null when a real SMS was sent. */
    initialDevOtp?: string | null;
    onBack: () => void;
    onEditMobile: () => void;
    onSuccess: (isNewUser: boolean) => void;
}
export const OtpVerificationScreen: React.FC<OtpVerificationScreenProps> = ({ mobileNumber, initialDevOtp = null, onBack, onEditMobile, onSuccess, }) => {
    const { login } = useAuth();
    const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
    const [timer, setTimer] = useState(30);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [devOtp, setDevOtp] = useState<string | null>(initialDevOtp);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    // 30s Countdown Timer
    useEffect(() => {
        if (timer <= 0)
            return;
        const interval = setInterval(() => {
            setTimer((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [timer]);
    // Auto-focus first input box
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);
    const handleChange = (index: number, value: string) => {
        const cleanVal = value.replace(/\D/g, '');
        if (!cleanVal) {
            const updated = [...otp];
            updated[index] = '';
            setOtp(updated);
            return;
        }
        if (cleanVal.length === 6) {
            setOtp(cleanVal.split(''));
            if (errorMessage)
                setErrorMessage(null);
            inputRefs.current[5]?.focus();
            handleVerify(cleanVal);
            return;
        }
        // Single digit input
        const char = cleanVal.slice(-1);
        const updated = [...otp];
        updated[index] = char;
        setOtp(updated);
        if (errorMessage)
            setErrorMessage(null);
        // Auto-advance to next input
        if (index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
        else {
            // If 6 digits filled, trigger verification
            const fullCode = [...updated].join('');
            if (fullCode.length === 6) {
                handleVerify(fullCode);
            }
        }
    };
    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasteData.length === 6) {
            const splitArr = pasteData.split('');
            setOtp(splitArr);
            inputRefs.current[5]?.focus();
            handleVerify(pasteData);
        }
    };
    const handleVerify = async (codeToVerify?: string) => {
        const fullCode = codeToVerify || otp.join('');
        if (fullCode.length !== 6) {
            setErrorMessage('Please enter all 6 digits of the verification code.');
            return;
        }
        setIsVerifying(true);
        setErrorMessage(null);
        try {
            const res = await apiClient.post('/auth/otp/verify', {
                mobile: normalizeMobile(mobileNumber),
                code: fullCode,
                purpose: 'LOGIN',
                requestedRole: 'CUSTOMER',
            });
            if (res.success && res.data) {
                const { accessToken, refreshToken, user } = res.data;
                login(accessToken, refreshToken, {
                    id: user.id,
                    mobile: user.mobile || normalizeMobile(mobileNumber),
                    roles: user.roles,
                    status: user.status,
                });
                const profileRes = await apiClient.getProfile<{
                    fullName?: string;
                }>();
                const fullName = profileRes.success ? profileRes.data?.fullName : undefined;
                if (fullName) {
                    login(accessToken, refreshToken, {
                        id: user.id,
                        mobile: user.mobile || normalizeMobile(mobileNumber),
                        roles: user.roles,
                        status: user.status,
                        fullName,
                    });
                }
                const isNewUser = !fullName;
                onSuccess(isNewUser);
            }
            else {
                setErrorMessage(getApiErrorMessage(res.error, 'Invalid OTP code. Please check and try again.'));
            }
        }
        catch (err: unknown) {
            setErrorMessage(getApiErrorMessage(err, 'Error verifying code.'));
        }
        finally {
            setIsVerifying(false);
        }
    };
    const handleResendOtp = async () => {
        if (timer > 0 || isResending)
            return;
        setIsResending(true);
        setErrorMessage(null);
        try {
            const res = await apiClient.post<{
                devOtp?: string;
            }>('/auth/otp/send', {
                mobile: normalizeMobile(mobileNumber),
                purpose: 'LOGIN',
            });
            if (res.success) {
                setTimer(30);
                setDevOtp(res.data?.devOtp ?? null);
                setOtp(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
            }
            else {
                setErrorMessage(getApiErrorMessage(res.error, 'Failed to resend code.'));
            }
        }
        catch (err: unknown) {
            setErrorMessage(getApiErrorMessage(err, 'Network error.'));
        }
        finally {
            setIsResending(false);
        }
    };
    const fillDevOtp = () => {
        if (devOtp && /^\d{6}$/.test(devOtp))
            setOtp(devOtp.split(''));
    };
    const isFull = otp.every((d) => d !== '');
    return (<section className={styles.screen} aria-labelledby="otp-heading"><header className={styles.header}><Button onClick={onBack} className={styles.back} aria-label="Back"><ArrowLeft size={22}/></Button></header><AuthIllustration kind="otp"/><div className={styles.content}><h1 id="otp-heading">Enter the OTP</h1><div className={styles.mobileCaption}><p>We&apos;ve sent a 6-digit code to<br /><strong>+91 {normalizeMobile(mobileNumber).replace(/^\+?91/, '')}</strong></p><Button onClick={onEditMobile} className={styles.editMobile} aria-label="Edit mobile number"><Edit2 size={16}/></Button></div>
    <div className={styles.otpFields} role="group" aria-label="Six-digit verification code">{otp.map((digit, idx) => <input key={idx} ref={el => { inputRefs.current[idx] = el; }} type="text" inputMode="numeric" autoComplete={idx === 0 ? 'one-time-code' : 'off'} maxLength={idx === 0 ? 6 : 1} value={digit} aria-label={'OTP digit ' + (idx + 1)} aria-invalid={!!errorMessage} disabled={isVerifying} data-filled={!!digit} onChange={e => handleChange(idx, e.target.value)} onKeyDown={e => handleKeyDown(idx, e)} onPaste={handlePaste}/>)}</div>
        {/* SMS_PROVIDER=mock: no SMS is sent, so show the OTP that was just generated */}
        {devOtp && (<div className="mt-5 mx-auto max-w-sm p-3 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0"/>
                <span className="truncate">
                  Test OTP: <strong className="font-mono text-sm tracking-widest text-slate-900">{devOtp}</strong>
                </span>
              </div>
              <Button type="button" onClick={fillDevOtp} className="shrink-0 px-2.5 py-1 rounded-lg bg-brand text-white font-bold text-[11px] uppercase tracking-wider hover:bg-[var(--brand-hover)]">
                Fill
              </Button>
            </div>
            <p className="text-[11px] text-amber-800/80 leading-relaxed">
              SMS provider is in mock mode, so no SMS was sent. This code is shown here for testing only.
            </p>
          </div>)}


    {errorMessage && <p role="alert" className={styles.error}>{errorMessage}</p>}<div className={styles.resend}>{timer > 0 ? <p>Resend OTP in <strong>00:{String(timer).padStart(2, '0')}</strong></p> : <Button onClick={handleResendOtp} disabled={isResending} className={styles.textButton}><RefreshCw size={15} className={isResending ? styles.spinner : undefined}/> Resend OTP</Button>}</div>
    <Button onClick={() => handleVerify()} disabled={!isFull || isVerifying} aria-busy={isVerifying} className={styles.primary}>{isVerifying ? <><Loader2 size={18} className={styles.spinner}/> Verifying Code...</> : 'Verify & Continue'}</Button></div></section>);
};
