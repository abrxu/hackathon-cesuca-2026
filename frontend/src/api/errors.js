export class ApiError extends Error {
  constructor(codigo, mensagem, status) {
    super(mensagem);
    this.codigo = codigo;
    this.status = status;
  }
}
