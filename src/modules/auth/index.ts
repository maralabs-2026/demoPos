// Public API of the auth module. Other modules import only from here.
export { changePasswordSchema, loginSchema } from "./schemas";
export type { ChangePasswordInput, LoginInput } from "./schemas";
export {
  authenticateWithMock,
  clearMockSession,
  findMockUsuario,
  getMockSession,
  mockUsuarios,
  storeMockSession,
  updateMockPassword,
} from "./mock";
export type { LoginErrorCode, MockSession, MockUsuario, Rol } from "./mock";
export { DEFAULT_NEXT, getNextRoute } from "./next-route";
export { mustChangePassword } from "./session-guard";
export { splitBrandName } from "./brand";
