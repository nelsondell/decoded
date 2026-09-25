/**
 * Numa revalidação ISR em produção, lançar o erro mantém no ar a última
 * versão boa da página em vez de cachear um estado de erro. No build e no
 * dev não existe versão anterior — aí quem chama segue e degrada, mostrando
 * o erro, para que uma API fora do ar não derrube o deploy inteiro.
 */
export function rethrowDuringRevalidation(error: unknown): void {
  const building = process.env.NEXT_PHASE === "phase-production-build";
  if (process.env.NODE_ENV === "production" && !building) throw error;
}
