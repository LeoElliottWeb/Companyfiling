import React, { useState } from 'react';
import homeGif from './home.gif';

export default function RadioStation() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [company, setCompany] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [view, setView] = useState('search'); // 'search' | 'companies' | 'dueSoon'
    const [selectedCompany, setSelectedCompany] = useState(null);

    // ⚠️ Try your LIVE API key here if the Sandbox key continues to fail.
    const API_KEY = '445ee101-fd1e-41f7-939d-ae1797b9e0d0';

    // Static list of companies with contact details
    const COMPANIES = [
        {
            id: 1,
            name: 'Acme Trading Ltd',
            registeredAddress: '12 High Street, London, EC1A 1BB',
            yearIncorporated: 2015,
            directors: 'John Smith, Jane Doe',
            email: 'contact@acmetrading.co.uk',
            confirmationStatementDue: '2027-01-14',
            lastConfirmations: [
                { date: '2024-08-14', madeUpTo: '2024-08-01', filedBy: 'companyfiling.online' },
                { date: '2023-08-14', madeUpTo: '2023-08-01', filedBy: 'companieshouse.gov.uk' },
                { date: '2022-08-14', madeUpTo: '2022-08-01', filedBy: 'companyfiling.online' },
            ],
        },
        {
            id: 2,
            name: 'Blue Sky Solutions Ltd',
            registeredAddress: '45 Park Lane, Manchester, M1 2AB',
            yearIncorporated: 2018,
            directors: 'Sarah Johnson, Michael Brown',
            email: 'info@blueskysolutions.co.uk',
            confirmationStatementDue: '2025-11-02',
            lastConfirmations: [
                { date: '2024-11-02', madeUpTo: '2024-10-19', filedBy: 'companieshouse.gov.uk' },
                { date: '2023-11-02', madeUpTo: '2023-10-19', filedBy: 'companieshouse.gov.uk' },
                { date: '2022-11-02', madeUpTo: '2022-10-19', filedBy: 'companyfiling.online' },
            ],
        },
        {
            id: 3,
            name: 'Greenfield Logistics Ltd',
            registeredAddress: '7 Riverside Way, Leeds, LS1 4CD',
            yearIncorporated: 2012,
            directors: 'David Wilson, Emma Taylor',
            email: 'hello@greenfieldlogistics.co.uk',
            confirmationStatementDue: '2027-01-20',
            lastConfirmations: [
                { date: '2025-01-20', madeUpTo: '2025-01-06', filedBy: 'companyfiling.online' },
                { date: '2024-01-20', madeUpTo: '2024-01-06', filedBy: 'companyfiling.online' },
                { date: '2023-01-20', madeUpTo: '2023-01-06', filedBy: 'companieshouse.gov.uk' },
            ],
        },
        {
            id: 4,
            name: 'Nova Digital Media Ltd',
            registeredAddress: '88 Baker Street, Birmingham, B1 3EF',
            yearIncorporated: 2020,
            directors: 'Chris Evans, Laura White',
            email: 'team@novadigital.co.uk',
            confirmationStatementDue: '2025-09-30',
            lastConfirmations: [
                { date: '2024-09-30', madeUpTo: '2024-09-16', filedBy: 'companyfiling.online' },
                { date: '2023-09-30', madeUpTo: '2023-09-16', filedBy: 'companyfiling.online' },
            ],
        },
        {
            id: 5,
            name: 'Pinnacle Consulting Group Ltd',
            registeredAddress: '3 Queen Square, Bristol, BS1 5GH',
            yearIncorporated: 2009,
            directors: 'Robert Clarke, Anna Green',
            email: 'enquiries@pinnacleconsulting.co.uk',
            confirmationStatementDue: '2025-12-15',
            lastConfirmations: [
                { date: '2024-12-15', madeUpTo: '2024-12-01', filedBy: 'companieshouse.gov.uk' },
                { date: '2023-12-15', madeUpTo: '2023-12-01', filedBy: 'companieshouse.gov.uk' },
                { date: '2022-12-15', madeUpTo: '2022-12-01', filedBy: 'companieshouse.gov.uk' },
            ],
        },
    ];

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
            const apiUrl = `/api/search/companies?q=${encodeURIComponent(trimmed)}`;
            const authHeader = 'Basic ' + btoa(`${API_KEY}:`);

            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': authHeader,
                    // Explicitly set a User-Agent to avoid API rejection
                    'User-Agent': 'MyCompanyFilingApp/1.0',
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // The API may provide a specific error reason in a header
                    const apiError = response.headers.get('Ch-Authentication-Error');
                    throw new Error(`Unauthorized. ${apiError || 'Please check if your API key is correct.'}`);
                }
                if (response.status === 403) {
                    throw new Error('Forbidden. The API key may be restricted or the request was blocked.');
                }
                throw new Error(`Search failed (status ${response.status}).`);
            }

            const data = await response.json();
            const items = data.items || [];

            if (items.length === 0) {
                setError('No companies found matching that search.');
            } else {
                setCompany(items[0]);
            }
        } catch (err) {
            setError(err.message || 'Could not retrieve company details. Please try again.');
        } finally {
            setLoading(false);
        }
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

    const isDueWithinThreeMonths = (dateString) => {
        if (!dateString) return false;
        const dueDate = new Date(dateString);
        const today = new Date();
        const threeMonthsFromNow = new Date();
        threeMonthsFromNow.setMonth(today.getMonth() + 3);

        // Normalize times to midnight for accurate comparison
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
    };

    const ConfirmationStatementList = ({ companyData }) => {
        if (!companyData.lastConfirmations || companyData.lastConfirmations.length === 0) return null;

        return (
            <div style={{ marginTop: '24px' }}>
                <h3
                    style={{
                        color: '#ffffff',
                        fontSize: '1.1rem',
                        marginTop: 0,
                        marginBottom: '12px',
                        borderTop: '1px solid #1a1c2e',
                        paddingTop: '16px',
                    }}
                >
                    Last Confirmation Statements Filed
                </h3>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                    }}
                >
                    {companyData.lastConfirmations.map((conf, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                backgroundColor: '#15182b',
                                padding: '12px 14px',
                                borderRadius: '6px',
                                fontSize: '0.9rem',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#ffffff' }}>
                                    Filed: {formatDate(conf.date)}
                                </span>
                                <span style={{ color: '#a0a4b8' }}>
                                    Made up to: {formatDate(conf.madeUpTo)}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <span style={{ color: '#a0a4b8' }}>Filed via:</span>
                                <span
                                    style={{
                                        color: conf.filedBy === 'companyfiling.online' ? '#38a169' : '#58a6ff',
                                        fontWeight: 600,
                                    }}
                                >
                                    {conf.filedBy || 'Unknown'}
                                </span>
                                {conf.filedBy === 'companyfiling.online' && (
                                    <span
                                        style={{
                                            backgroundColor: '#22543d',
                                            color: '#48bb78',
                                            fontSize: '0.7rem',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        Our Service
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                backgroundColor: '#030511',
                margin: 0,
                fontFamily: 'Segoe UI, sans-serif',
            }}
        >
            <div style={{ display: 'flex', flex: 1 }}>
                {/* LEFT SIDEBAR: Links */}
                <div
                    style={{
                        width: '250px',
                        padding: '40px 20px',
                        backgroundColor: '#030511',
                        borderRight: '1px solid #1a1c2e',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                    }}
                >
                    <h2
                        style={{
                            color: '#ffffff',
                            fontSize: '1.2rem',
                            marginTop: 0,
                            marginBottom: '10px',
                        }}
                    >
                        Company Services
                    </h2>
                    <button
                        onClick={() => handleViewChange('search')}
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            textAlign: 'left',
                            color: view === 'search' ? '#ffffff' : '#58a6ff',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            fontWeight: view === 'search' ? 600 : 400,
                        }}
                    >
                        Company filing search
                    </button>
                    <button
                        onClick={() => handleViewChange('companies')}
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            textAlign: 'left',
                            color: view === 'companies' ? '#ffffff' : '#58a6ff',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            fontWeight: view === 'companies' ? 600 : 400,
                        }}
                    >
                        List of companies
                    </button>
                    <button
                        onClick={() => handleViewChange('dueSoon')}
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            textAlign: 'left',
                            color: view === 'dueSoon' ? '#ffffff' : '#58a6ff',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            fontWeight: view === 'dueSoon' ? 600 : 400,
                        }}
                    >
                        Get Confirmation Statements due with 3 months
                    </button>
                </div>

                {/* RIGHT SIDE: Main Content */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                        padding: '40px 20px',
                        boxSizing: 'border-box',
                    }}
                >
                    {view === 'search' && (
                        <>
                            <h1
                                style={{
                                    color: '#ffffff',
                                    fontSize: '2rem',
                                    textAlign: 'center',
                                    marginBottom: '20px',
                                    marginTop: '0',
                                }}
                            >
                                Automated company filing
                            </h1>

                            <p
                                style={{
                                    color: '#a0a4b8',
                                    fontSize: '1rem',
                                    textAlign: 'center',
                                    marginTop: 0,
                                    marginBottom: '30px',
                                    maxWidth: '600px',
                                }}
                            >
                                Search for your company by name or company number to see
                                when your confirmation statement is due.
                            </p>

                            {/* Search form */}
                            <form
                                onSubmit={handleSearch}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    gap: '10px',
                                    width: '100%',
                                    maxWidth: '600px',
                                    marginBottom: '20px',
                                }}
                            >
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Company name or company number"
                                    aria-label="Company name or company number"
                                    style={{
                                        flex: 1,
                                        padding: '12px 16px',
                                        fontSize: '1rem',
                                        borderRadius: '8px',
                                        border: '1px solid #1a1c2e',
                                        backgroundColor: '#0d1020',
                                        color: '#ffffff',
                                        outline: 'none',
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        padding: '12px 24px',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: '#58a6ff',
                                        color: '#030511',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        opacity: loading ? 0.6 : 1,
                                    }}
                                >
                                    {loading ? 'Searching...' : 'Search'}
                                </button>
                            </form>

                            {/* Error message */}
                            {error && (
                                <p
                                    style={{
                                        color: '#ff6b6b',
                                        fontSize: '1rem',
                                        textAlign: 'center',
                                        maxWidth: '600px',
                                    }}
                                >
                                    {error}
                                </p>
                            )}

                            {/* Company result */}
                            {company && (
                                <div
                                    style={{
                                        width: '100%',
                                        maxWidth: '600px',
                                        backgroundColor: '#0d1020',
                                        border: '1px solid #1a1c2e',
                                        borderRadius: '12px',
                                        padding: '24px',
                                        boxSizing: 'border-box',
                                    }}
                                >
                                    <h2
                                        style={{
                                            color: '#ffffff',
                                            fontSize: '1.4rem',
                                            marginTop: 0,
                                            marginBottom: '8px',
                                        }}
                                    >
                                        {company.title}
                                    </h2>
                                    <p
                                        style={{
                                            color: '#a0a4b8',
                                            fontSize: '0.95rem',
                                            margin: '0 0 16px 0',
                                        }}
                                    >
                                        Company number: {company.company_number}
                                    </p>

                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                        }}
                                    >
                                        <p
                                            style={{
                                                color: '#ffffff',
                                                fontSize: '1rem',
                                                margin: 0,
                                            }}
                                        >
                                            <strong>Confirmation statement due:</strong>{' '}
                                            {formatDate(
                                                company.confirmation_statement &&
                                                company.confirmation_statement
                                                    .next_due
                                            )}
                                            {company.confirmation_statement &&
                                                company.confirmation_statement.next_due &&
                                                isDueWithinThreeMonths(company.confirmation_statement.next_due) && (
                                                    <span
                                                        style={{
                                                            marginLeft: '12px',
                                                            padding: '4px 10px',
                                                            borderRadius: '12px',
                                                            backgroundColor: '#e53e3e',
                                                            color: '#ffffff',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600,
                                                            textTransform: 'uppercase',
                                                        }}
                                                    >
                                                        Due within 3 months
                                                    </span>
                                                )}
                                        </p>
                                        {company.confirmation_statement &&
                                            company.confirmation_statement.last_made_up_to && (
                                                <p
                                                    style={{
                                                        color: '#a0a4b8',
                                                        fontSize: '0.95rem',
                                                        margin: 0,
                                                    }}
                                                >
                                                    Last made up to:{' '}
                                                    {formatDate(
                                                        company.confirmation_statement
                                                            .last_made_up_to
                                                    )}
                                                </p>
                                            )}
                                    </div>
                                    <p
                                        style={{
                                            color: '#a0a4b8',
                                            fontSize: '0.85rem',
                                            marginTop: '16px',
                                            marginBottom: 0,
                                        }}
                                    >
                                        {company.address_snippet}
                                    </p>
                                </div>
                            )}

                            {/* Fallback / hero image when nothing has been searched */}
                            {!hasSearched && (
                                <>
                                    <img
                                        src={homeGif}
                                        alt="home"
                                        style={{
                                            width: '50%',
                                            maxHeight: '50vh',
                                            objectFit: 'contain',
                                            marginTop: '20px',
                                        }}
                                    />
                                    <p
                                        style={{
                                            color: '#ffffff',
                                            fontSize: '1.2rem',
                                            textAlign: 'center',
                                            marginTop: '30px',
                                        }}
                                    >
                                        Automatic reminders via email and one-click
                                        approvals
                                    </p>
                                </>
                            )}
                        </>
                    )}

                    {view === 'companies' && (
                        <>
                            <h1
                                style={{
                                    color: '#ffffff',
                                    fontSize: '2rem',
                                    textAlign: 'center',
                                    marginBottom: '20px',
                                    marginTop: '0',
                                }}
                            >
                                List of companies
                            </h1>

                            <p
                                style={{
                                    color: '#a0a4b8',
                                    fontSize: '1rem',
                                    textAlign: 'center',
                                    marginTop: 0,
                                    marginBottom: '30px',
                                    maxWidth: '600px',
                                }}
                            >
                                Select a company to view its contact details.
                            </p>

                            {!selectedCompany && (
                                <div
                                    style={{
                                        width: '100%',
                                        maxWidth: '600px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                    }}
                                >
                                    {COMPANIES.map((c) => (
                                        <button
                                            key={c.id}
                                            onClick={() => setSelectedCompany(c)}
                                            style={{
                                                textAlign: 'left',
                                                padding: '16px 20px',
                                                fontSize: '1rem',
                                                borderRadius: '8px',
                                                border: '1px solid #1a1c2e',
                                                backgroundColor: '#0d1020',
                                                color: '#ffffff',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px',
                                                position: 'relative',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    width: '100%',
                                                }}
                                            >
                                                <span style={{ fontWeight: 600 }}>{c.name}</span>
                                                {isDueWithinThreeMonths(c.confirmationStatementDue) && (
                                                    <span
                                                        style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '12px',
                                                            backgroundColor: '#e53e3e',
                                                            color: '#ffffff',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            textTransform: 'uppercase',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        Due soon
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>
                                                {c.registeredAddress}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {selectedCompany && (
                                <div
                                    style={{
                                        width: '100%',
                                        maxWidth: '600px',
                                        backgroundColor: '#0d1020',
                                        border: '1px solid #1a1c2e',
                                        borderRadius: '12px',
                                        padding: '24px',
                                        boxSizing: 'border-box',
                                    }}
                                >
                                    <h2
                                        style={{
                                            color: '#ffffff',
                                            fontSize: '1.4rem',
                                            marginTop: 0,
                                            marginBottom: '16px',
                                        }}
                                    >
                                        {selectedCompany.name}
                                    </h2>

                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px',
                                        }}
                                    >
                                        <p style={{ margin: 0, color: '#ffffff' }}>
                                            <strong style={{ color: '#a0a4b8' }}>Registered address: </strong>
                                            {selectedCompany.registeredAddress}
                                        </p>
                                        <p style={{ margin: 0, color: '#ffffff' }}>
                                            <strong style={{ color: '#a0a4b8' }}>Year incorporated: </strong>
                                            {selectedCompany.yearIncorporated}
                                        </p>
                                        <p style={{ margin: 0, color: '#ffffff' }}>
                                            <strong style={{ color: '#a0a4b8' }}>Directors: </strong>
                                            {selectedCompany.directors}
                                        </p>
                                        <p style={{ margin: 0, color: '#ffffff' }}>
                                            <strong style={{ color: '#a0a4b8' }}>Email address: </strong>
                                            <a
                                                href={`mailto:${selectedCompany.email}`}
                                                style={{ color: '#58a6ff', textDecoration: 'none' }}
                                            >
                                                {selectedCompany.email}
                                            </a>
                                        </p>
                                        <p style={{ margin: 0, color: '#ffffff' }}>
                                            <strong style={{ color: '#a0a4b8' }}>Confirmation statement due: </strong>
                                            {formatDate(selectedCompany.confirmationStatementDue)}
                                            {isDueWithinThreeMonths(selectedCompany.confirmationStatementDue) && (
                                                <span
                                                    style={{
                                                        marginLeft: '12px',
                                                        padding: '4px 10px',
                                                        borderRadius: '12px',
                                                        backgroundColor: '#e53e3e',
                                                        color: '#ffffff',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 600,
                                                        textTransform: 'uppercase',
                                                    }}
                                                >
                                                    Due within 3 months
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    {/* Last confirmation statements filed */}
                                    <ConfirmationStatementList companyData={selectedCompany} />

                                    <button
                                        onClick={() => setSelectedCompany(null)}
                                        style={{
                                            marginTop: '24px',
                                            padding: '10px 20px',
                                            fontSize: '0.95rem',
                                            fontWeight: 600,
                                            borderRadius: '8px',
                                            border: '1px solid #1a1c2e',
                                            backgroundColor: 'transparent',
                                            color: '#58a6ff',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        ← Back to list
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {view === 'dueSoon' && (
                        <>
                            <h1
                                style={{
                                    color: '#ffffff',
                                    fontSize: '2rem',
                                    textAlign: 'center',
                                    marginBottom: '20px',
                                    marginTop: '0',
                                }}
                            >
                                Confirmation statements due
                            </h1>

                            <p
                                style={{
                                    color: '#a0a4b8',
                                    fontSize: '1rem',
                                    textAlign: 'center',
                                    marginTop: 0,
                                    marginBottom: '30px',
                                    maxWidth: '600px',
                                }}
                            >
                                Companies with confirmation statements due within the next 3 months.
                            </p>

                            {!selectedCompany && (
                                <div
                                    style={{
                                        width: '100%',
                                        maxWidth: '600px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                    }}
                                >
                                    {COMPANIES.filter((c) => isDueWithinThreeMonths(c.confirmationStatementDue)).length === 0 ? (
                                        <p style={{ color: '#a0a4b8', textAlign: 'center' }}>
                                            No confirmation statements are due within the next 3 months.
                                        </p>
                                    ) : (
                                        COMPANIES.filter((c) => isDueWithinThreeMonths(c.confirmationStatementDue)).map((c) => (
                                            <button
                                                key={c.id}
                                                onClick={() => setSelectedCompany(c)}
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '16px 20px',
                                                    fontSize: '1rem',
                                                    borderRadius: '8px',
                                                    border: '1px solid #1a1c2e',
                                                    backgroundColor: '#0d1020',
                                                    color: '#ffffff',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '4px',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        width: '100%',
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                                                    <span
                                                        style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '12px',
                                                            backgroundColor: '#e53e3e',
                                                            color: '#ffffff',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600,
                                                            textTransform: 'uppercase',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        Due {formatDate(c.confirmationStatementDue)}
                                                    </span>
                                                </div>
                                                <span style={{ color: '#a0a4b8', fontSize: '0.9rem' }}>
                                                    {c.registeredAddress}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {selectedCompany && (
                                <div
                                    style={{
                                        width: '100%',
                                        maxWidth: '600px',
                                        backgroundColor: '#0d1020',
                                        border: '1px solid #1a1c2e',
                                        borderRadius: '12px',
                                        padding: '24px',
                                        boxSizing: 'border-box',
                                    }}
                                >
                                    <h2
                                        style={{
                                            color: '#ffffff',
                                            fontSize: '1.4rem',
                                            marginTop: 0,
                                            marginBottom: '16px',
                                        }}
                                    >
                                        {selectedCompany.name}
                                    </h2>

                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px',
                                        }}
                                    >
                                        <p style={{ margin: 0, color: '#ffffff' }}>
                                            <strong style={{ color: '#a0a4b8' }}>Registered address: </strong>
                                            {selectedCompany.registeredAddress}
                                        </p>
                                        <p style={{ margin: 0, color: '#ffffff' }}>
                                            <strong style={{ color: '#a0a4b8' }}>Year incorporated: </strong>
                                            {selectedCompany.yearIncorporated}
                                        </p>
                                        <p style={{ margin: 0, color: '#ffffff' }}>
                                            <strong style={{ color: '#a0a4b8' }}>Directors: </strong>
                                            {selectedCompany.directors}
                                        </p>
                                        <p style={{ margin: 0, color: '#ffffff' }}>
                                            <strong style={{ color: '#a0a4b8' }}>Email address: </strong>
                                            <a
                                                href={`mailto:${selectedCompany.email}`}
                                                style={{ color: '#58a6ff', textDecoration: 'none' }}
                                            >
                                                {selectedCompany.email}
                                            </a>
                                        </p>
                                        <p style={{ margin: 0, color: '#ffffff' }}>
                                            <strong style={{ color: '#a0a4b8' }}>Confirmation statement due: </strong>
                                            {formatDate(selectedCompany.confirmationStatementDue)}
                                            <span
                                                style={{
                                                    marginLeft: '12px',
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    backgroundColor: '#e53e3e',
                                                    color: '#ffffff',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                Due within 3 months
                                            </span>
                                        </p>
                                    </div>

                                    {/* Last confirmation statements filed */}
                                    <ConfirmationStatementList companyData={selectedCompany} />

                                    <button
                                        onClick={() => setSelectedCompany(null)}
                                        style={{
                                            marginTop: '24px',
                                            padding: '10px 20px',
                                            fontSize: '0.95rem',
                                            fontWeight: 600,
                                            borderRadius: '8px',
                                            border: '1px solid #1a1c2e',
                                            backgroundColor: 'transparent',
                                            color: '#58a6ff',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        ← Back to list
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* FOOTER */}
            <footer
                style={{
                    borderTop: '1px solid #1a1c2e',
                    padding: '24px 20px',
                    textAlign: 'center',
                    backgroundColor: '#030511',
                    color: '#a0a4b8',
                    fontSize: '0.9rem',
                }}
            >
                <p style={{ margin: '0 0 8px 0' }}>
                    NOIRSOFT LTD &bull; Registration number 15337702
                </p>
                <p style={{ margin: 0 }}>
                    Email:{' '}
                    <a
                        href="mailto:Sales@NoirSoft.net"
                        style={{ color: '#58a6ff', textDecoration: 'none' }}
                    >
                        Sales@NoirSoft.net
                    </a>
                </p>
            </footer>
        </div>
    );
}