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
const ADMIN_PWD = 'batman123';
const AUTH_STORAGE_KEY = 'noirsoft_admin_logged_in';

export default function RadioStation() {
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

    // Auth state (persisted in localStorage)
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
    });
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState(null);

    // Financial stats state (calculated live from `transactions` table)
    const [stats, setStats] = useState({
        total_taken: 0,
        total_transactions: 0,
        total_cost: 0,
        total_profit: 0,
    });
    const [statsLoading, setStatsLoading] = useState(false);

    // Search state
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [company, setCompany] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);

    // Views: 'search' | 'companies' | 'dueSoon' | 'charges' | 'costs'
    const [view, setView] = useState('search');
    const [selectedCompany, setSelectedCompany] = useState(null);

    // Supabase companies state
    const [supabaseCompanies, setSupabaseCompanies] = useState([]);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const itemsPerPage = 100;

    // Manage Charges state (from `charges` table)
    const [charges, setCharges] = useState([]);
    const [chargesLoading, setChargesLoading] = useState(false);
    const [chargesError, setChargesError] = useState(null);
    const [chargesSuccess, setChargesSuccess] = useState(null);
    const [newChargeDesc, setNewChargeDesc] = useState('');
    const [newChargeFee, setNewChargeFee] = useState('');
    const [chargeSaving, setChargeSaving] = useState(false);
    const [editingChargeId, setEditingChargeId] = useState(null);
    const [editChargeDesc, setEditChargeDesc] = useState('');
    const [editChargeFee, setEditChargeFee] = useState('');

    // Manage Costs state (from `cost` table)
    const [costs, setCosts] = useState([]);
    const [costsLoading, setCostsLoading] = useState(false);
    const [costsError, setCostsError] = useState(null);
    const [costsSuccess, setCostsSuccess] = useState(null);
    const [newCostDesc, setNewCostDesc] = useState('');
    const [newCostCharge, setNewCostCharge] = useState('');
    const [costSaving, setCostSaving] = useState(false);
    const [editingCostId, setEditingCostId] = useState(null);
    const [editCostDesc, setEditCostDesc] = useState('');
    const [editCostCharge, setEditCostCharge] = useState('');

    const supabaseHeaders = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
    };

    // ─── Calculate financial stats directly from `transactions` table ───
    const fetchTransactionStats = async () => {
        setStatsLoading(true);
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/transactions?select=total_charged,cost`,
                {
                    method: 'GET',
                    headers: supabaseHeaders,
                }
            );

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`transactions Error (${res.status}): ${errorText}`);
            }

            const data = await res.json();
            const rows = Array.isArray(data) ? data : [];

            const totals = rows.reduce(
                (acc, row) => {
                    acc.total_taken += Number(row.total_charged ?? 0);
                    acc.total_cost += Number(row.cost ?? 0);
                    acc.total_transactions += 1;
                    return acc;
                },
                { total_taken: 0, total_cost: 0, total_transactions: 0 }
            );

            setStats({
                total_taken: totals.total_taken,
                total_transactions: totals.total_transactions,
                total_cost: totals.total_cost,
                total_profit: totals.total_taken - totals.total_cost,
            });
        } catch (err) {
            console.error('[transactions stats fetch error]', err);
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchTransactionStats();
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
        setMobileMenuOpen(false);
        setView('search');
        setSelectedCompany(null);
        setCompany(null);
        setHasSearched(false);
        setError(null);
        setSupabaseCompanies([]);
        setCharges([]);
        setChargesError(null);
        setChargesSuccess(null);
        setEditingChargeId(null);
        setCosts([]);
        setCostsError(null);
        setCostsSuccess(null);
        setEditingCostId(null);
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
                    ...supabaseHeaders,
                    Prefer: 'count=exact',
                },
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Supabase Error (${res.status}): ${errorText}`);
            }

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

    // ─── Manage Charges CRUD (Supabase `charges` table) ───
    const fetchCharges = async () => {
        setChargesLoading(true);
        setChargesError(null);

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/charges?select=*&order=id.asc`, {
                method: 'GET',
                headers: supabaseHeaders,
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Could not load charges (${res.status}): ${errText}`);
            }

            const data = await res.json();
            setCharges(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('[Charges fetch error]', err);
            setChargesError(err.message || 'Failed to load charges.');
        } finally {
            setChargesLoading(false);
        }
    };

    const handleAddCharge = async (e) => {
        e.preventDefault();
        setChargesError(null);
        setChargesSuccess(null);

        const desc = newChargeDesc.trim();
        const feeNum = parseFloat(newChargeFee);

        if (!desc) {
            setChargesError('Please enter a charge description.');
            return;
        }
        if (isNaN(feeNum) || feeNum < 0) {
            setChargesError('Please enter a valid non-negative fee.');
            return;
        }

        setChargeSaving(true);
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/charges`, {
                method: 'POST',
                headers: { ...supabaseHeaders, Prefer: 'return=representation' },
                body: JSON.stringify({ description: desc, fee: feeNum }),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Could not add charge (${res.status}): ${errText}`);
            }

            const inserted = await res.json();
            if (Array.isArray(inserted) && inserted.length > 0) {
                setCharges((prev) => [...prev, inserted[0]]);
            } else {
                await fetchCharges();
            }

            setNewChargeDesc('');
            setNewChargeFee('');
            setChargesSuccess('Charge added successfully.');
        } catch (err) {
            console.error('[Add charge error]', err);
            setChargesError(err.message || 'Failed to add charge.');
        } finally {
            setChargeSaving(false);
        }
    };

    const handleStartEditCharge = (item) => {
        setEditingChargeId(item.id);
        setEditChargeDesc(item.description || '');
        setEditChargeFee(item.fee !== null && item.fee !== undefined ? String(item.fee) : '');
        setChargesError(null);
        setChargesSuccess(null);
    };

    const handleCancelEditCharge = () => {
        setEditingChargeId(null);
        setEditChargeDesc('');
        setEditChargeFee('');
    };

    const handleSaveEditCharge = async (id) => {
        setChargesError(null);
        setChargesSuccess(null);

        const desc = editChargeDesc.trim();
        const feeNum = parseFloat(editChargeFee);

        if (!desc) {
            setChargesError('Description cannot be empty.');
            return;
        }
        if (isNaN(feeNum) || feeNum < 0) {
            setChargesError('Please enter a valid non-negative fee.');
            return;
        }

        setChargeSaving(true);
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/charges?id=eq.${id}`, {
                method: 'PATCH',
                headers: { ...supabaseHeaders, Prefer: 'return=representation' },
                body: JSON.stringify({ description: desc, fee: feeNum }),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Could not update charge (${res.status}): ${errText}`);
            }

            const updated = await res.json();
            const updatedRow = Array.isArray(updated) && updated.length > 0 ? updated[0] : { id, description: desc, fee: feeNum };

            setCharges((prev) => prev.map((c) => (c.id === id ? { ...c, ...updatedRow } : c)));
            setEditingChargeId(null);
            setChargesSuccess('Charge updated.');
        } catch (err) {
            console.error('[Update charge error]', err);
            setChargesError(err.message || 'Failed to update charge.');
        } finally {
            setChargeSaving(false);
        }
    };

    const handleDeleteCharge = async (id) => {
        setChargesError(null);
        setChargesSuccess(null);
        setChargeSaving(true);

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/charges?id=eq.${id}`, {
                method: 'DELETE',
                headers: supabaseHeaders,
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Could not delete charge (${res.status}): ${errText}`);
            }

            setCharges((prev) => prev.filter((c) => c.id !== id));
            if (editingChargeId === id) {
                setEditingChargeId(null);
            }
            setChargesSuccess('Charge deleted.');
        } catch (err) {
            console.error('[Delete charge error]', err);
            setChargesError(err.message || 'Failed to delete charge.');
        } finally {
            setChargeSaving(false);
        }
    };

    // ─── Manage Costs CRUD (Supabase `cost` table) ───
    const fetchCosts = async () => {
        setCostsLoading(true);
        setCostsError(null);

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/cost?select=*&order=id.asc`, {
                method: 'GET',
                headers: supabaseHeaders,
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Could not load costs (${res.status}): ${errText}`);
            }

            const data = await res.json();
            setCosts(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('[Costs fetch error]', err);
            setCostsError(err.message || 'Failed to load costs.');
        } finally {
            setCostsLoading(false);
        }
    };

    const handleAddCost = async (e) => {
        e.preventDefault();
        setCostsError(null);
        setCostsSuccess(null);

        const desc = newCostDesc.trim();
        const chargeNum = parseFloat(newCostCharge);

        if (!desc) {
            setCostsError('Please enter a cost description.');
            return;
        }
        if (isNaN(chargeNum) || chargeNum < 0) {
            setCostsError('Please enter a valid non-negative cost.');
            return;
        }

        setCostSaving(true);
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/cost`, {
                method: 'POST',
                headers: { ...supabaseHeaders, Prefer: 'return=representation' },
                body: JSON.stringify({ description: desc, charge: chargeNum }),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Could not add cost (${res.status}): ${errText}`);
            }

            const inserted = await res.json();
            if (Array.isArray(inserted) && inserted.length > 0) {
                setCosts((prev) => [...prev, inserted[0]]);
            } else {
                await fetchCosts();
            }

            setNewCostDesc('');
            setNewCostCharge('');
            setCostsSuccess('Cost added successfully.');
        } catch (err) {
            console.error('[Add cost error]', err);
            setCostsError(err.message || 'Failed to add cost.');
        } finally {
            setCostSaving(false);
        }
    };

    const handleStartEditCost = (item) => {
        setEditingCostId(item.id);
        setEditCostDesc(item.description || '');
        setEditCostCharge(item.charge !== null && item.charge !== undefined ? String(item.charge) : '');
        setCostsError(null);
        setCostsSuccess(null);
    };

    const handleCancelEditCost = () => {
        setEditingCostId(null);
        setEditCostDesc('');
        setEditCostCharge('');
    };

    const handleSaveEditCost = async (id) => {
        setCostsError(null);
        setCostsSuccess(null);

        const desc = editCostDesc.trim();
        const chargeNum = parseFloat(editCostCharge);

        if (!desc) {
            setCostsError('Description cannot be empty.');
            return;
        }
        if (isNaN(chargeNum) || chargeNum < 0) {
            setCostsError('Please enter a valid non-negative cost.');
            return;
        }

        setCostSaving(true);
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/cost?id=eq.${id}`, {
                method: 'PATCH',
                headers: { ...supabaseHeaders, Prefer: 'return=representation' },
                body: JSON.stringify({ description: desc, charge: chargeNum }),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Could not update cost (${res.status}): ${errText}`);
            }

            const updated = await res.json();
            const updatedRow = Array.isArray(updated) && updated.length > 0 ? updated[0] : { id, description: desc, charge: chargeNum };

            setCosts((prev) => prev.map((c) => (c.id === id ? { ...c, ...updatedRow } : c)));
            setEditingCostId(null);
            setCostsSuccess('Cost updated.');
        } catch (err) {
            console.error('[Update cost error]', err);
            setCostsError(err.message || 'Failed to update cost.');
        } finally {
            setCostSaving(false);
        }
    };

    const handleDeleteCost = async (id) => {
        setCostsError(null);
        setCostsSuccess(null);
        setCostSaving(true);

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/cost?id=eq.${id}`, {
                method: 'DELETE',
                headers: supabaseHeaders,
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Could not delete cost (${res.status}): ${errText}`);
            }

            setCosts((prev) => prev.filter((c) => c.id !== id));
            if (editingCostId === id) {
                setEditingCostId(null);
            }
            setCostsSuccess('Cost deleted.');
        } catch (err) {
            console.error('[Delete cost error]', err);
            setCostsError(err.message || 'Failed to delete cost.');
        } finally {
            setCostSaving(false);
        }
    };

    // ─── Format Companies House officer name ("SURNAME, First Name" -> "First Name Surname") ───
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
            let directors = [];

            if (raw.company_number) {
                const companyNum = encodeURIComponent(raw.company_number);
                const [profileResult, officersResult] = await Promise.allSettled([
                    fetch(`${CH_API_BASE}/company/${companyNum}`, { headers }),
                    fetch(`${CH_API_BASE}/company/${companyNum}/officers`, { headers }),
                ]);

                if (profileResult.status === 'fulfilled' && profileResult.value.ok) {
                    try {
                        const profileData = await profileResult.value.json();
                        confirmationStatement = profileData.confirmation_statement || null;
                    } catch (profileErr) {
                        console.warn('[CH Profile Parse Warning]', profileErr);
                    }
                } else if (profileResult.status === 'rejected') {
                    console.warn('[CH Profile Fetch Warning]', profileResult.reason);
                }

                if (officersResult.status === 'fulfilled' && officersResult.value.ok) {
                    try {
                        const officersData = await officersResult.value.json();
                        const officerItems = officersData.items || [];
                        directors = officerItems
                            .filter(
                                (officer) =>
                                    !officer.resigned_on &&
                                    (officer.officer_role || '').toLowerCase().includes('director')
                            )
                            .map((officer) => formatOfficerName(officer.name))
                            .filter(Boolean);
                    } catch (officersErr) {
                        console.warn('[CH Officers Parse Warning]', officersErr);
                    }
                } else if (officersResult.status === 'rejected') {
                    console.warn('[CH Officers Fetch Warning]', officersResult.reason);
                }
            }

            setCompany({
                title: raw.title,
                company_number: raw.company_number,
                address_snippet: raw.address_snippet,
                confirmation_statement: confirmationStatement,
                directors,
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
        }).format(Number(amount || 0));
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
        setMobileMenuOpen(false);
        setChargesError(null);
        setChargesSuccess(null);
        setEditingChargeId(null);
        setCostsError(null);
        setCostsSuccess(null);
        setEditingCostId(null);

        if (newView === 'companies' || newView === 'dueSoon') {
            fetchSupabaseCompanies(1);
        } else if (newView === 'charges') {
            fetchCharges();
        } else if (newView === 'costs') {
            fetchCosts();
        }
    };

    // ─── LOGIN PAGE ───
    if (!isAuthenticated) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#030511', margin: 0, fontFamily: 'Segoe UI, sans-serif', overflowX: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: isMobile ? '24px 16px' : '40px 20px', boxSizing: 'border-box' }}>
                    <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '24px 20px' : '32px', boxSizing: 'border-box' }}>
                        <h1 style={{ color: '#ffffff', fontSize: isMobile ? '1.5rem' : '1.8rem', marginTop: 0, marginBottom: '8px', textAlign: 'center' }}>
                            Company Services
                        </h1>
                        <p style={{ color: '#a0a4b8', fontSize: '0.95rem', marginTop: 0, marginBottom: '28px', textAlign: 'center' }}>
                            Sign in to access automated company confirmation statement filing
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
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
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
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
                                />
                            </div>

                            {authError && (
                                <p style={{ color: '#ff6b6b', fontSize: '0.9rem', margin: 0, textAlign: 'center' }}>
                                    {authError}
                                </p>
                            )}

                            <button
                                type="submit"
                                style={{ marginTop: '8px', width: '100%', padding: '12px 24px', fontSize: '1rem', fontWeight: 600, borderRadius: '8px', border: 'none', backgroundColor: '#58a6ff', color: '#030511', cursor: 'pointer' }}
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
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#030511', margin: 0, fontFamily: 'Segoe UI, sans-serif', overflowX: 'hidden' }}>

            {/* MOBILE TOP BAR */}
            {isMobile && (
                <header style={{ width: '100%', backgroundColor: '#030511', borderBottom: '1px solid #1a1c2e', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
                        <h2 style={{ color: '#ffffff', fontSize: '1.15rem', margin: 0 }}>Company Services</h2>
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen((prev) => !prev)}
                            aria-label="Toggle navigation menu"
                            style={{ padding: '8px 12px', fontSize: '0.95rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ffffff', cursor: 'pointer' }}
                        >
                            {mobileMenuOpen ? '✕ Close' : '☰ Menu'}
                        </button>
                    </div>

                    {/* MOBILE COLLAPSIBLE NAV DRAWER */}
                    {mobileMenuOpen && (
                        <nav style={{ padding: '12px 16px 20px 16px', borderTop: '1px solid #1a1c2e', backgroundColor: '#0d1020', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <button onClick={() => handleViewChange('search')} style={{ background: 'none', border: 'none', padding: '6px 0', textAlign: 'left', color: view === 'search' ? '#ffffff' : '#58a6ff', fontSize: '1.05rem', cursor: 'pointer', fontWeight: view === 'search' ? 600 : 400 }}>Company filing search</button>
                            <button onClick={() => handleViewChange('companies')} style={{ background: 'none', border: 'none', padding: '6px 0', textAlign: 'left', color: view === 'companies' ? '#ffffff' : '#58a6ff', fontSize: '1.05rem', cursor: 'pointer', fontWeight: view === 'companies' ? 600 : 400 }}>List of companies</button>
                            <button onClick={() => handleViewChange('dueSoon')} style={{ background: 'none', border: 'none', padding: '6px 0', textAlign: 'left', color: view === 'dueSoon' ? '#ffffff' : '#58a6ff', fontSize: '1.05rem', cursor: 'pointer', fontWeight: view === 'dueSoon' ? 600 : 400 }}>Get Confirmation Statements due within 3 months</button>

                            <div style={{ paddingTop: '12px', borderTop: '1px solid #1a1c2e', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <span style={{ color: '#a0a4b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 700 }}>Maintain</span>
                                <button onClick={() => handleViewChange('charges')} style={{ background: 'none', border: 'none', padding: '6px 0', textAlign: 'left', color: view === 'charges' ? '#ffffff' : '#58a6ff', fontSize: '1.05rem', cursor: 'pointer', fontWeight: view === 'charges' ? 600 : 400 }}>Manage charges</button>
                                <button onClick={() => handleViewChange('costs')} style={{ background: 'none', border: 'none', padding: '6px 0', textAlign: 'left', color: view === 'costs' ? '#ffffff' : '#58a6ff', fontSize: '1.05rem', cursor: 'pointer', fontWeight: view === 'costs' ? 600 : 400 }}>Manage costs</button>
                            </div>

                            <div style={{ paddingTop: '14px', borderTop: '1px solid #1a1c2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <p style={{ margin: 0, color: '#a0a4b8', fontSize: '0.85rem', wordBreak: 'break-word' }}>
                                    Signed in as <strong style={{ color: '#ffffff' }}>{ADMIN_UID}</strong>
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
                            <h2 style={{ color: '#ffffff', fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Company Services</h2>
                            <button onClick={() => handleViewChange('search')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: view === 'search' ? '#ffffff' : '#58a6ff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: view === 'search' ? 600 : 400 }}>Company filing search</button>
                            <button onClick={() => handleViewChange('companies')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: view === 'companies' ? '#ffffff' : '#58a6ff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: view === 'companies' ? 600 : 400 }}>List of companies</button>
                            <button onClick={() => handleViewChange('dueSoon')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: view === 'dueSoon' ? '#ffffff' : '#58a6ff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: view === 'dueSoon' ? 600 : 400 }}>Get Confirmation Statements due within 3 months</button>
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
                )}

                {/* MAINTAIN MENU PANEL (DESKTOP — POSITIONED NEXT TO MAIN SIDEBAR) */}
                {!isMobile && (
                    <aside style={{ width: '230px', flexShrink: 0, padding: '24px 16px', backgroundColor: '#030511', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
                        <div style={{
                            flex: 1,
                            backgroundColor: '#080b18',
                            border: '1px solid #1a1c2e',
                            borderRadius: '10px',
                            padding: '24px 18px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            boxSizing: 'border-box',
                        }}>
                            <h2 style={{ color: '#ffffff', fontSize: '1.1rem', marginTop: 0, marginBottom: '4px', paddingBottom: '12px', borderBottom: '1px solid #1a1c2e' }}>
                                Maintain
                            </h2>
                            <button
                                onClick={() => handleViewChange('charges')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    textAlign: 'left',
                                    color: view === 'charges' ? '#ffffff' : '#58a6ff',
                                    fontSize: '1.02rem',
                                    cursor: 'pointer',
                                    fontWeight: view === 'charges' ? 600 : 400,
                                }}
                            >
                                Manage charges
                            </button>
                            <button
                                onClick={() => handleViewChange('costs')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    textAlign: 'left',
                                    color: view === 'costs' ? '#ffffff' : '#58a6ff',
                                    fontSize: '1.02rem',
                                    cursor: 'pointer',
                                    fontWeight: view === 'costs' ? 600 : 400,
                                }}
                            >
                                Manage costs
                            </button>
                        </div>
                    </aside>
                )}

                {/* MAIN CONTENT */}
                <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', padding: isMobile ? '16px 16px 32px 16px' : '24px 32px 40px 32px', boxSizing: 'border-box' }}>

                    {/* STATS BAR (CALCULATED FROM `transactions` TABLE) */}
                    <div style={{ width: '100%', display: 'flex', justifyContent: isMobile ? 'center' : 'flex-end', marginBottom: '24px' }}>
                        <div style={
                            isMobile
                                ? {
                                    width: '100%',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '12px',
                                    backgroundColor: '#0d1020',
                                    border: '1px solid #1a1c2e',
                                    borderRadius: '10px',
                                    padding: '14px',
                                    boxSizing: 'border-box',
                                }
                                : {
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: '20px',
                                    backgroundColor: '#0d1020',
                                    border: '1px solid #1a1c2e',
                                    borderRadius: '10px',
                                    padding: '12px 20px',
                                }
                        }>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'flex-end' }}>
                                <span style={{ color: '#a0a4b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Taken</span>
                                <span style={{ color: '#58a6ff', fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700 }}>
                                    {statsLoading ? '...' : formatCurrency(stats.total_taken)}
                                </span>
                            </div>

                            {!isMobile && <div style={{ width: '1px', height: '32px', backgroundColor: '#1a1c2e' }} />}

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'flex-end' }}>
                                <span style={{ color: '#a0a4b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Transactions</span>
                                <span style={{ color: '#ffffff', fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700 }}>
                                    {statsLoading ? '...' : stats.total_transactions.toLocaleString('en-GB')}
                                </span>
                            </div>

                            {!isMobile && <div style={{ width: '1px', height: '32px', backgroundColor: '#1a1c2e' }} />}

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'flex-end' }}>
                                <span style={{ color: '#a0a4b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Cost</span>
                                <span style={{ color: '#ff6b6b', fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700 }}>
                                    {statsLoading ? '...' : formatCurrency(stats.total_cost)}
                                </span>
                            </div>

                            {!isMobile && <div style={{ width: '1px', height: '32px', backgroundColor: '#1a1c2e' }} />}

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'flex-end' }}>
                                <span style={{ color: '#a0a4b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Profit</span>
                                <span style={{ color: stats.total_profit < 0 ? '#ff6b6b' : '#4ade80', fontSize: isMobile ? '1rem' : '1.1rem', fontWeight: 700 }}>
                                    {statsLoading ? '...' : formatCurrency(stats.total_profit)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* SEARCH VIEW */}
                    {view === 'search' && (
                        <>
                            <h1 style={{ color: '#ffffff', fontSize: isMobile ? '1.5rem' : '2rem', textAlign: 'center', marginBottom: '14px', marginTop: '0' }}>Automated company confirmation statement filing</h1>
                            <p style={{ color: '#a0a4b8', fontSize: isMobile ? '0.95rem' : '1rem', textAlign: 'center', marginTop: 0, marginBottom: '24px', maxWidth: '600px' }}>Search for a company by name or company number to see when their confirmation statement is due.</p>
                            <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', width: '100%', maxWidth: '600px', marginBottom: '20px' }}>
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Company name or company number"
                                    style={{ flex: 1, width: '100%', boxSizing: 'border-box', padding: '12px 16px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ffffff', outline: 'none' }}
                                />
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{ width: isMobile ? '100%' : 'auto', padding: '12px 24px', fontSize: '1rem', fontWeight: 600, borderRadius: '8px', border: 'none', backgroundColor: '#58a6ff', color: '#030511', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
                                >
                                    {loading ? 'Searching...' : 'Search'}
                                </button>
                            </form>
                            {error && <p style={{ color: '#ff6b6b', fontSize: '0.95rem', textAlign: 'center', maxWidth: '600px' }}>{error}</p>}
                            {company && (
                                <div style={{ width: '100%', maxWidth: '600px', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '18px' : '24px', boxSizing: 'border-box' }}>
                                    <h2 style={{ color: '#ffffff', fontSize: isMobile ? '1.2rem' : '1.4rem', marginTop: 0, marginBottom: '8px', wordBreak: 'break-word' }}>{company.title}</h2>
                                    <p style={{ color: '#a0a4b8', fontSize: '0.95rem', margin: '0 0 16px 0' }}>Company number: {company.company_number}</p>
                                    <p style={{ color: '#ffffff', fontSize: '1rem', margin: '0 0 12px 0' }}>
                                        <strong>Confirmation statement due:</strong>{' '}
                                        {company.confirmation_statement?.next_due
                                            ? formatDate(company.confirmation_statement.next_due)
                                            : 'Not available'}
                                    </p>
                                    <p style={{ color: '#ffffff', fontSize: '1rem', margin: 0 }}>
                                        <strong>{company.directors?.length === 1 ? 'Director' : 'Directors'}:</strong>{' '}
                                        {company.directors && company.directors.length > 0
                                            ? company.directors.join(', ')
                                            : 'Not available'}
                                    </p>
                                    <p style={{ color: '#a0a4b8', fontSize: '0.85rem', marginTop: '16px', marginBottom: 0 }}>{company.address_snippet}</p>
                                </div>
                            )}
                            {!hasSearched && (
                                <>
                                    {homeGif && (
                                        <img
                                            src={homeGif}
                                            alt="home"
                                            style={{ width: isMobile ? '90%' : '50%', maxWidth: '500px', maxHeight: '45vh', objectFit: 'contain', marginTop: '16px' }}
                                        />
                                    )}
                                    <p style={{ color: '#ffffff', fontSize: isMobile ? '1rem' : '1.2rem', textAlign: 'center', marginTop: '24px', maxWidth: '500px' }}>Automatic reminders via email and one-click approvals</p>
                                </>
                            )}
                        </>
                    )}

                    {/* COMPANIES LIST VIEW */}
                    {view === 'companies' && (
                        <>
                            <h1 style={{ color: '#ffffff', fontSize: isMobile ? '1.5rem' : '2rem', textAlign: 'center', marginBottom: '14px', marginTop: '0' }}>List of companies</h1>
                            <p style={{ color: '#a0a4b8', fontSize: isMobile ? '0.95rem' : '1rem', textAlign: 'center', marginTop: 0, marginBottom: '24px', maxWidth: '600px' }}>
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
                                        maxHeight: isMobile ? '55vh' : '60vh',
                                        overflowY: 'auto',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        paddingRight: isMobile ? '4px' : '10px',
                                        marginBottom: '20px'
                                    }}>
                                        {supabaseCompanies.map((c) => (
                                            <button key={c.id} onClick={() => setSelectedCompany(c)} style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', padding: isMobile ? '14px' : '16px 20px', fontSize: '1rem', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ffffff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', width: '100%' }}>
                                                    <span style={{ fontWeight: 600, wordBreak: 'break-word' }}>{c.company_name}</span>
                                                    {isDueWithinThreeMonths(c.next_confirmation_statement) && (
                                                        <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#e53e3e', color: '#ffffff', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Due soon</span>
                                                    )}
                                                </div>
                                                <span style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>Company No: {c.company_number}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Pagination Controls */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingTop: '10px', borderTop: '1px solid #1a1c2e', gap: '8px' }}>
                                        <button
                                            onClick={() => fetchSupabaseCompanies(page - 1)}
                                            disabled={page === 1 || loading}
                                            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: 'transparent', color: page === 1 ? '#555' : '#58a6ff', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                                        >
                                            ← Previous
                                        </button>
                                        <span style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>Page {page}</span>
                                        <button
                                            onClick={() => fetchSupabaseCompanies(page + 1)}
                                            disabled={page * itemsPerPage >= totalCount || loading}
                                            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: 'transparent', color: page * itemsPerPage >= totalCount ? '#555' : '#58a6ff', cursor: page * itemsPerPage >= totalCount ? 'not-allowed' : 'pointer' }}
                                        >
                                            Next →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedCompany && (
                                <div style={{ width: '100%', maxWidth: '600px', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '18px' : '24px', boxSizing: 'border-box' }}>
                                    <h2 style={{ color: '#ffffff', fontSize: isMobile ? '1.2rem' : '1.4rem', marginTop: 0, marginBottom: '16px', wordBreak: 'break-word' }}>{selectedCompany.company_name}</h2>
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
                            <h1 style={{ color: '#ffffff', fontSize: isMobile ? '1.5rem' : '2rem', textAlign: 'center', marginBottom: '14px', marginTop: '0' }}>Confirmation statements due</h1>
                            <p style={{ color: '#a0a4b8', fontSize: isMobile ? '0.95rem' : '1rem', textAlign: 'center', marginTop: 0, marginBottom: '24px', maxWidth: '600px' }}>Companies with confirmation statements due within the next 3 months.</p>

                            {loading && <p style={{ color: '#58a6ff' }}>Loading...</p>}

                            {!selectedCompany && !loading && supabaseCompanies.filter((c) => isDueWithinThreeMonths(c.next_confirmation_statement)).length === 0 ? (
                                <p style={{ color: '#a0a4b8', textAlign: 'center' }}>No confirmation statements are due within the next 3 months (in the current records).</p>
                            ) : (
                                !selectedCompany && !loading && (
                                    <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column' }}>

                                        {/* Scrollable List Container */}
                                        <div style={{
                                            maxHeight: isMobile ? '55vh' : '60vh',
                                            overflowY: 'auto',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px',
                                            paddingRight: isMobile ? '4px' : '10px',
                                            marginBottom: '20px'
                                        }}>
                                            {supabaseCompanies.filter((c) => isDueWithinThreeMonths(c.next_confirmation_statement)).map((c) => (
                                                <button key={c.id} onClick={() => setSelectedCompany(c)} style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', padding: isMobile ? '14px' : '16px 20px', fontSize: '1rem', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ffffff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', width: '100%' }}>
                                                        <span style={{ fontWeight: 600, wordBreak: 'break-word' }}>{c.company_name}</span>
                                                        <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#e53e3e', color: '#ffffff', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Due {formatDate(c.next_confirmation_statement)}</span>
                                                    </div>
                                                    <span style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>Company No: {c.company_number}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Pagination Controls */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingTop: '10px', borderTop: '1px solid #1a1c2e', gap: '8px' }}>
                                            <button
                                                onClick={() => fetchSupabaseCompanies(page - 1)}
                                                disabled={page === 1 || loading}
                                                style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: 'transparent', color: page === 1 ? '#555' : '#58a6ff', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                                            >
                                                ← Previous
                                            </button>
                                            <span style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>Page {page}</span>
                                            <button
                                                onClick={() => fetchSupabaseCompanies(page + 1)}
                                                disabled={page * itemsPerPage >= totalCount || loading}
                                                style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: 'transparent', color: page * itemsPerPage >= totalCount ? '#555' : '#58a6ff', cursor: page * itemsPerPage >= totalCount ? 'not-allowed' : 'pointer' }}
                                            >
                                                Next →
                                            </button>
                                        </div>
                                    </div>
                                )
                            )}

                            {selectedCompany && (
                                <div style={{ width: '100%', maxWidth: '600px', backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '18px' : '24px', boxSizing: 'border-box' }}>
                                    <h2 style={{ color: '#ffffff', fontSize: isMobile ? '1.2rem' : '1.4rem', marginTop: 0, marginBottom: '16px', wordBreak: 'break-word' }}>{selectedCompany.company_name}</h2>
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

                    {/* MANAGE CHARGES VIEW */}
                    {view === 'charges' && (
                        <div style={{ width: '100%', maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                <div>
                                    <h1 style={{ color: '#ffffff', fontSize: isMobile ? '1.5rem' : '2rem', margin: '0 0 6px 0' }}>Manage charges</h1>
                                    <p style={{ color: '#a0a4b8', fontSize: '0.95rem', margin: 0 }}>
                                        Add, update, or remove service fees stored in the charges table.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={fetchCharges}
                                    disabled={chargesLoading}
                                    style={{ padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#58a6ff', cursor: chargesLoading ? 'not-allowed' : 'pointer' }}
                                >
                                    ↻ Refresh
                                </button>
                            </div>

                            {/* ADD NEW CHARGE FORM */}
                            <div style={{ backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '16px' : '20px', boxSizing: 'border-box' }}>
                                <h2 style={{ color: '#ffffff', fontSize: '1.05rem', marginTop: 0, marginBottom: '14px' }}>Add new charge</h2>
                                <form onSubmit={handleAddCharge} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
                                    <input
                                        type="text"
                                        value={newChargeDesc}
                                        onChange={(e) => setNewChargeDesc(e.target.value)}
                                        placeholder="Description (e.g. Confirmation statement)"
                                        required
                                        style={{ flex: 2, width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={newChargeFee}
                                        onChange={(e) => setNewChargeFee(e.target.value)}
                                        placeholder="Fee (£)"
                                        required
                                        style={{ flex: 1, width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
                                    />
                                    <button
                                        type="submit"
                                        disabled={chargeSaving}
                                        style={{ padding: '10px 20px', fontSize: '0.95rem', fontWeight: 600, borderRadius: '8px', border: 'none', backgroundColor: '#58a6ff', color: '#030511', cursor: chargeSaving ? 'not-allowed' : 'pointer', opacity: chargeSaving ? 0.6 : 1, whiteSpace: 'nowrap' }}
                                    >
                                        {chargeSaving ? 'Saving...' : '+ Add Charge'}
                                    </button>
                                </form>
                            </div>

                            {chargesError && (
                                <p style={{ color: '#ff6b6b', fontSize: '0.92rem', margin: 0 }}>{chargesError}</p>
                            )}
                            {chargesSuccess && (
                                <p style={{ color: '#4ade80', fontSize: '0.92rem', margin: 0 }}>{chargesSuccess}</p>
                            )}

                            {/* EXISTING CHARGES LIST */}
                            <div style={{ backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '16px' : '20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <h2 style={{ color: '#ffffff', fontSize: '1.05rem', margin: 0 }}>Current charges</h2>

                                {chargesLoading ? (
                                    <p style={{ color: '#58a6ff', margin: '8px 0' }}>Loading charges...</p>
                                ) : charges.length === 0 ? (
                                    <p style={{ color: '#a0a4b8', margin: '8px 0' }}>No charges found yet. Add one above.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {charges.map((item) => {
                                            const isEditing = editingChargeId === item.id;
                                            return (
                                                <div
                                                    key={item.id}
                                                    style={{
                                                        padding: '14px 16px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #1a1c2e',
                                                        backgroundColor: '#030511',
                                                        display: 'flex',
                                                        flexDirection: isMobile || isEditing ? 'column' : 'row',
                                                        justifyContent: 'space-between',
                                                        alignItems: isMobile || isEditing ? 'stretch' : 'center',
                                                        gap: '12px',
                                                    }}
                                                >
                                                    {isEditing ? (
                                                        <>
                                                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', flex: 1 }}>
                                                                <input
                                                                    type="text"
                                                                    value={editChargeDesc}
                                                                    onChange={(e) => setEditChargeDesc(e.target.value)}
                                                                    placeholder="Description"
                                                                    style={{ flex: 2, width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: '15px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ffffff', outline: 'none' }}
                                                                />
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={editChargeFee}
                                                                    onChange={(e) => setEditChargeFee(e.target.value)}
                                                                    placeholder="Fee (£)"
                                                                    style={{ flex: 1, width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: '15px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ffffff', outline: 'none' }}
                                                                />
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveEditCharge(item.id)}
                                                                    disabled={chargeSaving}
                                                                    style={{ padding: '8px 16px', fontSize: '0.88rem', fontWeight: 600, borderRadius: '8px', border: 'none', backgroundColor: '#4ade80', color: '#030511', cursor: chargeSaving ? 'not-allowed' : 'pointer' }}
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleCancelEditCharge}
                                                                    style={{ padding: '8px 14px', fontSize: '0.88rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: 'transparent', color: '#a0a4b8', cursor: 'pointer' }}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <span style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, wordBreak: 'break-word' }}>
                                                                    {item.description}
                                                                </span>
                                                                <span style={{ color: '#4ade80', fontSize: '0.95rem', fontWeight: 700 }}>
                                                                    {formatCurrency(item.fee)}
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartEditCharge(item)}
                                                                    style={{ padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#58a6ff', cursor: 'pointer' }}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteCharge(item.id)}
                                                                    disabled={chargeSaving}
                                                                    style={{ padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ff6b6b', cursor: chargeSaving ? 'not-allowed' : 'pointer' }}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* MANAGE COSTS VIEW */}
                    {view === 'costs' && (
                        <div style={{ width: '100%', maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                <div>
                                    <h1 style={{ color: '#ffffff', fontSize: isMobile ? '1.5rem' : '2rem', margin: '0 0 6px 0' }}>Manage costs</h1>
                                    <p style={{ color: '#a0a4b8', fontSize: '0.95rem', margin: 0 }}>
                                        Add, update, or remove internal filing costs stored in the cost table.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={fetchCosts}
                                    disabled={costsLoading}
                                    style={{ padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#58a6ff', cursor: costsLoading ? 'not-allowed' : 'pointer' }}
                                >
                                    ↻ Refresh
                                </button>
                            </div>

                            {/* ADD NEW COST FORM */}
                            <div style={{ backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '16px' : '20px', boxSizing: 'border-box' }}>
                                <h2 style={{ color: '#ffffff', fontSize: '1.05rem', marginTop: 0, marginBottom: '14px' }}>Add new cost</h2>
                                <form onSubmit={handleAddCost} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px' }}>
                                    <input
                                        type="text"
                                        value={newCostDesc}
                                        onChange={(e) => setNewCostDesc(e.target.value)}
                                        placeholder="Description (e.g. Confirmation statement)"
                                        required
                                        style={{ flex: 2, width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={newCostCharge}
                                        onChange={(e) => setNewCostCharge(e.target.value)}
                                        placeholder="Cost (£)"
                                        required
                                        style={{ flex: 1, width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: '16px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#030511', color: '#ffffff', outline: 'none' }}
                                    />
                                    <button
                                        type="submit"
                                        disabled={costSaving}
                                        style={{ padding: '10px 20px', fontSize: '0.95rem', fontWeight: 600, borderRadius: '8px', border: 'none', backgroundColor: '#58a6ff', color: '#030511', cursor: costSaving ? 'not-allowed' : 'pointer', opacity: costSaving ? 0.6 : 1, whiteSpace: 'nowrap' }}
                                    >
                                        {costSaving ? 'Saving...' : '+ Add Cost'}
                                    </button>
                                </form>
                            </div>

                            {costsError && (
                                <p style={{ color: '#ff6b6b', fontSize: '0.92rem', margin: 0 }}>{costsError}</p>
                            )}
                            {costsSuccess && (
                                <p style={{ color: '#4ade80', fontSize: '0.92rem', margin: 0 }}>{costsSuccess}</p>
                            )}

                            {/* EXISTING COSTS LIST */}
                            <div style={{ backgroundColor: '#0d1020', border: '1px solid #1a1c2e', borderRadius: '12px', padding: isMobile ? '16px' : '20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <h2 style={{ color: '#ffffff', fontSize: '1.05rem', margin: 0 }}>Current costs</h2>

                                {costsLoading ? (
                                    <p style={{ color: '#58a6ff', margin: '8px 0' }}>Loading costs...</p>
                                ) : costs.length === 0 ? (
                                    <p style={{ color: '#a0a4b8', margin: '8px 0' }}>No costs found yet. Add one above.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {costs.map((item) => {
                                            const isEditing = editingCostId === item.id;
                                            return (
                                                <div
                                                    key={item.id}
                                                    style={{
                                                        padding: '14px 16px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #1a1c2e',
                                                        backgroundColor: '#030511',
                                                        display: 'flex',
                                                        flexDirection: isMobile || isEditing ? 'column' : 'row',
                                                        justifyContent: 'space-between',
                                                        alignItems: isMobile || isEditing ? 'stretch' : 'center',
                                                        gap: '12px',
                                                    }}
                                                >
                                                    {isEditing ? (
                                                        <>
                                                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', flex: 1 }}>
                                                                <input
                                                                    type="text"
                                                                    value={editCostDesc}
                                                                    onChange={(e) => setEditCostDesc(e.target.value)}
                                                                    placeholder="Description"
                                                                    style={{ flex: 2, width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: '15px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ffffff', outline: 'none' }}
                                                                />
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={editCostCharge}
                                                                    onChange={(e) => setEditCostCharge(e.target.value)}
                                                                    placeholder="Cost (£)"
                                                                    style={{ flex: 1, width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: '15px', borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ffffff', outline: 'none' }}
                                                                />
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveEditCost(item.id)}
                                                                    disabled={costSaving}
                                                                    style={{ padding: '8px 16px', fontSize: '0.88rem', fontWeight: 600, borderRadius: '8px', border: 'none', backgroundColor: '#4ade80', color: '#030511', cursor: costSaving ? 'not-allowed' : 'pointer' }}
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleCancelEditCost}
                                                                    style={{ padding: '8px 14px', fontSize: '0.88rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: 'transparent', color: '#a0a4b8', cursor: 'pointer' }}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <span style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 600, wordBreak: 'break-word' }}>
                                                                    {item.description}
                                                                </span>
                                                                <span style={{ color: '#ff6b6b', fontSize: '0.95rem', fontWeight: 700 }}>
                                                                    {formatCurrency(item.charge)}
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartEditCost(item)}
                                                                    style={{ padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#58a6ff', cursor: 'pointer' }}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteCost(item.id)}
                                                                    disabled={costSaving}
                                                                    style={{ padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600, borderRadius: '8px', border: '1px solid #1a1c2e', backgroundColor: '#0d1020', color: '#ff6b6b', cursor: costSaving ? 'not-allowed' : 'pointer' }}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
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