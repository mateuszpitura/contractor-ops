export default function HomePage() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
      }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Contractor Ops</h1>
      <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
        Contractor management and invoice processing platform
      </p>
    </main>
  );
}
