import React, { useState, useEffect } from 'react';

// Use the key directly or fallback to env variable if you set one up later
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_oGXmxWNXvypN8XyjM71sBA_b_DINXJo';
const SUPABASE_URL = 'https://xptlootjhzsunvsqqkro.supabase.co';

// Uses the Vite proxy locally and your host rewrite (/api/ch) on the live site
const CH_API_BASE = import.meta.env.VITE_CH_PROXY_URL || '/api/ch';
const CH_API_KEY = import.meta.env.VITE_CH_API_KEY || 'ca7f120b-6b10-43db-8043-d8602205fd58';

// Edge function endpoint for sending password-change email notifications from the login page
const EMAIL_NOTIFY_URL =
    import.meta.env.VITE_EMAIL_NOTIFY_URL || `${SUPABASE_URL}/functions/v1/send-password-notification`;

const CLIENT_STORAGE_KEY = 'noirsoft_client_session';

// Hash password using Web Crypto API (SHA-256)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Read company_number and email from URL query parameters
function getUrlParams() {
    if (typeof window === 'undefined') return { companyNumber: '', email: '' };
    const params = new URLSearchParams(window.location.search);
    const companyNumber = (
        params.get('company_number') ||
        params.get('companyNumber') ||
        params.get('company') ||
        ''
    )
        .trim()
        .toUpperCase();
    const email = (params.get('email') || '').trim().toLowerCase();
    return { companyNumber, email };
}

