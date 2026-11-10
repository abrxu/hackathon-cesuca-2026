from app.routes import agente, atendimentos, auth, clientes, gestor, insights, modelo, painel, relatorios

ROUTERS = [
    auth.router,
    painel.router,
    clientes.router,
    atendimentos.router,
    insights.router,
    gestor.router,
    relatorios.router,
    agente.router,
    modelo.router,
]
