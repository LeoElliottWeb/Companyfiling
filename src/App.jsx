import React, { useState } from 'react';
import homeGif from './home.gif';

const SUPABASE_ANON_KEY = 'sb_publishable_oGXmxWNXvypN8XyjM71sBA_b_DINXJo';

export default function RadioStation() {
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

    const CH_API_KEY = 'ca7f120b-6b10-43db-8043-d8602205fd58';

    // ─── Fetch companies from Supabase via Vite Proxy ───
    const fetchSupabaseCompanies = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/supabase/rest/v1/companies?select=*&order=id.desc&limit=100', {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Supabase Error (${res.status}): ${errorText}`);
            }

            const data = await res.json();
            setSupabaseCompanies(data || []);
        } catch (err) {
            console.error('[Supabase fetch error]', err);
            setError('Failed to load database records: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── Companies House search ───
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
            const url = `/api/ch/search/companies?q=${encodeURIComponent(trimmed)}`;
            const res = await fetch(url, {
                headers: { Authorization: authHeader, Accept: 'application/json' },
            });
            if (!res.ok) {
                if (res.status === 401) throw new Error('Unauthorized. Check your Companies House API key.');
                if (res.status === 404) throw new Error('No companies found.');
                throw new Error(`Search failed (${res.status}).`);
            }
            const data = await res.json();
            const items = data.items || [];
            if (items.length === 0) {
                setError('No companies found matching that search.');
            } else {
                const raw = items[0];
                setCompany({
                    title: raw.title,
                    company_number: raw.company_number,
                    address_snippet: raw.address_snippet,
                    confirmation_statement: null,
                });
            }
        } catch (err) {
            setError(err.message || 'Could not retrieve company details.');
        } finally {
            setLoading(false);
        }
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

        if (newView === 'companies' || newView === 'dueSoon') {
            fetchSupabaseCompanies();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#030511', margin: 0, fontFamily: 'Segoe UI, sans-serif' }}>
            <div style={{ display: 'flex', flex: 1 }}>

                {/* SIDEBAR */}
                <div style={{ width: '250px', padding: '40px 20px', backgroundColor: '#030511', borderRight: '1px solid #1a1c2e', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h2 style={{ color: '#ffffff', fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Company Services</h2>
                    <button onClick={() => handleViewChange('search')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: view === 'search' ? '#ffffff' : '#58a6ff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: view === 'search' ? 600 : 400 }}>Company filing search</button>
                    <button onClick={() => handleViewChange('companies')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: view === 'companies' ? '#ffffff' : '#58a6ff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: view === 'companies' ? 600 : 400 }}>List of companies</button>
                    <button onClick={() => handleViewChange('dueSoon')} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: view === 'dueSoon' ? '#ffffff' : '#58a6ff', fontSize: '1.1rem', cursor: 'pointer', fontWeight: view === 'dueSoon' ? 600 : 400 }}>Get Confirmation Statements due with 3 months</button>
                </div>

                {/* MAIN CONTENT */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', padding: '40px 20px', boxSizing: 'border-box' }}>

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
                                    <p style={{ color: '#ffffff', fontSize: '1rem', margin: 0 }}><strong>Confirmation statement due:</strong>{' '}{company.confirmation_statement ? formatDate(company.confirmation_statement.next_due) : 'Data not available via basic search API'}</p>
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
                            <p style={{ color: '#a0a4b8', fontSize: '1rem', textAlign: 'center', marginTop: 0, marginBottom: '30px', maxWidth: '600px' }}>Companies stored in the database (showing latest 100).</p>

                            {loading && <p style={{ color: '#58a6ff' }}>Loading database records...</p>}
                            {error && <p style={{ color: '#ff6b6b', textAlign: 'center', maxWidth: '600px' }}>{error}</p>}

                            {!loading && !error && supabaseCompanies.length === 0 && (
                                <p style={{ color: '#a0a4b8', textAlign: 'center' }}>No companies found in the database.</p>
                            )}

                            {!selectedCompany && !loading && !error && supabaseCompanies.length > 0 && (
                                <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                                <p style={{ color: '#a0a4b8', textAlign: 'center' }}>No confirmation statements are due within the next 3 months (in the latest 100 records).</p>
                            ) : (
                                !selectedCompany && !loading && (
                                    <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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