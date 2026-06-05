export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Clínica IC</h1>
      <p style={{ color: '#555', marginBottom: '2rem' }}>
        Plataforma de acompanhamento de emagrecimento saudável.
      </p>

      <div style={{ display: 'grid', gap: '1rem' }}>
        <a
          href="/portal"
          style={{
            display: 'block',
            padding: '1.25rem',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e5e5e5',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <strong>Portal do paciente →</strong>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>
            Evolução, agenda, cardápio, exames e conexão do relógio.
          </p>
        </a>

        <a
          href="/clinica"
          style={{
            display: 'block',
            padding: '1.25rem',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e5e5e5',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <strong>Painel da clínica →</strong>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>
            Pacientes, evolução, nutrição, atividade e alertas.
          </p>
        </a>
      </div>
    </main>
  );
}