export default function ClientApp() {
    // Responsive state
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth <= 768 : false
    );
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        const handleResize = (e) => {
            setIsMobile(e.matches);
            if (!e.matches) setMobileMenuOpen(false);
        };
        setIsMobile(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleResize);
        return () => mediaQuery.removeEventListener('change', handleResize);
    }, []);

    // URL parameters (locked on login screen)
    const [urlParams] = useState(() => getUrlParams());

    // Client session state (persisted in localStorage)
    const [clientSession, setClientSession] = useState(() => {
        try {
            const saved = localStorage.getItem(CLIENT_STORAGE_KEY);
            if (!saved) return null;
            const parsed = JSON.parse(saved);
            // If URL params are provided for a different company/email, require login for the new link
            const { companyNumber, email } = getUrlParams();
            if (
                companyNumber &&
                email &&
                (parsed.company_number?.toUpperCase() !== companyNumber ||
                    parsed.email?.toLowerCase() !== email)
            ) {
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    });

    // Auth mode: 'checking' | 'firstVisit' | 'login' | 'resetFromLogin'
    const [authMode, setAuthMode] = useState('checking');
    const [existingUser, setExistingUser] = useState(null);
    const [passwordInput, setPasswordInput] = useState('');
    const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState(null);
    const [authSuccess, setAuthSuccess] = useState(null);

    // Navigation view: 'company' | 'directors' | 'history' | 'password'
    const [view, setView] = useState('company');

    // Portal data state
    const [companyRecord, setCompanyRecord] = useState(null);
    const [chProfile, setChProfile] = useState(null);
    const [directors, setDirectors] = useState([]);
    const [filingHistory, setFilingHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // In-portal email update state
    const [isEditingEmail, setIsEditingEmail] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [emailSaving, setEmailSaving] = useState(false);
    const [emailMessage, setEmailMessage] = useState(null);

    // In-portal change password state
    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [confirmNewPwd, setConfirmNewPwd] = useState('');
    const [pwdSaving, setPwdSaving] = useState(false);
    const [pwdMessage, setPwdMessage] = useState(null);

    const supabaseHeaders = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
    };

    // ─── Check if user already has a password in `users` table ───
    useEffect(() => {
        if (clientSession) return;
        if (!urlParams.companyNumber || !urlParams.email) {
            setAuthMode('missingParams');
            return;
        }

        const checkUserAccount = async () => {
            setAuthMode('checking');
            setAuthError(null);

            try {
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/users?company_number=eq.${encodeURIComponent(
                        urlParams.companyNumber
                    )}&email=eq.${encodeURIComponent(urlParams.email)}&select=*&limit=1`,
                    {
                        method: 'GET',
                        headers: supabaseHeaders,
                    }
                );

                if (!res.ok) {
                    throw new Error(`Unable to verify account (${res.status}).`);
                }

                const data = await res.json();
                if (Array.isArray(data) && data.length > 0 && data[0].password_hash) {
                    setExistingUser(data[0]);
                    setAuthMode('login');
                } else {
                    setExistingUser(Array.isArray(data) && data.length > 0 ? data[0] : null);
                    setAuthMode('firstVisit');
                }
            } catch (err) {
                console.error('[Check User Error]', err);
                setAuthError(err.message || 'Could not check account status.');
                setAuthMode('login');
            }
        };

        checkUserAccount();
    }, [clientSession, urlParams.companyNumber, urlParams.email]);

    // ─── Helpers ───
    const formatOfficerName = (name) => {
        if (!name) return '';
        if (name.includes(',')) {
            const [surname, ...rest] = name.split(',');
            const firstNames = rest.join(',').trim();
            const formattedSurname = surname
                .trim()
                .toLowerCase()
                .replace(/\b\w/g, (char) => char.toUpperCase());
            return `${firstNames} ${formattedSurname}`.trim();
        }
        return name;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not available';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const formatCurrency = (amount) => {
        if (amount === null || amount === undefined || isNaN(Number(amount))) return '—';
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: 'GBP',
        }).format(Number(amount));
    };

    const formatAddress = (addr) => {
        if (!addr) return 'Not available';
        return [
            addr.premises,
            addr.address_line_1,
            addr.address_line_2,
            addr.locality,
            addr.region,
            addr.postal_code,
            addr.country,
        ]
            .filter(Boolean)
            .join(', ');
    };

    const isDueWithinThreeMonths = (dateString) => {
        if (!dateString) return false;
        const dueDate = new Date(dateString);
        const today = new Date();
        const threeMonthsFromNow = new Date();
        threeMonthsFromNow.setMonth(today.getMonth() + 3);
        dueDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        threeMonthsFromNow.setHours(0, 0, 0, 0);
        return dueDate >= today && dueDate <= threeMonthsFromNow;
    };

    const formatStatus = (status) => {
        if (!status) return 'Unknown';
        return status
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    // ─── Send Email Notification (used when changing password from Login page) ───
    const sendPasswordChangeEmail = async (email, companyNumber) => {
        try {
            const res = await fetch(EMAIL_NOTIFY_URL, {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    company_number: companyNumber,
                    subject: 'Your Client Portal Password Was Changed',
                    message: `Your password for company ${companyNumber} on NoirSoft Company Services was updated. If you did not make this change, please contact Sales@NoirSoft.net immediately.`,
                }),
            });
            return res.ok;
        } catch (err) {
            console.warn('[Email Notification Warning]', err);
            return false;
        }
    };

    // ─── 1. First Visit: Create Password & Login (No Email Required) ───
    const handleCreatePasswordAndLogin = async (e) => {
        e.preventDefault();
        setAuthError(null);
        setAuthSuccess(null);

        if (passwordInput.length < 6) {
            setAuthError('Password must be at least 6 characters long.');
            return;
        }
        if (passwordInput !== confirmPasswordInput) {
            setAuthError('Passwords do not match.');
            return;
        }

        setAuthLoading(true);
        try {
            const hashed = await hashPassword(passwordInput);
            let savedUser = null;

            if (existingUser?.id) {
                // Update existing user row that had no password yet
                const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${existingUser.id}`, {
                    method: 'PATCH',
                    headers: { ...supabaseHeaders, Prefer: 'return=representation' },
                    body: JSON.stringify({ password_hash: hashed }),
                });
                if (!res.ok) throw new Error(`Could not save password (${res.status}).`);
                const data = await res.json();
                savedUser = Array.isArray(data) ? data[0] : existingUser;
            } else {
                // Create new user row
                const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
                    method: 'POST',
                    headers: { ...supabaseHeaders, Prefer: 'return=representation' },
                    body: JSON.stringify({
                        company_number: urlParams.companyNumber,
                        email: urlParams.email,
                        password_hash: hashed,
                    }),
                });
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`Could not create account (${res.status}): ${errText}`);
                }
                const data = await res.json();
                savedUser = Array.isArray(data) ? data[0] : null;
            }

            const session = {
                user_id: savedUser?.id || null,
                company_number: urlParams.companyNumber,
                email: urlParams.email,
            };

            localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(session));
            setClientSession(session);
            setPasswordInput('');
            setConfirmPasswordInput('');
        } catch (err) {
            console.error('[First Visit Password Error]', err);
            setAuthError(err.message || 'Failed to create password.');
        } finally {
            setAuthLoading(false);
        }
    };

    // ─── 2. Returning Visit: Sign In ───
    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthError(null);
        setAuthSuccess(null);

        if (!passwordInput) {
            setAuthError('Please enter your password.');
            return;
        }

        setAuthLoading(true);
        try {
            const hashed = await hashPassword(passwordInput);

            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/users?company_number=eq.${encodeURIComponent(
                    urlParams.companyNumber
                )}&email=eq.${encodeURIComponent(urlParams.email)}&select=*&limit=1`,
                {
                    method: 'GET',
                    headers: supabaseHeaders,
                }
            );

            if (!res.ok) throw new Error(`Sign in failed (${res.status}).`);
            const data = await res.json();

            if (!Array.isArray(data) || data.length === 0) {
                setAuthError('Account not found.');
                return;
            }

            const user = data[0];
            if (user.password_hash !== hashed) {
                setAuthError('Incorrect password. Please try again.');
                return;
            }

            const session = {
                user_id: user.id,
                company_number: urlParams.companyNumber,
                email: urlParams.email,
            };

            localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(session));
            setClientSession(session);
            setPasswordInput('');
        } catch (err) {
            console.error('[Client Login Error]', err);
            setAuthError(err.message || 'Sign in failed.');
        } finally {
            setAuthLoading(false);
        }
    };

    // ─── 3. Login Page: Change Password with Email Notification ───
    const handleResetPasswordFromLogin = async (e) => {
        e.preventDefault();
        setAuthError(null);
        setAuthSuccess(null);

        if (passwordInput.length < 6) {
            setAuthError('New password must be at least 6 characters long.');
            return;
        }
        if (passwordInput !== confirmPasswordInput) {
            setAuthError('Passwords do not match.');
            return;
        }

        setAuthLoading(true);
        try {
            const hashed = await hashPassword(passwordInput);

            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/users?company_number=eq.${encodeURIComponent(
                    urlParams.companyNumber
                )}&email=eq.${encodeURIComponent(urlParams.email)}`,
                {
                    method: 'PATCH',
                    headers: { ...supabaseHeaders, Prefer: 'return=representation' },
                    body: JSON.stringify({ password_hash: hashed }),
                }
            );

            if (!res.ok) {
                throw new Error(`Could not update password (${res.status}).`);
            }

            const emailSent = await sendPasswordChangeEmail(urlParams.email, urlParams.companyNumber);

            setPasswordInput('');
            setConfirmPasswordInput('');
            setAuthMode('login');
            setAuthSuccess(
                emailSent
                    ? `Password updated. A confirmation email has been sent to ${urlParams.email}.`
                    : `Password updated. (Note: email notification service is not yet configured for ${urlParams.email}.)`
            );
        } catch (err) {
            console.error('[Login Password Reset Error]', err);
            setAuthError(err.message || 'Could not change password.');
        } finally {
            setAuthLoading(false);
        }
    };

    // ─── 4. In-Portal: Change Password ───
    const handleInPortalPasswordChange = async (e) => {
        e.preventDefault();
        setPwdMessage(null);

        if (!currentPwd || !newPwd || !confirmNewPwd) {
            setPwdMessage({ type: 'error', text: 'Please fill in all password fields.' });
            return;
        }
        if (newPwd.length < 6) {
            setPwdMessage({ type: 'error', text: 'New password must be at least 6 characters long.' });
            return;
        }
        if (newPwd !== confirmNewPwd) {
            setPwdMessage({ type: 'error', text: 'New passwords do not match.' });
            return;
        }

        setPwdSaving(true);
        try {
            const currentHashed = await hashPassword(currentPwd);
            const newHashed = await hashPassword(newPwd);

            // Verify current password
            const checkRes = await fetch(
                `${SUPABASE_URL}/rest/v1/users?company_number=eq.${encodeURIComponent(
                    clientSession.company_number
                )}&email=eq.${encodeURIComponent(clientSession.email)}&select=id,password_hash&limit=1`,
                {
                    method: 'GET',
                    headers: supabaseHeaders,
                }
            );

            if (!checkRes.ok) throw new Error('Unable to verify current password.');
            const users = await checkRes.json();

            if (!Array.isArray(users) || users.length === 0 || users[0].password_hash !== currentHashed) {
                setPwdMessage({ type: 'error', text: 'Current password is incorrect.' });
                return;
            }

            // Update password
            const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${users[0].id}`, {
                method: 'PATCH',
                headers: supabaseHeaders,
                body: JSON.stringify({ password_hash: newHashed }),
            });

            if (!updateRes.ok) throw new Error(`Failed to update password (${updateRes.status}).`);

            setCurrentPwd('');
            setNewPwd('');
            setConfirmNewPwd('');
            setPwdMessage({ type: 'success', text: 'Your password has been updated.' });
        } catch (err) {
            console.error('[In-Portal Password Change Error]', err);
            setPwdMessage({ type: 'error', text: err.message || 'Could not update password.' });
        } finally {
            setPwdSaving(false);
        }
    };

    // ─── Fetch all client portal data ───
    const loadClientData = async (companyNumber) => {
        if (!companyNumber) return;
        setLoading(true);
        setError(null);

        const chHeaders = {
            Authorization: 'Basic ' + btoa(`${CH_API_KEY}:`),
            Accept: 'application/json',
        };

        const encodedNum = encodeURIComponent(companyNumber.trim().toUpperCase());

        try {
            const [dbCompanyRes, dbHistoryRes, chProfileRes, chOfficersRes] = await Promise.allSettled([
                fetch(`${SUPABASE_URL}/rest/v1/companies?company_number=eq.${encodedNum}&select=*&limit=1`, {
                    method: 'GET',
                    headers: supabaseHeaders,
                }),
                fetch(`${SUPABASE_URL}/rest/v1/confirmation_statements?company_number=eq.${encodedNum}&select=*&order=filed_date.desc`, {
                    method: 'GET',
                    headers: supabaseHeaders,
                }),
                fetch(`${CH_API_BASE}/company/${encodedNum}`, { headers: chHeaders }),
                fetch(`${CH_API_BASE}/company/${encodedNum}/officers`, { headers: chHeaders }),
            ]);

            if (dbCompanyRes.status === 'fulfilled' && dbCompanyRes.value.ok) {
                const dbCompanies = await dbCompanyRes.value.json();
                if (Array.isArray(dbCompanies) && dbCompanies.length > 0) {
                    setCompanyRecord(dbCompanies[0]);
                    setEmailInput(dbCompanies[0].email || clientSession?.email || '');
                }
            }

            if (dbHistoryRes.status === 'fulfilled' && dbHistoryRes.value.ok) {
                const historyData = await dbHistoryRes.value.json();
                setFilingHistory(Array.isArray(historyData) ? historyData : []);
            } else {
                setFilingHistory([]);
            }

            if (chProfileRes.status === 'fulfilled' && chProfileRes.value.ok) {
                const contentType = chProfileRes.value.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const profileData = await chProfileRes.value.json();
                    setChProfile(profileData);
                }
            }

            if (chOfficersRes.status === 'fulfilled' && chOfficersRes.value.ok) {
                const contentType = chOfficersRes.value.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const officersData = await chOfficersRes.value.json();
                    const activeDirectors = (officersData.items || [])
                        .filter(
                            (officer) =>
                                !officer.resigned_on &&
                                (officer.officer_role || '').toLowerCase().includes('director')
                        )
                        .map((officer) => ({
                            name: formatOfficerName(officer.name),
                            role: formatStatus(officer.officer_role),
                            appointed_on: officer.appointed_on,
                            nationality: officer.nationality || null,
                            occupation: officer.occupation || null,
                        }));
                    setDirectors(activeDirectors);
                }
            }
        } catch (err) {
            console.error('[Client Portal Load Error]', err);
            setError('An error occurred while loading your company details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (clientSession?.company_number) {
            loadClientData(clientSession.company_number);
        }
    }, [clientSession]);

    // ─── Handle Client Logout ───
    const handleLogout = () => {
        localStorage.removeItem(CLIENT_STORAGE_KEY);
        setClientSession(null);
        setCompanyRecord(null);
        setChProfile(null);
        setDirectors([]);
        setFilingHistory([]);
        setView('company');
        setMobileMenuOpen(false);
        setError(null);
        setEmailMessage(null);
        setPwdMessage(null);
        setIsEditingEmail(false);
        setAuthError(null);
        setAuthSuccess(null);
    };

    // ─── Update Registered Email in Supabase ───
    const handleSaveEmail = async (e) => {
        e.preventDefault();
        if (!companyRecord?.id) return;

        const cleanedEmail = emailInput.trim().toLowerCase();
        if (!cleanedEmail || !cleanedEmail.includes('@')) {
            setEmailMessage({ type: 'error', text: 'Please enter a valid email address.' });
            return;
        }

        setEmailSaving(true);
        setEmailMessage(null);

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyRecord.id}`, {
                method: 'PATCH',
                headers: { ...supabaseHeaders, Prefer: 'return=representation' },
                body: JSON.stringify({ email: cleanedEmail }),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Failed to update email (${res.status}): ${errText}`);
            }

            const updated = await res.json();
            const updatedRecord =
                Array.isArray(updated) && updated.length > 0
                    ? updated[0]
                    : { ...companyRecord, email: cleanedEmail };

            setCompanyRecord(updatedRecord);
            setIsEditingEmail(false);
            setEmailMessage({ type: 'success', text: 'Notification email address updated.' });
        } catch (err) {
            console.error('[Email Update Error]', err);
            setEmailMessage({ type: 'error', text: err.message || 'Could not update email address.' });
        } finally {
            setEmailSaving(false);
        }
    };

    const handleViewChange = (newView) => {
        setView(newView);
        setMobileMenuOpen(false);
        setEmailMessage(null);
        setPwdMessage(null);
    };

    // Derived display values
    const displayCompanyName = chProfile?.company_name || companyRecord?.company_name || 'Your Company';
    const displayCompanyNumber = companyRecord?.company_number || clientSession?.company_number || '';
    const nextStatementDue =
        chProfile?.confirmation_statement?.next_due || companyRecord?.next_confirmation_statement || null;
    const dueSoon = isDueWithinThreeMonths(nextStatementDue);

    // ─── AUTH / LOGIN / FIRST VISIT / PASSWORD RESET SCREEN ───
    if (!clientSession) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#030511', margin: 0, fontFamily: 'Segoe UI, sans-serif', overflowX: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: isMobile ? '24px 16px' : '40px 20px', boxSizing: 'border-box' }}>
                    <div style={{ width: '100%', maxWidth: '440px', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '24px 20px' : '32px', boxSizing: 'border-box' }}>
                        <h1 style={{ color: '#ffffff', fontSize: isMobile ? '1.5rem' : '1.8rem', marginTop: 0, marginBottom: '8px', textAlign: 'center' }}>
                            Client Portal
                        </h1>

                        {authMode === 'missingParams' ? (
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                <p style={{ color: '#ff6b6b', fontSize: '0.95rem', marginBottom: '12px' }}>
                                    Missing required access link parameters.
                                </p>
                                <p style={{ color: '#a0a4b8', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>
                                    Please use the link provided in your email, which includes your company number and email address.
                                </p>
                            </div>
                        ) : authMode === 'checking' ? (
                            <p style={{ color: '#58a6ff', textAlign: 'center', margin: '24px 0' }}>
                                Checking your account...
                            </p>
                        ) : (
                            <>
                                <p style={{ color: '#a0a4b8', fontSize: '0.95rem', marginTop: 0, marginBottom: '24px', textAlign: 'center' }}>
                                    {authMode === 'firstVisit' && 'Welcome! Create a password to access your company portal.'}
                                    {authMode === 'login' && 'Enter your password to sign in to your company portal.'}
                                    {authMode === 'resetFromLogin' && 'Set a new password. A confirmation email will be sent to your address.'}
                                </p>

                                <form
                                    onSubmit={
                                        authMode === 'firstVisit'
                                            ? handleCreatePasswordAndLogin
                                            : authMode === 'resetFromLogin'
                                                ? handleResetPasswordFromLogin
                                                : handleLogin
                                    }
                                    style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                                >
                                    {/* NON-EDITABLE COMPANY NUMBER */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label htmlFor="lockedCompanyNumber" style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>
                                            Company Number
                                        </label>
                                        <input
                                            id="lockedCompanyNumber"
                                            type="text"
                                            value={urlParams.companyNumber}
                                            readOnly
                                            disabled
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#090c1a', color: '#a0a4b8', cursor: 'not-allowed', outline: 'none' }}
                                        />
                                    </div>

                                    {/* NON-EDITABLE EMAIL */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label htmlFor="lockedEmail" style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>
                                            Email Address
                                        </label>
                                        <input
                                            id="lockedEmail"
                                            type="email"
                                            value={urlParams.email}
                                            readOnly
                                            disabled
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#090c1a', color: '#a0a4b8', cursor: 'not-allowed', outline: 'none' }}
                                        />
                                    </div>

                                    {/* PASSWORD FIELD */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label htmlFor="clientPassword" style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>
                                            {authMode === 'firstVisit'
                                                ? 'Create Password'
                                                : authMode === 'resetFromLogin'
                                                    ? 'New Password'
                                                    : 'Password'}
                                        </label>
                                        <input
                                            id="clientPassword"
                                            type="password"
                                            value={passwordInput}
                                            onChange={(e) => setPasswordInput(e.target.value)}
                                            placeholder="••••••••"
                                            autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                                            required
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
                                        />
                                    </div>

                                    {/* CONFIRM PASSWORD (FIRST VISIT OR RESET) */}
                                    {(authMode === 'firstVisit' || authMode === 'resetFromLogin') && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <label htmlFor="confirmPassword" style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>
                                                Confirm Password
                                            </label>
                                            <input
                                                id="confirmPassword"
                                                type="password"
                                                value={confirmPasswordInput}
                                                onChange={(e) => setConfirmPasswordInput(e.target.value)}
                                                placeholder="••••••••"
                                                autoComplete="new-password"
                                                required
                                                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
                                            />
                                        </div>
                                    )}

                                    {authError && (
                                        <p style={{ color: '#ff6b6b', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
                                            {authError}
                                        </p>
                                    )}

                                    {authSuccess && (
                                        <p style={{ color: '#4ade80', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
                                            {authSuccess}
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={authLoading}
                                        style={{ marginTop: '8px', width: '100%', padding: '12px 24px', fontSize: '1rem', fontWeight: 600, borderRadius: '8px', border: 'none', backgroundColor: '#58a6ff', color: '#030511', cursor: authLoading ? 'not-allowed' : 'pointer', opacity: authLoading ? 0.6 : 1 }}
                                    >
                                        {authLoading
                                            ? 'Please wait...'
                                            : authMode === 'firstVisit'
                                                ? 'Create Password & Sign In'
                                                : authMode === 'resetFromLogin'
                                                    ? 'Update Password & Notify Email'
                                                    : 'Sign In'}
                                    </button>
                                </form>

                                {/* TOGGLE BETWEEN LOGIN & CHANGE PASSWORD */}
                                {authMode === 'login' && (
                                    <div style={{ textAlign: 'center', marginTop: '18px' }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAuthMode('resetFromLogin');
                                                setPasswordInput('');
                                                setConfirmPasswordInput('');
                                                setAuthError(null);
                                                setAuthSuccess(null);
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#58a6ff', fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            Change password
                                        </button>
                                    </div>
                                )}

                                {authMode === 'resetFromLogin' && (
                                    <div style={{ textAlign: 'center', marginTop: '18px' }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAuthMode('login');
                                                setPasswordInput('');
                                                setConfirmPasswordInput('');
                                                setAuthError(null);
                                                setAuthSuccess(null);
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#a0a4b8', fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            ← Back to Sign In
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* FOOTER */}
                <footer style={{ borderTop: '1px solid #1a1c2e', padding: '24px 20px', textAlign: 'center', backgroundColor: '#030511', color: '#a0a4b8', fontSize: '0.9rem' }}>
                    <p style={{ margin: '0 0 8px 0' }}>NOIRSOFT LTD &bull; Registration number 15337702</p>
                    <p style={{ margin: 0 }}>Email: <a href="mailto:Sales@NoirSoft.net" style={{ color: '#58a6ff', textDecoration: 'none' }}>Sales@NoirSoft.net</a></p>
                </footer>
            </div>
        );
    }

    // ─── MAIN CLIENT PORTAL ───
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#030511', margin: 0, fontFamily: 'Segoe UI, sans-serif', overflowX: 'hidden' }}>

            {/* MOBILE TOP BAR */}
            {isMobile && (
                <header style={{ width: '100%', backgroundColor: '#030511', borderBottom: '1px solid #1a1c2e', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
                        <h2 style={{ color: '#ffffff', fontSize: '1.15rem', margin: 0 }}>Client Portal</h2>
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen((prev) => !prev)}
                            aria-label="Toggle navigation menu"
                            style={{ padding: '8px 12px', fontSize: '0.95rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ffffff', cursor: 'pointer' }}
                        >
                            {mobileMenuOpen ? '✕ Close' : '☰ Menu'}
                        </button>
                    </div>

                    {mobileMenuOpen && (
                        <nav style={{ padding: '12px 16px 20px 16px', borderTop: '1px solid #1a1c2e', backgroundColor: '#0d1020', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <button onClick={() => handleViewChange('company')} style={{ background: 'none', border: 'none', padding: '6px 0', textAlign: 'left', color: view === 'company' ? '#ffffff' : '#58a6ff', fontSize: '1.05rem', cursor: 'pointer', fontWeight: view === 'company' ? 600 : 400 }}>Company details</button>
                            <button onClick={() => handleViewChange('directors')} style={{ background: 'none', border: 'none', padding: '6px 0', textAlign: 'left', color: view === 'directors' ? '#ffffff' : '#58a6ff', fontSize: '1.05rem', cursor: 'pointer', fontWeight: view === 'directors' ? 600 : 400 }}>Directors &amp; email</button>
                            <button onClick={() => handleViewChange('history')} style={{ background: 'none', border: 'none', padding: '6px 0', textAlign: 'left', color: view === 'history' ? '#ffffff' : '#58a6ff', fontSize: '1.05rem', cursor: 'pointer', fontWeight: view === 'history' ? 600 : 400 }}>Confirmation statement history</button>
                            <button onClick={() => handleViewChange('password')} style={{ background: 'none', border: 'none', padding: '6px 0', textAlign: 'left', color: view === 'password' ? '#ffffff' : '#58a6ff', fontSize: '1.05rem', cursor: 'pointer', fontWeight: view === 'password' ? 600 : 400 }}>Change password</button>

                            <div style={{ paddingTop: '14px', borderTop: '1px solid #1a1c2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <p style={{ margin: 0, color: '#a0a4b8', fontSize: '0.85rem', wordBreak: 'break-word' }}>
                                    Company No: <strong style={{ color: '#ffffff' }}>{displayCompanyNumber}</strong>
                                </p>
                                <button
                                    onClick={handleLogout}
                                    style={{ padding: '8px 14px', fontSize: '0.9rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ff6b6b', cursor: 'pointer' }}
                                >
                                    Sign out
                                </button>
                            </div>
                        </nav>
                    )}
                </header>
            )}

            <div style={{ display: 'flex', flex: 1, flexDirection: isMobile ? 'column' : 'row' }}>

                {/* DESKTOP SIDEBAR */}
                {!isMobile && (
                    <div style={{ width: '250px', flexShrink: 0, padding: '40px 20px', backgroundColor: '#030511', borderRight: '1px solid #1a1c2e', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <h2 style={{ color: '#ffffff', fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Client Portal</h2>
                            <button onClick={() => handleViewChange('company')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: view === 'company' ? '#ffffff' : '#58a6ff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: view === 'company' ? 600 : 400 }}>Company details</button>
                            <button onClick={() => handleViewChange('directors')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: view === 'directors' ? '#ffffff' : '#58a6ff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: view === 'directors' ? 600 : 400 }}>Directors &amp; email</button>
                            <button onClick={() => handleViewChange('history')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: view === 'history' ? '#ffffff' : '#58a6ff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: view === 'history' ? 600 : 400 }}>Confirmation statement history</button>
                            <button onClick={() => handleViewChange('password')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: view === 'password' ? '#ffffff' : '#58a6ff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: view === 'password' ? 600 : 400 }}>Change password</button>
                        </div>

                        <div style={{ paddingTop: '20px', borderTop: '1px solid #1a1c2e', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <p style={{ margin: 0, color: '#a0a4b8', fontSize: '0.85rem', wordBreak: 'break-word' }}>
                                Signed in as<br />
                                <strong style={{ color: '#ffffff' }}>{displayCompanyName}</strong><br />
                                <span>{clientSession.email}</span>
                            </p>
                            <button
                                onClick={handleLogout}
                                style={{ padding: '10px 14px', fontSize: '0.9rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ff6b6b', cursor: 'pointer', textAlign: 'center' }}
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                )}

                {/* MAIN CONTENT */}
                <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', padding: isMobile ? '16px 16px 32px 16px' : '24px 32px 40px 32px', boxSizing: 'border-box' }}>

                    {/* SUMMARY BAR */}
                    <div style={{ width: '100%', maxWidth: '800px', marginBottom: '24px' }}>
                        <div style={{
                            width: '100%',
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                            gap: '12px',
                            backgroundColor: '#0d1020',
                            border: '1px solid #1a1c2e',
                            borderRadius: '10px',
                            padding: '16px 20px',
                            boxSizing: 'border-box',
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ color: '#a0a4b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next Statement Due</span>
                                <span style={{ color: dueSoon ? '#ff6b6b' : '#58a6ff', fontSize: '1.05rem', fontWeight: 700 }}>
                                    {loading ? '...' : formatDate(nextStatementDue)}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ color: '#a0a4b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Directors</span>
                                <span style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 700 }}>
                                    {loading ? '...' : directors.length}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ color: '#a0a4b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filed via NoirSoft</span>
                                <span style={{ color: '#4ade80', fontSize: '1.05rem', fontWeight: 700 }}>
                                    {loading ? '...' : `${filingHistory.length} ${filingHistory.length === 1 ? 'Statement' : 'Statements'}`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {loading && <p style={{ color: '#58a6ff', marginBottom: '20px' }}>Loading your company portal...</p>}
                    {error && <p style={{ color: '#ff6b6b', textAlign: 'center', maxWidth: '600px', marginBottom: '20px' }}>{error}</p>}

                    {/* 1. COMPANY DETAILS */}
                    {view === 'company' && !loading && (
                        <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                <h1 style={{ color: '#ffffff', fontSize: isMobile ? '1.5rem' : '1.9rem', margin: 0 }}>Company details</h1>
                                <button
                                    type="button"
                                    onClick={() => loadClientData(displayCompanyNumber)}
                                    style={{ padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#58a6ff', cursor: 'pointer' }}
                                >
                                    ↻ Refresh
                                </button>
                            </div>

                            <div style={{ width: '100%', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '18px' : '24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid #1a1c2e', paddingBottom: '16px' }}>
                                    <div>
                                        <h2 style={{ color: '#ffffff', fontSize: isMobile ? '1.25rem' : '1.45rem', margin: '0 0 6px 0', wordBreak: 'break-word' }}>
                                            {displayCompanyName}
                                        </h2>
                                        <p style={{ color: '#a0a4b8', fontSize: '0.95rem', margin: 0 }}>
                                            Company Number: <strong style={{ color: '#ffffff' }}>{displayCompanyNumber}</strong>
                                        </p>
                                    </div>
                                    {chProfile?.company_status && (
                                        <span style={{
                                            padding: '5px 12px',
                                            borderRadius: '12px',
                                            backgroundColor: chProfile.company_status === 'active' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 107, 107, 0.15)',
                                            color: chProfile.company_status === 'active' ? '#4ade80' : '#ff6b6b',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                        }}>
                                            {formatStatus(chProfile.company_status)}
                                        </span>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <span style={{ display: 'block', color: '#a0a4b8', fontSize: '0.85rem', marginBottom: '4px' }}>Company Type</span>
                                        <span style={{ color: '#ffffff', fontSize: '1rem' }}>{formatStatus(chProfile?.type) || 'Not available'}</span>
                                    </div>

                                    <div>
                                        <span style={{ display: 'block', color: '#a0a4b8', fontSize: '0.85rem', marginBottom: '4px' }}>Date of Incorporation</span>
                                        <span style={{ color: '#ffffff', fontSize: '1rem' }}>{formatDate(chProfile?.date_of_creation)}</span>
                                    </div>

                                    <div>
                                        <span style={{ display: 'block', color: '#a0a4b8', fontSize: '0.85rem', marginBottom: '4px' }}>Next Confirmation Statement Due</span>
                                        <span style={{ color: dueSoon ? '#ff6b6b' : '#ffffff', fontSize: '1rem', fontWeight: 600 }}>
                                            {formatDate(nextStatementDue)}
                                        </span>
                                        {dueSoon && (
                                            <span style={{ display: 'inline-block', marginLeft: '8px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#e53e3e', color: '#ffffff', fontSize: '0.72rem', fontWeight: 600 }}>
                                                Due soon
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <span style={{ display: 'block', color: '#a0a4b8', fontSize: '0.85rem', marginBottom: '4px' }}>Last Statement Made Up To</span>
                                        <span style={{ color: '#ffffff', fontSize: '1rem' }}>{formatDate(chProfile?.confirmation_statement?.last_made_up_to)}</span>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid #1a1c2e', paddingTop: '16px' }}>
                                    <span style={{ display: 'block', color: '#a0a4b8', fontSize: '0.85rem', marginBottom: '4px' }}>Registered Office Address</span>
                                    <span style={{ color: '#ffffff', fontSize: '1rem', lineHeight: 1.5 }}>
                                        {formatAddress(chProfile?.registered_office_address)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. DIRECTORS & EMAIL */}
                    {view === 'directors' && !loading && (
                        <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <h1 style={{ color: '#ffffff', fontSize: isMobile ? '1.5rem' : '1.9rem', margin: 0 }}>Directors &amp; email address</h1>

                            <div style={{ width: '100%', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '18px' : '24px', boxSizing: 'border-box' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: isEditingEmail ? '16px' : '8px' }}>
                                    <h2 style={{ color: '#ffffff', fontSize: '1.15rem', margin: 0 }}>Notification Email Address</h2>
                                    {!isEditingEmail && companyRecord?.id && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEmailInput(companyRecord?.email || clientSession.email || '');
                                                setEmailMessage(null);
                                                setIsEditingEmail(true);
                                            }}
                                            style={{ padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#58a6ff', cursor: 'pointer' }}
                                        >
                                            Edit Email
                                        </button>
                                    )}
                                </div>

                                <p style={{ color: '#a0a4b8', fontSize: '0.9rem', marginTop: 0, marginBottom: '14px' }}>
                                    Automated confirmation statement reminders and one-click filing approvals are sent to this address.
                                </p>

                                {!isEditingEmail ? (
                                    <p style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 600, margin: 0, wordBreak: 'break-word' }}>
                                        {companyRecord?.email || clientSession.email}
                                    </p>
                                ) : (
                                    <form onSubmit={handleSaveEmail} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
                                        <input
                                            type="email"
                                            value={emailInput}
                                            onChange={(e) => setEmailInput(e.target.value)}
                                            placeholder="Enter new email address"
                                            required
                                            style={{ flex: 1, width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
                                        />
                                        <button
                                            type="submit"
                                            disabled={emailSaving}
                                            style={{ padding: '10px 18px', fontSize: '0.95rem', fontWeight: 600, borderRadius: '8px', border: 'none', backgroundColor: '#58a6ff', color: '#030511', cursor: emailSaving ? 'not-allowed' : 'pointer', opacity: emailSaving ? 0.6 : 1 }}
                                        >
                                            {emailSaving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsEditingEmail(false);
                                                setEmailInput(companyRecord?.email || clientSession.email || '');
                                                setEmailMessage(null);
                                            }}
                                            style={{ padding: '10px 16px', fontSize: '0.95rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: 'transparent', color: '#a0a4b8', cursor: 'pointer' }}
                                        >
                                            Cancel
                                        </button>
                                    </form>
                                )}

                                {emailMessage && (
                                    <p style={{ color: emailMessage.type === 'success' ? '#4ade80' : '#ff6b6b', fontSize: '0.9rem', marginTop: '12px', marginBottom: 0 }}>
                                        {emailMessage.text}
                                    </p>
                                )}
                            </div>

                            <div style={{ width: '100%', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '18px' : '24px', boxSizing: 'border-box' }}>
                                <h2 style={{ color: '#ffffff', fontSize: '1.15rem', marginTop: 0, marginBottom: '16px' }}>
                                    Active {directors.length === 1 ? 'Director' : 'Directors'} (Companies House)
                                </h2>

                                {directors.length === 0 ? (
                                    <p style={{ color: '#a0a4b8', margin: 0 }}>No active directors found on Companies House.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {directors.map((director, idx) => (
                                            <div
                                                key={`${director.name}-${idx}`}
                                                style={{ padding: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', display: 'flex', flexDirection: 'column', gap: '8px' }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                                    <span style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 600 }}>{director.name}</span>
                                                    <span style={{ padding: '4px 10px', borderRadius: '12px', backgroundColor: 'rgba(88, 166, 255, 0.15)', color: '#58a6ff', fontSize: '0.78rem', fontWeight: 600 }}>
                                                        {director.role}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '8px', fontSize: '0.88rem', color: '#a0a4b8' }}>
                                                    <span>Appointed: <strong style={{ color: '#ffffff' }}>{formatDate(director.appointed_on)}</strong></span>
                                                    {director.nationality && (
                                                        <span>Nationality: <strong style={{ color: '#ffffff' }}>{director.nationality}</strong></span>
                                                    )}
                                                    {director.occupation && (
                                                        <span>Occupation: <strong style={{ color: '#ffffff' }}>{director.occupation}</strong></span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 3. CONFIRMATION STATEMENT HISTORY */}
                    {view === 'history' && !loading && (
                        <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <h1 style={{ color: '#ffffff', fontSize: isMobile ? '1.5rem' : '1.9rem', margin: '0 0 8px 0' }}>Confirmation statement history</h1>
                                <p style={{ color: '#a0a4b8', fontSize: '0.95rem', margin: 0 }}>
                                    Record of confirmation statements submitted on your behalf through NoirSoft Company Services.
                                </p>
                            </div>

                            {filingHistory.length === 0 ? (
                                <div style={{ width: '100%', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: '28px 20px', textAlign: 'center', boxSizing: 'border-box' }}>
                                    <p style={{ color: '#ffffff', fontSize: '1.05rem', marginTop: 0, marginBottom: '8px' }}>
                                        No confirmation statements filed yet
                                    </p>
                                    <p style={{ color: '#a0a4b8', fontSize: '0.9rem', margin: 0 }}>
                                        Once your confirmation statement is filed through our service, the date, reference number, and status will appear here.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {filingHistory.map((item) => {
                                        const statusLower = (item.status || 'filed').toLowerCase();
                                        const isCompleted = statusLower === 'filed' || statusLower === 'completed' || statusLower === 'accepted';
                                        const isFailed = statusLower === 'failed' || statusLower === 'rejected';

                                        return (
                                            <div
                                                key={item.id}
                                                style={{ width: '100%', boxSizing: 'border-box', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '16px' : '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                                    <div>
                                                        <span style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 600, display: 'block' }}>
                                                            Confirmation Statement (CS01)
                                                        </span>
                                                        <span style={{ color: '#a0a4b8', fontSize: '0.88rem' }}>
                                                            Filed on {formatDate(item.filed_date || item.created_at)}
                                                        </span>
                                                    </div>

                                                    <span style={{
                                                        padding: '4px 12px',
                                                        borderRadius: '12px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 600,
                                                        textTransform: 'uppercase',
                                                        backgroundColor: isCompleted
                                                            ? 'rgba(74, 222, 128, 0.15)'
                                                            : isFailed
                                                                ? 'rgba(255, 107, 107, 0.15)'
                                                                : 'rgba(88, 166, 255, 0.15)',
                                                        color: isCompleted ? '#4ade80' : isFailed ? '#ff6b6b' : '#58a6ff',
                                                    }}>
                                                        {formatStatus(item.status || 'Filed')}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px', paddingTop: '10px', borderTop: '1px solid #1a1c2e', fontSize: '0.9rem' }}>
                                                    <div>
                                                        <span style={{ display: 'block', color: '#a0a4b8', fontSize: '0.78rem' }}>Made Up To Date</span>
                                                        <span style={{ color: '#ffffff' }}>{formatDate(item.statement_date)}</span>
                                                    </div>
                                                    <div>
                                                        <span style={{ display: 'block', color: '#a0a4b8', fontSize: '0.78rem' }}>Filing Reference</span>
                                                        <span style={{ color: '#ffffff', wordBreak: 'break-all' }}>{item.filing_reference || '—'}</span>
                                                    </div>
                                                    <div>
                                                        <span style={{ display: 'block', color: '#a0a4b8', fontSize: '0.78rem' }}>Fee Paid</span>
                                                        <span style={{ color: '#ffffff' }}>{formatCurrency(item.amount_paid)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4. CHANGE PASSWORD (IN-PORTAL) */}
                    {view === 'password' && !loading && (
                        <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <h1 style={{ color: '#ffffff', fontSize: isMobile ? '1.5rem' : '1.9rem', margin: 0 }}>Change password</h1>

                            <div style={{ width: '100%', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '18px' : '24px', boxSizing: 'border-box' }}>
                                <form onSubmit={handleInPortalPasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label htmlFor="currentPwd" style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>Current Password</label>
                                        <input
                                            id="currentPwd"
                                            type="password"
                                            value={currentPwd}
                                            onChange={(e) => setCurrentPwd(e.target.value)}
                                            placeholder="••••••••"
                                            autoComplete="current-password"
                                            required
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label htmlFor="newPwd" style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>New Password</label>
                                        <input
                                            id="newPwd"
                                            type="password"
                                            value={newPwd}
                                            onChange={(e) => setNewPwd(e.target.value)}
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                            required
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label htmlFor="confirmNewPwd" style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>Confirm New Password</label>
                                        <input
                                            id="confirmNewPwd"
                                            type="password"
                                            value={confirmNewPwd}
                                            onChange={(e) => setConfirmNewPwd(e.target.value)}
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                            required
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
                                        />
                                    </div>

                                    {pwdMessage && (
                                        <p style={{ color: pwdMessage.type === 'success' ? '#4ade80' : '#ff6b6b', fontSize: '0.9rem', margin: 0 }}>
                                            {pwdMessage.text}
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={pwdSaving}
                                        style={{ marginTop: '4px', padding: '12px 24px', fontSize: '1rem', fontWeight: 600, borderRadius: '8px', border: 'none', backgroundColor: '#58a6ff', color: '#030511', cursor: pwdSaving ? 'not-allowed' : 'pointer', opacity: pwdSaving ? 0.6 : 1 }}
                                    >
                                        {pwdSaving ? 'Updating...' : 'Update Password'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* FOOTER */}
            <footer style={{ borderTop: '1px solid #1a1c2e', padding: '20px 16px', textAlign: 'center', backgroundColor: '#030511', color: '#a0a4b8', fontSize: '0.85rem' }}>
                <p style={{ margin: '0 0 8px 0' }}>NOIRSOFT LTD &bull; Registration number 15337702</p>
                <p style={{ margin: 0 }}>Email: <a href="mailto:Sales@NoirSoft.net" style={{ color: '#58a6ff', textDecoration: 'none' }}>Sales@NoirSoft.net</a></p>
            </footer>
        </div>
    );
}