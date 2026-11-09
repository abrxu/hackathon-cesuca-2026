from fastapi import HTTPException, Request


def get_store(request: Request):
    store = getattr(request.app.state, "store", None)
    if store is None:
        raise HTTPException(
            500,
            detail={
                "codigo": "erro_interno",
                "mensagem": "Os dados não foram carregados. Verifique o servidor.",
            },
        )
    return store


def nao_encontrado(msg: str = "Recurso não encontrado."):
    return HTTPException(404, detail={"codigo": "nao_encontrado", "mensagem": msg})


def cliente_ou_404(store, cid: str):
    if not store.existe(cid):
        raise nao_encontrado(f"Cliente {cid} não encontrado.")
