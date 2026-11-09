from app.routes import agente, atendimentos, auth, clientes, insights, modelo, painel, relatorios

ROUTERS = [
    auth.router,
    painel.router,
    clientes.router,
    atendimentos.router,
    insights.router,
    relatorios.router,
    agente.router,
    modelo.router,
]
