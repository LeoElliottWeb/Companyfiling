import React, { useState, useEffect } from 'react';
import homeGif from './home.gif';

// Use the key directly or fallback to env variable if you set one up later
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_oGXmxWNXvypN8XyjM71sBA_b_DINXJo';
const SUPABASE_URL = 'https://xptlootjhzsunvsqqkro.supabase.co';

// Uses the Vite proxy locally and your host rewrite (/api/ch) on the live site
const CH_API_BASE = import.meta.env.VITE_CH_PROXY_URL || '/api/ch';
const CH_API_KEY = import.meta.env.VITE_CH_API_KEY || 'ca7f120b-6b10-43db-8043-d8602205fd58';

// Hardcoded admin credentials
const ADMIN_UID = 'Sales@noirsoft.net';
const ADMIN_PWD = 'OKSdkjdksndki34';
const AUTH_STORAGE_KEY = 'noirsoft_admin_logged_in';

export default function RadioStation() {
    // Auth state (persisted in localStorage)
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
    });
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState(null);

    // Financial stats state (from baltrx table)
    const [balTrx, setBalTrx] = useState({
        total_taken: 0,
        total_transactions: 0,
        total_cost: 0,
        total_profit: 0,
    });
    const [balTrxLoading, setBalTrxLoading] = useState(false);

    // Search state
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [company, setCompany] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);

    // Views: 'search' | 'companies' | 'dueSoon'
    const [view, setView] = useState('search');
    const [selectedCompany, setSelectedCompany] = useState(null);

    // Supabase state
    const [supabaseCompanies, setSupabaseCompanies] = useState([]);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const itemsPerPage = 100;

    // ─── Fetch financial stats from baltrx ───
    const fetchBalTrx = async () => {
        setBalTrxLoading(true);
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/baltrx?select=total_taken,total_transactions,total_cost,total_profit&order=id.desc&limit=1`,
                {
                    method: 'GET',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`baltrx Error (${res.status}): ${errorText}`);
            }

            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                setBalTrx({
                    total_taken: Number(data[0].total_taken ?? 0),
                    total_transactions: Number(data[0].total_transactions ?? 0),
                    total_cost: Number(data[0].total_cost ?? 0),
                    total_profit: Number(data[0].total_profit ?? 0),
                });
            }
        } catch (err) {
            console.error('[baltrx fetch error]', err);
        } finally {
            setBalTrxLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchBalTrx();
        }
    }, [isAuthenticated]);

    // ─── Handle Login ───
    const handleLogin = (e) => {
        e.preventDefault();
        setAuthError(null);

        if (username.trim().toLowerCase() === ADMIN_UID.toLowerCase() && password === ADMIN_PWD) {
            localStorage.setItem(AUTH_STORAGE_KEY, 'true');
            setIsAuthenticated(true);
            setUsername('');
            setPassword('');
        } else {
            setAuthError('Invalid email or password.');
        }
    };

    // ─── Handle Logout ───
    const handleLogout = () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setIsAuthenticated(false);
        setView('search');
        setSelectedCompany(null);
        setCompany(null);
        setHasSearched(false);
        setError(null);
        setSupabaseCompanies([]);
    };

    // ─── Fetch companies from Supabase (Direct API Call) ───
    const fetchSupabaseCompanies = async (pageNumber = 1) => {
        setLoading(true);
        setError(null);

        try {
            const offset = (pageNumber - 1) * itemsPerPage;

            const res = await fetch(`${SUPABASE_URL}/rest/v1/companies?select=*&order=id.desc&limit=${itemsPerPage}&offset=${offset}`, {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'count=exact' // Request total count for pagination
                }
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Supabase Error (${res.status}): ${errorText}`);
            }

            // Extract total count from headers (format is usually "0-99/1234")
            const contentRange = res.headers.get('content-range');
            if (contentRange) {
                const total = parseInt(contentRange.split('/')[1], 10);
                setTotalCount(total);
            }

            const data = await res.json();
            setSupabaseCompanies(data || []);
            setPage(pageNumber);
        } catch (err) {
            console.error('[Supabase fetch error]', err);
            setError('Failed to load database records: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── Companies House search (Uses /api/ch proxy on both Local and Live) ───
    const handleSearch = async (e) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) {
            setError('Please enter a company name or company number.');
            setCompany(null);
            setHasSearched(true);
            return;
        }

        setLoading(true);
        setError(null);
        setCompany(null);
        setHasSearched(true);

        try {
            const authHeader = 'Basic ' + btoa(`${CH_API_KEY}:`);
            const headers = {
                Authorization: authHeader,
                Accept: 'application/json',
            };

            const searchUrl = `${CH_API_BASE}/search/companies?q=${encodeURIComponent(trimmed)}`;
            const res = await fetch(searchUrl, { headers });

            if (!res.ok) {
                if (res.status === 401) throw new Error('Unauthorized. Check your Companies House API key.');
                if (res.status === 404) throw new Error('No companies found.');
                if (res.status === 403) throw new Error('Forbidden. Check that your domain is allowed for this API key.');
                throw new Error(`Search failed (${res.status}).`);
            }

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error('Live proxy (/api/ch) is not configured on your host yet. Add the rewrite rule for /api/ch.');
            }

            const data = await res.json();
            const items = data.items || [];

            if (items.length === 0) {
                setError('No companies found matching that search.');
                return;
            }

            const raw = items[0];
            let confirmationStatement = null;

            // Fetch full company profile to get the confirmation statement due date
            if (raw.company_number) {
                try {
                    const profileRes = await fetch(
                        `${CH_API_BASE}/company/${encodeURIComponent(raw.company_number)}`,
                        { headers }
                    );
                    if (profileRes.ok) {
                        const profileData = await profileRes.json();
                        confirmationStatement = profileData.confirmation_statement || null;
                    }
                } catch (profileErr) {
                    console.warn('[CH Profile Fetch Warning]', profileErr);
                }
            }

            setCompany({
                title: raw.title,
                company_number: raw.company_number,
                address_snippet: raw.address_snippet,
                confirmation_statement: confirmationStatement,
            });
        } catch (err) {
            console.error('[CH Search Error]', err);
            setError(err.message || 'Could not retrieve company details.');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: 'GBP',
        }).format(amount);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not available';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
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

    const handleViewChange = (newView) => {
        setView(newView);
        setSelectedCompany(null);
        setError(null);
        setCompany(null);
        setHasSearched(false);
        setPage(1);

        if (newView === 'companies' || newView === 'dueSoon') {
            fetchSupabaseCompanies(1);
        }
    };

    // ─── LOGIN PAGE ───
    if (!isAuthenticated) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#030511', margin: 0, fontFamily: 'Segoe UI, sans-serif' }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 20px' }}>
                    <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: '32px', boxSizing: 'border-box' }}>
                        <h1 style={{ color: '#ffffff', fontSize: '1.8rem', marginTop: 0, marginBottom: '8px', textAlign: 'center' }}>
                            Company Services
                        </h1>
                        <p style={{ color: '#a0a4b8', fontSize: '0.95rem', marginTop: 0, marginBottom: '28px', textAlign: 'center' }}>
                            Sign in to access automated company filing
                        </p>

                        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label htmlFor="username" style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>Email</label>
                                <input
                                    id="username"
                                    type="email"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter email"
                                    autoComplete="username"
                                    required
                                    style={{ padding: '12px 14px', fontSize: '1rem', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label htmlFor="password" style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>Password</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    required
                                    style={{ padding: '12px 14px', fontSize: '1rem', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
                                />
                            </div>

                            {authError && (
                                <p style={{ color: '#ff6b6b', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
                                    {authError}
                                </p>
                            )}

                            <button
                                type="submit"
                                style={{ marginTop: '8px', padding: '12px 24px', fontSize: '1rem', fontWeight: 600, borderRadius: '8px', border: 'none', backgroundColor: '#58a6ff', color: '#030511', cursor: 'pointer' }}
                            >
                                Sign In
                            </button>
                        </form>
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

    // ─── MAIN AUTHENTICATED APP ───
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#030511', margin: 0, fontFamily: 'Segoe UI, sans-serif' }}>
            <div style={{ display: 'flex', flex: 1 }}>

                {/* SIDEBAR */}
                <div style={{ width: '250px', padding: '40px 20px', backgroundColor: '#030511', borderRight: '1px solid #1a1c2e', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h2 style={{ color: '#ffffff', fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Company Services</h2>
                        <button onClick={() => handleViewChange('search')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: view === 'search' ? '#ffffff' : '#58a6ff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: view === 'search' ? 600 : 400 }}>Company filing search</button>
                        <button onClick={() => handleViewChange('companies')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: view === 'companies' ? '#ffffff' : '#58a6ff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: view === 'companies' ? 600 : 400 }}>List of companies</button>
                        <button onClick={() => handleViewChange('dueSoon')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: view === 'dueSoon' ? '#ffffff' : '#58a6ff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: view === 'dueSoon' ? 600 : 400 }}>Get Confirmation Statements due with 3 months</button>
                    </div>

                    {/* USER & SIGN OUT */}
                    <div style={{ paddingTop: '20px', borderTop: '1px solid #1a1c2e', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <p style={{ margin: 0, color: '#a0a4b8', fontSize: '0.85rem', wordBreak: 'break-word' }}>
                            Signed in as<br />
                            <strong style={{ color: '#ffffff' }}>{ADMIN_UID}</strong>
                        </p>
                        <button
                            onClick={handleLogout}
                            style={{ padding: '10px 14px', fontSize: '0.9rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ff6b6b', cursor: 'pointer', textAlign: 'center' }}
                        >
                            Sign out
                        </button>
                    </div>
                </div>

                {/* MAIN CONTENT */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', padding: '24px 32px 40px 32px', boxSizing: 'border-box' }}>

                    {/* TOP RIGHT STATS BAR (TOTAL TAKEN, TOTAL TRANSACTIONS, TOTAL COST, TOTAL PROFIT) */}
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '10px', padding: '12px 20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ color: '#a0a4b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Taken</span>
                                <span style={{ color: '#58a6ff', fontSize: '1.1rem', fontWeight: 700 }}>
                                    {balTrxLoading ? '...' : formatCurrency(balTrx.total_taken)}
                                </span>
                            </div>
                            <div style={{ width: '1px', height: '32px', backgroundColor: '#1a1c2e' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ color: '#a0a4b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Transactions</span>
                                <span style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 700 }}>
                                    {balTrxLoading ? '...' : balTrx.total_transactions.toLocaleString('en-GB')}
                                </span>
                            </div>
                            <div style={{ width: '1px', height: '32px', backgroundColor: '#1a1c2e' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ color: '#a0a4b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Cost</span>
                                <span style={{ color: '#ff6b6b', fontSize: '1.1rem', fontWeight: 700 }}>
                                    {balTrxLoading ? '...' : formatCurrency(balTrx.total_cost)}
                                </span>
                            </div>
                            <div style={{ width: '1px', height: '32px', backgroundColor: '#1a1c2e' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ color: '#a0a4b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Profit</span>
                                <span style={{ color: balTrx.total_profit < 0 ? '#ff6b6b' : '#4ade80', fontSize: '1.1rem', fontWeight: 700 }}>
                                    {balTrxLoading ? '...' : formatCurrency(balTrx.total_profit)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* SEARCH VIEW */}
                    {view === 'search' && (
                        <>
                            <h1 style={{ color: '#ffffff', fontSize: '2rem', textAlign: 'center', marginBottom: '20px', marginTop: '0' }}>Automated company filing</h1>
                            <p style={{ color: '#a0a4b8', fontSize: '1rem', textAlign: 'center', marginTop: 0, marginBottom: '30px', maxWidth: '600px' }}>Search for your company by name or company number to see when your confirmation statement is due.</p>
                            <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'row', gap: '10px', width: '100%', maxWidth: '600px', marginBottom: '20px' }}>
                                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Company name or company number" style={{ flex: 1, padding: '12px 16px', fontSize: '1rem', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ffffff', outline: 'none' }} />
                                <button type="submit" disabled={loading} style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 600, borderRadius: '8px', border: 'none', backgroundColor: '#58a6ff', color: '#030511', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? 'Searching...' : 'Search'}</button>
                            </form>
                            {error && <p style={{ color: '#ff6b6b', fontSize: '1rem', textAlign: 'center', maxWidth: '600px' }}>{error}</p>}
                            {company && (
                                <div style={{ width: '100%', maxWidth: '600px', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: '24px', boxSizing: 'border-box' }}>
                                    <h2 style={{ color: '#ffffff', fontSize: '1.4rem', marginTop: 0, marginBottom: '8px' }}>{company.title}</h2>
                                    <p style={{ color: '#a0a4b8', fontSize: '0.95rem', margin: '0 0 16px 0' }}>Company number: {company.company_number}</p>
                                    <p style={{ color: '#ffffff', fontSize: '1rem', margin: 0 }}>
                                        <strong>Confirmation statement due:</strong>{' '}
                                        {company.confirmation_statement?.next_due
                                            ? formatDate(company.confirmation_statement.next_due)
                                            : 'Not available'}
                                    </p>
                                    <p style={{ color: '#a0a4b8', fontSize: '0.85rem', marginTop: '16px', marginBottom: 0 }}>{company.address_snippet}</p>
                                </div>
                            )}
                            {!hasSearched && (
                                <>
                                    {homeGif && <img src={homeGif} alt="home" style={{ width: '50%', maxHeight: '50vh', objectFit: 'contain', marginTop: '20px' }} />}
                                    <p style={{ color: '#ffffff', fontSize: '1.2rem', textAlign: 'center', marginTop: '30px' }}>Automatic reminders via email and one-click approvals</p>
                                </>
                            )}
                        </>
                    )}

                    {/* COMPANIES LIST VIEW */}
                    {view === 'companies' && (
                        <>
                            <h1 style={{ color: '#ffffff', fontSize: '2rem', textAlign: 'center', marginBottom: '20px', marginTop: '0' }}>List of companies</h1>
                            <p style={{ color: '#a0a4b8', fontSize: '1rem', textAlign: 'center', marginTop: 0, marginBottom: '30px', maxWidth: '600px' }}>
                                Companies stored in the database {totalCount > 0 && `(showing ${(page - 1) * itemsPerPage + 1}-${Math.min(page * itemsPerPage, totalCount)} of ${totalCount})`}.
                            </p>

                            {loading && <p style={{ color: '#58a6ff' }}>Loading database records...</p>}
                            {error && <p style={{ color: '#ff6b6b', textAlign: 'center', maxWidth: '600px' }}>{error}</p>}

                            {!loading && !error && supabaseCompanies.length === 0 && (
                                <p style={{ color: '#a0a4b8', textAlign: 'center' }}>No companies found in the database.</p>
                            )}

                            {!selectedCompany && !loading && !error && supabaseCompanies.length > 0 && (
                                <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column' }}>

                                    {/* Scrollable List Container */}
                                    <div style={{
                                        maxHeight: '60vh',
                                        overflowY: 'auto',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        paddingRight: '10px',
                                        marginBottom: '20px'
                                    }}>
                                        {supabaseCompanies.map((c) => (
                                            <button key={c.id} onClick={() => setSelectedCompany(c)} style={{ textAlign: 'left', padding: '16px 20px', fontSize: '1rem', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ffffff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                                    <span style={{ fontWeight: 600 }}>{c.company_name}</span>
                                                    {isDueWithinThreeMonths(c.next_confirmation_statement) && (
                                                        <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#e53e3e', color: '#ffffff', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Due soon</span>
                                                    )}
                                                </div>
                                                <span style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>Company No: {c.company_number}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Pagination Controls */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingTop: '10px', borderTop: '1px solid #1a1c2e' }}>
                                        <button
                                            onClick={() => fetchSupabaseCompanies(page - 1)}
                                            disabled={page === 1 || loading}
                                            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: 'transparent', color: page === 1 ? '#555' : '#58a6ff', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                                        >
                                            ← Previous
                                        </button>
                                        <span style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>Page {page}</span>
                                        <button
                                            onClick={() => fetchSupabaseCompanies(page + 1)}
                                            disabled={page * itemsPerPage >= totalCount || loading}
                                            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: 'transparent', color: page * itemsPerPage >= totalCount ? '#555' : '#58a6ff', cursor: page * itemsPerPage >= totalCount ? 'not-allowed' : 'pointer' }}
                                        >
                                            Next →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedCompany && (
                                <div style={{ width: '100%', maxWidth: '600px', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: '24px', boxSizing: 'border-box' }}>
                                    <h2 style={{ color: '#ffffff', fontSize: '1.4rem', marginTop: 0, marginBottom: '16px' }}>{selectedCompany.company_name}</h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <p style={{ margin: 0, color: '#ffffff' }}><strong style={{ color: '#a0a4b8' }}>Company Number: </strong>{selectedCompany.company_number}</p>
                                        <p style={{ margin: 0, color: '#ffffff' }}><strong style={{ color: '#a0a4b8' }}>Confirmation Statement Due: </strong>{formatDate(selectedCompany.next_confirmation_statement)}</p>
                                        {isDueWithinThreeMonths(selectedCompany.next_confirmation_statement) && (
                                            <p style={{ margin: 0, color: '#e53e3e', fontWeight: 600 }}>⚠️ Due within 3 months</p>
                                        )}
                                    </div>
                                    <button onClick={() => setSelectedCompany(null)} style={{ marginTop: '24px', padding: '10px 20px', fontSize: '0.95rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: 'transparent', color: '#58a6ff', cursor: 'pointer' }}>← Back to list</button>
                                </div>
                            )}
                        </>
                    )}

                    {/* DUE SOON VIEW */}
                    {view === 'dueSoon' && (
                        <>
                            <h1 style={{ color: '#ffffff', fontSize: '2rem', textAlign: 'center', marginBottom: '20px', marginTop: '0' }}>Confirmation statements due</h1>
                            <p style={{ color: '#a0a4b8', fontSize: '1rem', textAlign: 'center', marginTop: 0, marginBottom: '30px', maxWidth: '600px' }}>Companies with confirmation statements due within the next 3 months.</p>

                            {loading && <p style={{ color: '#58a6ff' }}>Loading...</p>}

                            {!selectedCompany && !loading && supabaseCompanies.filter((c) => isDueWithinThreeMonths(c.next_confirmation_statement)).length === 0 ? (
                                <p style={{ color: '#a0a4b8', textAlign: 'center' }}>No confirmation statements are due within the next 3 months (in the current records).</p>
                            ) : (
                                !selectedCompany && !loading && (
                                    <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column' }}>

                                        {/* Scrollable List Container */}
                                        <div style={{
                                            maxHeight: '60vh',
                                            overflowY: 'auto',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px',
                                            paddingRight: '10px',
                                            marginBottom: '20px'
                                        }}>
                                            {supabaseCompanies.filter((c) => isDueWithinThreeMonths(c.next_confirmation_statement)).map((c) => (
                                                <button key={c.id} onClick={() => setSelectedCompany(c)} style={{ textAlign: 'left', padding: '16px 20px', fontSize: '1rem', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ffffff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                                        <span style={{ fontWeight: 600 }}>{c.company_name}</span>
                                                        <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#e53e3e', color: '#ffffff', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Due {formatDate(c.next_confirmation_statement)}</span>
                                                    </div>
                                                    <span style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>Company No: {c.company_number}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Pagination Controls */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingTop: '10px', borderTop: '1px solid #1a1c2e' }}>
                                            <button
                                                onClick={() => fetchSupabaseCompanies(page - 1)}
                                                disabled={page === 1 || loading}
                                                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: 'transparent', color: page === 1 ? '#555' : '#58a6ff', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                                            >
                                                ← Previous
                                            </button>
                                            <span style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>Page {page}</span>
                                            <button
                                                onClick={() => fetchSupabaseCompanies(page + 1)}
                                                disabled={page * itemsPerPage >= totalCount || loading}
                                                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: 'transparent', color: page * itemsPerPage >= totalCount ? '#555' : '#58a6ff', cursor: page * itemsPerPage >= totalCount ? 'not-allowed' : 'pointer' }}
                                            >
                                                Next →
                                            </button>
                                        </div>
                                    </div>
                                )
                            )}

                            {selectedCompany && (
                                <div style={{ width: '100%', maxWidth: '600px', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: '24px', boxSizing: 'border-box' }}>
                                    <h2 style={{ color: '#ffffff', fontSize: '1.4rem', marginTop: 0, marginBottom: '16px' }}>{selectedCompany.company_name}</h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <p style={{ margin: 0, color: '#ffffff' }}><strong style={{ color: '#a0a4b8' }}>Company Number: </strong>{selectedCompany.company_number}</p>
                                        <p style={{ margin: 0, color: '#ffffff' }}><strong style={{ color: '#a0a4b8' }}>Confirmation Statement Due: </strong>{formatDate(selectedCompany.next_confirmation_statement)}</p>
                                        <p style={{ margin: 0, color: '#e53e3e', fontWeight: 600 }}>⚠️ Due within 3 months</p>
                                    </div>
                                    <button onClick={() => setSelectedCompany(null)} style={{ marginTop: '24px', padding: '10px 20px', fontSize: '0.95rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: 'transparent', color: '#58a6ff', cursor: 'pointer' }}>← Back to list</button>
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