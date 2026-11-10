"use client";
import { Button } from '../ui';
import { AuthIllustration } from './AuthIllustration';
import styles from './Authentication.module.css';
import React, { useState } from 'react';
import { User, Edit3, Loader2, ArrowLeft } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';
interface PersonalizationScreenProps {
    onBack?: () => void;
    onComplete: () => void;
}
export const PersonalizationScreen: React.FC<PersonalizationScreenProps> = ({ onBack, onComplete, }) => {
    const { user, updateUser } = useAuth();
    const [fullName, setFullName] = useState(user?.fullName || '');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const isValidName = fullName.trim().length >= 2;
    const handleSubmit = async (e?: React.FormEvent) => {
        if (e)
            e.preventDefault();
        if (!isValidName) {
            setErrorMessage('Please enter a valid full name (at least 2 characters).');
            return;
        }
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const res = await apiClient.put('/customer/profile', {
                fullName: fullName.trim(),
            });
            if (res.success) {
                updateUser({ fullName: fullName.trim() });
                onComplete();
            }
            else {
                setErrorMessage(getApiErrorMessage(res.error, 'Could not save your profile.'));
            }
        }
        catch (error) {
            setErrorMessage(getApiErrorMessage(error, 'Could not save your profile.'));
        }
        finally {
            setIsLoading(false);
        }
    };
    return (<section className={styles.screen} aria-labelledby="name-heading"><header className={styles.header}>{onBack && <Button onClick={onBack} className={styles.back} aria-label="Back"><ArrowLeft size={22}/></Button>}</header><div className={styles.avatarWrap}><AuthIllustration kind="avatar"/><Button type="button" aria-label="Edit full name" className={styles.avatarEdit} onClick={() => document.getElementById('customer-full-name')?.focus()}><Edit3 size={20}/></Button></div><div className={styles.content}><h1 id="name-heading">What&apos;s your name?</h1><p>This helps us personalize your experience.</p><form onSubmit={handleSubmit} className={styles.form}><label htmlFor="customer-full-name">Full name</label><div className={styles.inputShell}><User size={21} aria-hidden="true" className={styles.userIcon}/><input id="customer-full-name" type="text" autoComplete="name" autoCapitalize="words" value={fullName} onChange={e => { setFullName(e.target.value); if (errorMessage)
        setErrorMessage(null); }} placeholder="Enter your full name" aria-invalid={!!errorMessage}/></div>{errorMessage && <p role="alert" className={styles.error}>{errorMessage}</p>}<Button type="submit" disabled={!isValidName || isLoading} aria-busy={isLoading} className={styles.primary}>{isLoading ? <><Loader2 size={18} className={styles.spinner}/> Saving Profile...</> : 'Continue'}</Button></form></div></section>);
};
