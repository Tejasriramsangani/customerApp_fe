"use client";
import { Button } from '../ui';
import { AuthIllustration } from './AuthIllustration';
import styles from './Authentication.module.css';
import React, { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { apiClient, getApiErrorMessage, normalizeMobile } from '../../lib/api-client';
interface LoginScreenProps {
    onBack?: () => void;
    /** devOtp is only present when the backend runs with SMS_PROVIDER=mock (no SMS is sent). */
    onOtpSent: (mobileNumber: string, devOtp?: string) => void;
}
export const LoginScreen: React.FC<LoginScreenProps> = ({ onBack, onOtpSent }) => {
    const [mobileNumber, setMobileNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const isValidNumber = /^[6-9]\d{9}$/.test(mobileNumber.trim());
    const handleSendOtp = async (e?: React.FormEvent) => {
        if (e)
            e.preventDefault();
        if (!isValidNumber) {
            setErrorMessage('Please enter a valid 10-digit Indian mobile number');
            return;
        }
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await apiClient.post<{
                devOtp?: string;
            }>('/auth/otp/send', {
                mobile: normalizeMobile(mobileNumber),
                purpose: 'LOGIN',
            });
            if (res.success) {
                onOtpSent(normalizeMobile(mobileNumber), res.data?.devOtp);
            }
            else {
                setErrorMessage(getApiErrorMessage(res.error, 'Failed to send verification code. Please try again.'));
            }
        }
        catch (err: unknown) {
            setErrorMessage(getApiErrorMessage(err, 'Network error while sending OTP.'));
        }
        finally {
            setIsLoading(false);
        }
    };
    return (<section className={styles.screen} aria-labelledby="login-heading">
    <header className={styles.header}>{onBack && <Button onClick={onBack} className={styles.back} aria-label="Back"><ArrowLeft size={22}/></Button>}</header>
    <AuthIllustration kind="login"/><div className={styles.content}><h1 id="login-heading">Enter your mobile number</h1><p>We&apos;ll send you a verification code to create or access your account.</p>
    <form onSubmit={handleSendOtp} className={styles.form}><label htmlFor="customer-mobile" className="sr-only">Mobile number</label><div className={styles.inputShell}><span className={styles.country}><svg width="24" height="18" viewBox="0 0 24 18" aria-hidden="true"><rect width="24" height="6" fill="#FF9933" /><rect y="6" width="24" height="6" fill="#FFFFFF" /><rect y="12" width="24" height="6" fill="#138808" /><circle cx="12" cy="9" r="2.5" fill="none" stroke="#000080" strokeWidth="0.7" /><path d="M12 6.5v5M9.5 9h5M10.2 7.2l3.6 3.6m0-3.6-3.6 3.6" stroke="#000080" strokeWidth="0.5" /></svg> +91</span>
    <input id="customer-mobile" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={mobileNumber} onChange={e => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10)
        setMobileNumber(val); if (errorMessage)
        setErrorMessage(null); }} placeholder="98765 43210" aria-invalid={!!errorMessage}/>
    {mobileNumber && <Button type="button" className={styles.clear} aria-label="Clear mobile number" onClick={() => setMobileNumber('')}>&times;</Button>}</div>
    {errorMessage && <p role="alert" className={styles.error}>{errorMessage}</p>}
    <Button type="submit" disabled={!isValidNumber || isLoading} aria-busy={isLoading} className={styles.primary}>{isLoading ? <><Loader2 size={18} className={styles.spinner}/> Sending Code...</> : 'Continue'}</Button></form></div></section>);
};
