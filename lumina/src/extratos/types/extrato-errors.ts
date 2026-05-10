export const EXTRATO_ERROR_CODES = {
  PDF_ENCRYPTED: 'PDF_ENCRYPTED',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
} as const;

export type ExtratoErrorCode =
  (typeof EXTRATO_ERROR_CODES)[keyof typeof EXTRATO_ERROR_CODES];
