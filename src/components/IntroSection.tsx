const stats = [
  { valor: '10.000+', label: 'Criadores ativos' },
  { valor: '500K+', label: 'Posts publicados' },
  { valor: '6', label: 'Redes sociais' },
  { valor: '98%', label: 'Satisfação dos clientes' },
];

const IntroSection = () => {
  return (
    <section className="py-12 md:py-16 animate-fade-in">
      {/* Headline central */}
      <div className="text-center space-y-4 max-w-3xl mx-auto mb-12 animate-slide-up">
        <h2 className="text-3xl md:text-4xl font-bold leading-tight">
          Tudo que você precisa para{" "}
          <span className="text-primary">dominar as redes sociais</span>
        </h2>
        <p className="text-lg text-muted-foreground leading-relaxed">
          De criadores independentes a grandes agências, o Laurena Studio é a plataforma que centraliza
          criação, agendamento e análise de conteúdo em um único painel.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`text-center rounded-2xl bg-card border border-border p-6 animate-slide-up stagger-${i + 1}`}
          >
            <p className="text-3xl md:text-4xl font-bold text-primary">{s.valor}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default IntroSection;
