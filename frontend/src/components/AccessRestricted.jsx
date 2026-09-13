import React from 'react';

export default function AccessRestricted({ user, onGoToDashboard }) {
  const roleName = user?.role === 'AUDITOR' 
    ? 'Third-Party Auditor' 
    : user?.role === 'SUPPLIER' 
    ? 'Supplier Representative' 
    : 'Company Manager';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      padding: '32px 16px'
    }}>
      <div style={{
        maxWidth: '540px',
        width: '100%',
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '40px 32px',
        textAlign: 'center',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.03)'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#DC2626',
          fontSize: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto'
        }}>
          🛡️
        </div>

        <h2 style={{
          fontSize: '24px',
          fontWeight: 700,
          color: '#0F172A',
          marginBottom: '8px',
          letterSpacing: '-0.02em'
        }}>
          Access Restricted
        </h2>

        <p style={{
          fontSize: '15px',
          color: '#64748B',
          lineHeight: '1.6',
          marginBottom: '24px'
        }}>
          You don't have permission to view this page. Your authenticated account is provisioned as <strong>{roleName}</strong>.
        </p>

        <div style={{
          background: '#F8FAFC',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '28px',
          border: '1px solid #E2E8F0',
          fontSize: '13px',
          color: '#475569',
          textAlign: 'left'
        }}>
          <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: '4px' }}>🔒 Role-Based Access Control (RBAC)</div>
          <div>Access to cross-tenant or role-restricted resources is isolated at both frontend routes and Django backend permissions.</div>
        </div>

        <button
          className="btn btn-primary btn-lg"
          onClick={onGoToDashboard}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 28px',
            fontSize: '15px',
            fontWeight: 600,
            borderRadius: '8px',
            background: '#065F46',
            color: '#FFFFFF',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(6, 95, 70, 0.25)'
          }}
        >
          <span>←</span>
          <span>Go to My Dashboard</span>
        </button>
      </div>
    </div>
  );
}
